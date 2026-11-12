/**
 * Serveur local qui imite l'hébergement de production.
 *
 * Sert le site construit (dist/) avec les mêmes règles que l'exemple
 * docs/exemples/htaccess : en-têtes de sécurité (dont la politique de sécurité
 * du contenu, ou CSP), durées de cache, compression, vraie page 404 et
 * redirection d'un dossier vers son adresse terminée par « / ». Il permet de
 * vérifier le site avant de le mettre en ligne ; les tests (tests/csp.spec.ts)
 * et les mesures Lighthouse (scripts/lighthouse.mjs) s'en servent aussi.
 * Aucune dépendance : seulement les modules fournis avec Node.
 *
 * Utilisation :
 *   node scripts/serve-prod.mjs [dossier] [options]
 *
 *   dossier            dossier à servir (par défaut : dist)
 *   --port <n>         port d'écoute (par défaut : la variable PORT, sinon 8080 ;
 *                      4321 reste libre pour astro dev, astro preview et les tests)
 *   --host <adresse>   adresse d'écoute (par défaut : localhost ; 0.0.0.0 pour
 *                      ouvrir le site depuis un téléphone du même réseau)
 *   --cert <fichier> --key <fichier>
 *                      sert en HTTPS avec ce certificat et cette clé (format PEM)
 *   --quiet            n'affiche pas chaque requête
 *
 * Ce serveur n'envoie jamais Strict-Transport-Security : sur « localhost »,
 * cet en-tête forcerait HTTPS pour tous les ports de la machine. Voir
 * docs/hebergement.md pour l'activer chez l'hébergeur.
 */

import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import zlib from 'node:zlib';

const brotliCompress = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

/**
 * Politique de sécurité du contenu (CSP) : le navigateur ne charge et
 * n'exécute que ce qui vient du site lui-même. docs/exemples/htaccess contient
 * exactement la même liste (tests/csp.spec.ts vérifie qu'elles restent égales).
 */
export const CSP_DIRECTIVES = Object.freeze([
  // Par défaut, toute ressource doit venir du site lui-même.
  "default-src 'self'",
  // Scripts : seulement les fichiers du site (/_astro/…), jamais de code écrit
  // dans la page ni de code fabriqué à partir de texte (eval). Un modèle 3D
  // optimisé avec --meshopt demanderait ici 'wasm-unsafe-eval' (et aux autres
  // endroits indiqués dans docs/hebergement.md, « La scène 3D »).
  "script-src 'self'",
  // Styles : seulement les feuilles du site, ni balise <style> ni attribut style="…".
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  // Requêtes envoyées par les scripts (fetch), par exemple le modèle 3D.
  "connect-src 'self'",
  "manifest-src 'self'",
  "media-src 'self'",
  // Aucun module externe (<object>, <embed>).
  "object-src 'none'",
  // Une balise <base> ne peut pas détourner les adresses relatives.
  "base-uri 'self'",
  // Un formulaire ne peut envoyer ses données qu'au site lui-même.
  "form-action 'self'",
  // Aucun site ne peut afficher le nôtre dans un cadre (<iframe>).
  "frame-ancestors 'none'",
]);

/**
 * Renvoie la politique de sécurité du contenu, prête à mettre dans l'en-tête.
 * Sur HTTPS, `upgrade-insecure-requests` demande au navigateur de passer en
 * HTTPS toute adresse écrite en http:// ; en HTTP (sur ce poste), cette
 * directive casserait le chargement, d'où l'option.
 *
 * @param {{ https?: boolean }} [options]
 * @returns {string}
 */
export function contentSecurityPolicy({ https: secure = false } = {}) {
  const directives = [...CSP_DIRECTIVES];
  if (secure) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

/**
 * Fonctions du navigateur que le site n'utilise jamais : capteurs, caméra,
 * micro, position, paiement, périphériques, identifiants, centres d'intérêt
 * publicitaires (browsing-topics)… Elles sont coupées pour la page et pour
 * tout cadre qu'elle pourrait contenir. Chaque nom a été vérifié dans
 * Chrome 157 et Chromium 158 : un nom inconnu du navigateur produit un
 * avertissement dans la console. Absents pour cette raison : ambient-light-sensor,
 * battery et document-domain (inconnus des deux), web-share (inconnu de
 * Chromium) ; interest-cohort, abandonné par Chrome, ne sert plus à rien.
 */
export const DISABLED_BROWSER_FEATURES = Object.freeze([
  'accelerometer',
  'autoplay',
  'bluetooth',
  'browsing-topics',
  'camera',
  'clipboard-read',
  'compute-pressure',
  'display-capture',
  'encrypted-media',
  'gamepad',
  'geolocation',
  'gyroscope',
  'hid',
  'identity-credentials-get',
  'idle-detection',
  'local-fonts',
  'magnetometer',
  'microphone',
  'midi',
  'otp-credentials',
  'payment',
  'publickey-credentials-create',
  'publickey-credentials-get',
  'screen-wake-lock',
  'serial',
  'storage-access',
  'usb',
  'window-management',
  'xr-spatial-tracking',
]);

export const PERMISSIONS_POLICY = DISABLED_BROWSER_FEATURES.map((feature) => `${feature}=()`).join(
  ', ',
);

/**
 * En-têtes de sécurité envoyés avec chaque réponse (pages, fichiers, erreurs).
 * docs/hebergement.md explique le rôle de chacun.
 *
 * @param {{ https?: boolean }} [options]
 * @returns {Record<string, string>}
 */
export function securityHeaders({ https: secure = false } = {}) {
  return {
    'Content-Security-Policy': contentSecurityPolicy({ https: secure }),
    'Permissions-Policy': PERMISSIONS_POLICY,
    // Les autres sites ne reçoivent pas l'adresse de la page d'où vient le visiteur.
    'Referrer-Policy': 'same-origin',
    // Le navigateur respecte le type annoncé (pas de « devinette » du contenu).
    'X-Content-Type-Options': 'nosniff',
    // Équivalent de frame-ancestors 'none' pour les navigateurs anciens.
    'X-Frame-Options': 'DENY',
    // Une page ouverte depuis le site (ou qui l'ouvre) ne peut pas la piloter.
    'Cross-Origin-Opener-Policy': 'same-origin',
    // Les fichiers du site ne peuvent pas être chargés par un autre site.
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
}

/** Types de fichiers, avec le jeu de caractères pour les fichiers texte. */
export const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.ktx2': 'image/ktx2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
});

const DEFAULT_MIME_TYPE = 'application/octet-stream';

/** Méthodes acceptées, comme Apache pour des fichiers statiques (TRACE en moins). */
const ALLOWED_METHODS = 'GET, HEAD, POST, OPTIONS';

/**
 * Types qui gagnent à être compressés (les images et polices le sont déjà).
 * Même liste que AddOutputFilterByType dans docs/exemples/htaccess
 * (tests/csp.spec.ts le vérifie).
 */
export const COMPRESSIBLE_TYPES = new Set([
  'text/html',
  'text/css',
  'text/javascript',
  'text/plain',
  'text/vtt',
  'application/json',
  'application/manifest+json',
  'application/xml',
  'application/wasm',
  'image/svg+xml',
  'image/x-icon',
  'model/gltf+json',
  'model/gltf-binary',
  'font/ttf',
  'font/otf',
]);

/** Cache d'un an : fichiers dont le nom change à chaque modification. */
const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable';
/** Pages : le navigateur garde une copie mais vérifie à chaque visite. */
const CACHE_REVALIDATE = 'no-cache';
/** Manifeste, robots.txt, plan du site : une heure. */
const CACHE_SHORT = 'public, max-age=3600';
/** Autres fichiers (images, icônes, modèle 3D) au nom fixe : un jour. */
const CACHE_DAY = 'public, max-age=86400';

/**
 * Durée de cache d'une réponse, selon son adresse et son type. Les fichiers
 * de /_astro/ (créés par Astro, avec une empreinte dans le nom) et ceux de
 * /fonts/ (noms versionnés) ne changent jamais : un an.
 *
 * @param {string} urlPath adresse demandée, sans paramètres
 * @param {string} contentType
 * @returns {string}
 */
export function cacheControlFor(urlPath, contentType) {
  if (urlPath.startsWith('/_astro/') || urlPath.startsWith('/fonts/')) return CACHE_IMMUTABLE;
  const type = contentType.split(';')[0] ?? '';
  if (type === 'text/html') return CACHE_REVALIDATE;
  if (type === 'application/manifest+json' || type === 'application/xml' || type === 'text/plain') {
    return CACHE_SHORT;
  }
  return CACHE_DAY;
}

/**
 * Encodage de compression accepté par le client : brotli de préférence, puis gzip.
 *
 * @param {string | undefined} header valeur d'Accept-Encoding
 * @returns {'br' | 'gzip' | null}
 */
function negotiateEncoding(header) {
  if (!header) return null;
  /** @type {Map<string, number>} */
  const accepted = new Map();
  for (const part of header.split(',')) {
    const [name = '', ...params] = part.trim().toLowerCase().split(';');
    const qParam = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
    const quality = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
    accepted.set(name.trim(), Number.isNaN(quality) ? 0 : quality);
  }
  const wildcard = accepted.get('*') ?? 0;
  for (const encoding of /** @type {const} */ (['br', 'gzip'])) {
    if ((accepted.get(encoding) ?? wildcard) > 0) return encoding;
  }
  return null;
}

/**
 * Fichier visé par le chemin d'une adresse, tel que le serveur le reçoit
 * (encore encodé, sans les paramètres). Comme chez l'hébergeur, les fichiers
 * cachés (.htaccess, .env…) sont introuvables, sauf /.well-known/, et rien ne
 * peut sortir du dossier servi : « .. » est un segment caché, et le chemin
 * final est contrôlé en plus.
 *
 * @param {string} rootDir dossier servi, en chemin absolu
 * @param {string} rawPath par exemple « /offres/ » ou « /..%2fpackage.json »
 * @returns {{ status: 400 | 404 } | { urlPath: string, segments: string[], filePath: string }}
 */
export function resolveRequestPath(rootDir, rawPath) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(rawPath);
  } catch {
    return { status: 400 };
  }
  if (!urlPath.startsWith('/') || urlPath.includes('\0')) return { status: 400 };

  const segments = urlPath.split('/').filter(Boolean);
  const hidden = segments.some((segment) => segment.startsWith('.') && segment !== '.well-known');
  const filePath = path.join(rootDir, ...segments);
  const insideRoot = filePath === rootDir || filePath.startsWith(rootDir + path.sep);
  if (hidden || !insideRoot) return { status: 404 };
  return { urlPath, segments, filePath };
}

/**
 * Fichiers lus et versions compressées, gardés en mémoire tant que le
 * fichier sur le disque ne change pas (même taille, même date).
 *
 * @typedef {{ mtimeMs: number, size: number, raw: Buffer, br?: Buffer, gzip?: Buffer }} CachedFile
 */

/**
 * Crée le serveur (sans le démarrer).
 *
 * @param {{ root: string, quiet?: boolean, tls?: { cert: Buffer, key: Buffer } }} options
 * @returns {http.Server}
 */
export function createProdServer({ root, quiet = false, tls }) {
  const rootDir = path.resolve(root);
  /** @type {Map<string, CachedFile>} */
  const files = new Map();

  /**
   * @param {string} filePath
   * @param {import('node:fs').Stats} info
   * @returns {Promise<CachedFile>}
   */
  async function load(filePath, info) {
    const cached = files.get(filePath);
    if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached;
    const fresh = { mtimeMs: info.mtimeMs, size: info.size, raw: await readFile(filePath) };
    files.set(filePath, fresh);
    return fresh;
  }

  /**
   * Compresse comme Apache par défaut (brotli niveau 5, gzip niveau 6).
   *
   * @param {CachedFile} file
   * @param {'br' | 'gzip'} encoding
   * @returns {Promise<Buffer>}
   */
  async function compressed(file, encoding) {
    if (encoding === 'br') {
      file.br ??= await brotliCompress(file.raw, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: file.raw.length,
        },
      });
      return file.br;
    }
    file.gzip ??= await gzip(file.raw, { level: 6 });
    return file.gzip;
  }

  /**
   * @param {string} candidate
   * @returns {Promise<import('node:fs').Stats | null>}
   */
  async function statOrNull(candidate) {
    try {
      return await stat(candidate);
    } catch {
      return null;
    }
  }

  /**
   * Envoie un fichier, compressé si possible, avec réponse 304 quand la copie
   * du navigateur est encore bonne.
   *
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {{ filePath: string, info: import('node:fs').Stats, urlPath: string, status: number }} target
   */
  async function sendFile(req, res, { filePath, info, urlPath, status }) {
    const file = await load(filePath, info);
    const contentType =
      MIME_TYPES[/** @type {keyof typeof MIME_TYPES} */ (path.extname(filePath).toLowerCase())] ??
      DEFAULT_MIME_TYPE;
    const baseType = contentType.split(';')[0] ?? '';
    const compressible = COMPRESSIBLE_TYPES.has(baseType);
    const encoding = compressible ? negotiateEncoding(req.headers['accept-encoding']) : null;

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Cache-Control',
      status === 200 ? cacheControlFor(urlPath, contentType) : CACHE_REVALIDATE,
    );
    if (compressible) res.setHeader('Vary', 'Accept-Encoding');

    // Pas d'ETag, comme avec « FileETag None » dans docs/exemples/htaccess : la
    // date de modification suffit au navigateur pour revalider sa copie.
    if (status === 200) {
      res.setHeader('Last-Modified', new Date(file.mtimeMs).toUTCString());
      if (isNotModified(req, file.mtimeMs)) {
        res.statusCode = 304;
        res.end();
        return;
      }
    }

    const body = encoding ? await compressed(file, encoding) : file.raw;
    if (encoding) res.setHeader('Content-Encoding', encoding);
    res.setHeader('Content-Length', body.length);
    res.statusCode = status;
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  /**
   * Réponse 404 : la page 404.html du site si elle existe.
   *
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  async function sendNotFound(req, res) {
    const page = path.join(rootDir, '404.html');
    const info = await statOrNull(page);
    if (info?.isFile()) {
      await sendFile(req, res, { filePath: page, info, urlPath: '/404.html', status: 404 });
      return;
    }
    sendText(req, res, 404, 'Page introuvable.');
  }

  /**
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  async function handle(req, res) {
    const secure = Boolean(tls) || req.headers['x-forwarded-proto'] === 'https';
    for (const [name, value] of Object.entries(securityHeaders({ https: secure }))) {
      res.setHeader(name, value);
    }

    // Comme Apache avec des fichiers statiques : POST renvoie la page demandée
    // (les données envoyées sont ignorées), OPTIONS liste les méthodes admises,
    // les autres méthodes sont refusées.
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', ALLOWED_METHODS);
      res.setHeader('Content-Length', 0);
      res.end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
      res.setHeader('Allow', ALLOWED_METHODS);
      sendText(req, res, 405, 'Méthode non autorisée : ce site ne fait que de la lecture.');
      return;
    }
    if (req.method === 'POST') req.resume();

    // On découpe l'adresse à la main : new URL() lirait « //exemple.fr/ » comme un autre site.
    const rawUrl = req.url ?? '/';
    const queryStart = rawUrl.indexOf('?');
    const rawPath = queryStart === -1 ? rawUrl : rawUrl.slice(0, queryStart);
    const search = queryStart === -1 ? '' : rawUrl.slice(queryStart);

    const target = resolveRequestPath(rootDir, rawPath);
    if ('status' in target) {
      if (target.status === 400) sendText(req, res, 400, 'Adresse mal formée.');
      else await sendNotFound(req, res);
      return;
    }
    const { urlPath, segments, filePath } = target;

    const info = await statOrNull(filePath);
    if (info?.isDirectory()) {
      if (!urlPath.endsWith('/')) {
        // Comme DirectorySlash d'Apache : /offres → /offres/ (redirection permanente).
        const location = `/${segments.map(encodeURIComponent).join('/')}/${search}`;
        res.statusCode = 301;
        res.setHeader('Location', location);
        res.setHeader('Content-Length', 0);
        res.end();
        return;
      }
      const indexPath = path.join(filePath, 'index.html');
      const indexInfo = await statOrNull(indexPath);
      if (indexInfo?.isFile()) {
        await sendFile(req, res, { filePath: indexPath, info: indexInfo, urlPath, status: 200 });
        return;
      }
    } else if (info?.isFile() && !urlPath.endsWith('/')) {
      await sendFile(req, res, { filePath, info, urlPath, status: 200 });
      return;
    }
    await sendNotFound(req, res);
  }

  /** @type {http.RequestListener} */
  const listener = (req, res) => {
    const started = performance.now();
    res.on('finish', () => {
      if (quiet) return;
      const duration = Math.round(performance.now() - started);
      console.log(`${req.method} ${req.url} → ${res.statusCode} (${duration} ms)`);
    });
    handle(req, res).catch((error) => {
      console.error(`Erreur sur ${req.url} :`, error);
      if (!res.headersSent) sendText(req, res, 500, 'Erreur du serveur.');
      else res.destroy();
    });
  };

  return tls
    ? https.createServer({ cert: tls.cert, key: tls.key }, listener)
    : http.createServer(listener);
}

/**
 * Vrai si la copie du navigateur est à jour (If-Modified-Since, à la seconde près).
 *
 * @param {http.IncomingMessage} req
 * @param {number} mtimeMs
 */
function isNotModified(req, mtimeMs) {
  const header = req.headers['if-modified-since'];
  if (!header) return false;
  const since = Date.parse(header);
  return !Number.isNaN(since) && Math.floor(mtimeMs / 1000) * 1000 <= since;
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {string} message
 */
function sendText(req, res, status, message) {
  const body = Buffer.from(`${message}\n`, 'utf8');
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', CACHE_REVALIDATE);
  res.setHeader('Content-Length', body.length);
  res.end(req.method === 'HEAD' ? undefined : body);
}

/**
 * Démarre le serveur et attend qu'il écoute. Avec `port: 0`, le système
 * choisit un port libre (utile pour les tests).
 *
 * @param {{ root: string, port?: number, host?: string, quiet?: boolean, tls?: { cert: Buffer, key: Buffer } }} options
 * @returns {Promise<{ server: http.Server, url: string, port: number, close: () => Promise<void> }>}
 */
export async function startProdServer({ root, port = 0, host = 'localhost', quiet = true, tls }) {
  const server = createProdServer(tls ? { root, quiet, tls } : { root, quiet });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve(undefined);
    });
  });
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  const anyHost = host === '0.0.0.0' || host === '::';
  const urlHost = anyHost ? 'localhost' : host.includes(':') ? `[${host}]` : host;
  const url = `${tls ? 'https' : 'http'}://${urlHost}:${actualPort}`;
  const close = () =>
    new Promise((resolve) => {
      server.close(() => resolve(undefined));
      server.closeAllConnections();
    }).then(() => undefined);
  return { server, url, port: actualPort, close };
}

/**
 * Adresse publique pour laquelle le site a été construit (variable SITE_URL),
 * lue dans le lien canonique de la page d'accueil ; null si elle n'en a pas.
 *
 * @param {string} root
 * @returns {Promise<string | null>}
 */
async function builtSiteOrigin(root) {
  const html = await readFile(path.join(root, 'index.html'), 'utf8').catch(() => '');
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/\brel\s*=\s*["']?canonical\b/i.test(tag)) continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href || !URL.canParse(href)) return null;
    return new URL(href).origin;
  }
  return null;
}

/** Lancement en ligne de commande. */
async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: 'string', short: 'p' },
      host: { type: 'string' },
      cert: { type: 'string' },
      key: { type: 'string' },
      quiet: { type: 'boolean', short: 'q' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(
      [
        'Sert le site construit comme le ferait l’hébergeur.',
        '',
        'node scripts/serve-prod.mjs [dossier] [--port 8080] [--host localhost] [--cert f --key f] [--quiet]',
      ].join('\n'),
    );
    return;
  }

  const root = path.resolve(positionals[0] ?? 'dist');
  const rootInfo = await stat(path.join(root, 'index.html')).catch(() => null);
  if (!rootInfo) {
    console.error(`Aucun site construit dans ${root} : lancez d’abord npm run build.`);
    process.exit(1);
  }

  const port = Number.parseInt(values.port ?? process.env.PORT ?? '8080', 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`Port invalide : ${values.port ?? process.env.PORT}.`);
    process.exit(2);
  }
  if (Boolean(values.cert) !== Boolean(values.key)) {
    console.error('Pour HTTPS, donnez à la fois --cert et --key.');
    process.exit(2);
  }
  const tls =
    values.cert && values.key
      ? { cert: await readFile(values.cert), key: await readFile(values.key) }
      : undefined;

  try {
    const { url, close } = await startProdServer({
      root,
      port,
      host: values.host ?? 'localhost',
      quiet: values.quiet ?? false,
      ...(tls ? { tls } : {}),
    });
    const shown = path.relative(process.cwd(), root) || '.';
    console.log(`Site servi depuis ${shown}/ sur ${url}/ (Ctrl+C pour arrêter).`);
    console.log('En-têtes de production : CSP stricte, cache, compression, page 404.');
    // Rappel avant une mise en ligne : un site construit sans SITE_URL ne
    // déclare aucune adresse canonique (voir astro.config.mjs).
    const site = await builtSiteOrigin(root);
    if (!site) {
      console.log(
        'Pages construites sans SITE_URL (aucune adresse canonique) : avant la mise en ligne, reconstruire avec SITE_URL (docs/hebergement.md).',
      );
    } else if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(site)) {
      console.log(
        `Pages construites pour ${site} : avant la mise en ligne, reconstruire avec SITE_URL (docs/hebergement.md).`,
      );
    } else {
      console.log(`Pages construites pour ${site}.`);
    }
    if (values.host === '0.0.0.0' || values.host === '::') {
      // Adresses de ce poste sur le réseau local, à ouvrir depuis un téléphone.
      const scheme = tls ? 'https' : 'http';
      const lan = Object.values(networkInterfaces())
        .flat()
        .filter((net) => net && net.family === 'IPv4' && !net.internal)
        .map((net) => `${scheme}://${net?.address}:${new URL(url).port}/`);
      if (lan.length > 0) console.log(`Depuis un appareil du même réseau : ${lan.join(' ou ')}`);
    }
    const stop = () => {
      close().then(() => process.exit(0));
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    const code = /** @type {NodeJS.ErrnoException} */ (error).code;
    if (code === 'EADDRINUSE') {
      console.error(`Le port ${port} est déjà utilisé : choisissez-en un autre avec --port.`);
    } else {
      console.error('Impossible de démarrer le serveur :', error);
    }
    process.exit(1);
  }
}

const launchedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (launchedDirectly) await main();
