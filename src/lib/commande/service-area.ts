/**
 * Zone d'intervention : de Salon-de-Provence à Toulon, en passant par
 * Aix-en-Provence et Marseille.
 *
 * Le formulaire de commande prévient la personne quand son code postal semble
 * hors de cette zone, sans jamais bloquer sa demande.
 */

/**
 * Départements considérés comme « dans la zone » : Bouches-du-Rhône (13) et Var (83).
 *
 * Règle choisie par l'équipe : ces deux départements débordent un peu de la
 * zone annoncée (Arles, Draguignan, Fréjus…), et c'est voulu : le formulaire
 * ne prévient que pour un code postal hors du 13 et du 83. Pour la changer,
 * seule cette constante est à modifier.
 */
export const SERVICE_AREA_DEPARTMENTS: readonly string[] = ['13', '83'];

/** Retire les espaces : « 13 100 » devient « 13100 ». */
export function normalizePostalCode(value: string): string {
  return value.replace(/\s+/g, '');
}

/** Code postal français : exactement 5 chiffres. */
export function isPostalCode(value: string): boolean {
  return /^\d{5}$/.test(normalizePostalCode(value));
}

/** Département d'un code postal : « 13100 » → « 13 » ; outre-mer : « 97400 » → « 974 ». */
export function departmentOf(postalCode: string): string | null {
  const code = normalizePostalCode(postalCode);
  if (!isPostalCode(code)) return null;
  return code.startsWith('97') || code.startsWith('98') ? code.slice(0, 3) : code.slice(0, 2);
}

/**
 * Vrai si le code postal est complet et semble hors de la zone. Un code
 * incomplet ou mal saisi ne déclenche rien : on ne juge que ce qui est lisible.
 */
export function isOutsideServiceArea(
  postalCode: string,
  departments: readonly string[] = SERVICE_AREA_DEPARTMENTS,
): boolean {
  const department = departmentOf(postalCode);
  return department !== null && !departments.includes(department);
}
