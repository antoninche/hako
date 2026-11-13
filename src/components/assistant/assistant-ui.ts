/**
 * Comportement de la page de la HAKO qui fait la première installation
 * (voir Assistant.astro), le même en démonstration et, plus tard, sur la
 * vraie HAKO. Seul change l'accès à la HAKO, choisi par le <script> de la
 * page (createAccess) : la HAKO simulée sur le site, l'API locale de la HAKO
 * sur la HAKO (lot 3).
 *
 * - La machine à états (src/lib/assistant/machine.ts) dit quel écran
 *   montrer et quoi demander à la HAKO ; ce script affiche, et fait les
 *   demandes.
 * - Un écran à la fois. Chaque changement d'écran ajoute une entrée à
 *   l'historique (#ecran-personnes), numérotée (rang) : le bouton « Retour »
 *   du navigateur ramène à l'écran d'avant, quand il peut encore s'afficher.
 *   Une fois les comptes créés, aucun écran d'avant ne le peut : un seul
 *   appui sur « Retour » quitte la page, vers celle d'où l'on venait (le
 *   guide). Le titre du nouvel écran reçoit le focus, et la page défile
 *   jusqu'à lui, en douceur sauf si l'appareil demande moins d'animations.
 * - Les liens vers le site s'ouvrent dans un nouvel onglet, suivis de « (s'ouvre
 *   dans un nouvel onglet) » : quitter la page effacerait l'installation en
 *   cours. Seuls ceux marqués data-same-tab (retour au guide sur « C'est
 *   prêt ») restent dans le même onglet. Sur la HAKO, data-site-url leur
 *   donne l'adresse complète du site, et warnBeforeLeaving fait demander
 *   confirmation au navigateur avant de quitter, tant que des mots de passe
 *   sont affichés.
 * - Les prénoms : une ligne par personne (gabarit <template>), ajout et
 *   retrait avec le bon focus, identifiant de chaque personne sous son
 *   prénom (et pourquoi il a reçu un chiffre), erreurs reliées à chaque champ
 *   et résumées en haut du formulaire.
 * - Les mots de passe ne vivent que dans la mémoire de la page et dans ses
 *   cartes, jusqu'à la création des comptes ; ils sont alors effacés.
 * - Annonces polies et mesurées (zone role="status") : chaque ligne de la
 *   création terminée, la fiche vérifiée ou refusée, la fin ; jamais de
 *   pourcentage.
 * - Impression : window.print() ; la feuille d'impression ne garde que la
 *   fiche de secours. Pendant l'impression, le titre de la page devient le
 *   nom proposé pour le fichier PDF (« Fiche de secours HAKO »).
 * - Démonstration : « Recommencer », prénoms et mot de passe d'exemple,
 *   « Voir un autre écran ».
 *
 * Ce script n'écrit aucun texte : il les lit dans la page (attributs data-*,
 * gabarits <template>) et les pose avec textContent. Il ne fait aucune
 * requête lui-même, ne contient aucune adresse et ne garde rien sur
 * l'appareil (ni stockage, ni cookie).
 */
import {
  TASK_IDS,
  errorCode,
  isSimulated,
  type Account,
  type BoxAccess,
  type CreationProgress,
  type TaskId,
} from '../../lib/assistant/box-access.ts';
import {
  assignLogins,
  checkPeople,
  cleanFirstName,
  elides,
  firstNameError,
  loginChunks,
  passwordChunks,
  takenBy,
  type PeopleErrorCode,
  type PersonError,
} from '../../lib/assistant/household.ts';
import {
  STATE_IDS,
  canCreate,
  canShow,
  initial,
  isScreen,
  stepNumber,
  stepsDone,
  transition,
  viewAnchor,
  viewFromHash,
  type AssistantEvent,
  type AssistantState,
  type Effect,
  type ScreenId,
  type StateId,
  type ViewId,
} from '../../lib/assistant/machine.ts';
import { fillTemplate } from '../../lib/installation/guide-state.ts';

/** Faits écrits dans la page (attributs data-* d'Assistant.astro). */
export interface AssistantFacts {
  readonly maxPeople: number;
  readonly firstNameMaxLength: number;
  readonly loginDomain: string;
  /** Démonstration : prénoms et mots de passe d'exemple. */
  readonly exampleNames: readonly string[];
  readonly examplePasswords: readonly string[];
}

export interface AssistantController {
  /** Remet tout à zéro, avec un nouvel accès à la HAKO (démonstration). */
  restart(): void;
}

export interface AssistantOptions {
  /**
   * Sur la vraie HAKO : le navigateur demande confirmation avant de quitter
   * la page tant que des mots de passe sont affichés ou que les comptes se
   * créent. Jamais en démonstration.
   */
  readonly warnBeforeLeaving?: boolean;
}

function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Page de la HAKO : élément introuvable (${what}).`);
  }
  return value;
}

/** Liste de textes écrite en JSON dans un attribut data-* ; liste vide sinon. */
function stringList(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function positiveNumber(value: string | undefined, what: string): number {
  const number = Number.parseInt(value ?? '', 10);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`Page de la HAKO : valeur manquante (${what}).`);
  }
  return number;
}

/** Lit les faits écrits dans la page. */
export function readFacts(root: HTMLElement): AssistantFacts {
  const data = root.dataset;
  return {
    maxPeople: positiveNumber(data['maxPeople'], 'data-max-people'),
    firstNameMaxLength: positiveNumber(data['firstNameMax'], 'data-first-name-max'),
    loginDomain: must(data['loginDomain'], 'data-login-domain'),
    exampleNames: stringList(data['exampleNames']),
    examplePasswords: stringList(data['examplePasswords']),
  };
}

/** Vrai si l'appareil demande moins d'animations. */
function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Attribut data-* qui porte le message de chaque refus d'un prénom. */
const PEOPLE_MESSAGES: Readonly<Record<PeopleErrorCode, string>> = {
  ownerMissing: 'msgOwnerMissing',
  missing: 'msgMissing',
  tooLong: 'msgTooLong',
  characters: 'msgCharacters',
};

/** Espacement des annonces, pour que les lecteurs d'écran les lisent toutes. */
const ANNOUNCE_SPACING_MS = 1000;

/** Rang d'une entrée de l'historique ajoutée par la page, ou null (entrée d'ailleurs). */
function rankOf(historyState: unknown): number | null {
  if (typeof historyState !== 'object' || historyState === null) return null;
  const rank = (historyState as { hakoRang?: unknown }).hakoRang;
  return typeof rank === 'number' && Number.isInteger(rank) ? rank : null;
}

/** Remplit un élément avec des morceaux mis bout à bout, coupables seulement entre deux. */
function setChunks(element: HTMLElement, chunks: readonly string[], keepFirst: boolean): void {
  element.replaceChildren(
    ...chunks.flatMap((chunk, index) => {
      const piece = document.createElement('span');
      piece.textContent = chunk;
      if (index > 0 || keepFirst) piece.className = 'nowrap';
      return index === 0 ? [piece] : [document.createElement('wbr'), piece];
    }),
  );
}

export function initAssistant(
  root: HTMLElement,
  createAccess: () => BoxAccess,
  options: AssistantOptions = {},
): AssistantController {
  const find = <T extends Element>(selector: string, scope: ParentNode = root): T =>
    must(scope.querySelector<T>(selector), selector);

  const facts = readFacts(root);

  // ------------------------------------------------------------- éléments

  const screens = new Map<ViewId, HTMLElement>();
  for (const section of root.querySelectorAll<HTMLElement>('[data-screen]')) {
    screens.set(section.dataset['screen'] as ViewId, section);
  }
  const screenOf = (view: ViewId): HTMLElement => must(screens.get(view), `écran ${view}`);
  const announcer = find<HTMLElement>('[data-announcer]');
  /** « de Marc », « d'Hélène » : textes lus dans la page. */
  const ofName = (firstName: string): string =>
    fillTemplate(
      (elides(firstName) ? root.dataset['ofVowel'] : root.dataset['ofConsonant']) ?? '',
      { prenom: firstName },
    );

  const indicator = find<HTMLElement>('[data-steps]');
  const indicatorItems = [...indicator.querySelectorAll<HTMLElement>('[data-step-indicator]')];

  // Les personnes.
  const peopleForm = find<HTMLFormElement>('[data-people-form]');
  const peopleList = find<HTMLElement>('[data-people-list]', peopleForm);
  const personTemplate = find<HTMLTemplateElement>('template[data-person-template]');
  const addButton = find<HTMLButtonElement>('[data-action="add-person"]', peopleForm);
  const fullNote = find<HTMLElement>('[data-people-full]', peopleForm);
  const summary = find<HTMLElement>('[data-error-summary]', peopleForm);
  const summaryTitle = find<HTMLElement>('[data-error-summary-title]', summary);
  const summaryList = find<HTMLElement>('[data-error-summary-list]', summary);
  const peopleSubmit = find<HTMLButtonElement>(`button[type="submit"][form="${peopleForm.id}"]`);
  const peopleRenew = find<HTMLElement>('[data-people-renew]');
  const startButton = find<HTMLButtonElement>('[data-action="start"]');

  // Les comptes et la fiche.
  const passwordsRenewed = find<HTMLElement>('[data-passwords-renewed]');
  const accountsList = find<HTMLElement>('[data-accounts]');
  const accountTemplate = find<HTMLTemplateElement>('template[data-account-template]');
  const printout = find<HTMLElement>('[data-printout]');
  const printoutRows = find<HTMLElement>('[data-printout-rows]', printout);
  const rowTemplate = find<HTMLTemplateElement>('template[data-printout-row-template]');
  const printed = find<HTMLElement>('[data-printed]');

  // La vérification.
  const checkForm = find<HTMLFormElement>('[data-check-form]');
  const checkInput = find<HTMLInputElement>('[data-check-input]', checkForm);
  const checkLabel = find<HTMLElement>('[data-check-label]', checkForm);
  const checkError = find<HTMLElement>('[data-check-error]', checkForm);
  const checkShow = find<HTMLInputElement>('[data-check-show]', checkForm);
  const checkSubmit = find<HTMLButtonElement>('[data-check-submit]', checkForm);
  const checkSuccess = find<HTMLElement>('[data-check-success]');
  const checkCreate = find<HTMLButtonElement>('[data-check-create]');

  // La création des comptes, et la fin.
  const tasksList = find<HTMLElement>('[data-tasks]');
  const taskItems = new Map<TaskId, HTMLElement>(
    TASK_IDS.map((id) => [id, find<HTMLElement>(`[data-task="${id}"]`, tasksList)]),
  );
  const readyDone = find<HTMLElement>('[data-ready-done]').dataset['readyDone'] ?? '';

  let access = createAccess();
  /** Change à chaque « Recommencer » : les réponses de l'ancien accès sont ignorées. */
  let generation = 0;
  let state: AssistantState = initial().state;
  let rowCount = 0;
  /** Rang, dans l'historique, de l'entrée où l'on est (0 : l'ouverture de la page). */
  let rank = 0;

  // ------------------------------------------------------------- annonces

  const queue: string[] = [];
  let announceTimer = 0;

  function speak(): void {
    const next = queue.shift();
    if (next === undefined) {
      announceTimer = 0;
      return;
    }
    announcer.textContent = next;
    announceTimer = window.setTimeout(speak, ANNOUNCE_SPACING_MS);
  }

  /** Message lu poliment par les lecteurs d'écran, sans déplacer le focus. */
  function announce(message: string | undefined): void {
    if (!message) return;
    queue.push(message);
    if (announceTimer === 0) {
      announcer.textContent = '';
      announceTimer = window.setTimeout(speak, 100);
    }
  }

  function silence(): void {
    queue.length = 0;
    window.clearTimeout(announceTimer);
    announceTimer = 0;
    announcer.textContent = '';
  }

  // ------------------------------------------------------------- écrans

  function showView(view: ViewId): void {
    for (const [id, section] of screens) {
      const active = id === view;
      section.hidden = !active;
      section.toggleAttribute('data-active', active);
    }
  }

  /**
   * Focus sur le titre de l'écran, et la page défile jusqu'à lui : même
   * agrandie, la personne voit le nouvel écran, pas le haut de la page.
   */
  function focusView(view: ViewId): void {
    const heading = find<HTMLElement>('h2', screenOf(view));
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  function pushHash(view: ViewId): void {
    const hash = `#${viewAnchor(view)}`;
    if (window.location.hash === hash) return;
    rank += 1;
    window.history.pushState({ hakoRang: rank }, '', hash);
  }

  function renderIndicator(current: AssistantState): void {
    const doneText = indicator.dataset['doneText'] ?? '';
    // « La création s'est arrêtée » : l'écran des comptes en cours, même
    // après « C'est prêt » en démonstration (stepsDone, machine.ts).
    const shown: ViewId | null =
      current.view === 'stopped'
        ? 'accounts'
        : current.created
          ? null
          : isScreen(current.view)
            ? current.view
            : current.resume;
    const currentNumber = shown === null ? null : stepNumber(shown);
    const done = stepsDone(current);
    indicatorItems.forEach((item, index) => {
      const number = index + 1;
      const itemState = number <= done ? 'done' : number === currentNumber ? 'current' : 'upcoming';
      item.dataset['state'] = itemState;
      if (itemState === 'current') item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
      find<HTMLElement>('[data-step-state]', item).textContent =
        itemState === 'done' ? ` ${doneText}` : '';
    });
    indicator.hidden = current.view === 'preparing' || current.view === 'installed';
  }

  /** Bouton qui attend la HAKO : libellé « Un instant… », et aria-disabled. */
  function setBusy(button: HTMLButtonElement, busy: boolean): void {
    const label = button.querySelector<HTMLElement>('[data-label]');
    if (!label) return;
    button.dataset['idleText'] ??= label.textContent ?? '';
    label.textContent = (busy ? button.dataset['busyText'] : button.dataset['idleText']) ?? '';
    if (busy) button.setAttribute('aria-disabled', 'true');
    else button.removeAttribute('aria-disabled');
  }

  function renderBusy(current: AssistantState): void {
    setBusy(startButton, current.busy === 'status' && current.view === 'welcome');
    setBusy(peopleSubmit, current.busy === 'register');
    setBusy(checkSubmit, current.busy === 'check');
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-action="retry"]')) {
      setBusy(button, current.busy !== null && !isScreen(current.view));
    }
  }

  /**
   * Mots de passe déjà remis : sur l'écran des prénoms, des prénoms modifiés
   * en donneront de nouveaux ; sur l'écran des mots de passe, ce sont de
   * nouveaux mots de passe, la fiche déjà faite ne vaut plus.
   */
  function renderRenewal(current: AssistantState): void {
    peopleRenew.hidden = current.accounts === null || current.created;
    passwordsRenewed.hidden = !current.renewed;
  }

  // ------------------------------------------------------------- comptes

  function fillAccount(scope: ParentNode, account: Account): void {
    for (const element of scope.querySelectorAll<HTMLElement>('[data-first-name]')) {
      element.textContent = account.firstName;
    }
    for (const element of scope.querySelectorAll<HTMLElement>('[data-login]')) {
      setChunks(element, loginChunks(account.login), false);
    }
    for (const element of scope.querySelectorAll<HTMLElement>('[data-password]')) {
      setChunks(element, passwordChunks(account.password), true);
    }
    for (const element of scope.querySelectorAll<HTMLElement>('[data-owner]')) {
      element.hidden = !account.owner;
    }
  }

  function renderAccounts(accounts: readonly Account[]): void {
    const passwordOf = accountsList.dataset['passwordOf'] ?? '';
    accountsList.replaceChildren(
      ...accounts.map((account) => {
        const card = accountTemplate.content.cloneNode(true) as DocumentFragment;
        fillAccount(card, account);
        find<HTMLElement>('[data-password-of]', card).textContent = fillTemplate(passwordOf, {
          de_prenom: ofName(account.firstName),
        });
        return card;
      }),
    );
    printoutRows.replaceChildren(
      ...accounts.map((account) => {
        const row = rowTemplate.content.cloneNode(true) as DocumentFragment;
        fillAccount(row, account);
        return row;
      }),
    );
    printout.toggleAttribute('data-filled', accounts.length > 0);
    printout.dataset['people'] = String(accounts.length);
    const owner = accounts[0];
    checkLabel.textContent = fillTemplate(checkLabel.dataset['template'] ?? '', {
      de_prenom: ofName(owner?.firstName ?? ''),
    });
  }

  /** Les mots de passe quittent la page : cartes, fiche et champ de vérification. */
  function forgetSecrets(): void {
    accountsList.replaceChildren();
    printoutRows.replaceChildren();
    printout.removeAttribute('data-filled');
    printout.dataset['people'] = '0';
    checkInput.value = '';
    checkInput.type = 'password';
    checkShow.checked = false;
  }

  // ------------------------------------------------------------- vérification

  function ownerName(current: AssistantState): string {
    return current.accounts?.[0]?.firstName ?? '';
  }

  function renderCheck(before: AssistantState, after: AssistantState): void {
    const code = after.checkError;
    const text = find<HTMLElement>('[data-error-text]', checkError);
    if (code) {
      const key = `msg${code.charAt(0).toUpperCase()}${code.slice(1)}`;
      text.textContent = fillTemplate(checkForm.dataset[key] ?? '', {
        de_prenom: ofName(ownerName(after)),
      });
      checkError.hidden = false;
      checkInput.setAttribute('aria-invalid', 'true');
      checkInput.setAttribute('aria-describedby', `${checkError.id} verification-aide`);
    } else {
      text.textContent = '';
      checkError.hidden = true;
      checkInput.removeAttribute('aria-invalid');
      checkInput.setAttribute('aria-describedby', 'verification-aide');
    }
    checkForm.hidden = after.checked;
    checkSuccess.hidden = !after.checked;
    checkCreate.hidden = !after.checked;
    if (after.view !== 'check') return;
    if (!before.checked && after.checked) {
      announce(checkSuccess.textContent?.trim());
      checkCreate.focus();
    } else if (before.busy === 'check' && after.busy === null && code) {
      showCheckError();
    }
  }

  /**
   * Refus du mot de passe recopié : le focus va dans le champ. S'il y était
   * déjà (Entrée dans le champ), rien ne serait lu : le message est annoncé.
   */
  function showCheckError(): void {
    if (document.activeElement === checkInput) announce(checkError.textContent?.trim());
    else checkInput.focus();
  }

  // ------------------------------------------------------------- création des comptes

  function renderProgress(before: CreationProgress, after: CreationProgress): void {
    for (const id of TASK_IDS) {
      const item = must(taskItems.get(id), id);
      const taskState = after[id];
      item.dataset['state'] = taskState;
      find<HTMLElement>('[data-task-state]', item).textContent = tasksList.dataset[taskState] ?? '';
      if (before[id] !== 'done' && taskState === 'done') announce(item.dataset['doneText']);
    }
  }

  // ------------------------------------------------------------- machine

  function render(
    before: AssistantState,
    after: AssistantState,
    options: { readonly fromHistory?: boolean } = {},
  ): void {
    if (after.accounts && after.accounts !== before.accounts) renderAccounts(after.accounts);
    if (after.progress !== before.progress) renderProgress(before.progress, after.progress);
    renderIndicator(after);
    renderBusy(after);
    renderCheck(before, after);
    renderRenewal(after);
    if (after.view === before.view) return;
    showView(after.view);
    if (!options.fromHistory) pushHash(after.view);
    focusView(after.view);
    if (after.view === 'ready') announce(readyDone);
  }

  function dispatch(event: AssistantEvent, options: { readonly fromHistory?: boolean } = {}): void {
    const before = state;
    const result = transition(state, event);
    state = result.state;
    render(before, state, options);
    for (const effect of result.effects) run(effect);
  }

  /** Fait une demande à la HAKO ; la réponse revient à la machine, sauf après « Recommencer ». */
  function run(effect: Effect): void {
    const current = generation;
    const box = access;
    const settle = (event: AssistantEvent): void => {
      if (current === generation) dispatch(event);
    };
    const fail = (error: unknown): void => settle({ type: 'failed', code: errorCode(error) });
    switch (effect.type) {
      case 'read-status':
        box.status().then((status) => settle({ type: 'status', status }), fail);
        break;
      case 'register':
        box
          .register(effect.firstNames)
          .then((accounts) => settle({ type: 'registered', accounts }), fail);
        break;
      case 'check':
        box.checkSheet(effect.typed).then((result) => settle({ type: 'checked', result }), fail);
        break;
      case 'create-accounts':
        box
          .createAccounts((progress) => settle({ type: 'progress', progress }))
          .then(() => settle({ type: 'created' }), fail);
        break;
      case 'forget-secrets':
        forgetSecrets();
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------- les personnes

  const rows = (): HTMLElement[] => [...peopleList.querySelectorAll<HTMLElement>('[data-person]')];
  const inputOf = (row: HTMLElement): HTMLInputElement =>
    find<HTMLInputElement>('[data-person-input]', row);

  /** Description d'un champ : son erreur d'abord, puis son aide, puis son identifiant. */
  function describe(row: HTMLElement): void {
    const ids = ['[data-person-error]', '[data-person-hint]', '[data-person-login]']
      .map((selector) => find<HTMLElement>(selector, row))
      .filter((element) => !element.hidden)
      .map((element) => element.id);
    const input = inputOf(row);
    if (ids.length > 0) input.setAttribute('aria-describedby', ids.join(' '));
    else input.removeAttribute('aria-describedby');
  }

  function messageFor(code: PeopleErrorCode): string {
    return peopleForm.dataset[PEOPLE_MESSAGES[code]] ?? '';
  }

  function setRowError(row: HTMLElement, code: PeopleErrorCode | null): void {
    const error = find<HTMLElement>('[data-person-error]', row);
    const input = inputOf(row);
    find<HTMLElement>('[data-error-text]', error).textContent = code ? messageFor(code) : '';
    error.hidden = code === null;
    if (code) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    describe(row);
  }

  /** Numéros, libellés, boutons « Retirer », identifiants : tout ce qui dépend du rang. */
  function refreshRows(): void {
    const all = rows();
    const list = peopleList.dataset;
    const names = all.map((row) => cleanFirstName(inputOf(row).value));
    // Identifiant montré seulement pour un prénom accepté.
    const accepted = names.map((name) =>
      firstNameError(name, facts.firstNameMaxLength) === null ? name : '',
    );
    const logins = assignLogins(accepted, facts.loginDomain);
    const owners = takenBy(accepted, facts.loginDomain);
    all.forEach((row, index) => {
      const owner = index === 0;
      const name = names[index] ?? '';
      find<HTMLElement>('[data-person-label]', row).textContent = owner
        ? (list['ownerLabel'] ?? '')
        : fillTemplate(list['memberLabel'] ?? '', { n: index + 1 });
      find<HTMLElement>('[data-person-hint]', row).hidden = !owner;
      const remove = find<HTMLButtonElement>('[data-action="remove-person"]', row);
      remove.hidden = owner;
      remove.setAttribute(
        'aria-label',
        name
          ? fillTemplate(list['removeNamed'] ?? '', { prenom: name })
          : fillTemplate(list['removeNumbered'] ?? '', { n: index + 1 }),
      );
      const login = find<HTMLElement>('[data-person-login]', row);
      const value = logins[index] ?? '';
      // Identifiant qui reçoit un chiffre : la page dit pourquoi (Zoé, puis Zoë).
      const first = owners[index] ?? null;
      login.textContent = !value
        ? ''
        : first === null
          ? fillTemplate(list['loginPreview'] ?? '', { identifiant: value })
          : fillTemplate(list['loginTaken'] ?? '', {
              identifiant: value,
              autre: names[first] ?? '',
              pris: logins[first] ?? '',
            });
      login.hidden = value === '';
      describe(row);
    });
    const full = all.length >= facts.maxPeople;
    addButton.hidden = full;
    fullNote.hidden = !full;
  }

  function addRow(value = ''): HTMLInputElement {
    const fragment = personTemplate.content.cloneNode(true) as DocumentFragment;
    const row = find<HTMLElement>('[data-person]', fragment);
    rowCount += 1;
    const id = `prenom-${rowCount}`;
    const input = inputOf(row);
    input.id = id;
    input.value = value;
    find<HTMLLabelElement>('[data-person-label]', row).htmlFor = id;
    find<HTMLElement>('[data-person-hint]', row).id = `${id}-aide`;
    find<HTMLElement>('[data-person-error]', row).id = `${id}-erreur`;
    find<HTMLElement>('[data-person-login]', row).id = `${id}-identifiant`;
    peopleList.append(row);
    return input;
  }

  function hideSummary(): void {
    summary.hidden = true;
    summaryList.replaceChildren();
  }

  function updateSummaryTitle(count: number): void {
    const one = summary.dataset['titleOne'] ?? '';
    const many = summary.dataset['titleMany'] ?? '';
    summaryTitle.textContent = count === 1 ? one : fillTemplate(many, { n: count });
  }

  function showPeopleErrors(errors: readonly PersonError[]): void {
    const all = rows();
    all.forEach((row, index) => {
      setRowError(row, errors.find((error) => error.index === index)?.code ?? null);
    });
    if (errors.length === 0) {
      hideSummary();
      return;
    }
    summaryList.replaceChildren(
      ...errors.map((error) => {
        const input = inputOf(must(all[error.index], `ligne ${error.index + 1}`));
        const item = document.createElement('li');
        item.dataset['errorItem'] = input.id;
        const link = document.createElement('a');
        link.href = `#${input.id}`;
        link.textContent = messageFor(error.code);
        item.append(link);
        return item;
      }),
    );
    updateSummaryTitle(errors.length);
    summary.hidden = false;
    summary.focus();
  }

  /** Un prénom corrigé : son erreur disparaît, du champ et du résumé. */
  function recheckRow(row: HTMLElement): void {
    const input = inputOf(row);
    if (input.getAttribute('aria-invalid') !== 'true') return;
    const index = rows().indexOf(row);
    const error = firstNameError(cleanFirstName(input.value), facts.firstNameMaxLength);
    const code: PeopleErrorCode | null =
      index === 0 && error === 'missing' ? 'ownerMissing' : error;
    setRowError(row, code);
    const item = summaryList.querySelector<HTMLElement>(`[data-error-item="${input.id}"]`);
    if (code === null) item?.remove();
    else if (item?.firstElementChild) item.firstElementChild.textContent = messageFor(code);
    const remaining = summaryList.children.length;
    if (remaining === 0) hideSummary();
    else updateSummaryTitle(remaining);
  }

  function resetPeople(names: readonly string[] = []): void {
    peopleList.replaceChildren();
    const values = names.length > 0 ? names.slice(0, facts.maxPeople) : [''];
    for (const name of values) addRow(name);
    hideSummary();
    refreshRows();
  }

  peopleList.addEventListener('input', (event) => {
    const row =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-person]') : null;
    refreshRows();
    if (row) recheckRow(row);
  });

  peopleForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.busy !== null || state.view !== 'people') return;
    const { firstNames, errors } = checkPeople(
      rows().map((row) => inputOf(row).value),
      facts.firstNameMaxLength,
    );
    showPeopleErrors(errors);
    if (errors.length > 0) return;
    dispatch({ type: 'submit-people', firstNames });
  });

  /** Lien du résumé : l'intitulé du champ en vue, puis le focus dans le champ. */
  summaryList.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a') : null;
    const id = link?.getAttribute('href')?.slice(1);
    const input = id ? document.getElementById(id) : null;
    if (!input) return;
    event.preventDefault();
    const label = peopleForm.querySelector(`label[for="${input.id}"]`) ?? input;
    label.scrollIntoView({ block: 'center' });
    input.focus({ preventScroll: true });
  });

  // ------------------------------------------------------------- vérification

  checkForm.addEventListener('submit', (event) => {
    event.preventDefault();
    dispatch({ type: 'submit-check', typed: checkInput.value });
    // Refus sur l'appareil (champ vide, majuscule, espace, signe) : le champ
    // reprend le focus, ou le message est annoncé s'il l'avait déjà.
    if (state.busy === null && state.checkError) showCheckError();
  });

  checkShow.addEventListener('change', () => {
    checkInput.type = checkShow.checked ? 'text' : 'password';
  });

  // ------------------------------------------------------------- démonstration

  function simulate(scenario: StateId): void {
    if (!isSimulated(access) || state.busy !== null) return;
    if (scenario === 'stopped') {
      // Fiche vérifiée : la vraie création part, et la HAKO simulée l'arrête
      // en route. Sinon, l'écran seul.
      if (canCreate(state) && state.view === 'check') {
        access.simulate('stopped');
        dispatch({ type: 'create' });
      } else {
        dispatch({ type: 'show-state', state: 'stopped' });
      }
      return;
    }
    access.simulate(scenario);
    dispatch({ type: 'recheck' });
  }

  function restart(): void {
    generation += 1;
    access = createAccess();
    silence();
    forgetSecrets();
    resetPeople();
    printed.hidden = true;
    const before = state;
    const start = initial();
    state = start.state;
    renderProgress(before.progress, state.progress);
    renderIndicator(state);
    renderBusy(state);
    renderCheck(before, state);
    renderRenewal(state);
    showView('welcome');
    // Retour à l'entrée de l'ouverture (rang 0, sans ancre) : les écrans de
    // l'essai d'avant ne restent pas derrière l'accueil, et un seul appui sur
    // « Retour » quitte la page, vers celle d'où l'on venait. Le rang repart
    // de 0 tout de suite : un deuxième « Recommencer » ne recule pas plus loin.
    if (rank > 0) {
      window.history.go(-rank);
      rank = 0;
    } else if (window.location.hash !== '') {
      window.history.replaceState(
        { hakoRang: 0 },
        '',
        `${window.location.pathname}${window.location.search}`,
      );
    }
    focusView('welcome');
    announce(root.dataset['restarted']);
    for (const effect of start.effects) run(effect);
  }

  // ------------------------------------------------------------- boutons

  root.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('button[data-action]')
        : null;
    if (!button || !root.contains(button)) return;
    switch (button.dataset['action']) {
      case 'start':
        dispatch({ type: 'start' });
        break;
      case 'go': {
        const view = button.dataset['view'];
        if (view && isScreen(view as ViewId)) dispatch({ type: 'go', view: view as ScreenId });
        break;
      }
      case 'add-person': {
        if (rows().length >= facts.maxPeople) break;
        const input = addRow();
        refreshRows();
        input.focus();
        // Le bouton « Ajouter une personne » disparaît : la limite est annoncée.
        if (rows().length >= facts.maxPeople) announce(fullNote.textContent?.trim());
        break;
      }
      case 'remove-person': {
        const row = button.closest<HTMLElement>('[data-person]');
        if (!row) break;
        const index = rows().indexOf(row);
        const input = inputOf(row);
        summaryList.querySelector(`[data-error-item="${input.id}"]`)?.remove();
        row.remove();
        refreshRows();
        const remaining = summaryList.children.length;
        if (remaining === 0) hideSummary();
        else updateSummaryTitle(remaining);
        const previous = rows()[Math.max(0, index - 1)];
        if (previous) inputOf(previous).focus();
        break;
      }
      case 'fill-people':
        resetPeople(facts.exampleNames);
        break;
      case 'fill-password':
        checkInput.value = state.accounts?.[0]?.password ?? '';
        break;
      case 'print':
        window.print();
        printed.hidden = false;
        break;
      case 'create':
        dispatch({ type: 'create' });
        break;
      case 'retry':
        dispatch({ type: 'retry' });
        break;
      case 'restart':
        restart();
        break;
      case 'simulate': {
        const scenario = button.dataset['scenario'];
        const found = STATE_IDS.find((id) => id === scenario);
        if (found) simulate(found);
        break;
      }
      default:
        break;
    }
  });

  // ------------------------------------------------------------- historique

  /** Bouton « Retour » ou « Suivant » du navigateur, ou adresse modifiée à la main. */
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    const view: ViewId | null = hash === '' ? 'welcome' : viewFromHash(hash);
    const target = rankOf(window.history.state);
    // Autre ancre de la page (#contenu, un cas « Ça ne marche pas ? ») : rien à faire ici.
    if (view === null) return;
    if (view === state.view || canShow(state, view)) {
      if (view !== state.view) {
        dispatch({ type: 'go', view: view as ScreenId }, { fromHistory: true });
      }
      if (target !== null) rank = target;
      return;
    }
    if (state.created && target !== null && target < rank) {
      // Comptes créés : aucun écran d'avant ne peut plus s'afficher. Un seul
      // appui sur « Retour » quitte la page, vers celle d'où l'on venait.
      window.history.go(-(target + 1));
      return;
    }
    // Écran qui ne peut pas s'afficher maintenant (demande en cours…) : on
    // reste où l'on est.
    window.history.replaceState({ hakoRang: target ?? rank }, '', `#${viewAnchor(state.view)}`);
    if (target !== null) rank = target;
  });

  // Les liens vers le site : dans un nouvel onglet, et la mention qui le dit.
  const newTab = root.dataset['newTab'] ?? '';
  const siteUrl = root.dataset['siteUrl'] ?? '';
  for (const link of root.querySelectorAll<HTMLAnchorElement>('.hako-page a[href^="/"]')) {
    if (link.closest('[data-same-tab]')) continue;
    if (siteUrl) link.href = `${siteUrl}${link.getAttribute('href') ?? ''}`;
    link.target = '_blank';
    link.rel = 'noopener';
    // La mention reste d'un seul tenant (white-space: nowrap, Assistant.astro) :
    // la ligne se coupe avant la parenthèse, jamais dedans.
    if (newTab) {
      const mention = document.createElement('span');
      mention.className = 'hako-page__new-tab';
      mention.textContent = newTab;
      link.append(' ', mention);
    }
  }
  if (siteUrl) {
    for (const link of root.querySelectorAll<HTMLAnchorElement>('[data-same-tab] a[href^="/"]')) {
      link.href = `${siteUrl}${link.getAttribute('href') ?? ''}`;
    }
  }

  // Sur la HAKO : confirmation avant de quitter, tant que des mots de passe sont affichés.
  if (options.warnBeforeLeaving) {
    window.addEventListener('beforeunload', (event) => {
      if ((state.accounts !== null && !state.created) || state.busy === 'create') {
        event.preventDefault();
      }
    });
  }

  // Impression : le titre de la page devient le nom proposé pour le fichier PDF.
  let pageTitle: string | null = null;
  window.addEventListener('beforeprint', () => {
    const fileName = printout.dataset['fileName'];
    if (!fileName || !printout.hasAttribute('data-filled') || pageTitle !== null) return;
    pageTitle = document.title;
    document.title = fileName;
  });
  window.addEventListener('afterprint', () => {
    if (pageTitle === null) return;
    document.title = pageTitle;
    pageTitle = null;
  });

  // Retour sur la page depuis le cache du navigateur : rien ne doit survivre.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) restart();
  });

  // ------------------------------------------------------------- démarrage

  for (const element of root.querySelectorAll<HTMLElement>('[data-js-only]')) {
    element.hidden = false;
  }
  forgetSecrets();
  resetPeople();
  showView('welcome');
  renderIndicator(state);
  // « Commencer » attend que la HAKO ait dit où elle en est.
  renderBusy(state);
  // Une adresse vers un autre écran (rechargement, lien partagé) : tout est
  // oublié, la page repart de l'accueil. L'entrée de l'ouverture a le rang 0.
  const opened = viewFromHash(window.location.hash);
  window.history.replaceState(
    { hakoRang: 0 },
    '',
    opened !== null && opened !== 'welcome'
      ? `${window.location.pathname}${window.location.search}`
      : window.location.href,
  );
  root.dataset['ready'] = 'true';
  for (const effect of initial().effects) run(effect);

  return { restart };
}
