// Petite boîte à outils du « papier découpé ».
//
// Chaque dessin est décrit à la main (coordonnées choisies une à une) dans
// dessins.mjs. Ce module ajoute seulement l'irrégularité d'une coupe aux
// ciseaux, toujours la même pour un même fichier (tirage pseudo-aléatoire
// initialisé par le nom du fichier), et l'ombre plate décalée sous les couches.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const C = {
  creme: '#FDF7EF',
  chocolat: '#412D1E',
  sable: '#F2E6D6',
  lin: '#E6D5BF',
  noyer: '#5F3E27', // le noyer du socle du prototype
  terre: '#9A4E2B',
  caramel: '#B9773F',
  olive: '#5E6B45',
  pierre: '#BAB1A7', // le fond gris chaud des images du prototype ; à petites doses
  perle: '#E3D9C6', // la coque du prototype, RAL 1013 « blanc perlé »
};

// L'ombre prend le ton plus sombre du papier sur lequel elle tombe.
export const OMBRE = {
  page: C.lin,
  creme: C.lin,
  sable: C.lin,
  lin: C.caramel,
  caramel: C.noyer,
  terre: C.chocolat,
  olive: C.chocolat,
  noyer: C.chocolat,
  pierre: C.noyer,
  perle: C.pierre,
};

// --- Tirage reproductible ---------------------------------------------------

function hash(text) {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rand = mulberry32(1);
export const seed = (text) => {
  rand = mulberry32(hash(text));
};
/** Écart aléatoire dans [-a, a]. */
export const jit = (a) => (rand() * 2 - 1) * a;

const r1 = (v) => Math.round(v * 10) / 10;

// --- Contours ------------------------------------------------------------------

/**
 * Chemin SVG d'une suite de nœuds { x, y, s } : s vrai = point lissé (courbe
 * de Catmull-Rom), s faux = angle vif (segment droit).
 */
export function toD(nodes, closed = true) {
  const n = nodes.length;
  const at = (i) => nodes[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  const tan = (i) => {
    const p = at(i - 1);
    const q = at(i + 1);
    return { x: (q.x - p.x) / 6, y: (q.y - p.y) / 6 };
  };
  // Les poignées ne dépassent pas le tiers du segment : un angle adouci entre
  // deux côtés longs reste un arrondi, sans petite boucle qui déborde.
  const clamp = (t, len) => {
    const m = Math.hypot(t.x, t.y);
    const lim = len / 3;
    return m > lim ? { x: (t.x * lim) / m, y: (t.y * lim) / m } : t;
  };
  let d = `M${r1(nodes[0].x)} ${r1(nodes[0].y)}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = at(i);
    const b = at(i + 1);
    if (!a.s && !b.s) {
      d += `L${r1(b.x)} ${r1(b.y)}`;
      continue;
    }
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ta = a.s ? clamp(tan(i), len) : { x: 0, y: 0 };
    const tb = b.s ? clamp(tan(i + 1), len) : { x: 0, y: 0 };
    d += `C${r1(a.x + ta.x)} ${r1(a.y + ta.y)} ${r1(b.x - tb.x)} ${r1(b.y - tb.y)} ${r1(b.x)} ${r1(b.y)}`;
  }
  return closed ? `${d}Z` : d;
}

/**
 * Contour coupé aux ciseaux : les côtés longs sont redécoupés en segments
 * presque droits, légèrement désaxés. Un point [x, y, true] est lissé.
 */
export function cut(points, { j = 1, seg = 48 } = {}) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0, s0] = points[i];
    const [x1, y1] = points[(i + 1) % n];
    out.push({ x: x0 + jit(j * 0.5), y: y0 + jit(j * 0.5), s: Boolean(s0) });
    const len = Math.hypot(x1 - x0, y1 - y0);
    const k = Math.floor(len / seg);
    if (k < 2) continue;
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    for (let m = 1; m < k; m++) {
      const t = (m + jit(0.15)) / k;
      const o = jit(j * 0.6);
      out.push({ x: x0 + (x1 - x0) * t + nx * o, y: y0 + (y1 - y0) * t + ny * o, s: false });
    }
  }
  return out;
}

/** Points d'un rectangle aux coins arrondis (r : un rayon ou [hg, hd, bd, bg]). */
export function rrectPts(x, y, w, h, r = 0) {
  const [a, b, c, d] = Array.isArray(r) ? r : [r, r, r, r];
  const pts = [];
  const arc = (cx, cy, rad, a0) => {
    if (rad < 4) {
      // petit rayon : un simple pan coupé suffit à l'œil
      pts.push([cx + rad * Math.cos(a0), cy + rad * Math.sin(a0)]);
      pts.push([cx + rad * Math.cos(a0 + Math.PI / 2), cy + rad * Math.sin(a0 + Math.PI / 2)]);
      return;
    }
    const steps = rad > 40 ? 4 : rad > 12 ? 2 : 1;
    for (let i = 0; i <= steps; i++) {
      const t = a0 + (i / steps) * (Math.PI / 2);
      pts.push([cx + rad * Math.cos(t), cy + rad * Math.sin(t), true]);
    }
  };
  if (a < 1) pts.push([x, y]);
  else arc(x + a, y + a, a, Math.PI);
  if (b < 1) pts.push([x + w, y]);
  else arc(x + w - b, y + b, b, -Math.PI / 2);
  if (c < 1) pts.push([x + w, y + h]);
  else arc(x + w - c, y + h - c, c, 0);
  if (d < 1) pts.push([x, y + h]);
  else arc(x + d, y + h - d, d, Math.PI / 2);
  return pts;
}

export const rrect = (x, y, w, h, r = 0, o = {}) => cut(rrectPts(x, y, w, h, r), o);

/** Polygone aux angles adoucis : chaque sommet devient deux points lissés. */
export function soft(points, r = 4, o = {}) {
  const pts = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const [px, py] = points[(i - 1 + n) % n];
    const [x, y, keep] = points[i];
    const [qx, qy] = points[(i + 1) % n];
    if (keep === 'vif' || r <= 0) {
      pts.push([x, y]);
      continue;
    }
    const l1 = Math.hypot(px - x, py - y);
    const l2 = Math.hypot(qx - x, qy - y);
    const k1 = Math.min(r, l1 / 2.2) / l1;
    const k2 = Math.min(r, l2 / 2.2) / l2;
    pts.push([x + (px - x) * k1, y + (py - y) * k1, true]);
    pts.push([x + (qx - x) * k2, y + (qy - y) * k2, true]);
  }
  return cut(pts, o);
}

/** Ellipse coupée à la main (nœuds lissés, rayon légèrement irrégulier). */
export function ell(cx, cy, rx, ry = rx, { j = 1, n, rot = 0 } = {}) {
  const count =
    n ?? (Math.max(rx, ry) < 7 ? 6 : Math.max(7, Math.round((Math.PI * (rx + ry)) / 26)));
  const a0 = rand() * Math.PI * 2;
  const cr = Math.cos((rot * Math.PI) / 180);
  const sr = Math.sin((rot * Math.PI) / 180);
  const amp = Math.min(1.4, 0.25 + 0.02 * Math.max(rx, ry)) * j;
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = a0 + (i / count) * Math.PI * 2;
    const k = 1 + jit(amp) / Math.max(rx, ry);
    const px = rx * k * Math.cos(t);
    const py = ry * k * Math.sin(t);
    out.push({ x: cx + px * cr - py * sr, y: cy + px * sr + py * cr, s: true });
  }
  return out;
}

/** Forme libre lissée passant par les points donnés. */
export const blob = (points, { j = 1 } = {}) =>
  points.map(([x, y, vif]) => ({ x: x + jit(j * 0.5), y: y + jit(j * 0.5), s: vif !== 'vif' }));

/** Feuille pointue (deux arcs), centrée en (cx, cy), inclinée de deg. */
export function leaf(cx, cy, len, wid, deg = 0) {
  const pts = [
    [0, -len / 2, 'vif'],
    [wid / 2, -len * 0.08],
    [wid * 0.28, len * 0.3],
    [0, len / 2, 'vif'],
    [-wid * 0.28, len * 0.3],
    [-wid / 2, -len * 0.08],
  ];
  return turn(blob(pts, { j: 0.6 }), deg, 0, 0).map((p) => ({ ...p, x: p.x + cx, y: p.y + cy }));
}

/** Rotation de nœuds autour de (cx, cy). */
export function turn(nodes, deg, cx, cy) {
  const c = Math.cos((deg * Math.PI) / 180);
  const s = Math.sin((deg * Math.PI) / 180);
  return nodes.map((p) => ({
    ...p,
    x: cx + (p.x - cx) * c - (p.y - cy) * s,
    y: cy + (p.x - cx) * s + (p.y - cy) * c,
  }));
}

export const shift = (nodes, dx, dy) => nodes.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
export const mapNodes = (nodes, fn) =>
  nodes.map((p) => {
    const [x, y] = fn(p.x, p.y);
    return { ...p, x, y };
  });

/** Ligne à main levée : points [x, y] reliés, légèrement repris à la main. */
export function strokeD(points, { smooth = true, closed = false, j = 0.4 } = {}) {
  const nodes = points.map(([x, y], i) => {
    const end = !closed && (i === 0 || i === points.length - 1);
    return { x: x + (end ? 0 : jit(j)), y: y + (end ? 0 : jit(j)), s: smooth };
  });
  return toD(nodes, closed);
}

// --- Document -------------------------------------------------------------------

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class Svg {
  /**
   * @param {string} file chemin relatif dans la série, ex. "icones/engagement-zero-acces.svg"
   * @param {number} w largeur du viewBox
   * @param {number} h hauteur du viewBox
   * @param {{ title: string, desc: string, sh?: number[], trait?: number }} o
   */
  constructor(file, w, h, { title, desc, sh = [3, 5], trait = 5 }) {
    this.file = file;
    this.w = w;
    this.h = h;
    this.title = title;
    this.desc = desc;
    this.sh = sh;
    this.trait = trait;
    this.name = path.basename(file, '.svg');
    seed(this.name);
    this.defs = [];
    this.body = [];
    this.marques = [];
    this.k = 0;
  }

  /**
   * Repère dans la pile des couches. Une ombre peut y être glissée plus tard
   * (paramètre sous de obj) : elle passe alors sous les pièces posées depuis le
   * repère, comme une étagère ou un meuble, qui cachent la part de l'ombre qui
   * tomberait sur eux. Seule la part tombée sur le mur reste visible.
   */
  marque() {
    const m = { i: this.body.length };
    this.marques.push(m);
    return m;
  }

  /** Ajoute un élément en haut de la pile, ou à un repère (marque()). */
  emit(markup, sous = null) {
    if (!sous) {
      this.body.push(markup);
      return;
    }
    const at = sous.i;
    this.body.splice(at, 0, markup);
    for (const m of this.marques) if (m.i >= at) m.i += 1;
  }

  newId() {
    const id = `${this.name}-${this.k.toString(36)}`;
    this.k += 1;
    return id;
  }

  /** Forme pleine réutilisable (pour son ombre et sa face). */
  def(nodes) {
    const id = this.newId();
    const d = typeof nodes === 'string' ? nodes : toD(nodes);
    this.defs.push(`<path id="${id}" d="${d}"/>`);
    return { id, kind: 'fill' };
  }

  /** Bande de papier (trait) réutilisable. */
  defLine(points, width, o = {}) {
    const id = this.newId();
    const d = typeof points === 'string' ? points : strokeD(points, o);
    this.defs.push(
      `<path id="${id}" d="${d}" fill="none" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
    return { id, kind: 'stroke' };
  }

  use(ref, color) {
    const attr = ref.kind === 'stroke' ? 'stroke' : 'fill';
    this.body.push(`<use href="#${ref.id}" ${attr}="${color}"/>`);
  }

  /** Ombre plate décalée d'une ou plusieurs formes (sous : un repère de marque()). */
  shadow(refs, color = C.lin, offset = this.sh, sous = null) {
    const list = [].concat(refs);
    if (list.length === 0) return;
    const [dx, dy] = offset;
    const inner = list
      .map((r) =>
        r.kind === 'stroke' ? `<use href="#${r.id}" stroke="${color}"/>` : `<use href="#${r.id}"/>`,
      )
      .join('');
    this.emit(`<g fill="${color}" transform="translate(${dx} ${dy})">${inner}</g>`, sous);
  }

  /** Pièce de papier simple, avec son ombre si sh est donné. */
  piece(nodes, color, sh = null, offset = this.sh) {
    if (!sh) {
      this.path(nodes, color);
      return null;
    }
    const ref = this.def(nodes);
    this.shadow(ref, sh, offset);
    this.use(ref, color);
    return ref;
  }

  path(nodes, color) {
    const d = typeof nodes === 'string' ? nodes : toD(nodes);
    this.body.push(`<path d="${d}" fill="${color}"/>`);
  }

  line(points, color, width, o = {}) {
    const d = typeof points === 'string' ? points : strokeD(points, o);
    const dash = o.dash ? ` stroke-dasharray="${o.dash}"` : '';
    const cap = o.cap ?? 'round';
    this.body.push(
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round"${dash}/>`,
    );
  }

  raw(markup) {
    this.body.push(markup);
  }

  /**
   * Objet fait de plusieurs pièces : une seule ombre pour toute sa silhouette.
   * Dans fn, o.piece(nodes, couleur) et o.line(points, couleur, épaisseur)
   * comptent dans l'ombre ; o.detail(...) et o.trait(...) n'y comptent pas.
   * Les pièces consécutives de même couleur sont réunies en un seul chemin.
   * sous : un repère de marque(), pour glisser l'ombre sous un appui déjà posé.
   */
  obj(sh, fn, offset = this.sh, sous = null) {
    const items = [];
    const push = (item) => {
      const last = items.at(-1);
      if (
        last &&
        last.kind === item.kind &&
        last.color === item.color &&
        last.width === item.width &&
        last.cap === item.cap &&
        last.shadow === item.shadow
      ) {
        last.d += item.d;
        return;
      }
      items.push(item);
    };
    const dOf = (nodes) => (typeof nodes === 'string' ? nodes : toD(nodes));
    const lineD = (points, o) => (typeof points === 'string' ? points : strokeD(points, o));
    const api = {
      piece: (nodes, color) => push({ kind: 'fill', color, d: dOf(nodes), shadow: true }),
      line: (points, color, width, o = {}) =>
        push({
          kind: 'stroke',
          color,
          d: lineD(points, o),
          width,
          cap: o.cap ?? 'round',
          shadow: true,
        }),
      detail: (nodes, color) => push({ kind: 'fill', color, d: dOf(nodes), shadow: false }),
      trait: (points, color, width, o = {}) =>
        push({
          kind: 'stroke',
          color,
          d: lineD(points, o),
          width,
          cap: o.cap ?? 'round',
          shadow: false,
        }),
    };
    fn(api);
    const refs = [];
    for (const it of items) {
      if (!it.shadow) continue;
      const id = this.newId();
      if (it.kind === 'stroke') {
        this.defs.push(
          `<path id="${id}" d="${it.d}" fill="none" stroke-width="${it.width}" stroke-linecap="${it.cap}" stroke-linejoin="round"/>`,
        );
      } else {
        this.defs.push(`<path id="${id}" d="${it.d}"/>`);
      }
      it.ref = { id, kind: it.kind };
      refs.push(it.ref);
    }
    if (sh) this.shadow(refs, sh, offset, sous);
    for (const it of items) {
      if (it.ref) {
        this.use(it.ref, it.color);
      } else if (it.kind === 'stroke') {
        this.body.push(
          `<path d="${it.d}" fill="none" stroke="${it.color}" stroke-width="${it.width}" stroke-linecap="${it.cap}" stroke-linejoin="round"/>`,
        );
      } else {
        this.body.push(`<path d="${it.d}" fill="${it.color}"/>`);
      }
    }
  }

  toString() {
    const defs = this.defs.length ? `<defs>${this.defs.join('')}</defs>` : '';
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}">` +
      `<title>${esc(this.title)}</title><desc>${esc(this.desc)}</desc>` +
      `${defs}${this.body.join('')}</svg>\n`
    );
  }

  write(dir) {
    const out = path.join(dir, this.file);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, this.toString());
    return out;
  }
}
