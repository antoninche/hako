/**
 * Accès réel à la HAKO (src/lib/assistant/box-http.ts), contre une API locale
 * simulée qui suit le contrat (docs/page-box.md).
 *
 * - Requêtes : adresses relatives sous /api/installation/, JSON, ni cookie,
 *   ni cache, ni redirection, ni référent ; le jeton de session en en-tête,
 *   seulement une fois reçu.
 * - Réponses relues strictement : forme, types, identifiants attendus, forme
 *   des mots de passe, taille. Toute surprise donne « unexpected ».
 * - Erreurs : injoignable (pas de réponse, délai dépassé, 502, 504),
 *   installation en cours ailleurs (409 busy), HAKO qui n'est plus où la
 *   page la croyait (401, 409 wrong_phase, 503 preparing), plus aucun essai
 *   (423), création arrêtée pendant le suivi.
 * - Création des comptes : avancement suivi chaque seconde, réponses manquées
 *   tolérées un temps, fin quand la HAKO est installée.
 *
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LOGIN_DOMAIN } from '../../src/data/assistant.ts';
import { BoxAccessError, type CreationProgress } from '../../src/lib/assistant/box-access.ts';
import {
  API_BASE,
  BoxHttpAccess,
  MAX_BODY_BYTES,
  SESSION_HEADER,
  type BoxHttpTimings,
} from '../../src/lib/assistant/box-http.ts';

const TOKEN = 'a1'.repeat(32);
const OTHER_TOKEN = 'b2'.repeat(32);
const PASSWORDS = ['tulipe-melon-givre-sapin-42', 'cerise-tambour-nuage-plume-17'];

/** Ce que la HAKO simulée répond : code, corps JSON (ou texte brut), type. */
interface Answer {
  readonly status: number;
  readonly body?: unknown;
  readonly raw?: string;
  readonly type?: string;
}

/** Une requête reçue par la HAKO simulée. */
interface Call {
  readonly url: string;
  readonly init: RequestInit;
  readonly headers: Headers;
  readonly body: unknown;
}

/** HAKO simulée : chaque requête passe par handler ; les requêtes sont notées. */
function fakeBox(
  handler: (call: Call) => Answer | Promise<Answer>,
  timings: Partial<BoxHttpTimings> = {},
): { box: BoxHttpAccess; calls: Call[] } {
  const calls: Call[] = [];
  const box = new BoxHttpAccess({
    loginDomain: LOGIN_DOMAIN,
    timings,
    wait: () => Promise.resolve(),
    fetch: async (url, init) => {
      const call: Call = {
        url,
        init,
        headers: new Headers(init.headers),
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      };
      calls.push(call);
      const answer = await handler(call);
      return new Response(answer.raw ?? JSON.stringify(answer.body ?? {}), {
        status: answer.status,
        headers: { 'Content-Type': answer.type ?? 'application/json' },
      });
    },
  });
  return { box, calls };
}

/** Rejet avec ce code. */
const rejectedWith =
  (code: string) =>
  (error: unknown): boolean => {
    assert.ok(error instanceof BoxAccessError, String(error));
    assert.equal(error.code, code);
    return true;
  };

/** Réponse de register pour ces prénoms (identifiants de household.ts). */
const registered = (logins: readonly string[], token = TOKEN): Answer => ({
  status: 201,
  body: {
    token,
    accounts: logins.map((login, index) => ({
      firstName: ['Hélène', 'Marc'][index],
      login,
      owner: index === 0,
      password: PASSWORDS[index],
    })),
  },
});

const progress = (photos: string, files: string, finish: string): CreationProgress =>
  ({ photos, files, finish }) as CreationProgress;

describe('requêtes', () => {
  it('même origine, JSON, ni cookie, ni cache, ni redirection, ni référent', async () => {
    const { box, calls } = fakeBox((call) =>
      call.url.endsWith('register')
        ? registered(['helene@hako.local', 'marc@hako.local'])
        : { status: 200, body: { phase: 'ready', busy: false } },
    );
    await box.status();
    await box.register(['Hélène', 'Marc']);
    const [status, register] = calls;
    assert.equal(status?.url, `${API_BASE}status`);
    assert.equal(status?.init.method, 'GET');
    assert.equal(register?.url, `${API_BASE}register`);
    assert.equal(register?.init.method, 'POST');
    assert.equal(register?.headers.get('Content-Type'), 'application/json');
    assert.deepEqual(register?.body, { firstNames: ['Hélène', 'Marc'] });
    for (const call of calls) {
      assert.match(call.url, /^\/api\/installation\/[a-z]+$/u);
      assert.equal(call.headers.get('Accept'), 'application/json');
      assert.equal(call.init.credentials, 'omit');
      assert.equal(call.init.cache, 'no-store');
      assert.equal(call.init.redirect, 'error');
      assert.equal(call.init.referrerPolicy, 'no-referrer');
      assert.equal(call.init.mode, 'same-origin');
      assert.ok(call.init.signal instanceof AbortSignal);
    }
  });

  it('le jeton de session part en en-tête, seulement une fois reçu', async () => {
    const { box, calls } = fakeBox((call) =>
      call.url.endsWith('register')
        ? registered(['helene@hako.local'])
        : { status: 200, body: { result: 'wrong' } },
    );
    await box.checkSheet('tulipe-melon-givre-sapin-41');
    await box.register(['Hélène']);
    await box.checkSheet('tulipe-melon-givre-sapin-41');
    assert.equal(calls[0]?.headers.get(SESSION_HEADER), null);
    assert.equal(calls[1]?.headers.get(SESSION_HEADER), null);
    assert.equal(calls[2]?.headers.get(SESSION_HEADER), TOKEN);
    assert.deepEqual(calls[2]?.body, { typed: 'tulipe-melon-givre-sapin-41' });
  });

  it('requête trop grosse : rien n’est envoyé', async () => {
    const { box, calls } = fakeBox(() => ({ status: 200, body: { result: 'ok' } }));
    await assert.rejects(box.checkSheet('a'.repeat(MAX_BODY_BYTES)), rejectedWith('unexpected'));
    assert.equal(calls.length, 0);
  });
});

describe('état de la HAKO', () => {
  it('les cinq phases, l’installation en cours ailleurs, l’avancement', async () => {
    for (const body of [
      { phase: 'preparing', busy: false },
      { phase: 'ready', busy: false },
      { phase: 'registered', busy: true },
      { phase: 'installed', busy: false },
    ]) {
      const { box } = fakeBox(() => ({ status: 200, body }));
      assert.deepEqual(await box.status(), body);
    }
    const creating = {
      phase: 'creating',
      busy: true,
      progress: { photos: 'done', files: 'running', finish: 'waiting' },
    };
    assert.deepEqual(await fakeBox(() => ({ status: 200, body: creating })).box.status(), creating);
  });

  it('503 preparing : la HAKO se prépare', async () => {
    const { box } = fakeBox(() => ({ status: 503, body: { error: 'preparing' } }));
    assert.deepEqual(await box.status(), { phase: 'preparing', busy: false });
  });

  it('réponses illisibles : inattendues ; jamais « changed » pour l’état', async () => {
    for (const answer of [
      { status: 200, body: { phase: 'ready' } },
      { status: 200, body: { phase: 'installee', busy: false } },
      { status: 200, body: { phase: 'creating', busy: false, progress: { photos: 'ok' } } },
      { status: 200, body: ['ready'] },
      { status: 200, raw: '{"phase":' },
      { status: 200, raw: '<html></html>', type: 'text/html' },
      { status: 200, raw: JSON.stringify({ phase: 'ready', busy: false, x: 'é'.repeat(9000) }) },
      { status: 401, body: { error: 'no_session' } },
      { status: 418, body: {} },
    ] satisfies Answer[]) {
      const { box } = fakeBox(() => answer);
      await assert.rejects(box.status(), rejectedWith('unexpected'), JSON.stringify(answer));
    }
  });

  it('pas de réponse, délai dépassé, 502 ou 504 : injoignable', async () => {
    const offline = new BoxHttpAccess({
      loginDomain: LOGIN_DOMAIN,
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await assert.rejects(offline.status(), rejectedWith('unreachable'));
    const silent = new BoxHttpAccess({
      loginDomain: LOGIN_DOMAIN,
      timings: { request: 5 },
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('Délai dépassé', 'AbortError'));
          });
        }),
    });
    await assert.rejects(silent.status(), rejectedWith('unreachable'));
    for (const status of [502, 504]) {
      const { box } = fakeBox(() => ({ status, raw: 'Bad Gateway', type: 'text/html' }));
      await assert.rejects(box.status(), rejectedWith('unreachable'));
    }
  });
});

describe('comptes et mots de passe', () => {
  it('un compte par prénom, figé, avec les identifiants montrés par la page', async () => {
    const { box } = fakeBox(() => registered(['helene@hako.local', 'marc@hako.local']));
    const accounts = await box.register(['Hélène', 'Marc']);
    assert.deepEqual(accounts, [
      { firstName: 'Hélène', login: 'helene@hako.local', owner: true, password: PASSWORDS[0] },
      { firstName: 'Marc', login: 'marc@hako.local', owner: false, password: PASSWORDS[1] },
    ]);
    assert.ok(Object.isFrozen(accounts) && Object.isFrozen(accounts[0]));
  });

  it('installation en cours ailleurs : « busy » ; prénoms refusés : inattendu', async () => {
    const busy = fakeBox(() => ({ status: 409, body: { error: 'busy' } })).box;
    await assert.rejects(busy.register(['Hélène']), rejectedWith('busy'));
    const refused = fakeBox(() => ({ status: 400, body: { error: 'invalid_names' } })).box;
    await assert.rejects(refused.register(['Hélène']), rejectedWith('unexpected'));
  });

  it('réponse qui ne correspond pas : inattendue, et pas de session', async () => {
    const good = registered(['helene@hako.local', 'marc@hako.local']).body as {
      token: string;
      accounts: Record<string, unknown>[];
    };
    const variants: unknown[] = [
      { ...good, token: 'court' },
      { ...good, accounts: good.accounts.slice(0, 1) },
      {
        ...good,
        accounts: [{ ...good.accounts[0], login: 'helene2@hako.local' }, good.accounts[1]],
      },
      { ...good, accounts: [{ ...good.accounts[0], owner: false }, good.accounts[1]] },
      { ...good, accounts: [{ ...good.accounts[0], firstName: 'Helene' }, good.accounts[1]] },
      {
        ...good,
        accounts: [
          { ...good.accounts[0], password: 'Tulipe-melon-givre-sapin-42' },
          good.accounts[1],
        ],
      },
      {
        ...good,
        accounts: [{ ...good.accounts[0], password: 'tulipe-melon-givre-42' }, good.accounts[1]],
      },
      {
        ...good,
        accounts: [
          { ...good.accounts[0], password: 'tulipe-melon-givre-sapin-07' },
          good.accounts[1],
        ],
      },
    ];
    for (const body of variants) {
      const { box, calls } = fakeBox((call) =>
        call.url.endsWith('register')
          ? { status: 201, body }
          : { status: 200, body: { result: 'ok' } },
      );
      await assert.rejects(box.register(['Hélène', 'Marc']), rejectedWith('unexpected'));
      await box.checkSheet(PASSWORDS[0] ?? '');
      assert.equal(calls.at(-1)?.headers.get(SESSION_HEADER), null, JSON.stringify(body));
    }
  });
});

describe('vérification de la fiche', () => {
  it('ok ou faux ; 423 : plus aucun essai accepté', async () => {
    for (const result of ['ok', 'wrong'] as const) {
      const { box } = fakeBox(() => ({ status: 200, body: { result } }));
      assert.equal(await box.checkSheet(PASSWORDS[0] ?? ''), result);
    }
    const { box } = fakeBox(() => ({ status: 423, body: { error: 'too_many_wrong' } }));
    assert.equal(await box.checkSheet(PASSWORDS[0] ?? ''), 'blocked');
  });

  it('appareil sans session : la fiche reconnue lui donne la main', async () => {
    const { box, calls } = fakeBox((call) =>
      call.url.endsWith('check')
        ? { status: 200, body: { result: 'ok', token: OTHER_TOKEN } }
        : { status: 200, body: { phase: 'registered', busy: false } },
    );
    assert.equal(await box.checkSheet(PASSWORDS[0] ?? ''), 'ok');
    await box.status();
    assert.equal(calls.at(-1)?.headers.get(SESSION_HEADER), OTHER_TOKEN);
  });

  it('session perdue, autre phase, HAKO qui se prépare : « changed » ; autre appareil : « busy »', async () => {
    for (const [answer, code] of [
      [{ status: 401, body: { error: 'no_session' } }, 'changed'],
      [{ status: 409, body: { error: 'wrong_phase' } }, 'changed'],
      [{ status: 503, body: { error: 'preparing' } }, 'changed'],
      [{ status: 409, body: { error: 'busy' } }, 'busy'],
      [{ status: 409, body: { error: 'autre' } }, 'unexpected'],
      [{ status: 200, body: { result: 'peut-etre' } }, 'unexpected'],
      [{ status: 200, body: { result: 'ok', token: 42 } }, 'unexpected'],
    ] as const) {
      const { box } = fakeBox(() => answer);
      await assert.rejects(box.checkSheet(PASSWORDS[0] ?? ''), rejectedWith(code));
    }
  });
});

describe('création des comptes', () => {
  /** HAKO qui crée les comptes : après le 202, une suite de réponses d'état. */
  function creatingBox(
    statuses: readonly Answer[],
    timings: Partial<BoxHttpTimings> = {},
  ): { box: BoxHttpAccess; calls: Call[] } {
    let index = 0;
    return fakeBox((call) => {
      if (call.url.endsWith('accounts')) {
        return {
          status: 202,
          body: { progress: { photos: 'running', files: 'waiting', finish: 'waiting' } },
        };
      }
      const answer = statuses[Math.min(index, statuses.length - 1)] ?? { status: 500 };
      index += 1;
      return answer;
    }, timings);
  }
  const creating = (photos: string, files: string, finish: string): Answer => ({
    status: 200,
    body: { phase: 'creating', busy: false, progress: { photos, files, finish } },
  });
  const installed: Answer = { status: 200, body: { phase: 'installed', busy: false } };

  it('avancement suivi jusqu’à la fin, sans doublon', async () => {
    const { box, calls } = creatingBox([
      creating('running', 'waiting', 'waiting'),
      creating('done', 'running', 'waiting'),
      creating('done', 'running', 'waiting'),
      creating('done', 'done', 'running'),
      installed,
    ]);
    const seen: CreationProgress[] = [];
    await box.createAccounts((step) => seen.push(step));
    assert.deepEqual(seen, [
      progress('running', 'waiting', 'waiting'),
      progress('done', 'running', 'waiting'),
      progress('done', 'done', 'running'),
      progress('done', 'done', 'done'),
    ]);
    assert.equal(calls[0]?.url, `${API_BASE}accounts`);
    assert.deepEqual(calls[0]?.body, {});
  });

  it('page rouverte : la création déjà en cours est suivie', async () => {
    const { box, calls } = creatingBox([creating('done', 'done', 'running'), installed]);
    const seen: CreationProgress[] = [];
    await box.followCreation((step) => seen.push(step));
    assert.deepEqual(seen.at(-1), progress('done', 'done', 'done'));
    assert.ok(calls.every((call) => call.url === `${API_BASE}status`));
  });

  it('quelques réponses manquées sont tolérées, trop : création arrêtée', async () => {
    const gateway: Answer = { status: 502, raw: '', type: 'text/html' };
    const tolerant = creatingBox([gateway, gateway, installed], { pollFailures: 3 }).box;
    await tolerant.createAccounts(() => {});
    const lost = creatingBox([gateway], { pollFailures: 3 }).box;
    await assert.rejects(
      lost.createAccounts(() => {}),
      rejectedWith('interrupted'),
    );
  });

  it('revenue à « registered » ou à « ready » (coupure) : création arrêtée', async () => {
    for (const phase of ['registered', 'ready', 'preparing']) {
      const { box } = creatingBox([{ status: 200, body: { phase, busy: false } }]);
      await assert.rejects(
        box.createAccounts(() => {}),
        rejectedWith('interrupted'),
      );
    }
  });

  it('une création qui n’en finit pas est dite arrêtée', async () => {
    let clock = 0;
    const box = new BoxHttpAccess({
      loginDomain: LOGIN_DOMAIN,
      timings: { creation: 5_000 },
      now: () => clock,
      wait: (ms) => {
        clock += ms;
        return Promise.resolve();
      },
      fetch: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              phase: 'creating',
              busy: false,
              progress: { photos: 'running', files: 'waiting', finish: 'waiting' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    });
    await assert.rejects(
      box.followCreation(() => {}),
      rejectedWith('interrupted'),
    );
    assert.ok(clock > 5_000 && clock < 8_000, `${clock} ms`);
  });

  it('création refusée : session perdue, ou un autre appareil a la main', async () => {
    const lost = fakeBox(() => ({ status: 401, body: { error: 'no_session' } })).box;
    await assert.rejects(
      lost.createAccounts(() => {}),
      rejectedWith('changed'),
    );
    const busy = fakeBox(() => ({ status: 409, body: { error: 'busy' } })).box;
    await assert.rejects(
      busy.createAccounts(() => {}),
      rejectedWith('busy'),
    );
  });
});
