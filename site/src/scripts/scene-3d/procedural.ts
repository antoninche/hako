/**
 * Modèle provisoire de la box, dessiné en code d'après les images du
 * prototype de l'équipe (images de son modèle 3D), en attendant le fichier
 * Blender (public/models/hako.glb). Il porte exactement les noms
 * d'objets du contrat (contract.ts) : la scène l'anime comme le modèle réel.
 *
 * Unités : mètres, y vers le haut, origine au centre du dessous de la box.
 * Avant (+z) : la grande face lisse ; droite (+x) : le bouton et le voyant ;
 * arrière (−z) : les fentes d'aération et trois petites fenêtres ;
 * gauche (−x) : les trois grandes fenêtres des prises. Le haut du kanji 箱
 * est tourné vers l'arrière, comme sur les images.
 *
 * Pièces :
 * - Case_Lid : la coque blanc perlé (RAL 1013), qui recouvre tout et se
 *   soulève ; elle porte les marquages chocolat (Logo_Decal) : le kanji 箱
 *   en relief au centre du dessus et le mot HAKO sur la grande face avant ;
 * - Case_Base : le socle en bois imprimé couleur noyer et ses quatre pieds
 *   d'angle ;
 * - RPi5_Board, NVMe_Board et NVMe_SSD (carte M.2 sous le Raspberry Pi, comme
 *   sur l'image de l'intérieur), Fan et Fan_Rotor.
 *
 * Les proportions du boîtier viennent des images ; ses cotes réelles restent
 * à confirmer (model.config.json, procedural.case). Seule la carte
 * Raspberry Pi 5 a ses cotes officielles (85 × 56 mm, trous de fixation à
 * 3,5 mm des bords, entraxe 58 × 49 mm) ; ses prises sont dessinées en blocs
 * gris, plus grands que nature, comme sur le prototype. Le reste est
 * PROVISOIRE : carte M.2 (ici à l'empreinte du Raspberry Pi), SSD M.2 2230,
 * ventilateur de 40 mm.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Path,
  RingGeometry,
  Shape,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ModelConfig } from './config';
// Imports nommés : seules les clés utilisées de chaque JSON entrent dans le code publié.
import { shapes as kanjiShapes, unit as kanjiUnit } from './kanji-outline.json';
import {
  height as wordmarkDrawingHeight,
  shapes as wordmarkShapes,
  unit as wordmarkUnit,
  width as wordmarkDrawingWidth,
} from './mot-outline.json';
import {
  buildCornerFoot,
  buildShell,
  buildSlab,
  insetRect,
  type RoundedRect,
  type ShellOpening,
} from './shell';
import { createWoodGrainTexture } from './textures';

const mm = (value: number) => value / 1000;

/**
 * Relevés sur les images du prototype (proportions) et choix du dessin.
 * Les cotes principales de la coque sont dans model.config.json.
 */
const PROTOTYPE = {
  /** Rayon de l'arrondi de l'arête du dessus de la coque. */
  topFillet: mm(5.5),
  /** Socle : retrait sous la coque, épaisseur de la dalle, pieds d'angle. */
  plinthInset: mm(1.2),
  plinthThickness: mm(3.6),
  feetHeight: mm(2.6),
  feetAlongX: mm(17),
  feetAlongZ: mm(12),
  /** Relief du kanji au-dessus du couvercle. */
  kanjiRaise: mm(1),
  /**
   * Relief du mot HAKO sur la face avant : une fraction de millimètre, assez
   * pour ne jamais se confondre avec la paroi à l'affichage (aucun
   * scintillement), trop peu pour épaissir les lettres vues de biais.
   */
  wordmarkRaise: mm(0.3),
  /** Partie des marquages enfoncée dans la coque : aucun jour sur le bord. */
  markSink: mm(0.1),
  /** Écart minimal entre le mot HAKO et les arrondis de sa face. */
  wordmarkMargin: mm(3),
} as const;

type Rgb = readonly [number, number, number];

/**
 * Couleurs du prototype, telles qu'elles doivent apparaître à l'écran.
 *
 * L'éclairage de la scène est doux et son rendu des tons (AgX) comprime les
 * clairs et éclaircit les foncés : une coque blanche y paraît grise
 * (#DEDAD6) et le chocolat devient taupe. Les matières du prototype
 * échappent donc au rendu des tons (toneMapped: false) et leur couleur est
 * calculée à partir de la couleur voulue à l'écran et de la lumière que
 * reçoit la face qui la porte (LIGHT).
 */
const SCREEN = {
  /** Marquages, kanji et mot HAKO (chocolat de la marque). */
  mark: '#412d1e',
  /** Face éclairée du socle (noyer), au début de la piste. */
  wood: '#5f3e27',
  /** Dessus des cartes (vert du prototype). */
  pcb: '#4e875f',
  /** Dessus des blocs des prises (gris clair du prototype). */
  port: '#c9cbcf',
  /** Intérieur de la coque, vu par les ouvertures (dans l'ombre). */
  inside: '#6c665f',
} as const;

/**
 * Lumière reçue par une face mate selon son orientation (couleur affichée
 * divisée par la couleur de la matière, en valeurs linéaires), mesurée dans
 * la scène de scene.ts : dessus, et face verticale éclairée par la lumière
 * principale (une face à l'ombre reçoit environ 0,8). À mesurer de nouveau si
 * les lumières de scene.ts changent (voir docs/model-contract.md).
 */
const LIGHT = {
  top: [1.91, 1.776, 1.646],
  lit: [1.776, 1.662, 1.552],
} as const satisfies Record<string, Rgb>;

/**
 * Coque (matière satinée, avec reflets) : la couleur de procedural.case.color
 * se partage entre la teinte éclairée (SHELL_ALBEDO) et une lueur propre
 * (SHELL_GLOW), qui tient lieu de lumière d'ambiance et garde des ombres
 * douces. Avec le RAL 1013 (blanc perlé, #E3D9C6), les faces éclairées
 * s'affichent entre #DCCFB9 et #E4D6BF et les faces à l'ombre autour de
 * #B6AD9D, comme sur le rendu RAL 1013 de l'équipe (v2_teintes.png).
 */
const SHELL_ALBEDO = 0.345;
const SHELL_GLOW = 0.325;

/** Couleur de matière qui donne `hex` à l'écran sur une face qui reçoit `light`. */
function albedoFor(hex: string, light: Rgb): Rgb {
  const target = new Color(hex);
  return [target.r / light[0], target.g / light[1], target.b / light[2]];
}

/** Matière mate (sans reflet), hors rendu des tons. */
function matte(albedo: Rgb, map?: Texture): MeshLambertMaterial {
  const material = new MeshLambertMaterial({ toneMapped: false });
  material.color.setRGB(albedo[0], albedo[1], albedo[2]);
  if (map) material.map = map;
  return material;
}

function roundedRect(target: Path, cx: number, cy: number, w: number, h: number, r: number) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  target.moveTo(x + r, y);
  target.lineTo(x + w - r, y);
  target.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  target.lineTo(x + w, y + h - r);
  target.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  target.lineTo(x + r, y + h);
  target.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  target.lineTo(x, y + r);
  target.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return target;
}

function circle(cx: number, cy: number, r: number): Path {
  const path = new Path();
  path.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return path;
}

/**
 * Extrusion verticale d'un profil 2D : le profil (x, y) devient (x, -z),
 * l'épaisseur va de y = 0 à y = height. Le chanfrein arrondi ne déborde pas
 * du profil.
 */
function extrudeUp(shape: Shape, height: number, bevel: number, curveSegments = 12) {
  const geometry = new ExtrudeGeometry(shape, {
    depth: Math.max(height - 2 * bevel, 1e-5),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 3,
    curveSegments,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bevel, 0);
  return geometry;
}

function mesh(geometry: BufferGeometry, material: Material, name?: string): Mesh {
  const result = new Mesh(geometry, material);
  if (name) result.name = name;
  return result;
}

/** Petit bloc aux arêtes adoucies, posé sur y = bottom. */
function block(
  w: number,
  h: number,
  d: number,
  material: Material,
  x: number,
  bottom: number,
  z: number,
  radius = mm(0.4),
): Mesh {
  const r = Math.min(radius, w / 2, h / 2, d / 2) * 0.99;
  const result = mesh(new RoundedBoxGeometry(w, h, d, 2, r), material);
  result.position.set(x, bottom + h / 2, z);
  return result;
}

function materials(config: ModelConfig) {
  const standard = (color: string, roughness: number, metalness = 0) =>
    new MeshStandardMaterial({ color: new Color(color), roughness, metalness });

  const tint = new Color(config.procedural.case.color);
  const shell = new MeshStandardMaterial({ roughness: 0.5, toneMapped: false });
  shell.color.copy(tint).multiplyScalar(SHELL_ALBEDO);
  shell.emissive.copy(tint).multiplyScalar(SHELL_GLOW);

  // Le veinage porte déjà le noyer : la matière ne fait que compenser la lumière.
  const wood = matte(albedoFor('#ffffff', LIGHT.lit), createWoodGrainTexture(SCREEN.wood));

  // Pièces cachées sous la coque fermée, repoussées en profondeur selon leur
  // pente : avec l'anticrénelage, le rendu logiciel (celui des images fixes
  // et des tests) évalue mal la profondeur des facettes très fines vues par la
  // tranche, et des points isolés des cartes perçaient la coque.
  const inner = <T extends Material>(material: T, units = 1): T =>
    Object.assign(material, {
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: units,
    });

  return {
    shell,
    inside: inner(matte(albedoFor(SCREEN.inside, LIGHT.lit)), 2),
    // Réglée pour le dessus du kanji ; sur la face avant, éclairée un peu moins,
    // le mot HAKO s'affiche à peine plus foncé (écart inférieur à 1 %).
    mark: matte(albedoFor(SCREEN.mark, LIGHT.top)),
    led: standard('#fffaf2', 0.3),
    wood,
    pcb: inner(matte(albedoFor(SCREEN.pcb, LIGHT.top))),
    port: inner(matte(albedoFor(SCREEN.port, LIGHT.top))),
    chip: inner(standard('#1d1b1a', 0.42)),
    ssd: inner(standard('#1b1918', 0.45)),
    socLid: inner(standard('#bdb8b0', 0.38, 1)),
    gold: inner(standard('#d2a64e', 0.32, 1)),
    brass: inner(standard('#c39a52', 0.36, 1)),
    plastic: inner(standard('#2a2521', 0.6)),
    beige: inner(standard('#e7e0d2', 0.6)),
    fan: inner(standard('#3d342d', 0.55)),
    rotor: inner(standard('#4a3f36', 0.5)),
  };
}

type Palette = ReturnType<typeof materials>;

/** Trous de fixation (x, z) d'une carte au format Raspberry Pi, dans son repère. */
function mountingHoles(offsetX: number): Array<[number, number]> {
  return [
    [offsetX - mm(29), mm(24.5)],
    [offsetX - mm(29), -mm(24.5)],
    [offsetX + mm(29), mm(24.5)],
    [offsetX + mm(29), -mm(24.5)],
  ];
}

function board(
  width: number,
  depth: number,
  holes: Array<[number, number]>,
  material: Material,
  gold: Material,
): Group {
  const group = new Group();
  const shape = roundedRect(new Shape(), 0, 0, width, depth, mm(3)) as Shape;
  for (const [x, z] of holes) shape.holes.push(circle(x, -z, mm(1.35)));
  group.add(mesh(extrudeUp(shape, mm(1.6), mm(0.25), 8), material));
  for (const [x, z] of holes) {
    const ring = mesh(new RingGeometry(mm(1.35), mm(3), 24), gold);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, mm(1.62), z);
    group.add(ring);
  }
  return group;
}

/** Dimensions des prises dessinées sur la carte (repère de la carte : prises vers +x). */
const PORTS = {
  /** Débord des prises au-delà du bord de la carte. */
  overhang: mm(2.5),
  /** USB (deux étages) et Ethernet : centre (z), largeur, hauteur, longueur. */
  usb: [
    { z: mm(1.5), width: mm(13.6), height: mm(19.5), length: mm(17.5) },
    { z: -mm(16), width: mm(13.6), height: mm(19.5), length: mm(17.5) },
  ],
  ethernet: { z: mm(18.5), width: mm(16.4), height: mm(16.5), length: mm(21) },
  /** USB-C (alimentation) et micro-HDMI, sur le grand côté +z : abscisses. */
  side: [-mm(31.3), -mm(16.7), -mm(3.3)],
  sideSize: { width: mm(8), height: mm(6), depth: mm(7) },
} as const;

/**
 * Carte Raspberry Pi 5 : origine au centre de la carte, dessous du circuit à
 * y = 0. Les blocs des prises ne dépassent pas `portLimit` au-dessus de la carte.
 */
function raspberryPi5(m: Palette, portLimit: number): Group {
  // Trous à 3,5 mm du bord gauche : x = -39 et +19 mm (carte centrée).
  const group = board(mm(85), mm(56), mountingHoles(-mm(10)), m.pcb, m.gold);
  group.name = 'RPi5_Board';
  const top = mm(1.6);

  // Processeur BCM2712 et son couvercle métallique.
  group.add(block(mm(17), mm(1.2), mm(17), m.chip, -mm(14), top, -mm(1)));
  group.add(block(mm(12.5), mm(1.1), mm(12.5), m.socLid, -mm(14), top + mm(1.2), -mm(1)));
  // Mémoire vive et puce RP1 (entrées-sorties).
  group.add(block(mm(14), mm(1), mm(11), m.chip, mm(3), top, -mm(4)));
  group.add(block(mm(10), mm(0.9), mm(10), m.chip, mm(13), top, mm(14)));

  // Connecteur GPIO 2 × 20 broches le long du bord -z.
  const headerX = -mm(10);
  const headerZ = -mm(24.5);
  group.add(block(mm(50.8), mm(2.5), mm(5.08), m.plastic, headerX, top, headerZ, mm(0.3)));
  const pins = new InstancedMesh(new BoxGeometry(mm(0.64), mm(6), mm(0.64)), m.gold, 40);
  const matrix = new Matrix4();
  for (let i = 0; i < 40; i += 1) {
    const column = Math.floor(i / 2);
    const row = i % 2;
    matrix.makeTranslation(
      headerX + (column - 9.5) * mm(2.54),
      top + mm(2.5) + mm(1.5),
      headerZ + (row - 0.5) * mm(2.54),
    );
    pins.setMatrixAt(i, matrix);
  }
  group.add(pins);

  // Prises USB et Ethernet sur le petit côté +x : blocs gris, comme sur le prototype.
  const portEnd = mm(42.5) + PORTS.overhang;
  for (const port of [...PORTS.usb, PORTS.ethernet]) {
    group.add(
      block(
        port.length,
        Math.min(port.height, portLimit),
        port.width,
        m.port,
        portEnd - port.length / 2,
        top,
        port.z,
        mm(0.5),
      ),
    );
  }
  // USB-C et micro-HDMI sur le grand côté +z.
  const { width, height, depth } = PORTS.sideSize;
  for (const x of PORTS.side) {
    group.add(block(width, height, depth, m.port, x, top, mm(28) + mm(1) - depth / 2, mm(0.5)));
  }

  // Connecteur PCIe (nappe) sur le petit côté -x.
  group.add(block(mm(3), mm(2.2), mm(17), m.beige, -mm(40.5), top, mm(0), mm(0.3)));
  return group;
}

/**
 * Carte M.2 (provisoire, à l'empreinte du Raspberry Pi) et son SSD 2230 :
 * origine au centre, dessous à y = 0. Les entretoises montent jusqu'au
 * Raspberry Pi, `spacer` plus haut.
 */
function nvmeBoard(m: Palette, spacer: number): Group {
  const holes = mountingHoles(mm(10));
  const group = board(mm(85), mm(56), holes, m.pcb, m.gold);
  group.name = 'NVMe_Board';
  const top = mm(1.6);

  for (const [x, z] of holes) {
    const post = mesh(new CylinderGeometry(mm(2.5), mm(2.5), spacer, 6), m.brass);
    post.position.set(x, top + spacer / 2, z);
    group.add(post);
  }
  // Connecteur de la nappe (vers le Raspberry Pi) et quelques composants.
  group.add(block(mm(3), mm(2.2), mm(17), m.beige, mm(39), top, mm(2), mm(0.3)));
  group.add(block(mm(5), mm(1), mm(5), m.chip, mm(30), top, -mm(14)));
  group.add(block(mm(3), mm(0.8), mm(2), m.chip, mm(24), top, -mm(18)));
  // Support M.2.
  group.add(block(mm(5.5), mm(3), mm(22), m.plastic, -mm(24), top, 0, mm(0.3)));

  // Le SSD, inséré dans le support et tenu par une vis.
  const ssd = new Group();
  ssd.name = 'NVMe_SSD';
  ssd.position.set(-mm(6), top + mm(0.9), 0);
  ssd.add(block(mm(30), mm(0.8), mm(22), m.ssd, 0, 0, 0, mm(0.2)));
  ssd.add(block(mm(3), mm(0.82), mm(18), m.gold, -mm(13.6), -mm(0.01), 0, mm(0.1)));
  ssd.add(block(mm(9), mm(1.1), mm(9), m.chip, -mm(5), mm(0.8), 0));
  ssd.add(block(mm(12), mm(1.2), mm(15), m.chip, mm(7), mm(0.8), 0));
  const screw = mesh(new CylinderGeometry(mm(2.2), mm(2.2), mm(1.2), 20), m.socLid);
  screw.position.set(mm(15), mm(1.2), 0);
  ssd.add(screw);
  group.add(ssd);
  return group;
}

/** Ventilateur (40 mm, provisoire) et son rotor (Fan_Rotor) : origine au centre, dessous à y = 0. */
function fan(m: Palette): Group {
  const group = new Group();
  group.name = 'Fan';
  const size = mm(40);
  const height = mm(10);
  const frame = roundedRect(new Shape(), 0, 0, size, size, mm(3)) as Shape;
  frame.holes.push(circle(0, 0, mm(18.8)));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) frame.holes.push(circle(sx * mm(16), sz * mm(16), mm(1.7)));
  }
  group.add(mesh(extrudeUp(frame, height, mm(0.5), 24), m.fan));

  // Support du moteur et ses quatre bras.
  const mount = mesh(new CylinderGeometry(mm(9), mm(9), mm(1.4), 40), m.fan);
  mount.position.y = mm(0.7);
  group.add(mount);
  for (let i = 0; i < 4; i += 1) {
    const angle = Math.PI / 4 + (i * Math.PI) / 2;
    const arm = mesh(new BoxGeometry(mm(11), mm(1.4), mm(1.8)), m.fan);
    arm.position.set(Math.cos(angle) * mm(14), mm(0.7), -Math.sin(angle) * mm(14));
    arm.rotation.y = angle;
    group.add(arm);
  }

  // Rotor : moyeu et sept pales inclinées.
  const rotor = new Group();
  rotor.name = 'Fan_Rotor';
  const hub = mesh(new CylinderGeometry(mm(8.4), mm(8.6), mm(7), 48), m.rotor);
  hub.position.y = mm(5.3);
  rotor.add(hub);
  const bladeGeometry = new BoxGeometry(mm(10.4), mm(0.8), mm(9.5));
  for (let i = 0; i < 7; i += 1) {
    const holder = new Group();
    holder.rotation.y = (i * Math.PI * 2) / 7;
    const blade = mesh(bladeGeometry, m.rotor);
    blade.position.set(mm(13.4), mm(5.3), 0);
    blade.rotation.set(0.62, 0.22, 0);
    holder.add(blade);
    rotor.add(holder);
  }
  group.add(rotor);
  return group;
}

/** Contour précalculé par scripts/model/logo-outline.mjs (voir ce script). */
type Outline = readonly (readonly (readonly number[])[])[];

/** Formes 2D d'un contour précalculé, centrées sur l'origine, larges de `width`, y vers le haut. */
function outlineShapes(outline: Outline, unit: number, width: number): Shape[] {
  const scale = width / unit;
  return outline.map((contours) => {
    const [outer = [], ...holes] = contours.map((flat) => {
      const points: Array<[number, number]> = [];
      for (let i = 0; i + 1 < flat.length; i += 2) {
        points.push([(flat[i] ?? 0) * scale, (flat[i + 1] ?? 0) * scale]);
      }
      return points;
    });
    const shape = new Shape();
    outer.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
    for (const hole of holes) {
      const path = new Path();
      hole.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
      shape.holes.push(path);
    }
    return shape;
  });
}

/**
 * Relief d'un marquage, dans le plan de ses formes : l'épaisseur va de
 * z = -sink (enfoncée dans la coque, sans jour au bord) à z = raise.
 */
function markRelief(shapes: Shape[], raise: number, sink: number): BufferGeometry {
  const geometry = new ExtrudeGeometry(shapes, {
    depth: raise + sink,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -sink);
  return geometry;
}

/**
 * Réunit des géométries non indexées (positions et normales) en une seule :
 * les deux marquages ne coûtent qu'un appel de dessin.
 */
function mergeMarks(geometries: readonly BufferGeometry[]): BufferGeometry {
  const merged = new BufferGeometry();
  for (const name of ['position', 'normal'] as const) {
    const arrays = geometries.map((geometry) => geometry.getAttribute(name).array);
    const data = new Float32Array(arrays.reduce((sum, array) => sum + array.length, 0));
    let offset = 0;
    for (const array of arrays) {
      data.set(array, offset);
      offset += array.length;
    }
    merged.setAttribute(name, new Float32BufferAttribute(data, 3));
  }
  for (const geometry of geometries) geometry.dispose();
  return merged;
}

/** Placement des marquages sur la coque (repère de Case_Lid, bas de la coque à y = 0). */
interface MarkLayout {
  readonly kanjiWidth: number;
  readonly lidHeight: number;
  readonly frontZ: number;
  readonly wordmarkWidth: number;
  readonly wordmarkCentre: number;
}

/**
 * Logo_Decal : le kanji 箱 en relief au centre du dessus (le haut du kanji
 * vers l'arrière, -z) et le mot HAKO sur la grande face avant (+z), lisible
 * de face, dans un seul objet.
 */
function logoDecal(layout: MarkLayout, material: Material): Mesh {
  const kanji = markRelief(
    outlineShapes(kanjiShapes, kanjiUnit, layout.kanjiWidth),
    PROTOTYPE.kanjiRaise,
    PROTOTYPE.markSink,
  );
  // Le relief monte vers +y ; le haut du kanji part vers -z.
  kanji.rotateX(-Math.PI / 2);
  kanji.translate(0, layout.lidHeight, 0);
  const wordmark = markRelief(
    outlineShapes(wordmarkShapes, wordmarkUnit, layout.wordmarkWidth),
    PROTOTYPE.wordmarkRaise,
    PROTOTYPE.markSink,
  );
  wordmark.translate(0, layout.wordmarkCentre, layout.frontZ);
  return mesh(mergeMarks([kanji, wordmark]), material, 'Logo_Decal');
}

/** Construit la box complète. */
export function buildProceduralModel(config: ModelConfig): Group {
  const m = materials(config);
  const c = config.procedural.case;
  const root = new Group();
  root.name = 'HAKO_Box';
  // Garde-fous pour des cotes modifiées dans le JSON : l'arrondi du dessus
  // tient dans celui des angles, la paroi dans l'arrondi du dessus.
  const radius = Math.max(c.cornerRadius, mm(3));
  const topFillet = Math.min(PROTOTYPE.topFillet, radius - mm(1));
  const wall = Math.min(c.wall, topFillet - mm(0.5));
  const rect: RoundedRect = { halfWidth: c.width / 2, halfDepth: c.depth / 2, radius };

  // ----- Socle (Case_Base) : dalle et quatre pieds d'angle, en retrait sous la coque -----
  const floor = PROTOTYPE.feetHeight + PROTOTYPE.plinthThickness;
  const plinth = insetRect(rect, PROTOTYPE.plinthInset);
  const base = new Group();
  base.name = 'Case_Base';
  base.add(mesh(buildSlab(plinth, PROTOTYPE.feetHeight, floor), m.wood));
  // Les pieds montent un peu dans la dalle : aucun jour entre les deux.
  const foot = buildCornerFoot(
    plinth,
    Math.max(PROTOTYPE.feetAlongX, plinth.radius + mm(2)),
    Math.max(PROTOTYPE.feetAlongZ, plinth.radius + mm(2)),
    0,
    PROTOTYPE.feetHeight + mm(0.5),
  );
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ] as const) {
    const corner = mesh(foot, m.wood);
    corner.scale.set(sx, 1, sz);
    base.add(corner);
  }
  root.add(base);

  // ----- Cartes : la carte M.2 sur le socle, le Raspberry Pi au-dessus -----
  // Le Raspberry Pi est tourné d'un demi-tour : l'USB-C et les micro-HDMI
  // sont à l'arrière (-z), les prises USB et Ethernet du côté gauche (-x).
  // Celles-ci s'arrêtent juste derrière la paroi, au fond de leurs fenêtres :
  // la coque se soulève tout droit sans les traverser.
  const standoff = mm(2);
  const spacer = mm(7);
  const portInset = mm(0.2);
  const boardX = -c.width / 2 + wall + portInset + mm(42.5) + PORTS.overhang;
  const nvmeY = floor + standoff;
  const rpiY = nvmeY + mm(1.6) + spacer;
  // Les fenêtres des prises s'arrêtent sous l'arrondi du dessus de la coque.
  const wallTop = c.lidHeight - topFillet - mm(0.3);
  const pcbTop = rpiY + mm(1.6) - floor;
  const clearance = mm(0.5);
  const portLimit = wallTop - clearance - pcbTop;
  for (const [x, z] of mountingHoles(mm(10))) {
    const post = mesh(new CylinderGeometry(mm(2.5), mm(2.5), standoff, 6), m.brass);
    post.position.set(boardX + x, floor + standoff / 2, z);
    base.add(post);
  }

  const nvme = nvmeBoard(m, spacer);
  nvme.position.set(boardX, nvmeY, 0);
  root.add(nvme);

  const rpi = raspberryPi5(m, portLimit);
  rpi.position.set(boardX, rpiY, 0);
  rpi.rotation.y = Math.PI;
  root.add(rpi);

  // ----- Ventilateur, au-dessus du processeur -----
  const cooler = fan(m);
  cooler.position.set(boardX + mm(14), rpiY + mm(1.6) + mm(2.3) + mm(1.5), mm(1));
  root.add(cooler);

  // ----- Coque (Case_Lid), posée sur le socle -----
  const lid = new Group();
  lid.name = 'Case_Lid';
  lid.position.y = floor;
  const openings: ShellOpening[] = [];
  // Face gauche (-x) : fenêtres des prises, devant les blocs gris (côté 1, u = -z).
  // Leur bas passe un peu au-dessus du circuit : on ne voit ni la carte ni le
  // pied arrondi des blocs.
  for (const port of [...PORTS.usb, PORTS.ethernet]) {
    openings.push({
      side: 1,
      u: [port.z - port.width / 2 - clearance, port.z + port.width / 2 + clearance],
      v: [pcbTop + mm(0.8), pcbTop + Math.min(port.height, portLimit) + clearance],
    });
  }
  // Face arrière (-z, côté 2, u = x) : USB-C et micro-HDMI, puis deux fentes d'aération.
  const { width: sideWidth, height: sideHeight } = PORTS.sideSize;
  for (const x of PORTS.side) {
    const centre = boardX - x;
    openings.push({
      side: 2,
      u: [centre - sideWidth / 2 - clearance, centre + sideWidth / 2 + clearance],
      v: [pcbTop - clearance, pcbTop + sideHeight + clearance],
    });
  }
  const slotTop = wallTop - mm(1.5);
  for (const v of [
    [slotTop - mm(1.8), slotTop],
    [slotTop - mm(5), slotTop - mm(3.2)],
  ] as const) {
    openings.push({ side: 2, u: [-mm(23), c.width / 2 - radius - mm(2)], v });
  }
  const shell = buildShell({
    rect,
    height: c.lidHeight,
    fillet: topFillet,
    wall,
    openings,
  });
  lid.add(mesh(shell.outside, m.shell), mesh(shell.inside, m.inside));

  // Face droite (+x) : bouton rond en saillie et petit voyant, vers l'arrière.
  const button = mesh(new CylinderGeometry(mm(2.6), mm(2.6), mm(2), 32), m.shell);
  button.rotation.z = Math.PI / 2;
  button.position.set(c.width / 2, c.lidHeight * 0.48, -(c.depth / 2 - radius - mm(3.2)));
  const led = mesh(new CylinderGeometry(mm(0.8), mm(0.8), mm(0.6), 16), m.led);
  led.rotation.z = Math.PI / 2;
  led.position.set(c.width / 2 + mm(0.1), c.lidHeight * 0.48, button.position.z + mm(8));
  lid.add(button, led);

  // Marquages : le kanji au centre du dessus, le mot HAKO au milieu de la
  // grande face avant. Garde-fous : le mot reste sur la partie plate de la
  // face, loin des arrondis des angles et du dessus.
  const logo = config.procedural.logo;
  const flatHalf = c.width / 2 - radius - PROTOTYPE.wordmarkMargin;
  const wordmarkWidth = Math.min(logo.wordmarkWidth, 2 * flatHalf);
  const halfHeight = (wordmarkWidth * wordmarkDrawingHeight) / wordmarkDrawingWidth / 2;
  const wordmarkCentre = Math.min(
    Math.max(logo.wordmarkCentre, halfHeight + PROTOTYPE.wordmarkMargin),
    c.lidHeight - topFillet - halfHeight - PROTOTYPE.wordmarkMargin,
  );
  lid.add(
    logoDecal(
      {
        kanjiWidth: logo.width,
        lidHeight: c.lidHeight,
        frontZ: c.depth / 2,
        wordmarkWidth,
        wordmarkCentre,
      },
      m.mark,
    ),
  );
  root.add(lid);

  return root;
}

/** Libère la mémoire graphique d'un objet et de ses descendants. */
export function disposeObject(object: Object3D): void {
  const materialsSeen = new Set<Material>();
  object.traverse((child) => {
    if (child instanceof Mesh) {
      (child.geometry as BufferGeometry).dispose();
      const list = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of list as Material[]) materialsSeen.add(material);
    }
  });
  for (const material of materialsSeen) {
    for (const value of Object.values(material)) {
      if (value && typeof value === 'object' && 'isTexture' in value) (value as Texture).dispose();
    }
    material.dispose();
  }
}
