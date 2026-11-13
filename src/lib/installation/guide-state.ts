/**
 * Logique pure du guide d'installation (/installer/) : lecture de l'ancre de
 * l'adresse (#etape-cable), libellés à trous (« {n} étapes faites sur
 * {total} ») et temps du chronomètre.
 *
 * Aucun accès au navigateur ni au DOM : le script de la page
 * (src/components/installation/guide.ts) s'en sert, et
 * tests/unit/installation-guide.test.ts le vérifie avec node --test. D'où les
 * imports avec l'extension .ts et une syntaxe que Node sait effacer (ni enum,
 * ni namespace).
 */

/** Préfixe des ancres des étapes : « etape-cable » pour l'étape « cable ». */
export const STEP_PREFIX = 'etape-';

/** Ancre d'une étape, sans « # » : « etape-cable ». */
export function stepAnchor(id: string): string {
  return `${STEP_PREFIX}${id}`;
}

/** Ancre de l'adresse, sans « # » et décodée ; chaîne vide si elle est illisible. */
export function decodeHash(hash: string): string {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(raw);
  } catch {
    return '';
  }
}

/**
 * Étape désignée par l'ancre (« #etape-cable » donne « cable »), ou null si
 * l'ancre ne désigne aucune des étapes `ids`.
 */
export function stepFromHash(hash: string, ids: readonly string[]): string | null {
  const name = decodeHash(hash);
  if (!name.startsWith(STEP_PREFIX)) return null;
  const id = name.slice(STEP_PREFIX.length);
  return ids.includes(id) ? id : null;
}

/** Remplace « {n} », « {total} »… par leur valeur ; un repère inconnu reste tel quel. */
export function fillTemplate(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (match: string, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

/** Les deux formes d'un libellé de progression. */
export interface ProgressTemplates {
  /** 0 ou 1 étape faite : « {n} étape faite sur {total} ». */
  readonly one: string;
  /** 2 étapes faites ou plus : « {n} étapes faites sur {total} ». */
  readonly many: string;
}

/** « 1 étape faite sur 8 », « 3 étapes faites sur 8 ». */
export function progressText(done: number, total: number, templates: ProgressTemplates): string {
  return fillTemplate(done < 2 ? templates.one : templates.many, { n: done, total });
}

/** Minutes et secondes entières écoulées (jamais négatives). */
export function splitElapsed(ms: number): { readonly minutes: number; readonly seconds: number } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}

/** Temps affiché : « {m} min {s} s », les secondes sur deux chiffres (« 3 min 05 s »). */
export function elapsedText(ms: number, template: string): string {
  const { minutes, seconds } = splitElapsed(ms);
  return fillTemplate(template, { m: minutes, s: String(seconds).padStart(2, '0') });
}

/** Les trois formes du temps lu par les lecteurs d'écran. */
export interface SpokenTemplates {
  /** Moins d'une minute. */
  readonly zero: string;
  /** Une minute. */
  readonly one: string;
  /** Plusieurs minutes : « {n} minutes ». */
  readonly many: string;
}

/**
 * Temps lu par les lecteurs d'écran, en minutes entières : il ne change
 * qu'une fois par minute.
 */
export function spokenElapsed(ms: number, templates: SpokenTemplates): string {
  const { minutes } = splitElapsed(ms);
  if (minutes === 0) return templates.zero;
  return fillTemplate(minutes === 1 ? templates.one : templates.many, { n: minutes });
}
