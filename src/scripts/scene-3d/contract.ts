/**
 * Contrat du modèle 3D de la box (voir docs/model-contract.md).
 *
 * Le fichier exporté depuis Blender, public/models/hako.glb, doit contenir
 * ces objets, nommés exactement ainsi. Le modèle provisoire dessiné en code
 * utilise les mêmes noms : la scène fonctionne avec l'un ou l'autre.
 */

/** Objets obligatoires. */
export const REQUIRED_NODES = [
  'Case_Base',
  'Case_Lid',
  'Fan',
  'NVMe_Board',
  'NVMe_SSD',
  'RPi5_Board',
] as const;

/** Objets facultatifs : le rotor du ventilateur (qui tourne) et le logo. */
export const OPTIONAL_NODES = ['Fan_Rotor', 'Logo_Decal'] as const;

export type RequiredNode = (typeof REQUIRED_NODES)[number];
export type OptionalNode = (typeof OPTIONAL_NODES)[number];
export type NodeName = RequiredNode | OptionalNode;

export const ALL_NODES: readonly NodeName[] = [...REQUIRED_NODES, ...OPTIONAL_NODES];

/** Adresse du modèle réel, une fois exporté et optimisé. */
export const MODEL_URL = '/models/hako.glb';

/** Limites à respecter par le modèle réel. */
export const MODEL_LIMITS = {
  maxTriangles: 100_000,
  maxTextureSize: 2048,
  /** Poids visé après `npm run model:optimize`. */
  maxFileBytes: 2 * 1024 * 1024,
} as const;

export function isNodeName(value: string): value is NodeName {
  return (ALL_NODES as readonly string[]).includes(value);
}

/**
 * Taille hors tout attendue (plus grande dimension du modèle), en mètres.
 * En dehors, le modèle a presque toujours été exporté dans une autre unité.
 */
export const MODEL_SIZE_RANGE = {
  minMetres: 0.03,
  maxMetres: 0.5,
} as const;

export function isRequiredNode(value: string): value is RequiredNode {
  return (REQUIRED_NODES as readonly string[]).includes(value);
}

/** Écart entre les noms d'objets trouvés dans un modèle et le contrat. */
export interface NodeNameReport {
  /** Objets obligatoires absents : le modèle ne peut pas être utilisé. */
  missing: RequiredNode[];
  /** Objets facultatifs absents. */
  missingOptional: OptionalNode[];
  /** Noms du contrat portés par plusieurs objets. */
  duplicated: NodeName[];
  /** Noms hors contrat, sans doublon, dans l'ordre de découverte. */
  unknown: string[];
}

/**
 * Compare une liste de noms d'objets (doublons compris) au contrat.
 * Les noms vides (objets sans nom) sont ignorés.
 */
export function compareNodeNames(names: Iterable<string>): NodeNameReport {
  const counts = new Map<string, number>();
  for (const name of names) {
    if (name === '') continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return {
    missing: REQUIRED_NODES.filter((name) => !counts.has(name)),
    missingOptional: OPTIONAL_NODES.filter((name) => !counts.has(name)),
    duplicated: ALL_NODES.filter((name) => (counts.get(name) ?? 0) > 1),
    unknown: [...counts.keys()].filter((name) => !isNodeName(name)),
  };
}
