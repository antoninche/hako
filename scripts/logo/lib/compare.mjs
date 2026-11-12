// Comparaison d'un SVG avec le PNG d'origine : rendu avec resvg (à 4 fois la
// taille, puis ramené à la taille exacte du PNG), seuil à 50 %, indicateurs
// chiffrés et images de contrôle.
//
// Couleurs des images de contrôle : rouge = pixels présents seulement dans
// le PNG, bleu = pixels présents seulement dans le SVG, beige = pixels
// communs ; sur les agrandissements, le contour du SVG est tracé en vert.

import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

// Rendu géométrique précis ; aucune police n'est chargée (les SVG n'ont pas de texte).
const RESVG = { shapeRendering: 2, font: { loadSystemFonts: false } };

const RED = [227, 0, 27];
const BLUE = [0, 80, 230];
const BOTH = [207, 198, 189];
const GREEN = '#00A651';

/**
 * Rend un SVG en couverture (0..1 par pixel) à la largeur demandée.
 * resvg ne calcule la couverture verticale qu'au quart de pixel près : un
 * bord à 0,41 px du haut d'une rangée y donne 0,50 au lieu de 0,59. On rend
 * donc `supersample` fois plus grand, puis on fait la moyenne de chaque bloc.
 */
export function renderCoverage(svg, width, supersample = 4) {
  const k = supersample;
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width * k }, ...RESVG });
  const img = r.render();
  const W = img.width;
  const w = Math.floor(W / k);
  const h = Math.floor(img.height / k);
  const cov = new Float32Array(w * h);
  const px = img.pixels;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dy = 0; dy < k; dy++) {
        const row = (y * k + dy) * W + x * k;
        for (let dx = 0; dx < k; dx++) s += px[(row + dx) * 4 + 3];
      }
      cov[y * w + x] = s / (255 * k * k);
    }
  }
  return { width: w, height: h, cov };
}

export function threshold(cov, t = 0.5) {
  const m = new Uint8Array(cov.length);
  for (let i = 0; i < cov.length; i++) m[i] = cov[i] >= t ? 1 : 0;
  return m;
}

/** Extrait le rectangle [x, y, largeur, hauteur] d'un masque de largeur w. */
export function cropMask(mask, w, [x0, y0, cw, ch]) {
  const out = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++)
    out.set(mask.subarray((y0 + y) * w + x0, (y0 + y) * w + x0 + cw), y * cw);
  return out;
}

/** Remplace le viewBox d'un SVG (pour n'en rendre qu'une zone). */
export function withViewBox(svg, [x, y, w, h]) {
  return svg
    .replace(/viewBox="[^"]*"/, `viewBox="${x} ${y} ${w} ${h}"`)
    .replace(/\s(width|height)="[^"]*"/g, '');
}

// Transformée de distance euclidienne exacte (Felzenszwalb et Huttenlocher) :
// pour chaque pixel, carré de la distance au pixel « source » le plus proche.
function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

function distanceTransform(sources, w, h) {
  const INF = 1e20;
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = sources[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = out[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = out[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = d[x];
  }
  return out;
}

/** Pixels de bord d'un masque (pixel plein ayant un voisin vide). */
function boundary(m, w, h) {
  const b = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!m[i]) continue;
      if (
        x === 0 ||
        y === 0 ||
        x === w - 1 ||
        y === h - 1 ||
        !m[i - 1] ||
        !m[i + 1] ||
        !m[i - w] ||
        !m[i + w]
      )
        b[i] = 1;
    }
  }
  return b;
}

/**
 * Écarts entre les bords de deux masques : pour chaque pixel de bord de l'un,
 * distance au bord de l'autre. Renvoie le plus grand écart (distance de
 * Hausdorff), la moyenne, les centiles 95 et 99, et les endroits des plus
 * grands écarts (séparés d'au moins `spacing` pixels).
 */
export function boundaryDeviation(a, b, w, h, { spacing = 12, top = 5 } = {}) {
  const ba = boundary(a, w, h);
  const bb = boundary(b, w, h);
  const da = distanceTransform(ba, w, h);
  const db = distanceTransform(bb, w, h);
  const values = [];
  const spots = [];
  for (let i = 0; i < ba.length; i++) {
    if (ba[i]) {
      const d = Math.sqrt(db[i]);
      values.push(d);
      if (d > 0) spots.push([d, i]);
    }
    if (bb[i]) {
      const d = Math.sqrt(da[i]);
      values.push(d);
      if (d > 0) spots.push([d, i]);
    }
  }
  values.sort((x, y) => x - y);
  const q = (p) =>
    values.length ? values[Math.min(values.length - 1, Math.floor(p * values.length))] : 0;
  const mean = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  spots.sort((x, y) => y[0] - x[0]);
  const picked = [];
  for (const [d, i] of spots) {
    const x = i % w;
    const y = Math.floor(i / w);
    if (picked.every((p) => Math.hypot(p.at[0] - x, p.at[1] - y) >= spacing))
      picked.push({ value: d, at: [x, y] });
    if (picked.length >= top) break;
  }
  return {
    max: values.length ? values[values.length - 1] : 0,
    mean,
    p95: q(0.95),
    p99: q(0.99),
    top: picked,
  };
}

/** IoU, pixels en désaccord et écart de bord entre deux masques. */
export function maskMetrics(ref, test, w, h, spacing) {
  let inter = 0;
  let union = 0;
  let refOnly = 0;
  let testOnly = 0;
  let refCount = 0;
  for (let i = 0; i < ref.length; i++) {
    const r = ref[i];
    const t = test[i];
    if (r) refCount++;
    if (r && t) inter++;
    if (r || t) union++;
    if (r && !t) refOnly++;
    if (t && !r) testOnly++;
  }
  const hd = boundaryDeviation(ref, test, w, h, { spacing: spacing ?? 12 });
  return {
    iou: union ? inter / union : 1,
    refPixels: refCount,
    refOnlyPixels: refOnly,
    testOnlyPixels: testOnly,
    mismatchPercentOfRef: refCount ? (100 * (refOnly + testOnly)) / refCount : 0,
    mismatchPercentOfImage: (100 * (refOnly + testOnly)) / ref.length,
    maxBoundaryDeviation: hd.max,
    meanBoundaryDeviation: hd.mean,
    p95BoundaryDeviation: hd.p95,
    p99BoundaryDeviation: hd.p99,
    maxDeviationAt: hd.top[0]?.at ?? null,
    largestDeviations: hd.top,
  };
}

/** Image de différence pleine taille (PNG à palette). */
export async function diffImage(ref, test, w, h, file) {
  const rgb = Buffer.alloc(w * h * 3, 255);
  for (let i = 0; i < ref.length; i++) {
    const c = ref[i] && test[i] ? BOTH : ref[i] ? RED : test[i] ? BLUE : null;
    if (c) rgb.set(c, i * 3);
  }
  await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .png({ palette: true, colours: 8, dither: 0, compressionLevel: 9, effort: 10 })
    .toFile(file);
}

/**
 * Agrandissement ×zoom d'une zone : PNG d'origine (sur blanc) en pixels
 * nets, désaccords en rouge et bleu translucides, contour du SVG en vert.
 */
// `offset` : décalage du tracé dans le repère du PNG, pour un fichier dont le
// cadre a été resserré autour du dessin (origine ramenée en 0,0).
export async function zoomCrop({
  rgba,
  width,
  ref,
  test,
  pathData,
  offset = [0, 0],
  rect,
  zoom = 4,
  file,
}) {
  const [x0, y0, cw, ch] = rect;
  const W = cw * zoom;
  const H = ch * zoom;
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const sx = x0 + x;
      const sy = y0 + y;
      const i = sy * width + sx;
      const a = rgba[i * 4 + 3] / 255;
      let c = [0, 1, 2].map((k) => Math.round(rgba[i * 4 + k] * a + 255 * (1 - a)));
      const tint = ref[i] && !test[i] ? RED : test[i] && !ref[i] ? BLUE : null;
      if (tint) c = c.map((v, k) => Math.round(v * 0.35 + tint[k] * 0.65));
      for (let dy = 0; dy < zoom; dy++) {
        for (let dx = 0; dx < zoom; dx++) out.set(c, ((y * zoom + dy) * W + x * zoom + dx) * 3);
      }
    }
  }
  const outline = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${x0} ${y0} ${cw} ${ch}"><path transform="translate(${offset[0]} ${offset[1]})" d="${pathData}" fill="none" stroke="${GREEN}" stroke-width="${1.5 / zoom}"/></svg>`;
  const line = new Resvg(outline, { fitTo: { mode: 'width', value: W }, ...RESVG })
    .render()
    .asPng();
  await sharp(out, { raw: { width: W, height: H, channels: 3 } })
    .composite([{ input: line }])
    .png({ palette: true, colours: 64, dither: 0, compressionLevel: 9, effort: 10 })
    .toFile(file);
}
