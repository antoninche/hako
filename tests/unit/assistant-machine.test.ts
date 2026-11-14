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
 * - Phases de la HAKO et cas difficiles (décisions du lot 5) : installation
 *   en cours ailleurs (page rouverte, deuxième appareil), fiche qui donne la
 *   main, « Recommencer » accepté ou refusé, création suivie après la page
 *   rouverte, coupure de courant (nouveaux mots de passe), HAKO qui n'est
 *   plus où la page la croyait, plus aucun essai accepté.
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

const ready: AssistantEvent = { type: 'status', status: { phase: 'ready', busy: false } };
const status = (
  phase: 'preparing' | 'ready' | 'registered' | 'creating' | 'installed',
  busy = false,
): AssistantEvent => ({ type: 'status', status: { phase, busy } });
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
    assert.equal(play([status('installed')]).state.view, 'installed');
    const preparing = play([status('preparing')]).state;
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
      status('installed'),
      { type: 'retry' },
      { type: 'start-over' },
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

  it('création arrêtée : « Réessayer » demande l’état, puis la reprend', () => {
    const stopped = play([
      ...toChecked,
      { type: 'create' },
      { type: 'failed', code: 'interrupted' },
    ]).state;
    assert.equal(stopped.view, 'stopped');
    assert.notEqual(stopped.accounts, null, 'la fiche reste celle-ci');
    const retry = transition(stopped, { type: 'retry' });
    assert.equal(retry.state.view, 'stopped');
    assert.deepEqual(retry.effects, [{ type: 'read-status' }]);
    // Les mots de passe sont toujours là, et cette page a la main : la création repart.
    const again = transition(retry.state, status('registered'));
    assert.equal(again.state.view, 'accounts');
    assert.deepEqual(again.effects, [{ type: 'create-accounts' }]);
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
    // Elle répond : mots de passe toujours là, cette page a la main.
    const retried = play([{ type: 'retry' }, status('registered')], lost).state;
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

describe('phases de la HAKO et cas difficiles', () => {
  const stopped = play([
    ...toChecked,
    { type: 'create' },
    { type: 'failed', code: 'interrupted' },
  ]).state;
  const retried = transition(stopped, { type: 'retry' }).state;

  it('page rouverte ou deuxième appareil : installation en cours ailleurs, sans mots de passe', () => {
    const { state, effects } = play([status('registered', true)]);
    assert.equal(state.view, 'elsewhere');
    assert.equal(state.accounts, null);
    assert.equal(state.replacing, true);
    assert.equal(state.refused, false);
    assert.deepEqual(effects, []);
    assert.equal(canCreate(state), false);
    // Aucun écran du parcours qui montrerait des mots de passe.
    for (const view of ['passwords', 'sheet', 'check', 'accounts', 'ready'] as const) {
      assert.equal(canShow(state, view), false, view);
    }
  });

  it('la fiche donne la main : « Créer les comptes », puis « C’est prêt »', () => {
    const elsewhere = play([status('registered', true)]).state;
    // Refus sur l'appareil, sans demande à la HAKO.
    const local = transition(elsewhere, { type: 'submit-check', typed: '' });
    assert.equal(local.state.checkError, 'empty');
    assert.deepEqual(local.effects, []);
    const asked = transition(elsewhere, { type: 'submit-check', typed: 'tulipe-a-b-c-42' });
    assert.deepEqual(asked.effects, [{ type: 'check', typed: 'tulipe-a-b-c-42' }]);
    const checked = transition(asked.state, { type: 'checked', result: 'ok' }).state;
    assert.equal(checked.view, 'elsewhere');
    assert.equal(checked.checked, true);
    assert.ok(canCreate(checked));
    assert.equal(
      transition(checked, { type: 'start-over' }).state,
      checked,
      'plus de « Recommencer »',
    );
    const creating = transition(checked, { type: 'create' });
    assert.equal(creating.state.view, 'accounts');
    assert.deepEqual(creating.effects, [{ type: 'create-accounts' }]);
    const done = transition(creating.state, { type: 'created' });
    assert.equal(done.state.view, 'ready');
    assert.equal(done.state.created, true);
  });

  it('« Recommencer » : les prénoms, puis de nouveaux mots de passe ; la fiche d’avant ne vaut plus', () => {
    const elsewhere = play([status('registered', true)]).state;
    const people = transition(elsewhere, { type: 'start-over' }).state;
    assert.equal(people.view, 'people');
    const passwords = play(
      [
        { type: 'submit-people', firstNames: ['Hélène', 'Marc'] },
        { type: 'registered', accounts: ACCOUNTS },
      ],
      people,
    ).state;
    assert.equal(passwords.view, 'passwords');
    assert.equal(passwords.renewed, true);
    assert.equal(passwords.replacing, false);
  });

  it('« Recommencer » refusé : un autre appareil a encore la main', () => {
    const people = play([status('registered', true), { type: 'start-over' }]).state;
    const refused = play(
      [
        { type: 'submit-people', firstNames: ['Hélène'] },
        { type: 'failed', code: 'busy' },
      ],
      people,
    ).state;
    assert.equal(refused.view, 'elsewhere');
    assert.equal(refused.refused, true);
    // Deux appareils ouverts en même temps : le second voit l'installation en cours, sans refus.
    const second = play([
      ready,
      { type: 'start' },
      { type: 'submit-people', firstNames: ['Léa'] },
      { type: 'failed', code: 'busy' },
    ]).state;
    assert.equal(second.view, 'elsewhere');
    assert.equal(second.refused, false);
  });

  it('la main passée à un autre appareil : la page oublie ses mots de passe', () => {
    const atCheck = play([
      ...toPasswords,
      { type: 'go', view: 'sheet' },
      { type: 'go', view: 'check' },
    ]).state;
    const lost = play(
      [
        { type: 'submit-check', typed: 'exemple-a-b-c-00' },
        { type: 'failed', code: 'changed' },
      ],
      atCheck,
    );
    assert.deepEqual(lost.effects.at(-1), { type: 'read-status' });
    const result = transition(lost.state, status('registered', true));
    assert.equal(result.state.view, 'elsewhere');
    assert.equal(result.state.accounts, null);
    assert.deepEqual(result.effects, [{ type: 'forget-secrets' }]);
  });

  it('page rouverte pendant la création : la page la suit jusqu’à la fin', () => {
    const progress = { photos: 'done', files: 'running', finish: 'waiting' } as const;
    const following = transition(initial().state, {
      type: 'status',
      status: { phase: 'creating', busy: true, progress },
    });
    assert.equal(following.state.view, 'accounts');
    assert.equal(following.state.busy, 'create');
    assert.deepEqual(following.state.progress, progress);
    assert.deepEqual(following.effects, [{ type: 'follow-creation' }]);
    const done = transition(following.state, { type: 'created' }).state;
    assert.equal(done.view, 'ready');
    assert.equal(stepsDone(done), 5);
  });

  it('coupure de courant : nouveaux mots de passe pour les mêmes prénoms, fiche à refaire', () => {
    const renew = transition(retried, ready);
    assert.deepEqual(renew.effects, [{ type: 'register', firstNames: ['Hélène', 'Marc'] }]);
    const renewed = transition(renew.state, { type: 'registered', accounts: ACCOUNTS }).state;
    assert.equal(renewed.view, 'passwords');
    assert.equal(renewed.renewed, true);
    assert.equal(renewed.checked, false);
    assert.equal(canCreate(renewed), false, 'la nouvelle fiche est à vérifier');
  });

  it('création arrêtée, puis toujours en cours, ou finie', () => {
    const creating = transition(retried, status('creating'));
    assert.equal(creating.state.view, 'accounts');
    assert.deepEqual(creating.effects, [{ type: 'follow-creation' }]);
    const finished = transition(retried, status('installed'));
    assert.equal(finished.state.view, 'ready');
    assert.equal(finished.state.accounts, null);
    assert.deepEqual(finished.effects, [{ type: 'forget-secrets' }]);
  });

  it('installée par un autre appareil : la page oublie ses mots de passe', () => {
    const passwords = play([...toPasswords, { type: 'recheck' }]).state;
    const result = transition(passwords, status('installed'));
    assert.equal(result.state.view, 'installed');
    assert.equal(result.state.accounts, null);
    assert.deepEqual(result.effects, [{ type: 'forget-secrets' }]);
  });

  it('HAKO qui n’est plus où la page la croyait : jamais de demande d’état en boucle', () => {
    const asked = transition(initial().state, { type: 'failed', code: 'changed' });
    assert.equal(asked.state.view, 'unexpected');
    assert.deepEqual(asked.effects, []);
  });

  it('erreur pendant la vérification ailleurs : « Réessayer » ramène à cet écran', () => {
    const elsewhere = play([status('registered', true)]).state;
    const lost = play(
      [
        { type: 'submit-check', typed: 'tulipe-a-b-c-42' },
        { type: 'failed', code: 'unreachable' },
      ],
      elsewhere,
    ).state;
    assert.equal(lost.view, 'unreachable');
    assert.equal(lost.resume, 'elsewhere');
    const retry = transition(lost, { type: 'retry' });
    assert.equal(retry.state.view, 'elsewhere');
    assert.deepEqual(retry.effects, [{ type: 'check', typed: 'tulipe-a-b-c-42' }]);
  });

  it('plus aucun essai accepté par la HAKO : son message à lui', () => {
    const atCheck = play([
      ...toPasswords,
      { type: 'go', view: 'sheet' },
      { type: 'go', view: 'check' },
    ]).state;
    const blocked = play(
      [
        { type: 'submit-check', typed: 'exemple-x-y-z-00' },
        { type: 'checked', result: 'blocked' },
      ],
      atCheck,
    ).state;
    assert.equal(blocked.checkError, 'blocked');
    assert.equal(blocked.checked, false);
  });
});
