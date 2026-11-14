/**
 * Petits outils de typographie française pour l'affichage.
 */

export interface TextSegment {
  text: string;
  /** true : à garder sur une seule ligne (classe .nowrap). */
  keep: boolean;
}

/**
 * Découpe un texte pour que les mots composés avec des traits d'union
 * (« Salon-de-Provence », « Aix-en-Provence ») ne soient jamais coupés en
 * fin de ligne. Le texte lui-même ne change pas.
 */
export function keepHyphenatedWords(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(/\p{L}+(?:-\p{L}+)+/gu)) {
    const start = match.index;
    if (start > last) segments.push({ text: text.slice(last, start), keep: false });
    segments.push({ text: match[0], keep: true });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), keep: false });
  return segments;
}
