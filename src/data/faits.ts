/**
 * Faits partagés : ce que plusieurs pages disent, écrit une seule fois.
 *
 * L'accès depuis l'extérieur de la maison, la copie de secours, les offres
 * qui comprennent le déménageur, le paiement, la garantie, l'envoi hors de
 * la zone d'intervention, la phrase qui explique le nom, et ce qui s'affiche
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
import { formatList, formatPercent } from '../lib/format.ts';
import { todo, type Maybe, type TodoValue } from '../lib/todo.ts';
import { company } from './entreprise.ts';
import { pricing, type Offer, type OfferId, type StorageOption } from './tarifs.ts';

/** Morceaux d'une phrase mis bout à bout : du texte, ou une information manquante. */
export type FactText = readonly (string | TodoValue)[];

/* ---------- Accès depuis l'extérieur de la maison ---------- */

const remoteAccessOption = todo(
  'Accès aux données depuis l’extérieur de la maison : option future à décrire (prévue ou non, fonctionnement, date, prix éventuel)',
  '[à préciser]',
);

/**
 * Aucun port ouvert, donc pas d'accès depuis l'extérieur pour l'instant.
 * Les pages écrivent ces phrases dans cet ordre : la raison, la
 * contrepartie, puis l'option future (optionLead suivi de option).
 */
export const remoteAccess = {
  reason:
    'Aucun port n’est ouvert vers internet (un port, c’est une porte d’entrée vers la box) : vos données ne quittent pas la maison.',
  consequence:
    'La contrepartie : pour l’instant, vous ne pouvez pas accéder à vos données depuis l’extérieur de la maison.',
  optionLead: 'Option future : ',
  option: remoteAccessOption,
} as const;

/* ---------- Logiciels de la box ---------- */

/**
 * Page d'accueil de la box (http://mabox.local) : le logiciel qui l'affiche
 * et sa licence ne sont pas encore fixés (pages La box et Notre engagement).
 */
export const homePageLicense = todo(
  'Page d’accueil de la box (http://mabox.local) : logiciel utilisé et licence, à préciser',
  '[licence à préciser]',
);

/* ---------- Copie de secours ---------- */

const backupCopyStatus = todo(
  'Copie de secours des données : prévue, absente de la première version ; solution, date de disponibilité et fonctionnement à confirmer',
  '[à confirmer]',
);

/** Prévue, mais pas dans la première version : jamais présentée comme disponible. */
export const backupCopy = {
  status: backupCopyStatus,
  sentence: [
    'Une copie de secours de vos données est prévue, mais elle ne fait pas partie de cette première version : ',
    backupCopyStatus,
    '.',
  ] satisfies FactText,
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
 * Le paiement en ligne n'existe pas encore : l'acompte et le solde se paient
 * par virement (confirmé par l'équipe). Pages Offres et Commander, et FAQ.
 */
export const payment =
  'Le paiement en ligne n’est pas encore possible : l’acompte et le solde se paient par virement bancaire.';

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

/* ---------- Hors de la zone d'intervention ---------- */

/**
 * Hors de la zone, nous envoyons la box (company.serviceArea.outside, dans
 * src/data/entreprise.ts). Les frais d'envoi ne sont pas encore fixés : pages
 * Offres et Commander, et FAQ.
 */
export const shippingCost = todo(
  'Frais d’envoi de la box hors de la zone d’intervention : compris dans le prix ou en supplément, et combien',
  '[à confirmer]',
);

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
  storageExtra: (option: StorageOption): TodoValue =>
    missing(`Supplément de l’option de stockage ${option.label}`, '[à confirmer]'),
  deposit: missing('Acompte demandé à la commande, entre 30 et 50 %', '[30 à 50 %]'),
} as const;

/** Acompte demandé à la commande : « 30 % », ou le repère jaune. */
export const depositText: Maybe<string> =
  pricing.depositPercent === null ? missingPrice.deposit : formatPercent(pricing.depositPercent);

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
