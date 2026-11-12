// Géométrie des contours : redressement des lettres, boîte englobante,
// écriture des données de tracé SVG.
//
// Un contour est { start: [x, y], segs: [...] } avec des segments
// { type: 'L', p } (droite) ou { type: 'C', c1, c2, p } (courbe de Bézier).

import { fitLineOneSided } from './fit.mjs';

const EPS = 1e-9;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const dist = (a, b) => len(sub(a, b));

/** Points successifs d'un contour fait uniquement de droites (sans doublon). */
function polygonPoints(path) {
  const pts = [path.start, ...path.segs.map((s) => s.p)];
  const out = [];
  for (const p of pts) {
    if (!out.length || dist(out[out.length - 1], p) > 1e-6) out.push(p);
  }
  if (out.length > 1 && dist(out[0], out[out.length - 1]) < 1e-6) out.pop();
  return out;
}

/** Aire signée d'un polygone (formule du lacet). */
function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Distance d'un point à un segment [a, b]. */
function distToSegment(p, a, b) {
  const ab = sub(b, a);
  const l2 = ab[0] * ab[0] + ab[1] * ab[1];
  if (l2 < EPS) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / l2));
  return dist(p, [a[0] + t * ab[0], a[1] + t * ab[1]]);
}

/**
 * Simplification de Douglas-Peucker sur un polygone fermé : garde les
 * sommets qui s'écartent de plus de `tol` pixels des cordes. Ce sont les
 * vrais angles des lettres ; le reste n'est que du bruit de tracé.
 */
function keyVertices(pts, tol) {
  const n = pts.length;
  // Deux ancres de départ : le point le plus à gauche et le plus éloigné de lui.
  let a = 0;
  for (let i = 1; i < n; i++)
    if (pts[i][0] < pts[a][0] || (pts[i][0] === pts[a][0] && pts[i][1] < pts[a][1])) a = i;
  let b = a;
  let far = -1;
  for (let i = 0; i < n; i++) {
    const d = dist(pts[i], pts[a]);
    if (d > far) {
      far = d;
      b = i;
    }
  }
  const keep = new Set([a, b]);
  const rec = (i, j) => {
    // indices circulaires de i à j (exclus)
    let best = -1;
    let bestD = tol;
    for (let k = (i + 1) % n; k !== j; k = (k + 1) % n) {
      const d = distToSegment(pts[k], pts[i], pts[j]);
      if (d > bestD) {
        bestD = d;
        best = k;
      }
    }
    if (best >= 0) {
      keep.add(best);
      rec(i, best);
      rec(best, j);
    }
  };
  rec(a, b);
  rec(b, a);
  return [...keep].sort((x, y) => x - y);
}

/**
 * Droite ajustée sur la ligne brisée pts[i..j], échantillonnée finement.
 * On ignore les abords des angles (`trim` pixels à chaque bout), arrondis
 * par le suréchantillonnage, et l'ajustement se fait « d'un seul côté »
 * (voir fitLineOneSided) : les creux laissés par le détourage ne tirent pas
 * le bord vers l'intérieur. Renvoie { p: point, d: direction, length }.
 */
function fitLine(pts, i, j, trim, outward) {
  const n = pts.length;
  const chain = [];
  for (let k = i; ; k = (k + 1) % n) {
    chain.push(pts[k]);
    if (k === j) break;
  }
  let total = 0;
  for (let k = 1; k < chain.length; k++) total += dist(chain[k - 1], chain[k]);
  const t0 = Math.min(trim, total * 0.25);
  const t1 = total - t0;
  const step = 0.05;
  const samples = [];
  let acc = 0;
  for (let k = 1; k < chain.length; k++) {
    const a = chain[k - 1];
    const b = chain[k];
    const l = dist(a, b);
    if (l < EPS) continue;
    const m = Math.max(1, Math.ceil(l / step));
    for (let s = 0; s < m; s++) {
      const u = (s + 0.5) / m;
      const at = acc + u * l;
      if (at >= t0 && at <= t1) samples.push([a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])]);
    }
    acc += l;
  }
  if (samples.length < 2) {
    const a = chain[0];
    const b = chain[chain.length - 1];
    const d = sub(b, a);
    const l = len(d) || 1;
    return { p: a, d: [d[0] / l, d[1] / l], length: total };
  }
  const line = fitLineOneSided(samples, outward);
  return { p: line.p, d: line.d, length: total };
}

/** Intersection de deux droites (point + direction), ou null si parallèles. */
function intersect(l1, l2) {
  const den = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0];
  if (Math.abs(den) < 1e-6) return null;
  const w = sub(l2.p, l1.p);
  const t = (w[0] * l2.d[1] - w[1] * l2.d[0]) / den;
  return [l1.p[0] + t * l1.d[0], l1.p[1] + t * l1.d[1]];
}

/**
 * Regroupe des valeurs proches (écart total ≤ tol) et renvoie, pour chaque
 * valeur, la moyenne pondérée de son groupe.
 */
function clusterValues(items, tol) {
  const sorted = [...items].sort((a, b) => a.v - b.v);
  const groups = [];
  for (const it of sorted) {
    const g = groups[groups.length - 1];
    if (g && it.v - g[0].v <= tol) g.push(it);
    else groups.push([it]);
  }
  const out = new Map();
  for (const g of groups) {
    const w = g.reduce((s, it) => s + it.w, 0);
    const mean = g.reduce((s, it) => s + it.v * it.w, 0) / w;
    for (const it of g) out.set(it, { mean, size: g.length, spread: g[g.length - 1].v - g[0].v });
  }
  return out;
}

/**
 * Redresse des contours polygonaux (lettres HAKO tracées avec alphamax 0) :
 * 1. ne garde que les vrais angles (Douglas-Peucker, tolérance `cornerTol`) ;
 * 2. ajuste une droite sur chaque côté (moindres carrés d'un seul côté) ;
 * 3. rend parfaitement horizontaux ou verticaux les côtés à moins de
 *    `axisAngle` degrés de l'être ;
 * 4. aligne entre eux les côtés horizontaux (ou verticaux) distants de moins
 *    de `alignTol` pixels (même hauteur de capitale, même ligne de base) ;
 * 5. recalcule chaque angle comme l'intersection des deux côtés voisins.
 * Renvoie les contours et un journal des corrections.
 */
export function straightenPolygons(
  paths,
  {
    cornerTol = 0.5,
    trim = 2,
    axisAngle = 0.75,
    alignTol = 0.05,
    shortEdge = 3,
    mergeAngle = 4,
    mergeShort = 8,
  } = {},
) {
  const shapes = [];
  const log = {
    contours: 0,
    edges: 0,
    axisAligned: 0,
    alignments: [],
    roundedCornersRemoved: 0,
    edgesMerged: 0,
    maxVertexShift: 0,
  };
  const angleBetween = (d1, d2) =>
    (Math.acos(Math.min(1, Math.abs(d1[0] * d2[0] + d1[1] * d2[1]))) * 180) / Math.PI;
  // Normale vers l'extérieur de l'encre : le plus grand contour est extérieur,
  // et tous ont l'encre du même côté de leur sens de parcours.
  const areas = paths.map((p) => signedArea(polygonPoints(p)));
  const sigma = Math.sign(areas.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0));
  const outward = (t) => (sigma > 0 ? [t[1], -t[0]] : [-t[1], t[0]]);
  for (const path of paths) {
    if (path.segs.some((s) => s.type !== 'L'))
      throw new Error('straightenPolygons attend des contours sans courbes.');
    const pts = polygonPoints(path);
    const n = pts.length;
    let keys = keyVertices(pts, cornerTol);
    const arc = (i, j) => {
      let l = 0;
      for (let k = i; k !== j; k = (k + 1) % n) l += dist(pts[k], pts[(k + 1) % n]);
      return l;
    };
    const fitAll = () =>
      keys.map((i, k) =>
        fitLine(
          pts,
          i,
          keys[(k + 1) % keys.length],
          Math.min(trim, 0.2 * arc(i, keys[(k + 1) % keys.length])),
          outward,
        ),
      );
    // Nettoyage itératif des angles :
    // - un côté très court entre deux côtés non parallèles est l'arrondi
    //   d'un angle vif (effet du suréchantillonnage) : on le supprime et
    //   l'angle devient l'intersection des deux voisins ;
    // - deux côtés consécutifs presque alignés (écart < mergeAngle degrés,
    //   l'un des deux court) ne forment qu'un seul côté.
    for (let guard = 0; guard < 200 && keys.length > 3; guard++) {
      const lines = fitAll();
      const m = keys.length;
      let done = true;
      for (let k = 0; k < m; k++) {
        const i = keys[k];
        const j = keys[(k + 1) % m];
        const l = arc(i, j);
        const prev = lines[(k - 1 + m) % m];
        const next = lines[(k + 1) % m];
        if (l < shortEdge && angleBetween(prev.d, next.d) > 20) {
          // l'angle se reporte au milieu du petit côté
          let mid = i;
          let acc = 0;
          for (let q = i; q !== j; q = (q + 1) % n) {
            acc += dist(pts[q], pts[(q + 1) % n]);
            if (acc >= l / 2) {
              mid = (q + 1) % n;
              break;
            }
          }
          keys = keys.filter((x) => x !== i && x !== j);
          keys.push(mid);
          keys.sort((a, b) => a - b);
          log.roundedCornersRemoved++;
          done = false;
          break;
        }
        const cur = lines[k];
        if (
          angleBetween(cur.d, next.d) < mergeAngle &&
          (l < mergeShort || arc(j, keys[(k + 2) % m]) < mergeShort)
        ) {
          keys = keys.filter((x) => x !== j);
          log.edgesMerged++;
          done = false;
          break;
        }
      }
      if (done) break;
    }
    const lines = [];
    for (const line of fitAll()) {
      const ang = (Math.atan2(line.d[1], line.d[0]) * 180) / Math.PI;
      const off = ((ang % 90) + 90) % 90;
      if (off < axisAngle || 90 - off < axisAngle) {
        const horizontal = Math.abs(line.d[0]) > Math.abs(line.d[1]);
        line.axis = horizontal ? 'h' : 'v';
        line.d = horizontal ? [Math.sign(line.d[0]), 0] : [0, Math.sign(line.d[1])];
        log.axisAligned++;
      }
      lines.push(line);
    }
    shapes.push({ pts, keys, lines });
    log.contours++;
    log.edges += lines.length;
  }
  // Alignement des côtés horizontaux / verticaux de toutes les lettres.
  for (const axis of ['h', 'v']) {
    const items = [];
    for (const s of shapes) {
      for (const line of s.lines) {
        if (line.axis === axis)
          items.push({ v: axis === 'h' ? line.p[1] : line.p[0], w: line.length, line });
      }
    }
    const groups = clusterValues(items, alignTol);
    for (const it of items) {
      const g = groups.get(it);
      if (axis === 'h') it.line.p = [it.line.p[0], g.mean];
      else it.line.p = [g.mean, it.line.p[1]];
      if (g.size > 1 && g.spread > 0.001)
        log.alignments.push({
          axis: axis === 'h' ? 'horizontal' : 'vertical',
          value: Number(g.mean.toFixed(3)),
          spread: Number(g.spread.toFixed(3)),
        });
    }
  }
  // Dédoublonnage du journal d'alignement
  log.alignments = [...new Map(log.alignments.map((a) => [`${a.axis}:${a.value}`, a])).values()];
  const out = [];
  for (const { pts, keys, lines } of shapes) {
    const vertices = [];
    for (let k = 0; k < lines.length; k++) {
      const prev = lines[(k - 1 + lines.length) % lines.length];
      const cur = lines[k];
      const key = pts[keys[k]];
      let v = intersect(prev, cur);
      if (!v || dist(v, key) > 3) v = key;
      log.maxVertexShift = Math.max(log.maxVertexShift, dist(v, key));
      vertices.push(v);
    }
    out.push({
      start: vertices[0],
      segs: vertices
        .slice(1)
        .map((p) => ({ type: 'L', p }))
        .concat([{ type: 'L', p: vertices[0] }]),
    });
  }
  log.maxVertexShift = Number(log.maxVertexShift.toFixed(3));
  return { paths: out, log };
}

// Extrema d'une composante de Bézier cubique sur [0, 1].
function cubicExtrema(p0, p1, p2, p3) {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const ts = [];
  if (Math.abs(a) < EPS) {
    if (Math.abs(b) > EPS) ts.push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const r = Math.sqrt(disc);
      ts.push((-b + r) / (2 * a), (-b - r) / (2 * a));
    }
  }
  return ts.filter((t) => t > 0 && t < 1);
}

const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

/** Boîte englobante exacte [x0, y0, x1, y1] (courbes comprises). */
export function bbox(paths) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const add = ([x, y]) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const path of paths) {
    let cur = path.start;
    add(cur);
    for (const s of path.segs) {
      if (s.type === 'C') {
        for (const k of [0, 1]) {
          for (const t of cubicExtrema(cur[k], s.c1[k], s.c2[k], s.p[k])) {
            add([
              bez(cur[0], s.c1[0], s.c2[0], s.p[0], t),
              bez(cur[1], s.c1[1], s.c2[1], s.p[1], t),
            ]);
          }
        }
      }
      add(s.p);
      cur = s.p;
    }
  }
  return [x0, y0, x1, y1];
}

export function translatePaths(paths, dx, dy) {
  const f = ([x, y]) => [x + dx, y + dy];
  return paths.map((p) => ({
    start: f(p.start),
    segs: p.segs.map((s) =>
      s.type === 'L'
        ? { type: 'L', p: f(s.p) }
        : { type: 'C', c1: f(s.c1), c2: f(s.c2), p: f(s.p) },
    ),
  }));
}

/** Données de tracé SVG absolues (svgo les compacte ensuite). */
export function toPathData(paths, decimals = 3) {
  const f = (v) => {
    const s = v.toFixed(decimals).replace(/\.?0+$/, '');
    return s === '-0' ? '0' : s;
  };
  const pt = ([x, y]) => `${f(x)} ${f(y)}`;
  return paths
    .map((p) => {
      let d = `M${pt(p.start)}`;
      const last = p.segs.length - 1;
      p.segs.forEach((s, i) => {
        // le dernier segment droit qui revient au départ est remplacé par Z
        if (i === last && s.type === 'L' && dist(s.p, p.start) < 1e-6) return;
        d += s.type === 'L' ? `L${pt(s.p)}` : `C${pt(s.c1)} ${pt(s.c2)} ${pt(s.p)}`;
      });
      return `${d}Z`;
    })
    .join('');
}
