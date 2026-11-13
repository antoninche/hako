/**
 * Textes de la page « Contact et équipe » (/contact/).
 *
 * Les coordonnées (e-mail, téléphone, réseaux sociaux), la zone
 * d’intervention et l’équipe (noms, portraits, présentations) viennent de
 * src/data/entreprise.ts : elles se renseignent là-bas, une seule fois pour
 * tout le site. Ici, seulement les phrases propres à cette page.
 *
 * Une information encore inconnue s’écrit todo('ce qui manque', '[texte
 * provisoire]') : le site l’affiche surlignée en jaune et `npm run todos`
 * la recense dans TODO.md. Pour la renseigner, remplacez tout l’appel
 * todo(…) par la phrase entre apostrophes droites.
 */
import { routes, type NavLink } from '../data/navigation';
import { todo, type Maybe } from '../lib/todo';

export interface ContactPageCopy {
  readonly title: string;
  /** Résumé pour les moteurs de recherche (150 caractères environ). */
  readonly description: string;
  readonly intro: string;
  readonly reach: {
    readonly title: string;
    readonly emailLabel: string;
    readonly phoneLabel: string;
    /** Phrase sur le délai habituel de réponse. */
    readonly responseTime: Maybe<string>;
    readonly order: {
      readonly title: string;
      readonly text: string;
      readonly link: NavLink;
    };
  };
  readonly team: {
    readonly title: string;
    readonly intro: string;
    /** Texte du lien vers le profil LinkedIn de chaque personne. */
    readonly linkedinLabel: string;
  };
  readonly area: {
    readonly title: string;
    /** Début de la phrase sur ce que nous proposons hors de la zone. */
    readonly outsideLabel: string;
    readonly remote: string;
  };
  readonly social: {
    readonly title: string;
    readonly text: string;
    readonly link: NavLink;
  };
}

export const contactPage: ContactPageCopy = {
  title: 'Contact et équipe',
  description:
    'Écrire ou téléphoner à HAKO, et faire connaissance avec l’équipe : trois étudiants en Provence, qui installent votre box chez vous.',
  intro:
    'Pour toute question sur la box ou sur votre commande, écrivez-nous ou appelez-nous. Nous sommes trois étudiants, en Provence.',

  reach: {
    title: 'Nous joindre',
    emailLabel: 'Par e-mail',
    phoneLabel: 'Par téléphone',
    responseTime: todo(
      'Phrase sur le délai habituel de réponse aux messages et aux appels (par exemple « Nous répondons sous deux jours ouvrés. »)',
      'Nous répondons sous [délai à préciser].',
    ),
    order: {
      title: 'Pour commander',
      text: 'Le formulaire vous guide en trois étapes. Pour l’instant, c’est une démonstration : pour commander, écrivez-nous ou appelez-nous.',
      link: { label: 'Voir le formulaire', href: routes.order },
    },
  },

  team: {
    title: 'L’équipe',
    intro:
      'Trois étudiants, chacun responsable d’un domaine. C’est nous qui assemblons votre box, l’installons chez vous et répondons à vos questions.',
    linkedinLabel: 'Profil LinkedIn',
  },

  area: {
    title: 'Où nous intervenons',
    outsideLabel: 'Hors de cette zone',
    remote: 'Une fois la box installée, nous pouvons aussi vous aider par appel vidéo.',
  },

  social: {
    title: 'Tutoriels vidéo',
    // Au futur tant qu’aucune vidéo n’est en ligne (voir src/content/tutoriels.ts),
    // au présent ensuite : « Nos tutoriels vidéo sont publiés sur… ».
    text: 'Nos tutoriels vidéo seront publiés sur YouTube et sur PeerTube, une plateforme vidéo libre.',
    link: { label: 'Voir les tutoriels', href: routes.tutorials },
  },
};
