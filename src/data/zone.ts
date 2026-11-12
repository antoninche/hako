/**
 * Zone d’intervention : les quatre villes de la phrase « Nous intervenons de
 * Salon-de-Provence à Toulon, en passant par Aix-en-Provence et Marseille. »
 * (company.serviceArea.sentence, dans entreprise.ts), et les textes de la carte.
 *
 * Position de chaque ville : celle de sa mairie, donnée par l’API Découpage
 * administratif de l’État (geo.api.gouv.fr, champ « mairie », issu d’ADMIN
 * EXPRESS de l’IGN, Licence Ouverte 2.0). Ces valeurs ont été comparées à une
 * seconde source indépendante, Wikidata (propriété P625) : l’écart va de
 * 150 à 550 m selon la ville. Le tableau complet est dans docs/carte.md, et
 * `npm run map:build -- --verifier` refait la comparaison.
 *
 * La carte (src/components/carte/ZoneMap.astro) place les villes à partir des
 * valeurs ci-dessous : corriger une latitude ou une longitude ici suffit, sans
 * relancer le script de la carte.
 *
 * Ce fichier n’importe rien : le script scripts/map/build.mjs le lit
 * directement avec Node.
 */

/** Place de la ville dans la phrase : « de … », « en passant par … », « à … ». */
export type CityRole = 'depart' | 'passage' | 'arrivee';

export interface ZoneCity {
  /** Identifiant stable, utilisé par la carte pour placer le nom. */
  readonly id: 'salon-de-provence' | 'aix-en-provence' | 'marseille' | 'toulon';
  /** Nom officiel de la commune, tel qu’il s’affiche. */
  readonly name: string;
  /** Code officiel géographique de la commune (Insee). */
  readonly inseeCode: string;
  /** Latitude en degrés décimaux (WGS 84), positive vers le nord. */
  readonly latitude: number;
  /** Longitude en degrés décimaux (WGS 84), positive vers l’est. */
  readonly longitude: number;
  readonly role: CityRole;
  /** D’où vient la position, et quand elle a été relevée (AAAA-MM-JJ). */
  readonly source: {
    readonly url: string;
    readonly field: 'mairie';
    readonly retrievedOn: string;
  };
}

/** Les villes, dans l’ordre de la phrase. */
export const zoneCities: readonly ZoneCity[] = [
  {
    id: 'salon-de-provence',
    name: 'Salon-de-Provence',
    inseeCode: '13103',
    latitude: 43.6407,
    longitude: 5.099,
    role: 'depart',
    source: {
      url: 'https://geo.api.gouv.fr/communes/13103?fields=nom,centre,mairie',
      field: 'mairie',
      retrievedOn: '2026-11-12',
    },
  },
  {
    id: 'aix-en-provence',
    name: 'Aix-en-Provence',
    inseeCode: '13001',
    latitude: 43.5298,
    longitude: 5.4474,
    role: 'passage',
    source: {
      url: 'https://geo.api.gouv.fr/communes/13001?fields=nom,centre,mairie',
      field: 'mairie',
      retrievedOn: '2026-11-12',
    },
  },
  {
    id: 'marseille',
    name: 'Marseille',
    inseeCode: '13055',
    latitude: 43.2965,
    longitude: 5.3698,
    role: 'passage',
    source: {
      url: 'https://geo.api.gouv.fr/communes/13055?fields=nom,centre,mairie',
      field: 'mairie',
      retrievedOn: '2026-11-12',
    },
  },
  {
    id: 'toulon',
    name: 'Toulon',
    inseeCode: '83137',
    latitude: 43.1204,
    longitude: 5.9325,
    role: 'arrivee',
    source: {
      url: 'https://geo.api.gouv.fr/communes/83137?fields=nom,centre,mairie',
      field: 'mairie',
      retrievedOn: '2026-11-12',
    },
  },
];

/** Textes de la carte et de sa légende. */
export const zoneMapText = {
  /** Annoncé aux lecteurs d’écran avant la phrase de la légende. */
  mapName: 'Carte de notre zone d’intervention.',
  /** Nom de la mer, écrit sur la carte. */
  sea: 'Mer Méditerranée',
  /** Nom de la liste des villes, sous la carte (lu par les lecteurs d’écran). */
  citiesHeading: 'Villes de la zone',
  /** La zone n’a pas de limite exacte : la carte la suggère seulement. */
  note: 'Les contours de la zone sont indicatifs.',
  /**
   * Sources de la carte. La Licence Ouverte demande de citer le producteur des
   * données (l’IGN) et leur date ; Natural Earth n’exige rien, on le cite quand même.
   */
  credit:
    'Sources : Natural Earth ; IGN, ADMIN EXPRESS, via geo.api.gouv.fr (Licence Ouverte 2.0, novembre 2026).',
} as const;
