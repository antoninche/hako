// Favicon, icônes d'application et image de partage, tirés du tracé vectoriel.

import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { optimizeSvg } from './svg.mjs';

// Rendu géométrique précis ; aucune police n'est chargée (les SVG n'ont pas de texte).
const RESVG = { shapeRendering: 2, font: { loadSystemFonts: false } };

/** Rend un SVG en image PNG à la largeur demandée. */
export function rasterize(svg, width) {
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: width }, ...RESVG }).render();
  return { width: img.width, height: img.height, png: img.asPng() };
}

/**
 * Réduit un PNG à une palette (quelques dizaines de couleurs suffisent pour
 * deux teintes et leurs bords lissés) : fichiers bien plus légers.
 */
export async function palettePng(png, colours = 64) {
  return sharp(png)
    .png({ palette: true, colours, quality: 100, dither: 0, compressionLevel: 9, effort: 10 })
    .toBuffer();
}

/**
 * Place le tracé du kanji (boîte [w, h], origine en 0,0) dans un carré de
 * côté `size` : hauteur relative `kanjiHeight`, centré.
 * Renvoie la transformation SVG.
 */
export function fitTransform([w, h], size, kanjiHeight, maxWidth = 1) {
  const k = Math.min((kanjiHeight * size) / h, (maxWidth * size) / w);
  const tx = (size - w * k) / 2;
  const ty = (size - h * k) / 2;
  return { k, tx, ty, attr: `translate(${round(tx)} ${round(ty)}) scale(${round(k, 6)})` };
}

const round = (v, n = 3) => Number(v.toFixed(n));

/**
 * Netteté d'un rendu à `px` pixels : moyenne de |2a − 1| sur les pixels où
 * le kanji passe (a = couverture). 1 = pixels francs, 0 = tout en demi-teinte.
 */
function crispness(svg, px) {
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: px }, ...RESVG }).render();
  const p = img.pixels;
  let s = 0;
  let n = 0;
  for (let i = 0; i < p.length; i += 4) {
    const a = p[i + 3] / 255;
    if (a > 0.02) {
      s += Math.abs(2 * a - 1);
      n++;
    }
  }
  return n ? s / n : 0;
}

/**
 * Cale le kanji sur la grille de `px` pixels (16 pour un favicon) : on essaie
 * de petites variations de taille et de position (au seizième de pixel) et
 * on garde celle qui donne les traits les plus nets. Un calage à 16 px vaut
 * aussi à 32 et 48 px.
 */
export function gridFit({
  kanjiD,
  kanjiBox,
  size = 512,
  px = 16,
  heights,
  shift = 0.5,
  steps = 8,
}) {
  const unit = size / px;
  let best = null;
  for (const h of heights) {
    const t = fitTransform(kanjiBox, size, h);
    for (let i = -steps; i <= steps; i++) {
      for (let j = -steps; j <= steps; j++) {
        const dx = (i / steps) * shift * unit;
        const dy = (j / steps) * shift * unit;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><path transform="translate(${t.tx + dx} ${t.ty + dy}) scale(${t.k})" d="${kanjiD}"/></svg>`;
        const c = crispness(svg, px);
        if (!best || c > best.score + 1e-9) best = { score: c, kanjiHeight: h, dx, dy };
      }
    }
  }
  return best;
}

/** SVG d'icône : fond crème (arrondi ou plein) et kanji chocolat. */
export function iconSvg({
  kanjiD,
  kanjiBox,
  size = 512,
  radius = 0,
  kanjiHeight,
  maxWidth = 1,
  offset = [0, 0],
  creme,
  chocolat,
  precision = 2,
}) {
  const t0 = fitTransform(kanjiBox, size, kanjiHeight, maxWidth);
  const t = { ...t0, tx: t0.tx + offset[0], ty: t0.ty + offset[1] };
  t.attr = `translate(${round(t.tx)} ${round(t.ty)}) scale(${round(t.k, 6)})`;
  const bg =
    radius > 0
      ? `<rect width="${size}" height="${size}" rx="${round(radius * size)}" fill="${creme}"/>`
      : `<rect width="${size}" height="${size}" fill="${creme}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${bg}<path fill="${chocolat}" transform="${t.attr}" d="${kanjiD}"/></svg>`;
  return { svg: `${optimizeSvg(svg, precision)}\n`, transform: t };
}

/**
 * Assemble un fichier .ico à partir d'images PNG (format admis par tous les
 * navigateurs actuels et par Windows depuis Vista).
 */
export function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // réservé
  header.writeUInt16LE(1, 2); // type : icône
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // pas de palette
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); // plans
    e.writeUInt16LE(32, 6); // bits par pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}
