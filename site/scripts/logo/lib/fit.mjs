// Lissage du tracé du kanji.
//
// Le tracé brut (potrace sur le bitmap suréchantillonné ×8) suit fidèlement
// les pixels, y compris une petite dent de scie due au détourage des PNG :
// les pixels de bord couverts à moins de 47 % environ y ont été rendus
// transparents, si bien que le contour recule par endroits (jamais il
// n'avance). On garde ce tracé comme mesure, puis on le redessine :
// 1. échantillonnage fin du contour (tous les 0,1 px) ;
// 2. repérage des angles vifs : virage d'au moins `cornerAngle` degrés
//    concentré sur moins de `cornerWindow` px ;
// 3. entre deux angles, un côté droit devient une droite, un côté courbe une
//    suite de courbes de Bézier (méthode de P. J. Schneider, « An Algorithm
//    for Automatically Fitting Digitized Curves », Graphics Gems, 1990).
//    Les ajustements se font par moindres carrés « d'un seul côté » : les
//    points en retrait vers l'intérieur (les creux de la dent de scie) sont
//    presque ignorés, puisque le détourage n'a pu qu'enlever de l'encre ;
// 4. une droite à moins de `axisAngle` degrés de l'horizontale ou de la
//    verticale le devient exactement ;
// 5. chaque angle est recalculé comme l'intersection des tangentes de ses
//    deux côtés (déplacement limité à `maxExtend` px) : il redevient vif.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => {
  const l = len(a);
  return l > 1e-12 ? [a[0] / l, a[1] / l] : [0, 0];
};
const dist = (a, b) => len(sub(a, b));

function bezierPoint([p0, p1, p2, p3], t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

function bezierTangent([p0, p1, p2, p3], t) {
  const u = 1 - t;
  return norm([
    3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]),
    3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]),
  ]);
}

/** Échantillonne un contour fermé à pas régulier (en px). */
export function sampleContour(path, step = 0.1) {
  const pts = [];
  let cur = path.start;
  for (const s of path.segs) {
    if (s.type === 'L') {
      const l = dist(cur, s.p);
      const n = Math.max(1, Math.ceil(l / step));
      for (let i = 0; i < n; i++)
        pts.push([cur[0] + ((s.p[0] - cur[0]) * i) / n, cur[1] + ((s.p[1] - cur[1]) * i) / n]);
    } else {
      const bz = [cur, s.c1, s.c2, s.p];
      // table abscisse curviligne -> paramètre, pour un pas régulier
      const N = 256;
      const table = [[0, 0]];
      let acc = 0;
      let prev = cur;
      for (let i = 1; i <= N; i++) {
        const q = bezierPoint(bz, i / N);
        acc += dist(prev, q);
        table.push([acc, i / N]);
        prev = q;
      }
      const n = Math.max(1, Math.ceil(acc / step));
      let k = 1;
      for (let i = 0; i < n; i++) {
        const target = (acc * i) / n;
        while (k < table.length - 1 && table[k][0] < target) k++;
        const [s0, t0] = table[k - 1];
        const [s1, t1] = table[k];
        const t = s1 > s0 ? t0 + ((target - s0) / (s1 - s0)) * (t1 - t0) : t0;
        pts.push(bezierPoint(bz, t));
      }
    }
    cur = s.p;
  }
  return pts;
}

/** Aire signée (formule du lacet) : son signe donne le sens de parcours. */
function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/**
 * Droite des moindres carrés orthogonaux, d'un seul côté : à chaque
 * itération, les points en retrait vers l'encre de plus de `delta` px (mais
 * de moins de `dipMax` px, au-delà c'est un vrai relief) pèsent presque rien.
 * `outward(t)` donne la normale qui s'éloigne de l'encre.
 */
export function fitLineOneSided(
  points,
  outward,
  { delta = 0.05, dipMax = 0.6, iterations = 4 } = {},
) {
  let w = points.map(() => 1);
  let line = null;
  for (let it = 0; it <= iterations; it++) {
    let sw = 0;
    let mx = 0;
    let my = 0;
    for (let i = 0; i < points.length; i++) {
      sw += w[i];
      mx += w[i] * points[i][0];
      my += w[i] * points[i][1];
    }
    mx /= sw;
    my /= sw;
    let cxx = 0;
    let cxy = 0;
    let cyy = 0;
    for (let i = 0; i < points.length; i++) {
      const dx = points[i][0] - mx;
      const dy = points[i][1] - my;
      cxx += w[i] * dx * dx;
      cxy += w[i] * dx * dy;
      cyy += w[i] * dy * dy;
    }
    const a = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    let d = [Math.cos(a), Math.sin(a)];
    if (dot(d, sub(points[points.length - 1], points[0])) < 0) d = mul(d, -1);
    line = { p: [mx, my], d };
    if (it === iterations) break;
    const n = outward(d);
    w = points.map((q) => {
      const r = dot(sub(q, line.p), n);
      return r >= -delta || r < -dipMax ? 1 : 0.02;
    });
  }
  // Statistiques sur les points retenus : écart maximal et flèche.
  const n = outward(line.d);
  let maxDev = 0;
  let s0 = Infinity;
  let s1 = -Infinity;
  const sv = [];
  for (let i = 0; i < points.length; i++) {
    if (w[i] < 1) continue;
    const q = sub(points[i], line.p);
    const s = dot(q, line.d);
    const y = dot(q, n);
    maxDev = Math.max(maxDev, Math.abs(y));
    s0 = Math.min(s0, s);
    s1 = Math.max(s1, s);
    sv.push([s, y]);
  }
  return { ...line, maxDev, sagitta: sagitta(sv, s0, s1), kept: sv.length };
}

/** Flèche (px) de la parabole y = a + b·s + c·s² ajustée sur les écarts. */
function sagitta(sv, s0, s1) {
  if (sv.length < 5) return 0;
  const n = sv.length;
  let ms = 0;
  let ms2 = 0;
  let my = 0;
  for (const [s, y] of sv) {
    ms += s;
    ms2 += s * s;
    my += y;
  }
  ms /= n;
  ms2 /= n;
  my /= n;
  let saa = 0;
  let say = 0;
  let sbb = 0;
  let sby = 0;
  let sab = 0;
  for (const [s, y] of sv) {
    const a = s - ms;
    const b = s * s - ms2;
    saa += a * a;
    say += a * (y - my);
    sbb += b * b;
    sab += a * b;
    sby += b * (y - my);
  }
  const det = saa * sbb - sab * sab;
  if (Math.abs(det) < 1e-12) return 0;
  const c = (saa * sby - sab * say) / det;
  const half = (s1 - s0) / 2;
  return Math.abs(c) * half * half;
}

function intersect(l1, l2) {
  const den = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0];
  if (Math.abs(den) < 1e-6) return null;
  const w = sub(l2.p, l1.p);
  const t = (w[0] * l2.d[1] - w[1] * l2.d[0]) / den;
  return add(l1.p, mul(l1.d, t));
}

/**
 * Indices des angles vifs d'un contour échantillonné. Le virage est mesuré
 * à trois échelles, entre la corde qui arrive et celle qui part :
 * - sur `window` px : au moins `minAngle` degrés (mesurée sur ces PNG, la
 *   dent de scie due au détourage ne dépasse pas 32° à cette échelle) ;
 * - sur la moitié : au moins `concentration` fois ce virage (sinon c'est
 *   une courbe serrée, pas un angle) ;
 * - sur un cinquième : sert à dire si l'angle est franc.
 * Deux candidats voisins (à moins de `cluster` px) qui tournent dans le même
 * sens sans être francs dessinent un arrondi (les petits crochets du
 * radical du bambou) : ils sont écartés tous les deux.
 */
export function findCorners(
  pts,
  {
    step = 0.1,
    window = 1.5,
    minAngle = 38,
    concentration = 0.45,
    sharp = 0.8,
    cluster = 8,
    nms = 2,
  } = {},
) {
  const n = pts.length;
  const turn = (i, w) => {
    const kk = Math.max(1, Math.round(w / step));
    const a = pts[(i - kk + n) % n];
    const b = pts[i];
    const c = pts[(i + kk) % n];
    const d1 = norm(sub(b, a));
    const d2 = norm(sub(c, b));
    const cross = d1[0] * d2[1] - d1[1] * d2[0];
    return (Math.atan2(cross, dot(d1, d2)) * 180) / Math.PI;
  };
  const t = new Float64Array(n);
  for (let i = 0; i < n; i++) t[i] = turn(i, window);
  const r = Math.round(nms / step);
  const cands = [];
  for (let i = 0; i < n; i++) {
    const a = Math.abs(t[i]);
    if (a < minAngle) continue;
    let best = true;
    for (let j = -r; j <= r && best; j++) {
      if (j === 0) continue;
      const v = Math.abs(t[(i + j + n) % n]);
      if (v > a || (v === a && j < 0)) best = false;
    }
    if (!best) continue;
    const half = Math.abs(turn(i, window / 2));
    if (half < concentration * a) continue;
    cands.push({ i, sign: Math.sign(t[i]), sharp: Math.abs(turn(i, window / 5)) >= sharp * a });
  }
  // arrondis : paires voisines de même sens, sans angle franc
  const drop = new Set();
  const m = cands.length;
  for (let k = 0; k < m && m > 1; k++) {
    const a = cands[k];
    const b = cands[(k + 1) % m];
    const gap = ((b.i - a.i + n) % n) * step;
    if (gap <= cluster && a.sign === b.sign && !a.sharp && !b.sharp) {
      drop.add(a.i);
      drop.add(b.i);
    }
  }
  return cands.filter((c) => !drop.has(c.i)).map((c) => c.i);
}

// --- Ajustement de courbes de Bézier (Schneider), pondéré --------------------

const B0 = (u) => (1 - u) ** 3;
const B1 = (u) => 3 * u * (1 - u) ** 2;
const B2 = (u) => 3 * u * u * (1 - u);
const B3 = (u) => u ** 3;

function chordParams(d) {
  const u = [0];
  for (let i = 1; i < d.length; i++) u.push(u[i - 1] + dist(d[i], d[i - 1]));
  const L = u[u.length - 1] || 1;
  return u.map((v) => v / L);
}

function generateBezier(d, u, w, t1, t2) {
  const first = d[0];
  const last = d[d.length - 1];
  let c00 = 0;
  let c01 = 0;
  let c11 = 0;
  let x0 = 0;
  let x1 = 0;
  for (let i = 0; i < d.length; i++) {
    const a0 = mul(t1, B1(u[i]));
    const a1 = mul(t2, B2(u[i]));
    c00 += w[i] * dot(a0, a0);
    c01 += w[i] * dot(a0, a1);
    c11 += w[i] * dot(a1, a1);
    const base = add(mul(first, B0(u[i]) + B1(u[i])), mul(last, B2(u[i]) + B3(u[i])));
    const tmp = sub(d[i], base);
    x0 += w[i] * dot(a0, tmp);
    x1 += w[i] * dot(a1, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  let al = det !== 0 ? (x0 * c11 - x1 * c01) / det : 0;
  let ar = det !== 0 ? (c00 * x1 - c01 * x0) / det : 0;
  const segLen = dist(first, last);
  const eps = 1e-6 * segLen;
  if (al < eps || ar < eps) {
    al = segLen / 3;
    ar = segLen / 3;
  }
  return [first, add(first, mul(t1, al)), add(last, mul(t2, ar)), last];
}

function newtonRoot(bz, p, u) {
  const q = bezierPoint(bz, u);
  const d1 = [0, 1, 2].map((i) => mul(sub(bz[i + 1], bz[i]), 3));
  const d2 = [0, 1].map((i) => mul(sub(d1[i + 1], d1[i]), 2));
  const q1 = add(add(mul(d1[0], (1 - u) ** 2), mul(d1[1], 2 * u * (1 - u))), mul(d1[2], u * u));
  const q2 = add(mul(d2[0], 1 - u), mul(d2[1], u));
  const num = dot(sub(q, p), q1);
  const den = dot(q1, q1) + dot(sub(q, p), q2);
  if (Math.abs(den) < 1e-12) return u;
  return Math.min(1, Math.max(0, u - num / den));
}

/**
 * Ajuste une courbe sur les points d (extrémités imposées, tangentes t1 et
 * t2 imposées) ; coupe en deux tant que l'écart dépasse `tol` sur les points
 * retenus. Les creux (points en retrait vers l'encre) sont presque ignorés.
 */
function fitCubic(d, t1, t2, tol, outward, out, opts, depth = 0) {
  const { delta, dipMax } = opts;
  if (d.length <= 3 || depth > 14) {
    const k = dist(d[0], d[d.length - 1]) / 3;
    out.push([d[0], add(d[0], mul(t1, k)), add(d[d.length - 1], mul(t2, k)), d[d.length - 1]]);
    return;
  }
  let u = chordParams(d);
  let w = d.map(() => 1);
  let bz = null;
  for (let it = 0; it < 5; it++) {
    bz = generateBezier(d, u, w, t1, t2);
    for (let r = 0; r < 3; r++) u = u.map((ui, i) => newtonRoot(bz, d[i], ui));
    bz = generateBezier(d, u, w, t1, t2);
    // pondération d'un seul côté
    w = d.map((p, i) => {
      if (i === 0 || i === d.length - 1) return 1;
      const q = bezierPoint(bz, u[i]);
      const r = dot(sub(p, q), outward(bezierTangent(bz, u[i])));
      return r >= -delta || r < -dipMax ? 1 : 0.02;
    });
  }
  let max = 0;
  let split = Math.floor(d.length / 2);
  for (let i = 1; i < d.length - 1; i++) {
    if (w[i] < 1) continue;
    const e = dist(bezierPoint(bz, u[i]), d[i]);
    if (e >= max) {
      max = e;
      split = i;
    }
  }
  if (max < tol) {
    out.push(bz);
    return;
  }
  split = Math.min(d.length - 3, Math.max(2, split));
  const tc = norm(sub(d[split - 2], d[split + 2]));
  fitCubic(d.slice(0, split + 1), t1, tc, tol, outward, out, opts, depth + 1);
  fitCubic(d.slice(split), mul(tc, -1), t2, tol, outward, out, opts, depth + 1);
}

/**
 * Normale « vers l'extérieur de l'encre » pour un ensemble de contours
 * potrace : le plus grand contour est forcément extérieur, et tous les
 * contours ont l'encre du même côté de leur sens de parcours (règle de
 * remplissage « nonzero »).
 */
export function outwardFor(sampledContours) {
  const largest = sampledContours.reduce((a, b) =>
    Math.abs(signedArea(a)) > Math.abs(signedArea(b)) ? a : b,
  );
  const sigma = Math.sign(signedArea(largest));
  return (t) => (sigma > 0 ? [t[1], -t[0]] : [-t[1], t[0]]);
}

// --- Redessin complet d'un contour ------------------------------------------

/**
 * Redessine les contours d'un tracé potrace : angles vifs, côtés droits
 * redressés, courbes lisses. Renvoie { paths, log }.
 */
export function refitPaths(
  paths,
  {
    step = 0.1,
    cornerWindow = 1.5,
    cornerAngle = 38,
    trim = 0.8,
    straightTrim = 2,
    tangentSpan = 2.5,
    straightTol = 0.3,
    minStraight = 4,
    sagittaTol = 0.15,
    sagittaRel = 0.0015,
    maxStraightDev = 0.6,
    axisAngle = 0.75,
    tolerance = 0.3,
    delta = 0.05,
    dipMax = 0.6,
    maxExtend = 1.5,
    maxExtendAcute = 0.5,
  } = {},
) {
  const log = {
    contours: 0,
    corners: 0,
    lines: 0,
    axisAlignedLines: 0,
    curves: 0,
    cappedCorners: 0,
  };
  const sampled = paths.map((p) => sampleContour(p, step));
  const outward = outwardFor(sampled);
  const opts = { delta, dipMax };
  const out = [];
  for (const pts of sampled) {
    const n = pts.length;
    let corners = findCorners(pts, { step, window: cornerWindow, minAngle: cornerAngle });
    if (corners.length === 0) corners = [0, Math.floor(n / 2)];
    const m = corners.length;
    const tk = Math.round(trim / step);
    const sk = Math.round(tangentSpan / step);
    const runs = corners.map((c, i) => {
      const e = corners[(i + 1) % m];
      const run = [];
      for (let q = c; ; q = (q + 1) % n) {
        run.push(pts[q]);
        if (q === e || run.length > n) break;
      }
      return { pts: run, arc: (run.length - 1) * step };
    });
    for (const run of runs) {
      const cut = Math.min(tk, Math.floor(run.pts.length / 4));
      run.cut = cut;
      // Pour juger si le côté est droit, on s'écarte davantage des angles,
      // dont l'arrondi peut déborder sur 1 à 2 px.
      const testCut = Math.min(Math.round(straightTrim / step), Math.floor(run.pts.length / 4));
      const inner = run.pts.slice(testCut, run.pts.length - testCut);
      const line = fitLineOneSided(inner.length >= 2 ? inner : run.pts, outward, opts);
      run.straight =
        run.arc < minStraight
          ? line.maxDev <= straightTol
          : line.sagitta <= Math.max(sagittaTol, sagittaRel * run.arc) &&
            line.maxDev <= maxStraightDev;
      if (run.straight) {
        const ang = (Math.atan2(line.d[1], line.d[0]) * 180) / Math.PI;
        const off = ((ang % 90) + 90) % 90;
        if (off < axisAngle || 90 - off < axisAngle) {
          line.d =
            Math.abs(line.d[0]) > Math.abs(line.d[1])
              ? [Math.sign(line.d[0]), 0]
              : [0, Math.sign(line.d[1])];
          log.axisAlignedLines++;
        }
        run.inLine = line;
        run.outLine = line;
      } else {
        const span = Math.max(3, Math.min(sk, Math.floor(run.pts.length / 3)));
        run.inLine = fitLineOneSided(run.pts.slice(cut, cut + span), outward, opts);
        run.outLine = fitLineOneSided(
          run.pts.slice(run.pts.length - cut - span, run.pts.length - cut),
          outward,
          opts,
        );
      }
    }
    const cornerPts = corners.map((c, i) => {
      const l1 = runs[(i - 1 + m) % m].outLine;
      const l2 = runs[i].inLine;
      const v = intersect(l1, l2);
      if (!v) return pts[c];
      // Angle aigu (pointe fine ou fente étroite) : les pixels n'en montrent
      // pas l'extrémité, on la prolonge donc moins loin.
      const interior =
        180 - (Math.acos(Math.max(-1, Math.min(1, dot(l1.d, l2.d)))) * 180) / Math.PI;
      const cap = interior < 80 ? maxExtendAcute : maxExtend;
      const dv = dist(v, pts[c]);
      if (dv <= cap) return v;
      log.cappedCorners++;
      return add(pts[c], mul(sub(v, pts[c]), cap / dv));
    });
    const segs = [];
    for (let i = 0; i < m; i++) {
      const run = runs[i];
      const a = cornerPts[i];
      const b = cornerPts[(i + 1) % m];
      if (run.straight) {
        segs.push({ type: 'L', p: b });
        log.lines++;
        continue;
      }
      const interior = run.pts.slice(run.cut, run.pts.length - run.cut);
      const data = [a, ...interior, b];
      const curves = [];
      fitCubic(data, run.inLine.d, mul(run.outLine.d, -1), tolerance, outward, curves, opts);
      for (const bz of curves) segs.push({ type: 'C', c1: bz[1], c2: bz[2], p: bz[3] });
      log.curves += curves.length;
    }
    out.push({ start: cornerPts[0], segs });
    log.contours++;
    log.corners += m;
  }
  return { paths: out, log };
}
