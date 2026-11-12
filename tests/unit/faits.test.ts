/**
 * Faits partagés (src/data/faits.ts) : une information manquante n'est
 * déclarée qu'une fois, et toutes les pages affichent le même repère.
 *
 * Le test relit src/ avec le même outil que `npm run todos` : ce qu'il
 * vérifie est donc exactement ce que liste TODO.md.
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { collectTodos } from '../../scripts/lib/todos.mjs';

const FACTS_FILE = 'src/data/faits.ts';

const { items, warnings } = collectTodos();

/** Faits écrits une seule fois, dans src/data/faits.ts, et repris par plusieurs pages. */
const SHARED_FACTS: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  {
    name: 'accès depuis l’extérieur de la maison',
    pattern: /extérieur de la maison|accès à distance/iu,
  },
  { name: 'copie de secours', pattern: /copie de secours/iu },
  { name: 'déménageur', pattern: /déménageur/iu },
  { name: 'licence de la page d’accueil de la box', pattern: /page d’accueil de la box/iu },
  { name: 'moyens de paiement', pattern: /^moyens de paiement/iu },
  { name: 'garantie de la box', pattern: /^garantie/iu },
  { name: 'frais d’envoi hors de la zone', pattern: /frais d’envoi/iu },
];

describe('faits partagés', () => {
  it('le recensement des informations manquantes fonctionne', () => {
    assert.ok(items.length > 0);
    assert.deepEqual(warnings, []);
  });

  it('chaque information manquante n’apparaît qu’une fois dans TODO.md', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const item of items) {
      const where = `${item.file}:${item.line}`;
      const first = seen.get(item.what);
      if (first) duplicates.push(`« ${item.what} » : ${first} et ${where}`);
      else seen.set(item.what, where);
    }
    assert.deepEqual(duplicates, []);
  });

  for (const fact of SHARED_FACTS) {
    it(`${fact.name} : déclaré dans ${FACTS_FILE} seulement`, () => {
      const elsewhere = items
        .filter((item) => item.file !== FACTS_FILE && fact.pattern.test(item.what))
        .map((item) => `${item.file}:${item.line} (${item.what})`);
      assert.deepEqual(elsewhere, [], 'à remplacer par la valeur de src/data/faits.ts');
    });
  }
});
