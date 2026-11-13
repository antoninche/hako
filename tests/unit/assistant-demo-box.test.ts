/**
 * HAKO simulée de la démonstration (src/lib/assistant/demo-box.ts) : elle
 * répond comme la vraie HAKO, sans rien envoyer ni garder.
 *
 * - Aucune sortie : ni requête (fetch, XMLHttpRequest, WebSocket,
 *   EventSource, sendBeacon), ni stockage (localStorage, sessionStorage,
 *   indexedDB), espionnés comme pour l'envoi de commande de démonstration.
 * - Mots de passe d'exemple fixes, dans l'ordre des personnes : ils
 *   commencent par « exemple » et finissent par 00, jamais tirés au hasard.
 * - Création des comptes ligne par ligne ; coupure simulée, puis reprise sans
 *   refaire ce qui est fait ; mots de passe oubliés une fois les comptes créés.
 * - Ce que la démonstration sait provoquer : HAKO qui se prépare, déjà
 *   installée, qui ne répond plus, réponse inattendue.
 *
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  EXAMPLE_FIRST_NAMES,
  EXAMPLE_PASSWORDS,
  FIRST_NAME_MAX_LENGTH,
  LOGIN_DOMAIN,
  MAX_PEOPLE,
} from '../../src/data/assistant.ts';
import {
  BoxAccessError,
  isSimulated,
  type BoxAccess,
  type CreationProgress,
} from '../../src/lib/assistant/box-access.ts';
import { DEMO_DELAYS, DemoBoxAccess } from '../../src/lib/assistant/demo-box.ts';

/** HAKO simulée qui n'attend pas ; les attentes demandées sont notées. */
function demoBox(): { box: DemoBoxAccess; waits: number[] } {
  const waits: number[] = [];
  const box = new DemoBoxAccess({
    passwords: EXAMPLE_PASSWORDS,
    loginDomain: LOGIN_DOMAIN,
    firstNameMaxLength: FIRST_NAME_MAX_LENGTH,
    wait: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
  });
  return { box, waits };
}

/** Avancement reçu pendant la création des comptes, ligne par ligne. */
async function create(box: BoxAccess): Promise<string[]> {
  const steps: string[] = [];
  const record = (progress: CreationProgress): void => {
    steps.push(`${progress.photos} ${progress.files} ${progress.finish}`);
  };
  await box.createAccounts(record);
  return steps;
}

/** Points de sortie d'une page web, remplacés par des espions. */
const EXITS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'localStorage',
  'sessionStorage',
  'indexedDB',
] as const;

describe('HAKO simulée : rien ne sort', () => {
  const touched: string[] = [];
  const saved = new Map<string, PropertyDescriptor | undefined>();
  let beacon: PropertyDescriptor | undefined;

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
    beacon = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      get() {
        touched.push('navigator');
        return {};
      },
    });
  });

  afterEach(() => {
    for (const name of EXITS) {
      const descriptor = saved.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete (globalThis as Record<string, unknown>)[name];
    }
    if (beacon) Object.defineProperty(globalThis, 'navigator', beacon);
  });

  it('tout le parcours, sans requête ni stockage', async () => {
    const { box } = demoBox();
    assert.equal(box.mode, 'demo');
    assert.deepEqual(await box.status(), { phase: 'ready' });
    const accounts = await box.register(['Hélène', 'Marc']);
    assert.equal(await box.checkSheet(accounts[0]?.password ?? ''), 'ok');
    await create(box);
    assert.deepEqual(await box.status(), { phase: 'installed' });
    assert.deepEqual(touched, [], `sorties utilisées : ${touched.join(', ')}`);
  });
});

describe('HAKO simulée : comptes et mots de passe d’exemple', () => {
  it('un compte par prénom, la première personne responsable', async () => {
    const { box } = demoBox();
    const accounts = await box.register([...EXAMPLE_FIRST_NAMES, 'Camille', 'camille']);
    assert.deepEqual(
      accounts.map((account) => [account.firstName, account.login, account.owner]),
      [
        ['Hélène', 'helene@hako.local', true],
        ['Marc', 'marc@hako.local', false],
        ['Léa', 'lea@hako.local', false],
        ['Camille', 'camille@hako.local', false],
        ['camille', 'camille2@hako.local', false],
      ],
    );
  });

  it('mots de passe fixes, dans l’ordre : « exemple », trois mots, puis 00', async () => {
    const names = Array.from({ length: MAX_PEOPLE }, (_, index) => `Personne${'abcdefgh'[index]}`);
    const first = await demoBox().box.register(names);
    const second = await demoBox().box.register(names);
    assert.deepEqual(
      first.map((account) => account.password),
      [...EXAMPLE_PASSWORDS],
    );
    assert.deepEqual(first, second, 'toujours les mêmes');
    for (const account of first) {
      assert.match(account.password, /^exemple(?:-[a-z]{4,8}){3}-00$/u);
    }
  });

  it('prénoms refusés, trop de personnes : réponse inattendue', async () => {
    for (const names of [
      [],
      [''],
      ['Marc2'],
      Array.from({ length: MAX_PEOPLE + 1 }, () => 'Léa'),
    ]) {
      await assert.rejects(demoBox().box.register(names), (error: unknown) => {
        assert.ok(error instanceof BoxAccessError);
        assert.equal(error.code, 'unexpected');
        return true;
      });
    }
  });

  it('vérifie le mot de passe de la personne responsable, et lui seul', async () => {
    const { box } = demoBox();
    const [owner, other] = await box.register(['Hélène', 'Marc']);
    assert.equal(await box.checkSheet(owner?.password ?? ''), 'ok');
    assert.equal(await box.checkSheet(other?.password ?? ''), 'wrong');
    assert.equal(await box.checkSheet(`${owner?.password ?? ''} `), 'wrong');
  });
});

describe('HAKO simulée : création des comptes', () => {
  it('ligne par ligne, puis la HAKO oublie les mots de passe', async () => {
    const { box } = demoBox();
    const [owner] = await box.register(['Hélène']);
    assert.deepEqual(await create(box), [
      'waiting waiting waiting',
      'running waiting waiting',
      'done waiting waiting',
      'done running waiting',
      'done done waiting',
      'done done running',
      'done done done',
    ]);
    await assert.rejects(box.checkSheet(owner?.password ?? ''), BoxAccessError);
    await assert.rejects(box.register(['Léa']), BoxAccessError);
  });

  it('coupure après les comptes des photos, puis reprise sans les refaire', async () => {
    const { box } = demoBox();
    assert.ok(isSimulated(box));
    await box.register(['Hélène', 'Marc']);
    box.simulate('stopped');
    const steps: string[] = [];
    await assert.rejects(
      box.createAccounts((progress) => {
        steps.push(`${progress.photos} ${progress.files} ${progress.finish}`);
      }),
      (error: unknown) => error instanceof BoxAccessError && error.code === 'interrupted',
    );
    assert.equal(steps.at(-1), 'done waiting waiting');
    assert.deepEqual(await box.status(), { phase: 'ready' }, 'pas encore installée');
    const resumed = await create(box);
    assert.equal(resumed[0], 'done waiting waiting');
    assert.ok(!resumed.includes('running waiting waiting'), 'les photos ne sont pas refaites');
    assert.equal(resumed.at(-1), 'done done done');
  });

  it('quelques secondes en tout', async () => {
    const { box, waits } = demoBox();
    await box.register(['Hélène']);
    waits.length = 0;
    await create(box);
    const total = waits.reduce((sum, ms) => sum + ms, 0);
    assert.equal(total, 3 * DEMO_DELAYS.task + DEMO_DELAYS.settle);
    assert.ok(total >= 1000 && total <= 6000, `${total} ms`);
  });
});

describe('HAKO simulée : ce que la démonstration provoque', () => {
  it('se prépare encore, puis prête ; déjà installée, une fois', async () => {
    const { box } = demoBox();
    box.simulate('preparing');
    assert.deepEqual(await box.status(), { phase: 'preparing' });
    assert.deepEqual(await box.status(), { phase: 'ready' });
    box.simulate('installed');
    assert.deepEqual(await box.status(), { phase: 'installed' });
    assert.deepEqual(await box.status(), { phase: 'ready' });
  });

  it('ne répond plus, ou répond de façon inattendue, à la demande suivante seulement', async () => {
    const { box } = demoBox();
    for (const code of ['unreachable', 'unexpected'] as const) {
      box.simulate(code);
      await assert.rejects(
        box.status(),
        (error: unknown) => error instanceof BoxAccessError && error.code === code,
      );
      assert.deepEqual(await box.status(), { phase: 'ready' });
    }
  });
});
