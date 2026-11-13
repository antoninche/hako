/**
 * Réglages de la scène 3D : types et vérification de src/data/model.config.json.
 *
 * Le fichier JSON est vérifié deux fois : à la construction du site (par
 * BoxScene.astro, une erreur fait échouer `npm run build`) et dans le
 * navigateur avant d'animer la scène (une erreur affiche alors l'image fixe).
 */
import { isNodeName, type NodeName } from './contract';

export const EASING_NAMES = [
  'linear',
  'inQuad',
  'outQuad',
  'inOutQuad',
  'inCubic',
  'outCubic',
  'inOutCubic',
  'inSine',
  'outSine',
  'inOutSine',
  'outQuart',
  'inOutQuart',
] as const;

export type EasingName = (typeof EASING_NAMES)[number];

export type Vec3 = readonly [number, number, number];

/** Une clé d'animation : à la progression `at`, la valeur vaut `value`. */
export interface Keyframe {
  readonly at: number;
  readonly value: number;
  /** Courbe du segment qui ARRIVE sur cette clé (linéaire par défaut). */
  readonly ease?: EasingName;
}

export type Track = readonly Keyframe[];

/** Déplacement d'une pièce dans la vue éclatée. */
export interface PartMotion {
  /** Décalage en mètres, dans le repère du modèle (y vers le haut). */
  readonly offset: Vec3;
  /** Début et durée du mouvement, en fraction de l'ouverture (0 à 1). */
  readonly delay: number;
  readonly duration: number;
  readonly ease: EasingName;
}

export interface PartLabel {
  readonly title: string;
  readonly detail?: string;
}

/** Textes de la section affichés hors de la scène (image fixe et liste des pièces). */
export interface SceneCopy {
  /** Texte de remplacement de l'image fixe de la vue éclatée. */
  readonly imageAlt: string;
  /** Titre de la liste des pièces. */
  readonly partsHeading: string;
}

export interface ModelConfig {
  readonly copy: SceneCopy;
  /** Pièces étiquetées, de haut en bas (ordre des étiquettes et de la liste). */
  readonly order: readonly NodeName[];
  readonly labels: Readonly<Partial<Record<NodeName, PartLabel>>>;
  readonly parts: Readonly<Partial<Record<NodeName, PartMotion>>>;
  readonly rotor: { readonly axis: 'x' | 'y' | 'z'; readonly turnsPerSecond: number };
  readonly timeline: {
    /** Rotation de la box autour de l'axe vertical. */
    readonly rotationY: Track;
    /** Ouverture : 0 fermée, 1 vue éclatée. */
    readonly explode: Track;
    /** Opacité des étiquettes. */
    readonly labels: Track;
    /** Hauteur du regard : angle de la caméra au-dessus de l'horizon. */
    readonly elevation: Track;
  };
  /** Décalage d'apparition entre deux étiquettes (fraction de la piste labels). */
  readonly labelStagger: number;
  /**
   * Lissage du défilement : temps de réponse en secondes (amortissement
   * critique) et retard maximal sur la position réelle (fraction de la piste).
   */
  readonly smoothing: { readonly smoothTime: number; readonly maxLag: number };
  readonly camera: {
    readonly fov: number;
    readonly margin: number;
    /** Hauteur minimale cadrée (m) : la box fermée ne remplit pas tout l'écran. */
    readonly minFrame: number;
    /** Part de la largeur gardée pour les étiquettes, écran étroit / large. */
    readonly labelSpace: { readonly narrow: number; readonly wide: number };
  };
  /** Écran en hauteur (téléphone) : écartement des pièces multiplié par ce facteur. */
  readonly portraitSpread: number;
  readonly procedural: {
    readonly todo?: string;
    readonly case: {
      readonly width: number;
      readonly depth: number;
      readonly lidHeight: number;
      readonly wall: number;
      readonly cornerRadius: number;
      readonly color: string;
    };
    readonly logo: { readonly width: number };
  };
}

class ConfigError extends Error {
  constructor(path: string, expected: string) {
    super(`model.config.json : « ${path} » devrait être ${expected}.`);
    this.name = 'ConfigError';
  }
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function obj(value: unknown, path: string): Json {
  if (!isObject(value)) throw new ConfigError(path, 'un objet');
  return value;
}

function num(value: unknown, path: string, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new ConfigError(path, `un nombre entre ${min} et ${max}`);
  }
  return value;
}

function str(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ConfigError(path, 'un texte non vide');
  }
  return value;
}

function node(value: unknown, path: string): NodeName {
  if (typeof value !== 'string' || !isNodeName(value)) {
    throw new ConfigError(path, 'un nom de pièce du contrat (voir contract.ts)');
  }
  return value;
}

function ease(value: unknown, path: string): EasingName {
  if (typeof value !== 'string' || !(EASING_NAMES as readonly string[]).includes(value)) {
    throw new ConfigError(path, `une courbe parmi ${EASING_NAMES.join(', ')}`);
  }
  return value as EasingName;
}

function vec3(value: unknown, path: string): Vec3 {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new ConfigError(path, 'un tableau de trois nombres [x, y, z]');
  }
  return [num(value[0], `${path}[0]`), num(value[1], `${path}[1]`), num(value[2], `${path}[2]`)];
}

function color(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new ConfigError(path, 'une couleur au format #RRGGBB');
  }
  return value;
}

function track(value: unknown, path: string): Track {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ConfigError(path, 'une liste de clés { at, value, ease? }');
  }
  let previous = -Infinity;
  return value.map((raw, index) => {
    const key = obj(raw, `${path}[${index}]`);
    const at = num(key.at, `${path}[${index}].at`, 0, 1);
    if (at < previous) throw new ConfigError(`${path}[${index}].at`, 'croissant');
    previous = at;
    const frame: Keyframe = { at, value: num(key.value, `${path}[${index}].value`) };
    return key.ease === undefined
      ? frame
      : { ...frame, ease: ease(key.ease, `${path}[${index}].ease`) };
  });
}

/** Vérifie le JSON et renvoie la configuration typée ; lève une erreur explicite sinon. */
export function parseModelConfig(raw: unknown): ModelConfig {
  const root = obj(raw, 'racine');
  const copy = obj(root.copy, 'copy');

  if (!Array.isArray(root.order) || root.order.length === 0) {
    throw new ConfigError('order', 'une liste de pièces');
  }
  const order = root.order.map((value, index) => node(value, `order[${index}]`));

  const labelsRaw = obj(root.labels, 'labels');
  const labels: Partial<Record<NodeName, PartLabel>> = {};
  for (const [key, value] of Object.entries(labelsRaw)) {
    const name = node(key, `labels.${key}`);
    const label = obj(value, `labels.${key}`);
    labels[name] =
      label.detail === undefined
        ? { title: str(label.title, `labels.${key}.title`) }
        : {
            title: str(label.title, `labels.${key}.title`),
            detail: str(label.detail, `labels.${key}.detail`),
          };
  }
  for (const name of order) {
    if (!labels[name]) throw new ConfigError(`labels.${name}`, 'défini (pièce listée dans order)');
  }

  const partsRaw = obj(root.parts, 'parts');
  const parts: Partial<Record<NodeName, PartMotion>> = {};
  for (const [key, value] of Object.entries(partsRaw)) {
    const name = node(key, `parts.${key}`);
    const part = obj(value, `parts.${key}`);
    const delay = num(part.delay, `parts.${key}.delay`, 0, 1);
    const duration = num(part.duration, `parts.${key}.duration`, 0.01, 1);
    if (delay + duration > 1.0001) {
      throw new ConfigError(`parts.${key}`, 'tel que delay + duration ≤ 1');
    }
    parts[name] = {
      offset: vec3(part.offset, `parts.${key}.offset`),
      delay,
      duration,
      ease: ease(part.ease, `parts.${key}.ease`),
    };
  }

  const rotor = obj(root.rotor, 'rotor');
  const axis = rotor.axis;
  if (axis !== 'x' && axis !== 'y' && axis !== 'z')
    throw new ConfigError('rotor.axis', 'x, y ou z');

  const timeline = obj(root.timeline, 'timeline');
  const camera = obj(root.camera, 'camera');
  const labelSpace = obj(camera.labelSpace, 'camera.labelSpace');
  const smoothing = obj(root.smoothing, 'smoothing');
  const procedural = obj(root.procedural, 'procedural');
  const caseRaw = obj(procedural.case, 'procedural.case');
  const logo = obj(procedural.logo, 'procedural.logo');

  const config: ModelConfig = {
    copy: {
      imageAlt: str(copy.imageAlt, 'copy.imageAlt'),
      partsHeading: str(copy.partsHeading, 'copy.partsHeading'),
    },
    order,
    labels,
    parts,
    rotor: { axis, turnsPerSecond: num(rotor.turnsPerSecond, 'rotor.turnsPerSecond', 0, 5) },
    timeline: {
      rotationY: track(timeline.rotationY, 'timeline.rotationY'),
      explode: track(timeline.explode, 'timeline.explode'),
      labels: track(timeline.labels, 'timeline.labels'),
      elevation: track(timeline.elevation, 'timeline.elevation'),
    },
    labelStagger: num(root.labelStagger, 'labelStagger', 0, 0.2),
    smoothing: {
      smoothTime: num(smoothing.smoothTime, 'smoothing.smoothTime', 0.01, 2),
      maxLag: num(smoothing.maxLag, 'smoothing.maxLag', 0.01, 1),
    },
    camera: {
      fov: num(camera.fov, 'camera.fov', 10, 90),
      margin: num(camera.margin, 'camera.margin', 1, 3),
      minFrame: num(camera.minFrame, 'camera.minFrame', 0.01, 1),
      labelSpace: {
        narrow: num(labelSpace.narrow, 'camera.labelSpace.narrow', 0, 0.7),
        wide: num(labelSpace.wide, 'camera.labelSpace.wide', 0, 0.7),
      },
    },
    portraitSpread: num(root.portraitSpread, 'portraitSpread', 1, 2),
    procedural: {
      ...(typeof procedural.todo === 'string' ? { todo: procedural.todo } : {}),
      case: {
        width: num(caseRaw.width, 'procedural.case.width', 0.09, 0.3),
        depth: num(caseRaw.depth, 'procedural.case.depth', 0.062, 0.3),
        lidHeight: num(caseRaw.lidHeight, 'procedural.case.lidHeight', 0.005, 0.2),
        wall: num(caseRaw.wall, 'procedural.case.wall', 0.001, 0.01),
        cornerRadius: num(caseRaw.cornerRadius, 'procedural.case.cornerRadius', 0.001, 0.03),
        color: color(caseRaw.color, 'procedural.case.color'),
      },
      logo: {
        width: num(logo.width, 'procedural.logo.width', 0.01, 0.2),
      },
    },
  };
  return config;
}
