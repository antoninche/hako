// Le kanji 箱 du logo, posé sur le dessus de la box comme sur le prototype.
//
// Le contour est celui du logo officiel (src/assets/brand/hako-kanji.svg, viewBox
// 0 0 543.32 573.28), recopié tel quel ci-dessous : si le logo change, recopier
// son attribut d puis reconstruire la série. Le contour est lu une fois et
// aplati en polygones fins ; chaque dessin le projette ensuite sur le dessus de
// la box (perspective), puis retire les points inutiles à la taille dessinée.
// Le kanji n'est jamais déformé à la main ni écrit en texte.

export const KANJI_W = 543.32;
export const KANJI_H = 573.28;

const KANJI_D =
  'm14.74 142.84 26.9 43.99c9.98-9.82 20.01-19.64 29.09-30.3 6.97-8.19 13-16.54 19.18-25.19 5.27-7.36 9.14-15.58 13.42-23.55h33.93c5.42 10.38 9.9 22.8 14.22 33.91 1.35 3.47 2.67 6.74 3.97 10.28.2.52.66.84.8 1.27 1.87 5.9 3.13 13.38 6.53 18.76l53.38-14.55c-5.85-19.34-12.81-32.77-24.56-49.52l83.71-.15v-46H120.14l14.94-39.82c2.81-.33 7.32-1.05 9.42-3.11 2.7-2.64 1.09-6.93-2.05-8.8-.77-.45-5.04-1.23-6.32-1.26-1.73-.05-7.47-1.57-9-1.86C124.57 6.48 92.66.03 91.55.53c-1.6.72-2.21 4.13-2.24 5.73-.01.27-1.68 5.4-1.81 5.82-1.65 5.27-3.13 10.51-4.97 15.9-15.08 44.14-34.04 81.2-67.79 114.87M319.42 0c-.1 2.97-1.28 7.3-1.96 10.39a310 310 0 0 1-5 19.61c-9.83 34.26-24.92 69.3-47.44 98.56-7.23 9.4-15.93 17.8-23.9 26.55l34.31 36.7c15.35-14.94 28.04-30.54 38.98-48.64 1.81-3 4.16-5.79 5.85-8.98 4.74-8.94 9.57-17.48 14.35-26.4h38.8c2.65 3.82 4.09 7.99 6.15 12.29 5.96 12.45 10.23 25.18 14.9 38 .16.45.63.7.78 1.14.2.58.03 1.58.25 2.34 1.14 4.05 1.92 6.86 3.39 10.55L455 159.88c-2.11-5.4-3.76-10.9-5.9-16.28a135 135 0 0 0-21.3-35.53l115.51-.28v-46l-194.28-.02 14.92-39.83c3.5-.38 11.48-1.53 10.42-6.54-.12-.6-.02-1.7-.37-2.18-.8-1.11-2.15-2.39-3.13-3.41ZM120.33 258.79H17.29v46.03l100.59.05c-1.81 5.25-4.07 9.87-6.37 14.94-.23.51-.1 1.06-.3 1.52-.97 2.3-2.82 4.56-3.76 7.13-1.96 5.4-6.09 12.24-8.86 17.2-16.42 29.38-37.27 58.88-63.05 82.31a237 237 0 0 1-14.62 12.15c-1.34 1.03-2.65 2.53-3.92 3.45-5.5 4.03-11.54 7.6-17 11.87l26.9 53.69c1.97-1.77 4.99-3.07 6.96-4.77 4.62-3.97 9.9-7.35 14.5-11.39 25.17-22.16 45.9-46.38 61.03-75.77.25-.5 1.23-1.48 1.64-2.22 3.07-5.64 7.16-12.7 8.92-18.66l.35 176.96h49l.07-191.87c5.32 3.26 10.68 8.14 15.52 12.14 12.05 9.96 24.5 20.98 35.1 32.58 5.57 6.1 10.63 12.79 16.08 18.93l29.25-48.74c-28.44-28.22-62.03-47.43-96.02-66.6v-24.94H263V258.8h-93.7v-61.67c4.02-3.86 7.64-4.88 8.06-10.72-6.91-6.72-19.15-4.2-28.58-4.2l-28.46-.05ZM287.8 568.41h41.5v-19.6h155.22v11.96h41.8v-346.6H287.8Zm196.75-314.98v59.35H329.31v-59.35Zm0 98.37V411H329.31v-59.2Zm-.03 98.2v59.78H329.48c-.52-19.66-.6-40.1.05-59.75 25.52-.56 51.23-.28 76.77-.28 26.03 0 52.21-.28 78.22.26';

// --- Lecture du contour ---------------------------------------------------------

function tokens(d) {
  return d.match(/[MmLlHhVvCcSsQqTtAaZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/g);
}

/** Arc elliptique (paramètres SVG) en courbes de Bézier cubiques. */
function arcToCubics(x1, y1, rx, ry, phiDeg, large, sweep, x2, y2) {
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const xp = cos * dx + sin * dy;
  const yp = -sin * dx + cos * dy;
  let a = Math.abs(rx);
  let b = Math.abs(ry);
  const lambda = (xp * xp) / (a * a) + (yp * yp) / (b * b);
  if (lambda > 1) {
    a *= Math.sqrt(lambda);
    b *= Math.sqrt(lambda);
  }
  const num = a * a * b * b - a * a * yp * yp - b * b * xp * xp;
  const den = a * a * yp * yp + b * b * xp * xp;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (k * a * yp) / b;
  const cyp = (-k * b * xp) / a;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const s = ux * vy - uy * vx < 0 ? -1 : 1;
    const c = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
    return s * Math.acos(Math.max(-1, Math.min(1, c)));
  };
  const t1 = ang(1, 0, (xp - cxp) / a, (yp - cyp) / b);
  let dt = ang((xp - cxp) / a, (yp - cyp) / b, (-xp - cxp) / a, (-yp - cyp) / b);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const step = dt / n;
  const kk = (4 / 3) * Math.tan(step / 4);
  const pt = (t) => {
    const ex = a * Math.cos(t);
    const ey = b * Math.sin(t);
    return [cx + cos * ex - sin * ey, cy + sin * ex + cos * ey];
  };
  const der = (t) => {
    const ex = -a * Math.sin(t);
    const ey = b * Math.cos(t);
    return [cos * ex - sin * ey, sin * ex + cos * ey];
  };
  const out = [];
  for (let i = 0; i < n; i++) {
    const ta = t1 + i * step;
    const tb = ta + step;
    const [pax, pay] = pt(ta);
    const [pbx, pby] = pt(tb);
    const [dax, day] = der(ta);
    const [dbx, dby] = der(tb);
    out.push([pax + kk * dax, pay + kk * day, pbx - kk * dbx, pby - kk * dby, pbx, pby]);
  }
  return out;
}

/** Sous-chemins du contour : listes de points, courbes aplaties finement. */
function parse(d) {
  const tk = tokens(d);
  const subs = [];
  let cur = null;
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let lastC = null; // dernier point de contrôle (pour S)
  let lastQ = null; // dernier point de contrôle (pour T)
  const num = () => Number(tk[i++]);
  const isNum = () => i < tk.length && !/^[A-Za-z]$/.test(tk[i]);
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    // aplatissement fin : 16 pas par courbe suffisent à la taille du logo
    const [x0, y0] = [x, y];
    for (let s = 1; s <= 16; s++) {
      const t = s / 16;
      const u = 1 - t;
      cur.push([
        u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      ]);
    }
    x = x3;
    y = y3;
  };
  const lineTo = (nx, ny) => {
    cur.push([nx, ny]);
    x = nx;
    y = ny;
  };
  while (i < tk.length) {
    if (!isNum()) cmd = tk[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (C === 'Z') {
      if (cur && cur.length > 1) subs.push(cur);
      cur = null;
      x = sx;
      y = sy;
      lastC = null;
      lastQ = null;
      continue;
    }
    if (C === 'M') {
      if (cur && cur.length > 1) subs.push(cur);
      x = ox + num();
      y = oy + num();
      sx = x;
      sy = y;
      cur = [[x, y]];
      cmd = rel ? 'l' : 'L'; // les paires suivantes sont des droites
      lastC = null;
      lastQ = null;
      continue;
    }
    if (!cur) cur = [[x, y]];
    if (C === 'L') {
      lineTo(ox + num(), oy + num());
      lastC = null;
      lastQ = null;
    } else if (C === 'H') {
      lineTo(ox + num(), y);
      lastC = null;
      lastQ = null;
    } else if (C === 'V') {
      lineTo(x, oy + num());
      lastC = null;
      lastQ = null;
    } else if (C === 'C') {
      const p = [ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num()];
      lastC = [p[2], p[3]];
      lastQ = null;
      cubic(...p);
    } else if (C === 'S') {
      const [rx, ry] = lastC ? [2 * x - lastC[0], 2 * y - lastC[1]] : [x, y];
      const p = [ox + num(), oy + num(), ox + num(), oy + num()];
      lastC = [p[0], p[1]];
      lastQ = null;
      cubic(rx, ry, ...p);
    } else if (C === 'Q' || C === 'T') {
      let qx;
      let qy;
      if (C === 'Q') {
        qx = ox + num();
        qy = oy + num();
      } else {
        [qx, qy] = lastQ ? [2 * x - lastQ[0], 2 * y - lastQ[1]] : [x, y];
      }
      const ex = ox + num();
      const ey = oy + num();
      lastQ = [qx, qy];
      lastC = null;
      cubic(
        x + (2 / 3) * (qx - x),
        y + (2 / 3) * (qy - y),
        ex + (2 / 3) * (qx - ex),
        ey + (2 / 3) * (qy - ey),
        ex,
        ey,
      );
    } else if (C === 'A') {
      const rx = num();
      const ry = num();
      const rot = num();
      const large = num() !== 0;
      const sweep = num() !== 0;
      const ex = ox + num();
      const ey = oy + num();
      for (const seg of arcToCubics(x, y, rx, ry, rot, large, sweep, ex, ey)) cubic(...seg);
      lastC = null;
      lastQ = null;
    } else {
      throw new Error(`commande de chemin inattendue : ${cmd}`);
    }
  }
  if (cur && cur.length > 1) subs.push(cur);
  return subs;
}

const SUBPATHS = parse(KANJI_D);

/** La même lecture, pour le mot HAKO du logo (mot.mjs). */
export { parse as lireContour };

// --- Simplification (Douglas-Peucker) et écriture --------------------------------

function dpSimplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay) || 1e-9;
    let best = -1;
    let dist = 0;
    for (let k = a + 1; k < b; k++) {
      const [px, py] = pts[k];
      const dd = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
      if (dd > dist) {
        dist = dd;
        best = k;
      }
    }
    if (best > 0 && dist > tol) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

const r1 = (v) => Math.round(v * 10) / 10;

/**
 * Chemin du kanji projeté par map(gx, gy) -> [x, y], où (gx, gy) sont les
 * coordonnées du logo (0 à KANJI_W, 0 à KANJI_H). tol : écart toléré, en unités
 * du dessin, pour retirer les points inutiles (invisible à la taille dessinée).
 */
export function kanjiD(map, tol = 0.12) {
  let d = '';
  for (const sub of SUBPATHS) {
    const pts = sub.map(([gx, gy]) => map(gx, gy));
    // fermer proprement : le dernier point rejoint le premier
    const [fx, fy] = pts[0];
    const [lx, ly] = pts.at(-1);
    if (Math.hypot(fx - lx, fy - ly) < 1e-6) pts.pop();
    // contour fermé : on le coupe en deux au point le plus éloigné du premier
    let far = 0;
    let fd = -1;
    for (let k = 1; k < pts.length; k++) {
      const dd = Math.hypot(pts[k][0] - fx, pts[k][1] - fy);
      if (dd > fd) {
        fd = dd;
        far = k;
      }
    }
    const simple = [
      ...dpSimplify(pts.slice(0, far + 1), tol).slice(0, -1),
      ...dpSimplify([...pts.slice(far), pts[0]], tol).slice(0, -1),
    ];
    if (simple.length < 3) continue;
    d += `M${r1(simple[0][0])} ${r1(simple[0][1])}`;
    for (let k = 1; k < simple.length; k++) d += `L${r1(simple[k][0])} ${r1(simple[k][1])}`;
    d += 'Z';
  }
  return d;
}
