/**
 * Types partagés par la page Offres et le formulaire de commande.
 *
 * Ce fichier ne contient que des types : il ne produit aucun code dans le
 * navigateur.
 */
import type { OfferId, StorageId } from '../../data/tarifs.ts';
import type { TodoValue } from '../todo.ts';

/** Lien écrit dans un fichier de textes : jamais de HTML dans les chaînes. */
export interface LinkValue {
  readonly label: string;
  readonly href: string;
}

/** Montant à afficher dans une phrase ; null = prix pas encore fixé. */
export interface PriceValue {
  readonly amountEur: number | null;
  /** Ce qui s'affiche (en jaune) tant que le montant vaut null. */
  readonly missing: TodoValue;
  /** « month » : « 25 € par mois ». */
  readonly per?: 'month';
}

/**
 * Morceau de phrase : du texte, une information manquante (todo(…)), un lien
 * ou un montant. Une phrase qui contient une information manquante s'écrit
 * comme une liste de morceaux : ['Nous vous appelons sous ', délai, '.'].
 */
export type Inline = string | TodoValue | LinkValue | PriceValue;
export type RichText = readonly Inline[];

/** Moments de la journée proposés pour notre appel (voir src/content/commande.ts). */
export type TimeSlotId = 'matin' | 'apres-midi' | 'fin-de-journee';

/** Étapes du formulaire de commande. */
export type StepNumber = 1 | 2 | 3;

/** Coordonnées de la personne qui commande. */
export interface ContactDetails {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
  /** Code postal sans espace : « 13100 ». */
  readonly postalCode: string;
  readonly city: string;
}

/** Informations demandées seulement pour Hako Pro. */
export interface CompanyDetails {
  readonly name: string;
  /** Nombre de personnes qui auront un compte sur la box. */
  readonly users: number;
}

/**
 * Demande de commande, telle qu'elle serait transmise à un futur service.
 * Les prix affichés y figurent pour information seulement : le service qui
 * la reçoit doit toujours recalculer les montants à partir de ses propres tarifs.
 */
export interface OrderRequest {
  readonly offer: OfferId;
  readonly storage: StorageId;
  readonly contact: ContactDetails;
  /** null pour Hako Home. */
  readonly company: CompanyDetails | null;
  readonly timeSlots: readonly TimeSlotId[];
  /** Précisions libres sur les disponibilités (peut être vide). */
  readonly availabilityNote: string;
  /**
   * Le code postal semble hors de notre zone d'intervention : la demande reste
   * possible, la box est alors envoyée et installée avec notre guide.
   */
  readonly outsideServiceArea: boolean;
  readonly acceptedTerms: boolean;
  readonly acknowledgedPrivacy: boolean;
  readonly displayedQuote: {
    readonly oneTimeTotalEur: number | null;
    readonly monthlyEur: number | null;
    readonly depositPercent: number | null;
    readonly depositEur: number | null;
  };
}
