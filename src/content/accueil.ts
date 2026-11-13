/**
 * Textes de la page d’accueil, dans l’ordre de la page.
 *
 * Modifier un texte : changez simplement la phrase entre apostrophes droites.
 * Les mots entre accolades, comme {acompte} ou {stockage}, sont remplacés
 * automatiquement par une valeur tirée de src/data/tarifs.ts : gardez-les
 * tels quels, sans espace ni accent. Le site refuse de se construire si l’un
 * d’eux est mal écrit, ou si une accolade reste seule ; le message d’erreur
 * cite la phrase à corriger.
 *
 * À l’affichage, les mots composés (« c’est-à-dire ») ne sont jamais coupés
 * au trait d’union, « à » ne reste jamais seul en fin de ligne et « Hako Pro »
 * reste d’un seul tenant : inutile d’ajouter des espaces insécables pour cela.
 *
 * Les prix ne s’écrivent jamais ici : ils viennent tous de src/data/tarifs.ts.
 * Le nom, l’accroche, la promesse, la zone d’intervention et l’équipe
 * viennent de src/data/entreprise.ts ; les faits communs à plusieurs pages
 * (accès depuis l’extérieur, offres qui comprennent le déménageur, prix pas
 * encore fixés) de src/data/faits.ts.
 *
 * Typographie : l’apostrophe est ’ ; les espaces avant « : » et « ? » et à
 * l’intérieur des guillemets « » sont insécables.
 */
import { moverOffers, remoteAccess } from '../data/faits';
import { orderLink, routes, type NavLink } from '../data/navigation';
import { pricing, type OfferId } from '../data/tarifs';
import { formatEur } from '../lib/format';

/* ------------------------------------------------------------------ */
/* Types communs                                                       */
/* ------------------------------------------------------------------ */

/** Dessins de l’accueil (fichiers de src/assets/illustrations/). */
export type HomeIllustration =
  | 'probleme'
  | 'demenageur'
  | 'etape-commande'
  | 'etape-assemblage'
  | 'etape-installation'
  | 'etape-chez-vous'
  | 'offre-home'
  | 'offre-pro';

/** Icônes des engagements (src/assets/illustrations/icones/). */
export type CommitmentIcon =
  | 'icones/engagement-donnees-chez-vous'
  | 'icones/engagement-zero-acces'
  | 'icones/engagement-logiciels-libres'
  | 'icones/engagement-sans-abonnement'
  | 'icones/engagement-humain-proche'
  | 'icones/engagement-sans-pistage'
  | 'icones/engagement-fait-main-provence';

/** Lien vers un autre site, avec la langue de la page visée. */
export interface ExternalLink extends NavLink {
  /** Code de langue de la page visée (« en » pour l’anglais). */
  readonly hreflang: string;
}

/** Surtitre, titre et introduction d’une section. */
export interface SectionIntro {
  readonly kicker: string;
  readonly title: string;
  readonly intro: string;
}

/* ------------------------------------------------------------------ */
/* Moteurs de recherche                                                */
/* ------------------------------------------------------------------ */

/**
 * Résumé de la page pour les moteurs de recherche (120 à 155 caractères).
 * L’accueil n’a pas de titre à lui : le gabarit (BaseLayout) affiche
 * « HAKO · Vos souvenirs restent à la maison », tiré de l’accroche.
 */
export const meta = {
  description:
    'HAKO installe chez vous une petite box qui garde les photos et les fichiers de la famille. Sans abonnement avec Hako Home. De Salon-de-Provence à Toulon.',
} as const;

/* ------------------------------------------------------------------ */
/* a. Ouverture                                                        */
/* ------------------------------------------------------------------ */

export interface HeroCopy {
  /** Petite ligne au-dessus de l’accroche : dit en clair ce qu’est HAKO. */
  readonly kicker: string;
  readonly primary: NavLink;
  readonly secondary: NavLink;
  /**
   * Sous les deux boutons : pour la personne qui a déjà reçu sa box, un lien
   * vers le guide d’installation (« Vous avez reçu votre HAKO ? »).
   */
  readonly received: { readonly text: string; readonly link: NavLink };
  /** Nom de la liste de repères, lu par les lecteurs d’écran. */
  readonly highlightsLabel: string;
  readonly highlights: readonly string[];
}

/**
 * Repère du prix de Hako Home : montant et statut de TVA tirés de
 * src/data/tarifs.ts, pour que le prix se lise dès le premier écran.
 */
const homePrice = [formatEur(pricing.offers.home.priceEur), pricing.offers.home.taxStatus]
  .filter(Boolean)
  .join('\u00a0');

/** L’accroche et la promesse viennent de src/data/entreprise.ts. */
export const hero: HeroCopy = {
  kicker: 'Une box pour vos photos et vos fichiers',
  primary: orderLink,
  secondary: { label: 'Découvrir la box', href: routes.box },
  received: {
    text: 'Vous avez reçu votre HAKO ?',
    link: { label: 'Installez-la pas à pas', href: routes.install },
  },
  highlightsLabel: 'En bref',
  highlights: [
    'Assemblée à la main en Provence',
    `${homePrice}, sans abonnement (Hako Home)`,
    'Logiciels libres pour vos photos et fichiers',
    'Aucun accès à vos données sans votre demande',
  ],
};

/* ------------------------------------------------------------------ */
/* b. Le constat, puis le déménageur                                   */
/* ------------------------------------------------------------------ */

export interface ProblemCopy extends SectionIntro {
  readonly illustrationAlt: string;
  readonly points: readonly string[];
  /** Un seul fait d’actualité, toujours avec sa source. */
  readonly example: {
    readonly text: string;
    readonly sourceLead: string;
    readonly source: ExternalLink;
  };
  readonly closing: string;
}

export const problem: ProblemCopy = {
  kicker: 'Le constat',
  title: 'Aujourd’hui, vos souvenirs sont chez d’autres',
  intro:
    'Photos de famille, papiers, documents de travail : peu à peu, tout part chez de grandes entreprises. C’est pratique, tant que leurs règles vous conviennent.',
  illustrationAlt:
    'Une file de photos s’envole d’une maison de Provence vers des nuages lointains. Près des nuages, des cadenas ferment les dernières photos et des étiquettes de prix pendent.',
  points: [
    'Les abonnements s’ajoutent les uns aux autres, mois après mois.',
    'Les prix et les conditions peuvent changer, sans que vous ayez votre mot à dire.',
    'Un compte peut être fermé, avec tout ce qu’il contient.',
  ],
  // La phrase s’en tient à ce qu’a publié Associated Press le 15 mai 2025.
  // Ne la changer qu’avec une source.
  example: {
    text: 'Un exemple, à une autre échelle : en mai 2025, l’agence Associated Press a rapporté que le procureur de la Cour pénale internationale avait perdu l’accès à sa messagerie Microsoft, après des sanctions américaines.',
    sourceLead: 'Source :',
    source: {
      label: 'Associated Press, 15 mai 2025 (article en anglais)',
      href: 'https://apnews.com/article/icc-trump-sanctions-karim-khan-court-a4b4c02751ab84c09718b1b95cbd5db3',
      hreflang: 'en',
    },
  },
  closing: 'Avec HAKO, vos fichiers restent chez vous, sur une box qui vous appartient.',
};

export interface MoverCopy {
  readonly kicker: string;
  readonly title: string;
  readonly text: string;
  readonly privacy: string;
  /** Petite étiquette : les offres qui comprennent le déménageur (src/data/faits.ts). */
  readonly included: string;
  readonly illustrationAlt: string;
}

export const mover: MoverCopy = {
  kicker: 'Le déménageur',
  title: 'Vos photos reviennent à la maison',
  text: 'Vos photos sont sur Google Photos ou iCloud ? Nous vous aidons à les rapatrier sur votre box, avec vos fichiers.',
  privacy:
    'Vous vous connectez vous-même à votre compte : nous ne voyons jamais vos identifiants, c’est-à-dire l’adresse e-mail et le mot de passe de ce compte.',
  included: `Compris dans ${moverOffers.names}`,
  illustrationAlt:
    'Une file de photos quitte un nuage et entre par la fenêtre d’une maison de Provence. Derrière la fenêtre, la box est posée sur une petite console en bois.',
};

/* ------------------------------------------------------------------ */
/* c. La box en 3D                                                     */
/* ------------------------------------------------------------------ */

export interface BoxSceneCopy {
  readonly title: string;
  readonly intro: string;
}

export const boxScene: BoxSceneCopy = {
  title: 'Regardez à l’intérieur',
  intro:
    'Rien n’est caché : un petit ordinateur Raspberry Pi 5, un disque de stockage rapide (un SSD) et un ventilateur, dans un boîtier imprimé en 3D.',
};

/* ------------------------------------------------------------------ */
/* d. Comment ça marche                                                */
/* ------------------------------------------------------------------ */

export interface Step {
  readonly illustration: HomeIllustration;
  readonly title: string;
  /** {acompte} : pourcentage de l’acompte, tiré de src/data/tarifs.ts. */
  readonly text: string;
}

export interface StepsCopy extends SectionIntro {
  readonly items: readonly Step[];
}

export const steps: StepsCopy = {
  kicker: 'En quatre étapes',
  title: 'Comment ça marche',
  intro: 'De la commande à l’installation, c’est nous trois qui nous occupons de votre box.',
  items: [
    {
      illustration: 'etape-commande',
      title: 'Vous commandez',
      text: 'Vous choisissez Hako Home ou Hako Pro, et la place de stockage qu’il vous faut. Un acompte de {acompte} est demandé à la commande.',
    },
    {
      illustration: 'etape-assemblage',
      title: 'Nous préparons votre box',
      text: 'Nous l’assemblons à la main, en Provence, dans son boîtier imprimé en 3D, puis nous la vérifions.',
    },
    {
      illustration: 'etape-installation',
      title: 'Nous l’installons chez vous',
      text: 'Dans notre zone, nous la branchons à votre box internet, puis nous vous montrons comment tout fonctionne. Plus loin, nous vous l’envoyons, et vous l’installez avec notre guide pas à pas.',
    },
    {
      illustration: 'etape-chez-vous',
      title: 'Au quotidien, chez vous',
      text: 'Vos photos et vos fichiers restent à la maison. Pour une question, écrivez-nous ou appelez-nous. De courts tutoriels vidéo sont en préparation.',
    },
  ],
};

/* ------------------------------------------------------------------ */
/* e. Les offres (prix : src/data/tarifs.ts)                           */
/* ------------------------------------------------------------------ */

export interface OfferCopy {
  readonly illustration: HomeIllustration;
  /** Ligne sous le prix. */
  readonly priceNote: string;
  /**
   * Précisions sous le prix, en petit. Valeurs possibles : {tarifSav} tarif
   * d’une intervention (Home) ; {engagement} durée d’engagement (Pro).
   */
  readonly details: readonly string[];
  /**
   * Ce que comprend l’offre. Valeurs possibles : {stockage} capacité incluse ;
   * {majSecurite} durée des mises à jour de sécurité (Home) ; {delai} délai
   * de réponse garanti (Pro).
   */
  readonly features: readonly string[];
  /** Texte du bouton de commande. */
  readonly cta: string;
}

export interface ProOfferCopy extends OfferCopy {
  /** Ligne de l’abonnement : {mensuel} montant ; {taxeAbonnement} HT ou TTC, écrit avant « par mois ». */
  readonly monthly: string;
}

export interface OffersCopy extends SectionIntro {
  readonly home: OfferCopy;
  readonly pro: ProOfferCopy;
  /** {inclus} capacité incluse ; {options} capacités en option. */
  readonly storageNote: string;
  readonly compare: NavLink;
}

/**
 * Ligne « déménageur » d’une carte, seulement si l’offre le comprend : les
 * offres concernées sont écrites dans src/data/faits.ts (les deux, aujourd’hui).
 */
const moverFeature = (offer: OfferId): readonly string[] =>
  moverOffers.includes(offer)
    ? ['Le déménageur : vos photos rapatriées depuis Google Photos ou iCloud']
    : [];

export const offers: OffersCopy = {
  kicker: 'Nos offres',
  title: 'Pour la famille ou pour l’entreprise',
  intro: 'Dans les deux cas, vous achetez la box une fois, et elle est à vous.',
  home: {
    illustration: 'offre-home',
    priceNote: 'Achat unique, sans abonnement',
    details: ['Hors garantie, le service après-vente est facturé {tarifSav} par intervention'],
    features: [
      'La box, avec {stockage} de stockage',
      'L’installation et la formation chez vous',
      ...moverFeature('home'),
      'Les mises à jour de sécurité pendant {majSecurite}',
    ],
    cta: 'Commander Hako Home',
  },
  pro: {
    illustration: 'offre-pro',
    priceNote: 'Achat de la box et abonnement d’assistance',
    monthly: '+ {mensuel} {taxeAbonnement} par mois',
    details: [
      'Engagement : {engagement}',
      'Hors garantie, le service après-vente est facturé {tarifSav} par intervention',
    ],
    features: [
      'La box, avec {stockage} de stockage',
      'L’installation et la formation chez vous',
      ...moverFeature('pro'),
      'Des comptes pour toute l’équipe, avec des droits d’accès par dossier',
      'Un agenda et des contacts partagés',
      'Un bilan de santé de la box chaque mois',
      'Une assistance prioritaire, avec une réponse garantie sous {delai}',
      'Les mises à jour et la maintenance, gérées par nous',
    ],
    cta: 'Commander Hako Pro',
  },
  storageNote:
    'Les deux offres comprennent {inclus} de stockage. Besoin de plus de place ? {options} sont proposés en option.',
  compare: { label: 'Comparer les offres en détail', href: routes.offers },
};

/* ------------------------------------------------------------------ */
/* f. Pourquoi nous faire confiance                                    */
/* ------------------------------------------------------------------ */

export interface Commitment {
  readonly icon: CommitmentIcon;
  readonly title: string;
  readonly text: string;
}

export interface TrustCopy extends SectionIntro {
  /** Le premier engagement est mis en avant, sur toute la largeur. */
  readonly items: readonly Commitment[];
  readonly more: NavLink;
}

export const trust: TrustCopy = {
  kicker: 'Nos engagements',
  title: 'Pourquoi nous faire confiance',
  intro: 'Sept engagements, avec leurs limites quand il y en a.',
  items: [
    {
      icon: 'icones/engagement-donnees-chez-vous',
      title: 'Vos données restent chez vous',
      // Mêmes phrases que sur les pages Offres, La box et Notre engagement (src/data/faits.ts).
      text: `${remoteAccess.reason} ${remoteAccess.consequence} ${remoteAccess.choice}`,
    },
    {
      icon: 'icones/engagement-zero-acces',
      title: 'Zéro accès',
      text: 'Sans votre demande, nous n’avons pas accès à vos données. À l’installation, votre box crée les comptes et les mots de passe, chez vous. Avec Hako Pro, la maintenance à distance n’a lieu que si vous la demandez.',
    },
    {
      icon: 'icones/engagement-logiciels-libres',
      title: 'Des logiciels libres',
      text: 'Immich pour les photos, Nextcloud pour les fichiers : des logiciels libres, dont le code est public et que chacun peut lire.',
    },
    {
      icon: 'icones/engagement-sans-abonnement',
      title: 'Pas d’abonnement caché',
      text: 'Hako Home s’achète une fois, sans abonnement. L’abonnement d’assistance de Hako Pro est annoncé clairement, avant toute commande.',
    },
    {
      icon: 'icones/engagement-humain-proche',
      title: 'Un humain près de chez vous',
      text: 'Nous venons chez vous pour l’installation et la formation. Ensuite, nous restons joignables par téléphone et par e-mail, ou en appel vidéo si vous êtes loin.',
    },
    {
      icon: 'icones/engagement-sans-pistage',
      title: 'Ce site ne vous piste pas',
      text: 'Zéro cookie, zéro traceur : pas de mesure d’audience, et rien n’est chargé depuis un autre site.',
    },
    {
      icon: 'icones/engagement-fait-main-provence',
      title: 'Assemblée à la main en Provence',
      text: 'Chaque box passe entre nos mains : assemblage, vérifications, puis installation chez vous.',
    },
  ],
  more: { label: 'Lire nos engagements en détail', href: routes.commitment },
};

/* ------------------------------------------------------------------ */
/* g. La zone d’intervention et l’équipe                               */
/* ------------------------------------------------------------------ */

export interface NearbyCopy {
  readonly kicker: string;
  readonly title: string;
  /** Sous le titre. La carte affiche elle-même la phrase sur la zone d’intervention. */
  readonly text: string;
  /** Avant l’offre hors zone (src/data/entreprise.ts), comme sur les autres pages. */
  readonly outsideLead: string;
  readonly teamTitle: string;
  readonly teamText: string;
  /** Nom de la liste des trois rôles, lu par les lecteurs d’écran. */
  readonly teamListLabel: string;
  readonly more: NavLink;
}

/** L’offre hors zone et les rôles de l’équipe viennent de src/data/entreprise.ts. */
export const nearby: NearbyCopy = {
  kicker: 'Près de chez vous',
  title: 'Une équipe qui vient jusqu’à vous',
  text: 'Nous nous déplaçons dans la zone indiquée sur la carte.',
  outsideLead: 'Hors de cette zone :',
  teamTitle: 'Trois étudiants de Provence',
  teamText: 'C’est nous qui assemblons votre box, et nous qui répondons à vos questions.',
  teamListLabel: 'L’équipe',
  more: { label: 'Faire connaissance', href: routes.contact },
};

/* ------------------------------------------------------------------ */
/* h. Dernier appel                                                    */
/* ------------------------------------------------------------------ */

export interface FinalCallCopy {
  readonly title: string;
  readonly text: string;
  readonly primary: NavLink;
  readonly secondary: NavLink;
  readonly faq: NavLink;
}

export const finalCall: FinalCallCopy = {
  title: 'Ramenez vos souvenirs à la maison',
  text: 'Commandez votre box, ou posez-nous d’abord vos questions par e-mail ou par téléphone.',
  primary: orderLink,
  secondary: { label: 'Nous poser une question', href: routes.contact },
  faq: { label: 'Lire les questions fréquentes', href: routes.faq },
};
