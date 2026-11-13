/**
 * Calcul des montants (src/lib/commande/pricing.ts) et mise en forme des prix
 * (src/lib/format.ts).
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pricing, type Pricing } from '../../src/data/tarifs.ts';
import { formatEur, formatPercent } from '../../src/lib/format.ts';
import {
  computeQuote,
  findStorage,
  listQuotes,
  parseOfferId,
  quoteKey,
} from '../../src/lib/commande/pricing.ts';

/** Tarifs d'essai : mêmes offres que le site, suppléments au choix. */
function fixture(extra2: number | null, extra4: number | null): Pricing {
  return {
    ...pricing,
    storage: [
      { id: '1to', label: '1 To', extraEur: 0 },
      { id: '2to', label: '2 To', extraEur: extra2 },
      { id: '4to', label: '4 To', extraEur: extra4 },
    ],
  };
}

describe('mise en forme des montants', () => {
  // Espace insécable ordinaire (U+00A0), écrite en clair pour être visible ici.
  const nbsp = '\u00A0';

  it('écrit les euros à la française, avec des espaces insécables', () => {
    assert.equal(formatEur(1000), `1${nbsp}000${nbsp}€`);
    assert.equal(formatEur(1090), `1${nbsp}090${nbsp}€`);
    assert.equal(formatEur(750), `750${nbsp}€`);
    assert.equal(formatEur(381.5), `381,50${nbsp}€`);
    assert.equal(formatEur(12500), `12${nbsp}500${nbsp}€`);
  });

  it('écrit les pourcentages avec une espace insécable', () => {
    assert.equal(formatPercent(30), `30${nbsp}%`);
    assert.equal(formatPercent(37.5), `37,5${nbsp}%`);
  });

  it('n’utilise jamais l’espace fine insécable, absente des polices du site', () => {
    const samples = [0, 25, 999, 1000, 1090, 381.5, 12500, 1234567.89];
    for (const amount of samples) {
      const text = formatEur(amount);
      assert.ok(!text.includes('\u202F'), `${amount} → ${text}`);
      assert.ok(!/\s/.test(text.replaceAll(nbsp, '')), `${amount} : espace sécable`);
    }
    for (const value of [0, 30, 37.5, 50, 100]) {
      assert.ok(!formatPercent(value).includes('\u202F'), String(value));
    }
  });
});

describe('total d’une commande', () => {
  it('additionne la box et un supplément connu', () => {
    const quote = computeQuote(fixture(90, 250), 'pro', '2to');
    assert.equal(quote.offerPriceEur, 1000);
    assert.equal(quote.storageExtraEur, 90);
    assert.equal(quote.oneTimeKnownEur, 1090);
    assert.equal(quote.oneTimeTotalEur, 1090);
  });

  it('compte le stockage compris pour 0 €', () => {
    const quote = computeQuote(fixture(null, null), 'home', '1to');
    assert.equal(quote.storageExtraEur, 0);
    assert.equal(quote.oneTimeTotalEur, 750);
  });

  it('ne compte jamais un supplément inconnu comme 0 : le total devient inconnu', () => {
    const quote = computeQuote(fixture(null, null), 'pro', '4to');
    assert.equal(quote.storageExtraEur, null);
    assert.equal(quote.oneTimeTotalEur, null);
    // La partie déjà chiffrée reste disponible, pour afficher « 1 000 € + [prix] ».
    assert.equal(quote.oneTimeKnownEur, 1000);
  });

  it('donne la part mensuelle de Hako Pro, et aucune pour Hako Home', () => {
    const live = pricing.offers.pro.subscription?.monthlyEur ?? null;
    assert.equal(computeQuote(pricing, 'pro', '1to').monthlyEur, live);
    assert.equal(computeQuote(pricing, 'home', '1to').monthlyEur, null);
  });

  it('suit le fichier des tarifs du site pour Hako Pro avec 2 To', () => {
    const quote = computeQuote(pricing, 'pro', '2to');
    const extra = findStorage(pricing, '2to').extraEur;
    assert.equal(quote.storageExtraEur, extra);
    assert.equal(
      quote.oneTimeTotalEur,
      extra === null ? null : pricing.offers.pro.priceEur + extra,
    );
  });

  it('Hako Home revient à 750 €, 950 € ou 1 150 € avec 1, 2 ou 4 To', () => {
    const totals = (['1to', '2to', '4to'] as const).map(
      (storage) => computeQuote(pricing, 'home', storage).oneTimeTotalEur,
    );
    assert.deepEqual(totals, [750, 950, 1150]);
  });
});

describe('outils', () => {
  it('lit le paramètre ?offre= de l’adresse', () => {
    assert.equal(parseOfferId('pro'), 'pro');
    assert.equal(parseOfferId(' HOME '), 'home');
    assert.equal(parseOfferId('entreprise'), null);
    assert.equal(parseOfferId(null), null);
    assert.equal(parseOfferId(undefined), null);
  });

  it('refuse une option de stockage inconnue', () => {
    // @ts-expect-error : identifiant volontairement faux
    assert.throws(() => findStorage(pricing, '8to'), /inconnue/);
  });

  it('liste chaque combinaison offre + stockage une seule fois', () => {
    const quotes = listQuotes(pricing);
    const keys = quotes.map((quote) => quoteKey(quote.offer.id, quote.storage.id));
    assert.equal(quotes.length, Object.keys(pricing.offers).length * pricing.storage.length);
    assert.equal(new Set(keys).size, keys.length);
    for (const quote of quotes) {
      if (quote.storageExtraEur === null) assert.equal(quote.oneTimeTotalEur, null);
    }
  });
});
