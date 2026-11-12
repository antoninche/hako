/**
 * Calcul des montants d'une commande, à partir de src/data/tarifs.ts.
 *
 * Règle d'honnêteté : un prix qui n'est pas encore fixé (null) n'est jamais
 * compté comme 0. Le total devient alors « inconnu » (null) et la partie déjà
 * chiffrée reste disponible, pour afficher par exemple « 1 000 € + [prix] ».
 */
import type { Offer, OfferId, Pricing, StorageId, StorageOption } from '../../data/tarifs.ts';

export interface Deposit {
  /** Pourcentage du paiement unique ; null tant qu'il n'est pas décidé. */
  readonly percent: number | null;
  /** Montant de l'acompte ; null si le pourcentage ou le total manque. */
  readonly amountEur: number | null;
}

export interface Quote {
  readonly offer: Offer;
  readonly storage: StorageOption;
  /** Prix d'achat de la box. */
  readonly offerPriceEur: number;
  /** Supplément du stockage choisi : 0 s'il est compris, null si son prix n'est pas fixé. */
  readonly storageExtraEur: number | null;
  /** Partie déjà chiffrée du paiement unique. */
  readonly oneTimeKnownEur: number;
  /** Paiement unique complet ; null tant qu'une partie n'a pas de prix. */
  readonly oneTimeTotalEur: number | null;
  /** Abonnement mensuel (Hako Pro) ; null pour une offre sans abonnement. */
  readonly monthlyEur: number | null;
  readonly deposit: Deposit;
}

const OFFER_IDS: readonly OfferId[] = ['home', 'pro'];

/** Lit le paramètre « ?offre= » de l'adresse : « home », « pro », ou rien d'autre. */
export function parseOfferId(value: string | null | undefined): OfferId | null {
  const normalized = value?.trim().toLowerCase();
  return OFFER_IDS.find((id) => id === normalized) ?? null;
}

export function findOffer(pricing: Pricing, id: OfferId): Offer {
  return pricing.offers[id];
}

export function findStorage(pricing: Pricing, id: StorageId): StorageOption {
  const option = pricing.storage.find((candidate) => candidate.id === id);
  if (!option) throw new Error(`Option de stockage inconnue : ${id}`);
  return option;
}

/** Acompte : arrondi au centime, et seulement si le pourcentage et le total sont connus. */
export function computeDeposit(totalEur: number | null, percent: number | null): Deposit {
  if (percent === null || totalEur === null) return { percent, amountEur: null };
  return { percent, amountEur: Math.round(totalEur * percent) / 100 };
}

export function computeQuote(pricing: Pricing, offerId: OfferId, storageId: StorageId): Quote {
  const offer = findOffer(pricing, offerId);
  const storage = findStorage(pricing, storageId);
  const storageExtraEur = storage.extraEur;
  const oneTimeKnownEur = offer.priceEur + (storageExtraEur ?? 0);
  const oneTimeTotalEur = storageExtraEur === null ? null : oneTimeKnownEur;
  return {
    offer,
    storage,
    offerPriceEur: offer.priceEur,
    storageExtraEur,
    oneTimeKnownEur,
    oneTimeTotalEur,
    monthlyEur: offer.subscription?.monthlyEur ?? null,
    deposit: computeDeposit(oneTimeTotalEur, pricing.depositPercent),
  };
}

/** Clé d'une combinaison offre + stockage, utilisée dans la page : « pro:2to ». */
export function quoteKey(offerId: OfferId, storageId: StorageId): string {
  return `${offerId}:${storageId}`;
}

/** Toutes les combinaisons possibles, dans l'ordre du fichier des tarifs. */
export function listQuotes(pricing: Pricing): readonly Quote[] {
  return OFFER_IDS.flatMap((offerId) =>
    pricing.storage.map((option) => computeQuote(pricing, offerId, option.id)),
  );
}
