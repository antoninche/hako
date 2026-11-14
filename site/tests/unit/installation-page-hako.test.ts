/**
 * Le guide d’installation (/installer/) cite la page de la HAKO mot pour mot :
 * titres des écrans, boutons, lignes de la fiche de secours. Ces libellés
 * sont écrits dans `boxPage` (src/data/installation.ts), recopiés de la
 * démonstration (src/content/assistant.ts), qui fait foi.
 *
 * Ce test vérifie que chaque libellé de `boxPage` figure toujours dans les
 * textes de la démonstration, et que le guide s’en sert bien. Si la page de
 * la HAKO change un de ses libellés, ce test échoue : corrigez alors
 * `boxPage`, et le guide suit.
 *
 * Le fichier de textes de la démonstration importe des modules que Node ne
 * sait pas résoudre seul (imports sans extension) : il est relu comme du
 * texte. Seuls ses textes écrits en toutes lettres comptent (chaînes entre
 * apostrophes ou guillemets, parties fixes des gabarits), pas ses
 * commentaires.
 *
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { boxPage } from '../../src/data/installation.ts';

/** Contenu d’un fichier du dépôt, quel que soit le dossier d’où les tests sont lancés. */
const readRepoFile = (path: string): string =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

/** Textes écrits en toutes lettres dans une source TypeScript, sans ses commentaires. */
function literals(source: string): string[] {
  const found: string[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index] ?? '';
    if (source.startsWith('//', index)) {
      const end = source.indexOf('\n', index);
      index = end === -1 ? source.length : end;
    } else if (source.startsWith('/*', index)) {
      index = source.indexOf('*/', index) + 2;
    } else if (char === "'" || char === '"' || char === '`') {
      index += 1;
      let text = '';
      while (index < source.length && source[index] !== char) {
        if (char === '`' && source.startsWith('${', index)) {
          // Partie calculée d'un gabarit : elle coupe le texte en deux morceaux.
          found.push(text);
          text = '';
          let depth = 0;
          do {
            if (source[index] === '{') depth += 1;
            if (source[index] === '}') depth -= 1;
            index += 1;
          } while (index < source.length && depth > 0);
        } else {
          if (source[index] === '\\') index += 1;
          text += source[index] ?? '';
          index += 1;
        }
      }
      index += 1;
      found.push(text);
    } else {
      index += 1;
    }
  }
  return found.filter((text) => text.length > 0);
}

const NBSP = ' ';
const demoTexts = literals(readRepoFile('src/content/assistant.ts'));
const guideSource = readRepoFile('src/content/installation.ts');

/**
 * Un libellé est cité tel quel : c’est tout un texte de la démonstration, ce
 * texte suivi d’un point (« Votre HAKO est installée. »), ou le début d’un
 * texte qui continue après deux-points (« Photos (application Immich) : »).
 */
const citedIn = (label: string, text: string): boolean =>
  text === label || text === `${label}.` || text.startsWith(`${label}${NBSP}:`);

describe('libellés de la page de la HAKO cités par le guide', () => {
  const entries = Object.entries(boxPage);

  it('trouve bien les textes de la démonstration', () => {
    assert.ok(demoTexts.length > 200, `${demoTexts.length} textes seulement`);
    assert.ok(entries.length > 10, `${entries.length} libellés seulement`);
  });

  for (const [key, label] of entries) {
    it(`« ${label} » (boxPage.${key}) figure dans la démonstration`, () => {
      assert.ok(
        demoTexts.some((text) => citedIn(label, text)),
        `« ${label} » n’est plus dans src/content/assistant.ts : recopiez le nouveau libellé dans boxPage (src/data/installation.ts).`,
      );
    });
  }

  it('chaque libellé sert au guide', () => {
    const unused = entries
      .filter(([key]) => !new RegExp(`\\bboxPage\\.${key}\\b`, 'u').test(guideSource))
      .map(([key]) => key);
    assert.deepEqual(unused, [], 'libellés inutilisés dans src/content/installation.ts');
  });

  it('le guide ne décrit plus la page de la HAKO par un repère à confirmer', () => {
    for (const key of ['boxPage', 'installDone', 'backFromBox', 'appAddress']) {
      assert.doesNotMatch(guideSource, new RegExp(`toConfirm\\.${key}\\b`, 'u'), key);
    }
  });
});
