/**
 * Petits outils pour écrire les textes des pages Offres et Commander.
 *
 * Une phrase s'écrit comme une liste de morceaux (voir RichText dans
 * types.ts). Les montants passent par price(…) : ils s'affichent alors avec
 * le composant <Price>, le seul qui écrit un prix sur le site.
 */
import { isTodo, type Maybe, type TodoValue } from '../todo.ts';
import type { Inline, LinkValue, PriceValue } from './types.ts';

/**
 * Valeur manquante dont la source est déjà recensée ailleurs (un null
 * commenté « // TODO: » dans src/data/tarifs.ts) : même forme que todo(),
 * sans être comptée une seconde fois dans TODO.md.
 */
export function missing(what: string, placeholder: string): TodoValue {
  return Object.freeze({ todo: what, placeholder });
}

/** Valeur du fichier des tarifs (null = pas encore décidé) → valeur connue ou repère jaune. */
export function orMissing<T>(value: T | null | undefined, fallback: TodoValue): Maybe<T> {
  return value === null || value === undefined ? fallback : value;
}

export function price(amountEur: number | null, fallback: TodoValue, per?: 'month'): PriceValue {
  return per ? { amountEur, missing: fallback, per } : { amountEur, missing: fallback };
}

export function isLink(part: unknown): part is LinkValue {
  return typeof part === 'object' && part !== null && 'href' in part && 'label' in part;
}

export function isPrice(part: unknown): part is PriceValue {
  return typeof part === 'object' && part !== null && 'amountEur' in part && 'missing' in part;
}

/** Texte brut d'une phrase (pour un attribut ou un test), repères compris. */
export function plainText(parts: readonly Inline[]): string {
  return parts
    .map((part) => {
      if (typeof part === 'string') return part;
      if (isTodo(part)) return part.placeholder;
      if (isLink(part)) return part.label;
      return part.amountEur === null ? part.missing.placeholder : String(part.amountEur);
    })
    .join('');
}

/** Adresse e-mail : un lien « mailto: » une fois connue, le repère jaune avant. */
export function emailLink(value: Maybe<string>): TodoValue | LinkValue {
  return isTodo(value) ? value : { label: value, href: `mailto:${value}` };
}

/** Numéro de téléphone : un lien « tel: » une fois connu, le repère jaune avant. */
export function phoneLink(value: Maybe<string>): TodoValue | LinkValue {
  return isTodo(value) ? value : { label: value, href: `tel:${value.replace(/[^\d+]/g, '')}` };
}
