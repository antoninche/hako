#!/usr/bin/env node
/**
 * Images du prototype pour le site : src/assets/prototype/vue-*.png
 *
 * Les sources sont quatre captures d'écran du modèle 3D du prototype, faites
 * par l'équipe dans son logiciel de modélisation (ce ne sont pas des photos).
 * Pour chacune, le script :
 *   1. vérifie que c'est bien la capture attendue (empreinte SHA-256) : les
 *      zones à nettoyer décrites plus bas ne valent que pour ces fichiers ;
 *   2. convertit ses couleurs du profil Display P3 (captures faites sur un Mac)
 *      vers sRGB, l'espace de couleur du web. Le rendu ne change pas, et le
 *      fond de studio devient exactement #BAB1A7, la couleur --pierre du site ;
 *   3. efface les traces du logiciel : le pointeur de la souris et, sur la vue
 *      de dessus, un petit rectangle bleu clair de l'interface. Seuls leurs
 *      pixels prennent la couleur du fond ; aucun pixel où la box apparaît,
 *      même en partie, n'est modifié ;
 *   4. cadre toutes les vues de la même façon : 1281 × 854 px (3:2), la box au
 *      centre, avec la même marge de fond. Du côté où l'ombre portée touche le
 *      bord de la capture, on recadre sans jamais ajouter de fond (l'ombre
 *      serait coupée net) ;
 *   5. contrôle le résultat et écrit un PNG sans perte.
 *
 * Utilisation :
 *   node scripts/prototype/prepare.mjs [<dossier des captures>] [--preuves <dossier>]
 * Sans dossier, le script lit design/prototype/ : c'est là que les captures
 * doivent être rangées dans le dépôt, sous leur nom d'origine (voir VIEWS).
 * Avec --preuves, le script enregistre aussi des images de contrôle dans ce
 * dossier (par exemple .tmp/prototype-preuves, non versionné) : les pixels
 * modifiés en magenta, et la zone nettoyée agrandie, avant et après.
 *
 * Les PNG produits servent de sources : Astro en tire les versions AVIF et
 * WebP à la construction (composants de src/components/prototype/). À
 * relancer seulement si les captures changent ; il faut alors mettre à jour
 * les empreintes et les zones de la liste VIEWS.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUTPUT_DIR = path.join(root, 'src', 'assets', 'prototype');
/** Dossier des captures quand aucun n'est donné. */
const DEFAULT_SOURCE_DIR = path.join(root, 'design', 'prototype');

/** Fond de studio des captures, une fois en sRGB : la couleur --pierre du site. */
const BACKDROP = hex('#bab1a7');
/** Ombre portée de la box sur ce fond. */
const SHADOW = hex('#9b958c');
/** Cadre commun à toutes les vues (3:2), en pixels des captures (écran Retina). */
const FRAME = { width: 1281, height: 854 };
/** Un pointeur de souris compte quelques dizaines de pixels : au-delà, ce n'en est pas un. */
const CURSOR_MAX_PIXELS = 400;

/**
 * Les captures, dans l'ordre de la galerie.
 * stains : traces de l'interface du logiciel posées contre la box. Dans la
 * zone donnée, seuls changent les pixels de ces couleurs exactes, ou d'un
 * mélange de ces couleurs avec le fond (bord adouci de la trace).
 */
const VIEWS = [
  {
    source: '01-trois-quarts.png',
    sha256: 'aa91e15332fdad035677ef838467756574cbec91daedea393768a447d5d6ea0a',
    output: 'vue-trois-quarts.png',
  },
  {
    source: '02-arriere.png',
    sha256: '0ca087f19e798eef86b7a14c5065b4e867daebf47df5ab3732316450ce626560',
    output: 'vue-arriere.png',
  },
  {
    source: '03-dessus.png',
    sha256: '465fe6a6f32d4a74f23cd9df88bfac281aa61930409430ac5368aeb9fa27b799',
    output: 'vue-dessus.png',
    stains: [
      {
        // Petit rectangle bleu clair (fond et filet gris), en partie caché
        // par le bord gauche de la box, en bas à gauche.
        zone: { left: 262, top: 656, width: 12, height: 25 },
        colours: [hex('#e1e5eb'), hex('#cdcbc9')],
      },
    ],
  },
  {
    source: '04-interieur.png',
    sha256: '9550a0394488cb58f2c2560db98ad8f21e256d701b484d1b3fc1f1c6cd904b80',
    output: 'vue-interieur.png',
  },
];

// ---------------------------------------------------------------------------
// Petits outils
// ---------------------------------------------------------------------------

/** '#bab1a7' → [186, 177, 167] */
function hex(value) {
  const n = Number.parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb) {
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function fail(message) {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) fail(`--${name} attend un dossier.`);
  return value;
}

/** Image RGB brute : largeur, hauteur et 3 octets par pixel. */
class Raster {
  constructor(width, height, data) {
    this.width = width;
    this.height = height;
    this.data = data ?? Buffer.alloc(width * height * 3);
  }

  static filled(width, height, rgb) {
    const raster = new Raster(width, height);
    for (let i = 0; i < width * height; i++) raster.data.set(rgb, i * 3);
    return raster;
  }

  get(x, y) {
    const i = (y * this.width + x) * 3;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }

  set(x, y, rgb) {
    this.data.set(rgb, (y * this.width + x) * 3);
  }

  is(x, y, rgb) {
    const i = (y * this.width + x) * 3;
    return this.data[i] === rgb[0] && this.data[i + 1] === rgb[1] && this.data[i + 2] === rgb[2];
  }

  clone() {
    return new Raster(this.width, this.height, Buffer.from(this.data));
  }
}

/** Distance (en niveaux de 0 à 255) entre une couleur et le segment [a, b]. */
function distanceToMix(rgb, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const length2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  let t = ((rgb[0] - a[0]) * ab[0] + (rgb[1] - a[1]) * ab[1] + (rgb[2] - a[2]) * ab[2]) / length2;
  t = Math.min(1, Math.max(0, t));
  return Math.hypot(
    rgb[0] - (a[0] + t * ab[0]),
    rgb[1] - (a[1] + t * ab[1]),
    rgb[2] - (a[2] + t * ab[2]),
  );
}

/** Groupes de pixels voisins (8-connexité) qui ne sont pas du fond, du plus grand au plus petit. */
function components(raster) {
  const { width, height } = raster;
  const label = new Int32Array(width * height).fill(-1);
  const groups = [];
  const stack = [];
  for (let start = 0; start < width * height; start++) {
    if (label[start] >= 0 || raster.is(start % width, (start / width) | 0, BACKDROP)) continue;
    const group = { pixels: [], left: width, top: height, right: -1, bottom: -1 };
    label[start] = groups.length;
    stack.push(start);
    while (stack.length > 0) {
      const index = stack.pop();
      const x = index % width;
      const y = (index / width) | 0;
      group.pixels.push(index);
      group.left = Math.min(group.left, x);
      group.right = Math.max(group.right, x);
      group.top = Math.min(group.top, y);
      group.bottom = Math.max(group.bottom, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (label[next] < 0 && !raster.is(nx, ny, BACKDROP)) {
            label[next] = groups.length;
            stack.push(next);
          }
        }
      }
    }
    groups.push(group);
  }
  return groups.sort((a, b) => b.pixels.length - a.pixels.length);
}

// ---------------------------------------------------------------------------
// Étapes
// ---------------------------------------------------------------------------

/** 1 et 2 : lecture, vérification de l'empreinte, conversion en sRGB sans transparence. */
async function load(file, expectedHash) {
  const bytes = readFileSync(file);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== expectedHash) {
    fail(
      `${path.basename(file)} n'est pas la capture attendue (empreinte ${hash}). ` +
        'Vérifiez les zones à nettoyer, puis mettez à jour VIEWS dans ce script.',
    );
  }
  // Par défaut, sharp applique le profil de couleur intégré (Display P3) et
  // convertit en sRGB.
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raster = new Raster(info.width, info.height);
  for (let i = 0; i < info.width * info.height; i++) {
    if (data[i * 4 + 3] !== 255) fail(`${path.basename(file)} contient des pixels transparents.`);
    raster.data[i * 3] = data[i * 4];
    raster.data[i * 3 + 1] = data[i * 4 + 1];
    raster.data[i * 3 + 2] = data[i * 4 + 2];
  }
  let backdrop = 0;
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) if (raster.is(x, y, BACKDROP)) backdrop++;
  }
  if (backdrop < raster.width * raster.height * 0.4) {
    fail(`${path.basename(file)} : le fond n'est pas ${toHex(BACKDROP)} après conversion en sRGB.`);
  }
  return raster;
}

/**
 * 3 : repère les traces du logiciel. Renvoie la liste des pixels à repeindre
 * (indices), sans rien modifier.
 */
function findArtefacts(raster, view) {
  const artefacts = { cursor: [], stains: [] };

  // Pointeur de la souris : tout petit groupe isolé sur le fond, contre un bord.
  const [, ...others] = components(raster);
  for (const group of others) {
    const touchesBorder =
      group.left === 0 ||
      group.top === 0 ||
      group.right === raster.width - 1 ||
      group.bottom === raster.height - 1;
    if (group.pixels.length > CURSOR_MAX_PIXELS || !touchesBorder) {
      fail(
        `${view.source} : groupe de pixels inattendu en x ${group.left}-${group.right}, ` +
          `y ${group.top}-${group.bottom} (${group.pixels.length} pixels).`,
      );
    }
    artefacts.cursor.push(...group.pixels);
  }

  // Traces de l'interface posées contre la box.
  for (const stain of view.stains ?? []) {
    const { left, top, width, height } = stain.zone;
    for (let y = top; y < top + height; y++) {
      for (let x = left; x < left + width; x++) {
        const rgb = raster.get(x, y);
        const isStain = stain.colours.some(
          (colour) =>
            (rgb[0] === colour[0] && rgb[1] === colour[1] && rgb[2] === colour[2]) ||
            distanceToMix(rgb, BACKDROP, colour) <= 1,
        );
        if (isStain && !raster.is(x, y, BACKDROP)) artefacts.stains.push(y * raster.width + x);
      }
    }
  }
  return artefacts;
}

/** Rectangle qui contient la box seule (ni le fond, ni l'ombre portée, ni les traces). */
function productBounds(raster, skip) {
  const box = { left: raster.width, top: raster.height, right: -1, bottom: -1 };
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      if (skip.has(y * raster.width + x) || raster.is(x, y, BACKDROP)) continue;
      if (distanceToMix(raster.get(x, y), BACKDROP, SHADOW) <= 3) continue;
      box.left = Math.min(box.left, x);
      box.right = Math.max(box.right, x);
      box.top = Math.min(box.top, y);
      box.bottom = Math.max(box.bottom, y);
    }
  }
  return box;
}

/**
 * 4 : place le cadre, centré sur la box. Là où le cadre dépasse de la capture,
 * le fond est prolongé : on vérifie d'abord que ce bord de la capture est
 * entièrement du fond (sinon l'ombre ou la box serait coupée net).
 */
function placeFrame(raster, box, source) {
  const left = Math.round((box.left + box.right + 1) / 2 - FRAME.width / 2);
  const top = Math.round((box.top + box.bottom + 1) / 2 - FRAME.height / 2);
  const right = left + FRAME.width - 1;
  const bottom = top + FRAME.height - 1;
  const xs = [Math.max(0, left), Math.min(raster.width - 1, right)];
  const ys = [Math.max(0, top), Math.min(raster.height - 1, bottom)];
  const edges = [
    { side: 'gauche', extended: left < 0, pixels: (f) => range(ys).map((y) => f(0, y)) },
    { side: 'haut', extended: top < 0, pixels: (f) => range(xs).map((x) => f(x, 0)) },
    {
      side: 'droit',
      extended: right > raster.width - 1,
      pixels: (f) => range(ys).map((y) => f(raster.width - 1, y)),
    },
    {
      side: 'bas',
      extended: bottom > raster.height - 1,
      pixels: (f) => range(xs).map((x) => f(x, raster.height - 1)),
    },
  ];
  for (const edge of edges) {
    if (edge.extended && !edge.pixels((x, y) => raster.is(x, y, BACKDROP)).every(Boolean)) {
      fail(
        `${source} : le bord ${edge.side} n'est pas uniforme, impossible d'y prolonger le fond.`,
      );
    }
  }
  return { left, top };
}

function range([from, to]) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Copie la capture dans le cadre ; ce qui dépasse de la capture prend la couleur du fond. */
function frame(raster, { left, top }) {
  const out = Raster.filled(FRAME.width, FRAME.height, BACKDROP);
  for (let y = 0; y < FRAME.height; y++) {
    const sy = y + top;
    if (sy < 0 || sy >= raster.height) continue;
    for (let x = 0; x < FRAME.width; x++) {
      const sx = x + left;
      if (sx >= 0 && sx < raster.width) out.set(x, y, raster.get(sx, sy));
    }
  }
  return out;
}

async function writePng(raster, file) {
  await sharp(raster.data, { raw: { width: raster.width, height: raster.height, channels: 3 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(file);
}

// ---------------------------------------------------------------------------
// Images de contrôle (--preuves)
// ---------------------------------------------------------------------------

/** L'image pâlie ; en magenta les pixels modifiés, en bleu le fond ajouté autour de la capture. */
async function writeDifferenceImage(output, changed, added, file) {
  const proof = output.clone();
  for (let i = 0; i < proof.data.length; i++) {
    proof.data[i] = Math.round(255 - (255 - proof.data[i]) * 0.35);
  }
  for (const index of added)
    proof.set(index % FRAME.width, (index / FRAME.width) | 0, [150, 200, 255]);
  for (const index of changed) {
    proof.set(index % FRAME.width, (index / FRAME.width) | 0, [255, 0, 255]);
  }
  await writePng(proof, file);
}

/** La zone nettoyée agrandie 12 fois : avant, après, pixels modifiés. */
async function writeZoomImage(before, after, changed, zone, file) {
  const scale = 12;
  const gap = 12;
  const width = zone.width * scale;
  const height = zone.height * scale;
  const sheet = Raster.filled(width * 3 + gap * 2, height, [255, 255, 255]);
  const changedSet = new Set(changed);
  for (let y = 0; y < zone.height; y++) {
    for (let x = 0; x < zone.width; x++) {
      const index = (zone.top + y) * FRAME.width + zone.left + x;
      const tiles = [
        before.get(zone.left + x, zone.top + y),
        after.get(zone.left + x, zone.top + y),
        changedSet.has(index) ? [255, 0, 255] : [235, 235, 235],
      ];
      tiles.forEach((rgb, tile) => {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            sheet.set(tile * (width + gap) + x * scale + dx, y * scale + dy, rgb);
          }
        }
      });
    }
  }
  await writePng(sheet, file);
}

// ---------------------------------------------------------------------------
// Programme
// ---------------------------------------------------------------------------

const argument = process.argv[2];
const sourceDir = argument && !argument.startsWith('--') ? argument : DEFAULT_SOURCE_DIR;
if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
  fail(
    `dossier des captures introuvable : ${sourceDir}. Rangez-y les captures, ou donnez ` +
      'le dossier : node scripts/prototype/prepare.mjs <dossier>',
  );
}
const proofDir = option('preuves');
mkdirSync(OUTPUT_DIR, { recursive: true });
if (proofDir) mkdirSync(proofDir, { recursive: true });

for (const view of VIEWS) {
  const captured = await load(path.join(sourceDir, view.source), view.sha256);
  const artefacts = findArtefacts(captured, view);
  const artefactPixels = new Set([...artefacts.cursor, ...artefacts.stains]);

  const cleaned = captured.clone();
  for (const index of artefactPixels) {
    cleaned.set(index % cleaned.width, (index / cleaned.width) | 0, BACKDROP);
  }

  const box = productBounds(cleaned, artefactPixels);
  const placement = placeFrame(cleaned, box, view.source);
  const output = frame(cleaned, placement);
  // Même cadrage sans nettoyage : la référence pour compter les pixels modifiés.
  const reference = frame(captured, placement);

  // Contrôles : seuls les pixels des traces changent ; le fond ajouté est uniforme ;
  // il ne reste qu'un seul groupe de pixels (la box et son ombre).
  const changed = [];
  const added = [];
  let backdrop = 0;
  for (let y = 0; y < FRAME.height; y++) {
    for (let x = 0; x < FRAME.width; x++) {
      const sx = x + placement.left;
      const sy = y + placement.top;
      const inside = sx >= 0 && sy >= 0 && sx < captured.width && sy < captured.height;
      if (output.is(x, y, BACKDROP)) backdrop++;
      if (!inside) {
        added.push(y * FRAME.width + x);
        if (!output.is(x, y, BACKDROP)) fail(`${view.source} : fond ajouté non uniforme.`);
        continue;
      }
      const differs = output.get(x, y).some((v, c) => v !== reference.get(x, y)[c]);
      if (!differs) continue;
      if (!artefactPixels.has(sy * captured.width + sx)) {
        fail(
          `${view.source} : pixel (${sx}, ${sy}) modifié alors qu'il n'appartient à aucune trace.`,
        );
      }
      changed.push(y * FRAME.width + x);
    }
  }
  const groups = components(output);
  if (groups.length !== 1)
    fail(`${view.source} : ${groups.length} groupes de pixels après nettoyage.`);
  const stainsLeft = (view.stains ?? []).flatMap((stain) =>
    groups[0].pixels.filter((index) => {
      const rgb = output.get(index % FRAME.width, (index / FRAME.width) | 0);
      return stain.colours.some((c) => rgb[0] === c[0] && rgb[1] === c[1] && rgb[2] === c[2]);
    }),
  );
  if (stainsLeft.length > 0)
    fail(`${view.source} : ${stainsLeft.length} pixels de trace restants.`);

  await writePng(output, path.join(OUTPUT_DIR, view.output));

  const cursorInFrame = artefacts.cursor.filter((index) => {
    const x = (index % captured.width) - placement.left;
    const y = ((index / captured.width) | 0) - placement.top;
    return x >= 0 && y >= 0 && x < FRAME.width && y < FRAME.height;
  }).length;
  let cursor = 'aucun';
  if (artefacts.cursor.length > 0) {
    cursor =
      cursorInFrame === 0
        ? `${artefacts.cursor.length} pixels, hors du cadre (retirés par le recadrage)`
        : `${artefacts.cursor.length} pixels, dont ${cursorInFrame} dans le cadre, repeints`;
  }
  const margins = {
    gauche: box.left - placement.left,
    droite: placement.left + FRAME.width - 1 - box.right,
    haut: box.top - placement.top,
    bas: placement.top + FRAME.height - 1 - box.bottom,
  };
  // Lignes du haut et du bas faites de fond seul (ni box, ni ombre) : si elles
  // existent des deux côtés, l'image peut se poser dans un panneau plus haut
  // qu'elle (backdropAtTopAndBottom dans src/content/prototype.ts).
  const plainRow = (y) => range([0, FRAME.width - 1]).every((x) => output.is(x, y, BACKDROP));
  let plainTop = 0;
  while (plainTop < FRAME.height && plainRow(plainTop)) plainTop++;
  let plainBottom = 0;
  while (plainBottom < FRAME.height && plainRow(FRAME.height - 1 - plainBottom)) plainBottom++;
  console.log(
    [
      `${view.source} → src/assets/prototype/${view.output} (${FRAME.width} × ${FRAME.height})`,
      `  box : x ${box.left}-${box.right}, y ${box.top}-${box.bottom} dans la capture ; ` +
        `marges ${Object.entries(margins)
          .map(([side, value]) => `${side} ${value}`)
          .join(', ')} px`,
      `  cadre : x ${placement.left} à ${placement.left + FRAME.width - 1}, ` +
        `y ${placement.top} à ${placement.top + FRAME.height - 1} ; fond ajouté : ${added.length} pixels`,
      `  fond seul en haut : ${plainTop} lignes, en bas : ${plainBottom} lignes` +
        (plainTop > 0 && plainBottom > 0 ? ' (backdropAtTopAndBottom: true)' : ''),
      `  pointeur de la souris : ${cursor}`,
      `  trace de l'interface : ${artefacts.stains.length} pixels repeints`,
      `  pixels modifiés : ${changed.length} (uniquement des traces) ; ` +
        `fond ${toHex(BACKDROP)} : ${((100 * backdrop) / (FRAME.width * FRAME.height)).toFixed(2)} % de l'image`,
    ].join('\n'),
  );

  if (proofDir) {
    const base = path.join(proofDir, view.output.replace(/\.png$/, ''));
    await writeDifferenceImage(output, changed, added, `${base}-differences.png`);
    for (const [n, stain] of (view.stains ?? []).entries()) {
      const zone = {
        left: stain.zone.left - placement.left,
        top: stain.zone.top - placement.top,
        width: stain.zone.width,
        height: stain.zone.height,
      };
      await writeZoomImage(reference, output, changed, zone, `${base}-zone-${n + 1}.png`);
    }
  }
}
