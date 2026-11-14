// Carte de la zone d'intervention : produit la géométrie de la carte
// (src/components/carte/carte-data.json) à partir des données Natural Earth,
// téléchargées une fois, figées par version et empreinte SHA-256.
//
// Usage :
//   npm run map:build                  régénère carte-data.json
//   npm run map:build -- --verifier    compare aussi les positions des villes
//                                      (src/data/zone.ts) aux sources officielles
//
// Le site ne télécharge rien : il lit le fichier JSON produit ici, versionné
// avec le code. Méthode et sources : docs/carte.md.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as prettier from 'prettier';

import {
  CACHE_DIR,
  DRAWING,
  FRAME,
  NATURAL_EARTH,
  OUTPUT,
  SCALE_BAR_KM,
  naturalEarthUrl,
} from './config.mjs';
import { contours, distanceField, rasterize } from './lib/distance.mjs';
import {
  bounds,
  chaikinRing,
  clipRing,
  densifyOnRect,
  expandedRect,
  makeProjection,
  ringArea,
  ringsToPath,
  simplifyRing,
  unitsPerKm,
} from './lib/geometry.mjs';
import { fetchPinned } from './lib/sources.mjs';
import { verifyCities } from './lib/verify.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const log = (message) => console.log(`[carte] ${message}`);
const round = (value, digits = 4) => Number(value.toFixed(digits));

const { zoneCities } = await import(pathToFileURL(join(ROOT, 'src/data/zone.ts')).href);

if (process.argv.includes('--verifier')) {
  const ok = await verifyCities(zoneCities, { log });
  if (!ok) {
    console.error(
      '[carte] Une ville est à plus de 50 m de sa mairie officielle : vérifiez src/data/zone.ts.',
    );
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// 1. Données sources
// ---------------------------------------------------------------------------

const { project, scale, latMin, cosRef } = makeProjection(FRAME);
const computeRect = expandedRect(FRAME.width, FRAME.height, DRAWING.computeMargin);
const outputRect = expandedRect(FRAME.width, FRAME.height, DRAWING.outputMargin);

// Rectangle de calcul exprimé en degrés, pour écarter vite les polygones lointains.
const degreeMargin = DRAWING.computeMargin / scale;
const lonLatRect = [
  FRAME.lonMin - degreeMargin / cosRef,
  latMin - degreeMargin,
  FRAME.lonMax + degreeMargin / cosRef,
  FRAME.latMax + degreeMargin,
];
const touchesFrame = (ring) => {
  const [x0, y0, x1, y1] = bounds(ring);
  return !(x1 < lonLatRect[0] || x0 > lonLatRect[2] || y1 < lonLatRect[1] || y0 > lonLatRect[3]);
};

const rings = { land: [], water: [] };
const sources = [];
for (const layer of NATURAL_EARTH.layers) {
  const buffer = await fetchPinned({
    url: naturalEarthUrl(layer.file),
    sha256: layer.sha256,
    name: layer.file,
    cacheDir: join(ROOT, CACHE_DIR),
    log,
  });
  const geojson = JSON.parse(buffer.toString('utf8'));
  let kept = 0;
  for (const feature of geojson.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    const polygons =
      geometry.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry.type === 'MultiPolygon'
          ? geometry.coordinates
          : [];
    for (const polygon of polygons) {
      for (const ring of polygon) {
        if (!touchesFrame(ring)) continue;
        // Le dernier point GeoJSON répète le premier : on l'enlève.
        rings[layer.role].push(ring.slice(0, -1));
        kept++;
      }
    }
  }
  sources.push({
    name: layer.file,
    url: naturalEarthUrl(layer.file),
    sha256: layer.sha256,
    ringsInFrame: kept,
  });
  log(`${layer.file} : ${kept} contour(s) dans le cadre`);
}

// ---------------------------------------------------------------------------
// 2. Projection, découpe, lissage et simplification des côtes
// ---------------------------------------------------------------------------

/** Projette, découpe au rectangle de calcul, lisse puis simplifie un contour. */
function prepare(ring) {
  const projected = ring.map(project);
  const clipped = clipRing(projected, computeRect);
  if (clipped.length < 3) return null;
  const dense = densifyOnRect(clipped, computeRect, 4);
  const smooth = chaikinRing(dense, DRAWING.coastSmoothing);
  const simple = simplifyRing(smooth, DRAWING.tolerance);
  return Math.abs(ringArea(simple)) >= DRAWING.minRingArea ? simple : null;
}

const landRings = rings.land.map(prepare).filter(Boolean);
const waterRings = rings.water.map(prepare).filter(Boolean);
// Terres et lacs ensemble : la règle de remplissage pair-impair creuse les lacs.
const coastRings = [...landRings, ...waterRings];

/** Découpe des anneaux au rectangle livré (juste au-delà du cadre). */
const toOutput = (list) =>
  list
    .map((ring) => clipRing(ring, outputRect))
    .filter((ring) => ring.length >= 3 && Math.abs(ringArea(ring)) >= DRAWING.minRingArea);

const landOutput = toOutput(coastRings);

// ---------------------------------------------------------------------------
// 3. Lignes d'eau
// ---------------------------------------------------------------------------

const raster = rasterize(coastRings, computeRect);
const field = distanceField(raster);
const water = DRAWING.waterLevels.map((level) => {
  const lines = contours(field, raster, level)
    .map((ring) => simplifyRing(chaikinRing(ring, DRAWING.waterSmoothing), DRAWING.tolerance))
    .filter((ring) => Math.abs(ringArea(ring)) >= DRAWING.minRingArea);
  return { distance: level, rings: toOutput(lines) };
});

// ---------------------------------------------------------------------------
// 4. Contrôles et écriture
// ---------------------------------------------------------------------------

const isLand = ([x, y]) => {
  const i = Math.floor(x - computeRect[0]);
  const j = Math.floor(y - computeRect[1]);
  return raster.land[j * raster.nx + i] === 1;
};
for (const city of zoneCities) {
  const point = project([city.longitude, city.latitude]);
  const [x, y] = point;
  if (x < 0 || y < 0 || x > FRAME.width || y > FRAME.height) {
    throw new Error(
      `${city.name} est hors du cadre de la carte : élargissez FRAME dans scripts/map/config.mjs.`,
    );
  }
  const where = isLand(point) ? 'sur terre' : 'sur l’eau (côte simplifiée à cette échelle)';
  log(`${city.name} : x ${x.toFixed(1)}, y ${y.toFixed(1)}, ${where}`);
}

const kmUnits = unitsPerKm(FRAME, scale);
const data = {
  generatedBy: 'scripts/map/build.mjs',
  notice: 'Fichier produit par « npm run map:build » : ne pas le modifier à la main.',
  width: FRAME.width,
  height: FRAME.height,
  frame: {
    lonMin: FRAME.lonMin,
    lonMax: FRAME.lonMax,
    latMin: round(latMin),
    latMax: FRAME.latMax,
  },
  projection: {
    name: 'équirectangulaire',
    latRef: FRAME.latRef,
    cosLatRef: round(cosRef, 6),
    unitsPerDegreeLat: round(scale, 4),
    unitsPerKm: round(kmUnits, 4),
  },
  scaleBar: { km: SCALE_BAR_KM, length: round(SCALE_BAR_KM * kmUnits, 1) },
  land: ringsToPath(landOutput, DRAWING.decimals),
  water: water.map(({ distance, rings: list }) => ({
    distanceKm: round(distance / kmUnits, 2),
    path: ringsToPath(list, DRAWING.decimals),
  })),
  sources: {
    naturalEarth: {
      version: NATURAL_EARTH.version,
      repository: NATURAL_EARTH.repository,
      commit: NATURAL_EARTH.commit,
      files: sources,
    },
  },
};

const target = join(ROOT, OUTPUT);
const options = (await prettier.resolveConfig(target)) ?? {};
const text = await prettier.format(JSON.stringify(data), { ...options, filepath: target });
const previous = (() => {
  try {
    return readFileSync(target, 'utf8');
  } catch {
    return null;
  }
})();
writeFileSync(target, text);

const kb = (n) => `${(n / 1024).toFixed(1)} Ko`;
const points = (list) => list.reduce((sum, ring) => sum + ring.length, 0);
log(
  `terres : ${landOutput.length} contour(s), ${points(landOutput)} points, ${kb(data.land.length)}`,
);
for (const [index, level] of water.entries()) {
  log(
    `ligne d'eau à ${data.water[index].distanceKm} km : ${level.rings.length} contour(s), ${points(level.rings)} points, ${kb(data.water[index].path.length)}`,
  );
}
log(`${OUTPUT} : ${kb(Buffer.byteLength(text))}${previous === text ? ' (inchangé)' : ''}`);
