// Réglages de la vectorisation du logo et de la fabrication des icônes.
// Toutes les mesures sont en pixels des PNG d'origine.

export const COLOURS = {
  chocolat: '#412D1E', // encre du logo (vérifiée dans la palette des PNG)
  creme: '#FDF7EF', // fond principal de la charte
};

// Les trois PNG fournis, et le nom des SVG qui en sont tirés.
export const SOURCES = [
  { id: 'paysage', file: 'brand/HAKO_Landscape_Transparent.png' },
  { id: 'carre', file: 'brand/HAKO_Square_Transparent.png' },
  { id: 'reseaux', file: 'brand/HAKO_SocialMedia_Transparent.png' },
];

// Le kanji seul vient du PNG où il est le plus grand, le mot HAKO seul aussi.
export const KANJI_SOURCE = 'carre';
export const WORDMARK_SOURCE = 'paysage';

export const TRACE = {
  // Suréchantillonnage avant vectorisation : chaque pixel devient
  // scale × scale sous-pixels, ce qui exploite l'anticrénelage.
  scale: 8,
  // Kanji : traits courbes et terminaisons en biseau. potrace (alphamax 1,
  // réglage par défaut des angles ; tolérance de fusion des courbes exprimée
  // en pixels source, transmise multipliée par scale), puis redessin :
  // angles vifs, côtés droits, courbes de Bézier lissées (voir lib/fit.mjs).
  kanji: {
    potrace: { alphamax: 1, opttolerance: 0.2, turdsize: 2 },
    refit: {
      cornerWindow: 1.5, // fenêtre (px) de mesure du virage
      cornerAngle: 38, // virage minimal (degrés) d'un angle vif
      tolerance: 0.3, // écart maximal (px) entre les courbes et les points retenus
      axisAngle: 0.75, // côté droit à moins de 0,75° de l'horizontale ou de la verticale : redressé
      maxExtend: 1.5, // déplacement maximal (px) d'un angle recalculé
      maxExtendAcute: 0.5, // idem pour un angle aigu (moins de 80°)
    },
  },
  // Lettres HAKO : polygones à bords droits et angles vifs. potrace avec
  // alphamax 0 (que des segments droits), puis redressement.
  wordmark: {
    potrace: { alphamax: 0, turdsize: 2 },
    straighten: {
      cornerTol: 0.8, // écart (px) au-delà duquel un sommet est un vrai angle
      trim: 2, // longueur (px) ignorée près des angles lors de l'ajustement des côtés
      axisAngle: 0.75, // en degrés : un côté plus proche de l'horizontale ou de la verticale est redressé
      alignTol: 0.05, // côtés alignés à moins de 0,05 px : même coordonnée
      shortEdge: 3, // côté plus court (px) entre deux côtés non parallèles : arrondi parasite
      mergeAngle: 4, // côtés consécutifs presque alignés (degrés)
      mergeShort: 8,
    },
  },
  // Précision des coordonnées dans les SVG livrés (décimales).
  precision: 2,
};

// Agrandissements de contrôle (×4) : [x, y, largeur, hauteur] en pixels source.
export const CROPS = {
  paysage: [
    { name: 'h-coin-haut-gauche', rect: [530, 90, 60, 60] },
    { name: 'h-traverse', rect: [610, 225, 60, 75] },
    { name: 'a-coin-haut', rect: [925, 88, 60, 60] },
    { name: 'k-jonction', rect: [1420, 215, 90, 90] },
    { name: 'k-creux', rect: [1545, 225, 70, 70] },
    { name: 'o-biseau', rect: [1735, 310, 100, 120] },
    { name: 'o-biseau-interieur', rect: [1830, 300, 80, 90] },
    { name: 'kanji-haut', rect: [95, 70, 110, 80] },
    { name: 'kanji-crochet', rect: [250, 70, 70, 60] },
    { name: 'kanji-courbe', rect: [50, 280, 90, 130] },
    { name: 'kanji-coin-bas', rect: [225, 395, 60, 55] },
  ],
  carre: [
    { name: 'h-coin', rect: [20, 828, 50, 50] },
    { name: 'k-jonction', rect: [600, 900, 70, 70] },
    { name: 'k-creux', rect: [680, 920, 50, 50] },
    { name: 'o-biseau', rect: [800, 975, 80, 80] },
    { name: 'kanji-crochet-gauche', rect: [355, 125, 80, 50] },
    { name: 'kanji-crochet-droit', rect: [585, 125, 80, 50] },
    { name: 'kanji-pointe-haut', rect: [385, 305, 80, 40] },
    { name: 'kanji-courbe-gauche', rect: [270, 420, 140, 230] },
    { name: 'kanji-trait-droit', rect: [440, 450, 110, 140] },
    { name: 'kanji-biseau-bambou', rect: [400, 230, 100, 85] },
    { name: 'kanji-coin-bas', rect: [740, 670, 75, 50] },
  ],
  reseaux: [
    { name: 'h-coin', rect: [198, 712, 40, 40] },
    { name: 'k-jonction', rect: [585, 770, 60, 50] },
    { name: 'o-biseau', rect: [718, 805, 60, 65] },
    { name: 'a-coin-haut', rect: [515, 710, 35, 35] },
    { name: 'kanji-crochet', rect: [375, 150, 70, 45] },
    { name: 'kanji-pointe-haut', rect: [405, 305, 70, 40] },
    { name: 'kanji-courbe', rect: [300, 420, 120, 190] },
  ],
};

// Icônes tirées du kanji (proportions exprimées pour un carré de côté 1).
export const ICONS = {
  // Favicon : carré crème aux coins arrondis, kanji chocolat aussi grand que
  // possible pour rester lisible à 16 px.
  favicon: {
    radius: 0.1875,
    // Taille du kanji essayée (part de la hauteur) et décalage maximal (en
    // pixels à 16 px) pour caler les traits sur la grille de 16 pixels.
    gridFit: { px: 16, heights: [0.8, 0.81, 0.82, 0.83, 0.84, 0.85, 0.86, 0.87, 0.88], shift: 0.5 },
  },
  // Icônes « any » du manifeste (192 et 512) : même dessin, plus aéré.
  app: { radius: 0.1875, kanjiHeight: 0.7 },
  // Icône Apple : fond crème plein (iOS arrondit lui-même les coins).
  apple: { kanjiHeight: 0.66 },
  // Icône « maskable » : fond plein, kanji entièrement dans le cercle de
  // sécurité (80 % du côté) que les systèmes peuvent découper.
  maskable: { safeDiameter: 0.8, margin: 0.97 },
  // Image de partage (Open Graph) : logo « réseaux » centré, hauteur relative.
  og: { width: 1200, height: 630, logoHeight: 0.62 },
};
