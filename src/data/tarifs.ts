/**
 * Tarifs et options : la seule source des prix du site.
 *
 * La page Offres, le formulaire de commande et l'accueil lisent tous ce fichier.
 * Une valeur `null` veut dire « pas encore décidé » : le site affiche alors
 * automatiquement un repère jaune à la place, et `npm run todos` la recense
 * grâce au commentaire « // TODO: » écrit sur la même ligne.
 *
 * Pour fixer un prix, remplacez `null` par le nombre (en euros, sans espace ni
 * symbole) et supprimez le commentaire TODO de la ligne. Exemple :
 *   extraEur: null, // TODO: supplément de l'option 2 To
 * devient
 *   extraEur: 90,
 */

export type OfferId = 'home' | 'pro';
export type StorageId = '1to' | '2to' | '4to';

export interface Subscription {
  /** Montant mensuel en euros. */
  readonly monthlyEur: number;
  /** « TTC », « HT »… ; null = à confirmer. */
  readonly taxStatus: string | null;
  /** Durée d'engagement, en clair (ex. « 12 mois ») ; null = à décider. */
  readonly commitment: string | null;
  /** Délai de réponse garanti du support prioritaire ; null = à décider. */
  readonly responseTime: string | null;
}

export interface Offer {
  readonly id: OfferId;
  /** Nom du produit, affiché tel quel. */
  readonly name: string;
  /** À qui s'adresse l'offre, en quelques mots. */
  readonly audience: string;
  /** Prix d'achat unique, en euros. */
  readonly priceEur: number;
  /** « TTC », « HT »… ; null = à confirmer. */
  readonly taxStatus: string | null;
  /** Abonnement d'assistance, seulement pour les offres qui en ont un. */
  readonly subscription?: Subscription;
  /** Durée des mises à jour de sécurité incluses (offre sans abonnement). */
  readonly securityUpdates?: string | null;
  /** Tarif d'une intervention de service après-vente, en euros. */
  readonly afterSalesRateEur?: number | null;
  /** Statut de TVA de ce tarif : « TTC », « HT »… ; null = à confirmer. */
  readonly afterSalesTaxStatus?: string | null;
}

export interface StorageOption {
  readonly id: StorageId;
  /** Capacité affichée, par exemple « 1 To » (l'espace avant To est insécable : U+00A0). */
  readonly label: string;
  /** Supplément en euros (0 = inclus) ; null = prix à décider. */
  readonly extraEur: number | null;
}

export interface Pricing {
  readonly currency: 'EUR';
  readonly offers: Readonly<Record<OfferId, Offer>>;
  readonly storage: readonly StorageOption[];
  /** Stockage inclus dans toutes les offres. */
  readonly includedStorage: StorageId;
  /** Acompte demandé à la commande, en pourcentage du prix ; null = à décider. */
  readonly depositPercent: number | null;
}

export const pricing: Pricing = {
  currency: 'EUR',
  offers: {
    home: {
      id: 'home',
      name: 'Hako Home',
      audience: 'Pour les familles',
      priceEur: 600,
      taxStatus: 'TTC',
      securityUpdates: '5 ans, renouvelables',
      afterSalesRateEur: 100,
      afterSalesTaxStatus: 'TTC',
    },
    pro: {
      id: 'pro',
      name: 'Hako Pro',
      audience: 'Pour les petites entreprises',
      priceEur: 1000,
      taxStatus: 'TTC',
      afterSalesRateEur: 100,
      afterSalesTaxStatus: 'TTC',
      subscription: {
        monthlyEur: 25,
        taxStatus: 'TTC',
        commitment: '2 ans',
        // Affiché après « réponse garantie sous » : « sous 48 h ».
        responseTime: '48 h',
      },
    },
  },
  storage: [
    { id: '1to', label: '1 To', extraEur: 0 },
    { id: '2to', label: '2 To', extraEur: 200 },
    { id: '4to', label: '4 To', extraEur: 400 },
  ],
  includedStorage: '1to',
  depositPercent: null, // TODO: acompte demandé à la commande, entre 30 et 50 %
};
