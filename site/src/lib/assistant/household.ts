/**
 * Les personnes de la maison, sur la page de la HAKO qui fait la première
 * installation : les prénoms tapés, leur vérification, et l'identifiant de
 * chaque personne.
 *
 * Règles (src/data/assistant.ts, textes dans src/content/assistant.ts) :
 * - un prénom ne contient que des lettres, et si besoin des espaces, des
 *   traits d'union ou des apostrophes entre deux lettres ; les espaces en
 *   trop sont retirées ;
 * - l'identifiant est le prénom en minuscules, sans accent ni espace, suivi
 *   du nom de la HAKO (« Hélène » donne helene@hako.local). Les apostrophes
 *   sont retirées aussi : sur un téléphone, la même touche donne ' ou ’, et
 *   l'identifiant doit se taper sans hésiter. Le trait d'union reste
 *   (« Jean-Marc » donne jean-marc@hako.local) ;
 * - deux personnes au même identifiant : la deuxième reçoit « 2 », la
 *   troisième « 3 »… (camille2@hako.local). Ce n'est pas une erreur, mais la
 *   page dit pourquoi (takenBy) : Zoé et Zoë donnent aussi le même ;
 * - un prénom sans aucune lettre de l'alphabet latin ne donnerait aucun
 *   identifiant lisible : il est refusé comme un caractère non accepté.
 *
 * Logique pure, sans navigateur : le script de la page, la HAKO simulée et
 * tests/unit/assistant-household.test.ts s'en servent. Aucun texte affiché
 * ici : seulement des codes (« missing », « tooLong »…), que la page traduit
 * avec ses propres textes.
 */

/** Lettres (accents compris), séparées au besoin par une espace, un trait d'union ou une apostrophe. */
export const FIRST_NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '’-][\p{L}\p{M}]+)*$/u;

/** Longueur maximale d'un nom de compte de Nextcloud (vérification technique du 13 novembre 2026). */
export const MAX_LOGIN_LENGTH = 64;

/** Raisons de refuser un prénom. */
export type FirstNameError = 'missing' | 'tooLong' | 'characters';

/** Raisons de refuser la liste des personnes : celles d'un prénom, et le prénom de la personne responsable qui manque. */
export type PeopleErrorCode = FirstNameError | 'ownerMissing';

/** Un prénom refusé, par son rang dans la liste (0 : la personne responsable). */
export interface PersonError {
  readonly index: number;
  readonly code: PeopleErrorCode;
}

/** Prénom nettoyé : forme Unicode composée, sans espace au début ni à la fin, ni espaces doublées. */
export function cleanFirstName(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

/** Lettres que la décomposition Unicode ne ramène pas à une lettre sans accent. */
const SPECIAL_LETTERS: Readonly<Record<string, string>> = {
  æ: 'ae',
  œ: 'oe',
  ß: 'ss',
  ø: 'o',
  đ: 'd',
  ð: 'd',
  ł: 'l',
  þ: 'th',
  ı: 'i',
};

/**
 * Début de l'identifiant tiré d'un prénom : minuscules, sans accent, sans
 * espace ni apostrophe. Chaîne vide si le prénom n'a aucune lettre latine.
 */
export function loginBase(firstName: string): string {
  let ascii = '';
  for (const char of cleanFirstName(firstName).toLowerCase().normalize('NFD')) {
    if (/\p{M}/u.test(char)) continue;
    ascii += SPECIAL_LETTERS[char] ?? char;
  }
  return ascii
    .replace(/[^a-z-]/gu, '')
    .replace(/-{2,}/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

/** Raison de refuser un prénom (déjà nettoyé), ou null s'il est accepté. */
export function firstNameError(firstName: string, maxLength: number): FirstNameError | null {
  if (firstName === '') return 'missing';
  if ([...firstName].length > maxLength) return 'tooLong';
  if (!FIRST_NAME_PATTERN.test(firstName) || loginBase(firstName) === '') return 'characters';
  return null;
}

/** Prénoms nettoyés, et ceux qui sont refusés. */
export interface PeopleCheck {
  readonly firstNames: readonly string[];
  readonly errors: readonly PersonError[];
}

/**
 * Vérifie les prénoms tapés, dans l'ordre : le premier est celui de la
 * personne responsable. Deux prénoms identiques sont acceptés (voir
 * assignLogins).
 */
export function checkPeople(rawNames: readonly string[], maxLength: number): PeopleCheck {
  const firstNames = rawNames.map(cleanFirstName);
  const errors: PersonError[] = [];
  firstNames.forEach((firstName, index) => {
    const error = firstNameError(firstName, maxLength);
    if (error === null) return;
    errors.push({ index, code: index === 0 && error === 'missing' ? 'ownerMissing' : error });
  });
  return { firstNames, errors };
}

/**
 * Identifiants des personnes, dans l'ordre des prénoms : le prénom en
 * minuscules sans accent, puis « 2 », « 3 »… pour un identifiant déjà pris,
 * puis le domaine (« @hako.local »). Un prénom refusé reçoit une chaîne vide.
 * Chaque identifiant tient en MAX_LOGIN_LENGTH caractères.
 */
export function assignLogins(firstNames: readonly string[], domain: string): string[] {
  // Place gardée pour le chiffre ajouté (de 2 à 9 : huit personnes au plus).
  const room = Math.max(1, MAX_LOGIN_LENGTH - domain.length - 1);
  const taken = new Set<string>();
  return firstNames.map((firstName) => {
    const base = loginBase(firstName).slice(0, room).replace(/-+$/u, '');
    if (base === '') return '';
    let candidate = base;
    for (let rank = 2; taken.has(candidate); rank += 1) candidate = `${base}${rank}`;
    taken.add(candidate);
    return `${candidate}${domain}`;
  });
}

/**
 * Pour chaque personne, le rang de celle qui a déjà l'identifiant sans
 * chiffre, quand le sien en a reçu un (« Zoë » après « Zoé ») ; null sinon.
 * Mêmes prénoms et même ordre que assignLogins.
 */
export function takenBy(firstNames: readonly string[], domain: string): (number | null)[] {
  const logins = assignLogins(firstNames, domain);
  return logins.map((login, index) => {
    if (login === '') return null;
    const plain = login.slice(0, login.length - domain.length).replace(/\d+$/u, '') + domain;
    if (plain === login) return null;
    const owner = logins.indexOf(plain);
    return owner === -1 || owner >= index ? null : owner;
  });
}

/**
 * Vrai si le prénom commence par une voyelle ou un h : « d’Hélène », mais
 * « de Marc ». La page choisit ainsi entre ses deux textes (common.of).
 */
export function elides(firstName: string): boolean {
  return /^[aeiouhàâäéèêëîïôöùûüœæ]/iu.test(firstName.trim());
}

/**
 * Morceaux d'un mot de passe, coupé seulement devant ses tirets : la page
 * les met bout à bout, avec une coupure de ligne possible entre deux. Une
 * ligne ne finit donc jamais par un tiret, que l'on prendrait pour une
 * coupure de mot (« exemple-tulipe-melon » puis « -givre-00 »).
 */
export function passwordChunks(password: string): string[] {
  return password.split(/(?=-)/u).filter((chunk) => chunk !== '');
}

/** Morceaux d'un identifiant : le prénom, puis « @hako.local », qui ne se coupe pas. */
export function loginChunks(login: string): string[] {
  const at = login.indexOf('@');
  return at <= 0 ? [login] : [login.slice(0, at), login.slice(at)];
}

/** Raisons de refuser le mot de passe recopié avant de le montrer à la HAKO. */
export type TypedPasswordError = 'empty' | 'uppercase' | 'space' | 'character';

/**
 * Contrôles faits sur l'appareil avant de demander à la HAKO : un mot de
 * passe n'a ni majuscule, ni espace, ni rien d'autre que des lettres de a à z,
 * des chiffres et des tirets. Sur un clavier d'ordinateur français, un
 * chiffre tapé sans la touche Maj donne « à », « é » ou « & » : c'est le
 * refus « character ». Ces refus ne comptent pas comme des essais faux.
 */
export function typedPasswordError(typed: string): TypedPasswordError | null {
  if (typed === '') return 'empty';
  if (/\p{Lu}/u.test(typed)) return 'uppercase';
  if (/\s/u.test(typed)) return 'space';
  if (/[^a-z0-9-]/u.test(typed)) return 'character';
  return null;
}
