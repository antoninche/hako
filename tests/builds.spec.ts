/**
 * Constructions avec d'autres réglages que ceux des tests, contrôlées sur les
 * fichiers produits (sans navigateur) :
 * - PUBLIC_SHOW_TODOS=false (démonstration) : informations manquantes sans
 *   surlignage ni infobulle, et sans <mark>, qui ferait annoncer « surligné »
 *   par les lecteurs d'écran ;
 * - SITE_URL : adresse canonique des pages indexables, et aucune sans elle.
 * Les sites sont construits dans .tmp/tests/ : dist/ n'est pas touché.
 */

import { expect, test } from '@playwright/test';

import { buildSite, readRepoFile } from './support/node-tools.mjs';

const DEMO = '.tmp/tests/dist-demo';
const LOCAL = '.tmp/tests/dist-sans-adresse';
const PAGES = ['index.html', 'offres/index.html', 'charte/index.html', '404.html'];

/** Balises des informations manquantes d'une page construite. */
function todoTags(html: string): string[] {
  return [...html.matchAll(/<(mark|span)\b[^>]*\bclass="todo"[^>]*>/g)].map((match) => match[0]);
}

test.describe('Constructions particulières', () => {
  // Deux constructions l'une après l'autre (elles partagent le dossier .astro/).
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  test('PUBLIC_SHOW_TODOS=false et SITE_URL', () => {
    const build = buildSite(DEMO, { PUBLIC_SHOW_TODOS: 'false', SITE_URL: 'https://exemple.fr' });
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

    expect(home).toContain('<link rel="canonical" href="https://exemple.fr/">');
    expect(readRepoFile(`${DEMO}/offres/index.html`)).toContain(
      '<link rel="canonical" href="https://exemple.fr/offres/">',
    );
    // Pages non indexées : pas d'adresse canonique.
    for (const file of ['charte/index.html', '404.html']) {
      expect(readRepoFile(`${DEMO}/${file}`), file).not.toContain('rel="canonical"');
    }
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
      expect(readRepoFile(`${LOCAL}/${file}`), file).not.toContain('rel="canonical"');
    }
  });
});
