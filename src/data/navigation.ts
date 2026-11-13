/**
 * Liens du site : menu de l'en-tête, plan du site (pied de page) et pages légales.
 *
 * Pour renommer un lien, changez son `label`. Pour en ajouter un, ajoutez une
 * ligne dans la liste voulue : l'adresse (`href`) doit correspondre à une page
 * de src/pages/ et se terminer par « / ».
 */

export interface NavLink {
  /** Texte du lien, tel qu'il s'affiche. */
  readonly label: string;
  /** Adresse de la page, toujours terminée par « / ». */
  readonly href: string;
}

/** Adresses de toutes les pages publiques. */
export const routes = {
  home: '/',
  offers: '/offres/',
  box: '/la-box/',
  commitment: '/engagement/',
  faq: '/faq/',
  tutorials: '/tutoriels/',
  install: '/installer/',
  installDemo: '/installer/demonstration/',
  order: '/commander/',
  contact: '/contact/',
  legalNotice: '/mentions-legales/',
  privacy: '/confidentialite/',
  terms: '/cgv/',
} as const;

const offers: NavLink = { label: 'Offres', href: routes.offers };
const box: NavLink = { label: 'La HAKO', href: routes.box };
const commitment: NavLink = { label: 'Notre engagement', href: routes.commitment };
const faq: NavLink = { label: 'FAQ', href: routes.faq };
const tutorials: NavLink = { label: 'Tutoriels', href: routes.tutorials };
const install: NavLink = { label: 'Installer votre HAKO', href: routes.install };
const contact: NavLink = { label: 'Contact', href: routes.contact };

/** Bouton « Commander », toujours visible dans l'en-tête et dans le menu mobile. */
export const orderLink: NavLink = { label: 'Commander', href: routes.order };

/**
 * Menu de l'en-tête (ordre d'affichage). « Installer votre HAKO » y figure
 * pour la personne qui vient de recevoir sa box : elle cherche le guide en
 * haut de la page, pas dans le pied de page.
 */
export const mainNav: readonly NavLink[] = [offers, box, commitment, faq, install, contact];

/** Plan du site, dans le pied de page. */
export const footerNav: readonly NavLink[] = [
  offers,
  box,
  commitment,
  faq,
  tutorials,
  install,
  orderLink,
  contact,
];

/** Pages légales, en bas du pied de page. */
export const legalNav: readonly NavLink[] = [
  { label: 'Mentions légales', href: routes.legalNotice },
  { label: 'Confidentialité', href: routes.privacy },
  { label: 'Conditions générales de vente', href: routes.terms },
];

/** Vrai si `href` désigne la page affichée (`pathname` vient de Astro.url). */
export function isCurrentPage(href: string, pathname: string): boolean {
  const withSlash = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return withSlash === href;
}

/**
 * Vrai si la page affichée est rangée sous `href`, sans être `href` lui-même :
 * /installer/demonstration/ est rangée sous /installer/. L'accueil ne range
 * aucune page.
 */
export function isInSection(href: string, pathname: string): boolean {
  const withSlash = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return href !== routes.home && withSlash !== href && withSlash.startsWith(href);
}
