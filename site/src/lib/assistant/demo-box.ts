/**
 * HAKO simulée de la démonstration (/installer/demonstration/) : elle répond
 * comme répondra la vraie HAKO, mais travaille dans la mémoire de la page.
 *
 * - Aucune requête, aucun stockage : tout s'oublie au rechargement.
 * - Mots de passe d'exemple fixes, jamais tirés au hasard : ils commencent
 *   par « exemple » et finissent par 00 (EXAMPLE_PASSWORDS,
 *   src/data/assistant.ts), un par rang de personne. Une démonstration qui
 *   inventerait des mots de passe crédibles pourrait être prise pour la
 *   vraie installation.
 * - Attentes courtes et réglables : la création des comptes avance ligne par
 *   ligne, en quelques secondes ; 0 dans les tests.
 * - Les phases de la vraie HAKO : ready, registered (mots de passe remis),
 *   creating (avec l'avancement), installed. La page qui a appelé
 *   register(), ou qui a recopié le mot de passe de la personne responsable,
 *   a la main ; sinon, status() dit l'installation en cours ailleurs (busy).
 *   Au-delà de MAX_WRONG_CHECKS essais faux, plus aucun n'est accepté.
 * - Ce qui arrive rarement se provoque avec simulate() : HAKO qui se prépare
 *   encore ou déjà installée, HAKO qui ne répond plus, réponse inattendue,
 *   coupure de courant pendant la création des comptes (arrêt après les
 *   comptes des photos, mots de passe oubliés), installation commencée sur
 *   un autre appareil, création des comptes déjà en cours.
 *
 * Les faits (mots de passe d'exemple, domaine des identifiants, limites)
 * sont passés au constructeur : le script de la page les lit dans le HTML,
 * les tests dans src/data/assistant.ts. Ce module n'importe aucun texte.
 */
import {
  BoxAccessError,
  MAX_WRONG_CHECKS,
  NOTHING_DONE,
  TASK_IDS,
  type Account,
  type BoxStatus,
  type CheckResult,
  type CreationProgress,
  type SimulatedBoxAccess,
  type SimulatedScenario,
  type TaskId,
  type TaskState,
} from './box-access.ts';
import { assignLogins, checkPeople } from './household.ts';

/** Attentes simulées, en millisecondes. */
export interface DemoDelays {
  /** Réponse à status(). */
  readonly status: number;
  /** Comptes et mots de passe, après les prénoms. */
  readonly register: number;
  /** Vérification du mot de passe recopié. */
  readonly check: number;
  /** Chaque ligne de la création des comptes. */
  readonly task: number;
  /** Après la dernière ligne, avant de dire que tout est prêt. */
  readonly settle: number;
}

/** Quelques secondes en tout pour la création des comptes, comme le dit la démonstration. */
export const DEMO_DELAYS: DemoDelays = Object.freeze({
  status: 0,
  register: 500,
  check: 600,
  task: 900,
  settle: 700,
});

export interface DemoBoxOptions {
  /** Mots de passe d'exemple, un par rang de personne (EXAMPLE_PASSWORDS). */
  readonly passwords: readonly string[];
  /** Ce qui suit le prénom dans un identifiant (LOGIN_DOMAIN : « @hako.local »). */
  readonly loginDomain: string;
  /** Longueur maximale d'un prénom (FIRST_NAME_MAX_LENGTH). */
  readonly firstNameMaxLength: number;
  readonly delays?: Partial<DemoDelays>;
  /** Attente : setTimeout par défaut ; les tests la remplacent pour ne pas attendre. */
  readonly wait?: (ms: number) => Promise<void>;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Création déjà en cours (« creating ») : les comptes des photos sont faits, ceux des fichiers en route. */
const HALFWAY: CreationProgress = Object.freeze({
  photos: 'done',
  files: 'running',
  finish: 'waiting',
});

export class DemoBoxAccess implements SimulatedBoxAccess {
  readonly mode = 'demo';

  readonly #passwords: readonly string[];
  readonly #loginDomain: string;
  readonly #firstNameMaxLength: number;
  readonly #delays: DemoDelays;
  readonly #wait: (ms: number) => Promise<void>;

  #installed = false;
  /** Mot de passe de la personne responsable, tant que les comptes ne sont pas créés. */
  #ownerPassword: string | null = null;
  /** Cette page a la main sur l'installation en cours. */
  #session = false;
  /** Création des comptes en cours, commencée ailleurs (simulate('creating')). */
  #creating = false;
  #wrongChecks = 0;
  #progress: CreationProgress = NOTHING_DONE;
  /** Réponse préparée par simulate() pour le prochain status(). */
  #nextPhase: 'preparing' | 'installed' | null = null;
  /** Erreur préparée par simulate() pour le prochain appel. */
  #nextError: 'unreachable' | 'unexpected' | null = null;
  #stopNextCreation = false;

  constructor(options: DemoBoxOptions) {
    this.#passwords = [...options.passwords];
    this.#loginDomain = options.loginDomain;
    this.#firstNameMaxLength = options.firstNameMaxLength;
    this.#delays = { ...DEMO_DELAYS, ...options.delays };
    this.#wait = options.wait ?? sleep;
  }

  simulate(scenario: SimulatedScenario): void {
    switch (scenario) {
      case 'preparing':
      case 'installed':
        this.#nextPhase = scenario;
        break;
      case 'stopped':
        this.#stopNextCreation = true;
        break;
      case 'elsewhere':
      case 'creating':
        // Une autre page a reçu les mots de passe d'exemple, et garde la main.
        this.#ownerPassword = this.#passwords[0] ?? '';
        this.#session = false;
        this.#creating = scenario === 'creating';
        this.#progress = scenario === 'creating' ? HALFWAY : NOTHING_DONE;
        break;
      default:
        this.#nextError = scenario;
    }
  }

  async status(): Promise<BoxStatus> {
    await this.#answer(this.#delays.status);
    const next = this.#nextPhase;
    this.#nextPhase = null;
    if (next) return { phase: next, busy: false };
    if (this.#installed) return { phase: 'installed', busy: false };
    if (this.#creating)
      return { phase: 'creating', busy: !this.#session, progress: this.#progress };
    if (this.#ownerPassword !== null) return { phase: 'registered', busy: !this.#session };
    return { phase: 'ready', busy: false };
  }

  async register(firstNames: readonly string[]): Promise<readonly Account[]> {
    await this.#answer(this.#delays.register);
    // La HAKO vérifie de nouveau ce que la page a déjà vérifié.
    const { firstNames: names, errors } = checkPeople(firstNames, this.#firstNameMaxLength);
    if (
      this.#installed ||
      this.#creating ||
      names.length === 0 ||
      names.length > this.#passwords.length ||
      errors.length > 0
    ) {
      throw new BoxAccessError('unexpected');
    }
    const logins = assignLogins(names, this.#loginDomain);
    const accounts = Object.freeze(
      names.map((firstName, index) =>
        Object.freeze({
          firstName,
          login: logins[index] ?? '',
          owner: index === 0,
          password: this.#passwords[index] ?? '',
        }),
      ),
    );
    // Les mots de passe d'avant ne valent plus ; les comptes déjà créés
    // (après une coupure) seront mis à jour, ligne par ligne.
    this.#ownerPassword = accounts[0]?.password ?? '';
    this.#session = true;
    this.#wrongChecks = 0;
    this.#progress = NOTHING_DONE;
    return accounts;
  }

  async checkSheet(typed: string): Promise<CheckResult> {
    await this.#answer(this.#delays.check);
    if (this.#ownerPassword === null || this.#installed || this.#creating) {
      throw new BoxAccessError('unexpected');
    }
    if (this.#wrongChecks >= MAX_WRONG_CHECKS) return 'blocked';
    if (typed !== this.#ownerPassword) {
      this.#wrongChecks += 1;
      return 'wrong';
    }
    // La fiche sert de preuve : cette page prend la main.
    this.#session = true;
    return 'ok';
  }

  async createAccounts(onProgress: (progress: CreationProgress) => void): Promise<void> {
    await this.#answer(0);
    if (this.#ownerPassword === null || !this.#session || this.#installed || this.#creating) {
      throw new BoxAccessError('unexpected');
    }
    this.#creating = true;
    await this.#run(onProgress);
  }

  async followCreation(onProgress: (progress: CreationProgress) => void): Promise<void> {
    await this.#answer(0);
    if (this.#installed) {
      onProgress(Object.freeze({ photos: 'done', files: 'done', finish: 'done' }));
      return;
    }
    if (!this.#creating) throw new BoxAccessError('interrupted');
    await this.#run(onProgress);
  }

  /** Les lignes qui restent, l'une après l'autre ; puis la HAKO oublie les mots de passe. */
  async #run(onProgress: (progress: CreationProgress) => void): Promise<void> {
    onProgress(this.#progress);
    const remaining = TASK_IDS.filter((task) => this.#progress[task] !== 'done');
    for (const [index, task] of remaining.entries()) {
      this.#setTask(task, 'running', onProgress);
      await this.#wait(this.#delays.task);
      this.#setTask(task, 'done', onProgress);
      if (this.#stopNextCreation && index < remaining.length - 1) {
        // Coupure de courant simulée après une ligne (les comptes des photos,
        // en partant du début) : la HAKO redémarre et a oublié les mots de
        // passe. Les comptes déjà créés le restent : ils seront mis à jour.
        this.#stopNextCreation = false;
        this.#creating = false;
        this.#ownerPassword = null;
        this.#session = false;
        this.#wrongChecks = 0;
        throw new BoxAccessError('interrupted');
      }
    }
    await this.#wait(this.#delays.settle);
    // Comptes créés : la HAKO oublie les mots de passe.
    this.#creating = false;
    this.#ownerPassword = null;
    this.#session = false;
    this.#installed = true;
  }

  #setTask(task: TaskId, state: TaskState, onProgress: (progress: CreationProgress) => void): void {
    this.#progress = Object.freeze({ ...this.#progress, [task]: state });
    onProgress(this.#progress);
  }

  /** Attente d'une réponse, puis l'erreur préparée par simulate(), s'il y en a une. */
  async #answer(delay: number): Promise<void> {
    await this.#wait(delay);
    const error = this.#nextError;
    if (error) {
      this.#nextError = null;
      throw new BoxAccessError(error);
    }
  }
}
