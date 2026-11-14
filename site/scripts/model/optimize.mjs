/**
 * npm run model:optimize [source.glb] [sortie.glb] : prépare le modèle
 * exporté de Blender pour le site.
 *
 * Par défaut : design/3d/hako-source.glb vers public/models/hako.glb.
 *
 * Étapes : contrôle du fichier source (npm run model:check --source),
 * retrait des lampes et caméras, fusion des doublons, nettoyage, soudure
 * des sommets, rééchantillonnage des animations s'il y en a, textures
 * ramenées à 2048 px au plus et réencodées dans le format le plus léger
 * sans perte visible, puis quantification de la géométrie (sommets stockés
 * en entiers, extension KHR_mesh_quantization) et réordonnancement pour une
 * meilleure compression par le serveur. Le résultat est contrôlé à nouveau ;
 * le fichier de sortie n'est écrit que si ce contrôle réussit.
 *
 * Le fichier obtenu se lit sans décodeur : il respecte la politique de
 * sécurité prévue pour le site (CSP « default-src 'self' »).
 *
 * Les objets nommés gardent exactement la position, la rotation et l'échelle
 * exportées : la quantification place sa correction d'échelle sur un nœud
 * enfant sans nom, qui porte le maillage.
 *
 * Option :
 *   --meshopt  compresse en plus la géométrie avec meshopt
 *              (EXT_meshopt_compression) : fichier plus léger, mais le
 *              navigateur doit exécuter un décodeur WebAssembly, ce qui
 *              demande « 'wasm-unsafe-eval' » dans la directive script-src
 *              de la CSP. À n'utiliser que si la CSP du site l'autorise.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { ImageUtils, Logger } from '@gltf-transform/core';
import { EXTTextureWebP } from '@gltf-transform/extensions';
import {
  dedup,
  getTextureColorSpace,
  listTextureSlots,
  meshopt,
  prune,
  quantize,
  reorder,
  resample,
  weld,
} from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

import { MODEL_LIMITS } from '../../src/scripts/scene-3d/contract.ts';
import {
  DEFAULT_MODEL,
  checkBytes,
  countErrors,
  createIO,
  formatBytes,
  formatReport,
  repoRoot,
} from './check.mjs';

/** Fichier exporté de Blender, non versionné. */
export const DEFAULT_SOURCE = 'design/3d/hako-source.glb';

/**
 * Qualité minimale exigée d'une texture couleur réencodée avec perte :
 * rapport signal sur bruit (PSNR) de 40 dB, seuil usuel au-delà duquel la
 * différence ne se voit pas.
 */
export const MIN_PSNR = 40;

/** Qualités WebP avec perte essayées pour les textures couleur, dans l'ordre. */
const WEBP_QUALITIES = [90, 95];

const SHARP_FORMATS = new Set(['image/png', 'image/jpeg', 'image/webp']);

// ---------------------------------------------------------------------------
// Étapes

/** Retire lampes et caméras : le site a les siennes. */
function removeLightsAndCameras(document) {
  const root = document.getRoot();
  let lights = 0;
  let cameras = 0;
  for (const node of root.listNodes()) {
    if (node.getExtension('KHR_lights_punctual')) {
      node.setExtension('KHR_lights_punctual', null);
      lights += 1;
    }
    if (node.getCamera()) {
      node.setCamera(null);
      cameras += 1;
    }
  }
  for (const camera of root.listCameras()) camera.dispose();
  for (const extension of root.listExtensionsUsed()) {
    if (extension.extensionName === 'KHR_lights_punctual') extension.dispose();
  }
  return { lights, cameras };
}

/**
 * Déplace le maillage de chaque objet nommé dans un enfant sans nom : la
 * quantification y mettra sa correction, sans toucher aux objets nommés.
 */
function isolateNamedMeshes(document) {
  let count = 0;
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || node.getName() === '' || node.getSkin()) continue;
    if (node.getExtension('EXT_mesh_gpu_instancing')) continue;
    node.addChild(document.createNode('').setMesh(mesh));
    node.setMesh(null);
    count += 1;
  }
  return count;
}

/**
 * Pixels de référence d'une texture : RVBA 8 bits, et si elle est opaque.
 * @param {import('sharp').Sharp} pipeline
 */
async function readReference(pipeline) {
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = true;
  for (let i = 3; i < data.length && opaque; i += 4) opaque = data[i] === 255;
  return { data, width: info.width, height: info.height, opaque };
}

/**
 * Qualité (PSNR, en dB) d'une image réencodée, telle que le site l'affiche.
 * Une couleur compte en proportion de son opacité : sous un pixel
 * transparent, elle ne se voit pas. Pour une image avec transparence, la
 * mesure est refaite entre quatre pixels voisins, là où la carte graphique
 * mélange les couleurs avant d'appliquer la transparence : une couleur
 * changée sous un pixel transparent y apparaîtrait en liseré. Renvoie le
 * plus faible des résultats, transparence comprise.
 * @param {Buffer} candidate image encodée
 * @param {{ data: Buffer, width: number, height: number, opaque: boolean }} reference
 */
export async function measurePsnr(candidate, reference) {
  const data = await sharp(candidate).ensureAlpha().raw().toBuffer();
  const { data: ref, width, height } = reference;
  if (data.length !== ref.length) return 0;
  const psnr = (sum, samples) =>
    sum === 0 ? Infinity : 10 * Math.log10((255 * 255) / (sum / samples));
  let colour = 0;
  let alpha = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    const b = ref[i + 3];
    alpha += (a - b) ** 2;
    for (let c = 0; c < 3; c += 1) colour += ((data[i + c] * a - ref[i + c] * b) / 255) ** 2;
  }
  const pixels = width * height;
  let result = Math.min(psnr(colour, pixels * 3), psnr(alpha, pixels));
  if (reference.opaque || width < 2 || height < 2) return result;
  const row = width * 4;
  let between = 0;
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const i = y * row + x * 4;
      const j = i + row;
      const a = data[i + 3] + data[i + 7] + data[j + 3] + data[j + 7];
      const b = ref[i + 3] + ref[i + 7] + ref[j + 3] + ref[j + 7];
      for (let c = 0; c < 3; c += 1) {
        const mixed = (data[i + c] + data[i + 4 + c] + data[j + c] + data[j + 4 + c]) * a;
        const expected = (ref[i + c] + ref[i + 4 + c] + ref[j + c] + ref[j + 4 + c]) * b;
        // Moyennes des couleurs et des opacités : chaque somme compte 4 pixels.
        between += ((mixed - expected) / (16 * 255)) ** 2;
      }
    }
  }
  result = Math.min(result, psnr(between, (width - 1) * (height - 1) * 3));
  return result;
}

const FORMAT_NAMES = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' };

/**
 * Ramène chaque texture à 2048 px au plus et garde la version la plus légère
 * parmi : l'image d'origine (ou réduite dans son format), le WebP sans perte,
 * et, pour les couleurs seulement, le PNG à palette et le WebP avec perte,
 * retenus s'ils atteignent MIN_PSNR. Les textures de données (normales,
 * rugosité, occlusion) restent exactes au pixel près.
 * @returns {Promise<Array<{ name: string, slots: string[], before: string, after: string }>>}
 */
async function optimizeTextures(document) {
  const report = [];
  for (const texture of document.getRoot().listTextures()) {
    const image = texture.getImage();
    const mimeType = texture.getMimeType();
    const size = image ? ImageUtils.getSize(image, mimeType) : null;
    if (!image || !size || !SHARP_FORMATS.has(mimeType)) continue;
    const name = texture.getName() || texture.getURI() || 'texture';
    const isColour = getTextureColorSpace(texture) === 'srgb';
    const [width, height] = size;
    const ratio = Math.min(1, MODEL_LIMITS.maxTextureSize / Math.max(width, height));
    const target = [
      Math.max(1, Math.round(width * ratio)),
      Math.max(1, Math.round(height * ratio)),
    ];
    const input = Buffer.from(image.buffer, image.byteOffset, image.byteLength);
    // Les textures de données ne doivent subir aucune conversion de couleurs.
    const open = () => {
      const pipeline = sharp(input, { ignoreIcc: !isColour, limitInputPixels: false });
      return ratio < 1
        ? pipeline.resize(target[0], target[1], { fit: 'fill', kernel: 'lanczos3' })
        : pipeline;
    };
    const encode = async (format, options) =>
      new Uint8Array(await open().toFormat(format, options).toBuffer());

    // Toujours acceptable : l'image telle quelle, ou réduite dans son format.
    let best = { bytes: image, mimeType };
    if (ratio < 1) {
      const format = FORMAT_NAMES[mimeType];
      const options = {
        png: { compressionLevel: 9 },
        jpeg: { quality: 92, mozjpeg: true },
        webp: isColour ? { quality: 92 } : { lossless: true, exact: true },
      }[format];
      best = { bytes: await encode(format, options), mimeType };
    }
    // WebP sans perte, pixels identiques (inutile pour une photo JPEG, toujours plus lourd).
    if (mimeType === 'image/png' || (mimeType === 'image/jpeg' && !isColour)) {
      const bytes = await encode('webp', { lossless: true, exact: true, effort: 6 });
      if (bytes.byteLength < best.bytes.byteLength) best = { bytes, mimeType: 'image/webp' };
    }
    // Avec perte, pour les couleurs : retenus seulement au-dessus de MIN_PSNR.
    if (isColour && mimeType !== 'image/webp') {
      let reference = null;
      const accept = async (bytes) => {
        if (bytes.byteLength >= best.bytes.byteLength) return false;
        reference ??= await readReference(open());
        return (await measurePsnr(Buffer.from(bytes), reference)) >= MIN_PSNR;
      };
      if (mimeType === 'image/png') {
        // Palette de 256 couleurs au plus : idéal pour un logo ou un aplat.
        const bytes = await encode('png', { palette: true, compressionLevel: 9 });
        if (await accept(bytes)) best = { bytes, mimeType: 'image/png' };
      }
      // Avec transparence, l'effort 6 multiplie le temps d'encodage (par 40 sur
      // un marquage de 2048 × 512 px) pour un gain de poids inférieur à 1 %.
      const { hasAlpha } = await sharp(input).metadata();
      for (const quality of WEBP_QUALITIES) {
        const effort = hasAlpha ? 4 : 6;
        const options = { quality, alphaQuality: 100, smartSubsample: true, effort };
        const bytes = await encode('webp', options);
        // Une qualité supérieure ne serait pas plus légère.
        if (bytes.byteLength >= best.bytes.byteLength) break;
        if (await accept(bytes)) {
          best = { bytes, mimeType: 'image/webp' };
          break;
        }
      }
    }

    if (best.bytes !== image) {
      texture.setImage(best.bytes).setMimeType(best.mimeType);
      const extension = ImageUtils.mimeTypeToExtension(best.mimeType);
      const uri = texture.getURI();
      if (uri) texture.setURI(uri.replace(/\.[a-z0-9]+$/i, `.${extension}`));
    }
    const [afterWidth, afterHeight] = ImageUtils.getSize(best.bytes, best.mimeType) ?? target;
    report.push({
      name,
      slots: listTextureSlots(texture),
      before: `${width} × ${height} ${FORMAT_NAMES[mimeType]} ${formatBytes(image.byteLength)}`,
      after: `${afterWidth} × ${afterHeight} ${FORMAT_NAMES[best.mimeType]} ${formatBytes(best.bytes.byteLength)}`,
    });
  }
  // L'extension EXT_texture_webp n'est déclarée que si une texture est en WebP.
  const root = document.getRoot();
  const usesWebp = root.listTextures().some((texture) => texture.getMimeType() === 'image/webp');
  if (usesWebp) document.createExtension(EXTTextureWebP).setRequired(true);
  return report;
}

/**
 * Nettoyage : ressources inutilisées, nœuds vides (lampes retirées…),
 * coordonnées de texture sans texture, textures unies remplacées par une
 * couleur. Les pièces du contrat ne sont jamais vides : le contrôle du
 * fichier source l'a vérifié.
 */
const PRUNE_OPTIONS = { keepLeaves: false, keepAttributes: false, keepSolidTextures: false };

/**
 * Optimise un document en place.
 * @param {import('@gltf-transform/core').Document} document
 * @param {{ meshopt?: boolean }} [options] meshopt : compression
 *   EXT_meshopt_compression (décodeur WebAssembly côté navigateur)
 */
export async function optimizeDocument(document, options = {}) {
  const useMeshopt = options.meshopt ?? false;
  // Messages internes de la bibliothèque (en anglais) : seulement les alertes.
  document.setLogger(new Logger(Logger.Verbosity.WARN));
  await MeshoptEncoder.ready;
  const removed = removeLightsAndCameras(document);
  await document.transform(dedup(), prune(PRUNE_OPTIONS));
  const isolated = isolateNamedMeshes(document);
  await document.transform(weld());
  if (document.getRoot().listAnimations().length > 0) await document.transform(resample());
  const textures = await optimizeTextures(document);
  if (useMeshopt) {
    await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  } else {
    // Un fichier déjà compressé avec meshopt (réoptimisé) perd cette compression.
    for (const extension of document.getRoot().listExtensionsUsed()) {
      if (extension.extensionName === 'EXT_meshopt_compression') extension.dispose();
    }
    await document.transform(reorder({ encoder: MeshoptEncoder, target: 'size' }), quantize());
  }
  await document.transform(prune(PRUNE_OPTIONS));
  return { removed, isolated, textures };
}

// ---------------------------------------------------------------------------
// Ligne de commande

/**
 * @param {string[]} argv arguments après le nom du script
 * @param {{ root?: string, log?: (line: string) => void, config?: any }} [options]
 * @returns {Promise<number>} code de sortie
 */
export async function main(argv, options = {}) {
  const root = options.root ?? repoRoot;
  const log = options.log ?? ((line) => console.log(line));
  const flags = argv.filter((arg) => arg.startsWith('--'));
  const paths = argv.filter((arg) => !arg.startsWith('--'));
  const unknown = flags.filter((flag) => flag !== '--meshopt');
  if (unknown.length > 0 || paths.length > 2) {
    log(
      unknown.length > 0
        ? `Option inconnue : ${unknown.join(' ')}. Seule l’option --meshopt existe.`
        : 'Usage : npm run model:optimize [source.glb] [sortie.glb]',
    );
    return 2;
  }
  const resolve = (value, fallback) =>
    value ? path.resolve(process.cwd(), value) : path.join(root, fallback);
  const source = resolve(paths[0], DEFAULT_SOURCE);
  const output = resolve(paths[1], DEFAULT_MODEL);
  const relative = (file) => path.relative(root, file) || file;

  let sourceBytes;
  try {
    sourceBytes = new Uint8Array(readFileSync(source));
  } catch {
    log(`Fichier source introuvable : ${relative(source)}.`);
    log(
      paths[0]
        ? 'Vérifiez le chemin donné.'
        : `Exportez le modèle depuis Blender vers ${DEFAULT_SOURCE} (voir docs/model-contract.md).`,
    );
    return 1;
  }

  const io = await createIO();
  const checkOptions = {
    root,
    io,
    ...(options.config === undefined ? {} : { config: options.config }),
  };
  const before = await checkBytes(sourceBytes, { ...checkOptions, file: source, stage: 'source' });
  for (const line of formatReport(before, { root })) log(line);
  if (countErrors(before.findings) > 0 || !before.document) {
    log('');
    log(
      `Corrigez ces erreurs dans Blender, réexportez, puis relancez npm run model:optimize. ${relative(output)} n’a pas été modifié.`,
    );
    return 1;
  }

  const document = before.document;
  const steps = await optimizeDocument(document, { meshopt: flags.includes('--meshopt') });
  const outputBytes = await io.writeBinary(document);
  const after = await checkBytes(outputBytes, { ...checkOptions, file: output, stage: 'final' });

  log('');
  log('Optimisation');
  if (steps.removed.lights > 0 || steps.removed.cameras > 0) {
    log(`  Retiré : ${steps.removed.lights} lampe(s), ${steps.removed.cameras} caméra(s).`);
  }
  for (const texture of steps.textures) {
    log(`  Texture ${texture.name} : ${texture.before} → ${texture.after}`);
  }
  const saved = 1 - outputBytes.byteLength / sourceBytes.byteLength;
  log(
    `  Poids : ${formatBytes(sourceBytes.byteLength)} → ${formatBytes(outputBytes.byteLength)} (${saved >= 0 ? '−' : '+'}${Math.abs(Math.round(saved * 100))} %)`,
  );
  log('');
  for (const line of formatReport(after, { root })) log(line);

  if (countErrors(after.findings) > 0) {
    log('');
    log(`Le modèle optimisé ne passe pas le contrôle : ${relative(output)} n’a pas été modifié.`);
    return 1;
  }
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, outputBytes);
  log('');
  log(`Écrit : ${relative(output)} (${formatBytes(outputBytes.byteLength)}).`);
  if (outputBytes.byteLength > MODEL_LIMITS.maxFileBytes) {
    log(
      `Attention : au-delà des ${formatBytes(MODEL_LIMITS.maxFileBytes)} visés. Réduisez les textures ou le nombre de triangles dans Blender.`,
    );
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
