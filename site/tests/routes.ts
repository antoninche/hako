/**
 * Pages du site et repères communs à tous les tests.
 *
 * Cette liste est le contrat : chaque page publiée doit y figurer (et
 * chaque page listée doit exister). Pour une nouvelle page, ajoutez une
 * ligne ; les tests, les contrôles d'accessibilité et les captures la
 * prennent en compte automatiquement.
 */

import { WIDE_SCREEN_REM } from '../src/lib/breakpoints';

export interface SiteRoute {
  /** Adresse de la page, toujours terminée par « / ». */
  readonly path: string;
  /** Nom court, utilisé pour les captures : qa/screenshots/<slug>-<largeur>.png. */
  readonly slug: string;
}

export const routes: readonly SiteRoute[] = [
  { path: '/', slug: 'accueil' },
  { path: '/offres/', slug: 'offres' },
  { path: '/la-box/', slug: 'la-box' },
  { path: '/engagement/', slug: 'engagement' },
  { path: '/faq/', slug: 'faq' },
  { path: '/tutoriels/', slug: 'tutoriels' },
  { path: '/installer/', slug: 'installer' },
  { path: '/installer/demonstration/', slug: 'installer-demonstration' },
  { path: '/commander/', slug: 'commander' },
  { path: '/contact/', slug: 'contact' },
  { path: '/mentions-legales/', slug: 'mentions-legales' },
  { path: '/confidentialite/', slug: 'confidentialite' },
  { path: '/cgv/', slug: 'cgv' },
  { path: '/charte/', slug: 'charte' },
];

/** Adresse qui n'existe pas : le serveur doit répondre par la page 404. */
export const notFound: SiteRoute = { path: '/cette-page-n-existe-pas/', slug: '404' };

/** Menu principal de l'en-tête, dans l'ordre d'affichage. */
export const mainNav = [
  { label: 'Offres', path: '/offres/' },
  { label: 'Votre HAKO', path: '/la-box/' },
  { label: 'Notre engagement', path: '/engagement/' },
  { label: 'FAQ', path: '/faq/' },
  { label: 'Installer votre HAKO', path: '/installer/' },
  { label: 'Contact', path: '/contact/' },
] as const;

/** Page de commande, cible des boutons « Commander ». */
export const orderPath = '/commander/';

/** Écrans de référence. */
export const MOBILE = { width: 390, height: 844 } as const;
export const DESKTOP = { width: 1440, height: 900 } as const;

/** Largeur à partir de laquelle le menu principal remplace le bouton « Menu » (64rem). */
export const WIDE_SCREEN = WIDE_SCREEN_REM * 16;
