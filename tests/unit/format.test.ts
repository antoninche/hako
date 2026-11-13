/**
 * Mise en forme des nombres (src/lib/format.ts) : le seul endroit du site qui
 * écrit un prix, un pourcentage ou un nombre.
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatEur, formatList, formatNumber, formatPercent } from '../../src/lib/format.ts';

// Espace insécable ordinaire (U+00A0), écrite en clair pour être visible ici.
const nbsp = ' ';

/** Vrai si toutes les espaces du texte sont des espaces insécables ordinaires. */
const onlyNoBreakSpaces = (text: string) => !/\s/u.test(text.replaceAll(nbsp, ''));

describe('mise en forme des nombres', () => {
  it('écrit les prix comme sur toutes les pages', () => {
    assert.equal(formatEur(750), `750${nbsp}€`);
    assert.equal(formatEur(1000), `1${nbsp}000${nbsp}€`);
    assert.equal(formatEur(25), `25${nbsp}€`);
  });

  it('écrit les nombres et les décimales à la française', () => {
    assert.equal(formatNumber(1500), `1${nbsp}500`);
    assert.equal(formatNumber(12.18, 1), '12,2');
    assert.equal(formatNumber(4.5, 1), '4,5');
    assert.equal(formatNumber(10, 1), '10,0');
  });

  it('n’emploie que l’espace insécable ordinaire, présente dans les polices du site', () => {
    const samples = [0, 7, 999, 1000, 1500.5, 25000, 1234567.891];
    for (const value of samples) {
      for (const text of [formatEur(value), formatNumber(value), formatNumber(value, 1)]) {
        assert.ok(onlyNoBreakSpaces(text), `${value} → ${JSON.stringify(text)}`);
      }
    }
    for (const value of [0, 30, 37.5, 50, 100]) {
      const text = formatPercent(value);
      assert.ok(onlyNoBreakSpaces(text), `${value} → ${JSON.stringify(text)}`);
    }
  });

  it('énumère avec « et » ou « ou »', () => {
    assert.equal(formatList(['Hako Home', 'Hako Pro']), 'Hako Home et Hako Pro');
    assert.equal(formatList([`2${nbsp}To`, `4${nbsp}To`], 'or'), `2${nbsp}To ou 4${nbsp}To`);
    assert.equal(formatList(['2 To', '4 To', '8 To'], 'or'), '2 To, 4 To ou 8 To');
  });
});
