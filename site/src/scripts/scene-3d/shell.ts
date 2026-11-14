/**
 * Géométries du boîtier du modèle provisoire, d'après les images du
 * prototype : une coque aux angles verticaux très arrondis et à l'arête du
 * dessus adoucie, percée de vraies ouvertures (fentes, fenêtres des prises),
 * et des pièces droites (socle, pieds) taillées dans le même contour.
 *
 * Tout part d'un rectangle à coins arrondis vu de dessus, dans le plan
 * (x, z), parcouru côté par côté. Le même contour, plus ou moins rentré
 * (décalé vers l'intérieur d'une distance donnée), donne la paroi, l'arrondi
 * du dessus, le dessus, la face intérieure et le socle : leurs sommets se
 * raccordent exactement, sans fente entre deux morceaux.
 */
import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';

/** Côtés, dans l'ordre du parcours : 0 = avant (+z), 1 = gauche (−x), 2 = arrière (−z), 3 = droite (+x). */
export type Side = 0 | 1 | 2 | 3;

type Pair = readonly [number, number];
/** Normale extérieure de chaque côté, dans le plan (x, z). */
const NORMALS: readonly Pair[] = [
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 0],
];
/** Sens du parcours le long de chaque côté (c'est aussi la normale du côté suivant). */
const TANGENTS: readonly Pair[] = [
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
];
const QUARTER = Math.PI / 2;
/** Pas de découpage des côtés droits (m). */
const FLAT_STEP = 0.01;
/** Hauteur du fond intérieur de la coque au-dessus de son chant du bas (m). */
const FLOOR_LIFT = 0.0003;

function item<T>(list: readonly T[], index: number): T {
  const value = list[((index % list.length) + list.length) % list.length];
  if (value === undefined) throw new Error('Indice hors limites.');
  return value;
}

/** Rectangle à coins arrondis centré sur l'origine. */
export interface RoundedRect {
  readonly halfWidth: number;
  readonly halfDepth: number;
  readonly radius: number;
}

/** Point du contour : position, normale extérieure et rang dans le parcours (0 à 8). */
export interface RimPoint {
  readonly x: number;
  readonly z: number;
  readonly nx: number;
  readonly nz: number;
  readonly key: number;
}

function sideFrame(rect: RoundedRect, side: Side) {
  const normal = item(NORMALS, side);
  const tangent = item(TANGENTS, side);
  const half = side % 2 === 0 ? rect.halfDepth : rect.halfWidth;
  const flatHalf = (side % 2 === 0 ? rect.halfWidth : rect.halfDepth) - rect.radius;
  return { normal, tangent, half, flatHalf };
}

function makePoint(
  cx: number,
  cz: number,
  normal: Pair,
  tangent: Pair,
  cos: number,
  sin: number,
  radius: number,
  key: number,
): RimPoint {
  const nx = normal[0] * cos + tangent[0] * sin;
  const nz = normal[1] * cos + tangent[1] * sin;
  return { x: cx + radius * nx, z: cz + radius * nz, nx, nz, key: ((key % 8) + 8) % 8 };
}

/**
 * Point du contour rentré de `inset`, sur le côté `side`, à l'abscisse `u`
 * comptée depuis le milieu du côté dans le sens du parcours. Au-delà de la
 * partie droite, le point est sur l'arrondi voisin, à la même abscisse : une
 * coupe à u constant est donc plane.
 */
export function pointOnSide(rect: RoundedRect, inset: number, side: Side, u: number): RimPoint {
  const { normal, tangent, half, flatHalf } = sideFrame(rect, side);
  const radius = rect.radius - inset;
  if (Math.abs(u) <= flatHalf) {
    const fraction = flatHalf > 0 ? (u + flatHalf) / (2 * flatHalf) : 0.5;
    return {
      x: normal[0] * (half - inset) + tangent[0] * u,
      z: normal[1] * (half - inset) + tangent[1] * u,
      nx: normal[0],
      nz: normal[1],
      key: 2 * side + fraction,
    };
  }
  const sign = u > 0 ? 1 : -1;
  const reach = Math.abs(u) - flatHalf;
  if (reach > radius + 1e-9) throw new Error('Coupe au-delà de l’arrondi du coin.');
  const angle = Math.asin(Math.min(1, reach / radius));
  const cx = normal[0] * (half - rect.radius) + tangent[0] * sign * flatHalf;
  const cz = normal[1] * (half - rect.radius) + tangent[1] * sign * flatHalf;
  const key = sign > 0 ? 2 * side + 1 + angle / QUARTER : 2 * side - angle / QUARTER;
  return makePoint(cx, cz, normal, tangent, Math.cos(angle), sign * Math.sin(angle), radius, key);
}

/** Une coupe du contour : côté et abscisse (voir pointOnSide). */
export interface Cut {
  readonly side: Side;
  readonly u: number;
}

/**
 * Contour complet rentré de `inset` : `segments` segments par coin, plus les
 * points des coupes demandées, dans l'ordre du parcours.
 */
export function rim(
  rect: RoundedRect,
  inset: number,
  segments: number,
  cuts: readonly Cut[] = [],
): RimPoint[] {
  const points: RimPoint[] = [];
  const radius = rect.radius - inset;
  for (let side = 0 as Side; side < 4; side = (side + 1) as Side) {
    const { normal, tangent, half, flatHalf } = sideFrame(rect, side);
    // Coin qui suit le côté : de la normale du côté à celle du suivant.
    const cx = normal[0] * (half - rect.radius) + tangent[0] * flatHalf;
    const cz = normal[1] * (half - rect.radius) + tangent[1] * flatHalf;
    for (let k = 0; k <= segments; k += 1) {
      const angle = (k / segments) * QUARTER;
      const key = 2 * side + 1 + k / segments;
      points.push(
        makePoint(cx, cz, normal, tangent, Math.cos(angle), Math.sin(angle), radius, key),
      );
    }
  }
  // Côtés droits découpés tous les centimètres environ : des triangles trop
  // longs et trop fins laissent passer des points isolés au rendu.
  for (let side = 0 as Side; side < 4; side = (side + 1) as Side) {
    const { flatHalf } = sideFrame(rect, side);
    const count = Math.ceil((2 * flatHalf) / FLAT_STEP);
    for (let k = 1; k < count; k += 1) {
      points.push(pointOnSide(rect, inset, side, -flatHalf + (2 * flatHalf * k) / count));
    }
  }
  for (const cut of cuts) points.push(pointOnSide(rect, inset, cut.side, cut.u));
  points.sort((a, b) => a.key - b.key);
  return points.filter(
    (point, index) =>
      index === 0 ||
      Math.hypot(point.x - item(points, index - 1).x, point.z - item(points, index - 1).z) > 1e-7,
  );
}

/** Rectangle à coins arrondis rentré de `inset` (mêmes centres d'arrondi). */
export function insetRect(rect: RoundedRect, inset: number): RoundedRect {
  return {
    halfWidth: rect.halfWidth - inset,
    halfDepth: rect.halfDepth - inset,
    radius: rect.radius - inset,
  };
}

// ---------------------------------------------------------------------------
// Assemblage de triangles

type Vec3 = readonly [number, number, number];

/** Accumule des triangles (sommets non partagés) et leurs normales. */
export class MeshBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly uvs: number[] = [];

  /** Triangle ; l'ordre des sommets est corrigé pour que la face regarde du côté des normales. */
  triangle(
    a: Vec3,
    b: Vec3,
    c: Vec3,
    na: Vec3,
    nb: Vec3,
    nc: Vec3,
    uv?: readonly [Pair, Pair, Pair],
  ): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const fx = uy * vz - uz * vy;
    const fy = uz * vx - ux * vz;
    const fz = ux * vy - uy * vx;
    const facing =
      fx * (na[0] + nb[0] + nc[0]) + fy * (na[1] + nb[1] + nc[1]) + fz * (na[2] + nb[2] + nc[2]);
    const order: Array<[Vec3, Vec3, Pair | undefined]> =
      facing >= 0
        ? [
            [a, na, uv?.[0]],
            [b, nb, uv?.[1]],
            [c, nc, uv?.[2]],
          ]
        : [
            [a, na, uv?.[0]],
            [c, nc, uv?.[2]],
            [b, nb, uv?.[1]],
          ];
    for (const [position, normal, texcoord] of order) {
      this.positions.push(position[0], position[1], position[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      if (uv) this.uvs.push(texcoord?.[0] ?? 0, texcoord?.[1] ?? 0);
    }
  }

  /** Quadrilatère a-b-c-d (dans l'ordre du tour). */
  quad(
    a: Vec3,
    b: Vec3,
    c: Vec3,
    d: Vec3,
    na: Vec3,
    nb: Vec3,
    nc: Vec3,
    nd: Vec3,
    uv?: readonly [Pair, Pair, Pair, Pair],
  ): void {
    this.triangle(a, b, c, na, nb, nc, uv && [uv[0], uv[1], uv[2]]);
    this.triangle(a, c, d, na, nc, nd, uv && [uv[0], uv[2], uv[3]]);
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3));
    if (this.uvs.length > 0) geometry.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));
    return geometry;
  }
}

const UP: Vec3 = [0, 1, 0];
const DOWN: Vec3 = [0, -1, 0];
const at = (point: RimPoint, y: number): Vec3 => [point.x, y, point.z];
const horizontal = (point: RimPoint, sign = 1): Vec3 => [sign * point.nx, 0, sign * point.nz];

/** Bande verticale le long d'un contour, de y0 à y1 ; `skip` écarte des segments. */
function wall(
  builder: MeshBuilder,
  points: readonly RimPoint[],
  y0: number,
  y1: number,
  sign: number,
  skip: (a: RimPoint, b: RimPoint) => boolean = () => false,
): void {
  for (let i = 0; i < points.length; i += 1) {
    const a = item(points, i);
    const b = item(points, i + 1);
    if (skip(a, b)) continue;
    builder.quad(
      at(a, y0),
      at(b, y0),
      at(b, y1),
      at(a, y1),
      horizontal(a, sign),
      horizontal(b, sign),
      horizontal(b, sign),
      horizontal(a, sign),
    );
  }
}

/** Face horizontale convexe (éventail depuis le centre). */
function cap(builder: MeshBuilder, points: readonly RimPoint[], y: number, normal: Vec3): void {
  const centre: Vec3 = [0, y, 0];
  for (let i = 0; i < points.length; i += 1) {
    builder.triangle(
      centre,
      at(item(points, i), y),
      at(item(points, i + 1), y),
      normal,
      normal,
      normal,
    );
  }
}

/** Triangles horizontaux (indices dans `points`, comme ceux de ShapeUtils.triangulateShape). */
function flatFaces(
  builder: MeshBuilder,
  points: readonly RimPoint[],
  faces: readonly number[][],
  y: number,
  normal: Vec3,
): void {
  for (const face of faces) {
    const [a = 0, b = 0, c = 0] = face;
    builder.triangle(
      at(item(points, a), y),
      at(item(points, b), y),
      at(item(points, c), y),
      normal,
      normal,
      normal,
    );
  }
}

/** Décale chaque point du contour vers l'intérieur. */
function shrink(points: readonly RimPoint[], amount: number): RimPoint[] {
  return points.map((point) => ({
    ...point,
    x: point.x - amount * point.nx,
    z: point.z - amount * point.nz,
  }));
}

// ---------------------------------------------------------------------------
// Coque

/** Ouverture rectangulaire, coupée perpendiculairement à un côté. */
export interface ShellOpening {
  readonly side: Side;
  /** Abscisses le long du côté (voir pointOnSide), de la plus petite à la plus grande. */
  readonly u: Pair;
  /** Hauteurs depuis le bas de la coque. */
  readonly v: Pair;
}

export interface ShellOptions {
  readonly rect: RoundedRect;
  readonly height: number;
  /** Rayon de l'arrondi de l'arête du dessus. */
  readonly fillet: number;
  readonly wall: number;
  readonly openings: readonly ShellOpening[];
  readonly cornerSegments?: number;
  readonly filletSegments?: number;
}

/**
 * Coque ouverte en dessous : extérieur (paroi, arrondi, dessus, tranches des
 * ouvertures, chant du bas) et intérieur (rendu à part, dans l'ombre, fermé
 * par un fond visible seulement par les ouvertures).
 */
export function buildShell(options: ShellOptions): {
  outside: BufferGeometry;
  inside: BufferGeometry;
} {
  const { rect, height, wall: thickness } = options;
  const fillet = Math.max(options.fillet, thickness + 1e-4);
  const top = height - fillet;
  // Chaque ouverture reste dans sa face : sous l'arrondi du dessus, et pas
  // au-delà de l'arrondi des angles de la face intérieure.
  const openings = options.openings.map((opening) => {
    const { flatHalf } = sideFrame(rect, opening.side);
    const reach = flatHalf + 0.9 * (rect.radius - thickness);
    const clampU = (u: number) => Math.max(-reach, Math.min(reach, u));
    return {
      ...opening,
      u: [clampU(opening.u[0]), clampU(opening.u[1])] as const,
      v: [Math.max(0, opening.v[0]), Math.min(top - 1e-4, opening.v[1])] as const,
    };
  });
  const cornerSegments = options.cornerSegments ?? 10;
  const filletSegments = options.filletSegments ?? 6;
  const cuts = openings.flatMap((opening) => [
    { side: opening.side, u: opening.u[0] },
    { side: opening.side, u: opening.u[1] },
  ]);
  const outer = rim(rect, 0, cornerSegments, cuts);
  const inner = rim(rect, thickness, cornerSegments, cuts);
  const outside = new MeshBuilder();
  const inside = new MeshBuilder();

  // Tranches horizontales délimitées par le haut et le bas des ouvertures.
  const levels = [...new Set([0, top, ...openings.flatMap((opening) => [...opening.v])])]
    .filter((level) => level >= 0 && level <= top)
    .sort((a, b) => a - b);
  const keyRange = (opening: ShellOpening, inset: number): Pair => [
    pointOnSide(rect, inset, opening.side, opening.u[0]).key,
    pointOnSide(rect, inset, opening.side, opening.u[1]).key,
  ];

  for (let i = 0; i < levels.length - 1; i += 1) {
    const y0 = item(levels, i);
    const y1 = item(levels, i + 1);
    const active = openings.filter(
      (opening) => opening.v[0] <= y0 + 1e-9 && opening.v[1] >= y1 - 1e-9,
    );
    const inOpening = (inset: number) => {
      const ranges = active.map((opening) => keyRange(opening, inset));
      return (a: RimPoint, b: RimPoint) =>
        b.key > a.key && ranges.some(([k0, k1]) => a.key >= k0 - 1e-9 && b.key <= k1 + 1e-9);
    };
    wall(outside, outer, y0, y1, 1, inOpening(0));
    wall(inside, inner, y0, y1, -1, inOpening(thickness));
    // Tranches verticales des ouvertures (perpendiculaires au côté).
    for (const opening of active) {
      opening.u.forEach((u, index) => {
        const tangent = item(TANGENTS, opening.side);
        const sign = index === 0 ? 1 : -1;
        const normal: Vec3 = [sign * tangent[0], 0, sign * tangent[1]];
        const a = pointOnSide(rect, 0, opening.side, u);
        const b = pointOnSide(rect, thickness, opening.side, u);
        outside.quad(at(a, y0), at(b, y0), at(b, y1), at(a, y1), normal, normal, normal, normal);
      });
    }
  }

  // Appuis et linteaux des ouvertures : la paroi vue en coupe, entre l'extérieur et l'intérieur.
  for (const opening of openings) {
    const [o0, o1] = keyRange(opening, 0);
    const [i0, i1] = keyRange(opening, thickness);
    const outerPart = outer.filter((point) => point.key >= o0 - 1e-9 && point.key <= o1 + 1e-9);
    const innerPart = inner
      .filter((point) => point.key >= i0 - 1e-9 && point.key <= i1 + 1e-9)
      .reverse();
    const outline = [...outerPart, ...innerPart];
    const contour = outline.map((point) => new Vector2(point.x, point.z));
    const faces = ShapeUtils.triangulateShape(contour, []);
    for (const [y, normal] of [
      [opening.v[0], UP],
      [opening.v[1], DOWN],
    ] as const) {
      if (y > 0) flatFaces(outside, outline, faces, y, normal);
    }
  }

  // Arrondi de l'arête du dessus, puis le dessus ; même chose à l'intérieur.
  const ring = (points: readonly RimPoint[], radius: number, base: number, angle: number) =>
    shrink(points, radius * (1 - Math.cos(angle))).map((point) => ({
      point,
      y: base + radius * Math.sin(angle),
      normal: [point.nx * Math.cos(angle), Math.sin(angle), point.nz * Math.cos(angle)] as Vec3,
    }));
  const sweep = (
    builder: MeshBuilder,
    points: readonly RimPoint[],
    radius: number,
    sign: number,
  ) => {
    let previous = ring(points, radius, top, 0);
    for (let k = 1; k <= filletSegments; k += 1) {
      const next = ring(points, radius, top, (k / filletSegments) * QUARTER);
      for (let i = 0; i < points.length; i += 1) {
        const a = item(previous, i);
        const b = item(previous, i + 1);
        const c = item(next, i + 1);
        const d = item(next, i);
        const flip = (normal: Vec3): Vec3 => [sign * normal[0], sign * normal[1], sign * normal[2]];
        builder.quad(
          at(a.point, a.y),
          at(b.point, b.y),
          at(c.point, c.y),
          at(d.point, d.y),
          flip(a.normal),
          flip(b.normal),
          flip(c.normal),
          flip(d.normal),
        );
      }
      previous = next;
    }
    return previous;
  };
  const outerTop = sweep(outside, outer, fillet, 1);
  cap(
    outside,
    outerTop.map((entry) => entry.point),
    height,
    UP,
  );
  const innerTop = sweep(inside, inner, fillet - thickness, -1);
  cap(
    inside,
    innerTop.map((entry) => entry.point),
    height - thickness,
    DOWN,
  );
  // Fond sombre, tourné vers le haut, juste au-dessus du chant du bas : coque
  // soulevée, ses fenêtres montrent l'intérieur dans l'ombre, et non la page
  // à travers le dessous ouvert. On ne le voit que par les ouvertures.
  const floorFaces = ShapeUtils.triangulateShape(
    inner.map((point) => new Vector2(point.x, point.z)),
    [],
  );
  flatFaces(inside, inner, floorFaces, Math.min(FLOOR_LIFT, top / 2), UP);

  // Chant du bas : l'anneau entre l'extérieur et l'intérieur.
  const outerContour = outer.map((point) => new Vector2(point.x, point.z));
  const innerContour = inner.map((point) => new Vector2(point.x, point.z));
  const ringFaces = ShapeUtils.triangulateShape(outerContour, [innerContour]);
  flatFaces(outside, [...outer, ...inner], ringFaces, 0, DOWN);

  return { outside: outside.build(), inside: inside.build() };
}

// ---------------------------------------------------------------------------
// Pièces droites (socle, pieds)

/** Coordonnées de texture d'une paroi : longueur parcourue et hauteur, en mètres. */
function wallWithUv(
  builder: MeshBuilder,
  points: readonly RimPoint[],
  y0: number,
  y1: number,
  closed: boolean,
  startLength = 0,
): number {
  let length = startLength;
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i += 1) {
    const a = item(points, i);
    const b = item(points, i + 1);
    const next = length + Math.hypot(b.x - a.x, b.z - a.z);
    builder.quad(
      at(a, y0),
      at(b, y0),
      at(b, y1),
      at(a, y1),
      horizontal(a),
      horizontal(b),
      horizontal(b),
      horizontal(a),
      [
        [length, y0],
        [next, y0],
        [next, y1],
        [length, y1],
      ],
    );
    length = next;
  }
  return length;
}

/** Dalle droite au contour arrondi, de y0 à y1, avec son dessus (coordonnées de texture en mètres). */
export function buildSlab(
  rect: RoundedRect,
  y0: number,
  y1: number,
  segments = 10,
): BufferGeometry {
  const builder = new MeshBuilder();
  const points = rim(rect, 0, segments);
  wallWithUv(builder, points, y0, y1, true);
  const centre: Vec3 = [0, y1, 0];
  for (let i = 0; i < points.length; i += 1) {
    const a = item(points, i);
    const b = item(points, i + 1);
    builder.triangle(centre, at(a, y1), at(b, y1), UP, UP, UP, [
      [0, 0],
      [a.x, a.z],
      [b.x, b.z],
    ]);
  }
  return builder.build();
}

/**
 * Pied d'angle : le coin arrondi du contour prolongé vers le bas, coupé
 * droit à `alongX` et `alongZ` du bord (coin +x +z ; les autres par symétrie).
 */
export function buildCornerFoot(
  rect: RoundedRect,
  alongX: number,
  alongZ: number,
  y0: number,
  y1: number,
  segments = 10,
): BufferGeometry {
  const builder = new MeshBuilder();
  const { halfWidth: a, halfDepth: b, radius: r } = rect;
  const cutX = a - alongX;
  const cutZ = b - alongZ;
  const arc: RimPoint[] = [{ x: a, z: cutZ, nx: 1, nz: 0, key: 0 }];
  for (let k = 0; k <= segments; k += 1) {
    const angle = (k / segments) * QUARTER;
    arc.push({
      x: a - r + r * Math.cos(angle),
      z: b - r + r * Math.sin(angle),
      nx: Math.cos(angle),
      nz: Math.sin(angle),
      key: 0,
    });
  }
  arc.push({ x: cutX, z: b, nx: 0, nz: 1, key: 0 });
  const length = wallWithUv(builder, arc, y0, y1, false);
  // Faces de coupe, tournées vers l'intérieur du socle.
  const corner = { x: cutX, z: cutZ };
  wallWithUv(
    builder,
    [
      { x: cutX, z: b, nx: -1, nz: 0, key: 0 },
      { ...corner, nx: -1, nz: 0, key: 0 },
    ],
    y0,
    y1,
    false,
    length,
  );
  wallWithUv(
    builder,
    [
      { ...corner, nx: 0, nz: -1, key: 0 },
      { x: a, z: cutZ, nx: 0, nz: -1, key: 0 },
    ],
    y0,
    y1,
    false,
    length + alongZ,
  );
  return builder.build();
}
