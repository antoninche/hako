// Régénère le logo vectoriel, le favicon, les icônes et l'image de partage
// à partir des PNG de brand/, puis le rapport de comparaison qa/logo/report.json.
//
// Usage : npm run logo:build
// Prérequis : potrace installé sur la machine (voir docs/logo.md).

import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { COLOURS, CROPS, ICONS, KANJI_SOURCE, WORDMARK_SOURCE, SOURCES, TRACE } from './config.mjs';
import {
  alphaMask,
  colourStats,
  coverageMap,
  fitBlendGamma,
  mergeStats,
  readRgba,
  splitKanjiWordmark,
  upsampleMask,
  upsampleToPbm,
} from './lib/raster.mjs';
import { mapPath, potraceVersion, trace } from './lib/potrace.mjs';
import { bbox, straightenPolygons, toPathData, translatePaths } from './lib/geometry.mjs';
import { refitPaths } from './lib/fit.mjs';
import { brandSvg, pathDataOf, standaloneSvg } from './lib/svg.mjs';
import {
  cropMask,
  diffImage,
  maskMetrics,
  renderCoverage,
  threshold,
  withViewBox,
  zoomCrop,
} from './lib/compare.mjs';
import { buildIco, gridFit, iconSvg, palettePng, rasterize } from './lib/icons.mjs';
import { SOCIAL_SOURCES, socialIcons } from './social.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const at = (...p) => join(ROOT, ...p);
const rel = (p) => relative(ROOT, p);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const r = (v, n = 4) => Number(v.toFixed(n));

function write(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  return file;
}

const pkgVersion = (name) =>
  JSON.parse(readFileSync(at('node_modules', name, 'package.json'), 'utf8')).version;

// ---------------------------------------------------------------------------
// 1. Lecture des PNG et vectorisation
// ---------------------------------------------------------------------------

async function readSource(src) {
  const file = at(src.file);
  const img = await readRgba(file);
  const stats = colourStats(img);
  if (stats.inkHex !== COLOURS.chocolat) {
    throw new Error(`${src.file} : encre ${stats.inkHex}, attendu ${COLOURS.chocolat}.`);
  }
  return { ...src, img, stats, bytes: readFileSync(file) };
}

function traceSource(s, fit) {
  const { img } = s;
  const cov = coverageMap(img, s.stats.ink, fit.gamma);
  const mask = alphaMask(img);
  const split = splitKanjiWordmark(mask, img.width, img.height);
  const S = TRACE.scale;
  const toSource = (up) => (p) =>
    mapPath(p, ([x, y]) => [up.origin[0] + x / S, up.origin[1] + y / S]);

  // Kanji : potrace, puis redessin (angles vifs, droites, courbes lissées).
  const kUp = upsampleToPbm(cov, img.width, img.height, split.kanji, S);
  const kPotrace = TRACE.kanji.potrace;
  const kanjiRaw = trace(kUp.pbm, {
    ...kPotrace,
    opttolerance: kPotrace.opttolerance * S,
    unit: 100,
  }).map(toSource(kUp));
  const { paths: kanji, log: kanjiLog } = refitPaths(kanjiRaw, TRACE.kanji.refit);

  // Lettres HAKO : polygones potrace, puis redressement.
  const wUp = upsampleToPbm(cov, img.width, img.height, split.wordmark, S);
  const wordmarkRaw = trace(wUp.pbm, { ...TRACE.wordmark.potrace, unit: 100 }).map(toSource(wUp));
  const { paths: wordmark, log: wordmarkLog } = straightenPolygons(
    wordmarkRaw,
    TRACE.wordmark.straighten,
  );

  return { ...s, cov, mask, split, kanji, wordmark, kanjiLog, wordmarkLog };
}

// ---------------------------------------------------------------------------
// 2. Comparaison d'un SVG livré avec son PNG
// ---------------------------------------------------------------------------

const pad = ([x0, y0, x1, y1], m, W, H) => {
  const a = Math.max(0, Math.floor(x0) - m);
  const b = Math.max(0, Math.floor(y0) - m);
  return [a, b, Math.min(W, Math.ceil(x1) + m) - a, Math.min(H, Math.ceil(y1) + m) - b];
};

/**
 * Compare un SVG (dans le repère du PNG) avec le PNG, sur une ou plusieurs
 * zones. `rendered` : masque du SVG rendu à la taille du PNG (seuil 50 %).
 */
function compareZone(src, svg, rendered, rect) {
  const { width: W, height: H } = src.img;
  const covMask = threshold(src.cov);
  const alpha = maskMetrics(
    cropMask(src.mask, W, rect),
    cropMask(rendered, W, rect),
    rect[2],
    rect[3],
  );
  const coverage = maskMetrics(
    cropMask(covMask, W, rect),
    cropMask(rendered, W, rect),
    rect[2],
    rect[3],
  );
  // Sous-pixel : rendu ×4 de la zone, comparé à la couverture du PNG
  // suréchantillonnée ×4 comme pour la vectorisation.
  const Z = 4;
  const sub = renderCoverage(withViewBox(svg, rect), rect[2] * Z, 1);
  const ref4 = upsampleMask(src.cov, W, H, Z, rect);
  const x4 = maskMetrics(ref4, threshold(sub.cov), rect[2] * Z, rect[3] * Z, 12 * Z);
  const place = (xy, k = 1) => (xy ? [r(rect[0] + xy[0] / k, 2), r(rect[1] + xy[1] / k, 2)] : null);
  return {
    alpha50: {
      iou: r(alpha.iou, 5),
      inkPixels: alpha.refPixels,
      pngOnlyPixels: alpha.refOnlyPixels,
      svgOnlyPixels: alpha.testOnlyPixels,
      mismatchPercentOfInk: r(alpha.mismatchPercentOfRef, 3),
      maxBoundaryDeviationPx: r(alpha.maxBoundaryDeviation, 3),
    },
    coverage50: {
      iou: r(coverage.iou, 5),
      pngOnlyPixels: coverage.refOnlyPixels,
      svgOnlyPixels: coverage.testOnlyPixels,
      mismatchPercentOfInk: r(coverage.mismatchPercentOfRef, 3),
      maxBoundaryDeviationPx: r(coverage.maxBoundaryDeviation, 3),
    },
    subpixelX4: {
      iou: r(x4.iou, 5),
      mismatchPercentOfInk: r(x4.mismatchPercentOfRef, 3),
      meanBoundaryDeviationPx: r(x4.meanBoundaryDeviation / Z, 3),
      p95BoundaryDeviationPx: r(x4.p95BoundaryDeviation / Z, 3),
      p99BoundaryDeviationPx: r(x4.p99BoundaryDeviation / Z, 3),
      maxBoundaryDeviationPx: r(x4.maxBoundaryDeviation / Z, 3),
      largestDeviations: x4.largestDeviations.map((t) => ({
        px: r(t.value / Z, 3),
        at: place(t.at, Z),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Programme principal
// ---------------------------------------------------------------------------

const t0 = Date.now();
const potrace = potraceVersion();
console.log(`potrace ${potrace}, suréchantillonnage ×${TRACE.scale}`);

const read = [];
for (const src of SOURCES) read.push(await readSource(src));
// Les trois PNG partagent la même palette : un seul gamma de lissage.
const fit = fitBlendGamma(mergeStats(read.map((s) => s.stats)));
console.log(
  `Encre ${COLOURS.chocolat} vérifiée ; gamma de lissage ${fit.gamma}, seuil de détourage ≈ ${(fit.cutCoverage * 100).toFixed(0)} % de couverture`,
);

const traced = [];
for (const s of read) {
  const t = traceSource(s, fit);
  traced.push(t);
  console.log(
    `• ${s.file} : kanji ${t.kanjiLog.corners} angles, ${t.kanjiLog.lines} droites, ${t.kanjiLog.curves} courbes ; HAKO ${t.wordmark.length} contours`,
  );
}
const byId = Object.fromEntries(traced.map((s) => [s.id, s]));
const P = TRACE.precision;
const outputs = [];
const report = {
  notes: [
    'Rapport produit par npm run logo:build (scripts/logo/build.mjs). Toutes les mesures sont en pixels du PNG d’origine.',
    'alpha50 : SVG rendu par resvg (à 4 fois la taille, puis moyenné) à la taille du PNG, seuil 50 %, comparé à la couche alpha du PNG (seuil 50 %).',
    'coverage50 : même rendu, comparé à la couverture des pixels estimée d’après leur couleur (seuil 50 %).',
    'subpixelX4 : rendu ×4 comparé à la couverture du PNG suréchantillonnée ×4 ; les écarts sont exprimés en pixels du PNG.',
    'iou : intersection sur union des deux masques (1 = identiques). mismatchPercentOfInk : pixels en désaccord, en % des pixels d’encre du PNG.',
    'maxBoundaryDeviationPx : distance de Hausdorff entre les bords des deux masques (plus grand écart local) ; mean, p95, p99 : moyenne et centiles des écarts de bord.',
    'largestDeviations : les cinq plus grands écarts, chacun avec sa position (x, y) dans le PNG.',
  ],
  tools: {
    potrace,
    resvgJs: pkgVersion('@resvg/resvg-js'),
    sharp: pkgVersion('sharp'),
    svgo: pkgVersion('svgo'),
  },
  parameters: TRACE,
  blend: {
    gamma: fit.gamma,
    channelSpreadRms: r(fit.rms, 4),
    channelSpreadMax: r(fit.worst, 4),
    lightestEdgeColour: fit.lightestHex,
    transparencyCutCoverage: r(fit.cutCoverage, 3),
  },
  sources: {},
  files: {},
};

// Les images de contrôle sont toutes régénérées : on efface les anciennes.
mkdirSync(at('qa/logo'), { recursive: true });
for (const f of readdirSync(at('qa/logo'))) {
  if (f.endsWith('.png')) unlinkSync(at('qa/logo', f));
}

// Fichiers du logo complet (paysage, carré, réseaux). Paysage et carré : cadre
// serré autour du dessin, origine ramenée en 0,0 (une hauteur CSS donne la
// hauteur du dessin, et le fichier autonome n'a pas de marge décentrée).
// Réseaux garde le cadre de son PNG : sa marge est voulue pour les avatars.
const floor2 = (v) => Math.floor(v * 100) / 100;
const ceil2 = (v) => Math.ceil(v * 100) / 100;
const KEEP_PNG_FRAME = ['reseaux'];
for (const s of traced) {
  const { width: W, height: H } = s.img;
  const paths = [...s.kanji, ...s.wordmark];
  const tight = !KEEP_PNG_FRAME.includes(s.id);
  const b = bbox(paths);
  const ox = tight ? floor2(b[0]) : 0;
  const oy = tight ? floor2(b[1]) : 0;
  const viewBox = tight ? [0, 0, r(ceil2(b[2] - ox), 2), r(ceil2(b[3] - oy), 2)] : [0, 0, W, H];
  const d = toPathData(tight ? translatePaths(paths, -ox, -oy) : paths, 3);
  const svg = brandSvg(viewBox, d, P);
  outputs.push(write(at('src/assets/brand', `hako-${s.id}.svg`), svg));
  outputs.push(
    write(
      at('public/brand', `hako-${s.id}.svg`),
      standaloneSvg(viewBox, pathDataOf(svg), COLOURS.chocolat, P),
    ),
  );
  const name = s.file.split('/').pop();
  copyFileSync(at(s.file), at('public/brand', name));
  outputs.push(at('public/brand', name));

  report.sources[s.id] = {
    file: s.file,
    sha256: sha256(s.bytes),
    size: [W, H],
    ink: s.stats.inkHex,
    opaqueColours: s.stats.opaqueColours,
    semiTransparentPixels: s.stats.semiTransparentPixels,
    edgePixels: s.stats.edgePixels,
    layout: s.split.layout,
    kanjiRect: s.split.kanji,
    wordmarkRect: s.split.wordmark,
    kanjiRefit: s.kanjiLog,
    wordmarkStraightening: s.wordmarkLog,
  };

  // Contrôle : le fichier livré, replacé dans le repère de son PNG.
  const shipped = pathDataOf(svg);
  const placed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><path transform="translate(${ox} ${oy})" d="${shipped}"/></svg>`;
  const rendered = threshold(renderCoverage(placed, W).cov);
  const full = compareZone(s, placed, rendered, [0, 0, W, H]);
  report.files[`src/assets/brand/hako-${s.id}.svg`] = {
    source: s.file,
    viewBox: viewBox.join(' '),
    offsetInSource: [ox, oy],
    bytes: Buffer.byteLength(svg),
    whole: full,
    kanji: compareZone(s, placed, rendered, pad(bbox(s.kanji), 6, W, H)),
    wordmark: compareZone(s, placed, rendered, pad(bbox(s.wordmark), 6, W, H)),
  };

  await diffImage(s.mask, rendered, W, H, at('qa/logo', `diff-${s.id}.png`));
  for (const c of CROPS[s.id] ?? []) {
    await zoomCrop({
      rgba: s.img.rgba,
      width: W,
      ref: s.mask,
      test: rendered,
      pathData: shipped,
      offset: [ox, oy],
      rect: c.rect,
      zoom: 4,
      file: at('qa/logo', `zoom-${s.id}-${c.name}.png`),
    });
  }
  console.log(
    `  hako-${s.id}.svg : IoU ${report.files[`src/assets/brand/hako-${s.id}.svg`].whole.alpha50.iou} (alpha 50 %), ` +
      `écart moyen ${full.subpixelX4.meanBoundaryDeviationPx} px, max ${full.subpixelX4.maxBoundaryDeviationPx} px (sous-pixel), ${Buffer.byteLength(svg)} octets`,
  );
}

// Kanji seul et mot seul : boîte serrée, origine ramenée en 0,0.
const parts = {};
for (const [id, srcId, key] of [
  ['kanji', KANJI_SOURCE, 'kanji'],
  ['mot', WORDMARK_SOURCE, 'wordmark'],
]) {
  const s = byId[srcId];
  const b = bbox(s[key]);
  const ox = floor2(b[0]);
  const oy = floor2(b[1]);
  const w = ceil2(b[2] - ox);
  const h = ceil2(b[3] - oy);
  const viewBox = [0, 0, r(w, 2), r(h, 2)];
  const svg = brandSvg(viewBox, toPathData(translatePaths(s[key], -ox, -oy), 3), P);
  outputs.push(write(at('src/assets/brand', `hako-${id}.svg`), svg));
  outputs.push(
    write(
      at('public/brand', `hako-${id}.svg`),
      standaloneSvg(viewBox, pathDataOf(svg), COLOURS.chocolat, P),
    ),
  );
  parts[id] = { d: pathDataOf(svg), box: [w, h] };
  // Contrôle : on replace le fichier livré dans le repère de son PNG.
  const { width: W, height: H } = s.img;
  const placed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><path transform="translate(${ox} ${oy})" d="${parts[id].d}"/></svg>`;
  const cmp = compareZone(s, placed, threshold(renderCoverage(placed, W).cov), pad(b, 6, W, H));
  report.files[`src/assets/brand/hako-${id}.svg`] = {
    source: s.file,
    viewBox: viewBox.join(' '),
    offsetInSource: [ox, oy],
    bytes: Buffer.byteLength(svg),
    whole: cmp,
  };
  console.log(
    `  hako-${id}.svg : IoU ${cmp.alpha50.iou} (alpha 50 %), écart moyen ${cmp.subpixelX4.meanBoundaryDeviationPx} px, max ${cmp.subpixelX4.maxBoundaryDeviationPx} px, ${Buffer.byteLength(svg)} octets`,
  );
}

// ---------------------------------------------------------------------------
// 4. Favicon, icônes d'application, manifeste
// ---------------------------------------------------------------------------

const kanji = {
  kanjiD: parts.kanji.d,
  kanjiBox: parts.kanji.box,
  creme: COLOURS.creme,
  chocolat: COLOURS.chocolat,
};
// Favicon : taille et position du kanji calées sur la grille de 16 pixels.
const { heights: favHeights, px: favPx, shift: favShift } = ICONS.favicon.gridFit;
const grid = gridFit({ ...kanji, size: 512, px: favPx, heights: favHeights, shift: favShift });
const favUnit = 512 / favPx; // unités du viewBox par pixel, à 16 px
const fav = iconSvg({
  ...kanji,
  size: 512,
  radius: ICONS.favicon.radius,
  kanjiHeight: grid.kanjiHeight,
  offset: [grid.dx, grid.dy],
  precision: 1,
});
console.log(
  `Favicon : kanji à ${(grid.kanjiHeight * 100).toFixed(1)} % de la hauteur, décalé de (${(grid.dx / favUnit).toFixed(3)}, ${(grid.dy / favUnit).toFixed(3)}) px à ${favPx} px, netteté ${grid.score.toFixed(3)}`,
);
outputs.push(write(at('public/favicon.svg'), fav.svg));

const icoImages = [];
for (const size of [16, 32, 48]) {
  const png = await palettePng(rasterize(fav.svg, size).png, 64);
  icoImages.push({ size, png });
  // Agrandissement ×8 en pixels nets, pour juger la lisibilité.
  await sharp(png)
    .resize(size * 8, size * 8, { kernel: 'nearest' })
    .flatten({ background: '#ffffff' })
    .png()
    .toFile(at('qa/logo', `favicon-${size}-x8.png`));
}
outputs.push(write(at('public/favicon.ico'), buildIco(icoImages)));

const app = iconSvg({
  ...kanji,
  size: 512,
  radius: ICONS.app.radius,
  kanjiHeight: ICONS.app.kanjiHeight,
  precision: 1,
});
for (const size of [192, 512]) {
  outputs.push(
    write(
      at('public/icons', `icon-${size}.png`),
      await palettePng(rasterize(app.svg, size).png, 64),
    ),
  );
}

const apple = iconSvg({
  ...kanji,
  size: 180,
  radius: 0,
  kanjiHeight: ICONS.apple.kanjiHeight,
  precision: 2,
});
outputs.push(
  write(at('public/apple-touch-icon.png'), await palettePng(rasterize(apple.svg, 180).png, 64)),
);

// Maskable : la boîte du kanji doit tenir dans le cercle de sécurité.
const [kw, kh] = parts.kanji.box;
const diag = Math.hypot(kw, kh);
const safe = ICONS.maskable.safeDiameter * ICONS.maskable.margin;
const maskableHeight = (safe * kh) / diag;
const maskable = iconSvg({
  ...kanji,
  size: 512,
  radius: 0,
  kanjiHeight: maskableHeight,
  precision: 1,
});
outputs.push(
  write(
    at('public/icons', 'icon-maskable-512.png'),
    await palettePng(rasterize(maskable.svg, 512).png, 64),
  ),
);
// Contrôle : cercle de la zone de sécurité (80 %) dessiné sur l'icône.
await sharp(rasterize(maskable.svg, 512).png)
  .composite([
    {
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><circle cx="256" cy="256" r="${0.4 * 512}" fill="none" stroke="#E3001B" stroke-width="2"/></svg>`,
      ),
    },
  ])
  .png()
  .toFile(at('qa/logo', 'maskable-zone-securite.png'));

const manifest = {
  name: 'HAKO',
  short_name: 'HAKO',
  lang: 'fr',
  start_url: '/',
  display: 'browser',
  background_color: COLOURS.creme,
  theme_color: COLOURS.creme,
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    {
      src: '/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};
outputs.push(write(at('public/manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`));

// ---------------------------------------------------------------------------
// 5. Image de partage (Open Graph) : logo « réseaux » centré sur fond crème
// ---------------------------------------------------------------------------

{
  const s = byId.reseaux;
  const d = pathDataOf(readFileSync(at('src/assets/brand/hako-reseaux.svg'), 'utf8'));
  const b = bbox([...s.kanji, ...s.wordmark]);
  const { width: OW, height: OH, logoHeight } = ICONS.og;
  const k = (logoHeight * OH) / (b[3] - b[1]);
  const tx = (OW - (b[2] - b[0]) * k) / 2 - b[0] * k;
  const ty = (OH - (b[3] - b[1]) * k) / 2 - b[1] * k;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${OW} ${OH}"><rect width="${OW}" height="${OH}" fill="${COLOURS.creme}"/><path fill="${COLOURS.chocolat}" transform="translate(${r(tx, 3)} ${r(ty, 3)}) scale(${r(k, 6)})" d="${d}"/></svg>`;
  const png = await palettePng(rasterize(svg, OW).png, 32);
  outputs.push(write(at('public/og', 'hako-og.png'), png));
  report.og = {
    size: [OW, OH],
    logoHeightPx: r(logoHeight * OH, 1),
    scale: r(k, 4),
    bytes: png.length,
  };
}

// ---------------------------------------------------------------------------
// 6. Icônes des réseaux sociaux (tracés d'origine, mis au format commun)
// ---------------------------------------------------------------------------

report.social = {};
for (const [name, svg] of Object.entries(socialIcons())) {
  outputs.push(write(at('src/assets/icons/social', `${name}.svg`), svg));
  // Contrôle : rendu à 96 px du fichier livré et du tracé d'origine.
  const src = SOCIAL_SOURCES[name];
  const original = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${src.viewBox} ${src.viewBox}"><path d="${src.d}"/></svg>`;
  const a = threshold(renderCoverage(svg, 96).cov);
  const b = threshold(renderCoverage(original, 96).cov);
  const m = maskMetrics(b, a, 96, 96);
  report.social[`src/assets/icons/social/${name}.svg`] = {
    bytes: Buffer.byteLength(svg),
    iouVsOriginalAt96px: r(m.iou, 5),
  };
}

// ---------------------------------------------------------------------------
// 7. Inventaire et rapport
// ---------------------------------------------------------------------------

report.icons = {
  favicon: {
    kanjiHeightRatio: grid.kanjiHeight,
    offsetAt16px: [r(grid.dx / favUnit, 3), r(grid.dy / favUnit, 3)],
    crispnessAt16px: r(grid.score, 4),
    cornerRadiusRatio: ICONS.favicon.radius,
    transform: fav.transform.attr,
  },
  app: { kanjiHeightRatio: ICONS.app.kanjiHeight, transform: app.transform.attr },
  apple: { kanjiHeightRatio: ICONS.apple.kanjiHeight, transform: apple.transform.attr },
  maskable: {
    kanjiHeightRatio: r(maskableHeight, 4),
    kanjiBoxDiagonalRatio: r((maskableHeight * diag) / kh, 4),
    safeZoneDiameterRatio: ICONS.maskable.safeDiameter,
    transform: maskable.transform.attr,
  },
};
report.outputs = {};
for (const f of outputs.sort()) {
  const buf = readFileSync(f);
  report.outputs[rel(f)] = { bytes: buf.length, sha256: sha256(buf) };
}
write(at('qa/logo', 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `Terminé en ${((Date.now() - t0) / 1000).toFixed(1)} s : ${outputs.length} fichiers, rapport dans qa/logo/report.json`,
);
