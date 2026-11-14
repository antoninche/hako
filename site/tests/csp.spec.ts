/**
 * Politique de sécurité du contenu (CSP) et en-têtes de production.
 *
 * Le site construit est servi par scripts/serve-prod.mjs, qui envoie les mêmes
 * en-têtes que l'hébergeur (docs/exemples/htaccess). Sur chaque page, à 390 et
 * 1440 px, WebGL actif pour que la scène 3D s'exécute vraiment : aucune
 * violation de la politique (événement securitypolicyviolation), aucune erreur
 * dans la console, aucune requête en échec, et les en-têtes attendus.
 *
 * Le dossier servi est celui que construit le webServer de playwright.config.ts
 * (dist/, ou PW_OUT_DIR) ; lancer seul : npm run test:csp. Si Playwright a
 * réutilisé un serveur déjà lancé sur son port (npm run dev, par exemple), ce
 * dossier peut dater d'une construction plus ancienne : les tests s'arrêtent
 * alors avec un message plutôt que de vérifier un autre site que les autres
 * tests.
 */

import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

import {
  COMPRESSIBLE_TYPES,
  MIME_TYPES,
  PERMISSIONS_POLICY,
  cacheControlFor,
  contentSecurityPolicy,
  resolveRequestPath,
  securityHeaders,
  startProdServer,
} from '../scripts/serve-prod.mjs';
import { DESKTOP, MOBILE, notFound, routes } from './routes';
import { pathExists, readRepoFile, repoPath } from './support/node-tools.mjs';
import { header, settle, trackPage } from './support/page';
import { baseURL, builtDir } from './support/settings.mjs';

/** Violation de la politique, telle que la page la signale. */
interface Violation {
  readonly directive: string;
  readonly blocked: string;
  readonly source: string;
  readonly sample: string;
}

type ProdServer = Awaited<ReturnType<typeof startProdServer>>;

// WebGL garanti (rendu logiciel) quelle que soit la machine : la scène 3D
// s'exécute vraiment, et ses chargements (modèle, décodeurs) passent aussi
// par le contrôle au lieu de la solution de repli.
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  },
});

let server: ProdServer | undefined;

test.beforeAll(async ({ playwright }) => {
  if (!pathExists(`${builtDir}/index.html`)) {
    throw new Error(`Aucun site construit dans ${builtDir} : lancez d'abord npm run build.`);
  }
  server = await startProdServer({ root: builtDir });

  // Le site vérifié ici doit être celui que servent les autres tests : celui
  // que le webServer de Playwright vient de construire. Un serveur déjà lancé
  // sur ce port est réutilisé tel quel, sans reconstruire : chaque page est
  // donc comparée des deux côtés.
  const api = await playwright.request.newContext();
  const pageText = async (base: string, path: string) => (await api.get(`${base}${path}`)).text();
  try {
    const different: string[] = [];
    for (const { path } of [...routes, notFound]) {
      const [served, built] = await Promise.all([
        pageText(baseURL, path),
        pageText(server.url, path),
      ]);
      if (served !== built) different.push(path);
    }
    if (different.length > 0) {
      throw new Error(
        `Le site servi sur ${baseURL} n’est pas celui du dossier ${builtDir} ` +
          `(${different.join(', ')}) : un serveur déjà lancé sur ce port (npm run dev ?) a été ` +
          'réutilisé sans reconstruire le site. Arrêtez-le, ou lancez les tests sur un autre ' +
          'port : PW_PORT=4330 npm run test:csp',
      );
    }
  } finally {
    await api.dispose();
  }
});

test.afterAll(async () => {
  await server?.close();
});

/** Adresse complète d'une page sur le serveur de production local. */
function url(path: string): string {
  if (!server) throw new Error('Le serveur de production n’a pas démarré.');
  return `${server.url}${path}`;
}

/**
 * Relève chaque violation de la politique dès la création du document,
 * avant tout script de la page.
 */
async function watchViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const store: unknown[] = [];
    Object.defineProperty(window, '__violationsCsp', { value: store });
    document.addEventListener(
      'securitypolicyviolation',
      (event) => {
        store.push({
          directive: event.effectiveDirective || event.violatedDirective,
          blocked: event.blockedURI,
          source: event.sourceFile ? `${event.sourceFile}:${event.lineNumber}` : '',
          sample: event.sample,
        });
      },
      true,
    );
  });
}

async function readViolations(page: Page): Promise<Violation[]> {
  return page.evaluate(
    () => (window as unknown as { __violationsCsp?: Violation[] }).__violationsCsp ?? [],
  );
}

/** Ce que Chrome indique à la place d'une adresse, en clair. */
const BLOCKED_KINDS: Record<string, string> = {
  '': 'une ressource',
  inline: 'du code écrit dans la page',
  eval: 'du code fabriqué à partir de texte (eval)',
  'wasm-eval': 'la compilation de WebAssembly',
  data: 'une adresse data:',
  blob: 'une adresse blob:',
};

function describeViolations(violations: readonly Violation[]): string {
  if (violations.length === 0) return 'violations de la politique de sécurité';
  const lines = violations.map(({ directive, blocked, source, sample }) => {
    const what = BLOCKED_KINDS[blocked] ?? blocked;
    return `- ${directive} a bloqué ${what}${source ? ` (${source})` : ''}${sample ? ` : ${sample}` : ''}`;
  });
  return `violations de la politique de sécurité :\n${lines.join('\n')}`;
}

/** Les en-têtes de sécurité de la réponse sont exactement ceux de serve-prod.mjs. */
function expectSecurityHeaders(headers: Record<string, string>, label: string): void {
  for (const [name, value] of Object.entries(securityHeaders())) {
    expect(headers[name.toLowerCase()], `${label} : en-tête ${name}`).toBe(value);
  }
}

/** Ouvre puis referme le menu mobile, pour que son script s'exécute aussi. */
async function exerciseMobileMenu(page: Page): Promise<void> {
  const { toggle } = header(page);
  if (!(await toggle.isVisible())) return;
  await toggle.click();
  await page.keyboard.press('Escape');
}

for (const viewport of [MOBILE, DESKTOP]) {
  test.describe(`Politique de sécurité, ${viewport.width} px`, () => {
    test.use({ viewport });

    for (const route of routes) {
      test(`${route.path} : aucune violation, aucune erreur`, async ({ page }) => {
        await watchViolations(page);
        const tracker = trackPage(page);

        const response = await page.goto(url(route.path));
        expect(response?.status(), 'statut HTTP de la page').toBe(200);
        expectSecurityHeaders(response?.headers() ?? {}, route.path);

        await settle(page);
        await exerciseMobileMenu(page);

        const violations = await readViolations(page);
        expect(violations, describeViolations(violations)).toEqual([]);
        expect(tracker.consoleErrors, 'erreurs dans la console').toEqual([]);
        expect(tracker.failedRequests, 'requêtes en échec').toEqual([]);
      });
    }

    test('adresse inconnue : page 404, mêmes en-têtes, aucune violation', async ({ page }) => {
      await watchViolations(page);
      const tracker = trackPage(page);

      const response = await page.goto(url(notFound.path));
      expect(response?.status(), 'statut HTTP').toBe(404);
      expectSecurityHeaders(response?.headers() ?? {}, notFound.path);
      await settle(page);

      const violations = await readViolations(page);
      expect(violations, describeViolations(violations)).toEqual([]);
      // La réponse 404 du document lui-même est attendue : seules les autres erreurs comptent.
      const documentUrl = response?.url() ?? '';
      expect(
        tracker.consoleErrors.filter(
          (error) => !(error.includes('404') && error.includes(documentUrl)),
        ),
        'erreurs dans la console',
      ).toEqual([]);
      expect(
        tracker.failedRequests.filter((failure) => !failure.startsWith(`${documentUrl} :`)),
        'requêtes en échec',
      ).toEqual([]);
    });
  });
}

/** Première adresse trouvée dans le HTML pour ce motif (groupe 1). */
function firstMatch(html: string, pattern: RegExp): string | undefined {
  return pattern.exec(html)?.[1];
}

async function homeHtml(request: APIRequestContext): Promise<string> {
  return (await request.get(url('/'))).text();
}

test.describe('Serveur de production local (serve-prod.mjs)', () => {
  test('une page sans « / » final est redirigée, paramètres conservés', async ({ request }) => {
    const page = routes.find((route) => route.path !== '/');
    test.skip(!page, 'aucune page autre que l’accueil');
    const bare = (page?.path ?? '').replace(/\/$/, '');
    const response = await request.get(url(`${bare}?offre=pro`), { maxRedirects: 0 });
    expect(response.status(), 'redirection permanente').toBe(301);
    expect(response.headers()['location']).toBe(`${bare}/?offre=pro`);
  });

  test('pages : type HTML, revalidation à chaque visite, compression', async ({ request }) => {
    const response = await request.get(url('/'), { headers: { 'Accept-Encoding': 'br, gzip' } });
    const headers = response.headers();
    expect(headers['content-type']).toBe('text/html; charset=utf-8');
    expect(headers['cache-control']).toBe('no-cache');
    expect(headers['content-encoding']).toBe('br');
    expect(headers['vary']).toBe('Accept-Encoding');

    // Comme « FileETag None » chez Apache : revalidation par la date de modification.
    expect(headers['etag'], 'pas d’ETag').toBeUndefined();
    const lastModified = headers['last-modified'] ?? '';
    expect(lastModified, 'Last-Modified').not.toBe('');
    const again = await request.get(url('/'), {
      headers: { 'Accept-Encoding': 'br, gzip', 'If-Modified-Since': lastModified },
    });
    expect(again.status(), 'copie du navigateur encore valable').toBe(304);
  });

  test('fichiers de /_astro/ : cache d’un an, types exacts', async ({ request }) => {
    const html = await homeHtml(request);
    const css = firstMatch(html, /<link\b[^>]*\bhref="(\/_astro\/[^"]+\.css)"/);
    expect(css, 'feuille de style dans /_astro/').toBeTruthy();
    const style = await request.get(url(css ?? ''), { headers: { 'Accept-Encoding': 'gzip' } });
    expect(style.headers()['content-type']).toBe('text/css; charset=utf-8');
    expect(style.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(style.headers()['content-encoding']).toBe('gzip');

    const js = firstMatch(html, /<script\b[^>]*\bsrc="(\/_astro\/[^"]+\.js)"/);
    if (js) {
      const script = await request.get(url(js));
      expect(script.headers()['content-type']).toBe('text/javascript; charset=utf-8');
      expect(script.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
    }
  });

  test('polices préchargées : cache d’un an, type font/woff2', async ({ request }) => {
    const font = firstMatch(
      await homeHtml(request),
      /<link\b[^>]*\bhref="(\/fonts\/[^"]+\.woff2)"/,
    );
    test.skip(!font, 'aucune police préchargée sur l’accueil');
    const response = await request.get(url(font ?? ''));
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('font/woff2');
    expect(response.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(response.headers()['content-encoding'], 'WOFF2 est déjà compressé').toBeUndefined();
  });

  test('manifeste : type application/manifest+json, compressé, gardé une heure', async ({
    request,
  }) => {
    const manifest = firstMatch(
      await homeHtml(request),
      /<link\b[^>]*\brel="manifest"[^>]*\bhref="([^"]+)"/,
    );
    test.skip(!manifest, 'aucun manifeste déclaré');
    const response = await request.get(url(manifest ?? ''), {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/manifest+json; charset=utf-8');
    expect(response.headers()['cache-control']).toBe('public, max-age=3600');
    expect(response.headers()['content-encoding']).toBe('gzip');
  });

  test('modèle 3D, icônes SVG et images WebP : types, compression, un jour de cache', async ({
    request,
  }) => {
    const html = await homeHtml(request);
    const svg = firstMatch(html, /<link\b[^>]*\bhref="(\/[^"]+\.svg)"/);
    // Une image WebP de public/ (nom fixe), pas une de /_astro/ (nom haché,
    // gardée un an : vérifié plus haut).
    const webp = firstMatch(html, /<img\b[^>]*\bsrc="(\/(?!_astro\/)[^"]+\.webp)"/);
    expect(svg, 'icône SVG déclarée par les pages').toBeTruthy();
    expect(webp, 'image WebP de public/ sur l’accueil').toBeTruthy();
    // Le modèle d'essai des tests, servi comme le serait public/models/hako.glb.
    const fixtures = await startProdServer({ root: repoPath('tests/fixtures') });
    try {
      const cases = [
        { what: 'modèle 3D', address: `${fixtures.url}/hako-test.glb`, type: 'model/gltf-binary' },
        { what: 'icône SVG', address: url(svg ?? ''), type: 'image/svg+xml' },
        { what: 'image WebP', address: url(webp ?? ''), type: 'image/webp', packed: true },
      ];
      for (const { what, address, type, packed = false } of cases) {
        const response = await request.get(address, { headers: { 'Accept-Encoding': 'gzip' } });
        const headers = response.headers();
        expect(response.status(), what).toBe(200);
        expect(headers['content-type'], `${what} : type`).toBe(type);
        // Nom de fichier fixe (public/) : gardé un jour, pas un an.
        expect(headers['cache-control'], `${what} : cache`).toBe('public, max-age=86400');
        expect(headers['content-encoding'], `${what} : compression`).toBe(
          packed ? undefined : 'gzip',
        );
      }
    } finally {
      await fixtures.close();
    }
  });

  test('adresses refusées : fichiers cachés, sortie du dossier, adresse mal formée', () => {
    // Chemins tels que le serveur les reçoit. Un navigateur, fetch ou le client
    // de Playwright ramènent « /%2e%2e/x » à « /x » avant l'envoi, mais un
    // client écrit à la main l'envoie tel quel : la règle est donc vérifiée
    // directement, sans passer par un client.
    const refused = [
      '/.env',
      '/.htaccess',
      '/.git/config',
      '/fonts/.DS_Store',
      '/%2e%2e/package.json',
      '/%2E%2E/package.json',
      '/..%2fpackage.json',
      '/..%2Fpackage.json',
      '/_astro/..%2f..%2fpackage.json',
      '/a/%2e%2e/%2e%2e/package.json',
      '/.well-known/..%2f..%2fpackage.json',
      '/..%5cpackage.json',
    ];
    for (const raw of refused) {
      expect(resolveRequestPath(builtDir, raw), raw).toEqual({ status: 404 });
    }
    for (const raw of ['/%E0%A4%A', '/a%00b']) {
      expect(resolveRequestPath(builtDir, raw), raw).toEqual({ status: 400 });
    }
    // Témoins : les adresses ordinaires, et /.well-known/, restent servies.
    const served: [string, string[]][] = [
      ['/', []],
      ['/offres/', ['offres']],
      ['/_astro/page.css', ['_astro', 'page.css']],
      ['/.well-known/security.txt', ['.well-known', 'security.txt']],
      ['/caf%C3%A9/', ['café']],
    ];
    for (const [raw, segments] of served) {
      expect(resolveRequestPath(builtDir, raw), raw).toMatchObject({ segments });
    }
  });

  test('fichier caché ou hors du dossier : introuvable sur un vrai serveur', async ({
    request,
  }) => {
    // Dossiers servis choisis pour qu'une fuite renvoie un vrai fichier : la
    // racine du dépôt contient .gitignore, et le dossier parent de tests/
    // contient package.json. Les témoins prouvent que ces serveurs servent
    // bien les fichiers visibles de leur dossier.
    const repoServer = await startProdServer({ root: repoPath('.') });
    const testsServer = await startProdServer({ root: repoPath('tests') });
    try {
      const controls = [`${repoServer.url}/package.json`, `${testsServer.url}/routes.ts`];
      for (const control of controls) {
        expect((await request.get(control)).status(), `témoin ${control}`).toBe(200);
      }

      const cases: [string, string][] = [
        [repoServer.url, '/.gitignore'],
        [repoServer.url, '/.prettierrc.json'],
        // « %2f » n'est pas décodé par le client : le serveur reçoit bien « .. ».
        [testsServer.url, '/..%2fpackage.json'],
        [testsServer.url, '/support/..%2f..%2fpackage.json'],
      ];
      for (const [base, path] of cases) {
        const unknown = await (await request.get(`${base}${notFound.path}`)).text();
        const response = await request.get(`${base}${path}`);
        expect(response.status(), path).toBe(404);
        expect(await response.text(), `${path} : même réponse qu’une page inconnue`).toBe(unknown);
        expectSecurityHeaders(response.headers(), path);
      }
    } finally {
      await Promise.all([repoServer.close(), testsServer.close()]);
    }
  });

  test('méthodes : comme Apache pour des fichiers statiques', async ({ request }) => {
    // Un envoi de formulaire renvoie la page, les données sont ignorées.
    const post = await request.post(url('/'), { form: { essai: '1' } });
    expect(post.status(), 'POST').toBe(200);
    expect(post.headers()['content-type']).toBe('text/html; charset=utf-8');
    const put = await request.put(url('/'), { data: 'essai' });
    expect(put.status(), 'PUT').toBe(405);
    expect(put.headers()['allow']).toBe('GET, HEAD, POST, OPTIONS');
  });
});

/**
 * Sources admises dans la politique, directive par directive. Les tests
 * suivants vérifient que serve-prod.mjs, l'exemple Apache et la documentation
 * concordent ; celui-ci vérifie que la politique reste stricte, même modifiée
 * à l'identique aux trois endroits. L'élargir demande donc aussi de modifier
 * cette liste, en connaissance de cause. Seul ajout prévu : 'wasm-unsafe-eval'
 * dans script-src, si le modèle 3D est optimisé avec --meshopt
 * (docs/hebergement.md, « La scène 3D »).
 */
const ALLOWED_SOURCES: Readonly<Record<string, readonly string[]>> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'img-src': ["'self'"],
  'font-src': ["'self'"],
  'connect-src': ["'self'"],
  'manifest-src': ["'self'"],
  'media-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': [],
};

/**
 * Vrai pour une source à ne jamais admettre, même dans la liste ci-dessus :
 * code écrit dans la page ou fabriqué à partir de texte (eval), et toute
 * source sans apostrophes autre que blob: (adresses créées par la page
 * elle-même), c'est-à-dire *, data:, http:, https: ou un site nommé comme
 * « cdn.exemple.com ».
 */
function isForbiddenSource(source: string): boolean {
  const lower = source.toLowerCase();
  if (lower.startsWith("'")) {
    return ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'"].includes(lower);
  }
  return lower !== 'blob:';
}

/** Types déclarés par les lignes « AddType type ext… », par extension (« .glb »). */
function apacheTypes(htaccess: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, type = '', extensions = ''] of htaccess.matchAll(
    /^[ \t]*AddType[ \t]+(\S+)[ \t]+(.+)$/gm,
  )) {
    for (const extension of extensions.trim().split(/\s+/)) {
      found.set(`.${extension.replace(/^\./, '')}`, type);
    }
  }
  return found;
}

/** Types compressés par les lignes « AddOutputFilterByType FILTRE type… », par filtre. */
function apacheCompressedTypes(htaccess: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const [, filter = '', types = ''] of htaccess.matchAll(
    /^[ \t]*AddOutputFilterByType[ \t]+(\S+)[ \t]+(.+)$/gm,
  )) {
    found.set(filter, types.trim().split(/\s+/));
  }
  return found;
}

/**
 * Cache-Control que donnent les lignes « Header set Cache-Control », lues
 * dans l'ordre comme Apache : la dernière dont la condition s'applique
 * l'emporte.
 */
function apacheCacheControl(htaccess: string): (urlPath: string, type: string) => string {
  const rules = [
    ...htaccess.matchAll(
      /^[ \t]*Header[ \t]+set[ \t]+Cache-Control[ \t]+"([^"]*)"(?:[ \t]+"expr=%\{(CONTENT_TYPE|REQUEST_URI)\} =~ m#([^#]+)#")?[ \t]*$/gm,
    ),
  ].map(([, value = '', variable, pattern]) => ({
    value,
    onPath: variable === 'REQUEST_URI',
    pattern: pattern ? new RegExp(pattern) : null,
  }));
  return (urlPath, type) => {
    let value = '';
    for (const rule of rules) {
      if (!rule.pattern || rule.pattern.test(rule.onPath ? urlPath : type)) value = rule.value;
    }
    return value;
  };
}

/** Valeurs des lignes « Header always set Nom "valeur" » non commentées. */
function apacheHeaders(htaccess: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of htaccess.matchAll(
    /^[ \t]*Header[ \t]+always[ \t]+set[ \t]+([\w-]+)[ \t]+"([^"]*)"/gm,
  )) {
    const [, name, value] = match;
    if (name && value !== undefined) found.set(name, value);
  }
  return found;
}

test.describe('Politique, exemple Apache et documentation', () => {
  test('la politique reste stricte : seulement le site lui-même', () => {
    const policy = contentSecurityPolicy({ https: true });
    const directives = new Map(
      policy.split(';').map((directive) => {
        const [name = '', ...sources] = directive.trim().split(/\s+/);
        return [name.toLowerCase(), sources] as const;
      }),
    );
    expect([...directives.keys()].sort(), 'directives de la politique').toEqual(
      Object.keys(ALLOWED_SOURCES).sort(),
    );
    for (const [name, sources] of directives) {
      for (const source of sources) {
        expect(isForbiddenSource(source), `${name} ${source} : source interdite`).toBe(false);
        expect(ALLOWED_SOURCES[name] ?? [], `${name} ${source} : source non admise`).toContain(
          source,
        );
      }
    }
    for (const [name, sources] of Object.entries(ALLOWED_SOURCES)) {
      for (const source of sources) {
        expect(isForbiddenSource(source), `liste des sources admises : ${name} ${source}`).toBe(
          false,
        );
      }
    }
    // Fonctions du navigateur : toutes coupées, pour la page comme pour un cadre.
    for (const entry of PERMISSIONS_POLICY.split(', ')) {
      expect(entry, 'Permissions-Policy').toMatch(/^[a-z-]+=\(\)$/);
    }
  });

  // L'exemple, et sa copie dans public/ si l'équipe l'y a placée pour l'envoyer avec le site.
  const htaccessFiles = ['docs/exemples/htaccess', 'public/.htaccess'].filter(
    (file, index) => index === 0 || pathExists(repoPath(file)),
  );
  for (const file of htaccessFiles) {
    test(`${file} envoie les mêmes en-têtes que serve-prod.mjs`, () => {
      const sent = apacheHeaders(readRepoFile(file));
      // En production, le site est servi en HTTPS : la politique contient upgrade-insecure-requests.
      for (const [name, value] of Object.entries(securityHeaders({ https: true }))) {
        expect(sent.get(name), `en-tête ${name} dans ${file}`).toBe(value);
      }
    });

    test(`${file} : mêmes types, même compression et même cache que serve-prod.mjs`, () => {
      const htaccess = readRepoFile(file);
      const mimeTypes: Readonly<Record<string, string>> = MIME_TYPES;
      const baseType = (extension: string) => (mimeTypes[extension] ?? '').split(';')[0];

      // Types que les hébergeurs ne connaissent pas toujours, dont le modèle 3D.
      const declared = apacheTypes(htaccess);
      for (const extension of ['.glb', '.webmanifest', '.woff2', '.svg', '.webp', '.js', '.mjs']) {
        expect(declared.get(extension), `AddType pour ${extension}`).toBe(baseType(extension));
      }
      for (const [extension, type] of declared) {
        expect(type, `AddType ${type} ${extension}`).toBe(baseType(extension));
      }

      // Compression : les mêmes types, en brotli comme en gzip. Apache connaît
      // aussi deux autres noms pour des types de la liste.
      const aliases: Readonly<Record<string, string>> = {
        'application/javascript': 'text/javascript',
        'image/vnd.microsoft.icon': 'image/x-icon',
      };
      const filters = apacheCompressedTypes(htaccess);
      for (const filter of ['BROTLI_COMPRESS', 'DEFLATE']) {
        const types = (filters.get(filter) ?? []).map((type) => aliases[type] ?? type);
        expect(new Set(types), `AddOutputFilterByType ${filter}`).toEqual(COMPRESSIBLE_TYPES);
      }

      // Cache : même durée pour chaque sorte de fichier.
      const apache = apacheCacheControl(htaccess);
      const samples: readonly (readonly [string, string])[] = [
        ['/', '.html'],
        ['/offres/', '.html'],
        ['/_astro/page.Ab12Cd34.css', '.css'],
        ['/_astro/scene.Ab12Cd34.js', '.js'],
        ['/_astro/facebook.Ab12Cd34.svg', '.svg'],
        ['/fonts/fraunces/fraunces-latin-fr-a093887f.woff2', '.woff2'],
        ['/manifest.webmanifest', '.webmanifest'],
        ['/robots.txt', '.txt'],
        ['/sitemap-index.xml', '.xml'],
        ['/models/hako.glb', '.glb'],
        ['/images/box-fermee-provisoire.webp', '.webp'],
        ['/favicon.svg', '.svg'],
        ['/favicon.ico', '.ico'],
        ['/og/accueil.png', '.png'],
      ];
      for (const [urlPath, extension] of samples) {
        const type = mimeTypes[extension] ?? '';
        expect(apache(urlPath, type), `Cache-Control de ${urlPath}`).toBe(
          cacheControlFor(urlPath, type),
        );
      }
    });
  }

  test('docs/hebergement.md cite la politique exacte', () => {
    const doc = readRepoFile('docs/hebergement.md');
    expect(doc, 'politique de production').toContain(contentSecurityPolicy({ https: true }));
  });
});
