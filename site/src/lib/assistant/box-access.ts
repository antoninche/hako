/**
 * Accès à la HAKO depuis la page de la première installation.
 *
 * La page ne connaît que l'interface BoxAccess : elle demande l'état de la
 * HAKO, lui donne les prénoms, lui fait vérifier le mot de passe recopié,
 * puis lui fait créer les comptes et suit l'avancement. Deux façons de
 * répondre :
 * - en démonstration, sur le site (/installer/demonstration/) : la HAKO
 *   simulée de demo-box.ts, qui travaille dans la mémoire de la page. Rien ne
 *   quitte le navigateur ;
 * - sur la vraie HAKO (lot 5 de HakOS) : box-http.ts, qui appelle l'API
 *   locale de la HAKO, servie par la HAKO elle-même (même origine). Seule la
 *   page construite par `npm run build:box` l'importe : jamais le JavaScript
 *   du site public (tests/unit/assistant-script.test.ts le vérifie dans dist/).
 *
 * Ce que la HAKO garantit, quel que soit l'accès :
 * - elle tire elle-même les mots de passe, et ne les remet qu'une fois, en
 *   réponse à register() ; jamais elle ne les montre de nouveau ;
 * - elle les garde en mémoire jusqu'à la création des comptes, puis les
 *   oublie : elle ne garde que de quoi les reconnaître ;
 * - une seule installation à la fois : register() ouvre une session, tenue
 *   par l'appareil qui l'a appelée. Un autre appareil (ou la même page,
 *   rouverte) voit l'installation « en cours ailleurs » (status().busy) ; il
 *   ne peut pas rappeler register() tant que la session vit (erreur
 *   « busy »), mais il prend la main en recopiant le mot de passe de la
 *   personne responsable (checkSheet) : la fiche sert de preuve ;
 * - la création des comptes continue si la page se ferme ; elle reprend sans
 *   doublon après un arrêt. Après une coupure de courant, la HAKO a oublié
 *   les mots de passe : elle en tire de nouveaux pour tout le monde (nouvel
 *   appel à register()), et met à jour les comptes déjà créés.
 *
 * La page de la HAKO est servie avec les en-têtes BOX_PAGE_HEADERS (plus
 * bas) : la page construite les respecte (tests/box.spec.ts).
 *
 * Types, constantes et une classe d'erreur seulement : aucun accès au
 * navigateur.
 */

/**
 * Où en est la HAKO :
 * - preparing : premier démarrage, ses applications s'installent ;
 * - ready : prête, aucune installation commencée (ou mots de passe oubliés
 *   après une coupure de courant) ;
 * - registered : mots de passe remis, comptes pas encore créés ;
 * - creating : création des comptes en cours (avec l'avancement) ;
 * - installed : première installation faite.
 */
export type BoxPhase = 'preparing' | 'ready' | 'registered' | 'creating' | 'installed';
export const BOX_PHASES: readonly BoxPhase[] = [
  'preparing',
  'ready',
  'registered',
  'creating',
  'installed',
];

export interface BoxStatus {
  readonly phase: BoxPhase;
  /**
   * Installation commencée avec un autre appareil, ou dans une page fermée
   * depuis : cet appareil n'a pas la main (pas de session, ou plus la bonne).
   * Toujours false hors des phases registered et creating.
   */
  readonly busy: boolean;
  /** Avancement de la création des comptes, en phase creating. */
  readonly progress?: CreationProgress;
}

/** Le compte d'une personne, tel que la HAKO le remet : une seule fois. */
export interface Account {
  /** Prénom, tel qu'il s'affiche (nom du compte dans les applications). */
  readonly firstName: string;
  /** Identifiant, le même pour les photos (Immich) et les fichiers (Nextcloud). */
  readonly login: string;
  /** Personne responsable de la HAKO : la première de la liste. */
  readonly owner: boolean;
  /** Le même pour les photos et les fichiers. */
  readonly password: string;
}

/** Lignes de l'avancement de la création des comptes, dans l'ordre. */
export type TaskId = 'photos' | 'files' | 'finish';
export const TASK_IDS: readonly TaskId[] = ['photos', 'files', 'finish'];

export type TaskState = 'waiting' | 'running' | 'done';

/** État de chaque ligne de l'avancement. */
export type CreationProgress = Readonly<Record<TaskId, TaskState>>;

/** Avancement au départ : rien n'est commencé. */
export const NOTHING_DONE: CreationProgress = Object.freeze({
  photos: 'waiting',
  files: 'waiting',
  finish: 'waiting',
});

/**
 * Réponse de la HAKO au mot de passe recopié de la personne responsable :
 * ok, faux, ou plus aucun essai accepté (MAX_WRONG_CHECKS essais faux).
 */
export type CheckResult = 'ok' | 'wrong' | 'blocked';

/** Essais faux après lesquels la HAKO n'accepte plus le mot de passe recopié. */
export const MAX_WRONG_CHECKS = 10;

/**
 * Pourquoi la HAKO n'a pas répondu comme prévu :
 * - unreachable : elle ne répond plus (appareil sorti du Wi-Fi, HAKO débranchée) ;
 * - interrupted : la création des comptes s'est arrêtée avant la fin ;
 * - unexpected : une réponse que la page ne sait pas lire ;
 * - busy : l'installation est en cours avec un autre appareil, qui a la main ;
 * - changed : la HAKO n'est plus où la page la croyait (session perdue,
 *   redémarrage, autre phase) : la page lui redemande son état.
 */
export type BoxErrorCode = 'unreachable' | 'interrupted' | 'unexpected' | 'busy' | 'changed';

export class BoxAccessError extends Error {
  // Pas de propriété déclarée dans le constructeur : node --test ne sait pas l'effacer.
  readonly code: BoxErrorCode;

  constructor(code: BoxErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = 'BoxAccessError';
    this.code = code;
  }
}

/** Code d'une erreur reçue d'un accès ; toute autre erreur est inattendue. */
export function errorCode(error: unknown): BoxErrorCode {
  return error instanceof BoxAccessError ? error.code : 'unexpected';
}

export interface BoxAccess {
  /** « demo » : HAKO simulée, rien ne quitte le navigateur ; « box » : la vraie HAKO. */
  readonly mode: 'demo' | 'box';
  /** État de la HAKO. */
  status(): Promise<BoxStatus>;
  /**
   * Donne les prénoms, dans l'ordre (le premier : la personne responsable).
   * La HAKO renvoie le compte de chacun, mot de passe compris, une seule fois,
   * et ouvre la session de cet appareil. Un nouvel appel remplace les comptes
   * et les mots de passe précédents ; il est refusé (« busy ») si un autre
   * appareil a la main.
   */
  register(firstNames: readonly string[]): Promise<readonly Account[]>;
  /**
   * Mot de passe de la personne responsable, recopié depuis la fiche de
   * secours. Réussi, il donne la main à cet appareil, même s'il n'a pas
   * appelé register() (page rouverte, autre appareil).
   */
  checkSheet(typed: string): Promise<CheckResult>;
  /**
   * Crée les comptes des photos, puis des fichiers, puis fait les derniers
   * réglages. onProgress reçoit l'avancement à chaque changement. La
   * promesse est rejetée (BoxAccessError « interrupted ») si la création
   * s'arrête : un nouvel appel reprend là où elle s'était arrêtée.
   */
  createAccounts(onProgress: (progress: CreationProgress) => void): Promise<void>;
  /**
   * Suit une création des comptes déjà commencée (page rouverte pendant la
   * création), jusqu'à la fin. Rejetée (« interrupted ») si elle s'arrête.
   */
  followCreation(onProgress: (progress: CreationProgress) => void): Promise<void>;
}

/**
 * Ce que la démonstration sait provoquer, dans l'ordre de « Voir un autre
 * écran » : les écrans d'attente et d'erreur, l'installation en cours
 * ailleurs, et la page rouverte pendant la création des comptes.
 */
export type SimulatedScenario =
  'preparing' | 'unreachable' | 'stopped' | 'unexpected' | 'installed' | 'elsewhere' | 'creating';
export const SIMULATED_SCENARIOS: readonly SimulatedScenario[] = [
  'preparing',
  'unreachable',
  'stopped',
  'unexpected',
  'installed',
  'elsewhere',
  'creating',
];

/** HAKO simulée : elle sait provoquer, pour la démonstration, ce qui arrive rarement. */
export interface SimulatedBoxAccess extends BoxAccess {
  /**
   * Prépare la prochaine réponse : « preparing » ou « installed » pour le
   * prochain status(), « unreachable » ou « unexpected » pour le prochain
   * appel, quel qu'il soit, « stopped » pour la prochaine création des
   * comptes, qui s'arrête après les comptes des photos comme après une
   * coupure de courant (mots de passe oubliés). « elsewhere » : une
   * installation commencée sur un autre appareil ; « creating » : une
   * création des comptes déjà en cours. Ces deux-là valent pour une HAKO
   * neuve, avant son premier status().
   */
  simulate(scenario: SimulatedScenario): void;
}

export function isSimulated(access: BoxAccess): access is SimulatedBoxAccess {
  return access.mode === 'demo' && 'simulate' in access;
}

/**
 * En-têtes de la page servie par la HAKO (et de son API), posés par le nginx
 * de la HAKO (HakOS). Différences avec le site public : pas
 * d'upgrade-insecure-requests (la HAKO parle en HTTP sur le réseau de la
 * maison), aucun formulaire envoyé (form-action 'none'), rien en cache, et
 * aucune adresse transmise aux sites ouverts depuis la page.
 */
export const BOX_PAGE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
});
