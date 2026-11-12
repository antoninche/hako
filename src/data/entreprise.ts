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
  nameMeaning: '« Hako » veut dire « boîte » en japonais.',
  headline: 'Vos souvenirs restent à la maison.',
  promise:
    'Les données de toute la famille chez vous, et quelqu’un pour vous aider à les maîtriser.',

  email: todo(
    'Adresse e-mail de contact, sur notre propre nom de domaine ou chez Proton Mail (jamais une adresse Gmail)',
    '[adresse e-mail]',
  ),
  phone: todo('Numéro de téléphone de contact', '[numéro de téléphone]'),
  domain: todo('Nom de domaine du site', '[nom de domaine]'),

  serviceArea: {
    sentence:
      'Nous intervenons de Salon-de-Provence à Toulon, en passant par Aix-en-Provence et Marseille.',
    outside: todo(
      'Ce que nous proposons aux personnes situées hors de notre zone d’intervention',
      '[offre hors zone]',
    ),
  },

  social: [
    {
      id: 'linkedin',
      name: 'LinkedIn',
      url: todo('Adresse de la page LinkedIn de HAKO', '[adresse]'),
    },
    {
      id: 'youtube',
      name: 'YouTube',
      url: todo('Adresse de la chaîne YouTube de HAKO', '[adresse]'),
    },
    {
      id: 'facebook',
      name: 'Facebook',
      url: todo('Adresse de la page Facebook de HAKO', '[adresse]'),
    },
    {
      id: 'instagram',
      name: 'Instagram',
      url: todo('Adresse du compte Instagram de HAKO', '[adresse]'),
    },
    {
      id: 'peertube',
      name: 'PeerTube',
      url: todo('Adresse de la chaîne PeerTube de HAKO, et instance qui l’héberge', '[adresse]'),
    },
  ],

  founders: [
    {
      role: 'Logiciel & système',
      name: todo('Prénom et nom de la personne chargée du logiciel et du système', '[Prénom Nom]'),
      portrait: todo('Portrait de la personne chargée du logiciel et du système', '[portrait]'),
      bio: todo(
        'Présentation courte de la personne chargée du logiciel et du système',
        '[présentation]',
      ),
      linkedin: todo(
        'Profil LinkedIn de la personne chargée du logiciel et du système',
        '[profil LinkedIn]',
      ),
    },
    {
      role: 'Matériel, boîtier & tests',
      name: todo(
        'Prénom et nom de la personne chargée du matériel, du boîtier et des tests',
        '[Prénom Nom]',
      ),
      portrait: todo(
        'Portrait de la personne chargée du matériel, du boîtier et des tests',
        '[portrait]',
      ),
      bio: todo(
        'Présentation courte de la personne chargée du matériel, du boîtier et des tests',
        '[présentation]',
      ),
      linkedin: todo(
        'Profil LinkedIn de la personne chargée du matériel, du boîtier et des tests',
        '[profil LinkedIn]',
      ),
    },
    {
      role: 'Commerce & relation client',
      name: todo(
        'Prénom et nom de la personne chargée du commerce et de la relation client',
        '[Prénom Nom]',
      ),
      portrait: todo(
        'Portrait de la personne chargée du commerce et de la relation client',
        '[portrait]',
      ),
      bio: todo(
        'Présentation courte de la personne chargée du commerce et de la relation client',
        '[présentation]',
      ),
      linkedin: todo(
        'Profil LinkedIn de la personne chargée du commerce et de la relation client',
        '[profil LinkedIn]',
      ),
    },
  ],

  siteNotes: {
    privacy: 'Ce site ne vous piste pas : zéro cookie, zéro traceur.',
    freeSoftware: 'Site construit avec des logiciels libres.',
  },
});
