/**
 * Textes de la page « Notre engagement » (/engagement/).
 *
 * Sept principes, chacun avec un paragraphe court et honnête. Tout le texte
 * visible est ici : les composants de src/components/engagement/ ne font que
 * le mettre en forme.
 *
 * - Un paragraphe est une liste de morceaux mis bout à bout. Une information
 *   encore inconnue s'écrit todo('ce qui manque', '[texte provisoire]').
 * - Les prix viennent de src/data/tarifs.ts (seule source des tarifs) : une
 *   valeur encore à `null` y est déjà recensée comme TODO, elle s'affiche ici
 *   en jaune, avec le même texte que sur les autres pages (missingPrice,
 *   src/data/faits.ts), sans être recensée une seconde fois.
 * - Les faits communs à plusieurs pages (accès depuis l'extérieur, licence de
 *   la page d'accueil de la box, phrase qui explique le nom) viennent de
 *   src/data/faits.ts.
 * - Typographie : apostrophe ’, espaces insécables avant « : » et à
 *   l'intérieur des guillemets « ».
 */
import { company } from '../data/entreprise';
import { missingPrice, nameSentence, remoteAccess } from '../data/faits';
import { routes } from '../data/navigation';
import { pricing } from '../data/tarifs';
import { orMissing } from '../lib/commande/inline';
import { formatEur } from '../lib/format';
import type { Maybe } from '../lib/todo';
import type { Link, Paragraph } from './la-box';

/** Nom des icônes, dans src/assets/illustrations/icones/engagement-<nom>.svg. */
export type PrincipleIcon =
  | 'donnees-chez-vous'
  | 'zero-acces'
  | 'logiciels-libres'
  | 'sans-abonnement'
  | 'humain-proche'
  | 'sans-pistage'
  | 'fait-main-provence';

export interface Principle {
  readonly icon: PrincipleIcon;
  readonly title: string;
  readonly text: readonly Paragraph[];
  /** Lien pour en savoir plus (facultatif). */
  readonly link?: Link;
}

/* ---------- Tarifs (src/data/tarifs.ts) ---------- */

const home = pricing.offers.home;
const pro = pricing.offers.pro;
const subscription = pro.subscription;

const homeUpdates: Maybe<string> = orMissing(
  home.securityUpdates,
  missingPrice.securityUpdates(home),
);

const homeAfterSalesRate: Maybe<string> =
  home.afterSalesRateEur == null
    ? missingPrice.afterSalesRate(home)
    : formatEur(home.afterSalesRateEur);

// Le statut de TVA suit le montant, avant « par mois » (« … € HT par mois »).
const proSubscription: Paragraph = subscription
  ? [
      pro.name,
      ', pour les entreprises, ajoute à l’achat un abonnement de ',
      formatEur(subscription.monthlyEur),
      '\u00a0',
      orMissing(subscription.taxStatus, missingPrice.subscriptionTax(pro)),
      ' par mois : assistance prioritaire, mises à jour et maintenance gérées par nous. Durée d’engagement : ',
      orMissing(subscription.commitment, missingPrice.commitment(pro)),
      '.',
    ]
  : [];

/* ---------- Page ---------- */

export const engagement = {
  meta: {
    title: 'Notre engagement : vos données restent chez vous',
    description:
      'Nos sept principes : vos données restent chez vous, nous n’y avons pas accès, des logiciels libres, pas d’abonnement caché, un humain près de chez vous.',
  },

  intro: {
    title: 'Notre engagement',
    lead: 'Sept principes guident ce que nous faisons. Les voici, avec ce qu’ils changent pour vous, et leurs limites quand il y en a.',
  },

  /** Titre (lu par les lecteurs d'écran) de la liste des principes. */
  listLabel: 'Nos sept principes',

  principles: [
    {
      icon: 'donnees-chez-vous',
      title: 'Vos données restent chez vous',
      // Mêmes phrases que sur l’accueil et les pages Offres et La box (src/data/faits.ts).
      text: [
        [
          'Vos photos, vos vidéos et vos fichiers sont rangés dans la box, chez vous. ',
          remoteAccess.reason,
        ],
        [remoteAccess.consequence, ' ', remoteAccess.choice],
      ],
    },
    {
      icon: 'zero-acces',
      title: 'Zéro accès',
      text: [
        [
          'Nous n’avons pas accès à vos données. Chaque box crée ses propres codes secrets, uniques, à son premier démarrage, et c’est vous qui créez vos comptes pendant l’installation.',
        ],
        [
          'Quand nous vous aidons à rapatrier vos photos depuis Google Photos ou iCloud, c’est vous qui vous connectez à votre compte : nous ne voyons jamais vos identifiants.',
        ],
      ],
    },
    {
      icon: 'logiciels-libres',
      title: 'Des logiciels libres',
      text: [
        [
          'Immich, qui garde vos photos, Nextcloud, qui garde vos fichiers, et Docker Engine, qui les fait tourner, sont des logiciels libres : leur code est public, et chacun peut le lire et le vérifier. Le système de la box, Raspberry Pi OS, est construit sur Debian, un système libre lui aussi.',
        ],
        [
          'Tout n’est pas libre pour autant : Raspberry Pi OS contient des micrologiciels fermés (de petits programmes intégrés aux composants), par exemple pour la puce Wi-Fi, et le programme de démarrage de la carte est fourni sans son code source. Nous détaillons tout, logiciel par logiciel.',
        ],
      ],
      link: { label: 'Voir ce qui tourne dans la box', href: `${routes.box}#logiciels` },
    },
    {
      icon: 'sans-abonnement',
      title: 'Pas d’abonnement caché',
      text: [
        [
          `${home.name} s’achète une fois, sans abonnement. Les mises à jour de sécurité sont incluses pendant `,
          homeUpdates,
          '. Si vous avez besoin de nous après l’installation, hors garantie, chaque intervention est facturée ',
          homeAfterSalesRate,
          '.',
        ],
        proSubscription,
      ],
      link: { label: 'Comparer les offres', href: routes.offers },
    },
    {
      icon: 'humain-proche',
      title: 'Un humain près de chez vous',
      text: [
        [
          'Nous installons la box chez vous, puis nous vous montrons comment vous en servir, sur place. Pour les personnes plus éloignées, nous aidons aussi en appel vidéo.',
        ],
        [company.serviceArea.sentence, ' Hors de cette zone : ', company.serviceArea.outside, '.'],
      ],
      link: { label: 'Voir les tutoriels', href: routes.tutorials },
    },
    {
      icon: 'sans-pistage',
      title: 'Ce site ne vous piste pas',
      text: [
        [
          'Zéro cookie, zéro traceur. Ce site ne charge rien depuis d’autres sites : ni police d’écriture, ni vidéo, ni outil de statistiques. C’est pour cela qu’aucun bandeau de cookies ne s’affiche.',
        ],
        ['Des tests automatiques le vérifient sur chaque page du site.'],
      ],
    },
    {
      icon: 'fait-main-provence',
      title: 'Assemblée à la main en Provence',
      text: [
        [
          'Chaque box est assemblée et vérifiée à la main, en Provence, avant d’arriver chez vous. Son boîtier est imprimé en 3D.',
        ],
        [
          'Nous sommes trois, chacun avec son domaine : le logiciel et le système, le commerce et la relation avec vous, le design.',
        ],
      ],
      link: { label: 'Faire connaissance avec l’équipe', href: routes.contact },
    },
  ] satisfies readonly Principle[],

  /**
   * Phrase qui explique le nom, avec le kanji lu en japonais : la même que
   * sur l’accueil (company.nameMeaning, dans src/data/entreprise.ts).
   */
  name: nameSentence,

  next: {
    title: 'Pour aller plus loin',
    links: [
      { label: 'Ce qu’il y a dans la box', href: routes.box },
      { label: 'Questions fréquentes', href: routes.faq },
      { label: 'Nos offres', href: routes.offers },
    ] satisfies readonly Link[],
  },
} as const;
