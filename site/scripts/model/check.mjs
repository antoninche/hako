/**
 * npm run model:check [fichier.glb] : vérifie qu'un modèle 3D respecte le
 * contrat décrit dans docs/model-contract.md avant que le site ne l'utilise.
 *
 * Sans argument, contrôle public/models/hako.glb. Si ce fichier n'existe
 * pas, le site affiche le modèle dessiné en code : seule la cohérence de
 * src/data/model.config.json avec le contrat est alors vérifiée.
 *
 * Options :
 *   --source  applique les règles du fichier exporté de Blender, avant
 *             npm run model:optimize : textures trop grandes, lampes,
 *             caméras et poids y sont tolérés, l'optimisation les corrige.
 *
 * Code de sortie : 0 si le modèle est utilisable (avec d'éventuels
 * avertissements), 1 s'il reste une erreur, 2 si la commande est mal écrite.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Accessor, ImageUtils, Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getGLPrimitiveCount, listTextureSlots } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

import {
  ALL_NODES,
  MODEL_LIMITS,
  MODEL_SIZE_RANGE,
  compareNodeNames,
  isNodeName,
  isRequiredNode,
} from '../../src/scripts/scene-3d/contract.ts';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Modèle utilisé par le site, relatif à la racine du dépôt. */
export const DEFAULT_MODEL = 'public/models/hako.glb';
/** Réglages de la scène (décalages, ordre, étiquettes), relatifs à la racine. */
export const MODEL_CONFIG = 'src/data/model.config.json';

/**
 * Écart toléré entre l'origine d'un objet et le centre de sa géométrie :
 * 10 % de sa plus grande dimension, et jamais moins de 2 mm.
 */
export const ORIGIN_TOLERANCE = { ratio: 0.1, minMetres: 0.002 };

/**
 * Écart toléré entre l'origine du rotor et le centre de ses pales, mesuré
 * perpendiculairement à son axe, en part de son diamètre : au-delà de 6 %,
 * un avertissement ; au-delà de 15 %, une erreur (jamais moins de 1 mm).
 */
export const ROTOR_TOLERANCE = { warningRatio: 0.06, errorRatio: 0.15, minMetres: 0.001 };

/** Tolérance sur une échelle « égale à 1 ». */
const SCALE_TOLERANCE = 1e-4;

/** Rotation ignorée en dessous de ce seuil (degrés). */
const ROTATION_TOLERANCE_DEGREES = 0.5;

/**
 * Extensions glTF que le site sait lire : celles que three.js gère seul,
 * plus EXT_meshopt_compression dont le décodeur est fourni avec three.js
 * (signalé plus bas : il demande WebAssembly, que la CSP prévue bloque).
 * Les lampes et les matériaux sans éclairage sont lisibles mais refusés
 * plus bas, pour d'autres raisons.
 */
const SITE_EXTENSIONS = new Set([
  'EXT_materials_bump',
  'EXT_mesh_gpu_instancing',
  'EXT_meshopt_compression',
  'EXT_texture_avif',
  'EXT_texture_webp',
  'KHR_lights_punctual',
  'KHR_materials_anisotropy',
  'KHR_materials_clearcoat',
  'KHR_materials_diffuse_roughness',
  'KHR_materials_dispersion',
  'KHR_materials_emissive_strength',
  'KHR_materials_ior',
  'KHR_materials_iridescence',
  'KHR_materials_sheen',
  'KHR_materials_specular',
  'KHR_materials_transmission',
  'KHR_materials_unlit',
  'KHR_materials_volume',
  'KHR_mesh_quantization',
  'KHR_texture_transform',
]);

/** Pourquoi une extension connue n'est pas lisible par le site. */
const EXTENSION_HINTS = {
  KHR_draco_mesh_compression:
    'À l’export, décochez « Compression » (Draco) : npm run model:optimize compresse lui-même le modèle.',
  KHR_texture_basisu:
    'Les textures KTX2 demandent un décodeur que le site n’embarque pas : exportez les images en PNG ou JPEG.',
  KHR_materials_pbrSpecularGlossiness:
    'Ancien modèle de matériau (spéculaire/brillance) que three.js ne lit plus : utilisez un Principled BSDF.',
  KHR_materials_variants:
    'Les variantes de matériaux sont ignorées : seul le matériau par défaut de chaque objet s’affiche.',
};

/** Matériaux coûteux à afficher sur un téléphone. */
const COSTLY_MATERIAL_EXTENSIONS = {
  KHR_materials_transmission: 'transparence de type verre (Transmission)',
  KHR_materials_volume: 'volume (épaisseur d’un verre)',
  KHR_materials_dispersion: 'dispersion de la lumière',
};

/**
 * Noms souvent donnés aux pièces, en français et en anglais (sans accents ni
 * séparateurs). « hako » seul n'y figure pas : c'est le nom de la box entière,
 * souvent donné à la scène ou à l'objet qui regroupe les pièces.
 */
const NAME_ALIASES = {
  Case_Base: ['base', 'boitier', 'case', 'casebottom', 'socle', 'fond', 'bottom'],
  Case_Lid: ['lid', 'couvercle', 'capot', 'cover', 'top', 'casetop'],
  Fan: ['ventilateur', 'ventilo', 'fanframe', 'cadre', 'cadreventilateur'],
  Fan_Rotor: ['rotor', 'helice', 'pales', 'blades', 'fanblades', 'turbine'],
  NVMe_Board: ['m2', 'hat', 'm2hat', 'nvmehat', 'nvmebase', 'cartem2', 'cartenvme', 'adaptateur'],
  NVMe_SSD: ['ssd', 'nvme', 'disque', 'm2ssd', 'ssdnvme'],
  RPi5_Board: ['raspberry', 'raspberrypi', 'raspberrypi5', 'rpi', 'rpi5', 'pi', 'pi5', 'cartemere'],
  Logo_Decal: [
    'logo',
    'decal',
    'kanji',
    'marquage',
    'logohako',
    'mot',
    'mothako',
    'hakomot',
    'wordmark',
  ],
};

const BLENDER_COPY_SUFFIX = /\.\d{3}$/;

/** Forme comparable d'un nom : sans accents, sans suffixe « .001 », sans séparateurs. */
function comparableName(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(BLENDER_COPY_SUFFIX, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Nom du contrat probablement visé par un nom inconnu, ou null.
 * @param {string} name
 * @returns {string | null}
 */
export function suggestNodeName(name) {
  const key = comparableName(name);
  if (key === '') return null;
  const exact = ALL_NODES.find((node) => comparableName(node) === key);
  if (exact) return exact;
  const alias = Object.entries(NAME_ALIASES).find(([, aliases]) => aliases.includes(key));
  return alias ? alias[0] : null;
}

// ---------------------------------------------------------------------------
// Mise en forme

const numberFormat = new Intl.NumberFormat('fr-FR');
const decimalFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** Poids lisible : « 34,0 Ko », « 1,84 Mo ». */
export function formatBytes(bytes) {
  if (bytes < 1024 * 1024) {
    return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bytes / 1024)} Ko`;
  }
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bytes / 1024 / 1024)} Mo`;
}

/** Longueur lisible : millimètres, centimètres ou mètres selon l'ordre de grandeur. */
function formatLength(metres) {
  if (metres >= 1) return `${decimalFormat.format(metres)} m`;
  if (metres >= 0.0005) return `${decimalFormat.format(metres * 1000)} mm`;
  return `${new Intl.NumberFormat('fr-FR', { maximumSignificantDigits: 2 }).format(metres * 1000)} mm`;
}

const quote = (name) => (name === '' ? 'un objet sans nom' : `« ${name} »`);

const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${numberFormat.format(count)} ${count > 1 ? pluralForm : singular}`;

// ---------------------------------------------------------------------------
// Lecture

/**
 * Lecteur glTF : toutes les extensions connues, et le décodeur meshopt pour
 * relire un modèle déjà optimisé.
 */
export async function createIO() {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  // Messages internes de la bibliothèque (en anglais) : seulement les alertes.
  return new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.WARN))
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });
}

/**
 * Lit l'en-tête JSON d'un fichier .glb, sans décoder les données.
 * @param {Uint8Array} bytes
 * @returns {{ json: any } | { problem: string }}
 */
export function readGlbJson(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) {
    const start = new TextDecoder().decode(bytes.subarray(0, 64)).trimStart();
    return {
      problem: start.startsWith('{')
        ? 'Ce fichier est un .gltf (texte), pas un .glb.'
        : 'Ce fichier n’est pas un modèle glTF binaire (.glb).',
    };
  }
  if (view.getUint32(4, true) !== 2) {
    return { problem: `Version glTF ${view.getUint32(4, true)} : seule la version 2.0 est lue.` };
  }
  const length = view.getUint32(12, true);
  const type = view.getUint32(16, true);
  if (type !== 0x4e4f534a || 20 + length > bytes.byteLength) {
    return { problem: 'Fichier .glb incomplet ou abîmé : réexportez-le.' };
  }
  try {
    return { json: JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length))) };
  } catch {
    return { problem: 'Fichier .glb abîmé (en-tête illisible) : réexportez-le.' };
  }
}

/**
 * Lit src/data/model.config.json s'il existe.
 * @param {string} [root]
 * @returns {{ file: string, data: any } | { file: string, problem: string } | null}
 */
export function readModelConfig(root = repoRoot) {
  const file = path.join(root, MODEL_CONFIG);
  if (!existsSync(file)) return null;
  try {
    return { file, data: JSON.parse(readFileSync(file, 'utf8')) };
  } catch (error) {
    return { file, problem: `JSON illisible (${error instanceof Error ? error.message : error}).` };
  }
}

// ---------------------------------------------------------------------------
// Géométrie

/** Applique une matrice 4 × 4 (ordre glTF, par colonnes) à un point. */
function transformPoint(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function emptyBounds() {
  return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
}

function isEmptyBounds(bounds) {
  return !bounds.min.every(Number.isFinite);
}

function expandBounds(bounds, point) {
  for (let axis = 0; axis < 3; axis += 1) {
    if (point[axis] < bounds.min[axis]) bounds.min[axis] = point[axis];
    if (point[axis] > bounds.max[axis]) bounds.max[axis] = point[axis];
  }
}

function boundsSize(bounds) {
  return bounds.max.map((value, axis) => value - bounds.min[axis]);
}

function boundsCenter(bounds) {
  return bounds.max.map((value, axis) => (value + bounds.min[axis]) / 2);
}

/** Boîte englobante, dans le repère de la scène, des maillages donnés. */
function worldBounds(items) {
  const bounds = emptyBounds();
  const element = [0, 0, 0];
  for (const { mesh, matrix } of items) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      if (!position) continue;
      for (let i = 0, count = position.getCount(); i < count; i += 1) {
        position.getElement(i, element);
        expandBounds(bounds, transformPoint(matrix, element[0], element[1], element[2]));
      }
    }
  }
  return bounds;
}

const TRIANGLE_MODES = new Set([4, 5, 6]);

/** Nombre de triangles d'un maillage, et de segments ou points isolés. */
function countPrimitives(mesh) {
  let triangles = 0;
  let loose = 0;
  for (const primitive of mesh.listPrimitives()) {
    const count = getGLPrimitiveCount(primitive);
    if (TRIANGLE_MODES.has(primitive.getMode())) triangles += count;
    else loose += count;
  }
  return { triangles, loose };
}

/** Le maillage stocke-t-il ses positions en entiers (quantification) ? */
function isQuantized(mesh) {
  return mesh
    .listPrimitives()
    .some(
      (primitive) =>
        primitive.getAttribute('POSITION')?.getComponentType() !== Accessor.ComponentType.FLOAT,
    );
}

/** Nombre d'exemplaires d'un nœud (instanciation GPU comprise). */
function instanceCount(node) {
  const batch = node.getExtension('EXT_mesh_gpu_instancing');
  if (!batch) return 1;
  const attribute = batch.listAttributes?.()[0];
  return attribute ? attribute.getCount() : 1;
}

/** Angle (degrés) d'une rotation donnée en quaternion [x, y, z, w]. */
function rotationAngleDegrees([, , , w]) {
  return (2 * Math.acos(Math.min(1, Math.abs(w))) * 180) / Math.PI;
}

/**
 * Parcourt la scène et décrit chaque nœud.
 * @returns {Array<{ node: any, name: string, parent: any, contractAncestor: any, depth: number }>}
 */
function collectEntries(scene) {
  const entries = [];
  const visit = (node, parent, contractAncestor, depth) => {
    const entry = { node, name: node.getName(), parent, contractAncestor, depth };
    entries.push(entry);
    const nextContract = isNodeName(entry.name) ? entry : contractAncestor;
    for (const child of node.listChildren()) visit(child, entry, nextContract, depth + 1);
  };
  for (const child of scene.listChildren()) visit(child, null, null, 0);
  return entries;
}

/**
 * Géométrie propre d'un nœud : son maillage et ceux de ses descendants sans
 * nom (créés par l'export ou l'optimisation), sans traverser un objet nommé.
 */
function ownMeshes(node) {
  const items = [];
  const visit = (current) => {
    const mesh = current.getMesh();
    if (mesh) items.push({ mesh, matrix: current.getWorldMatrix(), node: current });
    for (const child of current.listChildren()) {
      if (child.getName() === '') visit(child);
    }
  };
  visit(node);
  return items;
}

function hasGeometry(node) {
  let found = false;
  node.traverse((current) => {
    if (current.getMesh()) found = true;
  });
  return found;
}

// ---------------------------------------------------------------------------
// Contrôles

/**
 * @typedef {'error' | 'warning' | 'info'} Level
 * @typedef {{ level: Level, code: string, topic: string, message: string, hint?: string }} Finding
 */

class Findings {
  constructor() {
    /** @type {Finding[]} */
    this.list = [];
  }

  add(level, code, topic, message, hint) {
    this.list.push(hint ? { level, code, topic, message, hint } : { level, code, topic, message });
  }

  error(...args) {
    this.add('error', ...args);
  }

  warning(...args) {
    this.add('warning', ...args);
  }

  info(...args) {
    this.add('info', ...args);
  }
}

/**
 * Vérifie que les noms de model.config.json désignent des pièces du contrat.
 * @param {any} data contenu du fichier
 * @param {{ present?: Set<string> }} [options] noms trouvés dans le modèle
 * @returns {Finding[]}
 */
export function checkModelConfig(data, options = {}) {
  const findings = new Findings();
  const topic = 'Réglages';
  const fileLabel = MODEL_CONFIG;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    findings.error('config-invalid', topic, `${fileLabel} doit contenir un objet JSON.`);
    return findings.list;
  }
  /** @type {Array<{ where: string, name: unknown }>} */
  const references = [];
  if (Array.isArray(data.order)) {
    data.order.forEach((name, index) => references.push({ where: `order[${index}]`, name }));
  }
  for (const section of ['labels', 'parts']) {
    const value = data[section];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const key of Object.keys(value))
        references.push({ where: `${section}.${key}`, name: key });
    }
  }
  for (const { where, name } of references) {
    if (typeof name !== 'string' || !isNodeName(name)) {
      const suggestion = typeof name === 'string' ? suggestNodeName(name) : null;
      findings.error(
        'config-unknown-node',
        topic,
        `${fileLabel} : « ${where} » ne désigne aucune pièce du contrat.`,
        suggestion
          ? `Remplacez « ${String(name)} » par « ${suggestion} ».`
          : `Noms possibles : ${ALL_NODES.join(', ')}.`,
      );
    } else if (options.present && !options.present.has(name)) {
      // Une pièce obligatoire absente est déjà signalée comme erreur (node-missing).
      if (!isRequiredNode(name)) {
        findings.info(
          'config-unused-node',
          topic,
          `${fileLabel} : « ${where} » concerne ${quote(name)}, absent de ce modèle (pièce facultative) : réglage ignoré.`,
        );
      }
    }
  }
  const axis = data.rotor?.axis;
  if (axis !== undefined && !['x', 'y', 'z'].includes(axis)) {
    findings.error(
      'config-rotor-axis',
      topic,
      `${fileLabel} : « rotor.axis » vaut « ${String(axis)} » au lieu de x, y ou z.`,
    );
  }
  return findings.list;
}

/**
 * Contrôle un document glTF déjà lu.
 * @param {import('@gltf-transform/core').Document} document
 * @param {{ stage?: 'source' | 'final', fileBytes?: number, json?: any, config?: any, rotorAxis?: 'x' | 'y' | 'z' }} [context]
 */
export function checkDocument(document, context = {}) {
  const stage = context.stage ?? 'final';
  const isSource = stage === 'source';
  const findings = new Findings();
  const root = document.getRoot();
  const json = context.json ?? {};
  const summary = {
    stage,
    // glTF-Transform ne recopie pas le générateur à la lecture : celui du fichier d'abord.
    generator: json.asset?.generator ?? root.getAsset().generator ?? '',
    fileBytes: context.fileBytes ?? null,
    sizeMetres: /** @type {number[] | null} */ (null),
    triangles: 0,
    textures:
      /** @type {Array<{ name: string, width: number, height: number, mimeType: string }>} */ ([]),
    present: /** @type {string[]} */ ([]),
    hierarchy: /** @type {string[]} */ ([]),
    optimized: false,
    meshopt: false,
  };

  // Extensions ---------------------------------------------------------------
  const required = new Set(json.extensionsRequired ?? []);
  const used = new Set([
    ...(json.extensionsUsed ?? []),
    ...root.listExtensionsUsed().map((extension) => extension.extensionName),
  ]);
  // L'export de Blender ne quantifie ni ne compresse jamais la géométrie :
  // l'une ou l'autre extension signale un fichier déjà optimisé.
  summary.meshopt = used.has('EXT_meshopt_compression');
  summary.optimized = summary.meshopt || used.has('KHR_mesh_quantization');
  for (const name of [...used].sort()) {
    if (SITE_EXTENSIONS.has(name)) continue;
    const hint = EXTENSION_HINTS[name];
    if (required.has(name) || name === 'KHR_materials_pbrSpecularGlossiness') {
      findings.error(
        'extension-unsupported',
        'Fichier',
        `Le fichier utilise l’extension ${name}, que le site ne sait pas lire.`,
        hint,
      );
    } else {
      findings.warning(
        'extension-ignored',
        'Fichier',
        `L’extension ${name} sera ignorée par le site.`,
        hint,
      );
    }
  }

  // Scènes -------------------------------------------------------------------
  const scenes = root.listScenes();
  const scene = root.getDefaultScene() ?? scenes[0];
  if (!scene) {
    findings.error('scene-empty', 'Objets', 'Le fichier ne contient aucune scène.');
    return { findings: findings.list, summary };
  }
  if (scenes.length > 1) {
    findings.warning(
      'scene-multiple',
      'Objets',
      `Le fichier contient ${plural(scenes.length, 'scène')} : seule ${quote(scene.getName())} sera affichée.`,
      'À l’export, cochez « Active Scene » (Include) pour n’exporter que la scène voulue.',
    );
  }

  const entries = collectEntries(scene);
  const names = entries.map((entry) => entry.name);
  const report = compareNodeNames(names);
  const present = new Set(names.filter((name) => isNodeName(name)));
  summary.present = ALL_NODES.filter((name) => present.has(name));
  summary.hierarchy = summary.present.map((name) => {
    const holder = entries.find((entry) => entry.name === name)?.contractAncestor;
    return holder ? `${name} (sous ${holder.name})` : name;
  });
  const isLightOrCamera = (node) =>
    !hasGeometry(node) && (node.getCamera() !== null || node.getExtension('KHR_lights_punctual'));

  // Noms ---------------------------------------------------------------------
  const unknownEntries = entries.filter(
    (entry) => entry.name !== '' && !isNodeName(entry.name) && !isLightOrCamera(entry.node),
  );
  const containsPart = (entry) =>
    entries.some((other) => isNodeName(other.name) && isAncestor(entry, other));
  /**
   * Objet qui ne fait que regrouper des pièces : sans géométrie propre (son
   * maillage et ceux de ses enfants sans nom), il n'a rien qui resterait
   * immobile. Le site anime les pièces quel que soit leur parent.
   */
  const isGroup = (entry) => ownMeshes(entry.node).length === 0 && containsPart(entry);
  /** Candidat (nom inconnu) pour chaque pièce absente. Un groupe n'est pas une pièce. */
  const candidates = new Map();
  for (const entry of unknownEntries) {
    if (isGroup(entry)) continue;
    const suggestion = suggestNodeName(entry.name);
    if (suggestion && !present.has(suggestion) && !candidates.has(suggestion)) {
      candidates.set(suggestion, entry);
    }
  }
  for (const name of report.missing) {
    const candidate = candidates.get(name);
    if (candidate) {
      findings.error(
        'node-missing',
        'Objets',
        `${quote(name)} est absent : c’est sans doute l’objet ${quote(candidate.name)}.`,
        `Dans Blender, renommez ${quote(candidate.name)} exactement « ${name} » (majuscules et tiret bas compris).`,
      );
    } else {
      findings.error(
        'node-missing',
        'Objets',
        `${quote(name)} est absent : c’est une pièce obligatoire.`,
        `Dans Blender, l’objet doit porter exactement ce nom (majuscules et tiret bas compris).`,
      );
    }
  }
  for (const name of report.missingOptional) {
    const candidate = candidates.get(name);
    if (candidate) {
      findings.error(
        'node-misnamed',
        'Objets',
        `${quote(candidate.name)} ressemble à ${quote(name)} (pièce facultative), mais le nom ne correspond pas.`,
        `Renommez-le exactement « ${name} », ou supprimez-le.`,
      );
    } else {
      findings.info(
        'node-optional-missing',
        'Objets',
        name === 'Fan_Rotor'
          ? `${quote(name)} (facultatif) est absent : le ventilateur ne tournera pas.`
          : `${quote(name)} (facultatif) est absent : pas de marquage séparé sur le boîtier.`,
      );
    }
  }
  for (const name of report.duplicated) {
    const count = names.filter((value) => value === name).length;
    findings.error(
      'node-duplicate',
      'Objets',
      `${quote(name)} est porté par ${plural(count, 'objet')} : chaque nom doit être unique.`,
      'Supprimez les copies, ou joignez-les à l’objet principal (sélection puis Ctrl+J).',
    );
  }
  const reportedUnknown = new Set();
  for (const entry of unknownEntries) {
    const suggestion = suggestNodeName(entry.name);
    if (suggestion && candidates.get(suggestion) === entry) continue;
    // Un objet inconnu rangé sous un autre objet inconnu est signalé avec lui.
    if (entry.parent && reportedUnknown.has(entry.parent)) {
      reportedUnknown.add(entry);
      continue;
    }
    if (suggestion && present.has(suggestion) && BLENDER_COPY_SUFFIX.test(entry.name)) {
      findings.error(
        'node-copy',
        'Objets',
        `${quote(entry.name)} ressemble à une copie de ${quote(suggestion)} (Blender ajoute « .001 » aux doublons).`,
        `Supprimez la copie, ou joignez-la à ${quote(suggestion)} (sélection puis Ctrl+J).`,
      );
      reportedUnknown.add(entry);
    } else if (isGroup(entry)) {
      // Ses autres enfants hors contrat sont contrôlés un par un.
      findings.info(
        'node-group',
        'Objets',
        `${quote(entry.name)} regroupe des pièces sans en être une : accepté. Ses transformations sont contrôlées comme celles des pièces.`,
      );
    } else if (entry.contractAncestor) {
      findings.warning(
        'node-extra-attached',
        'Objets',
        `${quote(entry.name)} ne fait pas partie du contrat ; rangé sous ${quote(entry.contractAncestor.name)}, il suivra ses mouvements.`,
        `Pour alléger le fichier, joignez-le à ${quote(entry.contractAncestor.name)} (sélection puis Ctrl+J).`,
      );
      reportedUnknown.add(entry);
    } else if (!hasGeometry(entry.node)) {
      findings.warning(
        'node-empty-extra',
        'Objets',
        `${quote(entry.name)} est un objet vide, hors contrat.`,
        'Supprimez-le dans Blender, ou n’exportez que les objets sélectionnés.',
      );
      reportedUnknown.add(entry);
    } else if (containsPart(entry)) {
      // Maillage hors contrat qui porte des pièces : elles s'écartent, lui
      // reste en place. Ses autres enfants hors contrat sont contrôlés un par un.
      findings.error(
        'node-unknown',
        'Objets',
        `${quote(entry.name)} ne fait pas partie du contrat : sa géométrie resterait immobile pendant que les pièces rangées dessous s’écartent.`,
        `S’il ne sert qu’à regrouper les pièces, remplacez-le par un objet vide (Add > Empty). Sinon, renommez-le d’après la pièce qu’il représente. Noms attendus : ${ALL_NODES.join(', ')}.`,
      );
    } else {
      findings.error(
        'node-unknown',
        'Objets',
        `${quote(entry.name)} ne fait pas partie du contrat : il resterait immobile pendant l’animation.`,
        `Supprimez-le, renommez-le, ou joignez-le à la pièce dont il fait partie (Ctrl+J) ou rangez-le sous elle (Ctrl+P). Noms attendus : ${ALL_NODES.join(', ')}.`,
      );
      reportedUnknown.add(entry);
    }
  }

  const partEntries = entries.filter((entry) => isNodeName(entry.name));
  for (const entry of partEntries) {
    if (!hasGeometry(entry.node)) {
      findings.error(
        'node-no-geometry',
        'Objets',
        `${quote(entry.name)} ne contient aucune géométrie (objet vide).`,
        'L’objet portant ce nom doit être le maillage lui-même, pas un objet vide qui le regroupe.',
      );
    }
  }

  // Dimensions ---------------------------------------------------------------
  const allMeshes = [];
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (mesh) allMeshes.push({ mesh, matrix: node.getWorldMatrix(), node });
  });
  const sceneBounds = worldBounds(allMeshes);
  if (isEmptyBounds(sceneBounds)) {
    findings.error('scene-no-geometry', 'Dimensions', 'La scène ne contient aucune géométrie.');
  } else {
    const size = boundsSize(sceneBounds);
    summary.sizeMetres = size;
    const largest = Math.max(...size);
    if (largest > MODEL_SIZE_RANGE.maxMetres) {
      const factor = largest / 0.1;
      let guess =
        'Vérifiez l’unité de la scène (Unit Scale = 1,000) et appliquez l’échelle (Ctrl+A > Scale).';
      if (factor >= 300 && factor <= 3000) {
        guess =
          'Il a sans doute été exporté en millimètres : réduisez-le à 0,001 puis appliquez l’échelle (Ctrl+A > Scale).';
      } else if (factor >= 30 && factor <= 300) {
        guess =
          'Il a sans doute été exporté en centimètres : réduisez-le à 0,01 puis appliquez l’échelle (Ctrl+A > Scale).';
      }
      findings.error(
        'size-too-big',
        'Dimensions',
        `Le modèle mesure ${formatLength(largest)} dans sa plus grande dimension (attendu : entre ${formatLength(MODEL_SIZE_RANGE.minMetres)} et ${formatLength(MODEL_SIZE_RANGE.maxMetres)}, une unité de Blender = 1 m).`,
        guess,
      );
    } else if (largest < MODEL_SIZE_RANGE.minMetres) {
      findings.error(
        'size-too-small',
        'Dimensions',
        `Le modèle ne mesure que ${formatLength(largest)} dans sa plus grande dimension (attendu : entre ${formatLength(MODEL_SIZE_RANGE.minMetres)} et ${formatLength(MODEL_SIZE_RANGE.maxMetres)}).`,
        'L’échelle a sans doute été réduite deux fois : remettez la box à sa taille réelle, en mètres.',
      );
    }
  }

  // Couvercle au-dessus de la base : sinon, le modèle est probablement couché.
  const lid = entries.find((entry) => entry.name === 'Case_Lid');
  const base = entries.find((entry) => entry.name === 'Case_Base');
  if (lid && base) {
    const lidBounds = worldBounds(ownMeshes(lid.node));
    const baseBounds = worldBounds(ownMeshes(base.node));
    if (!isEmptyBounds(lidBounds) && !isEmptyBounds(baseBounds)) {
      const delta = boundsCenter(lidBounds).map(
        (value, axis) => value - boundsCenter(baseBounds)[axis],
      );
      const dominant = delta.map(Math.abs).indexOf(Math.max(...delta.map(Math.abs)));
      if (dominant !== 1 || delta[1] <= 0) {
        findings.warning(
          'scene-not-upright',
          'Dimensions',
          'Le couvercle (Case_Lid) n’est pas au-dessus de la base (Case_Base) : le modèle semble couché ou retourné.',
          'À l’export, l’option « +Y Up » (Transform) doit rester cochée.',
        );
      }
    }
  }

  // Transformations ----------------------------------------------------------
  for (const entry of entries) {
    const { node } = entry;
    const scale = node.getScale();
    const mesh = node.getMesh();
    const quantizedWrapper =
      entry.name === '' && mesh !== null && node.listChildren().length === 0 && isQuantized(mesh);
    if (quantizedWrapper) continue;
    const label = quote(entry.name);
    if (scale.some((value) => value < 0)) {
      findings.error(
        'transform-negative-scale',
        'Transformations',
        `${label} a une échelle négative (effet miroir) : ses faces seraient retournées.`,
        'Appliquez l’échelle (Ctrl+A > Scale), puis recalculez les normales (Maj+N) si des faces paraissent noires.',
      );
    } else if (scale.some((value) => Math.abs(value - 1) > SCALE_TOLERANCE)) {
      const text = scale.map((value) => decimalFormat.format(value)).join(' × ');
      if (mesh && isQuantized(mesh) && isNodeName(entry.name)) {
        findings.warning(
          'transform-quantized-scale',
          'Transformations',
          `${label} a une échelle de ${text}, sans doute ajoutée par un autre outil de compression.`,
          'Repartez du fichier exporté de Blender et utilisez npm run model:optimize.',
        );
      } else {
        findings.error(
          'transform-scale',
          'Transformations',
          `${label} a une échelle de ${text} : la transformation n’a pas été appliquée.`,
          'Dans Blender, sélectionnez tout (A) puis Ctrl+A > All Transforms, et réexportez.',
        );
      }
    }
    const angle = rotationAngleDegrees(node.getRotation());
    // Le rotor peut garder une rotation : il tourne autour de son propre axe.
    if (
      angle > ROTATION_TOLERANCE_DEGREES &&
      entry.name !== 'Fan_Rotor' &&
      (isNodeName(entry.name) || node.listChildren().length > 0)
    ) {
      findings.warning(
        'transform-rotation',
        'Transformations',
        `${label} garde une rotation de ${decimalFormat.format(angle)}° non appliquée.`,
        'Appliquez-la (Ctrl+A > Rotation), comme le demande le contrat : chaque pièce garde alors les axes de la scène.',
      );
    }
  }

  // Origines -----------------------------------------------------------------
  // Le site ne dépend de l'origine que pour le rotor, qui tourne autour
  // d'elle : ailleurs, une origine décalée est signalée sans bloquer.
  for (const entry of partEntries) {
    if (entry.name === 'Fan_Rotor') continue;
    const bounds = worldBounds(ownMeshes(entry.node));
    if (isEmptyBounds(bounds)) continue;
    const center = boundsCenter(bounds);
    const origin = transformPoint(entry.node.getWorldMatrix(), 0, 0, 0);
    const distance = Math.hypot(...origin.map((value, axis) => value - center[axis]));
    const tolerance = Math.max(
      ORIGIN_TOLERANCE.minMetres,
      ORIGIN_TOLERANCE.ratio * Math.max(...boundsSize(bounds)),
    );
    if (distance > tolerance) {
      findings.warning(
        'origin-offset',
        'Origines',
        `L’origine de ${quote(entry.name)} est à ${formatLength(distance)} du centre de sa géométrie (tolérance : ${formatLength(tolerance)}).`,
        'Dans Blender : Object > Set Origin > Origin to Geometry, puis « Center : Bounds Center » dans le panneau de l’opération.',
      );
    }
  }
  const rotorEntry = partEntries.find((entry) => entry.name === 'Fan_Rotor');
  if (rotorEntry) checkRotor(rotorEntry, context.rotorAxis ?? 'y', findings);

  // Mouvements ---------------------------------------------------------------
  const motions = context.config?.parts;
  if (typeof motions === 'object' && motions !== null && !Array.isArray(motions)) {
    checkMotions(partEntries, motions, findings);
  }

  // Triangles ----------------------------------------------------------------
  const perPart = new Map();
  let loose = 0;
  for (const entry of entries) {
    const mesh = entry.node.getMesh();
    if (!mesh) continue;
    const counts = countPrimitives(mesh);
    const copies = instanceCount(entry.node);
    summary.triangles += counts.triangles * copies;
    loose += counts.loose * copies;
    const owner = isNodeName(entry.name)
      ? entry.name
      : (entry.contractAncestor?.name ?? entry.name);
    perPart.set(owner, (perPart.get(owner) ?? 0) + counts.triangles * copies);
  }
  if (summary.triangles > MODEL_LIMITS.maxTriangles) {
    const heaviest = [...perPart.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${quote(name)} ${numberFormat.format(count)}`)
      .join(', ');
    findings.error(
      'triangles',
      'Géométrie',
      `Le modèle compte ${numberFormat.format(summary.triangles)} triangles (limite : ${numberFormat.format(MODEL_LIMITS.maxTriangles)}).`,
      `Simplifiez les pièces les plus détaillées (modificateur Decimate) : ${heaviest}.`,
    );
  }
  if (loose > 0) {
    findings.warning(
      'loose-geometry',
      'Géométrie',
      `Le modèle contient ${plural(loose, 'segment ou point isolé', 'segments ou points isolés')}.`,
      'À l’export, décochez « Loose Edges » et « Loose Points » (Data > Mesh).',
    );
  }
  for (const entry of entries) {
    const mesh = entry.node.getMesh();
    if (!mesh) continue;
    if (
      entry.node.getSkin() ||
      mesh.listPrimitives().some((primitive) => primitive.listTargets().length > 0)
    ) {
      findings.warning(
        'mesh-deform',
        'Géométrie',
        `${quote(entry.name)} contient une armature ou des clés de forme, inutilisées par le site.`,
        'Appliquez-les ou supprimez-les avant l’export.',
      );
    }
  }

  // Matériaux ----------------------------------------------------------------
  const sceneMaterials = new Set();
  const withoutMaterial = new Set();
  for (const entry of entries) {
    const mesh = entry.node.getMesh();
    if (!mesh) continue;
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial();
      if (material) sceneMaterials.add(material);
      else withoutMaterial.add(entry.contractAncestor?.name ?? entry.name);
    }
  }
  for (const name of withoutMaterial) {
    findings.warning(
      'material-missing',
      'Matériaux',
      `${quote(name)} n’a pas de matériau : il s’affichera en blanc uni.`,
      'Assignez-lui un matériau Principled BSDF.',
    );
  }
  for (const material of sceneMaterials) {
    const label = quote(material.getName());
    if (material.getExtension('KHR_materials_unlit')) {
      findings.error(
        'material-unlit',
        'Matériaux',
        `Le matériau ${label} est « sans éclairage » (KHR_materials_unlit) : il ne réagirait pas à la lumière de la scène.`,
        'Utilisez un nœud Principled BSDF branché directement sur la sortie du matériau.',
      );
    }
    for (const [extension, description] of Object.entries(COSTLY_MATERIAL_EXTENSIONS)) {
      if (material.getExtension(extension)) {
        findings.warning(
          'material-costly',
          'Matériaux',
          `Le matériau ${label} utilise une ${description} : affichage lent sur téléphone.`,
          'Préférez un matériau opaque, ou une transparence simple (Alpha).',
        );
      }
    }
  }

  // Textures -----------------------------------------------------------------
  const imageUris = (json.images ?? []).map((image) => image?.uri).filter(Boolean);
  for (const uri of imageUris) {
    if (!String(uri).startsWith('data:')) {
      findings.error(
        'texture-external',
        'Textures',
        `L’image « ${uri} » est un fichier à part : le .glb doit tout contenir.`,
        'À l’export, choisissez Format > glTF Binary (.glb).',
      );
    }
  }
  for (const texture of root.listTextures()) {
    const label = quote(texture.getName() || texture.getURI());
    const mimeType = texture.getMimeType();
    const image = texture.getImage();
    const size = image ? ImageUtils.getSize(image, mimeType) : null;
    const slots = listTextureSlots(texture);
    if (slots.length === 0) {
      findings.add(
        isSource ? 'info' : 'warning',
        'texture-unused',
        'Textures',
        `La texture ${label} n’est utilisée par aucun matériau.`,
        isSource ? 'npm run model:optimize la retire.' : 'Décochez « Unused images » à l’export.',
      );
      continue;
    }
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(mimeType)) {
      findings.error(
        'texture-format',
        'Textures',
        `La texture ${label} est au format ${mimeType || 'inconnu'}, que le site ne lit pas.`,
        'Utilisez des images PNG ou JPEG dans Blender.',
      );
      continue;
    }
    if (!size) {
      findings.error('texture-unreadable', 'Textures', `La texture ${label} est illisible.`);
      continue;
    }
    const [width, height] = size;
    summary.textures.push({ name: texture.getName(), width, height, mimeType });
    if (Math.max(width, height) > MODEL_LIMITS.maxTextureSize) {
      findings.add(
        isSource ? 'info' : 'error',
        'texture-size',
        'Textures',
        `La texture ${label} mesure ${width} × ${height} px (limite : ${MODEL_LIMITS.maxTextureSize} px).`,
        isSource
          ? `npm run model:optimize la réduira à ${MODEL_LIMITS.maxTextureSize} px.`
          : 'Lancez npm run model:optimize, qui réduit les textures, ou réduisez l’image dans Blender.',
      );
    }
  }

  // Lampes, caméras, animations ----------------------------------------------
  const lights = entries.filter((entry) => entry.node.getExtension('KHR_lights_punctual'));
  if (lights.length > 0) {
    findings.add(
      isSource ? 'info' : 'error',
      'lights',
      'Fichier',
      `Le fichier contient ${plural(lights.length, 'lampe')} (${lights.map((entry) => quote(entry.name)).join(', ')}) : ${lights.length > 1 ? 'elles s’ajouteraient' : 'elle s’ajouterait'} à l’éclairage du site.`,
      isSource
        ? 'npm run model:optimize les retire.'
        : 'À l’export, décochez « Punctual Lights » (Include), ou passez par npm run model:optimize.',
    );
  }
  const cameras = entries.filter((entry) => entry.node.getCamera());
  if (cameras.length > 0) {
    findings.add(
      isSource ? 'info' : 'warning',
      'cameras',
      'Fichier',
      `Le fichier contient ${plural(cameras.length, 'caméra')}, inutilisées par le site.`,
      isSource
        ? 'npm run model:optimize les retire.'
        : 'À l’export, décochez « Cameras » (Include).',
    );
  }
  const animations = root.listAnimations();
  if (animations.length > 0) {
    findings.warning(
      'animations',
      'Fichier',
      `Le fichier contient ${plural(animations.length, 'animation')} : le site anime la box lui-même et ne les lit pas.`,
      'À l’export, décochez « Animation » pour alléger le fichier.',
    );
  }

  // Poids --------------------------------------------------------------------
  if (summary.fileBytes !== null) {
    if (summary.fileBytes > MODEL_LIMITS.maxFileBytes) {
      findings.add(
        isSource ? 'info' : 'warning',
        'file-size',
        'Fichier',
        `Le fichier pèse ${formatBytes(summary.fileBytes)}, au-delà des ${formatBytes(MODEL_LIMITS.maxFileBytes)} visés.`,
        isSource
          ? 'npm run model:optimize va le compresser.'
          : 'Réduisez les textures (1024 px suffisent souvent) ou le nombre de triangles : le modèle s’affichera plus vite sur téléphone.',
      );
    }
    if (!isSource && !summary.optimized) {
      findings.warning(
        'not-optimized',
        'Fichier',
        'Le fichier n’a pas été optimisé : il n’est pas passé par npm run model:optimize.',
        'Lancez npm run model:optimize, qui écrit public/models/hako.glb.',
      );
    }
  }
  if (!isSource && summary.meshopt) {
    findings.warning(
      'meshopt-csp',
      'Fichier',
      // Mots-clés CSP avec de vraies apostrophes droites : ils doivent pouvoir être recopiés tels quels.
      "Le fichier est compressé avec meshopt (option --meshopt) : le navigateur doit exécuter un décodeur WebAssembly, que la politique de sécurité prévue pour le site (CSP « default-src 'self' ») bloque. Le site afficherait alors le modèle provisoire.",
      "Relancez npm run model:optimize sans --meshopt, ou ajoutez « 'wasm-unsafe-eval' » à script-src dans la CSP du site (docs/hebergement.md, « La scène 3D »).",
    );
  }

  // Réglages -----------------------------------------------------------------
  if (context.config !== undefined && context.config !== null) {
    findings.list.push(...checkModelConfig(context.config, { present }));
  }

  return { findings: findings.list, summary };
}

function isAncestor(ancestor, entry) {
  for (let current = entry.parent; current; current = current.parent) {
    if (current === ancestor) return true;
  }
  return false;
}

/** Produit de deux matrices 4 × 4 (ordre glTF, par colonnes). */
function multiplyMatrices(a, b) {
  const out = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

/**
 * Géométrie du rotor dans le repère où il tourne : le site multiplie sa
 * rotation de repos par un tour autour de rotor.axis, donc autour de son
 * origine, après son échelle.
 */
function spinFrameMeshes(node) {
  const [sx, sy, sz] = node.getScale();
  const items = [];
  const visit = (current, matrix) => {
    const mesh = current.getMesh();
    if (mesh) items.push({ mesh, matrix, node: current });
    for (const child of current.listChildren()) {
      if (child.getName() === '') visit(child, multiplyMatrices(matrix, child.getMatrix()));
    }
  };
  visit(node, [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1]);
  return items;
}

/**
 * Le rotor doit être rond autour de son axe de rotation, et cet axe doit
 * passer par son origine. Le centre de la boîte englobante d'un rotor à
 * nombre impair de pales s'écarte un peu de l'axe : d'où deux seuils.
 */
function checkRotor(entry, axisName, findings) {
  const bounds = worldBounds(spinFrameMeshes(entry.node));
  if (isEmptyBounds(bounds)) return;
  const axis = { x: 0, y: 1, z: 2 }[axisName];
  const across = [0, 1, 2].filter((index) => index !== axis);
  const size = boundsSize(bounds);
  const center = boundsCenter(bounds);
  const widths = across.map((index) => size[index]);
  const largest = Math.max(...widths);
  const offAxis = Math.hypot(...across.map((index) => center[index]));
  const hardLimit = Math.max(ROTOR_TOLERANCE.minMetres, ROTOR_TOLERANCE.errorRatio * largest);
  const softLimit = Math.max(ROTOR_TOLERANCE.minMetres / 2, ROTOR_TOLERANCE.warningRatio * largest);
  const hint =
    'Placez l’origine au centre du moyeu : en mode Édition, sélectionnez le moyeu, Maj+S > Cursor to Selected ; puis en mode Objet, Object > Set Origin > Origin to 3D Cursor.';
  if (offAxis > hardLimit) {
    findings.error(
      'rotor-off-axis',
      'Origines',
      `L’origine de « Fan_Rotor » est à ${formatLength(offAxis)} du centre de ses pales : il tournerait de travers.`,
      hint,
    );
  } else if (offAxis > softLimit) {
    findings.warning(
      'rotor-off-axis',
      'Origines',
      `L’origine de « Fan_Rotor » est à ${formatLength(offAxis)} du centre de ses pales : vérifiez qu’elle est bien sur l’axe.`,
      hint,
    );
  }
  if (Math.min(...widths) < 0.7 * largest) {
    findings.warning(
      'rotor-axis',
      'Origines',
      `Le rotor n’est pas rond vu le long de l’axe ${axisName} : ce n’est sans doute pas son axe de rotation.`,
      `Vérifiez « rotor.axis » (x, y ou z, dans le repère du rotor) dans ${MODEL_CONFIG}.`,
    );
  }
}

/** Réglage de mouvement suivi par une pièce : le sien, sinon celui de la pièce qui la porte. */
function effectiveMotion(entry, motions) {
  for (let current = entry; current; current = current.parent) {
    if (current.name !== '' && Object.hasOwn(motions, current.name)) {
      const motion = motions[current.name];
      if (typeof motion === 'object' && motion !== null) return motion;
    }
  }
  return null;
}

function isStatic(motion) {
  return (
    motion === null || !Array.isArray(motion.offset) || motion.offset.every((value) => value === 0)
  );
}

function sameMotion(a, b) {
  if (isStatic(a) || isStatic(b)) return isStatic(a) && isStatic(b);
  return (
    a.offset.length === b.offset.length &&
    a.offset.every((value, index) => Math.abs(value - b.offset[index]) < 1e-9) &&
    a.delay === b.delay &&
    a.duration === b.duration &&
    a.ease === b.ease
  );
}

/** Distance d'un point à une boîte englobante (0 à l'intérieur). */
function distanceToBounds(point, bounds) {
  return Math.hypot(
    ...point.map((value, axis) => Math.max(bounds.min[axis] - value, 0, value - bounds.max[axis])),
  );
}

/**
 * Le rotor doit suivre le ventilateur, et le marquage la pièce qui le porte :
 * sinon ils se détachent pendant l'ouverture.
 */
function checkMotions(partEntries, motions, findings) {
  const byName = (name) => partEntries.find((entry) => entry.name === name);
  const rotor = byName('Fan_Rotor');
  const fan = byName('Fan');
  if (rotor && fan && !sameMotion(effectiveMotion(rotor, motions), effectiveMotion(fan, motions))) {
    findings.warning(
      'motion-rotor',
      'Réglages',
      '« Fan_Rotor » ne bougera pas avec « Fan » pendant l’ouverture.',
      `Rangez Fan_Rotor sous Fan dans Blender (Ctrl+P), ou recopiez parts.Fan dans parts.Fan_Rotor (${MODEL_CONFIG}).`,
    );
  }
  const decal = byName('Logo_Decal');
  if (!decal) return;
  let host = decal.contractAncestor;
  if (!host) {
    const decalBounds = worldBounds(ownMeshes(decal.node));
    if (isEmptyBounds(decalBounds)) return;
    const point = boundsCenter(decalBounds);
    let best = Infinity;
    for (const entry of partEntries) {
      if (entry.name === 'Logo_Decal' || entry.name === 'Fan_Rotor') continue;
      const bounds = worldBounds(ownMeshes(entry.node));
      if (isEmptyBounds(bounds)) continue;
      const distance = distanceToBounds(point, bounds);
      if (distance < best) {
        best = distance;
        host = entry;
      }
    }
  }
  if (host && !sameMotion(effectiveMotion(decal, motions), effectiveMotion(host, motions))) {
    findings.warning(
      'motion-decal',
      'Réglages',
      `Le marquage (« Logo_Decal ») ne bougera pas avec ${quote(host.name)}, sur lequel il est posé.`,
      `Rangez Logo_Decal sous ${host.name} dans Blender (Ctrl+P), ou donnez-lui le même réglage dans ${MODEL_CONFIG} (parts).`,
    );
  }
}

/**
 * Contrôle le contenu d'un fichier .glb déjà en mémoire. Renvoie aussi le
 * document lu (undefined si le fichier est illisible).
 * @param {Uint8Array} bytes
 * @param {{ file?: string, stage?: 'source' | 'final', root?: string, io?: NodeIO, config?: any }} [options]
 *   config : contenu de model.config.json à utiliser à la place du fichier
 *   du dépôt (null : aucun réglage)
 */
export async function checkBytes(bytes, options = {}) {
  const stage = options.stage ?? 'final';
  const file = options.file ?? '';
  let configFile = null;
  if (options.config === undefined) configFile = readModelConfig(options.root ?? repoRoot);
  else if (options.config !== null) configFile = { file: MODEL_CONFIG, data: options.config };
  const header = readGlbJson(bytes);
  const base = { file, stage, configFile };
  if ('problem' in header) {
    return {
      ...base,
      findings: [
        {
          level: 'error',
          code: 'file-format',
          topic: 'Fichier',
          message: header.problem,
          hint: 'À l’export depuis Blender, choisissez Format > glTF Binary (.glb).',
        },
      ],
      summary: { stage, fileBytes: bytes.byteLength, present: [], triangles: 0, textures: [] },
    };
  }
  const io = options.io ?? (await createIO());
  let document;
  try {
    document = await io.readBinary(bytes);
  } catch (error) {
    const required = header.json.extensionsRequired ?? [];
    const blocking = required.filter((name) => !SITE_EXTENSIONS.has(name));
    return {
      ...base,
      findings: [
        {
          level: 'error',
          code: 'file-unreadable',
          topic: 'Fichier',
          message: blocking.length
            ? `Le fichier exige ${blocking.join(', ')}, que nos outils ne savent pas lire.`
            : `Le fichier est illisible : ${error instanceof Error ? error.message : String(error)}`,
          hint:
            blocking.map((name) => EXTENSION_HINTS[name]).find(Boolean) ??
            'Réexportez le modèle depuis Blender (Format : glTF Binary).',
        },
      ],
      summary: { stage, fileBytes: bytes.byteLength, present: [], triangles: 0, textures: [] },
    };
  }
  const config = configFile && 'data' in configFile ? configFile.data : null;
  const rotorAxis = ['x', 'y', 'z'].includes(config?.rotor?.axis) ? config.rotor.axis : 'y';
  const result = checkDocument(document, {
    stage,
    fileBytes: bytes.byteLength,
    json: header.json,
    config,
    rotorAxis,
  });
  if (configFile && 'problem' in configFile) {
    result.findings.push({
      level: 'error',
      code: 'config-invalid',
      topic: 'Réglages',
      message: `${MODEL_CONFIG} : ${configFile.problem}`,
    });
  }
  return { ...base, ...result, document };
}

/**
 * Lit puis contrôle un fichier .glb.
 * @param {string} file
 * @param {{ stage?: 'source' | 'final', root?: string, io?: NodeIO, config?: any }} [options]
 */
export async function checkFile(file, options = {}) {
  return checkBytes(new Uint8Array(readFileSync(file)), { ...options, file });
}

// ---------------------------------------------------------------------------
// Affichage

const LEVEL_LABELS = { error: 'ERREUR', warning: 'ATTENTION', info: 'INFO' };
const LEVEL_ORDER = ['error', 'warning', 'info'];

/**
 * Rapport lisible, ligne par ligne.
 * @param {{ file: string, findings: Finding[], summary: any }} result
 * @param {{ root?: string }} [options]
 */
export function formatReport(result, options = {}) {
  const root = options.root ?? repoRoot;
  const { summary } = result;
  const lines = [];
  const relative = path.relative(root, result.file) || result.file;
  const stageLabel = summary.stage === 'source' ? ' (fichier source, avant optimisation)' : '';
  lines.push(`Contrôle du modèle 3D : ${relative}${stageLabel}`);
  const facts = [];
  if (summary.fileBytes !== null && summary.fileBytes !== undefined) {
    facts.push(`poids ${formatBytes(summary.fileBytes)}`);
  }
  if (summary.generator) facts.push(`exporté par ${summary.generator}`);
  if (facts.length > 0) lines.push(`  ${facts.join(' · ')}`);
  if (summary.sizeMetres) {
    const [x, y, z] = summary.sizeMetres.map((value) => formatLength(value));
    lines.push(`  Dimensions : ${x} (X) × ${y} (Y, hauteur) × ${z} (Z)`);
  }
  if (summary.triangles > 0) {
    lines.push(
      `  Triangles : ${numberFormat.format(summary.triangles)} (limite ${numberFormat.format(MODEL_LIMITS.maxTriangles)})`,
    );
  }
  if (summary.textures?.length > 0) {
    const list = summary.textures
      .map(
        (texture) =>
          `${texture.width} × ${texture.height} px ${texture.mimeType.replace('image/', '')}`,
      )
      .join(', ');
    lines.push(`  Textures : ${list}`);
  }
  if (summary.present?.length > 0) {
    lines.push(`  Pièces trouvées : ${(summary.hierarchy ?? summary.present).join(', ')}`);
  }
  lines.push('');

  const sorted = [...result.findings].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level),
  );
  for (const finding of sorted) {
    const label = LEVEL_LABELS[finding.level].padEnd(10);
    lines.push(`${label}${finding.topic} : ${finding.message}`);
    if (finding.hint) lines.push(`${' '.repeat(10)}→ ${finding.hint}`);
  }
  if (sorted.length > 0) lines.push('');

  const errors = result.findings.filter((finding) => finding.level === 'error').length;
  const warnings = result.findings.filter((finding) => finding.level === 'warning').length;
  if (errors > 0) {
    lines.push(
      `Résultat : ${plural(errors, 'erreur')}, ${plural(warnings, 'avertissement')}. Le modèle ne peut pas être utilisé tel quel.`,
    );
  } else if (warnings > 0) {
    lines.push(`Résultat : conforme au contrat, avec ${plural(warnings, 'avertissement')}.`);
  } else {
    lines.push('Résultat : conforme au contrat.');
  }
  return lines;
}

export function countErrors(findings) {
  return findings.filter((finding) => finding.level === 'error').length;
}

// ---------------------------------------------------------------------------
// Ligne de commande

/**
 * @param {string[]} argv arguments après le nom du script
 * @param {{ root?: string, log?: (line: string) => void }} [options]
 * @returns {Promise<number>} code de sortie
 */
export async function main(argv, options = {}) {
  const root = options.root ?? repoRoot;
  const log = options.log ?? ((line) => console.log(line));
  const flags = argv.filter((arg) => arg.startsWith('--'));
  const paths = argv.filter((arg) => !arg.startsWith('--'));
  const unknown = flags.filter((flag) => flag !== '--source');
  if (unknown.length > 0 || paths.length > 1) {
    log(
      unknown.length > 0
        ? `Option inconnue : ${unknown.join(' ')}. Seule l’option --source existe.`
        : 'Un seul fichier à la fois : npm run model:check [chemin/vers/modele.glb]',
    );
    return 2;
  }
  const stage = flags.includes('--source') ? 'source' : 'final';

  if (paths.length === 0 && !existsSync(path.join(root, DEFAULT_MODEL))) {
    log(`Aucun modèle dans ${DEFAULT_MODEL} : le site affiche le modèle dessiné en code.`);
    log('Pour utiliser le modèle de Blender, suivez docs/model-contract.md.');
    const configFile = readModelConfig(root);
    if (!configFile) return 0;
    const findings =
      'problem' in configFile
        ? [
            {
              level: 'error',
              code: 'config-invalid',
              topic: 'Réglages',
              message: `${MODEL_CONFIG} : ${configFile.problem}`,
            },
          ]
        : checkModelConfig(configFile.data);
    const problems = findings.filter((finding) => finding.level !== 'info');
    if (problems.length === 0) {
      log(`${MODEL_CONFIG} : les noms de pièces correspondent au contrat.`);
      return 0;
    }
    log('');
    for (const finding of problems) {
      log(`${LEVEL_LABELS[finding.level].padEnd(10)}${finding.topic} : ${finding.message}`);
      if (finding.hint) log(`${' '.repeat(10)}→ ${finding.hint}`);
    }
    return countErrors(findings) > 0 ? 1 : 0;
  }

  const file = path.resolve(paths[0] ? process.cwd() : root, paths[0] ?? DEFAULT_MODEL);
  if (!existsSync(file) || !statSync(file).isFile()) {
    log(`Fichier introuvable : ${paths[0]}`);
    return 1;
  }
  const result = await checkFile(file, { stage, root });
  for (const line of formatReport(result, { root })) log(line);
  return countErrors(result.findings) > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
