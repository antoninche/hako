/**
 * Mise en forme des nombres du site, à la française : « 600 € », « 1 000 € »,
 * « 381,50 € », « 30 % », « 12,2 ».
 *
 * C'est le seul endroit du site qui met un nombre en forme : prix,
 * pourcentages et autres nombres s'écrivent donc partout de la même façon.
 * Les prix eux-mêmes sont dans src/data/tarifs.ts, et ce qui s'affiche à la
 * place d'un prix pas encore fixé dans src/data/faits.ts (missingPrice).
 *
 * Les espaces d'un nombre sont insécables (U+00A0) : « 1 000 € » n'est
 * jamais coupé en fin de ligne. Intl.NumberFormat met, lui, une espace fine
 * insécable entre les milliers et avant « % » ; aucune police du site n'a ce
 * caractère, et le navigateur le dessinerait alors avec une police du
 * système, si étroit que « 1 000 € » se lirait « 1000 € ». Chaque espace
 * produite par Intl devient donc l'espace insécable ordinaire, que les trois
 * polices contiennent. Le test tests/unit/typographie.test.ts vérifie
 * qu'aucun fichier de src/ n'écrit ce caractère (ni le trait d'union
 * insécable, absent lui aussi des polices), et que seul ce fichier utilise
 * Intl pour écrire un nombre.
 *
 * Ce fichier ne contient aucun texte du site : seulement la mise en forme.
 */

const NO_BREAK_SPACE = '\u00A0';

/** Toute espace d'un nombre mis en forme (milliers, avant « € » ou « % ») devient insécable. */
function withNoBreakSpaces(text: string): string {
  return text.replace(/\s/gu, NO_BREAK_SPACE);
}

const euros = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const eurosAndCents = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const lists = {
  and: new Intl.ListFormat('fr-FR', { style: 'long', type: 'conjunction' }),
  or: new Intl.ListFormat('fr-FR', { style: 'long', type: 'disjunction' }),
} as const;

/** Montant en euros : sans centimes s'il est rond (« 1 000 € »), avec sinon (« 381,50 € »). */
export function formatEur(amount: number): string {
  const format = Number.isInteger(amount) ? euros : eurosAndCents;
  return withNoBreakSpaces(format.format(amount));
}

/** Pourcentage écrit comme dans le fichier des tarifs : 30 → « 30 % », 37,5 → « 37,5 % ». */
export function formatPercent(value: number): string {
  return withNoBreakSpaces(percent.format(value / 100));
}

/**
 * Nombre simple : 1500 → « 1 500 ». Avec `fractionDigits`, toujours ce
 * nombre de décimales : formatNumber(12.18, 1) → « 12,2 ».
 */
export function formatNumber(value: number, fractionDigits?: number): string {
  const options: Intl.NumberFormatOptions =
    fractionDigits === undefined
      ? {}
      : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits };
  return withNoBreakSpaces(new Intl.NumberFormat('fr-FR', options).format(value));
}

/**
 * Énumération : ['2 To', '4 To'] → « 2 To et 4 To », ou « 2 To ou 4 To »
 * avec 'or'. Les espaces entre les mots restent ordinaires : la liste peut
 * passer à la ligne.
 */
export function formatList(items: readonly string[], kind: 'and' | 'or' = 'and'): string {
  return lists[kind].format(items);
}
