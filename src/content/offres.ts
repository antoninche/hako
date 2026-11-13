/**
 * Textes de la page Offres (/offres/), repris en partie par la page Commander.
 *
 * Les prix ne s'écrivent jamais ici : ils viennent de src/data/tarifs.ts, le
 * seul fichier des tarifs. Une information manquante s'écrit
 * todo('ce qui manque', '[texte provisoire]') : elle s'affiche surlignée en
 * jaune et `npm run todos` la recense dans TODO.md.
 *
 * Une phrase qui contient une information manquante, un lien ou un prix
 * s'écrit comme une liste de morceaux : ['Nous vous appelons sous ', délai, '.'].
 *
 * Typographie : apostrophe ’, espace insécable avant « : » « ? » « ! » « ; »
 * et à l'intérieur des guillemets « ».
 */
import { company } from '../data/entreprise.ts';
import {
  backupCopy,
  depositText,
  missingPrice,
  moverOffers,
  payment,
  remoteAccess,
  shippingCost,
  warranty,
} from '../data/faits.ts';
import { routes } from '../data/navigation.ts';
import { pricing, type OfferId } from '../data/tarifs.ts';
import { orMissing, price } from '../lib/commande/inline.ts';
import { findStorage } from '../lib/commande/pricing.ts';
import type { LinkValue, RichText } from '../lib/commande/types.ts';
import { formatEur, formatList } from '../lib/format.ts';
import { todo } from '../lib/todo.ts';

/** Délai sous lequel nous rappelons après une demande (repris par la page Commander). */
export const callbackDelay = todo(
  'Délai sous lequel nous rappelons après une demande de commande',
  '[délai]',
);

const home = pricing.offers.home;

/** Montant et statut de TVA, par exemple « 600 € TTC » (statut omis s'il manque). */
const withTax = (amountEur: number, tax: string | null | undefined): string =>
  [formatEur(amountEur), tax].filter(Boolean).join('\u00a0');
const pro = pricing.offers.pro;
const includedStorage = findStorage(pricing, pricing.includedStorage);
const extraStorage = pricing.storage.filter((option) => option.id !== pricing.includedStorage);
const extraStorageLabels = formatList(
  extraStorage.map((option) => option.label),
  'or',
);

/**
 * Ligne « déménageur » d'une carte, seulement si l'offre le comprend : les
 * offres concernées sont écrites dans src/data/faits.ts (les deux, aujourd'hui).
 */
const moverItem = (offer: OfferId): readonly RichText[] =>
  moverOffers.includes(offer)
    ? [
        [
          'Le déménageur : nous vous aidons à rapatrier vos photos et vos fichiers depuis Google Photos ou iCloud. Vous vous connectez vous-même à votre compte : nous ne voyons jamais vos identifiants.',
        ],
      ]
    : [];

export interface OfferCopy {
  /** À qui s'adresse l'offre, en une phrase. */
  readonly summary: string;
  /** Façon de payer, en une ligne. */
  readonly payment: string;
  /** Ce qui est compris, une ligne par élément. */
  readonly included: readonly RichText[];
  /** Phrase sous la liste (facultative). */
  readonly note?: RichText;
  /** Texte du bouton vers le formulaire de commande. */
  readonly cta: string;
}

export const offerCopy: Readonly<Record<OfferId, OfferCopy>> = {
  home: {
    summary: 'Pour garder les photos et les fichiers de toute la famille à la maison.',
    payment: 'Achat unique, sans abonnement.',
    included: [
      ['La box, assemblée et vérifiée à la main en Provence'],
      ['Dans notre zone, l’installation chez vous et une formation sur place'],
      ...moverItem('home'),
      [`${includedStorage.label} de stockage`],
      [
        'Les mises à jour de sécurité pendant ',
        orMissing(home.securityUpdates, missingPrice.securityUpdates(home)),
      ],
    ],
    note: [
      'Hors garantie, le service après-vente est facturé ',
      price(home.afterSalesRateEur ?? null, missingPrice.afterSalesRate(home)),
      ' par intervention.',
    ],
    cta: 'Commander Hako Home',
  },
  pro: {
    summary:
      'Pour partager les fichiers, l’agenda et les contacts de votre équipe, avec un bilan de santé de la box chaque mois.',
    payment: 'Achat de la box et abonnement d’assistance.',
    included: [
      ['La box et, dans notre zone, son installation et une formation sur place'],
      ...moverItem('pro'),
      [`${includedStorage.label} de stockage`],
      [
        'Des comptes pour toute l’équipe, avec des droits d’accès par dossier : chacun voit les dossiers qui le concernent',
      ],
      ['Un agenda et des contacts partagés'],
      ['Un bilan de santé de la box, chaque mois'],
      [
        'L’assistance prioritaire, avec une réponse garantie sous ',
        orMissing(pro.subscription?.responseTime, missingPrice.responseTime(pro)),
      ],
      ['Les mises à jour et la maintenance, gérées par nous'],
    ],
    note: [
      'Hors garantie, le service après-vente est facturé ',
      price(pro.afterSalesRateEur ?? null, missingPrice.afterSalesRate(pro)),
      ' par intervention.',
    ],
    cta: 'Commander Hako Pro',
  },
};

/** Ligne du tableau comparatif : texte, ou « oui » / « non » avec une icône. */
export type ComparisonCell = RichText | 'yes' | 'no';

export interface ComparisonRow {
  readonly label: string;
  readonly home: ComparisonCell;
  readonly pro: ComparisonCell;
}

const subscription = pro.subscription;

export const offresPage = {
  meta: {
    title: 'Nos offres : Hako Home et Hako Pro',
    description:
      'Hako Home pour les familles, sans abonnement. Hako Pro pour les petites entreprises, avec un abonnement d’assistance. Prix, contenu et options de stockage.',
  },
  intro: {
    kicker: 'Nos offres',
    title: 'Pour la famille ou pour l’entreprise',
    lead: `${home.name}\u00a0: ${withTax(home.priceEur, home.taxStatus)}, une fois, sans abonnement. ${pro.name}\u00a0: ${withTax(pro.priceEur, pro.taxStatus)}, puis ${withTax(subscription?.monthlyEur ?? 0, subscription?.taxStatus)} par mois pour l’assistance et des outils pour travailler en équipe. Dans notre zone d’intervention, les deux comprennent l’installation chez vous et une formation sur place.`,
  },
  offersLabel: 'Les deux offres',
  includedTitle: 'Ce qui est compris',
  priceLabel: 'Prix',
  monthlyPrefix: 'puis ',
  commitmentLabel: 'Engagement : ',

  storage: {
    title: 'Le stockage',
    text: [
      'Les deux offres comprennent ',
      includedStorage.label,
      ' de stockage. Un téraoctet (To) vaut 1 000 gigaoctets (Go), l’unité qu’affiche votre téléphone pour sa mémoire.',
    ] satisfies RichText,
    more: 'Vous avez beaucoup de photos et de vidéos ? Vous pouvez choisir plus grand à la commande, pour Hako Home comme pour Hako Pro.',
    listLabel: 'Capacités proposées',
    included: 'Compris',
  },

  comparison: {
    title: 'Comparer les deux offres',
    caption: 'Hako Home et Hako Pro, point par point',
    featureHeader: 'Ce qui est comparé',
    yes: 'Oui',
    no: 'Non',
    rows: [
      {
        label: 'Prix d’achat',
        home: [
          price(home.priceEur, missingPrice.offerPrice(home)),
          '\u00a0',
          orMissing(home.taxStatus, missingPrice.taxStatus(home)),
        ],
        pro: [
          price(pro.priceEur, missingPrice.offerPrice(pro)),
          '\u00a0',
          orMissing(pro.taxStatus, missingPrice.taxStatus(pro)),
        ],
      },
      {
        label: 'Abonnement',
        home: ['Aucun'],
        // Le statut de TVA suit le montant, avant « par mois » (« … € HT par mois »).
        pro: subscription
          ? [
              price(subscription.monthlyEur, missingPrice.subscriptionPrice(pro)),
              '\u00a0',
              orMissing(subscription.taxStatus, missingPrice.subscriptionTax(pro)),
              ' par mois',
            ]
          : ['Aucun'],
      },
      {
        label: 'Durée d’engagement',
        home: ['Aucune'],
        pro: [orMissing(subscription?.commitment, missingPrice.commitment(pro))],
      },
      {
        label: 'Installation chez vous et formation sur place, dans notre zone',
        home: 'yes',
        pro: 'yes',
      },
      {
        label: 'Le déménageur, pour rapatrier vos fichiers',
        home: moverOffers.includes('home') ? 'yes' : 'no',
        pro: moverOffers.includes('pro') ? 'yes' : 'no',
      },
      {
        label: 'Stockage compris',
        home: [includedStorage.label],
        pro: [includedStorage.label],
      },
      {
        label: 'Plus de stockage',
        home: [`${extraStorageLabels}, en supplément`],
        pro: [`${extraStorageLabels}, en supplément`],
      },
      {
        label: 'Mises à jour de sécurité',
        home: ['Pendant ', orMissing(home.securityUpdates, missingPrice.securityUpdates(home))],
        pro: ['Comprises, gérées par nous'],
      },
      {
        label: 'Assistance',
        home: ['Sur demande'],
        pro: [
          'Prioritaire, réponse garantie sous ',
          orMissing(subscription?.responseTime, missingPrice.responseTime(pro)),
        ],
      },
      {
        label: 'Intervention hors garantie',
        home: [price(home.afterSalesRateEur ?? null, missingPrice.afterSalesRate(home))],
        pro: [price(pro.afterSalesRateEur ?? null, missingPrice.afterSalesRate(pro))],
      },
      { label: 'Comptes pour toute l’équipe, droits par dossier', home: 'no', pro: 'yes' },
      { label: 'Agenda et contacts partagés', home: 'no', pro: 'yes' },
      { label: 'Bilan de santé de la box, chaque mois', home: 'no', pro: 'yes' },
    ] satisfies readonly ComparisonRow[],
  },

  goodToKnow: {
    title: 'Bon à savoir avant de commander',
    items: [
      {
        title: 'Depuis l’extérieur de la maison',
        text: [remoteAccess.reason, ' ', remoteAccess.consequence, ' ', remoteAccess.choice],
      },
      {
        title: 'La copie de secours',
        text: [...backupCopy.sentence, ' ', backupCopy.advice],
      },
      {
        title: 'Notre zone d’intervention',
        text: [
          company.serviceArea.sentence,
          ' Hors de cette zone : ',
          company.serviceArea.outside,
          '. Frais d’envoi : ',
          shippingCost,
          '.',
        ],
      },
      {
        title: 'Le paiement',
        text: ['Un acompte de ', depositText, ' est demandé à la commande. ', payment],
      },
      {
        title: 'La garantie',
        text: [warranty.sentence, ' ', warranty.termsLead, warranty.terms, '.'],
      },
    ] satisfies readonly { title: string; text: RichText }[],
  },

  ordering: {
    title: 'Comment se passe la commande',
    steps: [
      {
        title: 'Vous choisissez',
        text: [
          'Choisissez votre offre et votre stockage, puis laissez-nous vos coordonnées. Vous ne payez rien à cette étape.',
        ],
      },
      {
        title: 'Nous vous appelons',
        text: [
          'Nous vous appelons sous ',
          callbackDelay,
          ' pour confirmer votre commande et fixer le rendez-vous d’installation.',
        ],
      },
      {
        title: 'Nous installons',
        text: ['Nous installons la box chez vous, puis nous vous montrons comment vous en servir.'],
      },
    ] satisfies readonly { title: string; text: RichText }[],
    cta: { label: 'Commander', href: routes.order } satisfies LinkValue,
    secondary: { label: 'Nous poser une question', href: routes.contact } satisfies LinkValue,
  },
} as const;

/** Adresse du formulaire de commande, avec l'offre déjà choisie. */
export function orderHref(offerId: OfferId): string {
  return `${routes.order}?offre=${offerId}`;
}
