/**
 * Largeur à partir de laquelle l'en-tête montre le menu principal au lieu du
 * bouton « Menu ». Une requête média CSS ne peut pas lire cette valeur : les
 * @media (min-width: 64rem) des fichiers CSS et .astro l'écrivent en clair et
 * doivent rester d'accord avec elle. Le script du menu et les tests la lisent ici.
 */
export const WIDE_SCREEN_REM = 64;

/** Requête média correspondante, pour window.matchMedia(). */
export const WIDE_SCREEN_QUERY = `(min-width: ${WIDE_SCREEN_REM}rem)`;
