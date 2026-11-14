// Le vocabulaire commun de la série : carte de fond, sol, box HAKO, box
// internet, photos, nuages, plantes, meubles et personnages ; à la fin, les
// objets ajoutés pour le guide d'installation (console, étagère murale, prise,
// bloc d'alimentation, sablier, téléphone, symbole du Wi-Fi).
import { KANJI_H, KANJI_W, kanjiD } from './kanji.mjs';
import { MOT_H, MOT_W, motD } from './mot.mjs';
import { C, cut, ell, leaf, mapNodes, rrect, soft, turn } from './papier.mjs';

// --- Décor -------------------------------------------------------------------------

/** Carte de fond : une feuille sable posée sur la page, avec son ombre lin. */
export function carte(sv, x, y, w, h, r = 40) {
  sv.piece(rrect(x, y, w, h, r, { j: 1.2, seg: 60 }), C.sable, C.lin);
}

/** Sol : une bande de papier lin posée sur la carte. */
export function sol(sv, x, y, w, h, r = 16) {
  sv.path(rrect(x, y, w, h, r, { j: 1, seg: 50 }), C.lin);
}

/**
 * Fenêtre découpée dans le mur : le jour (crème), un paysage de collines et
 * un cyprès, l'ombre de l'épaisseur du mur (lin), une croisée et un appui.
 */
export function fenetre(sv, x, y, w, h, { croisee = true, cypres = true } = {}) {
  const t = sv.trait;
  sv.path(rrect(x, y, w, h, 3, { j: 0.6 }), C.creme);
  // collines au loin
  sv.path(
    cut(
      [
        [x, y + h],
        [x, y + h * 0.7],
        [x + w * 0.3, y + h * 0.6, true],
        [x + w * 0.62, y + h * 0.7, true],
        [x + w, y + h * 0.62],
        [x + w, y + h],
      ],
      { j: 0.5 },
    ),
    C.lin,
  );
  sv.path(
    cut(
      [
        [x, y + h],
        [x, y + h * 0.84],
        [x + w * 0.45, y + h * 0.76, true],
        [x + w, y + h * 0.86],
        [x + w, y + h],
      ],
      { j: 0.5 },
    ),
    C.olive,
  );
  if (cypres) {
    const cx = x + w * 0.72;
    sv.path(
      cut(
        [
          [cx, y + h * 0.36, 'vif'],
          [cx + w * 0.055, y + h * 0.6, true],
          [cx + w * 0.045, y + h * 0.8],
          [cx - w * 0.045, y + h * 0.8],
          [cx - w * 0.055, y + h * 0.6, true],
        ],
        { j: 0.3 },
      ),
      C.olive,
    );
  }
  // ombre de l'épaisseur du mur, en haut et à gauche de l'ouverture
  const [dx, dy] = sv.sh;
  sv.path(
    cut(
      [
        [x, y],
        [x + w, y],
        [x + w, y + dy],
        [x + dx, y + dy],
        [x + dx, y + h],
        [x, y + h],
      ],
      { j: 0.2, seg: 400 },
    ),
    C.lin,
  );
  if (croisee) {
    sv.line(
      [
        [x + w / 2, y],
        [x + w / 2, y + h],
      ],
      C.sable,
      t,
      { smooth: false, cap: 'butt' },
    );
    sv.line(
      [
        [x, y + h * 0.45],
        [x + w, y + h * 0.45],
      ],
      C.sable,
      t,
      { smooth: false, cap: 'butt' },
    );
  }
  // appui de fenêtre
  sv.piece(rrect(x - w * 0.08, y + h - 1, w * 1.16, t * 2.2, 3, { j: 0.6 }), C.caramel, C.lin);
}

/** Étagère murale : une planche caramel et deux équerres noyer. */
export function etagere(sv, x, y, w, ep = 13) {
  sv.obj(C.lin, (o) => {
    o.piece(
      soft(
        [
          [x + w * 0.12, y + ep],
          [x + w * 0.12 + 22, y + ep],
          [x + w * 0.12, y + ep + 26],
        ],
        2,
      ),
      C.noyer,
    );
    o.piece(
      soft(
        [
          [x + w * 0.88, y + ep],
          [x + w * 0.88 - 22, y + ep],
          [x + w * 0.88, y + ep + 26],
        ],
        2,
      ),
      C.noyer,
    );
    o.piece(rrect(x, y, w, ep, 3, { j: 0.7 }), C.caramel);
  });
}

// --- La box HAKO (d'après le prototype) et la box internet ---------------------------

/**
 * Proportions de la box, relevées sur les images du modèle 3D du prototype :
 * dessus de 1,5 sur 1, coque haute d'environ 0,4 fois sa largeur, angles très
 * arrondis ; socle brun foncé (bois imprimé, peint en noyer) un peu en retrait
 * sous la coque, posé sur quatre petits pieds ; le kanji au centre du dessus ;
 * le mot HAKO au centre de la grande face avant, discret, comme une marque.
 * Mesures en part de la largeur de la coque.
 */
export const BOX = {
  profondeur: 2 / 3, // profondeur du dessus
  coque: 0.37, // hauteur de la face (0,4, vue d'un peu haut)
  rayon: 0.1, // rayon des angles, vus de dessus
  bord: 0.015, // bord arrondi entre le dessus et la face
  angle: 0.05, // angle de droite, qui tourne vers l'ombre
  socle: 0.035, // épaisseur du socle
  pieds: 0.028, // hauteur des pieds
  pied: 0.13, // largeur d'un pied, vu de face
  retrait: 0.022, // retrait du socle sous la coque, de chaque côté
  kanji: 0.26, // largeur du kanji
  mot: 0.3, // largeur du mot HAKO sur la face avant
  vue: 0.4, // raccourci de la profondeur : on voit le dessus d'un peu haut
  fuite: 0.045, // le dessus rétrécit un peu vers le fond, de chaque côté
};

/**
 * Repères d'un dessus arrondi vu de face et d'un peu haut. (cx, yFace) : milieu
 * du bord avant du dessus ; w et d : largeur et profondeur réelles ; r : rayon
 * des angles. dessus(u, v) donne un point du dessus : u de gauche (0) à droite
 * (1), v de l'avant (0) vers le fond (1).
 */
function plan(cx, yFace, w, d, r) {
  const t = d * BOX.vue;
  const k = 2 * BOX.fuite;
  const dessus = (u, v) => [cx + (u - 0.5) * w * (1 - k * v), yFace - v * t];
  const ru = r / w;
  const rv = r / d;
  const [xl, ys] = dessus(0, rv);
  const [xr] = dessus(1, rv);
  return { cx, w, t, yFace, yDos: yFace - t, dessus, ru, rv, xl, xr, ys };
}

/** Quart d'arrondi du dessus, de l'angle a0 à a1 autour du centre (cu, cv). */
function arc(p, cu, cv, a0, a1, pas = 3) {
  const out = [];
  for (let i = 0; i <= pas; i++) {
    const a = a0 + ((a1 - a0) * i) / pas;
    out.push([...p.dessus(cu + p.ru * Math.cos(a), cv + p.rv * Math.sin(a)), true]);
  }
  return out;
}

const PI = Math.PI;

/** Bord avant du dessus, de l'épaule gauche à l'épaule droite. */
const bordAvant = (p, pas) => [
  ...arc(p, p.ru, p.rv, PI, 1.5 * PI, pas),
  ...arc(p, 1 - p.ru, p.rv, 1.5 * PI, 2 * PI, pas),
];

/** Bord arrière du dessus (la silhouette), de l'épaule gauche à l'épaule droite. */
const bordArriere = (p, pas) => [
  ...arc(p, p.ru, 1 - p.rv, PI, PI / 2, pas),
  ...arc(p, 1 - p.ru, 1 - p.rv, PI / 2, 0, pas),
];

/** Point du bord avant à l'abscisse x (pour couper la bande d'ombre). */
function yBordAvant(p, x) {
  const pts = arc(p, 1 - p.ru, p.rv, 1.5 * PI, 2 * PI, 24);
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    if (x >= ax && x <= bx) return ay + ((by - ay) * (x - ax)) / (bx - ax || 1);
  }
  return p.yFace;
}

/** Points du kanji posé au centre du dessus p (largeur BOX.kanji du dessus). */
function kanjiSurDessus(p, map, tol) {
  const kw = BOX.kanji;
  const kh = (kw * (KANJI_H / KANJI_W) * p.w) / (p.t / BOX.vue);
  return kanjiD((gx, gy) => {
    const [x, y] = p.dessus(0.5 + (gx / KANJI_W - 0.5) * kw, 0.5 + (0.5 - gy / KANJI_H) * kh);
    return map ? map(x, y) : [x, y];
  }, tol);
}

/**
 * Points du mot HAKO centré sur la face avant de la box g (largeur BOX.mot de
 * la coque), à mi-hauteur entre le bord arrondi du dessus et le bas de la coque.
 * La face est vue de face : le mot garde ses proportions.
 */
function motSurFace(g, w, map) {
  const k = (w * BOX.mot) / MOT_W;
  const x0 = g.cx - (MOT_W * k) / 2;
  const y0 = (g.yFace + w * BOX.bord + g.yCoque) / 2 - (MOT_H * k) / 2;
  return motD((gx, gy) => {
    const pt = [x0 + gx * k, y0 + gy * k];
    return map ? map(...pt) : pt;
  });
}

/**
 * Repères de la box vue de face et d'un peu haut. (cx, yb) : milieu du bas, sous
 * les pieds (ou sous la coque, sans socle) ; w : largeur de la coque.
 */
export function boxGeo(cx, yb, w, { socle = true } = {}) {
  const yPieds = yb - (socle ? w * BOX.pieds : 0);
  const yCoque = yPieds - (socle ? w * BOX.socle : 0);
  const yFace = yCoque - w * BOX.coque;
  const p = plan(cx, yFace, w, w * BOX.profondeur, w * BOX.rayon);
  return { ...p, yb, yPieds, yCoque, x0: cx - w / 2, x1: cx + w / 2 };
}

/**
 * La box HAKO, comme le prototype : coque perle (RAL 1013, blanc perlé) aux
 * angles très arrondis, socle noyer un peu en retrait, posé sur ses pieds, le
 * kanji 箱 du logo au centre du dessus et, si mot est vrai, le mot HAKO du logo
 * sur la face avant (seulement là où il mesure au moins 14 px sur un écran de
 * 360 px : voir docs/illustrations.md). Une seule ombre pour toute la
 * silhouette ; le bord arrondi du dessus et l'angle de droite, qui tournent vers
 * l'ombre, sont en pierre (le lin, trop proche du perle, s'y perdrait).
 * (cx, yb) : milieu du bas, sous les pieds ; w : largeur de la coque.
 * socle : faux pour la coque seule (posée ou soulevée). map(x, y) : transformation
 * appliquée à tout le dessin (box penchée, box vue sur un écran). sous : repère
 * (sv.marque()) posé avant l'étagère ou le meuble qui porte la box, pour que
 * l'appui cache la part de l'ombre qui tomberait sur lui.
 */
export function boite(
  sv,
  cx,
  yb,
  w,
  {
    sh = C.lin,
    offset,
    sous = null,
    socle = true,
    kanji = true,
    mot = false,
    bord = C.pierre,
    angle = C.pierre,
    map,
    pas = 3,
  } = {},
) {
  const g = boxGeo(cx, yb, w, { socle });
  const M = (nodes) => (map ? mapNodes(nodes, map) : nodes);
  const j = Math.min(0.6, w / 200);
  const rb = w * 0.014;
  const e = w * BOX.bord;
  sv.obj(
    sh,
    (o) => {
      if (socle) {
        // socle et pieds (les deux pieds de devant, aux bouts du socle)
        const xs0 = g.x0 + w * BOX.retrait;
        const xs1 = g.x1 - w * BOX.retrait;
        const hp = g.yPieds - g.yCoque;
        const pw = w * BOX.pied;
        const rp = (yb - g.yPieds) * 0.9;
        o.piece(
          M(rrect(xs0, g.yPieds - 1, pw, yb - g.yPieds + 1, [0, 0, 0, rp], { j: 0.2 })),
          C.noyer,
        );
        o.piece(
          M(rrect(xs1 - pw, g.yPieds - 1, pw, yb - g.yPieds + 1, [0, 0, rp, 0], { j: 0.2 })),
          C.noyer,
        );
        o.piece(
          M(rrect(xs0, g.yCoque - 2, xs1 - xs0, hp + 2, [0, 0, hp * 0.6, hp * 0.6], { j: 0.3 })),
          C.noyer,
        );
      }
      // coque : la silhouette perle, du dessus jusqu'au bas de la face
      o.piece(
        M(
          cut(
            [
              [g.xl, g.yCoque - rb],
              [g.xl, g.ys, true],
              ...bordArriere(g, pas),
              [g.xr, g.ys, true],
              [g.xr, g.yCoque - rb],
              [g.xr - rb, g.yCoque],
              [g.xl + rb, g.yCoque],
            ],
            { j, seg: 60 },
          ),
        ),
        C.perle,
      );
      // angle de droite, qui tourne vers l'ombre, puis bord arrondi entre le
      // dessus et la face : la bande s'affine vers la gauche, côté lumière
      const xa = g.xr - w * BOX.angle;
      const avant = bordAvant(g, pas);
      const fin = (x) => Math.min(1, Math.max(0, (x - g.xl) / (w * 0.45)));
      o.detail(
        M(
          cut(
            [
              [xa, yBordAvant(g, xa) + e * 0.5],
              ...avant.filter(([x]) => x > xa).map(([x, y]) => [x, y + e * 0.5, true]),
              [g.xr, g.yCoque - rb],
              [g.xr - rb, g.yCoque],
              [xa, g.yCoque],
            ],
            { j: j * 0.5, seg: 80 },
          ),
        ),
        angle,
      );
      const dessous = avant
        .filter(([x]) => x > g.xl + 0.5)
        .map(([x, y]) => [x, y + e * fin(x), true])
        .reverse();
      o.detail(M(cut([...avant, ...dessous], { j: j * 0.5, seg: 80 })), bord);
      // écart toléré : 0,2 unité, invisible sous 200 de large ; plus fin au-delà
      if (kanji) o.detail(kanjiSurDessus(g, map, w > 200 ? 0.12 : 0.2), C.chocolat);
      if (mot) o.detail(motSurFace(g, w, map), C.chocolat);
    },
    offset,
    sous,
  );
  return g;
}

/**
 * Le socle seul (noyer), vu d'un peu haut (la box ouverte) : dessus bordé d'un
 * filet chocolat, fentes d'aération, quatre entretoises en laiton (caramel) qui
 * attendent la carte, et ses pieds. Mêmes repères que la box : (cx, yb) milieu
 * du bas, sous les pieds ; w : largeur de la coque qu'il porte.
 * Renvoie les repères du dessus du socle (dessus(u, v), pour y poser une carte).
 */
export function socle(
  sv,
  cx,
  yb,
  w,
  { sh = C.lin, offset, fentes = true, plots = true, map } = {},
) {
  const M = (nodes) => (map ? mapNodes(nodes, map) : nodes);
  const sw = w * (1 - 2 * BOX.retrait);
  const sd = w * (BOX.profondeur - 2 * BOX.retrait);
  const yPieds = yb - w * BOX.pieds;
  const yTop = yPieds - w * BOX.socle;
  const p = plan(cx, yTop, sw, sd, w * (BOX.rayon - BOX.retrait));
  const pw = w * BOX.pied;
  const rp = (yb - yPieds) * 0.9;
  const x0 = cx - sw / 2;
  const x1 = cx + sw / 2;
  const hp = yPieds - yTop;
  sv.obj(
    sh,
    (o) => {
      o.piece(M(rrect(x0, yPieds - 1, pw, yb - yPieds + 1, [0, 0, 0, rp], { j: 0.2 })), C.noyer);
      o.piece(
        M(rrect(x1 - pw, yPieds - 1, pw, yb - yPieds + 1, [0, 0, rp, 0], { j: 0.2 })),
        C.noyer,
      );
      // le dessus et la tranche avant, d'un seul tenant
      o.piece(
        M(
          cut(
            [
              [p.xl, yPieds - hp * 0.5],
              [p.xl, p.ys, true],
              ...bordArriere(p, 3),
              [p.xr, p.ys, true],
              [p.xr, yPieds - hp * 0.5],
              [p.xr - hp * 0.5, yPieds],
              [p.xl + hp * 0.5, yPieds],
            ],
            { j: 0.5, seg: 60 },
          ),
        ),
        C.noyer,
      );
      // filet chocolat : l'arête avant du dessus, dans l'ombre (sans les bouts)
      const avant = bordAvant(p, 3).slice(2, -2);
      o.trait(
        M(avant.map(([x, y]) => ({ x, y: y + hp * 0.15, s: true }))).map((n) => [n.x, n.y]),
        C.chocolat,
        Math.max(1.2, w * 0.009),
        { j: 0 },
      );
      if (fentes) {
        // deux rangées de fentes d'aération, comme sous le prototype
        for (const v of [0.34, 0.66]) {
          for (let i = 0; i < 7; i++) {
            const u = 0.22 + i * 0.07;
            const a = p.dessus(u, v - 0.08);
            const b = p.dessus(u, v + 0.08);
            o.trait(
              M([
                { x: a[0], y: a[1] },
                { x: b[0], y: b[1] },
              ]).map((n) => [n.x, n.y]),
              C.chocolat,
              Math.max(1.4, w * 0.016),
              { smooth: false, j: 0 },
            );
          }
        }
      }
      if (plots) {
        // entretoises en laiton, aux quatre trous de fixation de la carte
        for (const [u, v] of [
          [0.12, 0.18],
          [0.72, 0.18],
          [0.12, 0.82],
          [0.72, 0.82],
        ]) {
          const [px, py] = p.dessus(u, v);
          const s = w * 0.022;
          o.detail(
            M(rrect(px - s, py - s * 2.2, s * 2, s * 2.2, [0, 0, s * 0.5, s * 0.5], { j: 0.1 })),
            C.caramel,
          );
          o.detail(M(ell(px, py - s * 2.2, s, s * 0.45, { j: 0.05, n: 6 })), C.lin);
        }
      }
    },
    offset,
  );
  return { ...p, yb, yPieds, x0, x1 };
}

/**
 * La box internet : un boîtier gris (pierre) plus plat, aux angles vifs, deux
 * antennes noyer et trois petits voyants ; on la distingue de la box HAKO, perle
 * et arrondie sur son socle sombre, au premier coup d'œil. sous : comme pour
 * boite().
 */
export function routeur(sv, cx, yb, w, { sh = C.lin, sous = null } = {}) {
  const h = w * 0.32;
  const t = w * 0.18;
  const ins = w * 0.05;
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const yt = yb - h;
  const a = w * 0.055;
  sv.obj(
    sh,
    (o) => {
      o.line(
        [
          [x0 + w * 0.22, yt - t * 0.5],
          [x0 + w * 0.15, yt - t - w * 0.34],
        ],
        C.noyer,
        a,
        { smooth: false },
      );
      o.line(
        [
          [x1 - w * 0.22, yt - t * 0.5],
          [x1 - w * 0.15, yt - t - w * 0.34],
        ],
        C.noyer,
        a,
        { smooth: false },
      );
      o.piece(
        soft(
          [
            [x0 + ins, yt - t],
            [x1 - ins, yt - t],
            [x1, yt + 2],
            [x0, yt + 2],
          ],
          w * 0.02,
          { j: 0.5 },
        ),
        C.lin,
      );
      o.piece(
        rrect(x0, yt, w, h, [w * 0.015, w * 0.015, w * 0.03, w * 0.03], { j: 0.6 }),
        C.pierre,
      );
      for (let i = 0; i < 3; i++)
        o.detail(
          ell(x0 + w * (0.15 + i * 0.09), yt + h * 0.5, w * 0.025, w * 0.025, { j: 0.2 }),
          C.olive,
        );
    },
    undefined,
    sous,
  );
  return { x0, x1, yt, yb, h, t };
}

// --- Photos, nuages, cadenas, étiquettes ------------------------------------------------------------

/** Une photo : cadre crème, image lin avec une colline olive et un soleil caramel. */
export function photo(sv, cx, cy, w, deg = 0, { sh = C.lin, motif = 'colline' } = {}) {
  const h = w * 0.8;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const m = w * 0.085;
  const ix = x + m;
  const iy = y + m;
  const iw = w - 2 * m;
  const ih = h - 2 * m;
  const T = (nodes) => turn(nodes, deg, cx, cy);
  sv.obj(sh, (o) => {
    o.piece(T(rrect(x, y, w, h, w * 0.035, { j: Math.min(1, w / 60) })), C.creme);
    o.detail(T(rrect(ix, iy, iw, ih, w * 0.015, { j: 0.3 })), C.lin);
    if (motif === 'colline') {
      o.detail(
        T(
          cut(
            [
              [ix, iy + ih],
              [ix, iy + ih * 0.66],
              [ix + iw * 0.34, iy + ih * 0.44, true],
              [ix + iw * 0.66, iy + ih * 0.66, true],
              [ix + iw, iy + ih * 0.58],
              [ix + iw, iy + ih],
            ],
            { j: 0.2 },
          ),
        ),
        C.olive,
      );
      o.detail(
        T(ell(ix + iw * 0.74, iy + ih * 0.3, iw * 0.1, iw * 0.1, { j: 0.2, n: 7 })),
        C.caramel,
      );
    } else if (motif === 'portrait') {
      // deux personnes, épaules et têtes
      o.detail(
        T(
          rrect(ix + iw * 0.14, iy + ih * 0.62, iw * 0.36, ih * 0.5, [iw * 0.16, iw * 0.16, 0, 0], {
            j: 0.2,
          }),
        ),
        C.terre,
      );
      o.detail(
        T(ell(ix + iw * 0.32, iy + ih * 0.44, iw * 0.11, iw * 0.11, { j: 0.15, n: 8 })),
        C.noyer,
      );
      o.detail(
        T(
          rrect(ix + iw * 0.52, iy + ih * 0.7, iw * 0.3, ih * 0.4, [iw * 0.13, iw * 0.13, 0, 0], {
            j: 0.2,
          }),
        ),
        C.olive,
      );
      o.detail(
        T(ell(ix + iw * 0.67, iy + ih * 0.56, iw * 0.09, iw * 0.09, { j: 0.15, n: 8 })),
        C.caramel,
      );
    }
  });
}

/** Nuage générique : trois bosses sur une base plate, sans visage. */
export function nuage(sv, cx, yb, w, { couleur = C.creme, sh = C.lin } = {}) {
  const u = w / 100;
  sv.obj(sh, (o) => {
    o.piece(ell(cx - 25 * u, yb - 15 * u, 19 * u, 15 * u), couleur);
    o.piece(ell(cx + 3 * u, yb - 25 * u, 25 * u, 23 * u), couleur);
    o.piece(ell(cx + 29 * u, yb - 13 * u, 17 * u, 13 * u), couleur);
    o.piece(
      rrect(cx - 45 * u, yb - 16 * u, 91 * u, 16 * u, [0, 0, 8 * u, 8 * u], { j: 0.6 }),
      couleur,
    );
  });
}

/** Petit cadenas fermé (corps noyer, anse en bande de papier). */
export function cadenas(sv, cx, cy, s, { sh = C.lin, couleur = C.noyer } = {}) {
  sv.obj(sh, (o) => {
    o.line(
      [
        [cx - s * 0.3, cy],
        [cx - s * 0.3, cy - s * 0.42],
        [cx, cy - s * 0.66],
        [cx + s * 0.3, cy - s * 0.42],
        [cx + s * 0.3, cy],
      ],
      couleur,
      s * 0.16,
    );
    o.piece(rrect(cx - s * 0.5, cy - s * 0.12, s, s * 0.78, s * 0.12, { j: 0.4 }), couleur);
    o.detail(ell(cx, cy + s * 0.22, s * 0.09, s * 0.09, { j: 0.1, n: 6 }), C.lin);
  });
}

/** Étiquette de prix (sans chiffre), percée d'un œillet, au bout d'un fil. */
export function etiquette(sv, ax, ay, cx, cy, s, deg = 0, { sh = C.lin, couleur = C.terre } = {}) {
  // fil depuis le point d'attache (ax, ay) jusqu'à l'œillet
  const T = (nodes) => turn(nodes, deg, cx, cy);
  const hx = cx - s * 0.32;
  const hy = cy;
  const [rx, ry] = [
    cx + (hx - cx) * Math.cos((deg * Math.PI) / 180) - (hy - cy) * Math.sin((deg * Math.PI) / 180),
    cy + (hx - cx) * Math.sin((deg * Math.PI) / 180) + (hy - cy) * Math.cos((deg * Math.PI) / 180),
  ];
  sv.line(
    [
      [ax, ay],
      [(ax + rx) / 2 - s * 0.05, (ay + ry) / 2 + s * 0.12],
      [rx, ry],
    ],
    C.noyer,
    Math.max(1.2, s * 0.05),
  );
  sv.obj(sh, (o) => {
    o.piece(
      T(
        soft(
          [
            [cx - s * 0.5, cy],
            [cx - s * 0.22, cy - s * 0.3],
            [cx + s * 0.5, cy - s * 0.3],
            [cx + s * 0.5, cy + s * 0.3],
            [cx - s * 0.22, cy + s * 0.3],
          ],
          s * 0.06,
          { j: 0.4 },
        ),
      ),
      couleur,
    );
    o.detail(T(ell(hx, hy, s * 0.07, s * 0.07, { j: 0.1, n: 6 })), C.creme);
  });
}

// --- Plantes -----------------------------------------------------------------------------

/** Plante en pot de terre cuite : feuilles olive en éventail. sous : comme pour boite(). */
export function plante(
  sv,
  cx,
  yb,
  s,
  { pot = C.terre, sh = C.lin, feuilles, retombante = false, sous = null } = {},
) {
  const ph = s * 0.42;
  const top = yb - ph;
  const list = feuilles ?? [
    [-0.34, -0.62, 0.42, 0.17, -42],
    [-0.16, -0.86, 0.46, 0.18, -16],
    [0.06, -0.96, 0.48, 0.18, 6],
    [0.26, -0.8, 0.44, 0.17, 30],
    [0.4, -0.56, 0.38, 0.16, 56],
  ];
  sv.obj(
    sh,
    (o) => {
      for (const [dx, dy] of list) {
        o.line(
          [
            [cx, top + s * 0.02],
            [cx + dx * s * 0.55, top + dy * s * 0.55],
          ],
          C.olive,
          Math.max(1.2, s * 0.025),
        );
      }
      for (const [dx, dy, l, wd, a] of list)
        o.piece(leaf(cx + dx * s, top + dy * s * 0.75, l * s, wd * s, a), C.olive);
      if (retombante) {
        o.line(
          [
            [cx + s * 0.2, top + 2],
            [cx + s * 0.42, top + s * 0.1],
            [cx + s * 0.5, top + s * 0.45],
            [cx + s * 0.46, top + s * 0.8],
          ],
          C.olive,
          Math.max(1.2, s * 0.025),
        );
        o.piece(leaf(cx + s * 0.5, top + s * 0.38, s * 0.2, s * 0.11, 20), C.olive);
        o.piece(leaf(cx + s * 0.44, top + s * 0.62, s * 0.2, s * 0.11, -20), C.olive);
        o.piece(leaf(cx + s * 0.5, top + s * 0.84, s * 0.2, s * 0.11, 15), C.olive);
      }
      o.piece(
        soft(
          [
            [cx - s * 0.24, top + s * 0.07],
            [cx + s * 0.24, top + s * 0.07],
            [cx + s * 0.18, yb],
            [cx - s * 0.18, yb],
          ],
          s * 0.03,
          {
            j: 0.5,
          },
        ),
        pot,
      );
      o.piece(rrect(cx - s * 0.28, top, s * 0.56, s * 0.11, s * 0.03, { j: 0.4 }), pot);
    },
    undefined,
    sous,
  );
}

// --- Personnages (sans visage) ---------------------------------------------------------------

const PROP = {
  adulte: { tete: 9, epaules: 31, tronc: 35, taille: 25, jambe: 10, bras: 8.6 },
  aine: { tete: 9.4, epaules: 30, tronc: 35, taille: 27, jambe: 10, bras: 8.6 },
  enfant: { tete: 12.5, epaules: 31, tronc: 30, taille: 27, jambe: 11, bras: 9.5 },
};

/**
 * Coiffure dessinée autour d'une tête (hx, hy, r).
 * regard : -1 regarde vers la gauche, 1 vers la droite, 0 de face.
 * Renvoie { derriere, devant } : listes de [nœuds, couleur].
 */
export function coiffure(style, hx, hy, r, couleur, regard = 0) {
  const g = regard;
  const P = (pts) =>
    cut(
      pts.map(([px, py, s]) => [hx + px * r, hy + py * r, s]),
      { j: 0.4 },
    );
  const cap = (frange = -0.18) =>
    P([
      [-1.05 - 0.04 * g, 0.28 + 0.18 * Math.max(0, g), 'vif'],
      [-1.12, -0.3, true],
      [-0.78, -0.96, true],
      [0.02 * g, -1.14, true],
      [0.8, -0.94, true],
      [1.12, -0.3, true],
      [1.05 - 0.04 * g, 0.28 + 0.18 * Math.max(0, -g), 'vif'],
      [0.84 - 0.2 * Math.max(0, -g) * 2, 0.2],
      [0.8 - 0.3 * Math.max(0, -g), frange - 0.02, true],
      [0.3 + 0.35 * g, frange - 0.2, true],
      [-0.4 + 0.35 * g, frange - 0.1, true],
      [-0.8 + 0.3 * Math.max(0, g), frange, true],
      [-0.84 + 0.4 * Math.max(0, g), 0.2],
    ]);
  const out = { derriere: [], devant: [] };
  if (style === 'long') {
    out.derriere.push([
      P([
        [-1.18, -0.2, true],
        [-0.9, -0.95, true],
        [0, -1.15, true],
        [0.9, -0.95, true],
        [1.18, -0.2, true],
        [1.22, 1.3, true],
        [1.05, 1.95],
        [-1.05, 1.95],
        [-1.22, 1.3, true],
      ]),
      couleur,
    ]);
    out.devant.push([cap(-0.22), couleur]);
  } else if (style === 'chignon') {
    const bx = g === 0 ? 0 : -g * 0.92;
    const by = g === 0 ? -1.2 : -0.72;
    out.derriere.push([ell(hx + bx * r, hy + by * r, r * 0.46, r * 0.42, { j: 0.4 }), couleur]);
    out.devant.push([cap(-0.3), couleur]);
  } else if (style === 'boucles') {
    const bumps = [
      [-0.95, -0.15],
      [-0.86, -0.66],
      [-0.42, -0.98],
      [0.12, -1.06],
      [0.62, -0.88],
      [0.95, -0.42],
      [0.98, 0.08],
    ];
    for (const [bx, by] of bumps)
      out.devant.push([
        ell(hx + bx * r, hy + by * r, r * 0.36, r * 0.36, { j: 0.3, n: 7 }),
        couleur,
      ]);
    out.devant.push([cap(-0.38), couleur]);
  } else if (style === 'queue') {
    out.derriere.push([
      P([
        [0.7 * (g || 1), -0.6, true],
        [1.35 * (g || 1), -0.2, true],
        [1.5 * (g || 1), 0.7, true],
        [1.2 * (g || 1), 0.9, true],
        [0.9 * (g || 1), 0.1, true],
      ]),
      couleur,
    ]);
    out.devant.push([cap(-0.2), couleur]);
  } else if (style === 'ras') {
    out.devant.push([cap(-0.5), couleur]);
  } else {
    out.devant.push([cap(-0.16), couleur]);
  }
  return out;
}

/**
 * Personne debout, de face, sans visage.
 * o : { x, y (sol), h (taille), age, peau, cheveux, coiffure, haut, bas, robe,
 *       chaussures, regard, carrure, brasG, brasD (points relatifs à l'épaule, en
 *       unités u = h/100), sh, devant (fonction appelée après le tronc) }
 */
export function personne(sv, o) {
  const P = PROP[o.age ?? 'adulte'];
  const u = o.h / 100;
  const g = o.regard ?? 0;
  const hr = P.tete * u;
  const hx = o.x + g * 1.6 * u;
  const hy = o.y - o.h + hr;
  const ys = hy + hr + 1.4 * u;
  const sw = P.epaules * u * (o.carrure ?? 1);
  const wst = P.taille * u * (o.carrure ?? 1);
  const yh = ys + P.tronc * u;
  const coif = coiffure(o.coiffure ?? 'court', hx, hy, hr, o.cheveux ?? C.chocolat, g);
  const shoulder = (side) => [o.x + side * (sw / 2 - P.bras * u * 0.55), ys + P.bras * u * 0.55];
  const arm = (side, rel) => {
    const [sx, sy] = shoulder(side);
    return rel.map(([dx, dy]) => [sx + dx * u, sy + dy * u]);
  };
  const brasG = o.brasG ?? [
    [0, 0],
    [-2, 16],
    [-2.5, 31],
  ];
  const brasD = o.brasD ?? [
    [0, 0],
    [2, 16],
    [2.5, 31],
  ];
  const pts = {
    tete: [hx, hy, hr],
    epaules: ys,
    hanches: yh,
    mainG: arm(-1, brasG).at(-1),
    mainD: arm(1, brasD).at(-1),
  };
  sv.obj(o.sh === undefined ? C.lin : o.sh, (b) => {
    // jambes
    const lw = P.jambe * u;
    const legX = wst / 2 - lw / 2 - 0.4 * u;
    for (const side of [-1, 1]) {
      b.line(
        [
          [o.x + side * legX, yh - 4 * u],
          [o.x + side * legX * 1.02, o.y - 3.5 * u],
        ],
        o.bas ?? C.noyer,
        lw,
        {
          smooth: false,
          cap: 'butt',
        },
      );
    }
    for (const side of [-1, 1]) {
      b.detail(
        ell(o.x + side * legX + g * 2 * u, o.y - 2.6 * u, lw * 0.62, 2.9 * u, { j: 0.3, n: 6 }),
        o.chaussures ?? C.chocolat,
      );
    }
    for (const [nodes, col] of coif.derriere) b.piece(nodes, col);
    // tronc
    b.piece(
      soft(
        [
          [o.x - sw / 2, ys + 3 * u],
          [o.x - sw * 0.28, ys],
          [o.x + sw * 0.28, ys],
          [o.x + sw / 2, ys + 3 * u],
          [o.x + wst / 2, yh],
          [o.x - wst / 2, yh],
        ],
        4.5 * u,
        { j: 0.6 },
      ),
      o.haut,
    );
    if (o.robe) {
      b.piece(
        soft(
          [
            [o.x - wst / 2, yh - 6 * u],
            [o.x + wst / 2, yh - 6 * u],
            [o.x + wst * 0.78, yh + 24 * u],
            [o.x - wst * 0.78, yh + 24 * u],
          ],
          3 * u,
          { j: 0.5 },
        ),
        o.robe,
      );
    }
    // tête
    b.piece(ell(hx, hy, hr, hr * 1.04, { j: 0.6 }), o.peau);
    for (const [nodes, col] of coif.devant) b.piece(nodes, col);
    if (o.devant) o.devant(b, pts);
    // bras puis mains
    const bras = [arm(-1, brasG), arm(1, brasD)];
    for (const pp of bras) b.line(pp, o.manches ?? o.haut, P.bras * u);
    for (const pp of bras) {
      const [mx, my] = pp.at(-1);
      b.piece(ell(mx, my, P.bras * u * 0.5, P.bras * u * 0.52, { j: 0.3, n: 6 }), o.peau);
    }
  });
  return pts;
}

/** Personne assise de face (sur un canapé) : jambes qui descendent du siège. */
export function assise(sv, o) {
  const P = PROP[o.age ?? 'adulte'];
  const u = o.h / 100; // taille debout de référence
  const g = o.regard ?? 0;
  const hr = P.tete * u;
  const ys = o.siege - P.tronc * u + 2 * u; // épaules
  const hy = ys - 1.4 * u - hr;
  const hx = o.x + g * 1.6 * u;
  const sw = P.epaules * u * (o.carrure ?? 1);
  const wst = P.taille * u * (o.carrure ?? 1);
  const coif = coiffure(o.coiffure ?? 'court', hx, hy, hr, o.cheveux ?? C.chocolat, g);
  const shoulder = (side) => [o.x + side * (sw / 2 - P.bras * u * 0.55), ys + P.bras * u * 0.55];
  const arm = (side, rel) => {
    const [sx, sy] = shoulder(side);
    return rel.map(([dx, dy]) => [sx + dx * u, sy + dy * u]);
  };
  const brasG = o.brasG ?? [
    [0, 0],
    [-3, 14],
    [4, 24],
  ];
  const brasD = o.brasD ?? [
    [0, 0],
    [3, 14],
    [-4, 24],
  ];
  const pts = {
    tete: [hx, hy, hr],
    epaules: ys,
    mainG: arm(-1, brasG).at(-1),
    mainD: arm(1, brasD).at(-1),
  };
  sv.obj(o.sh === undefined ? C.lin : o.sh, (b) => {
    const lw = P.jambe * u;
    const legX = wst / 2 - lw / 2;
    // cuisses vues de face (bande) puis jambes jusqu'au sol
    for (const side of [-1, 1]) {
      b.line(
        [
          [o.x + side * legX, o.siege + 4 * u],
          [o.x + side * legX, o.sol - 3.5 * u],
        ],
        o.bas ?? C.noyer,
        lw,
        {
          smooth: false,
          cap: 'butt',
        },
      );
    }
    for (const side of [-1, 1]) {
      b.detail(
        ell(o.x + side * legX, o.sol - 2.6 * u, lw * 0.62, 2.9 * u, { j: 0.3, n: 6 }),
        o.chaussures ?? C.chocolat,
      );
    }
    b.piece(
      rrect(o.x - wst / 2 - 1.5 * u, o.siege - 4 * u, wst + 3 * u, 12 * u, 5 * u, { j: 0.5 }),
      o.bas ?? C.noyer,
    );
    for (const [nodes, col] of coif.derriere) b.piece(nodes, col);
    b.piece(
      soft(
        [
          [o.x - sw / 2, ys + 3 * u],
          [o.x - sw * 0.28, ys],
          [o.x + sw * 0.28, ys],
          [o.x + sw / 2, ys + 3 * u],
          [o.x + wst / 2, o.siege],
          [o.x - wst / 2, o.siege],
        ],
        4.5 * u,
        { j: 0.6 },
      ),
      o.haut,
    );
    b.piece(ell(hx, hy, hr, hr * 1.04, { j: 0.6 }), o.peau);
    for (const [nodes, col] of coif.devant) b.piece(nodes, col);
    if (o.devant) o.devant(b, pts);
    const bras = [arm(-1, brasG), arm(1, brasD)];
    for (const pp of bras) b.line(pp, o.manches ?? o.haut, P.bras * u);
    // un objet tenu se place entre les bras et les mains
    if (o.tenu) o.tenu(b, pts);
    for (const pp of bras) {
      const [mx, my] = pp.at(-1);
      b.piece(ell(mx, my, P.bras * u * 0.5, P.bras * u * 0.52, { j: 0.3, n: 6 }), o.peau);
    }
  });
  return pts;
}

// --- Maison, collines, meubles -------------------------------------------------------------

/** Sol de collines : une bande lin au bord supérieur ondulé. */
export function collines(sv, x, y, w, h, cretes, { couleur = C.lin, sh = null } = {}) {
  const pts = [
    [x, y + h],
    [x, y + cretes[0]],
  ];
  const n = cretes.length;
  for (let i = 1; i < n - 1; i++) pts.push([x + (w * i) / (n - 1), y + cretes[i], true]);
  pts.push([x + w, y + cretes[n - 1]], [x + w, y + h]);
  sv.piece(cut(pts, { j: 0.8, seg: 60 }), couleur, sh);
}

/** Mas provençal : murs crème, toit de tuiles en terre, volets olive, porte cintrée. */
export function maison(
  sv,
  x,
  yb,
  w,
  { toit = C.terre, mur = C.creme, volets = C.olive, fenetres = 2 } = {},
) {
  const h = w * 0.58;
  const yt = yb - h;
  sv.obj(C.lin, (o) => {
    o.piece(rrect(x, yt, w, h, 2, { j: 0.6 }), mur);
    o.piece(
      soft(
        [
          [x - w * 0.09, yt + w * 0.03],
          [x + w * 0.2, yt - w * 0.17],
          [x + w * 0.8, yt - w * 0.17],
          [x + w * 1.09, yt + w * 0.03],
        ],
        w * 0.02,
        {
          j: 0.6,
        },
      ),
      toit,
    );
    o.detail(
      rrect(x + w * 0.4, yb - h * 0.5, w * 0.2, h * 0.5, [w * 0.1, w * 0.1, 0, 0], { j: 0.4 }),
      C.noyer,
    );
    const fx = fenetres === 2 ? [0.15, 0.85] : [0.17];
    for (const f of fx) {
      const cx = x + w * f;
      o.detail(rrect(cx - w * 0.075, yt + h * 0.24, w * 0.15, h * 0.3, 1, { j: 0.3 }), volets);
      o.detail(rrect(cx - w * 0.04, yt + h * 0.27, w * 0.08, h * 0.24, 1, { j: 0.3 }), C.noyer);
    }
  });
  return { x, yb, yt, h };
}

/** Cyprès : une flamme olive. */
export function cypres(sv, cx, yb, h, { sh = C.lin } = {}) {
  sv.piece(
    cut(
      [
        [cx, yb - h, 'vif'],
        [cx + h * 0.12, yb - h * 0.62, true],
        [cx + h * 0.13, yb - h * 0.2, true],
        [cx + h * 0.06, yb],
        [cx - h * 0.06, yb],
        [cx - h * 0.13, yb - h * 0.2, true],
        [cx - h * 0.12, yb - h * 0.62, true],
      ],
      { j: 0.6 },
    ),
    C.olive,
    sh,
  );
}

/** Meuble bas en bois : plateau caramel, deux portes noyer, petits pieds. */
export function meuble(sv, x, y, w, h, { sh = C.lin, portes = 2 } = {}) {
  sv.obj(sh, (o) => {
    o.line(
      [
        [x + w * 0.07, y + h - 4],
        [x + w * 0.07, y + h + 10],
      ],
      C.noyer,
      7,
      { smooth: false, cap: 'butt' },
    );
    o.line(
      [
        [x + w * 0.93, y + h - 4],
        [x + w * 0.93, y + h + 10],
      ],
      C.noyer,
      7,
      { smooth: false, cap: 'butt' },
    );
    o.piece(rrect(x, y, w, h, [3, 3, 6, 6], { j: 0.6 }), C.caramel);
    const pw = (w - 16 - (portes - 1) * 6) / portes;
    for (let i = 0; i < portes; i++) {
      const px = x + 8 + i * (pw + 6);
      o.detail(rrect(px, y + 14, pw, h - 22, 3, { j: 0.4 }), C.noyer);
      o.detail(
        ell(px + (i % 2 === 0 ? pw - 9 : 9), y + h * 0.5 + 4, 2.6, 2.6, { j: 0.1, n: 6 }),
        C.caramel,
      );
    }
  });
}

/**
 * Meuble ouvert à cases (bibliothèque, étagère de boutique), vu de face et d'un
 * peu haut : un cadre de bois, un fond noyer, et le dessus caramel de chaque
 * planche, où l'on pose les objets. La coque perle de la box se détache sur le
 * fond foncé, et son socle noyer sur le dessus clair de la planche.
 * (x, y) : coin haut gauche ; w, h : taille hors pieds ; cases : hauteur de
 * chaque case, de haut en bas, planche du dessous comprise (la somme vaut
 * h - ep) ; cadre : couleur du cadre et du chant des planches ; dessus :
 * profondeur visible du dessus des planches.
 * Renvoie { sous, cases } : sous, le repère sous lequel glisser l'ombre des
 * objets posés (le chant des planches la cache) ; pour chaque case, top (son
 * haut), x0 et x1 (bords intérieurs), yb (bord avant du dessus de la planche,
 * là où poser un objet) et yf (où le dessus de la planche rejoint le fond).
 */
export function casier(
  sv,
  x,
  y,
  w,
  h,
  cases,
  { cadre = C.caramel, ep = 9, dessus = 22, pieds = 10, sh = C.lin } = {},
) {
  const x0 = x + ep;
  const x1 = x + w - ep;
  sv.obj(sh, (o) => {
    if (pieds) {
      for (const px of [x + w * 0.08, x + w * 0.92])
        o.line(
          [
            [px, y + h - 4],
            [px, y + h + pieds],
          ],
          C.noyer,
          7,
          { smooth: false, cap: 'butt' },
        );
    }
    // de longs côtés presque droits (seg 100) : des octets en moins, la même coupe à l'œil
    o.piece(rrect(x, y, w, h, [3, 3, 5, 5], { j: 0.6, seg: 100 }), cadre);
  });
  const out = [];
  let top = y + ep;
  for (const hc of cases) {
    const yb = top + hc - ep;
    const yf = yb - dessus;
    // le fond, avec l'ombre du cadre (en haut et à gauche) qui tombe dessus,
    // puis le dessus de la planche
    const net = { j: 0.3, seg: 400 };
    sv.path(rrect(x0, top, x1 - x0, yf - top + 2, 1, net), C.chocolat);
    sv.path(rrect(x0 + 4, top + 6, x1 - x0 - 4, yf - top - 4, 1, net), C.noyer);
    sv.path(rrect(x0, yf, x1 - x0, yb - yf + 1, 1, net), C.caramel);
    out.push({ x0, x1, yb, yf, top });
    top += hc;
  }
  const sous = sv.marque();
  // chant des planches : il cache le pied des ombres posées sur le dessus
  for (const c of out.slice(0, -1)) {
    sv.path(rrect(x0 - 1, c.yb, x1 - x0 + 2, ep, 1.5, { j: 0.4, seg: 400 }), cadre);
    sv.line(
      [
        [x0 + 2, c.yb + 1],
        [x1 - 2, c.yb + 1],
      ],
      C.lin,
      2,
      { smooth: false },
    );
  }
  return { sous, cases: out };
}

/**
 * Main en gros plan, vue de dos, au bout d'un avant-bras : (x, y) est le
 * poignet, deg l'orientation (0 = doigts vers le haut), s la longueur de la main.
 * pose 'ouverte' : paume arrondie, quatre doigts en bandes un peu écartés (l'ombre
 * passe entre eux), pouce à part. pose 'poing' : le dos de la main, les quatre
 * doigts repliés en bosses au bord, le pouce qui fait le tour du manche ; outil
 * { manche, tige, long } dessine l'outil tenu, qui sort entre le pouce et l'index.
 * gauche : main gauche (vue de dos, le pouce est à droite).
 */
export function main(
  o,
  x,
  y,
  s,
  deg,
  peau,
  { pose = 'ouverte', gauche = false, outil = null } = {},
) {
  const c = Math.cos((deg * Math.PI) / 180);
  const sn = Math.sin((deg * Math.PI) / 180);
  const m = gauche ? 1 : -1; // côté du pouce
  const P = (px, py) => [x + px * s * c - py * s * sn, y + px * s * sn + py * s * c];
  const R = (nodes) => turn(nodes, deg, x, y);
  if (pose === 'poing') {
    if (outil) {
      const ax = m * 0.12;
      o.line([P(ax, -0.7), P(ax, -0.7 - outil.long)], outil.tige, s * 0.075, { smooth: false });
      o.piece(
        R(rrect(x + (ax - 0.12) * s, y - 1.02 * s, 0.24 * s, 0.6 * s, 0.1 * s, { j: 0.3 })),
        outil.manche,
      );
    }
    // doigts repliés : quatre bandes courtes au bord avant, un peu écartées
    for (const [fx, l] of [
      [m * 0.195, 0.58],
      [m * 0.065, 0.62],
      [-m * 0.065, 0.61],
      [-m * 0.195, 0.55],
    ]) {
      o.line([P(fx, -0.44), P(fx, -l)], peau, s * 0.118, { smooth: false });
    }
    // dos de la main, puis le pouce qui longe le côté et passe devant le manche
    o.piece(R(rrect(x - 0.26 * s, y - 0.54 * s, 0.52 * s, 0.58 * s, 0.16 * s, { j: 0.5 })), peau);
    o.line([P(m * 0.24, -0.14), P(m * 0.34, -0.42), P(m * 0.2, -0.67)], peau, s * 0.15);
    return;
  }
  // doigts : de l'index (côté du pouce) à l'auriculaire
  const doigts = [
    [m * 0.19, 0.33, m * 5],
    [m * 0.065, 0.37, m * 1.5],
    [-m * 0.065, 0.35, -m * 1.5],
    [-m * 0.19, 0.28, -m * 5],
  ];
  for (const [fx, l, a] of doigts) {
    const ex = fx + Math.sin((a * Math.PI) / 180) * l;
    const ey = -0.44 - Math.cos((a * Math.PI) / 180) * l;
    o.line([P(fx, -0.44), P(ex, ey)], peau, s * 0.112);
  }
  o.line([P(m * 0.2, -0.12), P(m * 0.36, -0.28), P(m * 0.44, -0.46)], peau, s * 0.15);
  o.piece(R(rrect(x - 0.26 * s, y - 0.56 * s, 0.52 * s, 0.6 * s, 0.17 * s, { j: 0.5 })), peau);
}

/**
 * Ordinateur portable de trois quarts, posé sur une table : coque noyer, dalle
 * crème tournée vers nous. (x, yb) : coin avant gauche du socle, au ras de la
 * table ; w : largeur de l'écran. ecran(P) dessine sur la dalle, où P(u, v)
 * donne un point de l'écran (u de gauche à droite, v de bas en haut).
 */
export function portableTroisQuarts(sv, x, yb, w, { sh = C.lin, ecran } = {}) {
  const h = w * 0.78; // hauteur de l'écran
  const k = w * 0.1; // l'écran penche un peu vers l'arrière
  const d = w * 0.24; // le socle avance vers la personne, à gauche
  const ep = w * 0.08; // épaisseur apparente du socle
  const bx = x + d;
  const by = yb - ep;
  const P = (u, v) => [bx + u * w + v * k, by - v * h];
  sv.obj(sh, (o) => {
    o.piece(soft([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], w * 0.05, { j: 0.4 }), C.noyer);
    o.piece(
      soft(
        [
          [x, yb],
          [x + w + d * 0.35, yb],
          [bx + w + 2, by],
          [bx - 2, by],
        ],
        2.5,
        { j: 0.3 },
      ),
      C.noyer,
    );
    o.detail(
      soft([P(0.07, 0.1), P(0.93, 0.1), P(0.93, 0.91), P(0.07, 0.91)], w * 0.018, { j: 0.3 }),
      C.creme,
    );
    // charnière : un filet chocolat au pied de l'écran
    o.trait([P(0.04, 0.02), P(0.96, 0.02)], C.chocolat, Math.max(1.6, w * 0.025), {
      smooth: false,
      cap: 'butt',
    });
  });
  if (ecran) ecran(P);
  return { P };
}

/**
 * Ordinateur portable de face : coque noyer, écran crème avec un pictogramme,
 * socle vu un peu d'en haut avec son clavier lin. (cx, yb) : milieu du bord
 * avant du socle ; w : largeur de l'écran.
 */
export function portableFace(sv, cx, yb, w, { sh = C.lin, ecran } = {}) {
  const hh = w * 0.6;
  const dh = w * 0.12;
  const ys = yb - dh; // pied de l'écran, à la charnière
  sv.obj(sh, (o) => {
    o.piece(rrect(cx - w / 2, ys - hh, w, hh + 2, [w * 0.04, w * 0.04, 1, 1], { j: 0.4 }), C.noyer);
    o.detail(
      rrect(cx - w * 0.45, ys - hh + w * 0.05, w * 0.9, hh - w * 0.09, w * 0.015, { j: 0.3 }),
      C.creme,
    );
    o.piece(
      soft(
        [
          [cx - w * 0.5, ys],
          [cx + w * 0.5, ys],
          [cx + w * 0.6, yb],
          [cx - w * 0.6, yb],
        ],
        w * 0.02,
        { j: 0.4 },
      ),
      C.noyer,
    );
    o.detail(
      soft(
        [
          [cx - w * 0.41, ys + dh * 0.24],
          [cx + w * 0.41, ys + dh * 0.24],
          [cx + w * 0.46, ys + dh * 0.64],
          [cx - w * 0.46, ys + dh * 0.64],
        ],
        1,
        { j: 0.2 },
      ),
      C.lin,
    );
    o.trait(
      [
        [cx - w * 0.48, ys + 0.5],
        [cx + w * 0.48, ys + 0.5],
      ],
      C.chocolat,
      Math.max(1.6, w * 0.016),
      { smooth: false, cap: 'butt' },
    );
  });
  if (ecran) ecran(cx, ys - hh / 2 + w * 0.005, w * 0.9, hh - w * 0.09);
}

/** Tasse avec anse et un peu de vapeur. */
export function tasse(sv, cx, yb, s, { couleur = C.terre, sh = C.lin, vapeur = true } = {}) {
  if (vapeur) {
    sv.line(
      [
        [cx - s * 0.12, yb - s * 1.15],
        [cx - s * 0.2, yb - s * 1.4],
        [cx - s * 0.08, yb - s * 1.62],
        [cx - s * 0.16, yb - s * 1.86],
      ],
      C.lin,
      s * 0.09,
    );
    sv.line(
      [
        [cx + s * 0.14, yb - s * 1.2],
        [cx + s * 0.06, yb - s * 1.42],
        [cx + s * 0.18, yb - s * 1.62],
      ],
      C.lin,
      s * 0.09,
    );
  }
  sv.obj(sh, (o) => {
    o.line(
      [
        [cx + s * 0.34, yb - s * 0.72],
        [cx + s * 0.62, yb - s * 0.62],
        [cx + s * 0.58, yb - s * 0.36],
        [cx + s * 0.3, yb - s * 0.3],
      ],
      couleur,
      s * 0.12,
    );
    o.piece(
      soft(
        [
          [cx - s * 0.42, yb - s * 0.9],
          [cx + s * 0.42, yb - s * 0.9],
          [cx + s * 0.34, yb],
          [cx - s * 0.34, yb],
        ],
        s * 0.1,
      ),
      couleur,
    );
  });
}

/** Olivier : tronc noyer tordu, feuillage olive en trois masses. */
export function olivier(sv, cx, yb, s, { sh = C.lin } = {}) {
  sv.obj(sh, (o) => {
    o.line(
      [
        [cx, yb],
        [cx - s * 0.04, yb - s * 0.3],
        [cx - s * 0.16, yb - s * 0.52],
      ],
      C.noyer,
      s * 0.09,
    );
    o.line(
      [
        [cx - s * 0.03, yb - s * 0.28],
        [cx + s * 0.14, yb - s * 0.5],
      ],
      C.noyer,
      s * 0.07,
    );
    o.piece(ell(cx - s * 0.22, yb - s * 0.6, s * 0.26, s * 0.17), C.olive);
    o.piece(ell(cx + s * 0.16, yb - s * 0.62, s * 0.24, s * 0.16), C.olive);
    o.piece(ell(cx - s * 0.02, yb - s * 0.8, s * 0.26, s * 0.18), C.olive);
  });
}

// --- Objets du guide d'installation (installation.mjs) ------------------------------

/**
 * Console ouverte : un plateau caramel vu de face sur deux pieds noyer, rien
 * autour, rien de fermé. (x, y) : bord gauche et dessus du plateau ; w : largeur ;
 * yb : bas des pieds. Renvoie le repère sous lequel glisser l'ombre des objets
 * posés dessus (le plateau en cache le pied, seule la part sur le mur reste).
 */
export function consoleOuverte(sv, x, y, w, yb, { ep = 14 } = {}) {
  const sous = sv.marque();
  sv.obj(C.lin, (o) => {
    for (const lx of [x + 26, x + w - 26])
      o.line(
        [
          [lx, y + ep - 2],
          [lx, yb],
        ],
        C.noyer,
        12,
        { smooth: false, cap: 'butt' },
      );
    o.piece(rrect(x, y, w, ep, 3, { j: 0.6 }), C.caramel);
  });
  return sous;
}

/** Étagère murale : une planche caramel et deux équerres noyer. Renvoie le repère des ombres. */
export function etagereMurale(sv, x, y, w, ep = 13) {
  const sous = sv.marque();
  sv.obj(C.lin, (o) => {
    for (const [ax, sens] of [
      [x + w * 0.12, 1],
      [x + w * 0.88, -1],
    ])
      o.piece(
        soft(
          [
            [ax, y + ep],
            [ax + sens * 22, y + ep],
            [ax, y + ep + 26],
          ],
          2,
        ),
        C.noyer,
      );
    o.piece(rrect(x, y, w, ep, 3, { j: 0.7 }), C.caramel);
  });
  return sous;
}

/**
 * Bloc d'alimentation posé à plat, vu de côté : boîtier noyer, deux broches
 * (pierre) qui sortent à droite, câble noyer enroulé jusqu'à sa petite fiche.
 * (x, yb) : coin bas gauche du boîtier ; s : sa longueur. cable : points du câble,
 * du boîtier jusqu'à la fiche ; fiche : [x, y, angle] du bout. sh : couleur de
 * l'ombre (caramel : posé sur le sol lin) ; sous : repère du meuble qui le porte.
 */
export function blocPose(sv, x, yb, s, cable, fiche, { sh = C.caramel, sous = null } = {}) {
  const h = s * 0.66;
  sv.obj(
    sh,
    (o) => {
      o.line(cable, C.noyer, 5);
      const [fx, fy, fa] = fiche;
      o.piece(turn(rrect(fx - 14, fy - 6.5, 22, 13, 4, { j: 0.2 }), fa, fx, fy), C.noyer);
      o.piece(turn(rrect(fx + 7, fy - 4, 10, 8, [0, 3, 3, 0], { j: 0.1 }), fa, fx, fy), C.pierre);
      for (const by of [yb - h * 0.7, yb - h * 0.32])
        o.line(
          [
            [x + s - 2, by],
            [x + s + s * 0.3, by],
          ],
          C.pierre,
          s * 0.11,
          { smooth: false },
        );
      o.piece(rrect(x, yb - h, s, h, s * 0.16, { j: 0.4 }), C.noyer);
      o.piece(rrect(x - 12, yb - h * 0.62, 16, h * 0.3, 3, { j: 0.2 }), C.noyer);
    },
    [2, 3],
    sous,
  );
}

/** Prise électrique murale : plaque crème, puits lin, deux trous chocolat. */
export function priseMurale(sv, cx, cy, s, { trous = true } = {}) {
  sv.obj(C.lin, (o) => {
    o.piece(rrect(cx - s / 2, cy - s / 2, s, s, s * 0.2, { j: 0.4 }), C.creme);
    o.detail(ell(cx, cy, s * 0.34, s * 0.34, { j: 0.2, n: 10 }), C.lin);
    if (trous) {
      o.detail(
        ell(cx - s * 0.13, cy + s * 0.02, s * 0.05, s * 0.05, { j: 0.05, n: 6 }),
        C.chocolat,
      );
      o.detail(
        ell(cx + s * 0.13, cy + s * 0.02, s * 0.05, s * 0.05, { j: 0.05, n: 6 }),
        C.chocolat,
      );
    }
  });
}

/** Sablier : deux plateaux et deux montants noyer, verre crème, sable caramel qui coule. */
export function sablier(sv, cx, yb, h, { sh = C.lin, sous = null } = {}) {
  const w = h * 0.6;
  const p = h * 0.085; // épaisseur d'un plateau
  const y0 = yb - h + p; // haut du verre
  const y1 = yb - p; // bas du verre
  const ym = (y0 + y1) / 2;
  const a = w * 0.34; // demi-largeur des bulbes
  const n = w * 0.05; // demi-largeur du col
  sv.obj(
    sh,
    (o) => {
      o.piece(
        cut(
          [
            [cx - a, y0],
            [cx + a, y0],
            [cx + a, y0 + h * 0.1, true],
            [cx + n * 1.4, ym - h * 0.05, true],
            [cx + n, ym],
            [cx + n * 1.4, ym + h * 0.05, true],
            [cx + a, y1 - h * 0.1, true],
            [cx + a, y1],
            [cx - a, y1],
            [cx - a, y1 - h * 0.1, true],
            [cx - n * 1.4, ym + h * 0.05, true],
            [cx - n, ym],
            [cx - n * 1.4, ym - h * 0.05, true],
            [cx - a, y0 + h * 0.1, true],
          ],
          { j: 0.3 },
        ),
        C.creme,
      );
      // le sable du haut, déjà à moitié passé
      o.detail(
        cut(
          [
            [cx - a * 0.86, ym - h * 0.17],
            [cx + a * 0.86, ym - h * 0.17],
            [cx + n * 1.2, ym - h * 0.03, true],
            [cx, ym],
            [cx - n * 1.2, ym - h * 0.03, true],
          ],
          { j: 0.2 },
        ),
        C.caramel,
      );
      // le filet qui tombe, puis le petit tas
      o.trait(
        [
          [cx, ym],
          [cx, y1 - h * 0.12],
        ],
        C.caramel,
        Math.max(2, h * 0.02),
        { smooth: false },
      );
      o.detail(
        cut(
          [
            [cx - a * 0.92, y1 + 0.5],
            [cx - a * 0.5, y1 - h * 0.08, true],
            [cx, y1 - h * 0.15, true],
            [cx + a * 0.5, y1 - h * 0.08, true],
            [cx + a * 0.92, y1 + 0.5],
          ],
          { j: 0.2 },
        ),
        C.caramel,
      );
      // montants et plateaux
      for (const sx of [-1, 1])
        o.line(
          [
            [cx + sx * w * 0.42, y0 - 1],
            [cx + sx * w * 0.42, y1 + 1],
          ],
          C.noyer,
          h * 0.05,
          { smooth: false, cap: 'butt' },
        );
      o.piece(rrect(cx - w / 2, yb - h, w, p, p * 0.4, { j: 0.3 }), C.noyer);
      o.piece(rrect(cx - w / 2, yb - p, w, p, p * 0.4, { j: 0.3 }), C.noyer);
    },
    undefined,
    sous,
  );
}

/**
 * Téléphone vu de face : coque noyer, écran crème. (x, y) : coin haut gauche ;
 * w, h : taille. ecran(sx, sy, sw, sh) dessine sur l'écran.
 */
export function telephone(sv, x, y, w, h, { sh = C.lin, ecran, sous = null } = {}) {
  const m = w * 0.07;
  sv.obj(
    sh,
    (o) => {
      o.piece(rrect(x, y, w, h, w * 0.16, { j: 0.4 }), C.noyer);
      o.detail(rrect(x + m, y + m * 1.6, w - 2 * m, h - m * 3.2, w * 0.09, { j: 0.3 }), C.creme);
    },
    undefined,
    sous,
  );
  if (ecran) ecran(x + m, y + m * 1.6, w - 2 * m, h - m * 3.2);
}

/** Symbole du Wi-Fi : trois arcs et un point, en bandes de papier. */
export function wifi(sv, cx, cy, r, { couleur = C.caramel, ep = 7, sh = C.lin } = {}) {
  sv.obj(sh, (o) => {
    for (const k of [1, 0.68, 0.36]) {
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const t = ((-138 + (i * 96) / 6) * Math.PI) / 180;
        pts.push([cx + r * k * Math.cos(t), cy + r * k * Math.sin(t)]);
      }
      o.line(pts, couleur, ep, { j: 0.2 });
    }
    o.piece(ell(cx, cy - ep * 0.2, ep * 0.85, ep * 0.85, { j: 0.1, n: 7 }), couleur);
  });
}
