/**
 * Informations manquantes (« TODO »).
 *
 * Toute information que l'équipe n'a pas encore fournie s'écrit
 * `todo('ce qui manque', '[texte provisoire]')` dans les fichiers de
 * src/data/. Le site l'affiche surlignée en jaune (composant <Fact> ou
 * <Todo>), et `npm run todos` la recense dans TODO.md.
 *
 * Pour renseigner l'information, remplacez simplement l'appel :
 *   email: todo('Adresse e-mail de contact', '[adresse e-mail]'),
 * devient
 *   email: 'bonjour@exemple.fr',
 */

export interface TodoValue {
  /** Ce qui manque, en clair (repris dans TODO.md et dans data-todo). */
  readonly todo: string;
  /** Texte provisoire visible, entre crochets : « [durée] », « [Prénom Nom] ». */
  readonly placeholder: string;
}

/** Une valeur connue, ou une information encore manquante. */
export type Maybe<T> = T | TodoValue;

export function todo(what: string, placeholder: string): TodoValue {
  return Object.freeze({ todo: what, placeholder });
}

export function isTodo(value: unknown): value is TodoValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'todo' in value &&
    'placeholder' in value &&
    typeof (value as TodoValue).todo === 'string' &&
    typeof (value as TodoValue).placeholder === 'string'
  );
}
