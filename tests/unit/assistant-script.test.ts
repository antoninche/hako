/**
 * Page de la HAKO, première installation, et sa démonstration : les
 * promesses du script, relues dans sa source, puis dans le JavaScript
 * construit de la page /installer/demonstration/ (dist/).
 *
 * - Source (src/components/assistant/assistant-ui.ts et src/lib/assistant/) :
 *   aucun stockage, aucune requête, aucune adresse, aucun texte mis en forme
 *   avec Intl, aucun HTML écrit par le script ; la logique pure n'importe ni
 *   textes ni faits, et ne touche pas au navigateur au chargement.
 * - JavaScript construit de la page : ni fetch, ni XMLHttpRequest, ni
 *   WebSocket, ni sendBeacon, ni « /api/ ». L'accès à la vraie HAKO n'entre
 *   donc jamais dans le site public. Ce contrôle est sauté si le site n'est
 *   pas construit (npm run build).
 *
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { DEMO_ROUTE } from '../../src/data/assistant.ts';
import { routes } from '../../src/data/navigation.ts';

/** Contenu d'un fichier du dépôt, quel que soit le dossier d'où les tests sont lancés. */
const repoUrl = (path: string): URL => new URL(`../../${path}`, import.meta.url);
const readRepoFile = (path: string): string => readFileSync(repoUrl(path), 'utf8');

/** Source sans ses commentaires : seul le code compte. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

const LIB_FILES = readdirSync(repoUrl('src/lib/assistant'))
  .filter((name) => name.endsWith('.ts'))
  .map((name) => `src/lib/assistant/${name}`);
const SCRIPT_FILES = ['src/components/assistant/assistant-ui.ts', ...LIB_FILES];

const code = SCRIPT_FILES.map((file) => withoutComments(readRepoFile(file))).join('\n');

describe('script de la page de la HAKO (source)', () => {
  it('relit bien le contrôleur et la logique pure', () => {
    assert.ok(LIB_FILES.length >= 4, LIB_FILES.join(', '));
  });

  it('ne garde rien sur l’appareil', () => {
    assert.doesNotMatch(
      code,
      /localStorage|sessionStorage|indexedDB|document\.cookie|cookieStore/u,
    );
  });

  it('ne fait aucune requête et ne contient aucune adresse', () => {
    assert.doesNotMatch(code, /\bfetch\b|XMLHttpRequest|WebSocket|EventSource|sendBeacon/u);
    assert.doesNotMatch(code, /https?:\/\/|\/api\//u);
  });

  it('ne met rien en forme avec Intl, n’écrit aucun HTML', () => {
    assert.doesNotMatch(code, /\bIntl\.|toLocale\w*String/u);
    assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|setAttribute\('style'/u);
  });

  it('n’importe ni les textes ni les faits : ils viennent de la page', () => {
    assert.doesNotMatch(code, /from '[^']*\/(?:content|data)\//u);
  });

  it('une seule adresse pour la page de démonstration', () => {
    assert.equal(routes.installDemo, DEMO_ROUTE);
    assert.ok(existsSync(repoUrl(`src/pages${DEMO_ROUTE}index.astro`)));
  });

  it('la logique pure ne touche pas au navigateur', () => {
    const pure = LIB_FILES.map((file) => withoutComments(readRepoFile(file))).join('\n');
    assert.doesNotMatch(pure, /\b(?:window|document|navigator|location|history)\b/u);
  });
});

/** Scripts chargés par la page construite, avec les morceaux qu'ils importent. */
function builtScripts(): Map<string, string> {
  const html = readRepoFile('dist/installer/demonstration/index.html');
  const pending = [...html.matchAll(/<script\b[^>]*\bsrc="(\/_astro\/[^"]+\.js)"/gu)].map(
    (match) => match[1] ?? '',
  );
  const found = new Map<string, string>();
  while (pending.length > 0) {
    const path = pending.pop() ?? '';
    if (found.has(path)) continue;
    const text = readRepoFile(`dist${path}`);
    found.set(path, text);
    for (const match of text.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/gu)) {
      pending.push(`/_astro/${match[1] ?? ''}`);
    }
  }
  return found;
}

describe('JavaScript construit de /installer/demonstration/', () => {
  const built = existsSync(repoUrl('dist/installer/demonstration/index.html'));

  it(
    'ni fetch, ni XMLHttpRequest, ni WebSocket, ni sendBeacon, ni « /api/ »',
    { skip: !built },
    () => {
      const scripts = builtScripts();
      assert.ok(scripts.size >= 2, `${scripts.size} script(s) seulement`);
      const offenders = [...scripts]
        .filter(([, text]) => /\bfetch\b|XMLHttpRequest|WebSocket|sendBeacon|\/api\//u.test(text))
        .map(([path]) => path);
      assert.deepEqual(offenders, []);
      // Le script de la démonstration est bien parmi eux.
      assert.ok(
        [...scripts.values()].some((text) => text.includes('data-person-template')),
        'script de la démonstration introuvable',
      );
    },
  );

  it('aucune adresse en http:// dans le script de la page', { skip: !built }, () => {
    const offenders = [...builtScripts()]
      .filter(([, text]) => /http:\/\//u.test(text))
      .map(([path]) => path);
    assert.deepEqual(offenders, []);
  });
});
