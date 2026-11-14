/**
 * Envoi en mode démonstration (src/lib/commande/submitter.ts) : rien ne
 * quitte le navigateur, rien n'est stocké.
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { pricing } from '../../src/data/tarifs.ts';
import { computeQuote } from '../../src/lib/commande/pricing.ts';
import { DemoSubmitter, type OrderSubmitter } from '../../src/lib/commande/submitter.ts';
import type { OrderRequest } from '../../src/lib/commande/types.ts';
import { toOrderRequest } from '../../src/lib/commande/validation.ts';

const order: OrderRequest = toOrderRequest(
  {
    offer: 'pro',
    storage: '2to',
    firstName: 'Camille',
    lastName: 'Martin',
    email: 'camille@domaine.fr',
    phone: '04 91 00 00 00',
    address: '12 rue des Oliviers',
    postalCode: '13100',
    city: 'Aix-en-Provence',
    companyName: 'Atelier Martin',
    users: '4',
    timeSlots: ['matin'],
    availabilityNote: '',
    acceptTerms: true,
    acceptPrivacy: true,
  },
  computeQuote(pricing, 'pro', '2to'),
);

/** Fige un objet en profondeur : toute modification lèverait une erreur. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

/** Points de sortie possibles d'une page web, remplacés par des espions. */
const EXITS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'localStorage',
  'sessionStorage',
  'indexedDB',
] as const;

describe('DemoSubmitter', () => {
  const touched: string[] = [];
  const saved = new Map<string, PropertyDescriptor | undefined>();

  beforeEach(() => {
    touched.length = 0;
    for (const name of EXITS) {
      saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get() {
          touched.push(name);
          return () => {
            throw new Error(`${name} ne doit pas être utilisé en démonstration`);
          };
        },
      });
    }
  });

  afterEach(() => {
    for (const name of EXITS) {
      const descriptor = saved.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete (globalThis as Record<string, unknown>)[name];
    }
  });

  it('se déclare en mode démonstration', () => {
    const submitter: OrderSubmitter = new DemoSubmitter();
    assert.equal(submitter.mode, 'demo');
  });

  it('confirme sans aucune requête réseau ni stockage', async () => {
    const submitter: OrderSubmitter = new DemoSubmitter();
    const result = await submitter.submit(deepFreeze(structuredClone(order)));
    assert.deepEqual(result, { status: 'demo' });
    assert.deepEqual(touched, [], `sorties utilisées : ${touched.join(', ')}`);
  });

  it('ne modifie pas la demande reçue', async () => {
    const frozen = deepFreeze(structuredClone(order));
    const submitter: OrderSubmitter = new DemoSubmitter();
    await assert.doesNotReject(submitter.submit(frozen));
    assert.deepEqual(frozen, order);
  });
});
