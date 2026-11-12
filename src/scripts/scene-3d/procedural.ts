/**
 * Modèle provisoire de la box, dessiné en code en attendant le fichier
 * Blender (public/models/hako.glb). Il porte exactement les noms d'objets du
 * contrat (contract.ts) : la scène l'anime comme le modèle réel.
 *
 * Unités : mètres, y vers le haut, origine au centre du dessous de la box,
 * face avant (logo) tournée vers +z.
 *
 * Seule la carte Raspberry Pi 5 a ses cotes officielles (85 × 56 mm, trous
 * de fixation à 3,5 mm des bords, entraxe 58 × 49 mm). Le reste est
 * PROVISOIRE, à confirmer avec le matériel réel : carte M.2 dessinée au
 * format HAT+ (65 × 56,5 mm), SSD au format M.2 2230 (22 × 30 mm),
 * ventilateur de 40 mm, et le boîtier, dont les cotes sont dans
 * model.config.json (procedural.case).
 */
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  RingGeometry,
  Shape,
  SRGBColorSpace,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ModelConfig } from './config';
import { createLayerLinesNormalMap } from './textures';

const mm = (value: number) => value / 1000;

/** Hauteur visible d'une couche d'impression (légèrement exagérée pour rester lisible). */
const LAYER_HEIGHT = mm(0.4);
const LAYERS_PER_TILE = 16;

/** Proportions du logo paysage (HAKO_Landscape_Transparent.png : 2160 × 530 px). */
const LOGO_ASPECT = 2160 / 530;

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
  const layerLines = createLayerLinesNormalMap(LAYERS_PER_TILE);
  layerLines.repeat.set(1, 1 / (LAYERS_PER_TILE * LAYER_HEIGHT));
  const standard = (color: string, roughness: number, metalness = 0) =>
    new MeshStandardMaterial({ color: new Color(color), roughness, metalness });

  const pla = new MeshStandardMaterial({
    color: new Color(config.procedural.case.color),
    roughness: 0.78,
    metalness: 0,
    normalMap: layerLines,
  });
  pla.normalScale.set(0.32, 0.32);

  return {
    pla,
    pcb: standard('#1f5b3d', 0.52),
    pcbDark: standard('#2b2724', 0.5),
    ssd: standard('#1b1918', 0.45),
    chip: standard('#1d1b1a', 0.42),
    metal: standard('#cfccc6', 0.3, 1),
    socLid: standard('#bdb8b0', 0.38, 1),
    gold: standard('#d2a64e', 0.32, 1),
    brass: standard('#c39a52', 0.36, 1),
    plastic: standard('#2a2521', 0.6),
    opening: standard('#141110', 0.7),
    beige: standard('#e7e0d2', 0.6),
    fan: standard('#3d342d', 0.55),
    rotor: standard('#4a3f36', 0.5),
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

/** Carte Raspberry Pi 5 : origine au centre de la carte, dessous du circuit à y = 0. */
function raspberryPi5(m: Palette): Group {
  // Trous à 3,5 mm du bord gauche : x = -39 et +19 mm (carte centrée).
  const group = board(mm(85), mm(56), mountingHoles(-mm(10)), m.pcb, m.gold);
  group.name = 'RPi5_Board';
  const top = mm(1.6);

  // Processeur BCM2712 et son couvercle métallique.
  group.add(block(mm(17), mm(1.2), mm(17), m.pcbDark, -mm(14), top, -mm(1)));
  group.add(block(mm(12.5), mm(1.1), mm(12.5), m.socLid, -mm(14), top + mm(1.2), -mm(1)));
  // Mémoire vive et puce RP1 (entrées-sorties).
  group.add(block(mm(14), mm(1), mm(11), m.chip, mm(3), top, -mm(4)));
  group.add(block(mm(10), mm(0.9), mm(10), m.chip, mm(13), top, mm(14)));
  // Petits composants autour du processeur.
  for (let i = 0; i < 6; i += 1) {
    group.add(block(mm(1.6), mm(0.6), mm(0.8), m.chip, -mm(24) + i * mm(2.6), top, mm(11)));
  }

  // Connecteur GPIO 2 × 20 broches le long du bord arrière.
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

  // Prises USB (deux étages) et Ethernet sur le petit côté droit.
  const portEnd = mm(42.5) + mm(2);
  const usb = (z: number) => {
    group.add(block(mm(17.5), mm(15.6), mm(14.6), m.metal, portEnd - mm(8.75), top, z, mm(0.6)));
    for (const y of [mm(3.2), mm(10.6)]) {
      group.add(
        block(mm(0.6), mm(4.6), mm(12), m.opening, portEnd + mm(0.05), top + y, z, mm(0.2)),
      );
    }
  };
  usb(mm(1.5));
  usb(-mm(16));
  group.add(block(mm(21), mm(13.5), mm(16), m.metal, portEnd - mm(10.5), top, mm(18.5), mm(0.6)));
  group.add(
    block(mm(0.6), mm(8), mm(12), m.opening, portEnd + mm(0.05), top + mm(3.5), mm(18.5), mm(0.2)),
  );

  // USB-C (alimentation) et deux micro-HDMI sur le grand côté avant.
  const frontZ = mm(28) - mm(3.4);
  group.add(block(mm(8.9), mm(3.2), mm(7.4), m.metal, -mm(31.3), top, frontZ, mm(1.2)));
  group.add(block(mm(6.6), mm(3), mm(7.4), m.metal, -mm(16.7), top, frontZ, mm(0.5)));
  group.add(block(mm(6.6), mm(3), mm(7.4), m.metal, -mm(3.3), top, frontZ, mm(0.5)));

  // Connecteur PCIe (nappe) sur le petit côté gauche.
  group.add(block(mm(3), mm(2.2), mm(17), m.beige, -mm(40.5), top, mm(0), mm(0.3)));
  return group;
}

/** Carte M.2 (format HAT+, provisoire) et son SSD 2230 : origine au centre, dessous à y = 0. */
function nvmeBoard(m: Palette): Group {
  const holes = mountingHoles(0);
  const group = board(mm(65), mm(56.5), holes, m.pcbDark, m.gold);
  group.name = 'NVMe_Board';
  const top = mm(1.6);

  // Entretoises en laiton vissées sous la carte.
  for (const [x, z] of holes) {
    const spacer = mesh(new CylinderGeometry(mm(2.5), mm(2.5), mm(13), 6), m.brass);
    spacer.position.set(x, -mm(6.5), z);
    group.add(spacer);
  }
  // Connecteur M.2 et quelques composants.
  group.add(block(mm(5.5), mm(3), mm(22), m.plastic, mm(26), top, 0, mm(0.3)));
  group.add(block(mm(5), mm(1), mm(5), m.chip, -mm(22), top, -mm(16)));
  group.add(block(mm(3), mm(0.8), mm(2), m.chip, -mm(14), top, -mm(18)));
  group.add(block(mm(3), mm(2.2), mm(17), m.beige, -mm(29.5), top, mm(2), mm(0.3)));

  // Le SSD, inséré dans le connecteur et tenu par une vis.
  const ssd = new Group();
  ssd.name = 'NVMe_SSD';
  ssd.position.set(mm(9), top + mm(0.9), 0);
  ssd.add(block(mm(30), mm(0.8), mm(22), m.ssd, 0, 0, 0, mm(0.2)));
  ssd.add(block(mm(3), mm(0.82), mm(18), m.gold, mm(13.6), -mm(0.01), 0, mm(0.1)));
  ssd.add(block(mm(9), mm(1.1), mm(9), m.chip, mm(5), mm(0.8), 0));
  ssd.add(block(mm(12), mm(1.2), mm(15), m.chip, -mm(7), mm(0.8), 0));
  const screw = mesh(new CylinderGeometry(mm(2.2), mm(2.2), mm(1.2), 20), m.metal);
  screw.position.set(-mm(15), mm(1.2), 0);
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

/** Profil en anneau (parois) : rectangle arrondi extérieur moins intérieur. */
function wallRing(w: number, d: number, r: number, wall: number) {
  const shape = roundedRect(new Shape(), 0, 0, w, d, r) as Shape;
  shape.holes.push(
    roundedRect(new Path(), 0, 0, w - 2 * wall, d - 2 * wall, Math.max(r - wall, mm(1))),
  );
  return shape;
}

export interface ProceduralOptions {
  readonly logo: Texture | null;
}

/** Construit la box complète. */
export function buildProceduralModel(config: ModelConfig, options: ProceduralOptions): Group {
  const m = materials(config);
  const c = config.procedural.case;
  const root = new Group();
  root.name = 'HAKO_Box';

  // Placement des cartes dans la base (repère du modèle).
  const rpiX = -mm(1);
  const rpiY = c.wall + mm(3);
  const hatX = rpiX - mm(10);
  const hatY = rpiY + mm(1.6) + mm(13);
  const fanX = rpiX - mm(14);
  const fanY = hatY + mm(7.6);

  // ----- Base du boîtier -----
  const base = new Group();
  base.name = 'Case_Base';
  base.add(
    mesh(
      extrudeUp(wallRing(c.width, c.depth, c.cornerRadius, c.wall), c.baseHeight, mm(0.8)),
      m.pla,
    ),
  );
  const floor = roundedRect(
    new Shape(),
    0,
    0,
    c.width - 2 * c.wall + mm(0.4),
    c.depth - 2 * c.wall + mm(0.4),
    Math.max(c.cornerRadius - c.wall, mm(1)),
  ) as Shape;
  base.add(mesh(extrudeUp(floor, c.wall, 0), m.pla));
  for (const [x, z] of mountingHoles(rpiX - mm(10))) {
    const standoff = mesh(new CylinderGeometry(mm(2.8), mm(3), mm(3.2), 24), m.pla);
    standoff.position.set(x, c.wall + mm(1.5), z);
    base.add(standoff);
  }
  if (options.logo) {
    // Matériau sans éclairage ni rendu des tons : le logo garde exactement le
    // chocolat de la marque (#412D1E), sous tous les angles.
    const logoMaterial = new MeshBasicMaterial({
      map: options.logo,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    options.logo.colorSpace = SRGBColorSpace;
    const width = config.procedural.logo.width;
    const decal = mesh(new PlaneGeometry(width, width / LOGO_ASPECT), logoMaterial, 'Logo_Decal');
    decal.position.set(0, config.procedural.logo.centerY, c.depth / 2 + mm(0.05));
    decal.renderOrder = 1;
    base.add(decal);
  }
  root.add(base);

  // ----- Raspberry Pi 5 -----
  const rpi = raspberryPi5(m);
  rpi.position.set(rpiX, rpiY, 0);
  root.add(rpi);

  // ----- Carte M.2 et SSD -----
  const nvme = nvmeBoard(m);
  nvme.position.set(hatX, hatY, 0);
  root.add(nvme);

  // ----- Ventilateur -----
  const cooler = fan(m);
  cooler.position.set(fanX, fanY, 0);
  root.add(cooler);

  // ----- Couvercle : parois et dessus ajouré au-dessus du ventilateur -----
  const lid = new Group();
  lid.name = 'Case_Lid';
  lid.position.y = c.baseHeight;
  lid.add(
    mesh(
      extrudeUp(wallRing(c.width, c.depth, c.cornerRadius, c.wall), c.lidHeight, mm(0.8)),
      m.pla,
    ),
  );
  const lidTop = roundedRect(new Shape(), 0, 0, c.width, c.depth, c.cornerRadius) as Shape;
  lidTop.holes.push(circle(fanX, 0, mm(1.4)));
  for (const [ringRadius, count] of [
    [mm(4.6), 6],
    [mm(9.2), 12],
    [mm(13.8), 18],
  ] as const) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + (count === 12 ? Math.PI / 12 : 0);
      lidTop.holes.push(
        circle(fanX + Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, mm(1.4)),
      );
    }
  }
  const top = mesh(extrudeUp(lidTop, c.wall, mm(0.8), 10), m.pla);
  top.position.y = c.lidHeight - c.wall;
  lid.add(top);
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
