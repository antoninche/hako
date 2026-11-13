/**
 * Page de la HAKO, première installation : la machine à états des écrans
 * (src/lib/assistant/machine.ts).
 *
 * - Le parcours dans l'ordre : accueil, personnes, mots de passe, fiche,
 *   vérification, création des comptes, « C'est prêt ».
 * - Ce qui ne doit jamais arriver : comptes créés sans fiche vérifiée, double
 *   envoi pendant une demande à la HAKO, écran ouvert sans ce qu'il montre,
 *   mots de passe gardés après la création des comptes.
 * - Écrans d'attente et d'erreur : « Réessayer » rejoue ce qui a échoué, puis
 *   revient là où l'on était.
 * - Ancres des écrans dans l'adresse (#ecran-personnes).
 *
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NOTHING_DONE, type Account } from '../../src/lib/assistant/box-access.ts';
import {
  NUMBERED_SCREENS,
  SCREEN_IDS,
  STATE_IDS,
  canCreate,
  canShow,
  initial,
  stepNumber,
  stepsDone,
  transition,
  viewAnchor,
  viewFromHash,
  type AssistantEvent,
  type AssistantState,
  type Effect,
} from '../../src/lib/assistant/machine.ts';

const ACCOUNTS: readonly Account[] = [
  { firstName: 'Hélène', login: 'helene@hako.local', owner: true, password: 'exemple-a-b-c-00' },
  { firstName: 'Marc', login: 'marc@hako.local', owner: false, password: 'exemple-d-e-f-00' },
];

/** Enchaîne des événements ; renvoie l'état final et tous les effets demandés. */
function play(
  events: readonly AssistantEvent[],
  start: AssistantState = initial().state,
): { state: AssistantState; effects: Effect[] } {
  let state = start;
  const effects: Effect[] = [];
  for (const event of events) {
    const result = transition(state, event);
    state = result.state;
    effects.push(...result.effects);
  }
  return { state, effects };
}

const ready: AssistantEvent = { type: 'status', status: { phase: 'ready' } };
const toPasswords: AssistantEvent[] = [
  ready,
  { type: 'start' },
  { type: 'submit-people', firstNames: ['Hélène', 'Marc'] },
  { type: 'registered', accounts: ACCOUNTS },
];
const toChecked: AssistantEvent[] = [
  ...toPasswords,
  { type: 'go', view: 'sheet' },
  { type: 'go', view: 'check' },
  { type: 'submit-check', typed: 'exemple-a-b-c-00' },
  { type: 'checked', result: 'ok' },
];

describe('ouverture', () => {
  it('l’accueil, pendant que la page demande son état à la HAKO', () => {
    const { state, effects } = initial();
    assert.equal(state.view, 'welcome');
    assert.equal(state.busy, 'status');
    assert.deepEqual(effects, [{ type: 'read-status' }]);
    // « Commencer » attend la réponse.
    assert.equal(transition(state, { type: 'start' }).state.view, 'welcome');
  });

  it('HAKO prête : l’accueil ; qui se prépare : l’écran d’attente ; déjà installée : son écran', () => {
    assert.equal(play([ready]).state.view, 'welcome');
    assert.equal(
      play([{ type: 'status', status: { phase: 'installed' } }]).state.view,
      'installed',
    );
    const preparing = play([{ type: 'status', status: { phase: 'preparing' } }]).state;
    assert.equal(preparing.view, 'preparing');
    // « Recharger la page » : la page redemande, puis revient à l'accueil.
    const again = transition(preparing, { type: 'retry' });
    assert.deepEqual(again.effects, [{ type: 'read-status' }]);
    assert.equal(transition(again.state, ready).state.view, 'welcome');
  });
});

describe('le parcours', () => {
  it('dans l’ordre, jusqu’à « C’est prêt », sans garder les mots de passe', () => {
    const people = play([ready, { type: 'start' }]);
    assert.equal(people.state.view, 'people');

    const asked = transition(people.state, {
      type: 'submit-people',
      firstNames: ['Hélène', 'Marc'],
    });
    assert.equal(asked.state.busy, 'register');
    assert.deepEqual(asked.effects, [{ type: 'register', firstNames: ['Hélène', 'Marc'] }]);

    const passwords = play(toPasswords).state;
    assert.equal(passwords.view, 'passwords');
    assert.deepEqual(passwords.accounts, ACCOUNTS);

    const checked = play(toChecked);
    assert.equal(checked.state.view, 'check');
    assert.equal(checked.state.checked, true);
    assert.ok(canCreate(checked.state));

    const creating = transition(checked.state, { type: 'create' });
    assert.equal(creating.state.view, 'accounts');
    assert.deepEqual(creating.effects, [{ type: 'create-accounts' }]);
    const progress = { photos: 'done', files: 'running', finish: 'waiting' } as const;
    const moving = transition(creating.state, { type: 'progress', progress }).state;
    assert.deepEqual(moving.progress, progress);

    const done = transition(moving, { type: 'created' });
    assert.equal(done.state.view, 'ready');
    assert.equal(done.state.created, true);
    assert.equal(done.state.accounts, null, 'mots de passe oubliés');
    assert.deepEqual(done.effects, [{ type: 'forget-secrets' }]);
  });

  it('les mots de passe ne sont connus qu’entre la remise et la création', () => {
    assert.equal(play([ready, { type: 'start' }]).state.accounts, null);
    assert.notEqual(play(toPasswords).state.accounts, null);
    const end = play([...toChecked, { type: 'create' }, { type: 'created' }]).state;
    assert.equal(end.accounts, null);
  });

  it('boutons « Retour » : les écrans déjà vus, avec leurs données', () => {
    const passwords = play(toPasswords).state;
    const back = transition(passwords, { type: 'go', view: 'people' }).state;
    assert.equal(back.view, 'people');
    assert.deepEqual(back.accounts, ACCOUNTS);
    // De nouveaux prénoms : de nouveaux comptes, une fiche à refaire et à vérifier.
    const again = play(
      [
        { type: 'submit-people', firstNames: ['Léa'] },
        { type: 'registered', accounts: [ACCOUNTS[0] as Account] },
      ],
      play([...toChecked, { type: 'go', view: 'people' }]).state,
    ).state;
    assert.equal(again.view, 'passwords');
    assert.equal(again.checked, false);
    // Nouveaux mots de passe : la page dit que la fiche déjà faite ne vaut plus.
    assert.equal(again.renewed, true);
    assert.equal(play(toPasswords).state.renewed, false);
  });

  it('revenu aux prénoms sans rien changer : les mêmes mots de passe, rien n’est demandé', () => {
    const checked = play([...toChecked, { type: 'go', view: 'people' }]).state;
    const same = transition(checked, { type: 'submit-people', firstNames: ['Hélène', 'Marc'] });
    assert.equal(same.state.view, 'passwords');
    assert.deepEqual(same.effects, []);
    assert.equal(same.state.accounts, checked.accounts);
    assert.equal(same.state.renewed, false);
    // Un autre ordre, c'est une autre liste : les comptes sont redemandés.
    const swapped = transition(checked, { type: 'submit-people', firstNames: ['Marc', 'Hélène'] });
    assert.equal(swapped.effects[0]?.type, 'register');
  });
});

describe('ce qui ne doit jamais arriver', () => {
  it('aucun écran sans ce qu’il montre', () => {
    const start = play([ready]).state;
    for (const view of ['passwords', 'sheet', 'check', 'accounts', 'ready'] as const) {
      assert.equal(canShow(start, view), false, view);
      assert.equal(transition(start, { type: 'go', view }).state.view, 'welcome', view);
    }
    for (const state of STATE_IDS) assert.equal(canShow(start, state), false, state);
  });

  it('pas de création des comptes sans la fiche vérifiée', () => {
    const passwords = play(toPasswords).state;
    assert.equal(canCreate(passwords), false);
    const atCheck = play(
      [
        { type: 'go', view: 'sheet' },
        { type: 'go', view: 'check' },
      ],
      passwords,
    );
    assert.equal(transition(atCheck.state, { type: 'create' }).state.view, 'check');
    assert.deepEqual(transition(atCheck.state, { type: 'create' }).effects, []);
  });

  it('pas de double envoi pendant une demande à la HAKO', () => {
    const people = play([ready, { type: 'start' }]).state;
    const asked = transition(people, { type: 'submit-people', firstNames: ['Hélène'] }).state;
    const twice = transition(asked, { type: 'submit-people', firstNames: ['Hélène'] });
    assert.equal(twice.state, asked);
    assert.deepEqual(twice.effects, []);
    assert.equal(transition(asked, { type: 'go', view: 'welcome' }).state, asked);
  });

  it('un événement inattendu ne change rien', () => {
    const passwords = play(toPasswords).state;
    for (const event of [
      { type: 'created' },
      { type: 'checked', result: 'ok' },
      { type: 'registered', accounts: ACCOUNTS },
      { type: 'progress', progress: NOTHING_DONE },
      { type: 'failed', code: 'unreachable' },
      { type: 'status', status: { phase: 'installed' } },
      { type: 'retry' },
      { type: 'start' },
    ] as const satisfies readonly AssistantEvent[]) {
      const result = transition(passwords, event);
      assert.equal(result.state, passwords, event.type);
      assert.deepEqual(result.effects, [], event.type);
    }
  });

  it('une fois installée, plus de retour en arrière', () => {
    const end = play([...toChecked, { type: 'create' }, { type: 'created' }]).state;
    for (const view of SCREEN_IDS.filter((id) => id !== 'ready')) {
      assert.equal(canShow(end, view), false, view);
    }
    assert.equal(canShow(end, 'ready'), true);
  });
});

describe('vérification de la fiche', () => {
  const atCheck = play([
    ...toPasswords,
    { type: 'go', view: 'sheet' },
    { type: 'go', view: 'check' },
  ]).state;

  it('champ vide, majuscule, espace, signe : refusés sur l’appareil, sans compter d’essai', () => {
    for (const [typed, error] of [
      ['', 'empty'],
      ['Exemple-a-b-c-00', 'uppercase'],
      ['exemple a', 'space'],
      ['exemple-a-b-c-àà', 'character'],
    ] as const) {
      const result = transition(atCheck, { type: 'submit-check', typed });
      assert.equal(result.state.checkError, error);
      assert.equal(result.state.wrongAttempts, 0);
      assert.deepEqual(result.effects, []);
    }
  });

  it('trois essais faux : proposer de revoir les mots de passe', () => {
    const wrong = (state: AssistantState): AssistantState =>
      play(
        [
          { type: 'submit-check', typed: 'exemple-x-y-z-00' },
          { type: 'checked', result: 'wrong' },
        ],
        state,
      ).state;
    const once = wrong(atCheck);
    assert.equal(once.checkError, 'wrong');
    assert.equal(wrong(wrong(once)).checkError, 'again');
    assert.equal(wrong(wrong(once)).checked, false);
  });
});

describe('écrans d’attente et d’erreur', () => {
  it('HAKO injoignable pendant la remise des comptes : « Réessayer » la redemande', () => {
    const people = play([ready, { type: 'start' }]).state;
    const failed = play(
      [
        { type: 'submit-people', firstNames: ['Hélène'] },
        { type: 'failed', code: 'unreachable' },
      ],
      people,
    ).state;
    assert.equal(failed.view, 'unreachable');
    assert.equal(failed.resume, 'people');
    const retry = transition(failed, { type: 'retry' });
    assert.equal(retry.state.view, 'people');
    assert.equal(retry.state.busy, 'register');
    assert.deepEqual(retry.effects, [{ type: 'register', firstNames: ['Hélène'] }]);
  });

  it('réponse inattendue : son écran à elle', () => {
    const people = play([ready, { type: 'start' }]).state;
    const failed = play(
      [
        { type: 'submit-people', firstNames: ['Hélène'] },
        { type: 'failed', code: 'unexpected' },
      ],
      people,
    ).state;
    assert.equal(failed.view, 'unexpected');
  });

  it('création arrêtée : « Réessayer » la reprend', () => {
    const stopped = play([
      ...toChecked,
      { type: 'create' },
      { type: 'failed', code: 'interrupted' },
    ]).state;
    assert.equal(stopped.view, 'stopped');
    assert.notEqual(stopped.accounts, null, 'la fiche reste celle-ci');
    const retry = transition(stopped, { type: 'retry' });
    assert.equal(retry.state.view, 'accounts');
    assert.deepEqual(retry.effects, [{ type: 'create-accounts' }]);
  });

  it('démonstration : un écran montré, puis retour là où l’on était', () => {
    const passwords = play(toPasswords).state;
    const shown = transition(passwords, { type: 'show-state', state: 'unexpected' }).state;
    assert.equal(shown.view, 'unexpected');
    const back = transition(shown, { type: 'retry' });
    assert.equal(back.state.view, 'passwords');
    assert.deepEqual(back.effects, []);
    // HAKO qui ne répond plus : la page redemande son état, puis revient.
    const asked = transition(passwords, { type: 'recheck' });
    assert.deepEqual(asked.effects, [{ type: 'read-status' }]);
    const lost = transition(asked.state, { type: 'failed', code: 'unreachable' }).state;
    assert.equal(lost.view, 'unreachable');
    const retried = play([{ type: 'retry' }, ready], lost).state;
    assert.equal(retried.view, 'passwords');
  });
});

describe('indicateur d’étapes et ancres', () => {
  it('cinq étapes numérotées', () => {
    assert.deepEqual(NUMBERED_SCREENS, ['people', 'passwords', 'sheet', 'check', 'accounts']);
    assert.equal(stepNumber('welcome'), null);
    assert.equal(stepNumber('people'), 1);
    assert.equal(stepNumber('accounts'), 5);
    assert.equal(stepsDone(play(toPasswords).state), 1);
    const created: AssistantEvent[] = [...toChecked, { type: 'create' }, { type: 'created' }];
    assert.equal(stepsDone(play(created).state), 5);
    // « La création des comptes s’est arrêtée » : l’écran des comptes reste en
    // cours, même montré après « C’est prêt » (« Voir un autre écran »).
    const stopped: AssistantEvent = { type: 'show-state', state: 'stopped' };
    assert.equal(stepsDone(play([...toChecked, stopped]).state), 4);
    const shownAfterReady = play([...created, stopped]).state;
    assert.equal(shownAfterReady.view, 'stopped');
    assert.equal(stepsDone(shownAfterReady), 4);
  });

  it('#ecran-… : écrire et relire', () => {
    for (const view of [...SCREEN_IDS, ...STATE_IDS]) {
      assert.match(viewAnchor(view), /^ecran-[a-z-]+$/u);
      assert.equal(viewFromHash(`#${viewAnchor(view)}`), view);
    }
    assert.equal(viewAnchor('people'), 'ecran-personnes');
    for (const hash of ['', '#', '#contenu', '#ecran-', '#ecran-inconnu', '#%E0%A4%A']) {
      assert.equal(viewFromHash(hash), null, hash);
    }
  });
});
