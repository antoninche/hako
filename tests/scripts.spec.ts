/**
 * Tests des scripts de scripts/ (sans navigateur), sur les jeux d'essai de
 * tests/fixtures/ : chaque jeu fautif prouve que le contrôle sait refuser.
 */

import { expect, test } from '@playwright/test';

import { checkDist } from '../scripts/lib/check-dist.mjs';
import { checkContrast } from '../scripts/lib/contrast.mjs';
import { collectTodos, extractTodos, renderTodoMarkdown } from '../scripts/lib/todos.mjs';
import { pathExists, readRepoFile, repoPath, runScript } from './support/node-tools.mjs';
import { builtDir } from './support/settings.mjs';

const TODOS = repoPath('tests/fixtures/todos');
const CONTRAST = repoPath('tests/fixtures/contrast');

test.describe('npm run todos', () => {
  test("TODO.md attendu pour le jeu d'essai", () => {
    const { items } = collectTodos({ root: TODOS, targets: ['src'] });
    expect(renderTodoMarkdown(items)).toBe(readRepoFile('tests/fixtures/todos/ATTENDU.md'));
  });

  test('sortie identique à chaque passage (ni date, ni ordre aléatoire)', () => {
    const first = renderTodoMarkdown(collectTodos({ root: TODOS, targets: ['src'] }).items);
    const second = renderTodoMarkdown(collectTodos({ root: TODOS, targets: ['src'] }).items);
    expect(second).toBe(first);
    expect(first).not.toMatch(/\d{4}-\d{2}-\d{2}|\d{2}:\d{2}/);
  });

  test('un appel todo() calculé est signalé, sans être compté', () => {
    const { warnings } = collectTodos({ root: TODOS, targets: ['src'] });
    expect(warnings.map((warning) => `${warning.file}:${warning.line}`)).toEqual([
      'src/data/offres.ts:27',
    ]);
  });

  test("l'exemple en commentaire de src/lib/todo.ts ne compte pas", () => {
    const result = extractTodos('src/lib/todo.ts', readRepoFile('src/lib/todo.ts'));
    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test('un null commenté « TODO » hors de src/data/ ne compte pas', () => {
    const result = extractTodos(
      'src/lib/hors-donnees.ts',
      readRepoFile('tests/fixtures/todos/src/lib/hors-donnees.ts'),
    );
    expect(result.items).toEqual([]);
  });

  test('une option inconnue est refusée sans rien écrire', () => {
    expect(runScript('scripts/todos.mjs', ['--inconnue']).status).toBe(2);
  });
});

test.describe('npm run contrast', () => {
  test('jetons du site : chaque rôle passe sur chaque surface', () => {
    const { results } = checkContrast({ targets: ['src/styles/tokens.css'] });
    const roles = results.filter(
      (result) => result.check === 'role' || result.check === 'non-text',
    );
    // 3 surfaces × (5 rôles de texte + 2 éléments non textuels)
    expect(roles).toHaveLength(21);
    expect(roles.filter((result) => !result.ok)).toEqual([]);
  });

  test('rapports de contraste annoncés dans la charte', () => {
    const { results } = checkContrast({ root: CONTRAST, tokens: 'jetons.css', targets: ['bon'] });
    const ratio = (surface: string, subject: string) =>
      results.find((result) => result.surfaces.includes(surface) && result.subject === subject)
        ?.ratio ?? 0;
    // Valeurs de la charte, arrondies au dixième.
    expect(ratio('creme', '--text')).toBeCloseTo(12.2, 1);
    expect(ratio('sable', '--text')).toBeCloseTo(10.5, 1);
    expect(ratio('creme', '--text-muted')).toBeCloseTo(7.0, 1);
    expect(ratio('sable', '--text-muted')).toBeCloseTo(6.1, 1);
    expect(ratio('creme', '--link')).toBeCloseTo(5.6, 1);
    expect(ratio('sable', '--link')).toBeCloseTo(4.9, 1);
    expect(ratio('creme', '--success')).toBeCloseTo(5.4, 1);
    // Chocolat sur --todo : la charte annonce 10,0:1 ; le calcul exact donne 9,95:1.
    expect(ratio('creme', '.marque')).toBeCloseTo(9.95, 2);
  });

  test('tout le site (src/) passe', () => {
    const { results, ok } = checkContrast();
    expect(results.filter((result) => !result.ok)).toEqual([]);
    expect(ok).toBe(true);
  });

  test("jeu d'essai correct : aucun échec", () => {
    const { results, ok } = checkContrast({
      root: CONTRAST,
      tokens: 'jetons.css',
      targets: ['bon'],
    });
    expect(results.filter((result) => !result.ok)).toEqual([]);
    expect(ok).toBe(true);
    // Les rôles seuls, les couleurs héritées ou transparentes ne donnent aucune ligne.
    expect(results.map((result) => result.subject)).not.toContain('.carte');
    expect(results.map((result) => result.subject)).not.toContain('.invisible');
  });

  test("jeu d'essai fautif : chaque faute est trouvée, à la bonne ligne", () => {
    const { results, ok } = checkContrast({
      root: CONTRAST,
      tokens: 'jetons.css',
      targets: ['mauvais'],
    });
    expect(ok).toBe(false);
    const failures = results
      .filter((result) => !result.ok)
      .map((result) => `${result.check} ${result.file}:${result.line} ${result.subject}`);
    expect(failures).toEqual([
      'pair mauvais/composants.css:14 .paire-faible',
      'pair mauvais/composants.css:24 .bouton:hover',
      'pair mauvais/composants.css:28 .surface-chocolat .lien',
      'pair mauvais/composants.css:38 .alpha',
      'pair mauvais/composants.css:48 .pastille',
      'pair mauvais/composants.css:52 .etiquette',
      'guard mauvais/Composant.astro:9 .note',
      'guard mauvais/composants.css:3 .garde-palette',
      'guard mauvais/composants.css:7 .garde-hex',
      'guard mauvais/composants.css:11 .garde-role-non-texte',
      'guard mauvais/composants.css:34 .degrade',
    ]);
    // Un état qui ne change que le fond est jugé avec la couleur de la règle de base.
    const hover = results.find((result) => result.subject === '.bouton:hover');
    expect(hover?.foreground).toContain('var(--creme)');
    expect(hover?.background).toContain('var(--caramel)');
    // Un fond posé seul est jugé avec le texte hérité (--text) : chocolat sur
    // terre sur les surfaces claires, crème sur terre (correct) sur chocolat.
    const pastille = results.filter((result) => result.subject === '.pastille');
    expect(pastille.map((result) => `${result.surfaces.join(', ')} ${result.ok}`)).toEqual([
      'creme, sable false',
      'chocolat true',
    ]);
    expect(pastille[0]?.foreground).toContain('héritée');
  });

  test('code de sortie et sortie JSON', () => {
    const tokens = ['--tokens', 'tests/fixtures/contrast/jetons.css'];
    expect(
      runScript('scripts/contrast.mjs', [...tokens, 'tests/fixtures/contrast/bon']).status,
    ).toBe(0);
    expect(
      runScript('scripts/contrast.mjs', [...tokens, 'tests/fixtures/contrast/mauvais']).status,
    ).toBe(1);
    const json = runScript('scripts/contrast.mjs', [
      ...tokens,
      '--json',
      'tests/fixtures/contrast/mauvais',
    ]);
    const parsed = JSON.parse(json.stdout) as { ok: boolean; results: unknown[] };
    expect(parsed.ok).toBe(false);
    expect(parsed.results.length).toBeGreaterThan(0);
  });
});

test.describe('npm run check:dist', () => {
  test("jeu d'essai correct : aucune infraction, liens externes listés", () => {
    const report = checkDist(repoPath('tests/fixtures/dist-ok'));
    expect(report.violations).toEqual([]);
    expect(report.externalLinks).toEqual([
      { url: 'https://apnews.com/article/exemple', files: ['index.html'] },
    ]);
  });

  test("jeu d'essai fautif : chaque infraction est trouvée", () => {
    const report = checkDist(repoPath('tests/fixtures/dist-mauvais'));
    expect(
      report.violations.map((finding) => `${finding.file}:${finding.line} ${finding.message}`),
    ).toEqual([
      '_astro/app.js:1 accès à document.cookie',
      '_astro/app.js:2 stockage localStorage',
      '_astro/app.js:3 URI data:',
      '_astro/style.css:1 ressource externe dans le CSS (@import)',
      '_astro/style.css:2 ressource externe dans le CSS (background)',
      '_astro/style.css:3 URI data: dans le CSS (background-image)',
      '_astro/style.css:4 ressource externe dans le CSS (src)',
      'icone.svg:1 script dans un fichier SVG',
      'icone.svg:1 ressource externe (<image href>)',
      'index.html:5 cookie déposé par <meta http-equiv>',
      'index.html:7 ressource externe (<link href>)',
      'index.html:8 ressource externe (<link href>)',
      'index.html:9 ressource externe (<link href>)',
      'index.html:10 ressource externe (<script src>)',
      'index.html:11 script en ligne (seul type="application/json" est admis)',
      'index.html:14 script en ligne de type application/ld+json (seul type="application/json" est admis)',
      'index.html:16 élément <style> en ligne (refusé par une CSP stricte)',
      "index.html:21 gestionnaire d'événement en ligne (onclick)",
      'index.html:22 attribut style (refusé par une CSP stricte)',
      'index.html:23 URI data: (<img src>)',
      'index.html:24 ressource externe (<img srcset>)',
      'index.html:25 ressource externe (<iframe src>)',
      'index.html:26 URL javascript: (lien)',
      'index.html:27 attribut ping (signalement des clics à un serveur)',
      'index.html:28 ressource externe (<video poster>)',
      'index.html:29 ressource externe (<form action>)',
      'index.html:30 ressource externe (<link href>)',
      'index.html:31 ressource externe (<audio src>)',
      'index.html:32 ressource externe (<object data>)',
      'manifest.webmanifest:1 adresse externe dans le manifeste (icons[0].src)',
    ]);
    expect(
      report.warnings.map((finding) => `${finding.file}:${finding.line} ${finding.message}`),
    ).toEqual([
      '_astro/app.js:4 stockage sessionStorage : à vérifier',
      '_astro/app.js:5 adresse externe dans le JavaScript : à vérifier (commentaire de licence ou requête ?)',
      'icone.svg:1 élément <style> en ligne (refusé par une CSP stricte)',
    ]);
    expect(report.externalLinks.map((link) => link.url)).toEqual(['https://example.org/']);
  });

  test('code de sortie', () => {
    expect(runScript('scripts/check-dist.mjs', ['tests/fixtures/dist-ok']).status).toBe(0);
    expect(runScript('scripts/check-dist.mjs', ['tests/fixtures/dist-mauvais']).status).toBe(1);
    expect(runScript('scripts/check-dist.mjs', ['tests/fixtures/dossier-absent']).status).toBe(2);
  });

  test('le site construit pour ces tests passe le contrôle', () => {
    test.skip(!pathExists(builtDir), `site non construit dans ${builtDir}`);
    const report = checkDist(builtDir);
    expect(
      report.violations.map((finding) => `${finding.file}:${finding.line} ${finding.message}`),
    ).toEqual([]);
  });
});
