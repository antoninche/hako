/**
 * Textes de la page affichée quand une adresse n'existe pas (erreur 404).
 *
 * Typographie : apostrophe ’, espaces insécables avant « : » et à
 * l'intérieur des guillemets « ».
 */
import { routes, type NavLink } from '../data/navigation';

export const erreur404 = {
  meta: {
    title: 'Page introuvable',
    description:
      'Cette page n’existe pas, ou elle a changé d’adresse. Retrouvez l’accueil, nos offres et les réponses aux questions fréquentes, ou contactez-nous.',
  },

  kicker: 'Erreur 404',
  title: 'Cette page est introuvable',
  lead: 'Cette page est vide, comme une boîte qu’on vient d’ouvrir. Son adresse a peut-être changé, ou une lettre s’est glissée de travers.',
  illustrationAlt:
    'La box, ouverte et vide : son socle brun foncé est posé au sol et sa coque blanc perlé flotte au-dessus.',

  linksTitle: 'Quelques chemins pour continuer',
  /** Le premier lien est mis en avant. */
  links: [
    { label: 'Revenir à l’accueil', href: routes.home },
    { label: 'Voir les offres', href: routes.offers },
    { label: 'Lire les questions fréquentes', href: routes.faq },
    { label: 'Nous poser une question', href: routes.contact },
  ] satisfies readonly NavLink[],
} as const;
