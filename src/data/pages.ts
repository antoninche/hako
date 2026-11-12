/**
 * Textes propres à chaque page : titre (onglet du navigateur et titre
 * principal de la page), résumé pour les moteurs de recherche, et les
 * quelques phrases des pages provisoires et de la page 404.
 *
 * Chaque page de src/pages/ lit son entrée ici : pour changer un titre ou un
 * résumé, on le modifie dans ce fichier. Les clés sont celles de `routes`
 * (src/data/navigation.ts). On écrit des espaces ordinaires : les espaces
 * insécables et l'apostrophe courbe sont ajoutées à l'affichage
 * (src/lib/typography.ts).
 */
import { withFrenchTypography } from '../lib/typography';

export interface PageText {
  /** Titre de la page, sans « · HAKO » (ajouté par BaseLayout). */
  readonly title: string;
  /** Résumé affiché par les moteurs de recherche (150 caractères environ). */
  readonly description: string;
}

/** Pages du site, sauf l'accueil et la page 404 (plus bas). */
export const pages = withFrenchTypography({
  offers: {
    title: 'Nos offres',
    description:
      'Hako Home pour les familles, Hako Pro pour les petites entreprises : ce que comprend chaque offre.',
  },
  box: {
    title: 'La box',
    description:
      'La box HAKO : un petit serveur assemblé et vérifié à la main en Provence, qui garde vos photos et vos fichiers chez vous.',
  },
  commitment: {
    title: 'Notre engagement',
    description:
      'Nos engagements : nous n’avons pas accès à vos données, et aucun port n’est ouvert vers internet.',
  },
  faq: {
    title: 'Questions fréquentes',
    description: 'Les réponses aux questions fréquentes sur HAKO, la box et son installation.',
  },
  tutorials: {
    title: 'Tutoriels',
    description: 'Des tutoriels vidéo simples pour utiliser votre box HAKO au quotidien.',
  },
  order: {
    title: 'Commander',
    description:
      'Commander votre box HAKO : Hako Home pour les familles ou Hako Pro pour les petites entreprises.',
  },
  contact: {
    title: 'Contact et équipe',
    description: 'Écrire à l’équipe HAKO, une jeune entreprise de trois étudiants en Provence.',
  },
  legalNotice: {
    title: 'Mentions légales',
    description: 'Mentions légales du site HAKO.',
  },
  privacy: {
    title: 'Politique de confidentialité',
    description: 'Politique de confidentialité du site HAKO.',
  },
  terms: {
    title: 'Conditions générales de vente',
    description: 'Conditions générales de vente de HAKO.',
  },
} satisfies Record<string, PageText>);

/** Phrase des pages dont le contenu n'est pas encore écrit. */
export const draftNotice = 'Cette page est en cours de rédaction.';

/** Accueil : le titre de l'onglet reprend l'accroche (src/data/entreprise.ts). */
export const homePage = withFrenchTypography({
  description:
    'HAKO installe chez vous une petite box qui garde les photos et les fichiers de la famille à la maison, et vous aide à la prendre en main.',
  /** Bouton secondaire, à côté de « Commander ». */
  discoverLabel: 'Découvrir la box',
});

/** Page affichée pour une adresse qui n'existe pas. */
export const notFoundPage = withFrenchTypography({
  title: 'Page introuvable',
  heading: 'Cette page est introuvable',
  description: 'Cette page est introuvable.',
  lead: 'L’adresse est peut-être mal saisie, ou la page a changé de place.',
  links: {
    home: 'Revenir à l’accueil',
    offers: 'Voir les offres',
    contact: 'Nous contacter',
  },
});
