// Série « papier découpé » : les huit dessins du guide d'installation (/installer/).
//
// Même boîte à outils que les autres dessins du site (papier.mjs, objets.mjs,
// kanji.mjs) ; format 4/3 (viewBox 800 × 600), trait de 6, ombre décalée de 4 et 6.
// Les objets communs du guide (console, étagère murale, prise, bloc
// d'alimentation, sablier, téléphone, Wi-Fi) sont dans objets.mjs.
//
// Usage : node design/illustrations/_source/installation.mjs [nom…]
// Écrit les SVG bruts dans src/assets/illustrations/installation/ (ou dans
// $SORTIE/installation/) ; les optimiser ensuite avec SVGO.
// `npm run illustrations:build` fait les deux (voir docs/illustrations.md).
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { C, Svg, cut, ell, rrect, soft, turn } from './papier.mjs';
import {
  blocPose,
  boite,
  carte,
  consoleOuverte,
  etagereMurale,
  fenetre,
  photo,
  plante,
  portableFace,
  priseMurale,
  routeur,
  sablier,
  sol,
  tasse,
  telephone,
  wifi,
} from './objets.mjs';

// Les dessins vont directement dans le site, sauf si $SORTIE dit autre chose.
const OUT =
  process.env.SORTIE ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/assets/illustrations');
const DESSINS = {};

// Format 800 × 600 : épaisseur du trait et décalage de l'ombre, en unités du viewBox.
const F800 = { sh: [4, 6], trait: 6 };

/** Une scène du guide : la carte de fond sable, aux coins arrondis. */
function scene(nom, title, desc) {
  const sv = new Svg(`installation/${nom}.svg`, 800, 600, { ...F800, title, desc });
  carte(sv, 28, 28, 736, 536, 44);
  return sv;
}

/** Le sol de toutes les scènes du guide. */
const solGuide = (sv) => sol(sv, 52, 460, 690, 80, 18);

/** Trajectoire en pointillés : de petits ronds de papier caramel. */
function trajet(sv, points, couleur = C.caramel, ep = 4) {
  sv.line(points, couleur, ep, { dash: `0.1 ${ep * 3}` });
}

// --- Mobilier ----------------------------------------------------------------------

// --- Objets du guide ------------------------------------------------------------------

/**
 * Carton ouvert, vu de face et d'un peu haut : face avant caramel, intérieur
 * noyer, quatre rabats dépliés (chacun son ombre plate). (x0, yb) : coin bas
 * gauche ; w, h : largeur et hauteur de la face avant.
 */
function carton(sv, x0, yb, w, h) {
  const x1 = x0 + w;
  const yt = yb - h; // bord avant du dessus
  const d = w * 0.2; // profondeur vue du dessus (raccourcie)
  const f = w * 0.045; // le fond rétrécit un peu
  const yd = yt - d; // bord arrière du dessus
  const r = d * 1.25; // longueur d'un rabat
  // rabat arrière, debout, un peu penché vers le fond : on voit sa face intérieure
  sv.piece(
    soft(
      [
        [x0 + f + 3, yd + 2],
        [x1 - f - 3, yd + 2],
        [x1 - f - 12, yd - r * 0.92],
        [x0 + f + 12, yd - r * 0.92],
      ],
      3,
      { j: 0.6 },
    ),
    C.caramel,
    C.lin,
  );
  // rabats de côté, ouverts vers l'extérieur, qui retombent un peu
  for (const [ax, bx, sens] of [
    [x0, x0 + f, -1],
    [x1, x1 - f, 1],
  ]) {
    sv.piece(
      soft(
        [
          [ax, yt],
          [bx, yd],
          [bx + sens * r * 0.82, yd + r * 0.22],
          [ax + sens * r * 0.82, yt + r * 0.3],
        ],
        3,
        { j: 0.5 },
      ),
      C.caramel,
      C.lin,
    );
  }
  // le corps : face avant et ouverture sombre
  sv.obj(C.lin, (o) => {
    o.piece(rrect(x0, yt, w, h, [2, 2, 5, 5], { j: 0.8 }), C.caramel);
    o.piece(
      soft(
        [
          [x0 + 1, yt + 1],
          [x0 + f, yd],
          [x1 - f, yd],
          [x1 - 1, yt + 1],
        ],
        2,
        { j: 0.4 },
      ),
      C.noyer,
    );
    // l'ombre de la paroi avant, au fond du carton
    o.detail(
      soft(
        [
          [x0 + 4, yt + 1],
          [x0 + f * 0.6, yt - d * 0.42],
          [x1 - f * 0.6, yt - d * 0.42],
          [x1 - 4, yt + 1],
        ],
        2,
        { j: 0.3 },
      ),
      C.chocolat,
    );
  });
}

/** Bloc d'alimentation branché dans la prise, vu de face ; le câble sort par le bas. */
function blocBranche(sv, cx, cy, s, cable) {
  sv.obj(C.lin, (o) => {
    o.line(cable, C.noyer, 5);
    o.piece(rrect(cx - 7, cy + s * 0.36, 14, 14, [2, 2, 5, 5], { j: 0.2 }), C.noyer);
    o.piece(rrect(cx - s * 0.3, cy - s * 0.42, s * 0.6, s * 0.82, s * 0.14, { j: 0.4 }), C.noyer);
  });
}

/**
 * Box internet générique, vue de face : boîtier pierre plus plat que la HAKO,
 * dessus lin, deux antennes noyer, trois voyants olive et, à droite, une
 * rangée de prises réseau. Comme routeur() de objets.mjs, avec les prises.
 * Renvoie les centres des prises.
 */
function boxInternet(sv, cx, yb, w, { sh = C.lin, sous = null, prises = 4 } = {}) {
  const h = w * 0.32;
  const t = w * 0.18;
  const ins = w * 0.05;
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const yt = yb - h;
  const a = w * 0.04;
  const centres = [];
  sv.obj(
    sh,
    (o) => {
      o.line(
        [
          [x0 + w * 0.2, yt - t * 0.5],
          [x0 + w * 0.14, yt - t - w * 0.3],
        ],
        C.noyer,
        a,
        { smooth: false },
      );
      o.line(
        [
          [x1 - w * 0.2, yt - t * 0.5],
          [x1 - w * 0.14, yt - t - w * 0.3],
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
          ell(x0 + w * (0.1 + i * 0.065), yt + h * 0.5, w * 0.018, w * 0.018, { j: 0.2 }),
          C.olive,
        );
      // prises réseau : un creux chocolat, l'encoche du clip en bas
      const pw = w * 0.09;
      const ph = h * 0.36;
      for (let i = 0; i < prises; i++) {
        const px = x0 + w * (0.42 + i * 0.13);
        const py = yt + h * 0.5;
        centres.push([px, py, pw, ph]);
        o.detail(rrect(px - pw / 2, py - ph / 2, pw, ph * 0.8, 1.5, { j: 0.1 }), C.chocolat);
        o.detail(
          rrect(px - pw * 0.22, py + ph * 0.25, pw * 0.44, ph * 0.25, [0, 0, 1, 1], { j: 0.1 }),
          C.chocolat,
        );
      }
    },
    undefined,
    sous,
  );
  return { x0, x1, yt, yb, h, t, centres };
}

/**
 * La page de la HAKO, en miniature, sur un écran : la petite maison olive à
 * porte crème de la vignette « Prise en main » (tutoriels/prise-en-main), le
 * seul signe de cette page dans la série. k : demi-largeur du toit, en part du
 * plus petit côté de l'écran.
 */
function pageBox(sv, sx, sy, sw, sh, { k = 0.3 } = {}) {
  const cx = sx + sw / 2;
  const s = Math.min(sw, sh) * k;
  // mêmes proportions que la vignette (demi-largeur 34 : toit de 32, murs de 34)
  const yToit = sy + sh / 2 - s * 0.03; // base du toit
  const yHaut = yToit - s * 0.94;
  const yBas = yToit + s;
  const m = s * 0.735;
  sv.piece(
    soft(
      [
        [cx - s, yToit],
        [cx, yHaut],
        [cx + s, yToit],
        [cx + m, yToit],
        [cx + m, yBas],
        [cx - m, yBas],
        [cx - m, yToit],
      ],
      Math.max(1.5, s * 0.09),
    ),
    C.olive,
    C.lin,
    [Math.max(1, s * 0.06), Math.max(1.5, s * 0.09)],
  );
  const pw = s * 0.47;
  const ph = s * 0.59;
  sv.path(rrect(cx - pw / 2, yBas - ph, pw, ph, [pw * 0.44, pw * 0.44, 0, 0], { j: 0.2 }), C.creme);
}

/** Chat endormi, roulé en boule (repris de l'étape « chez vous »). */
function chat(sv, dx, dy) {
  const T = (pts) => pts.map(([x, y]) => [x + dx, y + dy]);
  sv.obj(
    C.caramel,
    (o) => {
      o.line(
        T([
          [120, 506],
          [104, 500],
          [102, 486],
          [114, 480],
        ]),
        C.noyer,
        8,
      );
      o.piece(ell(152 + dx, 492 + dy, 40, 20), C.noyer);
      o.piece(ell(190 + dx, 494 + dy, 16, 14), C.noyer);
      o.piece(
        soft(
          T([
            [179, 486],
            [182, 470],
            [192, 482],
          ]),
          2,
        ),
        C.noyer,
      );
      o.piece(
        soft(
          T([
            [192, 482],
            [200, 470],
            [203, 486],
          ]),
          2,
        ),
        C.noyer,
      );
    },
    [2, 3],
  );
}

// --- 1. Le carton -----------------------------------------------------------------------
DESSINS.carton = () => {
  const sv = scene(
    'carton',
    'Le carton ouvert, la HAKO et son bloc d’alimentation posés sur une table',
    'Un carton ouvert, aux rabats dépliés, posé au sol. À côté, sur une table basse : la HAKO, blanc perlé sur son socle brun, qui vient d’en sortir, et son bloc d’alimentation, dont le câble pend au bord de la table.',
  );
  solGuide(sv);
  fenetre(sv, 610, 78, 124, 146, { cypres: false });
  carton(sv, 96, 484, 236, 158);
  const sous = consoleOuverte(sv, 392, 386, 352, 498);
  // la box vient de sortir du carton et se pose sur la table
  trajet(sv, [
    [326, 262],
    [370, 214],
    [432, 204],
    [482, 230],
    [500, 262],
  ]);
  boite(sv, 500, 386, 164, { sous, mot: true });
  // le bloc d'alimentation, à plat sur la table ; son câble pend au bord et
  // finit par sa petite fiche
  blocPose(
    sv,
    636,
    386,
    62,
    [
      [626, 375],
      [612, 380],
      [602, 394],
      [600, 420],
      [604, 446],
    ],
    [604, 456, 90],
    { sh: C.lin, sous },
  );
  return sv;
};

// --- 2. La place ------------------------------------------------------------------------
DESSINS.emplacement = () => {
  const sv = scene(
    'emplacement',
    'La HAKO posée à plat, à l’air libre, près de la box internet',
    'Sur une console ouverte, la HAKO est posée à plat à côté de la box internet, rien dessus ; un pointillé entoure l’espace à laisser libre autour d’elle. Une prise électrique est à portée, sur le mur ; par la fenêtre, des collines.',
  );
  solGuide(sv);
  fenetre(sv, 92, 92, 140, 160);
  plante(sv, 128, 500, 96);
  priseMurale(sv, 690, 404, 46);
  const sous = consoleOuverte(sv, 214, 336, 420, 498);
  routeur(sv, 300, 336, 120, { sous });
  const g = boite(sv, 512, 336, 168, { sous, mot: true });
  // l'espace à laisser libre autour de la box : un cadre en pointillés, ouvert en bas
  const m = 30;
  const [zx0, zx1, zy] = [g.x0 - m, g.x1 + m, g.yDos - m];
  trajet(sv, [
    [zx0, 326],
    [zx0, zy + 22],
    [zx0 + 6, zy + 6],
    [zx0 + 22, zy],
    [zx1 - 22, zy],
    [zx1 - 6, zy + 6],
    [zx1, zy + 22],
    [zx1, 326],
  ]);
  return sv;
};

// --- 3. Le câble réseau --------------------------------------------------------------------
DESSINS['cable-reseau'] = () => {
  const sv = scene(
    'cable-reseau',
    'Un câble réseau relie la HAKO à la box internet, sur un meuble',
    'Sur un meuble, vus de près, la HAKO et la box internet sont posées côte à côte. Un câble réseau sort de l’arrière de la HAKO, court le long du plateau et rejoint une prise de la box internet. Dans un rond, en gros plan, la fiche du câble entre dans la prise jusqu’au clic.',
  );
  // le plateau du meuble, vu de près : il porte les deux appareils
  const sous = consoleOuverte(sv, 52, 494, 696, 552, { ep: 16 });
  const bi = boxInternet(sv, 548, 494, 300, { sous });
  const [px, py, pw, ph] = bi.centres[1];
  // le câble : il sort de derrière la box, court le long du plateau, remonte à la prise
  sv.line(
    [
      [300, 446],
      [322, 474],
      [350, 490],
      [420, 493],
      [px - 30, 493],
      [px - 6, 486],
      [px, py + ph * 0.5],
    ],
    C.noyer,
    7,
  );
  boite(sv, 196, 494, 232, { sous, mot: true });
  // la fiche dans la prise
  sv.obj(C.noyer, (o) => {
    o.piece(rrect(px - pw * 0.62, py - ph * 0.62, pw * 1.24, ph * 1.24, 3, { j: 0.2 }), C.lin);
    o.detail(rrect(px - pw * 0.3, py + ph * 0.2, pw * 0.6, ph * 0.42, 2, { j: 0.1 }), C.noyer);
  });
  // gros plan : la fiche entre dans la prise, de profil, jusqu'au clic
  const [gx, gy, gr] = [560, 168, 96];
  trajet(sv, [
    [px, py - ph * 0.9],
    [px - 6, 330],
    [gx + 4, gy + gr + 10],
  ]);
  sv.piece(ell(gx, gy, gr, gr, { j: 0.6, n: 16 }), C.creme, C.lin);
  // la paroi de la box internet, et le creux de la prise
  sv.path(
    cut(
      [
        [gx + 24, gy - 58],
        [gx + 70, gy - 58, true],
        [gx + 80, gy, true],
        [gx + 70, gy + 58, true],
        [gx + 24, gy + 58],
      ],
      { j: 0.3 },
    ),
    C.pierre,
  );
  sv.path(rrect(gx + 24, gy - 24, 18, 48, 2, { j: 0.1 }), C.chocolat);
  // la fiche de profil : corps lin, contacts caramel, clip ; manchon et câble noyer
  sv.obj(C.lin, (o) => {
    o.line(
      [
        [gx - 90, gy + 16],
        [gx - 66, gy + 4],
      ],
      C.noyer,
      12,
    );
    o.piece(
      soft(
        [
          [gx - 70, gy - 10],
          [gx - 38, gy - 15],
          [gx - 38, gy + 15],
          [gx - 70, gy + 10],
        ],
        3,
        { j: 0.2 },
      ),
      C.noyer,
    );
    o.line(
      [
        [gx + 6, gy - 20],
        [gx - 26, gy - 33],
      ],
      C.lin,
      6,
      { smooth: false },
    );
    o.piece(rrect(gx - 40, gy - 20, 74, 38, [3, 6, 6, 3], { j: 0.2 }), C.lin);
    for (let i = 0; i < 4; i++)
      o.trait(
        [
          [gx + 14 + i * 5, gy - 16],
          [gx + 14 + i * 5, gy - 6],
        ],
        C.caramel,
        2.6,
        { smooth: false },
      );
  });
  // le clic : trois petits traits terre
  for (const [a, b] of [
    [
      [gx + 18, gy - 34],
      [gx + 20, gy - 50],
    ],
    [
      [gx + 30, gy - 30],
      [gx + 42, gy - 42],
    ],
    [
      [gx + 6, gy - 38],
      [gx + 0, gy - 52],
    ],
  ])
    sv.line([a, b], C.terre, 4, { smooth: false });
  return sv;
};

// --- 4. L'alimentation ------------------------------------------------------------------
DESSINS.alimentation = () => {
  const sv = scene(
    'alimentation',
    'Le bloc d’alimentation branché à la HAKO et à une prise',
    'Sur une console, la HAKO est reliée à la box internet par son câble réseau. Son bloc d’alimentation est branché dans une prise électrique du mur, et son câble rejoint l’arrière de la HAKO.',
  );
  solGuide(sv);
  fenetre(sv, 92, 92, 132, 150, { cypres: false });
  photo(sv, 470, 150, 82, -3);
  priseMurale(sv, 628, 292, 72, { trous: false });
  blocBranche(sv, 628, 292, 72, [
    [628, 330],
    [632, 352],
    [612, 370],
    [560, 372],
    [520, 362],
  ]);
  const sous = consoleOuverte(sv, 96, 380, 608, 498);
  routeur(sv, 196, 380, 124, { sous });
  sv.line(
    [
      [252, 360],
      [270, 344],
      [300, 350],
      [322, 360],
    ],
    C.noyer,
    4.5,
  );
  boite(sv, 414, 380, 190, { sous, mot: true });
  return sv;
};

// --- 5. La préparation ------------------------------------------------------------------
DESSINS.preparation = () => {
  const sv = scene(
    'preparation',
    'La HAKO se prépare, au calme',
    'La HAKO, branchée sur une console à côté de la box internet, se prépare toute seule. À côté, un sablier laisse couler son sable et une tasse fume. Par la fenêtre, des collines ; un chat dort sous la console.',
  );
  solGuide(sv);
  fenetre(sv, 530, 72, 140, 148);
  const sous = consoleOuverte(sv, 96, 380, 560, 498);
  routeur(sv, 186, 380, 120, { sous });
  sv.line(
    [
      [240, 360],
      [258, 344],
      [286, 350],
      [306, 360],
    ],
    C.noyer,
    4.5,
  );
  boite(sv, 400, 380, 190, { sous, mot: true });
  sablier(sv, 556, 380, 118, { sous });
  tasse(sv, 626, 380, 34);
  chat(sv, 120, 2);
  return sv;
};

// --- 6. La page de la HAKO --------------------------------------------------------------
DESSINS['page-hako'] = () => {
  const sv = scene(
    'page-hako',
    'Un téléphone et un ordinateur ouvrent la page de la HAKO',
    'Sur une table, un téléphone et un ordinateur portable, reliés au Wi-Fi de la maison, affichent la page de la HAKO : une petite maison. Au mur, sur une étagère, la box internet, qui diffuse le Wi-Fi, et la HAKO, reliées par un câble.',
  );
  solGuide(sv);
  const sous = etagereMurale(sv, 84, 250, 268);
  routeur(sv, 146, 250, 100, { sous });
  // le câble réseau posé à l'étape 3
  sv.line(
    [
      [188, 236],
      [204, 222],
      [226, 230],
    ],
    C.noyer,
    3.5,
  );
  boite(sv, 278, 250, 112, { sous });
  wifi(sv, 146, 150, 46);
  // la table
  sv.obj(C.lin, (o) => {
    for (const lx of [350, 690])
      o.line(
        [
          [lx, 392],
          [lx, 500],
        ],
        C.noyer,
        12,
        { smooth: false, cap: 'butt' },
      );
    o.piece(rrect(326, 380, 388, 14, 3, { j: 0.6 }), C.caramel);
  });
  plante(sv, 150, 500, 100);
  // le téléphone, debout sur son petit support : seule la lèvre du support passe
  // devant le bas de la coque
  sv.piece(rrect(392, 352, 60, 30, [3, 3, 2, 2], { j: 0.3 }), C.noyer, C.lin);
  telephone(sv, 384, 236, 76, 138, {
    sh: C.lin,
    ecran: (x, y, w, h) => pageBox(sv, x, y, w, h, { k: 0.3 }),
  });
  sv.piece(
    soft(
      [
        [386, 381],
        [389, 370],
        [455, 370],
        [458, 381],
      ],
      2,
    ),
    C.noyer,
    C.lin,
  );
  portableFace(sv, 588, 380, 196, {
    ecran: (cx, cy, w, h) => pageBox(sv, cx - w / 2, cy - h / 2, w, h, { k: 0.3 }),
  });
  return sv;
};

// --- 7. La fiche de secours ------------------------------------------------------------
DESSINS['fiche-secours'] = () => {
  const sv = scene(
    'fiche-secours',
    'La fiche de secours, rangée avec les papiers importants',
    'Une fiche imprimée, où des traits figurent les mots de passe, est glissée dans une pochette de papiers importants, sur une console, à côté de classeurs.',
  );
  solGuide(sv);
  const sous = consoleOuverte(sv, 96, 420, 608, 498);
  plante(sv, 170, 420, 96, { pot: C.creme, sous });
  // classeurs debout, à droite
  sv.obj(
    C.lin,
    (o) => {
      let bx = 560;
      for (const [bw, bh, col] of [
        [36, 196, C.olive],
        [32, 184, C.caramel],
        [38, 200, C.noyer],
      ]) {
        o.piece(rrect(bx, 420 - bh, bw, bh, 3, { j: 0.4 }), col);
        o.detail(
          rrect(bx + bw * 0.22, 420 - bh * 0.32, bw * 0.56, bh * 0.1, 2, { j: 0.2 }),
          C.creme,
        );
        o.detail(
          ell(bx + bw / 2, 420 - bh * 0.15, bw * 0.13, bw * 0.13, { j: 0.1, n: 6 }),
          C.chocolat,
        );
        bx += bw + 3;
      }
    },
    undefined,
    sous,
  );
  // la pochette : dos, papiers, fiche, devant
  const x = 262;
  const w = 268;
  const yb = 420;
  const h = 236;
  sv.obj(
    C.lin,
    (o) => {
      o.piece(rrect(x, yb - h, w, h, [10, 10, 4, 4], { j: 0.5 }), C.terre);
    },
    undefined,
    sous,
  );
  // une autre feuille, derrière (l'ombre d'un papier sur la pochette terre est chocolat)
  sv.piece(
    turn(rrect(x + 20, yb - h - 18, w - 46, 150, 2, { j: 0.4 }), -3, x + 100, yb - h),
    C.lin,
    C.chocolat,
    [3, 4],
  );
  // la fiche : un titre, puis une ligne par personne (prénom, puis mot de passe en quatre mots)
  const fx = x + 40;
  const fy = yb - h - 70;
  const fw = w - 70;
  const ref = sv.def(turn(rrect(fx, fy, fw, 190, 2, { j: 0.4 }), 2, fx + fw / 2, fy));
  sv.shadow(ref, C.chocolat, [3, 4]);
  sv.use(ref, C.creme);
  const a = (2 * Math.PI) / 180;
  const R = (px, py) => {
    const [ox, oy] = [fx + fw / 2, fy];
    return [
      ox + (px - ox) * Math.cos(a) - (py - oy) * Math.sin(a),
      oy + (px - ox) * Math.sin(a) + (py - oy) * Math.cos(a),
    ];
  };
  const bande = (x0, x1, yy, couleur, ep) =>
    sv.line([R(x0 + ep / 2, yy), R(x1 - ep / 2, yy)], couleur, ep, { smooth: false, j: 0 });
  bande(fx + 18, fx + 18 + fw * 0.42, fy + 23, C.chocolat, 10);
  for (let i = 0; i < 3; i++) {
    const ly = fy + 54 + i * 30;
    bande(fx + 18, fx + 58, ly, C.noyer, 7);
    // le mot de passe : quatre mots séparés par des tirets
    let lx = fx + 70;
    for (const [k, lw] of [30, 26, 34, 18].entries()) {
      bande(lx, lx + lw, ly, C.chocolat, 7);
      if (k < 3) bande(lx + lw + 2.5, lx + lw + 6.5, ly, C.noyer, 2.5);
      lx += lw + 9;
    }
  }
  // le devant de la pochette, échancré au milieu (son ombre est celle du dos)
  sv.obj(null, (o) => {
    o.piece(
      cut(
        [
          [x, yb - h * 0.52],
          [x + w * 0.38, yb - h * 0.52],
          [x + w * 0.42, yb - h * 0.47, true],
          [x + w * 0.5, yb - h * 0.44, true],
          [x + w * 0.58, yb - h * 0.47, true],
          [x + w * 0.62, yb - h * 0.52],
          [x + w, yb - h * 0.52],
          [x + w, yb - 4],
          [x + w - 4, yb],
          [x + 4, yb],
          [x, yb - 4],
        ],
        { j: 0.5 },
      ),
      C.terre,
    );
  });
  sv.path(rrect(x + w * 0.3, yb - h * 0.32, w * 0.4, 30, 3, { j: 0.3 }), C.lin);
  return sv;
};

// --- 8. Les applications ------------------------------------------------------------------
DESSINS.applications = () => {
  const sv = scene(
    'applications',
    'Les deux applications sur un téléphone',
    'Une main tient un téléphone. À l’écran, deux applications : l’une pour les photos, l’autre pour les fichiers. Une photo et un document partent du téléphone vers la HAKO, posée sur une étagère.',
  );
  // la HAKO laisse un écart franc (environ 40 unités) entre sa coque et la plante
  const sous = etagereMurale(sv, 466, 330, 268);
  boite(sv, 566, 330, 150, { sous, mot: true });
  plante(sv, 706, 330, 50, { sous });
  trajet(sv, [
    [436, 200],
    [488, 168],
    [538, 176],
    [566, 212],
  ]);
  photo(sv, 474, 178, 46, -8);
  // un document, coin plié
  sv.obj(C.lin, (o) => {
    o.piece(
      turn(
        cut(
          [
            [530, 150],
            [556, 150],
            [568, 162],
            [568, 196],
            [530, 196],
          ],
          { j: 0.3 },
        ),
        8,
        549,
        173,
      ),
      C.creme,
    );
    for (let i = 0; i < 3; i++) {
      const [p, q] = turn(
        [
          { x: 538, y: 166 + i * 9 },
          { x: 556 - i * 5, y: 166 + i * 9 },
        ],
        8,
        549,
        173,
      );
      o.trait(
        [
          [p.x, p.y],
          [q.x, q.y],
        ],
        C.lin,
        4,
        { smooth: false, j: 0 },
      );
    }
  });
  // la main : manche, paume derrière le téléphone, puis pouce et doigts par-dessus
  const [x, y, w, h] = [236, 122, 176, 330];
  sv.obj(C.lin, (o) => {
    // la manche s'arrête au bord de la carte, comme coupée par lui
    o.piece(
      soft(
        [
          [214, 560, 'vif'],
          [262, 474],
          [356, 486],
          [326, 560, 'vif'],
        ],
        12,
        { j: 0.6 },
      ),
      C.olive,
    );
    o.piece(
      soft(
        [
          [224, 398],
          [x + w + 4, 374],
          [x + w + 6, 440],
          [346, 490],
          [270, 488],
        ],
        22,
        { j: 0.5 },
      ),
      C.caramel,
    );
  });
  telephone(sv, x, y, w, h, {
    ecran: (sx, sy, sw, sh) => {
      // barre d'état, deux icônes, barre du bas
      sv.path(rrect(sx + sw * 0.32, sy + 10, sw * 0.36, 6, 3, { j: 0.1 }), C.lin);
      const s = sw * 0.4;
      const gap = sw * 0.08;
      const ix = sx + (sw - 2 * s - gap) / 2;
      const iy = sy + sh * 0.12;
      // photos : une photo crème (colline olive, soleil caramel) sur fond terre
      sv.piece(rrect(ix, iy, s, s, s * 0.24, { j: 0.3 }), C.terre, C.lin, [2, 3]);
      photo(sv, ix + s / 2, iy + s / 2, s * 0.64, -6, { sh: null });
      // fichiers : un dossier caramel, une feuille crème qui dépasse, sur fond olive
      const jx = ix + s + gap;
      sv.piece(rrect(jx, iy, s, s, s * 0.24, { j: 0.3 }), C.olive, C.lin, [2, 3]);
      sv.path(
        soft(
          [
            [jx + s * 0.18, iy + s * 0.28],
            [jx + s * 0.42, iy + s * 0.28],
            [jx + s * 0.5, iy + s * 0.36],
            [jx + s * 0.82, iy + s * 0.36],
            [jx + s * 0.82, iy + s * 0.76],
            [jx + s * 0.18, iy + s * 0.76],
          ],
          3,
          { j: 0.1 },
        ),
        C.caramel,
      );
      sv.path(rrect(jx + s * 0.26, iy + s * 0.3, s * 0.48, s * 0.3, 2, { j: 0.1 }), C.creme);
      sv.path(
        soft(
          [
            [jx + s * 0.14, iy + s * 0.46],
            [jx + s * 0.86, iy + s * 0.46],
            [jx + s * 0.82, iy + s * 0.78],
            [jx + s * 0.18, iy + s * 0.78],
          ],
          3,
          { j: 0.1 },
        ),
        C.caramel,
      );
      sv.path(rrect(sx + sw * 0.12, sy + sh - 34, sw * 0.76, 22, 11, { j: 0.2 }), C.lin);
    },
  });
  sv.obj(C.lin, (o) => {
    // doigts qui tiennent le bord droit, de l'index à l'auriculaire
    for (const [fy, fl, fh] of [
      [258, 26, 23],
      [287, 28, 23],
      [316, 26, 22],
      [343, 20, 20],
    ])
      o.line(
        [
          [x + w - 6, fy],
          [x + w - 6 + fl, fy + 2],
        ],
        C.caramel,
        fh,
        { smooth: false },
      );
    // pouce, sur le bord gauche
    o.line(
      [
        [222, 430],
        [232, 386],
        [250, 352],
      ],
      C.caramel,
      28,
    );
  });
  return sv;
};

const wanted = process.argv.slice(2);
for (const [name, build] of Object.entries(DESSINS)) {
  if (wanted.length > 0 && !wanted.includes(name)) continue;
  const sv = build();
  sv.write(OUT);
}
