/**
 * Typographie française des textes de src/data/, posée une fois pour toutes
 * là où les données sont définies :
 *   export const company: Company = withFrenchTypography({ … });
 *
 * Dans les fichiers de données, on peut donc écrire une espace ordinaire avant
 * « : » ou « ? », et l'apostrophe droite dans un mot :
 * - l'espace avant « : », « ; », « ! », « ? » et « » », et après « « », devient
 *   insécable (U+00A0) ; le site n'écrit jamais l'espace fine insécable, que
 *   ses polices n'ont pas (voir tests/unit/typographie.test.ts) ;
 * - l'apostrophe droite entre deux lettres devient l'apostrophe courbe (’).
 * Seule une espace déjà écrite est remplacée : une adresse (https://…), une
 * heure (10:30) ou une adresse e-mail ne changent pas. Le texte déjà correct
 * reste identique.
 */

/** Applique la typographie française à un texte. */
export function frenchTypography(text: string): string {
  // [^\S\n] : toute espace sauf le retour à la ligne (ordinaire, insécable, fine…).
  return text
    .replace(/(\p{L})'(?=\p{L})/gu, '$1\u2019')
    .replace(/[^\S\n]+(?=[:;!?\u00bb])/g, '\u00a0')
    .replace(/\u00ab[^\S\n]+/g, '\u00ab\u00a0');
}

/**
 * Applique frenchTypography à tous les textes d'un objet de données (objets
 * et listes imbriqués compris) et renvoie une copie figée de même forme.
 */
export function withFrenchTypography<T>(value: T): T {
  if (typeof value === 'string') return frenchTypography(value) as T;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item: unknown) => withFrenchTypography(item))) as T;
  }
  if (value !== null && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) copy[key] = withFrenchTypography(item);
    return Object.freeze(copy) as T;
  }
  return value;
}
