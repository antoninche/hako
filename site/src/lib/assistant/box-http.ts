/**
 * Accès réel à la HAKO (lot 5 de HakOS) : l'API locale de la première
 * installation, servie par la HAKO elle-même, à la même adresse que sa page.
 * Seule la page construite par `npm run build:box` (box/pages/index.astro)
 * l'importe, jamais le site public : tests/unit/assistant-script.test.ts
 * échoue si ses adresses ou son en-tête de session apparaissent dans dist/.
 *
 * Routes, sous API_BASE, en JSON (MAX_BODY_BYTES au plus), clés de
 * box-access.ts :
 *   GET  status                   → 200 {phase, busy, progress?}
 *   POST register {firstNames}    → 201 {accounts, token}
 *   POST check    {typed}         → 200 {result, token?}
 *   POST accounts {}              → 202 {progress}, puis GET status chaque seconde
 * Erreurs : {error: code}, avec 400 invalid_names, 401 no_session, 409 busy
 * ou wrong_phase, 423 too_many_wrong (check), 503 preparing.
 * Le détail du contrat, pour HakOS : docs/page-box.md.
 *
 * - Même origine seulement : adresses relatives, ni cookie, ni cache, ni
 *   redirection, ni référent. Les POST portent Content-Type:
 *   application/json : un autre site ne peut pas les envoyer sans une
 *   autorisation (CORS) que la HAKO ne donne jamais.
 * - Session : le jeton remis par register (ou par un check réussi depuis un
 *   appareil sans session) reste dans la mémoire de cet objet, et part dans
 *   l'en-tête SESSION_HEADER. Rien n'est gardé sur l'appareil ; la page
 *   rechargée n'a plus la main (écran « installation en cours »).
 * - Signe de vie : tant qu'il a un jeton, cet objet redemande l'état toutes
 *   les 30 secondes (timings.heartbeat). La HAKO lâche la main 2 minutes
 *   après le dernier signe de vie (page fermée) : un autre appareil peut
 *   alors recommencer (décision 9 du lot 5 de HakOS).
 * - Délais : chaque requête a le sien (timings.request) ; au-delà, la HAKO
 *   est injoignable. Pendant la création des comptes, quelques réponses
 *   manquées de suite sont tolérées (Wi-Fi qui hésite), puis la création
 *   est dite arrêtée.
 * - Réponses relues strictement (forme, types, tailles, identifiants
 *   attendus, forme des mots de passe) : toute surprise donne « unexpected ».
 *
 * Correspondance des erreurs (BoxErrorCode) :
 * - pas de réponse, délai dépassé, 502, 503 sans code ou 504 : unreachable
 *   (pendant la création : interrupted) ;
 * - 409 busy : busy ;
 * - 401, 409 wrong_phase, 503 preparing : changed (la page redemande l'état) ;
 *   pour status lui-même, 503 preparing se lit « phase preparing » ;
 * - 423 too_many_wrong, pour check : le résultat « blocked » ;
 * - tout le reste : unexpected.
 */
import {
  BOX_PHASES,
  BoxAccessError,
  TASK_IDS,
  errorCode,
  type Account,
  type BoxAccess,
  type BoxErrorCode,
  type BoxPhase,
  type BoxStatus,
  type CheckResult,
  type CreationProgress,
  type TaskState,
} from './box-access.ts';
import { assignLogins, cleanFirstName } from './household.ts';

/** Adresse de l'API, sur la HAKO (même origine que la page). */
export const API_BASE = '/api/installation/';
/** En-tête qui porte le jeton de la session. */
export const SESSION_HEADER = 'X-Hako-Session';
/** Taille maximale d'une requête ou d'une réponse, en octets. */
export const MAX_BODY_BYTES = 16 * 1024;
/** Jeton de session : 256 bits, en hexadécimal ou en base64url. */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;
/** Mot de passe : quatre mots en minuscules et un nombre de 10 à 99, avec des tirets. */
export const PASSWORD_PATTERN = /^[a-z]+(?:-[a-z]+){3}-[1-9][0-9]$/u;

/** Délais, en millisecondes, et réponses manquées tolérées pendant la création. */
export interface BoxHttpTimings {
  /** Délai de chaque requête. */
  readonly request: number;
  /** Entre deux demandes d'état, pendant la création des comptes. */
  readonly poll: number;
  /** Réponses manquées de suite, pendant la création, avant de la dire arrêtée. */
  readonly pollFailures: number;
  /** Durée au-delà de laquelle une création qui n'en finit pas est dite arrêtée. */
  readonly creation: number;
  /** Entre deux signes de vie (demandes d'état) de la page qui a la main. */
  readonly heartbeat: number;
}

export const BOX_HTTP_TIMINGS: BoxHttpTimings = Object.freeze({
  request: 10_000,
  poll: 1_000,
  pollFailures: 10,
  creation: 30 * 60_000,
  heartbeat: 30_000,
});

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

export interface BoxHttpOptions {
  /** Ce qui suit le prénom dans un identifiant (LOGIN_DOMAIN : « @hako.local »). */
  readonly loginDomain: string;
  readonly timings?: Partial<BoxHttpTimings>;
  /** fetch du navigateur par défaut ; les tests le remplacent. */
  readonly fetch?: Fetch;
  /** Attente : setTimeout par défaut ; les tests la remplacent pour ne pas attendre. */
  readonly wait?: (ms: number) => Promise<void>;
  /** Heure, en millisecondes : Date.now par défaut. */
  readonly now?: () => number;
  /**
   * Répète fn toutes les ms millisecondes et rend de quoi arrêter :
   * setInterval par défaut ; les tests le remplacent.
   */
  readonly every?: (ms: number, fn: () => void) => () => void;
}

/** Réponse de la HAKO : code HTTP, et corps JSON s'il se lit. */
interface Reply {
  readonly status: number;
  readonly data: Readonly<Record<string, unknown>> | null;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const repeat = (ms: number, fn: () => void): (() => void) => {
  const timer = setInterval(fn, ms);
  return () => {
    clearInterval(timer);
  };
};

const fail = (code: BoxErrorCode, cause?: unknown): BoxAccessError =>
  new BoxAccessError(code, cause === undefined ? undefined : { cause });

const byteLength = (text: string): number => new TextEncoder().encode(text).length;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const TASK_STATES: readonly TaskState[] = ['waiting', 'running', 'done'];

const ALL_DONE: CreationProgress = Object.freeze({ photos: 'done', files: 'done', finish: 'done' });

/** Avancement lu dans une réponse, ou null s'il n'a pas la bonne forme. */
function readProgress(value: unknown): CreationProgress | null {
  if (!isRecord(value)) return null;
  const progress: Partial<Record<(typeof TASK_IDS)[number], TaskState>> = {};
  for (const task of TASK_IDS) {
    const state = value[task];
    if (!TASK_STATES.includes(state as TaskState)) return null;
    progress[task] = state as TaskState;
  }
  return Object.freeze(progress as CreationProgress);
}

const sameProgress = (a: CreationProgress, b: CreationProgress): boolean =>
  TASK_IDS.every((task) => a[task] === b[task]);

/** Code d'erreur écrit par la HAKO ({"error": "busy"}), ou null. */
const errorOf = (reply: Reply): string | null =>
  typeof reply.data?.['error'] === 'string' ? reply.data['error'] : null;

/** Erreur qui correspond à une réponse refusée. */
function refusal(reply: Reply): BoxAccessError {
  const code = errorOf(reply);
  switch (reply.status) {
    case 401:
      return fail('changed');
    case 409:
      if (code === 'busy') return fail('busy');
      return fail(code === 'wrong_phase' ? 'changed' : 'unexpected');
    case 503:
      return fail(code === 'preparing' ? 'changed' : 'unreachable');
    case 502:
    case 504:
      return fail('unreachable');
    default:
      return fail('unexpected');
  }
}

export class BoxHttpAccess implements BoxAccess {
  readonly mode = 'box';

  readonly #loginDomain: string;
  readonly #timings: BoxHttpTimings;
  readonly #fetch: Fetch;
  readonly #wait: (ms: number) => Promise<void>;
  readonly #now: () => number;
  readonly #every: (ms: number, fn: () => void) => () => void;
  /** Jeton de la session de cet appareil, dans la mémoire de la page seulement. */
  #token: string | null = null;
  /** Arrête les signes de vie ; null tant qu'il n'y en a pas. */
  #stopHeartbeat: (() => void) | null = null;
  /** Un signe de vie attend encore sa réponse. */
  #beating = false;

  constructor(options: BoxHttpOptions) {
    this.#loginDomain = options.loginDomain;
    this.#timings = { ...BOX_HTTP_TIMINGS, ...options.timings };
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.#wait = options.wait ?? sleep;
    this.#now = options.now ?? (() => Date.now());
    this.#every = options.every ?? repeat;
  }

  /** Garde le jeton ; les signes de vie durent tant qu'il y en a un. */
  #setToken(token: string | null): void {
    this.#token = token;
    if (token === null) {
      this.#stopHeartbeat?.();
      this.#stopHeartbeat = null;
    } else {
      this.#stopHeartbeat ??= this.#every(this.#timings.heartbeat, () => {
        void this.#beat();
      });
    }
  }

  /** Un signe de vie : une demande d'état, avec le jeton. Ses erreurs sont sans suite. */
  async #beat(): Promise<void> {
    if (this.#token === null || this.#beating) return;
    this.#beating = true;
    try {
      await this.status();
    } catch {
      // La page verra le problème à sa prochaine demande.
    } finally {
      this.#beating = false;
    }
  }

  async status(): Promise<BoxStatus> {
    const reply = await this.#request('GET', 'status');
    if (reply.status === 503 && errorOf(reply) === 'preparing') {
      return { phase: 'preparing', busy: false };
    }
    if (reply.status !== 200) {
      // Une réponse d'état n'est jamais « changed » : la page redemanderait sans fin.
      const error = refusal(reply);
      throw error.code === 'changed' ? fail('unexpected') : error;
    }
    const data = reply.data ?? {};
    const phase = data['phase'];
    const busy = data['busy'];
    if (!BOX_PHASES.includes(phase as BoxPhase) || typeof busy !== 'boolean') {
      throw fail('unexpected');
    }
    if (phase === 'installed') this.#setToken(null);
    if (phase !== 'creating' || data['progress'] === undefined) {
      return { phase: phase as BoxPhase, busy };
    }
    const progress = readProgress(data['progress']);
    if (!progress) throw fail('unexpected');
    return { phase: 'creating', busy, progress };
  }

  async register(firstNames: readonly string[]): Promise<readonly Account[]> {
    const reply = await this.#request('POST', 'register', { firstNames: [...firstNames] });
    if (reply.status !== 201) throw refusal(reply);
    const data = reply.data ?? {};
    const token = data['token'];
    const list = data['accounts'];
    if (typeof token !== 'string' || !TOKEN_PATTERN.test(token) || !Array.isArray(list)) {
      throw fail('unexpected');
    }
    // Les identifiants doivent être ceux que la page a montrés sous les prénoms.
    const names = firstNames.map(cleanFirstName);
    const logins = assignLogins(names, this.#loginDomain);
    if (list.length !== names.length) throw fail('unexpected');
    const accounts = list.map((item: unknown, index): Account => {
      if (
        !isRecord(item) ||
        item['firstName'] !== names[index] ||
        item['login'] !== logins[index] ||
        item['owner'] !== (index === 0) ||
        typeof item['password'] !== 'string' ||
        !PASSWORD_PATTERN.test(item['password'])
      ) {
        throw fail('unexpected');
      }
      return Object.freeze({
        firstName: names[index] ?? '',
        login: logins[index] ?? '',
        owner: index === 0,
        password: item['password'],
      });
    });
    this.#setToken(token);
    return Object.freeze(accounts);
  }

  async checkSheet(typed: string): Promise<CheckResult> {
    const reply = await this.#request('POST', 'check', { typed });
    if (reply.status === 423 && errorOf(reply) === 'too_many_wrong') return 'blocked';
    if (reply.status !== 200) throw refusal(reply);
    const result = reply.data?.['result'];
    const token = reply.data?.['token'];
    if (result !== 'ok' && result !== 'wrong') throw fail('unexpected');
    if (token !== undefined && (typeof token !== 'string' || !TOKEN_PATTERN.test(token))) {
      throw fail('unexpected');
    }
    // La fiche sert de preuve : un appareil sans session reçoit la main.
    if (result === 'ok' && typeof token === 'string') this.#setToken(token);
    return result;
  }

  async createAccounts(onProgress: (progress: CreationProgress) => void): Promise<void> {
    const reply = await this.#request('POST', 'accounts', {});
    if (reply.status !== 202) throw refusal(reply);
    const progress = readProgress(reply.data?.['progress']);
    if (!progress) throw fail('unexpected');
    onProgress(progress);
    await this.#follow(progress, onProgress);
  }

  async followCreation(onProgress: (progress: CreationProgress) => void): Promise<void> {
    await this.#follow(null, onProgress);
  }

  /** Demande l'état chaque seconde, jusqu'à la fin de la création des comptes. */
  async #follow(
    start: CreationProgress | null,
    onProgress: (progress: CreationProgress) => void,
  ): Promise<void> {
    const deadline = this.#now() + this.#timings.creation;
    let last = start;
    let missed = 0;
    for (;;) {
      await this.#wait(this.#timings.poll);
      if (this.#now() > deadline) throw fail('interrupted');
      let status: BoxStatus;
      try {
        status = await this.status();
        missed = 0;
      } catch (error) {
        if (errorCode(error) !== 'unreachable') throw error;
        missed += 1;
        if (missed >= this.#timings.pollFailures) throw fail('interrupted', error);
        continue;
      }
      if (status.phase === 'installed') {
        if (!last || !sameProgress(last, ALL_DONE)) onProgress(ALL_DONE);
        return;
      }
      // Revenue à « registered » (arrêtée), à « ready » (redémarrée) ou en
      // préparation : la création s'est arrêtée.
      if (status.phase !== 'creating') throw fail('interrupted');
      if (status.progress && (!last || !sameProgress(last, status.progress))) {
        last = status.progress;
        onProgress(last);
      }
    }
  }

  /** Une requête à l'API : réponse lue, ou « unreachable » si rien ne vient à temps. */
  async #request(method: 'GET' | 'POST', route: string, body?: unknown): Promise<Reply> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.#token !== null) headers[SESSION_HEADER] = this.#token;
    const init: RequestInit = {
      method,
      headers,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      mode: 'same-origin',
    };
    if (body !== undefined) {
      const payload = JSON.stringify(body);
      if (byteLength(payload) > MAX_BODY_BYTES) throw fail('unexpected');
      headers['Content-Type'] = 'application/json';
      init.body = payload;
    }
    const controller = new AbortController();
    init.signal = controller.signal;
    const timer = setTimeout(() => {
      controller.abort();
    }, this.#timings.request);
    let status: number;
    let type: string;
    let text: string;
    try {
      const response = await this.#fetch(`${API_BASE}${route}`, init);
      status = response.status;
      type = response.headers.get('Content-Type') ?? '';
      text = await response.text();
    } catch (error) {
      throw fail('unreachable', error);
    } finally {
      clearTimeout(timer);
    }
    if (!/^application\/json\b/iu.test(type) || byteLength(text) > MAX_BODY_BYTES) {
      if (status >= 200 && status < 300) throw fail('unexpected');
      return { status, data: null };
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (error) {
      if (status >= 200 && status < 300) throw fail('unexpected', error);
      return { status, data: null };
    }
    if (!isRecord(data)) {
      if (status >= 200 && status < 300) throw fail('unexpected');
      return { status, data: null };
    }
    return { status, data };
  }
}
