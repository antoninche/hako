#!/usr/bin/env node
/**
 * Contours des deux marquages du modèle 3D provisoire, calculés une fois pour
 * toutes à partir des fichiers officiels du logo :
 *   src/assets/brand/hako-kanji.svg → src/scripts/scene-3d/kanji-outline.json
 *     (le kanji 箱, en relief sur le dessus de la coque) ;
 *   src/assets/brand/hako-mot.svg   → src/scripts/scene-3d/mot-outline.json
 *     (le mot HAKO, sur la grande face avant de la coque).
 *
 * Le navigateur n'a donc ni fichier SVG à télécharger ni lecteur SVG à
 * embarquer : chaque JSON contient directement les contours, déjà aplatis en
 * lignes brisées (courbes de Bézier et arcs découpés en segments, puis
 * simplifiés sans écart visible). Le mot HAKO n'est jamais écrit avec une
 * police : ses contours sont ceux du logo.
 *
 * Format de chaque JSON :
 *   width, height  dimensions du dessin dans le SVG (viewBox) ;
 *   unit           nombre d'unités entières pour la largeur du dessin ;
 *   shapes         liste de formes ; chaque forme est une liste de contours,
 *                  le premier extérieur, les suivants des trous ; chaque
 *                  contour est une suite plate [x0, y0, x1, y1, …] d'entiers,
 *                  centrée sur le dessin, y vers le haut (haut du dessin).
 *
 * Le résultat ne dépend que des SVG : deux exécutions donnent les mêmes
 * fichiers, octet pour octet.
 *
 * Utilisation (à relancer seulement si le logo change), depuis la racine du
 * site :
 *   node scripts/model/logo-outline.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Marquages à calculer : dessin source et fichier écrit. */
const MARKS = [
  { source: 'src/assets/brand/hako-kanji.svg', output: 'src/scripts/scene-3d/kanji-outline.json' },
  { source: 'src/assets/brand/hako-mot.svg', output: 'src/scripts/scene-3d/mot-outline.json' },
];
/** Largeur du dessin en unités entières (précision : 1/2000 de la largeur). */
const UNIT = 2000;
/** Écart maximal toléré entre le contour simplifié et le dessin, en unités du SVG. */
const TOLERANCE = 0.35;
/** Longueur visée d'un segment de courbe avant simplification, en unités du SVG. */
const STEP = 2;

// ---------------------------------------------------------------------------
// Lecture du chemin SVG

function readSvg(file) {
  const svg = readFileSync(path.join(root, file), 'utf8');
  const viewBox = /viewBox="([^"]+)"/
    .exec(svg)?.[1]
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((match) => match[1]);
  if (!viewBox || viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value))) {
    throw new Error(`${file} : viewBox illisible.`);
  }
  if (paths.length !== 1) throw new Error(`${file} : un seul <path> attendu (${paths.length}).`);
  if (/fill-rule="evenodd"/.test(svg)) throw new Error(`${file} : règle evenodd non prévue.`);
  return { viewBox, d: paths[0] };
}

function tokenize(d) {
  const tokens = [];
  const pattern = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  for (const match of d.matchAll(pattern)) {
    tokens.push(match[1] ? { command: match[1] } : { number: Number(match[2]) });
  }
  return tokens;
}

/** Arc SVG (notation des extrémités) vers une suite de points (notes d'implémentation SVG, F.6.5). */
function arcPoints(x1, y1, rx, ry, angle, largeArc, sweep, x2, y2) {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [[x2, y2]];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (angle * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let factor = Math.sqrt(Math.max(0, numerator / denominator));
  if (largeArc === sweep) factor = -factor;
  const cxp = (factor * rx * y1p) / ry;
  const cyp = (-factor * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const vectorAngle = (ux, uy, vx, vy) => {
    const value = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return value;
  };
  const theta1 = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = vectorAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  if (sweep && delta < 0) delta += Math.PI * 2;
  const segments = Math.max(2, Math.ceil((Math.abs(delta) * Math.max(rx, ry)) / STEP));
  const points = [];
  for (let i = 1; i <= segments; i += 1) {
    const t = theta1 + (delta * i) / segments;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    points.push([cos * ex - sin * ey + cx, sin * ex + cos * ey + cy]);
  }
  points[points.length - 1] = [x2, y2];
  return points;
}

function cubicPoints(p0, p1, p2, p3) {
  const length =
    Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) +
    Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) +
    Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
  const segments = Math.max(2, Math.ceil(length / STEP));
  const points = [];
  for (let i = 1; i <= segments; i += 1) {
    const t = i / segments;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const e = t * t * t;
    points.push([
      a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1],
    ]);
  }
  return points;
}

/** Découpe le chemin en contours fermés (listes de points). */
function flatten(d) {
  const tokens = tokenize(d);
  const contours = [];
  let contour = null;
  let index = 0;
  let command = '';
  let current = [0, 0];
  let start = [0, 0];
  let lastControl = null;
  let lastQuad = null;

  const number = () => {
    const token = tokens[index];
    if (!token || token.number === undefined) throw new Error(`Nombre attendu (jeton ${index}).`);
    index += 1;
    return token.number;
  };
  const close = () => {
    if (contour && contour.length > 2) contours.push(contour);
    contour = null;
  };
  const lineTo = (point) => {
    contour.push(point);
    current = point;
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (token.command) {
      command = token.command;
      index += 1;
      if (command === 'Z' || command === 'z') {
        current = start;
        close();
        lastControl = null;
        lastQuad = null;
        continue;
      }
    } else if (!command) {
      throw new Error('Le chemin doit commencer par une commande.');
    }
    const relative = command === command.toLowerCase();
    const base = relative ? current : [0, 0];
    switch (command.toUpperCase()) {
      case 'M': {
        close();
        const point = [base[0] + number(), base[1] + number()];
        contour = [point];
        current = point;
        start = point;
        // Paires suivantes : lignes implicites.
        command = relative ? 'l' : 'L';
        lastControl = null;
        lastQuad = null;
        break;
      }
      case 'L':
        lineTo([base[0] + number(), base[1] + number()]);
        lastControl = null;
        lastQuad = null;
        break;
      case 'H':
        lineTo([(relative ? current[0] : 0) + number(), current[1]]);
        lastControl = null;
        lastQuad = null;
        break;
      case 'V':
        lineTo([current[0], (relative ? current[1] : 0) + number()]);
        lastControl = null;
        lastQuad = null;
        break;
      case 'C': {
        const p1 = [base[0] + number(), base[1] + number()];
        const p2 = [base[0] + number(), base[1] + number()];
        const p3 = [base[0] + number(), base[1] + number()];
        for (const point of cubicPoints(current, p1, p2, p3)) contour.push(point);
        current = p3;
        lastControl = p2;
        lastQuad = null;
        break;
      }
      case 'S': {
        const p1 = lastControl
          ? [2 * current[0] - lastControl[0], 2 * current[1] - lastControl[1]]
          : current;
        const p2 = [base[0] + number(), base[1] + number()];
        const p3 = [base[0] + number(), base[1] + number()];
        for (const point of cubicPoints(current, p1, p2, p3)) contour.push(point);
        current = p3;
        lastControl = p2;
        lastQuad = null;
        break;
      }
      case 'Q':
      case 'T': {
        const q1 =
          command.toUpperCase() === 'Q'
            ? [base[0] + number(), base[1] + number()]
            : lastQuad
              ? [2 * current[0] - lastQuad[0], 2 * current[1] - lastQuad[1]]
              : current;
        const p3 = [base[0] + number(), base[1] + number()];
        // Quadratique exprimée en cubique.
        const p1 = [
          current[0] + (2 / 3) * (q1[0] - current[0]),
          current[1] + (2 / 3) * (q1[1] - current[1]),
        ];
        const p2 = [p3[0] + (2 / 3) * (q1[0] - p3[0]), p3[1] + (2 / 3) * (q1[1] - p3[1])];
        for (const point of cubicPoints(current, p1, p2, p3)) contour.push(point);
        current = p3;
        lastQuad = q1;
        lastControl = null;
        break;
      }
      case 'A': {
        const rx = number();
        const ry = number();
        const angle = number();
        const largeArc = number() !== 0;
        const sweep = number() !== 0;
        const end = [base[0] + number(), base[1] + number()];
        for (const point of arcPoints(
          current[0],
          current[1],
          rx,
          ry,
          angle,
          largeArc,
          sweep,
          end[0],
          end[1],
        )) {
          contour.push(point);
        }
        current = end;
        lastControl = null;
        lastQuad = null;
        break;
      }
      default:
        throw new Error(`Commande SVG non prévue : ${command}`);
    }
  }
  close();
  return contours;
}

// ---------------------------------------------------------------------------
// Géométrie des contours

function signedArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function contains(polygon, [x, y]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Retire les points en double et le point final égal au premier. */
function dedupe(points) {
  const result = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 1e-6) {
      result.push(point);
    }
  }
  const first = result[0];
  const last = result[result.length - 1];
  if (result.length > 1 && Math.hypot(first[0] - last[0], first[1] - last[1]) <= 1e-6) result.pop();
  return result;
}

function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Simplification de Douglas-Peucker d'un contour fermé. */
function simplify(points, tolerance) {
  const reduce = (list) => {
    if (list.length < 3) return list;
    let worst = 0;
    let at = 0;
    for (let i = 1; i < list.length - 1; i += 1) {
      const distance = distanceToSegment(list[i], list[0], list[list.length - 1]);
      if (distance > worst) {
        worst = distance;
        at = i;
      }
    }
    if (worst <= tolerance) return [list[0], list[list.length - 1]];
    const left = reduce(list.slice(0, at + 1));
    const right = reduce(list.slice(at));
    return [...left.slice(0, -1), ...right];
  };
  // Contour fermé : on le coupe au point le plus éloigné du premier.
  let far = 0;
  let farthest = 0;
  for (let i = 1; i < points.length; i += 1) {
    const distance = Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]);
    if (distance > farthest) {
      farthest = distance;
      far = i;
    }
  }
  const first = reduce(points.slice(0, far + 1));
  const second = reduce([...points.slice(far), points[0]]);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

// ---------------------------------------------------------------------------

/** Contours d'un dessin SVG, au format décrit en tête de fichier. */
function outline(source) {
  const { viewBox, d } = readSvg(source);
  const [minX, minY, width, height] = viewBox;
  const contours = flatten(d)
    .map(dedupe)
    .filter((points) => points.length >= 3 && Math.abs(signedArea(points)) > 1);

  // Profondeur d'imbrication : paire = contour extérieur, impaire = trou.
  const depth = contours.map((points, i) =>
    contours.reduce(
      (count, other, j) => count + (j !== i && contains(other, points[0]) ? 1 : 0),
      0,
    ),
  );
  const shapes = [];
  contours.forEach((points, i) => {
    if (depth[i] % 2 === 0) shapes.push({ outer: i, holes: [] });
  });
  contours.forEach((points, i) => {
    if (depth[i] % 2 === 0) return;
    // Trou : rattaché au contour extérieur le plus proche qui le contient.
    const parent = shapes
      .filter((shape) => contains(contours[shape.outer], points[0]))
      .sort(
        (a, b) => Math.abs(signedArea(contours[a.outer])) - Math.abs(signedArea(contours[b.outer])),
      )[0];
    if (!parent) throw new Error(`${source} : trou sans contour extérieur.`);
    parent.holes.push(i);
  });

  const scale = UNIT / width;
  const encode = (points) =>
    simplify(points, TOLERANCE).flatMap(([x, y]) => [
      Math.round((x - minX - width / 2) * scale),
      // y du SVG vers le bas ; ici vers le haut du dessin.
      Math.round((minY + height / 2 - y) * scale),
    ]);

  return {
    _notice: `Généré par scripts/model/logo-outline.mjs depuis ${source} : ne pas modifier à la main.`,
    width,
    height,
    unit: UNIT,
    shapes: shapes.map((shape) => [shape.outer, ...shape.holes].map((i) => encode(contours[i]))),
  };
}

for (const { source, output } of MARKS) {
  const data = outline(source);
  const config = (await prettier.resolveConfig(path.join(root, output))) ?? {};
  const text = await prettier.format(JSON.stringify(data), { ...config, parser: 'json' });
  writeFileSync(path.join(root, output), text);
  const points = data.shapes.flat().reduce((sum, contour) => sum + contour.length / 2, 0);
  console.log(
    `${output} : ${data.shapes.length} formes, ${data.shapes.flat().length} contours, ${points} points, ${text.length} octets.`,
  );
}
