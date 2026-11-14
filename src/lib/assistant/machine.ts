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
 * s'est arrêtée), elsewhere (une installation est déjà en cours). «
 * Réessayer » rejoue ce qui a échoué, puis revient à l'écran du parcours où
 * l'on était (`resume`).
 *
 * L'état de la HAKO décide (événement status) :
 * - registered, sans la main (busy) : page rouverte ou deuxième appareil,
 *   l'écran elsewhere. Recopier le mot de passe de la personne responsable
 *   donne la main (la fiche sert de preuve), puis « Créer les comptes ».
 *   « Recommencer l’installation » ramène aux prénoms : de nouveaux mots de passe pour tout
 *   le monde (`replacing`), refusés tant qu'un autre appareil a la main
 *   (`refused`). Jamais la page ne réaffiche des mots de passe ;
 * - creating : la page suit la création jusqu'à la fin (page fermée puis
 *   rouverte) ;
 * - ready alors que la page a des mots de passe : la HAKO les a oubliés
 *   (coupure de courant). La page redemande des comptes pour les mêmes
 *   prénoms : nouveaux mots de passe, fiche à refaire ;
 * - « Réessayer » après une création arrêtée redemande d'abord l'état : la
 *   création reprend, se suit, ou finit, selon la réponse.
 *
 * Invariants (tests/unit/assistant-machine.test.ts) :
 * - accounts n'est connu qu'entre register et la fin de la création ;
 * - accounts (l'écran) et ready ne s'atteignent pas sans la fiche vérifiée,
 *   sur cette page ou avant que la HAKO ne commence la création ;
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
export type StateId =
  'preparing' | 'unreachable' | 'stopped' | 'unexpected' | 'installed' | 'elsewhere';
export const STATE_IDS: readonly StateId[] = [
  'preparing',
  'unreachable',
  'stopped',
  'unexpected',
  'installed',
  'elsewhere',
];

export type ViewId = ScreenId | StateId;

/** Où revenir après un écran d'attente ou d'erreur : un écran du parcours, ou l'installation en cours ailleurs. */
export type ResumeId = ScreenId | 'elsewhere';

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
  elsewhere: 'installation-en-cours',
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
  | { readonly type: 'follow-creation' }
  | { readonly type: 'forget-secrets' };

/**
 * Refus du mot de passe recopié : contrôle sur l'appareil, réponse de la
 * HAKO, trois essais faux, ou plus aucun essai accepté par la HAKO.
 */
export type CheckError = TypedPasswordError | 'wrong' | 'again' | 'blocked';

/** Essais faux avant de proposer de revoir les mots de passe. */
export const WRONG_ATTEMPTS_BEFORE_REVIEW = 3;

export interface AssistantState {
  readonly view: ViewId;
  /** Écran où revenir après un écran d'attente ou d'erreur. */
  readonly resume: ResumeId;
  /** Demande en cours à la HAKO, ou null. */
  readonly busy: Operation | null;
  /** Comptes remis par la HAKO, mots de passe compris ; null avant register et après la création. */
  readonly accounts: readonly Account[] | null;
  /** Les mots de passe remplacent ceux d'une remise précédente : la fiche déjà faite ne vaut plus. */
  readonly renewed: boolean;
  /**
   * La HAKO a déjà remis des mots de passe à une autre page (installation en
   * cours ailleurs) : les prochains les remplaceront.
   */
  readonly replacing: boolean;
  /** « Recommencer l’installation » refusé par la HAKO : un autre appareil a encore la main. */
  readonly refused: boolean;
  /**
   * Fiche vérifiée : la HAKO a reconnu le mot de passe recopié, sur cette
   * page, ou avant de commencer la création qu'elle dit en cours.
   */
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
  /** « Recommencer l’installation », sur l'écran de l'installation en cours ailleurs. */
  | { readonly type: 'start-over' }
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
  replacing: false,
  refused: false,
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

/**
 * Vrai si « Créer les comptes » peut partir : fiche vérifiée, comptes pas
 * encore créés. Sur l'écran de l'installation en cours ailleurs, la page n'a
 * pas les mots de passe : la fiche vérifiée suffit.
 */
export function canCreate(state: AssistantState): boolean {
  return state.checked && !state.created && state.busy === null;
}

/** Numéro de l'étape (1 à 5) d'un écran numéroté, sinon null. */
export function stepNumber(view: ViewId): number | null {
  const index = (NUMBERED_SCREENS as readonly ViewId[]).indexOf(view);
  return index === -1 ? null : index + 1;
}

/**
 * Étapes faites, pour l'indicateur : celles qui précèdent l'écran en cours
 * (toutes, une fois installée). « La création des comptes s'est arrêtée »
 * laisse toujours l'écran des comptes en cours, même quand la démonstration
 * le montre après « C'est prêt » (« Voir un autre écran »).
 */
export function stepsDone(state: AssistantState): number {
  if (state.view === 'stopped') return NUMBERED_SCREENS.length - 1;
  if (state.created) return NUMBERED_SCREENS.length;
  const screen = isScreen(state.view) ? state.view : state.resume;
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

/** Écran où l'on était, pour y revenir après un écran d'attente ou d'erreur. */
function resumeOf(state: AssistantState): ResumeId {
  return isScreen(state.view) || state.view === 'elsewhere' ? state.view : state.resume;
}

/**
 * Installation en cours ailleurs : les mots de passe que la page aurait
 * encore ne valent peut-être plus, elle les oublie.
 */
function elsewhere(state: AssistantState, refused: boolean): Transition {
  return {
    state: {
      ...state,
      busy: null,
      retry: null,
      view: 'elsewhere',
      resume: 'elsewhere',
      accounts: null,
      renewed: false,
      replacing: true,
      refused,
      checked: false,
      wrongAttempts: 0,
      checkError: null,
      progress: NOTHING_DONE,
    },
    effects: state.accounts === null ? [] : [{ type: 'forget-secrets' }],
  };
}

/** Comptes créés : « C'est prêt », et la page oublie les mots de passe. */
function finished(state: AssistantState): Transition {
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
}

/** Réponse de la HAKO à « où en es-tu ? » : l'écran qui va avec. */
function onStatus(state: AssistantState, status: BoxStatus): Transition {
  const settled: AssistantState = { ...state, busy: null, retry: null };
  switch (status.phase) {
    case 'preparing':
      return unchanged({ ...settled, view: 'preparing', retry: { type: 'read-status' } });
    case 'installed':
      // La page attendait la fin de la création : c'est fait.
      if (state.checked && !state.created) return finished(settled);
      // Installée sans cette page : ses mots de passe, s'il en reste, ne servent plus.
      return {
        state: { ...settled, view: 'installed', accounts: null },
        effects: state.accounts === null ? [] : [{ type: 'forget-secrets' }],
      };
    case 'creating':
      // Page rouverte pendant la création (ou création reprise) : la page la suit.
      return ask(
        {
          ...settled,
          resume: 'accounts',
          checked: true,
          progress: status.progress ?? state.progress,
        },
        { type: 'follow-creation' },
        'accounts',
      );
    case 'registered': {
      if (status.busy) return elsewhere(settled, false);
      if (settled.resume !== 'accounts') return unchanged({ ...settled, view: settled.resume });
      // « Réessayer » après une création arrêtée : la création repart.
      if (canCreate(settled)) return ask(settled, { type: 'create-accounts' }, 'accounts');
      const back: ResumeId = settled.accounts === null ? 'elsewhere' : 'check';
      return unchanged({ ...settled, view: back, resume: back });
    }
    case 'ready':
    default:
      if (state.created) return unchanged({ ...settled, view: settled.resume });
      // La HAKO a oublié les mots de passe (coupure de courant) : de nouveaux
      // pour les mêmes prénoms, et une fiche à refaire.
      if (state.accounts !== null) {
        return ask(
          { ...settled, resume: 'passwords' },
          {
            type: 'register',
            firstNames: state.accounts.map((account) => account.firstName),
          },
        );
      }
      // Fiche vérifiée sur l'écran de l'installation en cours ailleurs, sans
      // les prénoms : on recommence aux prénoms, avec de nouveaux mots de passe.
      if (state.checked) {
        return unchanged({
          ...settled,
          view: 'people',
          resume: 'people',
          checked: false,
          replacing: true,
          progress: NOTHING_DONE,
        });
      }
      return unchanged({
        ...settled,
        view: settled.resume === 'elsewhere' ? 'welcome' : settled.resume,
        resume: settled.resume === 'elsewhere' ? 'welcome' : settled.resume,
      });
  }
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
        renewed: state.accounts !== null || state.replacing,
        replacing: false,
        refused: false,
        checked: false,
        wrongAttempts: 0,
        checkError: null,
        progress: NOTHING_DONE,
      });

    case 'submit-check': {
      // Sur l'écran de vérification, ou sur celui de l'installation en cours
      // ailleurs (la page n'a alors pas les mots de passe).
      const here =
        (state.view === 'check' && state.accounts !== null) || state.view === 'elsewhere';
      if (!here || state.busy !== null || state.checked) return unchanged(state);
      const local = typedPasswordError(event.typed);
      if (local) return unchanged({ ...state, checkError: local });
      return ask({ ...state, checkError: null }, { type: 'check', typed: event.typed });
    }

    case 'checked': {
      if (state.busy !== 'check') return unchanged(state);
      const settled = { ...state, busy: null, retry: null };
      if (event.result === 'ok') {
        return unchanged({ ...settled, checked: true, checkError: null, refused: false });
      }
      if (event.result === 'blocked') return unchanged({ ...settled, checkError: 'blocked' });
      const wrongAttempts = state.wrongAttempts + 1;
      return unchanged({
        ...settled,
        wrongAttempts,
        checkError: wrongAttempts >= WRONG_ATTEMPTS_BEFORE_REVIEW ? 'again' : 'wrong',
      });
    }

    case 'create':
      if (
        !canCreate(state) ||
        (state.view !== 'check' && state.view !== 'stopped' && state.view !== 'elsewhere')
      ) {
        return unchanged(state);
      }
      return ask({ ...state, resume: 'accounts' }, { type: 'create-accounts' }, 'accounts');

    case 'progress':
      if (state.busy !== 'create') return unchanged(state);
      return unchanged({ ...state, progress: event.progress });

    case 'created':
      if (state.busy !== 'create') return unchanged(state);
      return finished(state);

    case 'status':
      if (state.busy !== 'status') return unchanged(state);
      return onStatus(state, event.status);

    case 'failed': {
      if (state.busy === null) return unchanged(state);
      const settled: AssistantState = { ...state, busy: null };
      // Un autre appareil a la main. Refus de « Recommencer l’installation » : la page le dit.
      if (event.code === 'busy') {
        return elsewhere(settled, state.busy === 'register' && state.replacing);
      }
      if (state.busy === 'create') return unchanged({ ...settled, view: 'stopped' });
      // La HAKO n'est plus où la page la croyait : la page lui redemande son
      // état (jamais en boucle : une réponse d'état n'est jamais « changed »).
      if (event.code === 'changed' && state.busy !== 'status') {
        return ask({ ...settled, resume: resumeOf(state) }, { type: 'read-status' });
      }
      return unchanged({
        ...settled,
        resume: resumeOf(state),
        view: event.code === 'unreachable' ? 'unreachable' : 'unexpected',
      });
    }

    case 'retry': {
      if (
        isScreen(state.view) ||
        state.busy !== null ||
        state.view === 'installed' ||
        state.view === 'elsewhere'
      ) {
        return unchanged(state);
      }
      // « Recharger la page » : la HAKO dit de nouveau où elle en est.
      if (state.view === 'preparing') return ask(state, { type: 'read-status' });
      // Création arrêtée : la HAKO dit d'abord où elle en est (création
      // toujours en cours, finie, à reprendre, ou mots de passe oubliés).
      if (state.view === 'stopped') {
        return canCreate(state)
          ? ask(state, { type: 'read-status' })
          : unchanged({ ...state, view: state.resume });
      }
      const effect = state.retry;
      if (effect?.type === 'read-status') return ask(state, effect);
      if (effect && effect.type !== 'create-accounts' && effect.type !== 'follow-creation') {
        return ask(state, effect, state.resume);
      }
      // Écran montré par la démonstration, sans demande à rejouer.
      return unchanged({ ...state, view: state.resume });
    }

    case 'start-over':
      if (state.view !== 'elsewhere' || state.busy !== null || state.checked) {
        return unchanged(state);
      }
      return unchanged({
        ...state,
        view: 'people',
        resume: 'people',
        refused: false,
        checkError: null,
        wrongAttempts: 0,
      });

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
