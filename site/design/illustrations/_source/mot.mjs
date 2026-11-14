// Le mot HAKO du logo, posé sur la grande face avant de la box, celle que l'on
// voit sur l'image de trois quarts du prototype.
//
// Le tracé est celui du logo officiel (src/assets/brand/hako-mot.svg, viewBox
// 0 0 1567 323.5), recopié tel quel ci-dessous : si le logo change, recopier
// son attribut d puis reconstruire la série. Le contour est lu une fois ; chaque
// dessin le pose ensuite à la taille voulue sur la face de la box. Le mot n'est
// jamais écrit en texte ni redessiné à la main.
import { lireContour } from './kanji.mjs';

export const MOT_W = 1567;
export const MOT_H = 323.5;

const MOT_D =
  'M398.03 0v323.25h97.94V185.5h171.4v137.75h96.6V0ZM665 47.5v90.13H497.78V47.5ZM1201.01 0v234.77l78.14 88.73H1567V0ZM1471 47.5V276h-119.06L1297 213.63V47.5ZM0 .5v323h95V185.38h168V323.5h97V.5h-97v137.37H95V.5Zm802 0v323h95v-140h47.36l121.99 140h105.97l-140.45-164.92L1171.97.5h-109.2l-118.9 136H897V.5Z';

const SOUS_CHEMINS = lireContour(MOT_D);

const r1 = (v) => Math.round(v * 10) / 10;

/**
 * Chemin du mot posé par map(gx, gy) -> [x, y], où (gx, gy) sont les
 * coordonnées du logo (0 à MOT_W, 0 à MOT_H). Les lettres n'ont que des côtés
 * droits : chaque sommet est gardé, arrondi au dixième d'unité du dessin.
 * Les contreformes du A et du O tournent dans l'autre sens que les lettres :
 * elles restent vides avec la règle de remplissage par défaut.
 */
export function motD(map) {
  let d = '';
  for (const sous of SOUS_CHEMINS) {
    const pts = [];
    for (const [gx, gy] of sous) {
      const [x, y] = map(gx, gy).map(r1);
      const der = pts.at(-1);
      if (!der || der[0] !== x || der[1] !== y) pts.push([x, y]);
    }
    if (pts.length > 1 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop();
    if (pts.length < 3) continue;
    d += `M${pts[0][0]} ${pts[0][1]}`;
    for (let k = 1; k < pts.length; k++) d += `L${pts[k][0]} ${pts[k][1]}`;
    d += 'Z';
  }
  return d;
}
