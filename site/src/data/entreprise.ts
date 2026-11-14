/**
 * Informations sur l'entreprise, réunies en un seul endroit.
 *
 * Tout ce qui n'est pas encore connu s'écrit todo('ce qui manque', '[texte provisoire]') :
 * le site l'affiche surligné en jaune et `npm run todos` le recense dans TODO.md.
 * Quand l'information arrive, remplacez tout l'appel todo(…) par la valeur
 * entre apostrophes droites, par exemple :
 *   phone: todo('Numéro de téléphone de contact', '[numéro de téléphone]'),
 * devient
 *   phone: '04 00 00 00 00',
 *
 * Typographie : écrivez des espaces ordinaires ; les espaces insécables avant
 * « : » et à l'intérieur des guillemets « » sont ajoutées à l'affichage
 * (src/lib/typography.ts). Pour l'apostrophe, écrivez ’. Si vous tapez
 * l'apostrophe droite ('), entourez le texte de guillemets doubles
 * ("quelqu'un") : entre apostrophes droites, elle fermerait le texte et la
 * construction du site échouerait.
 *
 * La forme de ces informations est décrite dans src/data/types.ts.
 */
import { todo } from '../lib/todo';
import { withFrenchTypography } from '../lib/typography';
import type { Company } from './types';

export const company: Company = withFrenchTypography<Company>({
  name: 'HAKO',
  kanji: '箱',
  nameMeaning: 'Hako (箱) veut dire « boîte » en japonais.',
  headline: 'Vos souvenirs restent à la maison.',
  promise: 'Nous installons la box chez vous, de Salon-de-Provence à Toulon.',

  email: 'antonin.chenavaz@etu.univ-amu.fr',
  // Le numéro n'est pas affiché comme moyen de contact (décision des
  // fondateurs) : seules les mentions légales le demandent encore.
  phone: todo('Numéro de téléphone de contact', '[numéro de téléphone]'),
  domain: todo('Nom de domaine du site', '[nom de domaine]'),

  serviceArea: {
    sentence:
      'Nous intervenons de Salon-de-Provence à Toulon, en passant par Aix-en-Provence et Marseille.',
    outside:
      'bientôt, nous vous enverrons la box, et vous l’installerez vous-même avec notre guide pas à pas et nos tutoriels vidéo',
  },

  // Seuls les réseaux où HAKO a un compte (décision des fondateurs du 14/11 :
  // ni Facebook, ni Instagram, ni PeerTube).
  social: [
    {
      id: 'linkedin',
      name: 'LinkedIn',
      url: 'https://www.linkedin.com/company/box-hako/',
    },
    {
      id: 'youtube',
      name: 'YouTube',
      url: 'https://www.youtube.com/@hako-v1k',
    },
  ],

  founders: [
    {
      role: 'Logiciel & système',
      name: 'Antonin Chenavaz',
      portrait: '/equipe/antonin.jpg',
      bio: 'Étudiant en licence MPCI (mathématiques, physique, chimie, informatique) à Aix-Marseille Université.',
      linkedin: 'https://www.linkedin.com/in/antonin-chenavaz-9b9215421/',
    },
    {
      role: 'Commerce & relation client',
      name: 'Maxime Pollaud',
      portrait: '/equipe/maxime.jpg',
      bio: 'Étudiant en première année de BUT Techniques de commercialisation à l’IUT d’Aix-Marseille.',
      linkedin: 'https://www.linkedin.com/in/maxime-pollaud-488a77397/',
    },
    {
      role: 'Design & finance',
      name: 'Martin Dugail',
      portrait: '/equipe/martin.jpg',
      bio: 'Étudiant en licence MPCI (mathématiques, physique, chimie, informatique) à Aix-Marseille Université.',
      linkedin: 'https://www.linkedin.com/in/martin-dugail-15a5a742b/',
    },
  ],

  siteNotes: {
    privacy: 'Ce site ne vous piste pas : zéro cookie, zéro traceur.',
    freeSoftware:
      'Site construit avec des logiciels libres, et libre lui aussi (GNU GPL v3 ou ultérieure).',
  },
});
