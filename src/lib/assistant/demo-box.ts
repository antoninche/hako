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
 * - Ce qui arrive rarement se provoque avec simulate() : HAKO qui se prépare
 *   encore ou déjà installée, HAKO qui ne répond plus, réponse inattendue,
 *   création des comptes qui s'arrête après les comptes des photos (et qui
 *   reprend là où elle s'était arrêtée).
 *
 * Les faits (mots de passe d'exemple, domaine des identifiants, limites)
 * sont passés au constructeur : le script de la page les lit dans le HTML,
 * les tests dans src/data/assistant.ts. Ce module n'importe aucun texte.
 */
import {
  BoxAccessError,
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

export class DemoBoxAccess implements SimulatedBoxAccess {
  readonly mode = 'demo';

  readonly #passwords: readonly string[];
  readonly #loginDomain: string;
  readonly #firstNameMaxLength: number;
  readonly #delays: DemoDelays;
  readonly #wait: (ms: number) => Promise<void>;

  #installed = false;
  #accounts: readonly Account[] | null = null;
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
    if (scenario === 'preparing' || scenario === 'installed') this.#nextPhase = scenario;
    else if (scenario === 'stopped') this.#stopNextCreation = true;
    else this.#nextError = scenario;
  }

  async status(): Promise<BoxStatus> {
    await this.#answer(this.#delays.status);
    const phase = this.#nextPhase ?? (this.#installed ? 'installed' : 'ready');
    this.#nextPhase = null;
    return { phase };
  }

  async register(firstNames: readonly string[]): Promise<readonly Account[]> {
    await this.#answer(this.#delays.register);
    // La HAKO vérifie de nouveau ce que la page a déjà vérifié.
    const { firstNames: names, errors } = checkPeople(firstNames, this.#firstNameMaxLength);
    if (
      this.#installed ||
      names.length === 0 ||
      names.length > this.#passwords.length ||
      errors.length > 0
    ) {
      throw new BoxAccessError('unexpected');
    }
    const logins = assignLogins(names, this.#loginDomain);
    this.#accounts = Object.freeze(
      names.map((firstName, index) =>
        Object.freeze({
          firstName,
          login: logins[index] ?? '',
          owner: index === 0,
          password: this.#passwords[index] ?? '',
        }),
      ),
    );
    this.#progress = NOTHING_DONE;
    return this.#accounts;
  }

  async checkSheet(typed: string): Promise<CheckResult> {
    await this.#answer(this.#delays.check);
    const owner = this.#accounts?.[0];
    if (!owner || this.#installed) throw new BoxAccessError('unexpected');
    return typed === owner.password ? 'ok' : 'wrong';
  }

  async createAccounts(onProgress: (progress: CreationProgress) => void): Promise<void> {
    await this.#answer(0);
    if (!this.#accounts || this.#installed) throw new BoxAccessError('unexpected');
    onProgress(this.#progress);
    const remaining = TASK_IDS.filter((task) => this.#progress[task] !== 'done');
    for (const [index, task] of remaining.entries()) {
      this.#setTask(task, 'running', onProgress);
      await this.#wait(this.#delays.task);
      this.#setTask(task, 'done', onProgress);
      if (this.#stopNextCreation && index < remaining.length - 1) {
        // Coupure simulée après une ligne (les comptes des photos, en partant
        // du début) : ce qui est fait reste fait, la suite attend « Réessayer ».
        this.#stopNextCreation = false;
        throw new BoxAccessError('interrupted');
      }
    }
    await this.#wait(this.#delays.settle);
    // Comptes créés : la HAKO oublie les mots de passe.
    this.#accounts = null;
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
