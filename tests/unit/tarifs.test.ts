/**
 * Garde-fous du fichier des tarifs (src/data/tarifs.ts), pour qu'une
 * modification à la main ne casse pas la page Offres ni le formulaire.
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { pricing } from '../../src/data/tarifs.ts';

const isAmount = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Nombre de valeurs null dans les tarifs, à toutes les profondeurs. */
function countNulls(value: unknown): number {
  if (value === null) return 1;
  if (typeof value !== 'object') return 0;
  return Object.values(value).reduce<number>((sum, item) => sum + countNulls(item), 0);
}

describe('fichier des tarifs', () => {
  it('donne un prix positif à chaque offre', () => {
    for (const offer of Object.values(pricing.offers)) {
      assert.ok(isAmount(offer.priceEur) && offer.priceEur > 0, offer.name);
    }
  });

  it('réserve l’abonnement mensuel à Hako Pro', () => {
    assert.equal(pricing.offers.home.subscription, undefined);
    const monthly = pricing.offers.pro.subscription?.monthlyEur;
    assert.ok(isAmount(monthly) && (monthly ?? 0) > 0);
  });

  it('a des options de stockage distinctes, dont celle comprise à 0 €', () => {
    const ids = pricing.storage.map((option) => option.id);
    assert.equal(new Set(ids).size, ids.length);
    const included = pricing.storage.find((option) => option.id === pricing.includedStorage);
    assert.equal(included?.extraEur, 0);
    for (const option of pricing.storage) {
      assert.ok(option.extraEur === null || isAmount(option.extraEur), option.label);
    }
  });

  it('a un acompte inconnu (null) ou compris entre 1 et 100 %', () => {
    const percent = pricing.depositPercent;
    assert.ok(percent === null || (percent > 0 && percent <= 100));
  });

  it('accompagne chaque valeur manquante (null) d’un commentaire « // TODO: »', () => {
    const source: string = readFileSync(
      new URL('../../src/data/tarifs.ts', import.meta.url),
      'utf8',
    );
    // Lignes de code qui donnent la valeur null (« taxStatus: null, », « extraEur: null }, »…),
    // hors commentaires : l'exemple de l'en-tête du fichier ne compte pas.
    const lines = source.split('\n').filter((line) => {
      const code = line.replace(/\/\/.*$/, '').trim();
      return !code.startsWith('*') && !code.startsWith('/*') && /:\s*null\b/.test(code);
    });
    for (const line of lines) assert.match(line, /\/\/ TODO: \S/, line.trim());
    // Une ligne commentée par valeur null : aucune ne passe entre les mailles,
    // et le test reste juste quand tous les prix sont fixés (0 = 0).
    assert.equal(lines.length, countNulls(pricing), 'une seule valeur null par ligne');
  });
});
