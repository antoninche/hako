/**
 * Machine à états de la page de la HAKO qui fait la première installation :
 * quel écran montrer, ce que la page sait déjà, et ce qu'il faut demander à
 * la HAKO (les « effets »). Elle est la même en démonstration et sur la vraie
 * HAKO : seul l'accès à la HAKO change (box-access.ts).
 *
 * Le parcours, dans l'ordre (src/content/assistant.ts, `order`) :
 *   welcome → people → passwords → sheet → check → accounts → ready
 * - people : les prénoms ; « Continuer » les donne à la HAKO (effet
 *   register), qui renvoie les comptes et leurs mots de passe. Revenu aux
 *   prénoms sans rien changer, « Continuer » ramène aux mêmes mots de passe,
 *   sans rien demander. Des prénoms modifiés : de nouveaux mots de passe
 *   pour tout le monde (`renewed`), la fiche est à refaire ;
 * - passwords, sheet : les mots de passe, puis la fiche de secours ;
 * - check : le mot de passe de la personne responsable, recopié de la fiche,
 *   vérifié par la HAKO (effet check) ; « Créer les comptes » n'est possible
 *   qu'une fois la fiche vérifiée ;
 * - accounts : la HAKO crée les comptes (effet create-accounts) ; ready
 *   ensuite, et la page oublie les mots de passe (effet forget-secrets).
 *
 * Hors du parcours, les écrans d'attente et d'erreur : preparing (la HAKO se
 * prépare encore), installed (déjà installée), unreachable (elle ne répond
 * plus), unexpected (réponse inattendue), stopped (la création des comptes
 * s'est arrêtée). « Réessayer » rejoue ce qui a échoué, puis revient à
 * l'écran du parcours où l'on était (`resume`).
 *
 * Invariants (tests/unit/assistant-machine.test.ts) :
 * - accounts n'est connu qu'entre register et la fin de la création ;
 * - accounts (l'écran) et ready ne s'atteignent pas sans la fiche vérifiée ;
 * - pendant une demande à la HAKO (busy), aucun autre geste n'est pris en
 *   compte : pas de double envoi ;
 * - un événement inattendu ne change rien et ne produit aucun effet.
 *
 * Fonctions pures : ni navigateur, ni minuterie, ni texte affiché.
 */
import {
  NOTHING_DONE,
  type Account,
  type BoxErrorCode,
  type BoxStatus,
  type CheckResult,
  type CreationProgress,
} from './box-access.ts';
import { typedPasswordError, type TypedPasswordError } from './household.ts';

/** Écrans du parcours, dans l'ordre. */
export type ScreenId =
  'welcome' | 'people' | 'passwords' | 'sheet' | 'check' | 'accounts' | 'ready';
export const SCREEN_IDS: readonly ScreenId[] = [
  'welcome',
  'people',
  'passwords',
  'sheet',
  'check',
  'accounts',
  'ready',
];

/** Écrans d'attente et d'erreur, hors du parcours. */
export type StateId = 'preparing' | 'unreachable' | 'stopped' | 'unexpected' | 'installed';
export const STATE_IDS: readonly StateId[] = [
  'preparing',
  'unreachable',
  'stopped',
  'unexpected',
  'installed',
];

export type ViewId = ScreenId | StateId;

/** Écrans numérotés (« Écran 2 sur 5 ») : tous ceux du parcours, sauf l'accueil et la fin. */
export const NUMBERED_SCREENS: readonly ScreenId[] = [
  'people',
  'passwords',
  'sheet',
  'check',
  'accounts',
];

/** Ancre de chaque écran dans l'adresse : #ecran-personnes. */
export const VIEW_SLUGS: Readonly<Record<ViewId, string>> = {
  welcome: 'bienvenue',
  people: 'personnes',
  passwords: 'mots-de-passe',
  sheet: 'fiche',
  check: 'verification',
  accounts: 'comptes',
  ready: 'pret',
  preparing: 'preparation',
  unreachable: 'injoignable',
  stopped: 'creation-arretee',
  unexpected: 'erreur',
  installed: 'deja-installee',
};

export const ANCHOR_PREFIX = 'ecran-';

/** Ancre d'un écran, sans « # » : « ecran-personnes ». */
export function viewAnchor(view: ViewId): string {
  return `${ANCHOR_PREFIX}${VIEW_SLUGS[view]}`;
}

/** Écran désigné par une ancre (« #ecran-fiche »), ou null. */
export function viewFromHash(hash: string): ViewId | null {
  let name: string;
  try {
    name = decodeURIComponent(hash.startsWith('#') ? hash.slice(1) : hash);
  } catch {
    return null;
  }
  if (!name.startsWith(ANCHOR_PREFIX)) return null;
  const slug = name.slice(ANCHOR_PREFIX.length);
  const found = (Object.keys(VIEW_SLUGS) as ViewId[]).find((view) => VIEW_SLUGS[view] === slug);
  return found ?? null;
}

export function isScreen(view: ViewId): view is ScreenId {
  return (SCREEN_IDS as readonly ViewId[]).includes(view);
}

/** Demande en cours à la HAKO. */
export type Operation = 'status' | 'register' | 'check' | 'create';

/** Ce que la page doit faire ou demander à la HAKO, après un changement d'état. */
export type Effect =
  | { readonly type: 'read-status' }
  | { readonly type: 'register'; readonly firstNames: readonly string[] }
  | { readonly type: 'check'; readonly typed: string }
  | { readonly type: 'create-accounts' }
  | { readonly type: 'forget-secrets' };

/** Refus du mot de passe recopié : contrôle sur l'appareil, réponse de la HAKO, ou trois essais faux. */
export type CheckError = TypedPasswordError | 'wrong' | 'again';

/** Essais faux avant de proposer de revoir les mots de passe. */
export const WRONG_ATTEMPTS_BEFORE_REVIEW = 3;

export interface AssistantState {
  readonly view: ViewId;
  /** Écran du parcours où revenir après un écran d'attente ou d'erreur. */
  readonly resume: ScreenId;
  /** Demande en cours à la HAKO, ou null. */
  readonly busy: Operation | null;
  /** Comptes remis par la HAKO, mots de passe compris ; null avant register et après la création. */
  readonly accounts: readonly Account[] | null;
  /** Les mots de passe remplacent ceux d'une remise précédente : la fiche déjà faite ne vaut plus. */
  readonly renewed: boolean;
  /** Fiche vérifiée : la HAKO a reconnu le mot de passe recopié. */
  readonly checked: boolean;
  readonly wrongAttempts: number;
  readonly checkError: CheckError | null;
  readonly progress: CreationProgress;
  readonly created: boolean;
  /** Ce que « Réessayer » rejoue, après une erreur. */
  readonly retry: Effect | null;
}

export type AssistantEvent =
  /** « Commencer », sur l'accueil. */
  | { readonly type: 'start' }
  /** Bouton « Retour », « Continuer »…, ou bouton « Retour » du navigateur. */
  | { readonly type: 'go'; readonly view: ScreenId }
  /** Prénoms acceptés par la page (household.ts), à donner à la HAKO. */
  | { readonly type: 'submit-people'; readonly firstNames: readonly string[] }
  | { readonly type: 'registered'; readonly accounts: readonly Account[] }
  | { readonly type: 'submit-check'; readonly typed: string }
  | { readonly type: 'checked'; readonly result: CheckResult }
  /** « Créer les comptes ». */
  | { readonly type: 'create' }
  | { readonly type: 'progress'; readonly progress: CreationProgress }
  | { readonly type: 'created' }
  | { readonly type: 'status'; readonly status: BoxStatus }
  /** Une demande à la HAKO a échoué. */
  | { readonly type: 'failed'; readonly code: BoxErrorCode }
  /** « Réessayer », « Recharger la page ». */
  | { readonly type: 'retry' }
  /** Demander de nouveau son état à la HAKO (démonstration : écran provoqué). */
  | { readonly type: 'recheck' }
  /** Démonstration : montrer un écran d'attente ou d'erreur. */
  | { readonly type: 'show-state'; readonly state: StateId };

export interface Transition {
  readonly state: AssistantState;
  readonly effects: readonly Effect[];
}

const BASE: AssistantState = {
  view: 'welcome',
  resume: 'welcome',
  busy: null,
  accounts: null,
  renewed: false,
  checked: false,
  wrongAttempts: 0,
  checkError: null,
  progress: NOTHING_DONE,
  created: false,
  retry: null,
};

/** À l'ouverture : l'accueil, pendant que la page demande son état à la HAKO. */
export function initial(): Transition {
  const effect: Effect = { type: 'read-status' };
  return { state: { ...BASE, busy: 'status', retry: effect }, effects: [effect] };
}

/** Vrai si l'écran peut s'afficher maintenant (boutons de la page ou du navigateur). */
export function canShow(state: AssistantState, view: ViewId): boolean {
  if (!isScreen(view) || state.busy !== null) return false;
  switch (view) {
    case 'welcome':
    case 'people':
      return !state.created;
    case 'passwords':
    case 'sheet':
    case 'check':
      return state.accounts !== null && !state.created;
    case 'ready':
      return state.created;
    default:
      // « accounts » ne s'ouvre que par « Créer les comptes ».
      return false;
  }
}

/** Vrai si « Créer les comptes » peut partir : fiche vérifiée, comptes pas encore créés. */
export function canCreate(state: AssistantState): boolean {
  return state.accounts !== null && state.checked && !state.created && state.busy === null;
}

/** Numéro de l'étape (1 à 5) d'un écran numéroté, sinon null. */
export function stepNumber(view: ViewId): number | null {
  const index = (NUMBERED_SCREENS as readonly ViewId[]).indexOf(view);
  return index === -1 ? null : index + 1;
}

/** Étapes faites, pour l'indicateur : celles qui précèdent l'écran en cours (toutes, une fois installée). */
export function stepsDone(state: AssistantState): number {
  if (state.created) return NUMBERED_SCREENS.length;
  const screen = isScreen(state.view) ? state.view : state.resume;
  if (state.view === 'stopped') return NUMBERED_SCREENS.length - 1;
  const number = stepNumber(screen);
  return number === null ? 0 : number - 1;
}

const unchanged = (state: AssistantState): Transition => ({ state, effects: [] });

/** Demande à la HAKO : l'écran attend, « Réessayer » saura la rejouer. */
function ask(state: AssistantState, effect: Effect, view: ViewId = state.view): Transition {
  const busy: Operation =
    effect.type === 'read-status'
      ? 'status'
      : effect.type === 'register'
        ? 'register'
        : effect.type === 'check'
          ? 'check'
          : 'create';
  return { state: { ...state, view, busy, retry: effect }, effects: [effect] };
}

/** Vrai si les prénoms sont ceux des comptes déjà remis, dans le même ordre. */
function sameNames(accounts: readonly Account[] | null, firstNames: readonly string[]): boolean {
  return (
    accounts !== null &&
    accounts.length === firstNames.length &&
    accounts.every((account, index) => account.firstName === firstNames[index])
  );
}

/** Écran du parcours où l'on était, pour y revenir après un écran d'attente ou d'erreur. */
function resumeOf(state: AssistantState): ScreenId {
  return isScreen(state.view) ? state.view : state.resume;
}

export function transition(state: AssistantState, event: AssistantEvent): Transition {
  switch (event.type) {
    case 'start':
      if (state.view !== 'welcome' || state.busy !== null || state.created) return unchanged(state);
      return unchanged({ ...state, view: 'people' });

    case 'go':
      if (event.view === state.view || !canShow(state, event.view)) return unchanged(state);
      return unchanged({ ...state, view: event.view, checkError: null });

    case 'submit-people':
      if (state.view !== 'people' || state.busy !== null || event.firstNames.length === 0) {
        return unchanged(state);
      }
      // Mêmes prénoms, dans le même ordre : les mêmes mots de passe, sans demande à la HAKO.
      if (sameNames(state.accounts, event.firstNames)) {
        return unchanged({ ...state, view: 'passwords' });
      }
      return ask(state, { type: 'register', firstNames: [...event.firstNames] });

    case 'registered':
      if (state.busy !== 'register' || event.accounts.length === 0) return unchanged(state);
      return unchanged({
        ...state,
        busy: null,
        retry: null,
        view: 'passwords',
        resume: 'passwords',
        accounts: event.accounts,
        // Nouveaux comptes : la fiche est à refaire et à vérifier.
        renewed: state.accounts !== null,
        checked: false,
        wrongAttempts: 0,
        checkError: null,
        progress: NOTHING_DONE,
      });

    case 'submit-check': {
      if (state.view !== 'check' || state.busy !== null || state.checked || !state.accounts) {
        return unchanged(state);
      }
      const local = typedPasswordError(event.typed);
      if (local) return unchanged({ ...state, checkError: local });
      return ask({ ...state, checkError: null }, { type: 'check', typed: event.typed });
    }

    case 'checked': {
      if (state.busy !== 'check') return unchanged(state);
      const settled = { ...state, busy: null, retry: null };
      if (event.result === 'ok') return unchanged({ ...settled, checked: true, checkError: null });
      const wrongAttempts = state.wrongAttempts + 1;
      return unchanged({
        ...settled,
        wrongAttempts,
        checkError: wrongAttempts >= WRONG_ATTEMPTS_BEFORE_REVIEW ? 'again' : 'wrong',
      });
    }

    case 'create':
      if (!canCreate(state) || (state.view !== 'check' && state.view !== 'stopped')) {
        return unchanged(state);
      }
      return ask({ ...state, resume: 'accounts' }, { type: 'create-accounts' }, 'accounts');

    case 'progress':
      if (state.busy !== 'create') return unchanged(state);
      return unchanged({ ...state, progress: event.progress });

    case 'created':
      if (state.busy !== 'create') return unchanged(state);
      return {
        state: {
          ...state,
          busy: null,
          retry: null,
          view: 'ready',
          resume: 'ready',
          accounts: null,
          created: true,
        },
        effects: [{ type: 'forget-secrets' }],
      };

    case 'status': {
      if (state.busy !== 'status') return unchanged(state);
      const settled: AssistantState = { ...state, busy: null };
      if (event.status.phase === 'preparing') {
        return unchanged({ ...settled, view: 'preparing', retry: { type: 'read-status' } });
      }
      if (event.status.phase === 'installed') {
        return unchanged({ ...settled, view: 'installed', retry: null });
      }
      return unchanged({ ...settled, view: settled.resume, retry: null });
    }

    case 'failed': {
      if (state.busy === null) return unchanged(state);
      const settled: AssistantState = { ...state, busy: null };
      if (state.busy === 'create') return unchanged({ ...settled, view: 'stopped' });
      return unchanged({
        ...settled,
        resume: resumeOf(state),
        view: event.code === 'unreachable' ? 'unreachable' : 'unexpected',
      });
    }

    case 'retry': {
      if (isScreen(state.view) || state.busy !== null || state.view === 'installed') {
        return unchanged(state);
      }
      // « Recharger la page » : la HAKO dit de nouveau où elle en est.
      if (state.view === 'preparing') return ask(state, { type: 'read-status' });
      const effect = state.retry;
      if (effect?.type === 'create-accounts') {
        return canCreate(state)
          ? ask(state, effect, 'accounts')
          : unchanged({ ...state, view: state.resume });
      }
      if (effect?.type === 'read-status') return ask(state, effect);
      if (effect) return ask(state, effect, state.resume);
      // Écran montré par la démonstration, sans demande à rejouer.
      if (state.view === 'stopped' && canCreate(state)) {
        return ask(state, { type: 'create-accounts' }, 'accounts');
      }
      return unchanged({ ...state, view: state.resume });
    }

    case 'recheck':
      if (state.busy !== null) return unchanged(state);
      return ask({ ...state, resume: resumeOf(state) }, { type: 'read-status' });

    case 'show-state':
      if (state.busy !== null || state.view === event.state) return unchanged(state);
      return unchanged({ ...state, view: event.state, resume: resumeOf(state), retry: null });

    default:
      return unchanged(state);
  }
}
