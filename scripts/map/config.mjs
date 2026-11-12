// Réglages de la carte de la zone d'intervention : sources, cadre, projection
// et finesse du tracé. Voir docs/carte.md.

/**
 * Natural Earth, échelle 1:10 000 000, domaine public.
 * Fichiers GeoJSON du dépôt officiel, figés sur la version 5.1.2 (le lien
 * pointe sur le commit de cette version) et vérifiés par leur empreinte
 * SHA-256 : si un fichier change, le script s'arrête.
 */
export const NATURAL_EARTH = {
  version: '5.1.2',
  repository: 'https://github.com/nvkelso/natural-earth-vector',
  commit: 'f1890d9f152c896d250a77557a5751a93d494776',
  layers: [
    {
      // Terres émergées (l'étang de Berre y apparaît comme de la mer).
      id: 'land',
      file: 'ne_10m_land.geojson',
      sha256: '1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416',
      role: 'land',
    },
    {
      // Petites îles, absentes de la couche précédente.
      id: 'minor-islands',
      file: 'ne_10m_minor_islands.geojson',
      sha256: '8c933ca7a4760256bdc46408355706e39764b0fa01c160c28888b90b4faec29f',
      role: 'land',
    },
    {
      // Lacs et étangs d'Europe, retirés des terres.
      id: 'lakes-europe',
      file: 'ne_10m_lakes_europe.geojson',
      sha256: 'b4dd9e7a5edd0d07b54768b5404d1ebe77f80b9d579c85fff65f90cf50369769',
      role: 'water',
    },
  ],
};

/** Adresse de téléchargement d'un fichier, figée sur le commit de la version. */
export const naturalEarthUrl = (file) =>
  `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NATURAL_EARTH.commit}/geojson/${file}`;

/**
 * Cadre de la carte, en degrés (WGS 84), et taille du dessin en unités SVG.
 * La latitude sud du cadre se déduit de la hauteur (environ 42,95°). Au nord,
 * le cadre s'arrête juste avant le lac de Sainte-Croix (43,739°).
 *
 * Projection équirectangulaire : x = (λ − λmin) × cos φ0 × s et
 * y = (φmax − φ) × s, avec s = largeur / ((λmax − λmin) × cos φ0).
 * Le facteur cos φ0 rend les distances est-ouest justes à la latitude φ0,
 * au milieu du cadre ; ailleurs sur la carte, l'écart reste sous 0,7 %.
 */
export const FRAME = {
  lonMin: 4.88,
  lonMax: 6.32,
  latMax: 43.735,
  latRef: 43.34,
  width: 1000,
  height: 750,
};

/** Finesse du tracé, en unités SVG (1 unité ≈ 117 m sur le terrain). */
export const DRAWING = {
  /** Bande hors cadre prise en compte pour les calculs (côtes et lignes d'eau voisines). */
  computeMargin: 60,
  /** Bande hors cadre gardée dans les tracés livrés : elle évite tout bord visible. */
  outputMargin: 10,
  /** Passes de lissage (Chaikin) qui adoucissent la côte, très anguleuse à cette échelle. */
  coastSmoothing: 2,
  /** Passes de lissage des lignes d'eau. */
  waterSmoothing: 2,
  /** Écart maximal toléré par la simplification (Douglas-Peucker). */
  tolerance: 0.45,
  /** Distance à la côte de chaque ligne d'eau, de la plus éloignée à la plus proche. */
  waterLevels: [42, 24, 10],
  /** Surface minimale d'un contour gardé (unités²) : écarte les miettes. */
  minRingArea: 6,
  /** Décimales des coordonnées livrées. */
  decimals: 1,
};

/** Longueur de l'échelle graphique, en kilomètres. */
export const SCALE_BAR_KM = 20;

/** Fichier produit, lu par src/components/carte/ZoneMap.astro. */
export const OUTPUT = 'src/components/carte/carte-data.json';

/** Dossier de cache des téléchargements (ignoré par git). */
export const CACHE_DIR = '.tmp/carte/sources';
