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
 * - sur la vraie HAKO (lot 3 de MaBox OS) : un accès qui appellera l'API
 *   locale de la HAKO, servie par la HAKO elle-même. Il n'existe pas encore :
 *   ses adresses et ses réponses restent à définir avec le lot 3. Il ne devra
 *   jamais entrer dans le JavaScript du site public.
 *
 * Ce que la HAKO garantit, quel que soit l'accès :
 * - elle tire elle-même les mots de passe, et ne les remet qu'une fois, en
 *   réponse à register() ;
 * - elle les garde en mémoire jusqu'à la vérification de la fiche
 *   (checkSheet), puis les oublie une fois les comptes créés : elle ne garde
 *   que de quoi les reconnaître ;
 * - createAccounts() reprend sans doublon après une coupure : ce qui est déjà
 *   fait reste fait.
 *
 * Reste à fournir pour la vraie HAKO (relecture finale, avant le lot 3) :
 * - l'accès réel et ses tests (même origine, délais, erreurs unreachable,
 *   interrupted et unexpected), jamais importé par le site ;
 * - deux phases de plus : « registered » (mots de passe remis, comptes pas
 *   encore créés) et « creating » (avec l'avancement), pour savoir quoi
 *   montrer après une page rechargée ou fermée (repères resumeInstall,
 *   afterStop et closedDuringCreation) ;
 * - une seule installation à la fois : un deuxième appareil ne doit pas
 *   pouvoir rappeler register() et changer les mots de passe affichés sur le
 *   premier (texte de cet écran à écrire) ;
 * - la page servie par la HAKO : <Assistant mode="box" siteUrl=…>, lang="fr",
 *   noindex, les feuilles de style du site, le composant dans <main>, et
 *   initAssistant(…, { warnBeforeLeaving: true }) ;
 * - les en-têtes : CSP sans upgrade-insecure-requests, connect-src 'self',
 *   form-action 'none', Cache-Control: no-store, Referrer-Policy: no-referrer ;
 * - un essai sur Chrome, Safari et Firefox : aucun ne doit proposer
 *   d'enregistrer le mot de passe tapé sur l'écran « Vérifiez votre fiche ».
 *
 * Types seulement, et une classe d'erreur : aucun accès au navigateur.
 */

/** Où en est la HAKO à l'ouverture de sa page. */
export type BoxPhase = 'preparing' | 'ready' | 'installed';

export interface BoxStatus {
  readonly phase: BoxPhase;
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

/** Réponse de la HAKO au mot de passe recopié de la personne responsable. */
export type CheckResult = 'ok' | 'wrong';

/**
 * Pourquoi la HAKO n'a pas répondu comme prévu :
 * - unreachable : elle ne répond plus (appareil sorti du Wi-Fi, HAKO débranchée) ;
 * - interrupted : la création des comptes s'est arrêtée avant la fin ;
 * - unexpected : une réponse que la page ne sait pas lire.
 */
export type BoxErrorCode = 'unreachable' | 'interrupted' | 'unexpected';

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
   * La HAKO renvoie le compte de chacun, mot de passe compris, une seule fois.
   * Un nouvel appel remplace les comptes et les mots de passe précédents.
   */
  register(firstNames: readonly string[]): Promise<readonly Account[]>;
  /** Mot de passe de la personne responsable, recopié depuis la fiche de secours. */
  checkSheet(typed: string): Promise<CheckResult>;
  /**
   * Crée les comptes des photos, puis des fichiers, puis fait les derniers
   * réglages. onProgress reçoit l'avancement à chaque changement. La
   * promesse est rejetée (BoxAccessError « interrupted ») si la création
   * s'arrête : un nouvel appel reprend là où elle s'était arrêtée.
   */
  createAccounts(onProgress: (progress: CreationProgress) => void): Promise<void>;
}

/** Écrans d'attente et d'erreur que la démonstration sait provoquer. */
export type SimulatedScenario =
  'preparing' | 'unreachable' | 'stopped' | 'unexpected' | 'installed';

/** HAKO simulée : elle sait provoquer, pour la démonstration, ce qui arrive rarement. */
export interface SimulatedBoxAccess extends BoxAccess {
  /**
   * Prépare la prochaine réponse : « preparing » ou « installed » pour le
   * prochain status(), « unreachable » ou « unexpected » pour le prochain
   * appel, quel qu'il soit, « stopped » pour la prochaine création des
   * comptes, qui s'arrête après les comptes des photos.
   */
  simulate(scenario: SimulatedScenario): void;
}

export function isSimulated(access: BoxAccess): access is SimulatedBoxAccess {
  return access.mode === 'demo' && 'simulate' in access;
}
