/**
 * Typographie française de l’accueil : des mots qui ne se séparent jamais en
 * fin de ligne. Une espace insécable remplace l’espace ordinaire ; le texte
 * affiché ne change pas.
 *
 * - Un mot d’une seule lettre (« à », « a », « y ») reste avec le mot suivant :
 *   « restent à la maison » ne se coupe pas en « restent à | la maison ».
 * - Un nom se lit d’un bloc : « Hako Home », « Hako Pro », « Google Photos ».
 *
 *   keepWordsTogether('Vos souvenirs restent à la maison.')
 *   → 'Vos souvenirs restent à\u00a0la maison.'
 */

const NO_BREAK_SPACE = '\u00a0';

// Un mot d’une lettre, précédé d’une espace (ou en début de texte) et suivi
// d’espaces ordinaires puis d’un autre mot.
const SHORT_WORD = /(?<=^|\s)([aàyAÀY]) +(?=\S)/gu;

// Les noms des deux offres, et celui d’un service cité dans les textes.
const NAMES = /\b(?:Hako +(?:Home|Pro)|Google +Photos)\b/g;

export function keepWordsTogether(text: string): string {
  return text
    .replace(SHORT_WORD, `$1${NO_BREAK_SPACE}`)
    .replace(NAMES, (name) => name.replace(/ +/g, NO_BREAK_SPACE));
}
