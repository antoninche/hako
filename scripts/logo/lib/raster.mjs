// Lecture des PNG source et préparation des bitmaps à vectoriser.
//
// Les PNG fournis sont des images à palette : chaque pixel est soit
// totalement transparent, soit totalement opaque. L'anticrénelage (le
// lissage des bords) n'est donc pas dans la couche alpha mais dans la
// couleur : les pixels de bord sont opaques et plus clairs que l'encre,
// comme si le logo avait été dessiné sur du blanc puis détouré.
// On retrouve la couverture de chaque pixel (part du pixel recouverte par
// le dessin, entre 0 et 1) à partir de sa couleur, ce qui permet de placer
// les bords à une fraction de pixel près plutôt qu'au pixel près.

import sharp from 'sharp';

/** Lit un PNG et renvoie ses pixels RVBA non prémultipliés. */
export async function readRgba(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, rgba: data };
}

export function rgbToHex([r, g, b]) {
  return `#${[r, g, b]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/**
 * Inventaire des couleurs : couleur opaque la plus fréquente (l'encre),
 * nombre de couleurs, présence de pixels semi-transparents.
 */
export function colourStats({ rgba }) {
  const counts = new Map();
  let transparent = 0;
  let semi = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a === 0) {
      transparent++;
      continue;
    }
    if (a !== 255) semi++;
    const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [inkKey, inkCount] = sorted[0];
  const ink = [(inkKey >> 16) & 255, (inkKey >> 8) & 255, inkKey & 255];
  return {
    ink,
    inkHex: rgbToHex(ink),
    inkPixels: inkCount,
    opaqueColours: counts.size,
    edgePixels: [...counts.values()].reduce((s, n) => s + n, 0) - inkCount,
    transparentPixels: transparent,
    semiTransparentPixels: semi,
    colours: sorted.map(([k, n]) => ({ rgb: [(k >> 16) & 255, (k >> 8) & 255, k & 255], n })),
  };
}

// Couverture estimée d'un pixel de bord : on suppose un mélange de l'encre
// et du blanc dans un espace de couleur de gamma g. Chaque canal donne une
// estimation ; on garde leur moyenne.
function channelCoverage(rgb, ink, g) {
  return rgb.map((v, k) => (1 - (v / 255) ** g) / (1 - (ink[k] / 255) ** g));
}

/**
 * Réunit les inventaires de couleurs de plusieurs PNG (même encre) : les
 * trois PNG fournis partagent la même palette, on ajuste donc un seul gamma.
 */
export function mergeStats(list) {
  const ink = list[0].ink;
  for (const s of list) {
    if (s.inkHex !== list[0].inkHex)
      throw new Error(`Encres différentes : ${s.inkHex} et ${list[0].inkHex}.`);
  }
  const counts = new Map();
  for (const s of list) {
    for (const { rgb, n } of s.colours) {
      const k = rgb.join(',');
      counts.set(k, { rgb, n: (counts.get(k)?.n ?? 0) + n });
    }
  }
  return { ink, inkHex: list[0].inkHex, colours: [...counts.values()].sort((a, b) => b.n - a.n) };
}

/**
 * Cherche le gamma de mélange qui rend les trois canaux cohérents entre eux
 * (écart minimal entre les couvertures estimées par R, V et B), pondéré par
 * le nombre de pixels de chaque couleur. Renvoie le gamma et l'écart résiduel.
 */
export function fitBlendGamma(stats, { min = 0.8, max = 3, step = 0.01 } = {}) {
  const edges = stats.colours.slice(1);
  let best = null;
  for (let g = min; g <= max + 1e-9; g += step) {
    let err = 0;
    let weight = 0;
    let worst = 0;
    for (const { rgb, n } of edges) {
      const c = channelCoverage(rgb, stats.ink, g);
      const spread = Math.max(...c) - Math.min(...c);
      err += n * spread * spread;
      weight += n;
      worst = Math.max(worst, spread);
    }
    const rms = Math.sqrt(err / weight);
    if (!best || rms < best.rms) best = { gamma: Math.round(g * 100) / 100, rms, worst };
  }
  // Couverture du pixel de bord le plus clair : c'est le seuil sous lequel
  // les pixels ont été rendus transparents lors du détourage.
  const lightest = edges.reduce((a, b) =>
    a.rgb[0] + a.rgb[1] + a.rgb[2] > b.rgb[0] + b.rgb[1] + b.rgb[2] ? a : b,
  );
  const cut = channelCoverage(lightest.rgb, stats.ink, best.gamma);
  best.cutCoverage = cut.reduce((s, v) => s + v, 0) / 3;
  best.lightestHex = rgbToHex(lightest.rgb);
  return best;
}

/** Carte de couverture (Float32Array, une valeur par pixel, entre 0 et 1). */
export function coverageMap({ width, height, rgba }, ink, gamma) {
  const cov = new Float32Array(width * height);
  const cache = new Map();
  for (let i = 0, p = 0; p < cov.length; i += 4, p++) {
    const a = rgba[i + 3];
    if (a === 0) continue;
    const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
    let c = cache.get(key);
    if (c === undefined) {
      const ch = channelCoverage([rgba[i], rgba[i + 1], rgba[i + 2]], ink, gamma);
      c = Math.min(1, Math.max(0, (ch[0] + ch[1] + ch[2]) / 3));
      cache.set(key, c);
    }
    // Un pixel partiellement transparent (absent des PNG actuels) compte
    // aussi pour sa transparence.
    cov[p] = c * (a / 255);
  }
  return cov;
}

/** Masque binaire de la couche alpha (vrai si alpha >= 50 %). */
export function alphaMask({ width, height, rgba }) {
  const m = new Uint8Array(width * height);
  for (let p = 0; p < m.length; p++) m[p] = rgba[p * 4 + 3] >= 128 ? 1 : 0;
  return m;
}

/**
 * Sépare le kanji et le mot HAKO : on cherche la plus large bande vide
 * (colonnes pour le logo en largeur, lignes pour les logos carrés) entre
 * les deux groupes. Renvoie deux rectangles [x0, y0, x1, y1[ en pixels.
 */
export function splitKanjiWordmark(mask, width, height) {
  const cols = new Uint32Array(width);
  const rows = new Uint32Array(height);
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      cols[x]++;
      rows[y]++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const widestGap = (arr, lo, hi) => {
    let best = { start: -1, len: 0 };
    let start = -1;
    for (let i = lo; i <= hi + 1; i++) {
      if (i <= hi && arr[i] === 0) {
        if (start < 0) start = i;
      } else if (start >= 0) {
        if (i - start > best.len) best = { start, len: i - start };
        start = -1;
      }
    }
    return best;
  };
  const gc = widestGap(cols, x0, x1);
  const gr = widestGap(rows, y0, y1);
  const bbox = [x0, y0, x1 + 1, y1 + 1];
  if (gc.len >= gr.len) {
    // kanji à gauche, mot à droite
    const cut = gc.start + Math.floor(gc.len / 2);
    return {
      layout: 'row',
      bbox,
      gap: gc,
      kanji: [x0, y0, cut, y1 + 1],
      wordmark: [cut, y0, x1 + 1, y1 + 1],
    };
  }
  // kanji au-dessus, mot en dessous
  const cut = gr.start + Math.floor(gr.len / 2);
  return {
    layout: 'column',
    bbox,
    gap: gr,
    kanji: [x0, y0, x1 + 1, cut],
    wordmark: [x0, cut, x1 + 1, y1 + 1],
  };
}

/**
 * Suréchantillonne la couverture d'un rectangle par interpolation bilinéaire
 * (entre centres de pixels), puis seuille à 50 %. On ajoute une marge vide
 * autour du rectangle pour que les formes ne touchent pas le bord.
 * Renvoie un bitmap 1 bit au format PBM (P4) et sa géométrie.
 */
export function upsampleToPbm(
  cov,
  width,
  height,
  rect,
  scale,
  { margin = 4, threshold = 0.5 } = {},
) {
  const [rx0, ry0, rx1, ry1] = rect;
  const ox = rx0 - margin;
  const oy = ry0 - margin;
  const sw = rx1 - rx0 + 2 * margin;
  const sh = ry1 - ry0 + 2 * margin;
  const W = sw * scale;
  const H = sh * scale;
  const rowBytes = Math.ceil(W / 8);
  const header = Buffer.from(`P4\n${W} ${H}\n`, 'ascii');
  const body = Buffer.alloc(rowBytes * H);
  const at = (x, y) => {
    if (x < rx0 || y < ry0 || x >= rx1 || y >= ry1) return 0;
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    return cov[y * width + x];
  };
  for (let Y = 0; Y < H; Y++) {
    // centre du sous-pixel, en coordonnées de pixels source
    const sy = oy + (Y + 0.5) / scale - 0.5;
    const yA = Math.floor(sy);
    const fy = sy - yA;
    for (let X = 0; X < W; X++) {
      const sx = ox + (X + 0.5) / scale - 0.5;
      const xA = Math.floor(sx);
      const fx = sx - xA;
      const v =
        (1 - fy) * ((1 - fx) * at(xA, yA) + fx * at(xA + 1, yA)) +
        fy * ((1 - fx) * at(xA, yA + 1) + fx * at(xA + 1, yA + 1));
      if (v >= threshold) body[Y * rowBytes + (X >> 3)] |= 0x80 >> (X & 7);
    }
  }
  return { pbm: Buffer.concat([header, body]), origin: [ox, oy], scale, width: W, height: H };
}

/**
 * Même suréchantillonnage, mais en masque d'octets (un octet par sous-pixel),
 * limité au rectangle [x, y, largeur, hauteur], pour mesurer les écarts au
 * sous-pixel près.
 */
export function upsampleMask(cov, width, height, scale, [rx, ry, rw, rh], threshold = 0.5) {
  const W = rw * scale;
  const H = rh * scale;
  const out = new Uint8Array(W * H);
  const at = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : cov[y * width + x]);
  for (let Y = 0; Y < H; Y++) {
    const sy = ry + (Y + 0.5) / scale - 0.5;
    const yA = Math.floor(sy);
    const fy = sy - yA;
    for (let X = 0; X < W; X++) {
      const sx = rx + (X + 0.5) / scale - 0.5;
      const xA = Math.floor(sx);
      const fx = sx - xA;
      const v =
        (1 - fy) * ((1 - fx) * at(xA, yA) + fx * at(xA + 1, yA)) +
        fy * ((1 - fx) * at(xA, yA + 1) + fx * at(xA + 1, yA + 1));
      out[Y * W + X] = v >= threshold ? 1 : 0;
    }
  }
  return out;
}
