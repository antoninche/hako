/**
 * Zone d'intervention d'après le code postal (src/lib/commande/service-area.ts).
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SERVICE_AREA_DEPARTMENTS,
  departmentOf,
  isOutsideServiceArea,
  isPostalCode,
  normalizePostalCode,
} from '../../src/lib/commande/service-area.ts';

describe('zone d’intervention', () => {
  it('couvre les Bouches-du-Rhône et le Var (règle provisoire)', () => {
    assert.deepEqual([...SERVICE_AREA_DEPARTMENTS].sort(), ['13', '83']);
  });

  it('considère Salon-de-Provence, Aix, Marseille et Toulon dans la zone', () => {
    for (const code of ['13300', '13100', '13001', '13 008', '83000']) {
      assert.equal(isOutsideServiceArea(code), false, code);
    }
  });

  it('signale un code postal complet hors de la zone', () => {
    for (const code of ['06000', '75001', '84000', '97400']) {
      assert.equal(isOutsideServiceArea(code), true, code);
    }
  });

  it('ne juge pas un code postal incomplet ou mal saisi', () => {
    for (const code of ['', '1', '0600', 'abcde', '130001']) {
      assert.equal(isOutsideServiceArea(code), false, code);
    }
  });

  it('accepte une autre liste de départements', () => {
    assert.equal(isOutsideServiceArea('84000', ['13', '83', '84']), false);
    assert.equal(isOutsideServiceArea('13100', ['83']), true);
  });
});

describe('code postal', () => {
  it('se lit avec ou sans espace', () => {
    assert.equal(normalizePostalCode(' 13 100 '), '13100');
    assert.ok(isPostalCode('13 100'));
    assert.equal(isPostalCode('1310'), false);
  });

  it('donne son département, outre-mer compris', () => {
    assert.equal(departmentOf('13100'), '13');
    assert.equal(departmentOf('83000'), '83');
    assert.equal(departmentOf('97400'), '974');
    assert.equal(departmentOf('1310'), null);
  });
});
