// Série « papier découpé » : description de chaque dessin.
//
// Usage : node design/illustrations/_source/dessins.mjs [nom…]
// Écrit les SVG bruts dans src/assets/illustrations/ ; les optimiser ensuite
// avec SVGO. `npm run illustrations:build` fait les deux (voir
// docs/illustrations.md).
//
// PAPIER_ANCRES=<dossier> : écrit aussi vue-eclatee.anchors.json dans ce
// dossier, les points d'accroche des étiquettes de la vue éclatée. Le site ne
// s'en sert pas : ses étiquettes sont celles de la scène 3D.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { C, Svg, cut, ell, leaf, mapNodes, rrect, soft, turn } from './papier.mjs';
import {
  BOX,
  assise,
  boite,
  cadenas,
  carte,
  casier,
  collines,
  cypres,
  etagere,
  etiquette,
  fenetre,
  main,
  maison,
  meuble,
  nuage,
  olivier,
  personne,
  photo,
  plante,
  portableFace,
  portableTroisQuarts,
  routeur,
  socle,
  sol,
  tasse,
} from './objets.mjs';

// Les dessins vont directement dans le site.
const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../src/assets/illustrations',
);
const DESSINS = {};

// Formats : épaisseur du trait et décalage de l'ombre, en unités du viewBox.
const F800 = { sh: [4, 6], trait: 6 };
const F600 = { sh: [3, 5], trait: 5 };

/** Trajectoire en pointillés : de petits ronds de papier caramel. */
function trajet(sv, points, couleur = C.caramel, ep = 4) {
  sv.line(points, couleur, ep, { dash: `0.1 ${ep * 3}` });
}

// 1 — Le problème : des photos qui s'envolent vers des nuages lointains ------------------------
DESSINS.probleme = () => {
  const sv = new Svg('probleme.svg', 800, 600, {
    ...F800,
    title: 'Des photos qui s’envolent vers des nuages lointains',
    desc: 'Depuis un mas provençal, une file de photos s’élève vers des nuages lointains. Près des nuages, de petits cadenas ferment les photos et des étiquettes de prix pendent.',
  });
  carte(sv, 28, 28, 736, 536, 44);
  collines(sv, 52, 428, 690, 114, [70, 44, 54, 80, 66, 86]);
  cypres(sv, 84, 486, 150);
  maison(sv, 106, 494, 190);
  olivier(sv, 648, 492, 120);
  trajet(sv, [
    [296, 382],
    [352, 330],
    [440, 262],
    [520, 214],
    [600, 182],
  ]);
  nuage(sv, 476, 118, 100);
  photo(sv, 352, 318, 92, -8);
  photo(sv, 438, 256, 78, 7);
  photo(sv, 512, 212, 66, -6);
  cadenas(sv, 536, 244, 32);
  photo(sv, 568, 190, 60, 9);
  cadenas(sv, 590, 220, 28);
  photo(sv, 616, 168, 52, -5);
  nuage(sv, 668, 188, 196);
  etiquette(sv, 646, 188, 640, 238, 40, 12);
  etiquette(sv, 716, 188, 724, 232, 36, -8);
  return sv;
};

// 2 — Le déménageur : les photos reviennent d'un nuage vers la box, dans la maison ----------------
DESSINS.demenageur = () => {
  const sv = new Svg('demenageur.svg', 800, 600, {
    ...F800,
    title: 'Les photos reviennent du nuage vers la box, à la maison',
    desc: 'Une file de photos quitte un nuage lointain et descend vers un mas provençal. Par la fenêtre aux volets ouverts, on voit la box posée sur une console : les photos rentrent chez vous.',
  });
  carte(sv, 28, 28, 736, 536, 44);
  collines(sv, 52, 436, 690, 106, [76, 58, 72, 52, 46, 58]);
  olivier(sv, 150, 504, 116);
  // le mas, à droite : murs crème, toit de tuiles, cheminée, porte cintrée
  const x0 = 382;
  const x1 = 734;
  const yb = 506;
  const yt = 274;
  sv.obj(C.lin, (o) => {
    o.piece(rrect(650, 196, 26, 48, 2, { j: 0.4 }), C.creme);
    o.piece(rrect(645, 190, 36, 10, 2, { j: 0.3 }), C.terre);
    o.piece(rrect(x0, yt, x1 - x0, yb - yt, 2, { j: 0.6 }), C.creme);
    o.piece(
      soft(
        [
          [x0 - 16, yt + 8],
          [x0 + 60, yt - 52],
          [x1 - 60, yt - 52],
          [x1 + 16, yt + 8],
        ],
        5,
        { j: 0.6 },
      ),
      C.terre,
    );
    o.detail(rrect(674, 404, 40, yb - 404, [20, 20, 0, 0], { j: 0.4 }), C.noyer);
    o.detail(ell(704, 458, 3, 3, { j: 0.1, n: 6 }), C.caramel);
  });
  // la fenêtre et ses volets ouverts, à persiennes
  const wx = 436;
  const wy = 326;
  const ww = 186;
  const wh = 144;
  for (const vx of [wx - 34, wx + ww + 4]) {
    sv.obj(C.lin, (o) => {
      o.piece(rrect(vx, wy - 2, 30, wh + 4, 2, { j: 0.4 }), C.olive);
      for (let i = 0; i < 7; i++) {
        const ly = wy + 14 + i * 19;
        o.trait(
          [
            [vx + 6, ly],
            [vx + 24, ly],
          ],
          C.chocolat,
          2.6,
          { smooth: false, cap: 'butt' },
        );
      }
    });
  }
  // l'intérieur, vu par la fenêtre : un mur sable, sur lequel la coque perle se
  // détache (sur du lin, elle s'y perdrait)
  sv.path(rrect(wx, wy, ww, wh, 3, { j: 0.5 }), C.sable);
  // ombre de l'épaisseur du mur dans l'ouverture
  sv.path(
    cut(
      [
        [wx, wy],
        [wx + ww, wy],
        [wx + ww, wy + 6],
        [wx + 4, wy + 6],
        [wx + 4, wy + wh],
        [wx, wy + wh],
      ],
      { j: 0.2, seg: 400 },
    ),
    C.lin,
  );
  photo(sv, 600, 354, 36, 5, { motif: 'portrait' });
  // console et box ; l'ombre de la box passe sous la console. La box ne
  // remplit pas la fenêtre : on voit le mur autour d'elle, l'air qu'il lui faut.
  const sousConsole = sv.marque();
  sv.obj(C.lin, (o) => {
    for (const lx of [462, 596])
      o.line(
        [
          [lx, 458],
          [lx, wy + wh],
        ],
        C.noyer,
        7,
        { smooth: false, cap: 'butt' },
      );
    o.piece(rrect(446, 450, 166, 10, 2, { j: 0.4 }), C.caramel);
  });
  boite(sv, 520, 450, 110, { sous: sousConsole });
  sv.piece(rrect(wx - 14, wy + wh - 2, ww + 28, 12, 3, { j: 0.5 }), C.caramel, C.lin);
  // le trajet des photos, du nuage jusqu'à la fenêtre
  nuage(sv, 330, 108, 96);
  trajet(sv, [
    [236, 214],
    [300, 250],
    [364, 290],
    [420, 326],
  ]);
  photo(sv, 258, 222, 46, 7);
  nuage(sv, 176, 196, 222);
  photo(sv, 322, 258, 54, -6);
  photo(sv, 388, 296, 62, 8);
  photo(sv, 448, 328, 64, -6);
  return sv;
};

// 3 — Étape 1 : une personne commande, chez elle, à sa table ------------------------------------
DESSINS['etape-commande'] = () => {
  const sv = new Svg('etape-commande.svg', 600, 600, {
    ...F600,
    title: 'Vous commandez, chez vous, à votre table',
    desc: 'Une personne assise à sa table de cuisine commande la box sur son ordinateur portable : la box s’affiche à l’écran. Une tasse fume à côté ; par la fenêtre, des collines de Provence.',
  });
  carte(sv, 36, 36, 520, 520, 44);
  sol(sv, 60, 470, 472, 62, 18);
  fenetre(sv, 404, 88, 112, 150);
  // chaise
  sv.obj(C.lin, (o) => {
    o.line(
      [
        [132, 494],
        [134, 392],
      ],
      C.noyer,
      9,
      { smooth: false },
    );
    o.line(
      [
        [198, 494],
        [194, 392],
      ],
      C.noyer,
      9,
      { smooth: false },
    );
    o.line(
      [
        [128, 270],
        [126, 392],
      ],
      C.noyer,
      12,
      { smooth: false },
    );
    o.piece(rrect(118, 384, 92, 12, 3, { j: 0.4 }), C.noyer);
  });
  // la personne, de profil, tournée vers la droite
  sv.obj(C.lin, (o) => {
    o.piece(ell(164, 206, 12, 12), C.chocolat);
    o.line(
      [
        [268, 382],
        [274, 482],
      ],
      C.chocolat,
      18,
      { smooth: false },
    );
    o.piece(ell(286, 486, 16, 7), C.noyer);
    o.piece(
      soft(
        [
          [150, 362],
          [270, 360],
          [284, 372],
          [282, 392],
          [150, 392],
        ],
        8,
      ),
      C.chocolat,
    );
    o.piece(
      soft(
        [
          [146, 278],
          [166, 250],
          [204, 248],
          [220, 296],
          [214, 378],
          [148, 380],
        ],
        12,
      ),
      C.olive,
    );
    o.piece(ell(194, 220, 22, 23), C.caramel);
    o.piece(
      cut(
        [
          [214, 204, true],
          [198, 195, true],
          [178, 199, true],
          [169, 216, true],
          [172, 236, true],
          [182, 244, true],
          [188, 232, true],
          [192, 218, true],
          [204, 212, true],
        ],
        { j: 0.3 },
      ),
      C.chocolat,
    );
    o.line(
      [
        [194, 262],
        [210, 318],
        [262, 330],
      ],
      C.olive,
      17,
    );
    o.piece(ell(268, 329, 9, 8), C.caramel);
  });
  // table
  sv.obj(C.lin, (o) => {
    o.line(
      [
        [262, 350],
        [262, 494],
      ],
      C.noyer,
      12,
      { smooth: false, cap: 'butt' },
    );
    o.line(
      [
        [496, 350],
        [496, 494],
      ],
      C.noyer,
      12,
      { smooth: false, cap: 'butt' },
    );
    o.piece(rrect(236, 338, 286, 14, 3, { j: 0.6 }), C.caramel);
  });
  // l'ordinateur, tourné de trois quarts : la page de la box s'affiche à
  // l'écran, la box posée sur un fond pierre comme les images du prototype
  portableTroisQuarts(sv, 250, 338, 94, {
    ecran: (P) => {
      // repère de l'écran : x de 0 à 100 sur la largeur, y de 0 à 78 vers le bas
      const E = (x, y) => P(x / 100, 1 - y / 78);
      sv.path(soft([E(14, 14), E(86, 14), E(86, 64), E(14, 64)], 1.5, { j: 0.2 }), C.pierre);
      boite(sv, 50, 58, 50, { sh: C.noyer, offset: [1.5, 2], map: E });
    },
  });
  tasse(sv, 436, 338, 30);
  plante(sv, 494, 338, 46, { pot: C.creme });
  // la main repasse au premier plan, sur le clavier
  sv.piece(ell(268, 329, 9, 8), C.caramel);
  return sv;
};

// 4 — Étape 2 : des mains assemblent la box sur un établi ---------------------------------------
DESSINS['etape-assemblage'] = () => {
  const sv = new Svg('etape-assemblage.svg', 600, 600, {
    ...F600,
    title: 'Votre box est assemblée à la main, en Provence',
    desc: 'Sur un établi en bois, une main tient le socle brun foncé de la box pendant que l’autre y visse la carte électronique au tournevis. Au fond de l’établi, la coque blanc perlé, marquée du kanji du logo, attend ; des outils sont accrochés au mur et un brin d’olivier trempe dans un bocal.',
  });
  carte(sv, 36, 36, 520, 520, 44);
  // outils accrochés au mur
  sv.piece(rrect(160, 100, 280, 10, 3, { j: 0.5 }), C.caramel, C.lin);
  sv.obj(C.lin, (o) => {
    o.line(
      [
        [206, 112],
        [206, 124],
      ],
      C.noyer,
      3,
    );
    o.line(
      [
        [270, 112],
        [270, 122],
      ],
      C.noyer,
      3,
    );
    o.line(
      [
        [336, 112],
        [336, 120],
      ],
      C.noyer,
      3,
    );
    o.line(
      [
        [400, 112],
        [400, 124],
      ],
      C.noyer,
      3,
    );
    o.piece(rrect(198, 122, 16, 44, 7, { j: 0.4 }), C.olive);
    o.line(
      [
        [206, 166],
        [206, 200],
      ],
      C.lin,
      5,
      { smooth: false },
    );
    o.line(
      [
        [270, 128],
        [270, 200],
      ],
      C.caramel,
      9,
      { smooth: false },
    );
    o.piece(rrect(252, 120, 38, 16, 4, { j: 0.4 }), C.chocolat);
    o.line(
      [
        [336, 120],
        [324, 160],
        [320, 198],
      ],
      C.terre,
      7,
    );
    o.line(
      [
        [336, 120],
        [348, 160],
        [352, 198],
      ],
      C.terre,
      7,
    );
    o.piece(ell(400, 152, 28, 28), C.noyer);
    o.detail(ell(400, 152, 15, 15), C.sable);
  });
  // établi
  sv.obj(C.lin, (o) => {
    o.line(
      [
        [92, 470],
        [92, 540],
      ],
      C.noyer,
      16,
      { smooth: false, cap: 'butt' },
    );
    o.line(
      [
        [504, 470],
        [504, 540],
      ],
      C.noyer,
      16,
      { smooth: false, cap: 'butt' },
    );
    o.piece(
      soft(
        [
          [80, 300],
          [520, 300],
          [544, 452],
          [56, 452],
        ],
        6,
        { j: 0.8 },
      ),
      C.caramel,
    );
    o.piece(rrect(56, 448, 488, 28, [2, 2, 6, 6], { j: 0.7 }), C.noyer);
  });
  // bocal et brin d'olivier
  sv.obj(C.noyer, (o) => {
    o.line(
      [
        [110, 352],
        [106, 290],
        [98, 270],
      ],
      C.olive,
      3,
    );
    o.line(
      [
        [106, 314],
        [120, 286],
      ],
      C.olive,
      3,
    );
    o.piece(leaf(96, 272, 26, 10, -20), C.olive);
    o.piece(leaf(120, 280, 26, 10, 30), C.olive);
    o.piece(leaf(98, 304, 24, 9, -60), C.olive);
    o.piece(leaf(118, 312, 22, 9, 64), C.olive);
    o.piece(rrect(92, 318, 36, 44, 7, { j: 0.4 }), C.creme);
    o.detail(rrect(90, 316, 40, 7, 3, { j: 0.3 }), C.lin);
  });
  // vis
  sv.obj(C.noyer, (o) => {
    for (const [vx, vy] of [
      [96, 420],
      [112, 428],
      [124, 414],
    ])
      o.piece(ell(vx, vy, 4.5, 4.5, { n: 6 }), C.chocolat);
  });
  // la coque attend au fond de l'établi, à l'échelle du socle : un peu plus
  // loin, elle paraît à peine plus petite (la perspective de l'établi)
  boite(sv, 430, 345, 190, { socle: false, sh: C.noyer });
  // le socle, et la carte posée sur ses entretoises
  // (ombre courte : le socle est posé à plat sur l'établi)
  const s0 = socle(sv, 262, 442, 210, {
    sh: C.noyer,
    offset: [3, 3],
    fentes: false,
    plots: false,
  });
  const kb = 0.74; // la carte laisse voir le bord du socle tout autour
  const kd = 0.7;
  const z = 9; // hauteur des entretoises
  const A = (u, v, h = 0) => {
    const [x, y] = s0.dessus(0.5 + (u - 0.5) * kb, 0.5 + (v - 0.5) * kd);
    return [x, y - z - h];
  };
  const quad = (u0, u1, v0, v1, h = 0) => [A(u0, v0, h), A(u1, v0, h), A(u1, v1, h), A(u0, v1, h)];
  const trous = [
    [0.1, 0.18],
    [0.72, 0.18],
    [0.1, 0.82],
    [0.72, 0.82],
  ];
  sv.obj(C.chocolat, (o) => {
    // entretoises de devant, visibles sous la carte
    for (const [u, v] of trous.slice(0, 2)) {
      const [x, y] = A(u, v);
      o.piece(rrect(x - 4, y, 8, z + 1, [0, 0, 2, 2], { j: 0.1 }), C.caramel);
    }
    o.piece(soft(quad(0, 1, 0, 1), 5, { j: 0.4 }), C.olive);
    o.piece(soft([A(0, 0), A(1, 0), A(1, 0, -4), A(0, 0, -4)], 1.5, { j: 0.2 }), C.chocolat);
  });
  for (const [u, v] of trous) {
    const [hx, hy] = A(u, v);
    sv.path(ell(hx, hy, 4.4, 3, { n: 6 }), C.sable);
  }
  // broches, puce, bloc de prises au bout de la carte
  sv.path(soft(quad(0.12, 0.66, 0.84, 0.94), 1, { j: 0.2 }), C.chocolat);
  const [g0x, g0y] = A(0.13, 0.89);
  const [g1x, g1y] = A(0.65, 0.89);
  sv.line(
    [
      [g0x, g0y],
      [g1x, g1y],
    ],
    C.caramel,
    3,
    { dash: '3 3', smooth: false, cap: 'butt', j: 0 },
  );
  sv.path(soft(quad(0.34, 0.5, 0.34, 0.62), 2, { j: 0.2 }), C.lin);
  sv.path(soft(quad(0.55, 0.64, 0.38, 0.58), 1, { j: 0.2 }), C.chocolat);
  sv.obj(C.chocolat, (o) => {
    o.piece(
      soft([A(0.78, 0.04), A(0.98, 0.04), A(0.98, 0.04, 18), A(0.78, 0.04, 18)], 1, { j: 0.2 }),
      C.lin,
    );
    o.piece(soft(quad(0.78, 0.98, 0.04, 0.9, 18), 2, { j: 0.2 }), C.creme);
  });
  // main gauche qui tient le socle : paume posée, doigts sur le bord, pouce à part
  sv.obj(C.noyer, (o) => {
    o.piece(
      soft(
        [
          [116, 553],
          [190, 553],
          [196, 472],
          [152, 454],
        ],
        14,
        { j: 0.6 },
      ),
      C.terre,
    );
    main(o, 172, 466, 72, 36, C.lin, { gauche: true });
  });
  // main droite au tournevis : le poing serre le manche, la pointe va dans le
  // trou de fixation avant droit de la carte, bien visible
  const [tx, ty] = A(0.72, 0.18);
  const W = [452, 456];
  const sm = 66;
  const ax = -0.12; // l'outil sort entre le pouce et l'index (voir main())
  const [dx, dy] = [(tx - W[0]) / sm, (ty - W[1]) / sm];
  const deg = ((Math.atan2(dy, dx) + Math.acos(ax / Math.hypot(dx, dy))) * 180) / Math.PI;
  const r = (deg * Math.PI) / 180;
  // la tige part à 0,7 du poignet ; son bout arrondi (demi-épaisseur 0,0375)
  // s'arrête au centre du trou
  const long = dx * Math.sin(r) - dy * Math.cos(r) - 0.7 - 0.0375;
  sv.obj(C.noyer, (o) => {
    o.piece(
      soft(
        [
          [434, 472],
          [466, 438],
          [516, 553],
          [440, 553],
        ],
        14,
        { j: 0.6 },
      ),
      C.terre,
    );
    main(o, W[0], W[1], sm, deg, C.lin, {
      pose: 'poing',
      outil: { manche: C.olive, tige: C.lin, long },
    });
  });
  return sv;
};

// 5 — Étape 3 : l'installation à côté de la box internet, montrée à la famille -----------------
DESSINS['etape-installation'] = () => {
  const sv = new Svg('etape-installation.svg', 600, 600, {
    ...F600,
    title: 'Nous installons la box chez vous et vous la présentons',
    desc: 'Sur un meuble bas, la box est branchée à côté de la box internet. Une personne de l’équipe la montre de la main à une famille, un adulte et un enfant, qui regardent.',
  });
  carte(sv, 36, 36, 520, 520, 44);
  sol(sv, 60, 470, 472, 62, 18);
  fenetre(sv, 396, 92, 108, 128, { cypres: false });
  photo(sv, 182, 230, 88, -2);
  // les ombres de la box et de la box internet passent sous le plateau du meuble
  const sousMeuble = sv.marque();
  meuble(sv, 64, 380, 232, 100);
  sv.line(
    [
      [150, 356],
      [164, 338],
      [176, 352],
    ],
    C.noyer,
    3.5,
  );
  routeur(sv, 118, 380, 74, { sous: sousMeuble });
  boite(sv, 224, 380, 100, { sous: sousMeuble });
  personne(sv, {
    x: 342,
    y: 496,
    h: 232,
    peau: C.lin,
    cheveux: C.noyer,
    coiffure: 'court',
    haut: C.terre,
    bas: C.chocolat,
    regard: -1,
    brasG: [
      [0, 0],
      [-10, 9],
      [-19.5, 13],
    ],
  });
  personne(sv, {
    x: 442,
    y: 496,
    h: 238,
    peau: C.noyer,
    cheveux: C.chocolat,
    coiffure: 'long',
    haut: C.olive,
    bas: C.noyer,
    regard: -1,
    brasD: [
      [0, 0],
      [5, 16],
      [12, 31],
    ],
  });
  personne(sv, {
    x: 512,
    y: 496,
    h: 146,
    age: 'enfant',
    peau: C.noyer,
    cheveux: C.chocolat,
    coiffure: 'boucles',
    haut: C.caramel,
    bas: C.olive,
    regard: -1,
  });
  return sv;
};

// 6 — Étape 4 : la box chez vous, sur une étagère ------------------------------------------------
DESSINS['etape-chez-vous'] = () => {
  const sv = new Svg('etape-chez-vous.svg', 600, 600, {
    ...F600,
    title: 'La box chez vous, sur une étagère',
    desc: 'Dans une pièce calme, la box est posée sur une étagère en bois, à côté de la box internet, entre des livres et une plante. Une fenêtre donne sur des collines de Provence ; un chat dort sur le sol.',
  });
  carte(sv, 36, 36, 520, 520, 44);
  sol(sv, 60, 476, 472, 56, 18);
  fenetre(sv, 92, 112, 132, 172);
  photo(sv, 382, 214, 88, -3, { motif: 'portrait' });
  // les ombres des objets posés passent sous la planche : seule leur part sur
  // le mur reste visible
  const sousEtagere = sv.marque();
  etagere(sv, 196, 374, 334);
  sv.obj(
    C.lin,
    (o) => {
      o.piece(rrect(212, 304, 16, 70, 2, { j: 0.4 }), C.olive);
      o.piece(turn(rrect(230, 312, 15, 64, 2, { j: 0.4 }), 12, 245, 374), C.noyer);
    },
    undefined,
    sousEtagere,
  );
  sv.line(
    [
      [318, 350],
      [334, 332],
      [350, 346],
    ],
    C.noyer,
    3.5,
  );
  // de l'air de chaque côté de la box, entre la box internet et la plante
  routeur(sv, 296, 374, 68, { sous: sousEtagere });
  boite(sv, 406, 374, 100, { sous: sousEtagere });
  plante(sv, 502, 374, 62, { retombante: true, sous: sousEtagere });
  // chat endormi, roulé en boule (ombre courte : il est posé au sol)
  sv.obj(
    C.caramel,
    (o) => {
      o.line(
        [
          [120, 506],
          [104, 500],
          [102, 486],
          [114, 480],
        ],
        C.noyer,
        8,
      );
      o.piece(ell(152, 492, 40, 20), C.noyer);
      o.piece(ell(190, 494, 16, 14), C.noyer);
      o.piece(
        soft(
          [
            [179, 486],
            [182, 470],
            [192, 482],
          ],
          2,
        ),
        C.noyer,
      );
      o.piece(
        soft(
          [
            [192, 482],
            [200, 470],
            [203, 486],
          ],
          2,
        ),
        C.noyer,
      );
    },
    [2, 3],
  );
  return sv;
};

// 7 — Offre Home : un salon familial ------------------------------------------------------------
DESSINS['offre-home'] = () => {
  const sv = new Svg('offre-home.svg', 800, 500, {
    ...F800,
    title: 'Un salon familial',
    desc: 'Sur un canapé, une grand-mère, un enfant et un adulte regardent ensemble des photos sur une tablette. À droite, la box est posée seule dans la grande case du milieu d’une bibliothèque, avec de l’air autour ; des livres au-dessus, la box internet en dessous.',
  });
  carte(sv, 26, 26, 742, 440, 40);
  sol(sv, 50, 392, 694, 52, 18);
  photo(sv, 222, 132, 72, -3);
  photo(sv, 312, 118, 58, 4, { motif: 'portrait' });
  // canapé
  sv.obj(C.lin, (o) => {
    o.line(
      [
        [132, 376],
        [132, 398],
      ],
      C.noyer,
      10,
      { smooth: false, cap: 'butt' },
    );
    o.line(
      [
        [432, 376],
        [432, 398],
      ],
      C.noyer,
      10,
      { smooth: false, cap: 'butt' },
    );
    o.piece(rrect(112, 226, 340, 104, 24, { j: 0.8 }), C.olive);
    o.piece(rrect(98, 330, 368, 52, 14, { j: 0.8 }), C.olive);
  });
  // l'enfant d'abord : la main de la grand-mère et celle de l'adulte passent devant
  assise(sv, {
    x: 284,
    siege: 344,
    sol: 386,
    h: 150,
    age: 'enfant',
    peau: C.noyer,
    cheveux: C.chocolat,
    coiffure: 'boucles',
    haut: C.terre,
    bas: C.chocolat,
    sh: C.chocolat,
    brasG: [
      [0, 0],
      [-6, 12],
      [-9.6, 24],
    ],
    brasD: [
      [0, 0],
      [6, 12],
      [9.6, 24],
    ],
    tenu: (o) => {
      o.piece(rrect(250, 310, 68, 44, 5, { j: 0.4 }), C.chocolat);
      o.detail(rrect(255, 315, 58, 34, 2, { j: 0.3 }), C.creme);
      o.detail(
        cut(
          [
            [255, 349],
            [255, 336],
            [274, 325, true],
            [292, 334, true],
            [313, 328],
            [313, 349],
          ],
          { j: 0.2 },
        ),
        C.olive,
      );
      o.detail(ell(298, 322, 4, 4, { n: 6 }), C.caramel);
    },
  });
  assise(sv, {
    x: 192,
    siege: 336,
    sol: 400,
    h: 214,
    age: 'aine',
    peau: C.lin,
    cheveux: C.creme,
    coiffure: 'chignon',
    haut: C.caramel,
    bas: C.noyer,
    regard: 1,
    sh: C.chocolat,
    brasD: [
      [0, 0],
      [10, 9],
      [20.8, 10.4],
    ],
  });
  assise(sv, {
    x: 372,
    siege: 336,
    sol: 400,
    h: 232,
    peau: C.caramel,
    cheveux: C.chocolat,
    coiffure: 'court',
    haut: C.creme,
    bas: C.noyer,
    regard: -1,
    sh: C.chocolat,
    brasG: [
      [0, 0],
      [-3, 12],
      [-7.6, 20],
    ],
  });
  // la bibliothèque du salon : la box au milieu, sur le fond noyer, des livres
  // au-dessus, la box internet en dessous. La case de la box est large et haute :
  // la box a un ventilateur, on lui laisse de l'air au-dessus et sur les côtés.
  const biblio = casier(sv, 494, 70, 246, 318, [82, 166, 61]);
  const [haut, milieu, bas] = biblio.cases;
  sv.obj(
    C.noyer,
    (o) => {
      let bx = haut.x0 + 12;
      for (const [bw, bh, col] of [
        [13, 52, C.creme],
        [10, 46, C.olive],
        [15, 56, C.caramel],
        [11, 49, C.lin],
        [14, 53, C.terre],
      ]) {
        o.piece(rrect(bx, haut.yb - 2 - bh, bw, bh, 1.5, { j: 0.3 }), col);
        bx += bw + 1;
      }
      // un livre penché contre les autres, une pile de livres couchés
      o.piece(
        turn(rrect(bx + 2, haut.yb - 2 - 50, 12, 50, 1.5, { j: 0.3 }), 14, bx + 2, haut.yb - 2),
        C.creme,
      );
      for (const [dy, lw, dx, col] of [
        [0, 58, 0, C.olive],
        [-10, 52, 4, C.creme],
        [-19, 56, 1, C.caramel],
      ])
        o.piece(rrect(haut.x1 - 72 + dx, haut.yb - 12 + dy, lw, 10, 1.5, { j: 0.3 }), col);
    },
    undefined,
    biblio.sous,
  );
  const cx = (milieu.x0 + milieu.x1) / 2;
  boite(sv, cx, milieu.yb - 3, 150, { sh: C.noyer, sous: biblio.sous, mot: true });
  routeur(sv, cx, bas.yb - 2, 56, { sh: C.noyer, sous: biblio.sous });
  return sv;
};

// 8 — Offre Pro : une petite boutique provençale -------------------------------------------------
DESSINS['offre-pro'] = () => {
  const sv = new Svg('offre-pro.svg', 800, 500, {
    ...F800,
    title: 'Une petite boutique provençale',
    desc: 'Dans une petite épicerie de Provence, une commerçante en tablier se tient derrière son comptoir, devant son ordinateur. Un collègue porte une caisse de bouteilles. À droite, la box est posée seule dans la grande case du milieu d’une étagère peinte en vert, avec de l’air autour ; à côté, une fenêtre cintrée aux volets verts.',
  });
  carte(sv, 26, 26, 742, 440, 40);
  sol(sv, 50, 392, 694, 52, 18);
  // étagères de produits, au fond
  sv.piece(rrect(180, 156, 112, 11, 3, { j: 0.6 }), C.caramel, C.lin);
  sv.piece(rrect(180, 236, 228, 11, 3, { j: 0.6 }), C.caramel, C.lin);
  sv.obj(C.lin, (o) => {
    for (const [bx, col] of [
      [198, C.olive],
      [220, C.caramel],
      [242, C.olive],
    ]) {
      o.piece(rrect(bx - 7, 104, 14, 52, [5, 5, 2, 2], { j: 0.3 }), col);
    }
    for (const bx of [198, 220, 242]) o.piece(rrect(bx - 3, 94, 6, 12, 1, { j: 0.2 }), C.chocolat);
    // torchons pliés : le pli arrondi à droite, une bande de couleur à gauche
    for (const [sx, sy, col, bande] of [
      [188, 220, C.creme, C.olive],
      [191, 204, C.olive, C.creme],
      [187, 188, C.creme, C.caramel],
    ]) {
      o.piece(
        cut(
          [
            [sx, sy],
            [sx + 33, sy],
            [sx + 39.5, sy + 2.4, true],
            [sx + 42, sy + 8, true],
            [sx + 39.5, sy + 13.6, true],
            [sx + 33, sy + 16],
            [sx, sy + 16],
          ],
          { j: 0.3 },
        ),
        col,
      );
      o.detail(rrect(sx + 7, sy + 0.5, 5, 15, 0.5, { j: 0.1 }), bande);
    }
    for (const bx of [366, 388])
      o.piece(rrect(bx - 8, 190, 16, 46, [6, 6, 2, 2], { j: 0.3 }), C.caramel);
    for (const bx of [366, 388]) o.piece(rrect(bx - 3, 180, 6, 12, 1, { j: 0.2 }), C.chocolat);
  });
  // la commerçante derrière le comptoir (on la voit à partir de la taille)
  personne(sv, {
    x: 294,
    y: 392,
    h: 232,
    peau: C.lin,
    cheveux: C.noyer,
    coiffure: 'chignon',
    haut: C.creme,
    bas: C.noyer,
    brasG: [
      [0, 0],
      [-3, 16],
      [-6, 30],
    ],
    brasD: [
      [0, 0],
      [3, 16],
      [6, 30],
    ],
    devant: (o, p) => {
      o.piece(rrect(294 - 19, p.epaules + 18, 38, 76, [6, 6, 2, 2], { j: 0.4 }), C.olive);
    },
  });
  // comptoir et dos de l'ordinateur
  sv.obj(C.lin, (o) => {
    o.piece(rrect(178, 314, 220, 80, [2, 2, 4, 4], { j: 0.7 }), C.noyer);
    o.piece(rrect(168, 302, 240, 14, 3, { j: 0.6 }), C.caramel);
    for (const lx of [222, 266, 310, 354])
      o.trait(
        [
          [lx, 324],
          [lx, 384],
        ],
        C.chocolat,
        3,
        { smooth: false },
      );
  });
  sv.obj(C.lin, (o) => {
    o.piece(rrect(186, 295, 76, 7, 2, { j: 0.3 }), C.lin);
    o.piece(rrect(190, 248, 68, 44, [6, 6, 2, 2], { j: 0.4 }), C.noyer);
    o.detail(rrect(194, 248, 60, 3, 1.5, { j: 0.2 }), C.lin);
    o.piece(rrect(194, 290, 60, 6, 3, { j: 0.2 }), C.chocolat);
  });
  // le collègue, une caisse de bouteilles dans les bras
  personne(sv, {
    x: 98,
    y: 420,
    h: 232,
    peau: C.noyer,
    cheveux: C.chocolat,
    coiffure: 'ras',
    haut: C.olive,
    bas: C.chocolat,
    regard: 1,
    carrure: 1.1,
    brasG: [
      [0, 0],
      [-4, 15],
      [-2, 28],
    ],
    brasD: [
      [0, 0],
      [4, 15],
      [2, 28],
    ],
    devant: (o, p) => {
      const y = p.epaules + 62;
      for (const [bx, col] of [
        [72, C.chocolat],
        [88, C.noyer],
        [104, C.chocolat],
        [120, C.noyer],
      ]) {
        o.piece(rrect(bx - 5, y - 34, 10, 38, [4, 4, 1, 1], { j: 0.2 }), col);
      }
      o.piece(rrect(56, y - 6, 84, 40, 3, { j: 0.4 }), C.caramel);
      o.trait(
        [
          [62, y + 10],
          [134, y + 10],
        ],
        C.noyer,
        3,
        { smooth: false },
      );
    },
  });
  // l'étagère peinte de la boutique : des bocaux en haut, la box au milieu, sur
  // le fond noyer, la box internet en dessous. Comme dans le salon, la case de
  // la box est large et haute : de l'air au-dessus et sur les côtés.
  const meubleVert = casier(sv, 418, 70, 238, 318, [82, 166, 61], { cadre: C.olive });
  const [haut, milieu, bas] = meubleVert.cases;
  sv.obj(
    C.noyer,
    (o) => {
      for (const bx of [haut.x0 + 26, haut.x0 + 60, haut.x0 + 94])
        o.piece(rrect(bx - 14, haut.yb - 38, 28, 36, 5, { j: 0.3 }), C.creme);
      for (const bx of [haut.x0 + 26, haut.x0 + 60, haut.x0 + 94])
        o.piece(rrect(bx - 15, haut.yb - 44, 30, 9, 3, { j: 0.2 }), C.caramel);
      for (const bx of [haut.x1 - 52, haut.x1 - 28])
        o.piece(rrect(bx - 8, haut.yb - 48, 16, 46, [6, 6, 2, 2], { j: 0.3 }), C.caramel);
      for (const bx of [haut.x1 - 52, haut.x1 - 28])
        o.piece(rrect(bx - 3, haut.yb - 58, 6, 12, 1, { j: 0.2 }), C.lin);
    },
    undefined,
    meubleVert.sous,
  );
  const cx = (milieu.x0 + milieu.x1) / 2;
  boite(sv, cx, milieu.yb - 3, 150, { sh: C.noyer, sous: meubleVert.sous, mot: true });
  routeur(sv, cx, bas.yb - 2, 54, { sh: C.noyer, sous: meubleVert.sous });
  // fenêtre cintrée et volets (des volets étroits : l'étagère prend la place)
  sv.path(rrect(664, 78, 14, 120, 2, { j: 0.4 }), C.olive);
  sv.path(rrect(746, 78, 14, 120, 2, { j: 0.4 }), C.olive);
  sv.path(rrect(678, 72, 68, 128, [34, 34, 2, 2], { j: 0.5 }), C.creme);
  sv.path(
    cut(
      [
        [678, 200],
        [678, 162],
        [710, 152, true],
        [746, 164],
        [746, 200],
      ],
      { j: 0.4 },
    ),
    C.lin,
  );
  sv.path(
    cut(
      [
        [678, 200],
        [678, 182],
        [716, 174, true],
        [746, 180],
        [746, 200],
      ],
      { j: 0.4 },
    ),
    C.olive,
  );
  sv.line(
    [
      [712, 72],
      [712, 200],
    ],
    C.sable,
    5,
    { smooth: false, cap: 'butt' },
  );
  sv.piece(rrect(668, 198, 88, 12, 3, { j: 0.5 }), C.caramel, C.lin);
  plante(sv, 712, 400, 70);
  return sv;
};

// 9 — Vue éclatée de la box ------------------------------------------------------------------------
DESSINS['vue-eclatee'] = () => {
  const sv = new Svg('vue-eclatee.svg', 800, 800, {
    ...F800,
    title: 'La box en vue éclatée',
    desc: 'Les cinq pièces de la box, écartées de haut en bas : la coque blanc perlé, avec le kanji du logo sur le dessus et le mot HAKO du logo sur la face avant ; le ventilateur ; la carte Raspberry Pi 5 avec son bloc de prises, sa puce et sa rangée de broches ; la carte NVMe avec son disque SSD, reliée à la Raspberry Pi par une nappe ; puis le socle brun foncé, sur ses pieds.',
  });
  const CX = 400; // la pile, au milieu de sa carte
  const WC = 320; // largeur de la coque
  // même vue que la box : profondeur raccourcie, dessus qui rétrécit vers le fond
  const at =
    (pl) =>
    (u, v, z = 0) => [
      CX + (u - 0.5) * pl.W * (1 - 2 * BOX.fuite * v),
      pl.yf - v * pl.D * BOX.vue - z,
    ];
  const quad = (pl, u0, u1, v0, v1, z = 0) => {
    const m = at(pl);
    return [m(u0, v0, z), m(u1, v0, z), m(u1, v1, z), m(u0, v1, z)];
  };
  const face = (pl, u0, u1, v, z0, z1) => {
    const m = at(pl);
    return [m(u0, v, z0), m(u1, v, z0), m(u1, v, z1), m(u0, v, z1)];
  };
  const poly = (pts, r = 3, j = 0.4) => soft(pts, r, { j });
  const anchors = {};
  const anchor = (name, xr, ytop, ybot) => {
    anchors[name] = {
      x: Math.round(((xr + 24) / 800) * 1000) / 10,
      y: Math.round(((ytop + ybot) / 2 / 800) * 1000) / 10,
    };
  };

  // le fond : une carte pierre, le gris chaud des images du prototype et de la
  // scène 3D. La coque perle s'y détache ; les ombres y sont en noyer : elles
  // dessinent aussi le bord de l'angle pierre de la coque. La carte n'a pas
  // d'ombre : posée dans une section pierre (la scène 3D), elle s'y fond.
  const OMB = C.noyer;
  sv.piece(rrect(26, 26, 748, 748, 44, { j: 1.2, seg: 60 }), C.pierre);
  // repères d'assemblage
  for (const sx of [-1, 1])
    sv.line(
      [
        [CX + sx * 116, 268],
        [CX + sx * 116, 640],
      ],
      C.lin,
      3,
      { dash: '2 10', smooth: false },
    );

  // la coque, avec le kanji sur le dessus
  const coque = boite(sv, CX, 256, WC, { socle: false, sh: OMB, mot: true });
  anchor('Case_Lid', CX + WC / 2, coque.yDos, coque.yCoque);

  // ventilateur
  const fan = { yf: 340, W: 112, D: 112 };
  sv.obj(OMB, (o) => {
    o.piece(poly(quad(fan, 0, 1, 0, 1), 7), C.lin);
    o.piece(rrect(CX - 56, fan.yf - 1, 112, 14, [1, 1, 5, 5], { j: 0.4 }), C.chocolat);
    const m = at(fan);
    const ring = [];
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      const [x, y] = m(0.5 + 0.43 * Math.cos(t), 0.5 + 0.43 * Math.sin(t));
      ring.push({ x, y, s: true });
    }
    o.detail(ring, C.chocolat);
    for (let i = 0; i < 7; i++) {
      const t0 = (i / 7) * Math.PI * 2;
      const pts = [];
      for (const [r, dt] of [
        [0.13, 0],
        [0.4, 0.28],
        [0.4, 0.62],
        [0.13, 0.52],
      ]) {
        const [x, y] = m(0.5 + r * Math.cos(t0 + dt), 0.5 + r * Math.sin(t0 + dt));
        pts.push([x, y, true]);
      }
      o.detail(cut(pts, { j: 0.2 }), C.caramel);
    }
    const hub = [];
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      const [x, y] = m(0.5 + 0.13 * Math.cos(t), 0.5 + 0.13 * Math.sin(t));
      hub.push({ x, y, s: true });
    }
    o.detail(hub, C.noyer);
  });
  anchor('Fan', CX + 56, fan.yf - fan.D * BOX.vue, fan.yf + 13);

  // carte Raspberry Pi 5, au-dessus de la carte NVMe comme sur l'image de
  // l'intérieur du prototype. Elle est tournée d'un demi-tour, comme dans le
  // prototype : le bloc de prises USB et Ethernet au bout gauche (côté des
  // fenêtres de la coque), les broches le long du bord avant, les petites prises
  // le long du bord arrière, la nappe au bout droit.
  const pi = { yf: 458, W: 250, D: 165 };
  const m = at(pi);
  sv.obj(OMB, (o) => {
    o.piece(poly(quad(pi, 0, 1, 0, 1), 7), C.olive);
    o.piece(rrect(CX - 125, pi.yf - 1, 250, 9, [1, 1, 3, 3], { j: 0.3 }), C.chocolat);
    for (const [u, v] of [
      [0.28, 0.12],
      [0.95, 0.12],
      [0.28, 0.88],
      [0.95, 0.88],
    ]) {
      const [hx, hy] = m(u, v);
      o.detail(ell(hx, hy, 4.6, 3, { n: 6 }), C.sable);
    }
    // petites prises (USB-C, micro-HDMI) debout le long du bord arrière
    for (const u of [0.54, 0.64, 0.76])
      o.detail(poly(face(pi, u, u + 0.06, 0.98, 0, 7), 0.5, 0.1), C.lin);
    // rangée de broches (GPIO) le long du bord avant
    o.detail(poly(quad(pi, 0.32, 0.9, 0.05, 0.17, 3), 1, 0.2), C.chocolat);
    // mémoire et puce principale, sous le ventilateur
    o.detail(poly(quad(pi, 0.33, 0.43, 0.4, 0.66, 3), 1.5, 0.2), C.chocolat);
    o.detail(poly(face(pi, 0.48, 0.64, 0.34, 0, 7), 0.5, 0.1), C.noyer);
    o.detail(poly(quad(pi, 0.48, 0.64, 0.34, 0.7, 7), 2, 0.2), C.lin);
  });
  sv.line([m(0.335, 0.11, 5), m(0.885, 0.11, 5)], C.caramel, 4.5, {
    smooth: false,
    cap: 'butt',
    j: 0,
    dash: '3.2 3.2',
  });
  // bloc de prises USB et Ethernet, au bout gauche de la carte : dessus crème,
  // face lin. Trois modules côte à côte ; comme sur la vraie carte, les prises
  // s'ouvrent vers le petit côté, caché ici : la face avant reste pleine.
  sv.obj(null, (o) => {
    o.piece(poly(face(pi, 0.03, 0.23, 0.08, 0, 28), 1, 0.2), C.lin);
    o.piece(poly(quad(pi, 0.03, 0.23, 0.08, 0.94, 28), 2, 0.2), C.creme);
    o.trait([m(0.035, 0.36, 28), m(0.225, 0.36, 28)], C.lin, 2.5, { smooth: false });
    o.trait([m(0.035, 0.64, 28), m(0.225, 0.64, 28)], C.lin, 2.5, { smooth: false });
  });
  anchor('RPi5_Board', CX + 125, pi.yf - pi.D * BOX.vue, pi.yf + 9);

  // carte NVMe et son SSD : le support M.2 à gauche, la vis au bout du SSD,
  // la prise de la nappe à droite
  const nv = { yf: 598, W: 250, D: 165 };
  const mv = at(nv);
  sv.obj(OMB, (o) => {
    o.piece(poly(quad(nv, 0, 1, 0, 1), 7), C.olive);
    o.piece(rrect(CX - 125, nv.yf - 1, 250, 9, [1, 1, 3, 3], { j: 0.3 }), C.chocolat);
    o.detail(poly(quad(nv, 0.16, 0.74, 0.3, 0.7, 2), 3, 0.2), C.chocolat);
    o.detail(poly(quad(nv, 0.3, 0.64, 0.37, 0.63, 2), 2, 0.2), C.lin);
    o.detail(poly(quad(nv, 0.16, 0.22, 0.33, 0.67, 2), 1, 0.2), C.caramel);
    o.detail(poly(quad(nv, 0.1, 0.16, 0.26, 0.74, 3), 1, 0.2), C.creme);
    const [sx, sy] = mv(0.785, 0.5);
    o.detail(ell(sx, sy, 5, 3.4, { n: 6 }), C.caramel);
    for (const [u, v] of [
      [0.05, 0.12],
      [0.95, 0.12],
      [0.05, 0.88],
      [0.95, 0.88],
    ]) {
      const [hx, hy] = mv(u, v);
      o.detail(ell(hx, hy, 4.6, 3, { n: 6 }), C.sable);
    }
  });
  anchor('NVMe_Board', CX + 125, nv.yf - nv.D * BOX.vue, nv.yf + 9);

  // nappe souple : elle sort sous le bout droit de la Raspberry Pi et descend
  // jusqu'à sa prise, sur la carte NVMe
  const [px, py] = mv(0.9, 0.5, 2);
  sv.line(
    [
      [CX + 92, pi.yf + 8],
      [CX + 102, pi.yf + 36],
      [CX + 97, pi.yf + 70],
      [px, py],
    ],
    C.caramel,
    10,
    { cap: 'butt' },
  );
  sv.path(poly(quad(nv, 0.86, 0.94, 0.36, 0.64, 4), 1, 0.2), C.creme);

  // le socle, ses fentes d'aération, ses entretoises et ses pieds
  // (ombre plus plate : elle laisse voir le jour entre les pieds)
  const base = socle(sv, CX, 744, WC, { sh: OMB, offset: [5, 3] });
  anchor('Case_Base', base.xr, base.yDos, base.yb);

  if (process.env.PAPIER_ANCRES) {
    mkdirSync(process.env.PAPIER_ANCRES, { recursive: true });
    writeFileSync(
      path.join(process.env.PAPIER_ANCRES, 'vue-eclatee.anchors.json'),
      `${JSON.stringify(anchors, null, 2)}\n`,
    );
  }
  return sv;
};

// 11 — Page 404 : une box vide, ouverte --------------------------------------------------------------
DESSINS['404'] = () => {
  const sv = new Svg('404.svg', 600, 600, {
    ...F600,
    title: 'Une box vide, ouverte',
    desc: 'Le socle brun foncé de la box, vide, posé au sol ; sa coque blanc perlé, marquée du kanji et du mot HAKO du logo, flotte au-dessus, un peu penchée.',
  });
  carte(sv, 36, 36, 520, 520, 44);
  sol(sv, 60, 470, 472, 62, 18);
  socle(sv, 300, 498, 264);
  // la coque soulevée, un peu penchée
  const a = (-8 * Math.PI) / 180;
  const [ox, oy] = [312, 262];
  boite(sv, 312, 336, 264, {
    socle: false,
    mot: true,
    map: (x, y) => [
      ox + (x - ox) * Math.cos(a) - (y - oy) * Math.sin(a),
      oy + (x - ox) * Math.sin(a) + (y - oy) * Math.cos(a),
    ],
  });
  return sv;
};

// 12 — Vignettes des tutoriels ------------------------------------------------------------------------
const tuto = (name, title, desc, fn) => {
  DESSINS[`tutoriels/${name}`] = () => {
    const sv = new Svg(`tutoriels/${name}.svg`, 640, 360, { ...F600, title, desc });
    carte(sv, 18, 18, 600, 318, 30);
    // le sol commence au bas de la coque : la coque perle, presque du ton du
    // lin, se détache sur la carte sable ; seuls le socle et les pieds sont au sol
    sol(sv, 42, 266, 552, 42, 16);
    fn(sv);
    return sv;
  };
};

tuto(
  'prise-en-main',
  'Prendre en main sa box',
  'La box et un ordinateur portable posés côte à côte ; sur l’écran, une petite maison, la page d’accueil de la box.',
  (sv) => {
    trajet(sv, [
      [246, 150],
      [302, 102],
      [374, 92],
      [434, 120],
    ]);
    boite(sv, 204, 276, 164, { mot: true });
    portableFace(sv, 460, 274, 176, {
      ecran: (cx, cy) => {
        sv.piece(
          soft(
            [
              [cx - 34, cy - 4],
              [cx, cy - 36],
              [cx + 34, cy - 4],
              [cx + 25, cy - 4],
              [cx + 25, cy + 30],
              [cx - 25, cy + 30],
              [cx - 25, cy - 4],
            ],
            3,
          ),
          C.olive,
          C.lin,
        );
        sv.path(rrect(cx - 8, cy + 10, 16, 20, [7, 7, 0, 0], { j: 0.2 }), C.creme);
      },
    });
  },
);

tuto(
  'acceder-donnees',
  'Accéder à ses fichiers',
  'À la maison, à côté de la box, un grand dossier ouvert laisse dépasser des documents et une photo. Par la fenêtre, des collines.',
  (sv) => {
    fenetre(sv, 58, 42, 82, 96, { cypres: false });
    trajet(sv, [
      [250, 160],
      [292, 112],
      [340, 98],
      [380, 112],
    ]);
    boite(sv, 222, 276, 150, { mot: true });
    const x = 352;
    const y = 92;
    sv.piece(
      soft(
        [
          [x, y + 12],
          [x + 78, y + 12],
          [x + 92, y + 30],
          [x + 224, y + 30],
          [x + 224, y + 178],
          [x, y + 178],
        ],
        8,
      ),
      C.noyer,
      C.lin,
    );
    sv.obj(C.noyer, (o) => {
      o.piece(turn(rrect(x + 26, y + 26, 132, 104, 3, { j: 0.4 }), -6, x + 90, y + 80), C.creme);
      o.piece(turn(rrect(x + 64, y + 36, 132, 104, 3, { j: 0.4 }), 5, x + 130, y + 88), C.lin);
    });
    for (let i = 0; i < 3; i++)
      sv.line(
        [
          [x + 78, y + 62 + i * 18],
          [x + 166 - i * 16, y + 69 + i * 18],
        ],
        C.sable,
        6,
        { smooth: false },
      );
    photo(sv, x + 168, y + 60, 60, 10, { sh: C.noyer });
    sv.piece(
      soft(
        [
          [x - 8, y + 84],
          [x + 214, y + 84],
          [x + 230, y + 178],
          [x + 6, y + 178],
        ],
        8,
      ),
      C.caramel,
      null,
    );
  },
);

tuto(
  'recuperer-photos',
  'Récupérer ses photos',
  'Trois photos descendent d’un petit nuage lointain vers la box posée à la maison.',
  (sv) => {
    // le nuage laisse de l'air sous le bord de la carte, et ne touche pas la photo
    nuage(sv, 146, 114, 140);
    trajet(sv, [
      [206, 118],
      [268, 146],
      [334, 172],
      [404, 198],
    ]);
    photo(sv, 250, 146, 52, 8);
    photo(sv, 320, 172, 60, -6);
    photo(sv, 382, 198, 64, 5);
    boite(sv, 500, 276, 160, { mot: true });
  },
);

tuto(
  'verifier-sauvegarde',
  'Vérifier que ses photos sont bien gardées',
  'La box, avec à côté une pile de photos bien rangées et une pastille verte cochée.',
  (sv) => {
    boite(sv, 214, 276, 168, { mot: true });
    photo(sv, 452, 238, 106, -4);
    photo(sv, 458, 220, 106, 3);
    photo(sv, 454, 198, 106, -1, { motif: 'portrait' });
    sv.piece(ell(334, 94, 36, 36), C.olive, C.lin);
    sv.line(
      [
        [317, 95],
        [329, 107],
        [353, 81],
      ],
      C.creme,
      8,
      { smooth: false },
    );
  },
);

// 10 — Icônes d'engagement (48 × 48) ---------------------------------------------------------------
// Chaque pictogramme est dessiné sur la grille de 48, puis porté à l'échelle k
// autour du centre (24, 24) pour couvrir environ 70 % de l'icône. Seules les
// coordonnées changent d'échelle : le trait garde son épaisseur de 2,6.
const T = 2.6;
const icone = (name, title, desc, k, fn) => {
  DESSINS[`icones/engagement-${name}`] = () => {
    const sv = new Svg(`icones/engagement-${name}.svg`, 48, 48, {
      sh: [1, 1.5],
      trait: T,
      title,
      desc,
    });
    sv.piece(ell(23.4, 23.4, 22, 22, { j: 0.5, n: 12 }), C.sable, C.lin, [1, 1.5]);
    const z = (v) => 24 + (v - 24) * k;
    const Z = (pts) => pts.map(([x, y, ...r]) => [z(x), z(y), ...r]);
    const ZN = (nodes) => mapNodes(nodes, (x, y) => [z(x), z(y)]);
    const ink = (pts, o = {}) => sv.line(Z(pts), C.chocolat, T, { j: 0, ...o });
    fn(sv, { Z, ZN, ink });
    return sv;
  };
};

/** Barre terre à 45° qui veut dire « sans » (longueur donnée à l'échelle finale). */
function barre(sv, len) {
  sv.piece(
    turn(rrect(24 - len / 2, 22.2, len, 3.6, 1.8, { j: 0.1 }), -45, 24, 24),
    C.terre,
    C.lin,
    [0.8, 1.2],
  );
}

icone(
  'donnees-chez-vous',
  'Vos données restent chez vous',
  'Une maison qui abrite une photo.',
  1.2,
  (sv, { ink }) => {
    // la photo des scènes : cadre crème, colline olive, soleil caramel
    photo(sv, 24, 29.6, 13, -6);
    ink(
      [
        [11, 23.5],
        [24, 12],
        [37, 23.5],
      ],
      { smooth: false },
    );
    ink(
      [
        [14.5, 21],
        [14.5, 36],
        [33.5, 36],
        [33.5, 21],
      ],
      { smooth: false },
    );
  },
);

icone(
  'zero-acces',
  'Zéro accès à vos données',
  'Une clé barrée : nous n’avons pas la clé de vos données.',
  1.28,
  (sv, { ink }) => {
    const bow = [];
    for (let i = 0; i <= 12; i++) {
      const t = (i / 12) * Math.PI * 2;
      bow.push([17.6 + 5.4 * Math.cos(t), 17.6 + 5.4 * Math.sin(t)]);
    }
    ink(bow, { smooth: true });
    ink(
      [
        [21.4, 21.4],
        [34.5, 34.5],
      ],
      { smooth: false },
    );
    ink(
      [
        [29.4, 29.4],
        [26.4, 32.4],
      ],
      { smooth: false },
    );
    ink(
      [
        [33, 33],
        [30.4, 35.6],
      ],
      { smooth: false },
    );
    barre(sv, 34);
  },
);

icone(
  'logiciels-libres',
  'Des logiciels libres',
  'Un engrenage posé dans une main ouverte.',
  1.2,
  (sv, { ZN, ink }) => {
    const g = [];
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      const r = i % 2 === 0 ? 8.6 : 6.6;
      g.push([24 + r * Math.cos(t), 18 + r * Math.sin(t)]);
    }
    sv.piece(ZN(soft(g, 0.8, { j: 0.1 })), C.olive, C.lin, [0.8, 1.2]);
    sv.piece(ZN(ell(24, 18, 2.6, 2.6, { j: 0.05, n: 7 })), C.sable);
    ink(
      [
        [11, 29],
        [15, 33],
        [22, 35],
        [31, 34],
        [37, 30],
      ],
      { smooth: true },
    );
    ink(
      [
        [11, 29],
        [14, 27.5],
        [18, 30],
        [23, 30.5],
      ],
      { smooth: true },
    );
  },
);

icone(
  'sans-abonnement',
  'Sans abonnement',
  'Une flèche qui tourne en boucle, barrée : vous payez une seule fois.',
  1.42,
  (sv, { ink }) => {
    const arc = [];
    for (let i = 0; i <= 12; i++) {
      const t = ((-40 + (i / 12) * 290) * Math.PI) / 180;
      arc.push([24 + 10 * Math.cos(t), 24 + 10 * Math.sin(t)]);
    }
    ink(arc, { smooth: true });
    const te = (250 * Math.PI) / 180;
    const tip = [24 + 10 * Math.cos(te) + 1.4, 24 + 10 * Math.sin(te) - 0.5];
    ink([[tip[0] - 3.4, tip[1] - 2.5], tip, [tip[0] - 2.4, tip[1] + 3.2]], { smooth: false });
    barre(sv, 36);
  },
);

icone(
  'humain-proche',
  'Un humain proche de chez vous',
  'Une personne et un repère de lieu : quelqu’un près de chez vous.',
  1.2,
  (sv, { ZN, ink }) => {
    ink(
      [
        [19.5, 18.2],
        [16.3, 17],
        [15, 13.6],
        [17, 10.4],
        [20.5, 10],
        [23.2, 12.5],
        [23.2, 16],
        [19.5, 18.2],
      ],
      { smooth: true },
    );
    ink(
      [
        [11.6, 34],
        [12.2, 27],
        [15.8, 22.8],
        [19.5, 22],
        [23.2, 22.8],
        [26.8, 27],
        [27.4, 34],
      ],
      { smooth: true },
    );
    sv.piece(
      ZN(
        cut(
          [
            [33, 35.4, 'vif'],
            [28.8, 29.4, true],
            [28.2, 26, true],
            [30.1, 22.8, true],
            [33, 21.6, true],
            [35.9, 22.8, true],
            [37.8, 26, true],
            [37.2, 29.4, true],
          ],
          { j: 0.1 },
        ),
      ),
      C.terre,
      C.lin,
      [0.8, 1.2],
    );
    sv.piece(ZN(ell(33, 26.2, 1.7, 1.7, { j: 0.05, n: 6 })), C.sable);
  },
);

icone(
  'sans-pistage',
  'Sans pistage',
  'Un œil barré : personne ne vous observe.',
  1.16,
  (sv, { ZN, ink }) => {
    ink(
      [
        [10, 24],
        [16, 18],
        [24, 16],
        [32, 18],
        [38, 24],
        [32, 30],
        [24, 32],
        [16, 30],
        [10, 24],
      ],
      { smooth: true },
    );
    sv.piece(ZN(ell(24, 24, 4.6, 4.6, { j: 0.1, n: 8 })), C.chocolat);
    barre(sv, 34);
  },
);

icone(
  'fait-main-provence',
  'Fait main, en Provence',
  'Une main ouverte, paume vers le haut, qui présente un brin d’olivier.',
  1,
  (sv, { ink }) => {
    // le brin d'olivier, posé dans la paume : tige puis feuilles alternées
    sv.line(
      [
        [17.4, 31.6],
        [22.4, 25.4],
        [27, 19],
        [31, 13],
      ],
      C.olive,
      1.6,
      { j: 0 },
    );
    for (const [cx, cy, a] of [
      [19.4, 24.4, -24],
      [27.4, 23.2, 76],
      [24.8, 15.6, -16],
      [33.4, 16.4, 72],
      [33.2, 9.4, 32],
    ])
      sv.piece(leaf(cx, cy, 8, 3.4, a), C.olive, C.lin, [0.6, 0.9]);
    // la main ouverte, paume vers le haut, vue de côté : le dos de la main
    // et les doigts tendus, puis le pouce replié au-dessus de la paume
    ink(
      [
        [8.2, 30.4],
        [12.8, 35],
        [21.4, 37.4],
        [31.6, 36.4],
        [37.6, 33.4],
        [40.4, 30.4],
      ],
      { smooth: true },
    );
    ink(
      [
        [8.2, 30.4],
        [11.8, 28.4],
        [16.4, 31.2],
        [22.4, 32],
      ],
      { smooth: true },
    );
  },
);

// Fiche d'essai des personnages (hors série)
DESSINS['_essai-personnages'] = () => {
  const sv = new Svg('_essai-personnages.svg', 800, 400, { title: 'essai', desc: 'essai' });
  sv.piece(rrect(20, 20, 760, 360, 30), C.sable, C.lin);
  personne(sv, {
    x: 100,
    y: 350,
    h: 230,
    peau: C.lin,
    cheveux: C.chocolat,
    coiffure: 'long',
    haut: C.olive,
    bas: C.noyer,
  });
  return sv;
};

const wanted = process.argv.slice(2);
for (const [name, build] of Object.entries(DESSINS)) {
  if (wanted.length > 0 && !wanted.includes(name)) continue;
  if (wanted.length === 0 && name.startsWith('_')) continue;
  const sv = build();
  // Les fiches d'essai (nom commençant par « _ ») ne vont jamais dans la série.
  const dir = name.startsWith('_') ? process.env.PAPIER_ESSAIS : OUT;
  if (dir) sv.write(dir);
}
