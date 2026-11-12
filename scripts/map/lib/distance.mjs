// Lignes d'eau : courbes qui suivent la côte en mer à distance constante,
// comme sur les cartes gravées. Méthode : on trace les terres sur une grille
// (une case par unité SVG), on calcule pour chaque case de mer sa distance à
// la terre la plus proche (transformée en distance euclidienne exacte de
// Felzenszwalb et Huttenlocher), puis on relève les courbes de niveau de
// cette distance (algorithme des carrés marchants).

const FAR = 1e20;

/**
 * Grille couvrant le rectangle [xmin, ymin, xmax, ymax], une case par unité.
 * Les terres sont remplies selon la règle pair-impair : un lac posé sur une
 * terre redevient de l'eau.
 */
export function rasterize(rings, [xmin, ymin, xmax, ymax]) {
  const nx = Math.ceil(xmax - xmin);
  const ny = Math.ceil(ymax - ymin);
  const land = new Uint8Array(nx * ny);
  const edges = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (a[1] !== b[1]) edges.push([a[0] - xmin, a[1] - ymin, b[0] - xmin, b[1] - ymin]);
    }
  }
  const crossings = [];
  for (let j = 0; j < ny; j++) {
    const y = j + 0.5;
    crossings.length = 0;
    for (const [x0, y0, x1, y1] of edges) {
      if ((y0 <= y && y < y1) || (y1 <= y && y < y0)) {
        crossings.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
      }
    }
    crossings.sort((p, q) => p - q);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.ceil(crossings[k] - 0.5));
      const to = Math.min(nx - 1, Math.floor(crossings[k + 1] - 0.5));
      for (let i = from; i <= to; i++) land[j * nx + i] = 1;
    }
  }
  return { nx, ny, land, origin: [xmin, ymin] };
}

/** Transformée de distance d'une ligne (carrés des distances). */
function transform1d(f, n, d, v, z) {
  const intersection = (q, r) => (f[q] + q * q - (f[r] + r * r)) / (2 * q - 2 * r);
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = intersection(q, v[k]);
    // z[0] vaut -∞ : la boucle s'arrête au plus tard sur la première parabole.
    while (s <= z[k]) {
      k--;
      s = intersection(q, v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    d[q] = (q - r) * (q - r) + f[r];
  }
}

/** Distance (en cases) de chaque case à la terre la plus proche. */
export function distanceField({ nx, ny, land }) {
  const size = Math.max(nx, ny);
  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);
  const grid = new Float64Array(nx * ny);
  for (let i = 0; i < nx * ny; i++) grid[i] = land[i] ? 0 : FAR;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) f[j] = grid[j * nx + i];
    transform1d(f, ny, d, v, z);
    for (let j = 0; j < ny; j++) grid[j * nx + i] = d[j];
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) f[i] = grid[j * nx + i];
    transform1d(f, nx, d, v, z);
    for (let i = 0; i < nx; i++) grid[j * nx + i] = Math.sqrt(d[i]);
  }
  // Bord de grille repoussé au loin : toutes les courbes se referment,
  // hors du cadre visible.
  for (let i = 0; i < nx; i++) {
    grid[i] = FAR;
    grid[(ny - 1) * nx + i] = FAR;
  }
  for (let j = 0; j < ny; j++) {
    grid[j * nx] = FAR;
    grid[j * nx + nx - 1] = FAR;
  }
  return grid;
}

// Pour chaque configuration des quatre coins (haut-gauche = 8, haut-droit = 4,
// bas-droit = 2, bas-gauche = 1), les côtés de la case reliés par la courbe.
// Côtés : 0 haut, 1 droite, 2 bas, 3 gauche. Les cas 5 et 10 (coins opposés)
// se tranchent selon la valeur au centre de la case.
const SEGMENTS = {
  1: [[3, 2]],
  2: [[2, 1]],
  3: [[3, 1]],
  4: [[0, 1]],
  6: [[0, 2]],
  7: [[3, 0]],
  8: [[3, 0]],
  9: [[0, 2]],
  11: [[0, 1]],
  12: [[3, 1]],
  13: [[2, 1]],
  14: [[3, 2]],
};

/**
 * Courbes fermées où la distance vaut `level` : la limite de la zone située
 * à moins de `level` unités d'une terre.
 */
export function contours(grid, { nx, ny, origin }, level) {
  const inside = (i, j) => grid[j * nx + i] < level;
  // Identifiant d'un côté de case : arête horizontale (i, j)-(i+1, j) ou
  // verticale (i, j)-(i, j+1).
  const hEdge = (i, j) => 2 * (j * nx + i);
  const vEdge = (i, j) => 2 * (j * nx + i) + 1;
  const segments = [];
  const byEdge = new Map();
  const link = (a, b) => {
    const index = segments.length;
    segments.push([a, b]);
    for (const e of [a, b]) {
      const list = byEdge.get(e);
      if (list) list.push(index);
      else byEdge.set(e, [index]);
    }
  };

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const code =
        (inside(i, j) ? 8 : 0) |
        (inside(i + 1, j) ? 4 : 0) |
        (inside(i + 1, j + 1) ? 2 : 0) |
        (inside(i, j + 1) ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const sides = [hEdge(i, j), vEdge(i + 1, j), hEdge(i, j + 1), vEdge(i, j)];
      let pairs = SEGMENTS[code];
      if (code === 5 || code === 10) {
        const centre =
          (grid[j * nx + i] +
            grid[j * nx + i + 1] +
            grid[(j + 1) * nx + i + 1] +
            grid[(j + 1) * nx + i]) /
            4 <
          level;
        // 5 : haut-droit et bas-gauche dedans ; 10 : haut-gauche et bas-droit dedans.
        const cutCornersAC = code === 5 ? centre : !centre;
        pairs = cutCornersAC
          ? [
              [3, 0],
              [2, 1],
            ]
          : [
              [0, 1],
              [3, 2],
            ];
      }
      for (const [a, b] of pairs) link(sides[a], sides[b]);
    }
  }

  // Position d'une courbe sur un côté, par interpolation linéaire.
  const pointOn = (edge) => {
    const cell = edge >> 1;
    const i = cell % nx;
    const j = (cell - i) / nx;
    const [i2, j2] = edge & 1 ? [i, j + 1] : [i + 1, j];
    const a = grid[j * nx + i];
    const b = grid[j2 * nx + i2];
    const t = (level - a) / (b - a);
    return [origin[0] + i + 0.5 + t * (i2 - i), origin[1] + j + 0.5 + t * (j2 - j)];
  };

  const used = new Uint8Array(segments.length);
  const rings = [];
  for (let start = 0; start < segments.length; start++) {
    if (used[start]) continue;
    used[start] = 1;
    const [firstEdge, secondEdge] = segments[start];
    const ring = [pointOn(firstEdge)];
    let edge = secondEdge;
    while (edge !== firstEdge) {
      ring.push(pointOn(edge));
      const next = byEdge.get(edge).find((s) => !used[s]);
      if (next === undefined) break;
      used[next] = 1;
      const [a, b] = segments[next];
      edge = a === edge ? b : a;
    }
    rings.push(ring);
  }
  return rings;
}
