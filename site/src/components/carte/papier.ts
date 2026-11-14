/**
 * « Papier découpé » : les bords coupés à la main de la carte, repris de la
 * série d’illustrations (design/illustrations/_source/papier.mjs).
 *
 * Un contour est redécoupé en segments presque droits, légèrement désaxés,
 * comme un trait de ciseaux. L’irrégularité vient d’un tirage pseudo-aléatoire
 * initialisé par un nom : le même nom donne toujours le même contour, donc
 * deux constructions du site produisent le même dessin.
 */

/** Point d’un contour : x, y et, à vrai, un point lissé (courbe) plutôt qu’un angle. */
export type Point = readonly [x: number, y: number, smooth?: boolean];

interface Node {
  x: number;
  y: number;
  smooth: boolean;
}

/** Tirage reproductible dans [0, 1[, initialisé par un texte (FNV-1a puis mulberry32). */
export function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  state >>>= 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Coupe aux ciseaux : chaque point bouge d’au plus jitter / 2, et les côtés
 * plus longs que deux fois `segment` sont redécoupés, avec des points
 * intermédiaires écartés d’au plus 0,6 × jitter de la ligne droite.
 */
function scissorCut(
  points: readonly Point[],
  random: () => number,
  jitter: number,
  segment: number,
): Node[] {
  const offset = (amplitude: number) => (random() * 2 - 1) * amplitude;
  const nodes: Node[] = [];
  points.forEach(([x0, y0, smooth = false], index) => {
    const [x1, y1] = points[(index + 1) % points.length]!;
    nodes.push({ x: x0 + offset(jitter / 2), y: y0 + offset(jitter / 2), smooth });
    const length = Math.hypot(x1 - x0, y1 - y0);
    const pieces = Math.floor(length / segment);
    if (pieces < 2) return;
    const nx = -(y1 - y0) / length;
    const ny = (x1 - x0) / length;
    for (let piece = 1; piece < pieces; piece++) {
      const t = (piece + offset(0.15)) / pieces;
      const away = offset(jitter * 0.6);
      nodes.push({
        x: x0 + (x1 - x0) * t + nx * away,
        y: y0 + (y1 - y0) * t + ny * away,
        smooth: false,
      });
    }
  });
  return nodes;
}

/**
 * Chemin SVG fermé : segments droits entre deux angles, courbes de
 * Catmull-Rom autour des points lissés. Les poignées ne dépassent pas le
 * tiers du segment : un arrondi reste un arrondi, sans petite boucle.
 */
function closedPath(nodes: readonly Node[]): string {
  const count = nodes.length;
  const at = (index: number) => nodes[(index + count) % count]!;
  const handle = (index: number, length: number) => {
    const before = at(index - 1);
    const after = at(index + 1);
    const hx = (after.x - before.x) / 6;
    const hy = (after.y - before.y) / 6;
    const size = Math.hypot(hx, hy);
    const limit = length / 3;
    return size > limit ? { x: (hx * limit) / size, y: (hy * limit) / size } : { x: hx, y: hy };
  };
  const first = at(0);
  let path = `M${round(first.x)} ${round(first.y)}`;
  for (let index = 0; index < count; index++) {
    const a = at(index);
    const b = at(index + 1);
    if (!a.smooth && !b.smooth) {
      path += `L${round(b.x)} ${round(b.y)}`;
      continue;
    }
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const ha = a.smooth ? handle(index, length) : { x: 0, y: 0 };
    const hb = b.smooth ? handle(index + 1, length) : { x: 0, y: 0 };
    path += `C${round(a.x + ha.x)} ${round(a.y + ha.y)} ${round(b.x - hb.x)} ${round(b.y - hb.y)} ${round(b.x)} ${round(b.y)}`;
  }
  return `${path}Z`;
}

/** Contour fermé coupé à la main, en chemin SVG. */
export function paperCut(
  points: readonly Point[],
  { seed, jitter, segment }: { seed: string; jitter: number; segment: number },
): string {
  return closedPath(scissorCut(points, seededRandom(seed), jitter, segment));
}

/** Points d’un rectangle aux coins arrondis (quatre arcs lissés). */
export function roundedRectPoints(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): Point[] {
  const corners: [number, number, number][] = [
    [x + radius, y + radius, Math.PI],
    [x + width - radius, y + radius, -Math.PI / 2],
    [x + width - radius, y + height - radius, 0],
    [x + radius, y + height - radius, Math.PI / 2],
  ];
  return corners.flatMap(([cx, cy, start]) =>
    [0, 1, 2, 3, 4].map((step): Point => {
      const angle = start + (step / 4) * (Math.PI / 2);
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), true];
    }),
  );
}
