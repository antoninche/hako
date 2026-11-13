/**
 * Faits partagés : ce que plusieurs pages disent, écrit une seule fois.
 *
 * L'accès depuis l'extérieur de la maison, la copie de secours, les offres
 * qui comprennent le déménageur, le paiement, la garantie, la phrase qui
 * explique le nom, et ce qui s'affiche
 * à la place d'un prix pas encore fixé. L'accueil, les pages Offres,
 * Commander, La box, Notre engagement, Tutoriels et la FAQ lisent tous ce
 * fichier : un même fait s'y lit de la même façon, et une information
 * manquante n'est recensée qu'une fois dans TODO.md.
 *
 * - Une information encore inconnue s'écrit todo('ce qui manque', '[texte
 *   provisoire]') : le site l'affiche surlignée en jaune. Pour la renseigner,
 *   remplacez tout l'appel todo(…) par le texte entre apostrophes droites.
 * - Dans la FAQ (src/content/faq/), ces repères s'écrivent <Detail of="…" />
 *   (liste dans src/components/faq/Detail.astro) ; les réponses reprennent
 *   les mêmes mots que les phrases ci-dessous.
 * - Les prix restent dans src/data/tarifs.ts. Ici, seulement ce qui
 *   s'affiche à leur place tant qu'ils valent null (missingPrice).
 *
 * Typographie : apostrophe ’, espaces insécables avant « : » et à l'intérieur
 * des guillemets « ». Un texte provisoire court (« [à confirmer] ») a une
 * espace insécable après « à », pour ne pas se couper en fin de ligne.
 */
import { missing } from '../lib/commande/inline.ts';
import { formatList } from '../lib/format.ts';
import { todo, type TodoValue } from '../lib/todo.ts';
import { company } from './entreprise.ts';
import { pricing, type Offer, type OfferId, type StorageOption } from './tarifs.ts';

/** Morceaux d'une phrase mis bout à bout : du texte, ou une information manquante. */
export type FactText = readonly (string | TodoValue)[];

/* ---------- Accès depuis l'extérieur de la maison ---------- */

/**
 * Aucun port ouvert, donc pas d'accès depuis l'extérieur de la maison. Ce
 * n'est pas prévu : c'est un choix de sécurité de l'équipe. Les pages
 * écrivent ces phrases dans cet ordre : la raison, la contrepartie, puis ce
 * choix.
 */
export const remoteAccess = {
  reason:
    'Aucun port n’est ouvert vers internet (un port, c’est une porte d’entrée vers la box) : vos données ne quittent pas la maison.',
  consequence:
    'La contrepartie : vous ne pouvez pas accéder à vos données depuis l’extérieur de la maison.',
  choice: 'Ce n’est pas prévu : c’est un choix de sécurité.',
} as const;

/* ---------- Maintenance de Hako Pro ---------- */

/**
 * La maintenance à distance de Hako Pro : un tunnel WireGuard, mis en place
 * seulement à la demande du client (réponse de l'équipe, 13 novembre 2026).
 * Repris par Notre engagement (« Zéro accès »), la page Offres et la FAQ.
 */
export const proMaintenance =
  'Pour Hako Pro, la maintenance à distance passe par un tunnel sécurisé entre votre box et nous : un VPN, c’est-à-dire un passage chiffré à travers internet, avec le logiciel libre WireGuard. Il n’est mis en place que si vous demandez la maintenance : sans votre demande, nous n’avons aucun accès à votre box.';

/* ---------- Ouverture de Hako Pro ---------- */

/**
 * Hako Pro ouvrira après le lancement de Hako Home (décision de l'équipe,
 * 13 novembre 2026). Là où Hako Pro est proposé (carte de l'accueil, page
 * Offres et son tableau comparatif, formulaire de commande), son nom porte
 * l'étiquette « Bientôt » (src/components/SoonBadge.astro, la même que celle
 * des tutoriels à venir), et sa carte ajoute la phrase ci-dessous. Rien
 * d'autre ne change : une commande de Hako Pro reste une demande, à laquelle
 * l'équipe répond.
 */
export const proOpening = {
  /** L'offre qui ouvrira plus tard. */
  offer: 'pro',
  /** Étiquette écrite à côté de son nom. */
  label: 'Bientôt',
  sentence: 'Hako Pro ouvrira après le lancement de Hako Home.',
} as const satisfies { offer: OfferId; label: string; sentence: string };

/* ---------- Logiciels de la box ---------- */

/**
 * Page d'accueil de la box (http://hako.local) : le logiciel qui l'affiche
 * et sa licence ne sont pas encore fixés (pages La box et Notre engagement).
 */
export const homePageLicense = todo(
  'Page d’accueil de la box (http://hako.local) : logiciel utilisé et licence, à préciser',
  '[licence à préciser]',
);

/* ---------- Copie de secours ---------- */

/**
 * Prévue pour une prochaine version, sans date annoncée (décision de
 * l'équipe) : jamais présentée comme disponible.
 */
export const backupCopy = {
  sentence: [
    'Une copie de secours de vos données est prévue pour une prochaine version : elle ne fait pas partie de cette première version.',
  ] satisfies FactText,
  /** Conseil écrit juste après la phrase, là où l’on décide d’acheter. */
  advice: 'En attendant, gardez une autre copie de vos photos les plus précieuses.',
} as const;

/* ---------- Le déménageur ---------- */

/**
 * Le déménageur : notre aide pour rapatrier vos photos et vos fichiers depuis
 * Google Photos ou iCloud. Les offres qui le comprennent sont écrites ici, une
 * seule fois : les deux, l'équipe l'a confirmé. L'étiquette de l'accueil, les
 * cartes des offres (accueil et page Offres), le tableau comparatif, les
 * Tutoriels et la FAQ en découlent.
 */
const offersWithMover: readonly OfferId[] = ['home', 'pro'];

export const moverOffers = {
  /** Vrai si l'offre comprend le déménageur. */
  includes: (offer: OfferId): boolean => offersWithMover.includes(offer),
  /** Les offres qui le comprennent, en toutes lettres : « Hako Home et Hako Pro ». */
  names: formatList(offersWithMover.map((id) => pricing.offers[id].name)),
} as const;

/* ---------- Paiement ---------- */

/**
 * Le paiement en ligne n'existe pas encore : la box se paie en une seule
 * fois, par virement, avant l'installation (décision de l'équipe). Seul le
 * prix d'achat se paie en une fois : l'abonnement de Hako Pro se paie chaque
 * mois (proSubscriptionPayment, ci-dessous).
 * Pages Offres et Commander, et FAQ.
 */
export const payment =
  'Le paiement en ligne n’est pas encore possible : la box se règle en une seule fois, par virement bancaire, avant l’installation.';

/**
 * L'abonnement de Hako Pro se paie lui aussi par virement, chaque mois
 * (décision de l'équipe). Pages Offres et FAQ.
 */
export const proSubscriptionPayment = 'L’abonnement de Hako Pro se paie chaque mois, par virement.';

/* ---------- Garantie ---------- */

const warrantyTerms = todo(
  'Garantie d’un an de la box : ce qu’elle couvre (pièces, main-d’œuvre, envoi ou déplacement) et comment la faire jouer',
  '[à confirmer]',
);

/**
 * Garantie commerciale d'un an (confirmée par l'équipe). Elle s'ajoute à la
 * garantie légale de conformité, qu'elle ne remplace jamais : deux ans pour
 * les particuliers (Code de la consommation). Page Offres et FAQ.
 */
export const warranty = {
  sentence:
    'La box est garantie un an par HAKO, en plus de la garantie légale de conformité (deux ans pour les particuliers).',
  termsLead: 'Ce que couvre cette garantie, et comment la faire jouer : ',
  terms: warrantyTerms,
} as const;

/* ---------- Prix pas encore fixés (null dans src/data/tarifs.ts) ---------- */

/**
 * Ce qui s'affiche à la place d'un prix ou d'une condition pas encore fixés.
 * Ces manques sont déjà recensés dans TODO.md grâce au commentaire
 * « // TODO: » de tarifs.ts : missing(…) ne les compte pas une seconde fois.
 */
export const missingPrice = {
  offerPrice: (offer: Offer): TodoValue => missing(`Prix de ${offer.name}`, '[prix]'),
  taxStatus: (offer: Offer): TodoValue =>
    missing(`Préciser si le prix de ${offer.name} est TTC ou HT`, '[TTC ou HT]'),
  subscriptionPrice: (offer: Offer): TodoValue =>
    missing(`Prix mensuel de l’abonnement ${offer.name}`, '[prix]'),
  subscriptionTax: (offer: Offer): TodoValue =>
    missing(`Préciser si l’abonnement de ${offer.name} est TTC ou HT`, '[TTC ou HT]'),
  commitment: (offer: Offer): TodoValue =>
    missing(`Durée d’engagement de l’abonnement ${offer.name}`, '[durée]'),
  responseTime: (offer: Offer): TodoValue =>
    missing(`Délai de réponse garanti du support prioritaire de ${offer.name}`, '[délai]'),
  securityUpdates: (offer: Offer): TodoValue =>
    missing(`Durée des mises à jour de sécurité comprises dans ${offer.name}`, '[durée]'),
  afterSalesRate: (offer: Offer): TodoValue =>
    missing(`Tarif d’une intervention du service après-vente (${offer.name})`, '[tarif]'),
  afterSalesTax: (offer: Offer): TodoValue =>
    missing(`Préciser si le tarif d’intervention de ${offer.name} est TTC ou HT`, '[TTC ou HT]'),
  storageExtra: (option: StorageOption): TodoValue =>
    missing(`Supplément de l’option de stockage ${option.label}`, '[à confirmer]'),
} as const;

/* ---------- Le nom ---------- */

/**
 * La phrase qui explique le nom (company.nameMeaning, dans
 * src/data/entreprise.ts), coupée autour du kanji : l'accueil et la page
 * Notre engagement l'affichent avec le kanji lu en japonais (lang="ja").
 */
export const nameSentence = splitAroundKanji(company.nameMeaning, company.kanji);

function splitAroundKanji(sentence: string, kanji: string) {
  const at = sentence.indexOf(kanji);
  if (at === -1 || sentence.indexOf(kanji, at + kanji.length) !== -1) {
    throw new Error(
      `La phrase qui explique le nom (company.nameMeaning) doit contenir le kanji ${kanji} une seule fois.`,
    );
  }
  return {
    before: sentence.slice(0, at),
    kanji,
    after: sentence.slice(at + kanji.length),
  } as const;
}
