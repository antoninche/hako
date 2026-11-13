/**
 * Constructions avec d'autres réglages que ceux des tests, contrôlées sur les
 * fichiers produits (sans navigateur) :
 * - PUBLIC_SHOW_TODOS=false (démonstration) : informations manquantes sans
 *   surlignage ni infobulle, et sans <mark>, qui ferait annoncer « surligné »
 *   par les lecteurs d'écran ;
 * - SITE_URL : adresse canonique des pages indexables, aperçu de partage
 *   (Open Graph) avec une image à l'adresse complète, robots.txt qui indique
 *   le plan du site, sitemap.xml ; puis la réécriture pour le sous-dossier
 *   /hako/ (scripts/deploy/sous-dossier.mjs, comme pour GitHub Pages) ;
 * - sans SITE_URL : ni adresse canonique, ni image de partage, ni plan du site.
 * Les sites sont construits dans .tmp/tests/ : dist/ n'est pas touché.
 */

import { expect, test } from '@playwright/test';

import { routes } from './routes';
import {
  buildSite,
  copyRepoDir,
  pathExists,
  pngSize,
  readRepoFile,
  repoPath,
  runScript,
} from './support/node-tools.mjs';

const DEMO = '.tmp/tests/dist-demo';
const LOCAL = '.tmp/tests/dist-sans-adresse';
/** Copie de DEMO préparée pour le sous-dossier /hako/ (DEMO reste intact). */
const SUBFOLDER = '.tmp/tests/dist-sous-dossier';
const PAGES = ['index.html', 'offres/index.html', 'charte/index.html', '404.html'];
const SITE = 'https://exemple.fr';
const SHARE_IMAGE = 'public/og/hako-og.png';

/** Balises des informations manquantes d'une page construite. */
function todoTags(html: string): string[] {
  return [...html.matchAll(/<(mark|span)\b[^>]*\bclass="todo"[^>]*>/g)].map((match) => match[0]);
}

/** Fichier construit d'une page : « / » → index.html, « /offres/ » → offres/index.html. */
const fileOf = (path: string): string => `${path.slice(1)}index.html`;

/** Valeur d'une balise <meta property="…"> ou <meta name="…"> (null si absente). */
function meta(html: string, key: string): string | null {
  return new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`).exec(html)?.[1] ?? null;
}

const canonicalOf = (html: string): string | null =>
  /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1] ?? null;

/** Adresses <loc> d'un plan du site. */
const locsOf = (xml: string): string[] =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '');

test.describe('Constructions particulières', () => {
  // Deux constructions l'une après l'autre (elles partagent le dossier .astro/).
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  test('PUBLIC_SHOW_TODOS=false et SITE_URL', () => {
    const build = buildSite(DEMO, { PUBLIC_SHOW_TODOS: 'false', SITE_URL: SITE });
    expect(build.status, build.stderr).toBe(0);

    const home = readRepoFile(`${DEMO}/index.html`);
    expect(home).toContain('<html lang="fr" data-todos="discreet">');
    for (const file of PAGES) {
      const tags = todoTags(readRepoFile(`${DEMO}/${file}`));
      for (const tag of tags) {
        expect(tag, `${file} : simple <span>, sans infobulle`).toMatch(/^<span\b/);
        expect(tag, `${file} : simple <span>, sans infobulle`).not.toMatch(/\stitle=/);
        expect(tag, `${file} : description gardée`).toMatch(/\sdata-todo="[^"]+"/);
      }
    }
    expect(todoTags(home).length, 'informations manquantes du pied de page').toBeGreaterThan(0);

    expect(home).toContain(`<link rel="canonical" href="${SITE}/">`);
    expect(readRepoFile(`${DEMO}/offres/index.html`)).toContain(
      `<link rel="canonical" href="${SITE}/offres/">`,
    );
    // Pages non indexées : pas d'adresse canonique.
    for (const file of ['charte/index.html', '404.html']) {
      expect(readRepoFile(`${DEMO}/${file}`), file).not.toContain('rel="canonical"');
    }
  });

  test('SITE_URL : aperçu de partage (Open Graph) et politique de référent', () => {
    // Construction du test précédent (même dossier, mêmes réglages).
    test.skip(!pathExists(repoPath(`${DEMO}/index.html`)), 'site de démonstration non construit');
    const image = pngSize(SHARE_IMAGE);
    expect(image, `${SHARE_IMAGE} : taille annoncée dans les balises`).toEqual({
      width: 1200,
      height: 630,
    });

    for (const file of PAGES) {
      const html = readRepoFile(`${DEMO}/${file}`);
      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
      expect(meta(html, 'referrer'), file).toBe('same-origin');
      expect(meta(html, 'og:type'), file).toBe('website');
      expect(meta(html, 'og:site_name'), file).toBe('HAKO');
      expect(meta(html, 'og:locale'), file).toBe('fr_FR');
      expect(meta(html, 'og:title'), file).toBe(title);
      expect(meta(html, 'og:description'), file).toBe(meta(html, 'description'));
      expect(meta(html, 'og:image'), file).toBe(`${SITE}/og/hako-og.png`);
      expect(meta(html, 'og:image:width'), file).toBe(String(image.width));
      expect(meta(html, 'og:image:height'), file).toBe(String(image.height));
      expect(meta(html, 'og:image:alt'), file).toMatch(/^Le logo de HAKO\u00a0: /);
      expect(meta(html, 'twitter:card'), file).toBe('summary_large_image');
      // og:url reprend l'adresse canonique ; aucune sur les pages non indexées.
      expect(meta(html, 'og:url'), file).toBe(canonicalOf(html));
    }
    expect(meta(readRepoFile(`${DEMO}/offres/index.html`), 'og:url')).toBe(`${SITE}/offres/`);
  });

  test('SITE_URL : robots.txt et plan du site, puis sous-dossier /hako/', () => {
    test.skip(!pathExists(repoPath(`${DEMO}/index.html`)), 'site de démonstration non construit');
    expect(readRepoFile(`${DEMO}/robots.txt`)).toBe(
      `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`,
    );

    // Plan du site : exactement les pages indexables (avec une adresse
    // canonique), jamais la charte ni la page 404.
    const sitemap = readRepoFile(`${DEMO}/sitemap.xml`);
    expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    const indexable = routes
      .map((route) => canonicalOf(readRepoFile(`${DEMO}/${fileOf(route.path)}`)))
      .filter((url): url is string => url !== null);
    // Toutes les pages de tests/routes.ts sauf la charte (la page 404 n'y est pas).
    expect(indexable.length, 'pages indexables').toBe(routes.length - 1);
    expect(locsOf(sitemap)).toEqual(indexable);
    expect(sitemap).not.toContain('/charte/');
    expect(sitemap).not.toContain('404');

    // Aperçu sur GitHub Pages : le script ajoute le sous-dossier aux adresses
    // complètes (og:image, og:url, robots.txt, sitemap.xml).
    copyRepoDir(DEMO, SUBFOLDER);
    const rebase = runScript('scripts/deploy/sous-dossier.mjs', [
      SUBFOLDER,
      '/hako/',
      '--site',
      SITE,
    ]);
    expect(rebase.status, rebase.stderr).toBe(0);
    const home = readRepoFile(`${SUBFOLDER}/index.html`);
    const image = `${SITE}/hako/og/hako-og.png`;
    expect(meta(home, 'og:image')).toBe(image);
    expect(meta(home, 'og:url')).toBe(`${SITE}/hako/`);
    const offers = readRepoFile(`${SUBFOLDER}/offres/index.html`);
    expect(meta(offers, 'og:url')).toBe(`${SITE}/hako/offres/`);
    expect(meta(readRepoFile(`${SUBFOLDER}/404.html`), 'og:image')).toBe(image);
    expect(readRepoFile(`${SUBFOLDER}/robots.txt`)).toContain(
      `Sitemap: ${SITE}/hako/sitemap.xml\n`,
    );
    expect(locsOf(readRepoFile(`${SUBFOLDER}/sitemap.xml`))).toEqual(
      indexable.map((url) => url.replace(`${SITE}/`, `${SITE}/hako/`)),
    );
  });

  test('sans SITE_URL, aucune adresse canonique ; surlignage par défaut', () => {
    const build = buildSite(LOCAL, { PUBLIC_SHOW_TODOS: 'true', SITE_URL: '' });
    expect(build.status, build.stderr).toBe(0);

    const home = readRepoFile(`${LOCAL}/index.html`);
    expect(home).toContain('<html lang="fr" data-todos="visible">');
    const tags = todoTags(home);
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) expect(tag).toMatch(/^<mark\b[^>]*\stitle="[^"]+"/);
    for (const file of PAGES) {
      const html = readRepoFile(`${LOCAL}/${file}`);
      expect(html, file).not.toContain('rel="canonical"');
      // Sans adresse complète, ni image de partage ni og:url ; le reste demeure.
      expect(meta(html, 'og:image'), file).toBeNull();
      expect(meta(html, 'og:url'), file).toBeNull();
      expect(meta(html, 'og:title'), file).not.toBeNull();
      expect(meta(html, 'referrer'), file).toBe('same-origin');
    }
    // robots.txt sans plan du site, et pas de sitemap.xml du tout.
    expect(readRepoFile(`${LOCAL}/robots.txt`)).toBe('User-agent: *\nAllow: /\n');
    expect(pathExists(repoPath(`${LOCAL}/sitemap.xml`)), 'sitemap.xml').toBe(false);
  });
});
