// Géométrie plane : projection, découpe au cadre, lissage, simplification
// et écriture compacte des tracés SVG. Un point est un couple [x, y] ; un
// anneau est une liste de points dont le dernier rejoint implicitement le premier.

const RAD = Math.PI / 180;

/**
 * Projection équirectangulaire du cadre (voir FRAME dans config.mjs).
 * @param {{ lonMin: number, lonMax: number, latMax: number, latRef: number, width: number, height: number }} frame
 */
export function makeProjection(frame) {
  const cosRef = Math.cos(frame.latRef * RAD);
  // Unités SVG par degré de latitude.
  const scale = frame.width / ((frame.lonMax - frame.lonMin) * cosRef);
  const latMin = frame.latMax - frame.height / scale;
  return {
    cosRef,
    scale,
    latMin,
    /** @param {[number, number]} lonLat */
    project: ([lon, lat]) => [(lon - frame.lonMin) * cosRef * scale, (frame.latMax - lat) * scale],
  };
}

/**
 * Unités SVG par kilomètre dans le sens est-ouest, à la latitude de
 * référence (ellipsoïde WGS 84).
 */
export function unitsPerKm(frame, scale) {
  const a = 6378.137;
  const e2 = 0.00669437999014;
  const phi = frame.latRef * RAD;
  const n = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const kmPerDegreeLon = n * Math.cos(phi) * RAD;
  return (scale * Math.cos(phi)) / kmPerDegreeLon;
}

/** Rectangle [xmin, ymin, xmax, ymax] du cadre élargi d'une marge. */
export const expandedRect = (width, height, margin) => [
  -margin,
  -margin,
  width + margin,
  height + margin,
];

/** Aire signée d'un anneau (formule du lacet). */
export function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return sum / 2;
}

/** Boîte englobante [xmin, ymin, xmax, ymax] d'une liste de points. */
export function bounds(points) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

/**
 * Découpe un anneau par un rectangle (algorithme de Sutherland-Hodgman).
 * Un anneau concave peut garder des allers-retours le long du bord : ils
 * n'ont pas d'aire et restent hors du cadre visible, car le rectangle de
 * découpe déborde toujours du cadre.
 */
export function clipRing(ring, [xmin, ymin, xmax, ymax]) {
  const edges = [
    { inside: (p) => p[0] >= xmin, cut: (a, b) => atX(a, b, xmin) },
    { inside: (p) => p[0] <= xmax, cut: (a, b) => atX(a, b, xmax) },
    { inside: (p) => p[1] >= ymin, cut: (a, b) => atY(a, b, ymin) },
    { inside: (p) => p[1] <= ymax, cut: (a, b) => atY(a, b, ymax) },
  ];
  let output = ring;
  for (const edge of edges) {
    const input = output;
    output = [];
    if (input.length === 0) break;
    let previous = input[input.length - 1];
    for (const current of input) {
      const currentIn = edge.inside(current);
      const previousIn = edge.inside(previous);
      if (currentIn) {
        if (!previousIn) output.push(edge.cut(previous, current));
        output.push(current);
      } else if (previousIn) {
        output.push(edge.cut(previous, current));
      }
      previous = current;
    }
  }
  return output;
}

function atX(a, b, x) {
  const t = (x - a[0]) / (b[0] - a[0]);
  return [x, a[1] + t * (b[1] - a[1])];
}

function atY(a, b, y) {
  const t = (y - a[1]) / (b[1] - a[1]);
  return [a[0] + t * (b[0] - a[0]), y];
}

/**
 * Redécoupe en petits segments les côtés posés sur le bord du rectangle de
 * découpe : le lissage n'arrondit ainsi que de très petits angles, hors cadre.
 */
export function densifyOnRect(ring, [xmin, ymin, xmax, ymax], step) {
  const onEdge = (p, q) =>
    (p[0] === xmin && q[0] === xmin) ||
    (p[0] === xmax && q[0] === xmax) ||
    (p[1] === ymin && q[1] === ymin) ||
    (p[1] === ymax && q[1] === ymax);
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    out.push(p);
    if (!onEdge(p, q)) continue;
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const pieces = Math.floor(length / step);
    for (let k = 1; k < pieces; k++) {
      const t = k / pieces;
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}

/** Lissage de Chaikin d'un anneau fermé : chaque passe coupe les angles au quart. */
export function chaikinRing(ring, passes) {
  let current = ring;
  for (let pass = 0; pass < passes; pass++) {
    const next = [];
    for (let i = 0; i < current.length; i++) {
      const p = current[i];
      const q = current[(i + 1) % current.length];
      next.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]]);
      next.push([0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
    }
    current = next;
  }
  return current;
}

/** Distance d'un point au segment [a, b]. */
function segmentDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  let t = length2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Simplification de Douglas-Peucker d'une ligne ouverte (extrémités gardées). */
function simplifyLine(points, tolerance) {
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let worst = -1;
    let worstDistance = tolerance;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(points[i], points[first], points[last]);
      if (d > worstDistance) {
        worst = i;
        worstDistance = d;
      }
    }
    if (worst !== -1) {
      keep[worst] = 1;
      stack.push([first, worst], [worst, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/**
 * Simplification de Douglas-Peucker d'un anneau fermé : on le coupe en deux
 * au point le plus éloigné du premier, puis on simplifie chaque moitié.
 */
export function simplifyRing(ring, tolerance) {
  if (ring.length <= 4) return ring;
  let far = 0;
  let farDistance = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > farDistance) {
      far = i;
      farDistance = d;
    }
  }
  const first = simplifyLine(ring.slice(0, far + 1), tolerance);
  const second = simplifyLine([...ring.slice(far), ring[0]], tolerance);
  return [...first, ...second.slice(1, -1)];
}

/** Écrit un nombre avec le moins de caractères possible (« 0.5 » devient « .5 »). */
function compact(value) {
  if (value === 0) return '0';
  const text = String(value);
  if (text.startsWith('0.')) return text.slice(1);
  if (text.startsWith('-0.')) return `-${text.slice(2)}`;
  return text;
}

/** Joint des nombres en n'ajoutant une espace que si le signe ne sépare pas déjà. */
function joinNumbers(values) {
  let out = '';
  for (const value of values) {
    const text = compact(value);
    if (out === '' || text.startsWith('-')) out += text;
    else if (text.startsWith('.') && /\.\d*$/.test(out)) out += text;
    else out += ` ${text}`;
  }
  return out;
}

/**
 * Tracé SVG compact d'anneaux fermés : coordonnées arrondies, puis écrites
 * en relatif (« l ») d'un point au suivant, sans dérive d'arrondi.
 */
export function ringsToPath(rings, decimals) {
  const factor = 10 ** decimals;
  const parts = [];
  let previous = null;
  for (const ring of rings) {
    const integers = [];
    for (const [x, y] of ring) {
      const point = [Math.round(x * factor), Math.round(y * factor)];
      const last = integers[integers.length - 1];
      if (last && last[0] === point[0] && last[1] === point[1]) continue;
      integers.push(point);
    }
    if (integers.length < 3) continue;
    const [start, ...rest] = integers;
    // Premier point en relatif depuis la fin de l'anneau précédent (« m »),
    // sauf pour le tout premier (« M »).
    const head = previous
      ? `m${joinNumbers([(start[0] - previous[0]) / factor, (start[1] - previous[1]) / factor])}`
      : `M${joinNumbers([start[0] / factor, start[1] / factor])}`;
    const deltas = [];
    let cursor = start;
    for (const point of rest) {
      deltas.push((point[0] - cursor[0]) / factor, (point[1] - cursor[1]) / factor);
      cursor = point;
    }
    parts.push(`${head}l${joinNumbers(deltas)}z`);
    // Après « z », le point courant revient au début de l'anneau.
    previous = start;
  }
  return parts.join('');
}
