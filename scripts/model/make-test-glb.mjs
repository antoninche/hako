/**
 * npm run model:test-glb : fabrique les deux modèles d'essai utilisés par les
 * tests de npm run model:check et npm run model:optimize.
 *
 * tests/fixtures/hako-test.glb respecte le contrat (docs/model-contract.md) :
 * mètres, +Y vers le haut, objets nommés exactement, origine de chaque objet
 * au centre de sa géométrie, matériaux PBR et une petite texture.
 * tests/fixtures/hako-test-mauvais.glb accumule volontairement les erreurs
 * qu'un export depuis Blender peut produire.
 *
 * Les dimensions sont écrites en millimètres, lisibles, puis converties.
 * Ce sont des volumes simplifiés, pas un relevé exact du matériel.
 */

import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Document, NodeIO } from '@gltf-transform/core';
import { KHRLightsPunctual, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import sharp from 'sharp';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const GOOD_FIXTURE = path.join(repoRoot, 'tests', 'fixtures', 'hako-test.glb');
export const BROKEN_FIXTURE = path.join(repoRoot, 'tests', 'fixtures', 'hako-test-mauvais.glb');

/** Coordonnées de texture d'un quadrilatère, image à l'endroit vue de face. */
const QUAD_UVS = [
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0],
];

const AXES = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

/** Faces d'un pavé : normale sortante n et axes u, v tels que u × v = n. */
const BOX_FACES = [
  { n: [1, 0, 0], u: AXES.y, v: AXES.z },
  { n: [-1, 0, 0], u: AXES.z, v: AXES.y },
  { n: [0, 1, 0], u: AXES.z, v: AXES.x },
  { n: [0, -1, 0], u: AXES.x, v: AXES.z },
  { n: [0, 0, 1], u: AXES.x, v: AXES.y },
  { n: [0, 0, -1], u: AXES.y, v: AXES.x },
];

/**
 * Géométrie en construction, en millimètres, dans le repère de la scène.
 * @typedef {{ positions: number[], normals: number[], uvs: number[], indices: number[] }} Geometry
 * @typedef {[number, number, number]} Vec3
 */

/** @returns {Geometry} */
function createGeometry() {
  return { positions: [], normals: [], uvs: [], indices: [] };
}

/**
 * Ajoute un polygone convexe (sommets dans le sens trigonométrique vus de
 * l'extérieur), découpé en éventail de triangles.
 * @param {Geometry} geometry
 * @param {{ p: number[], n: number[], uv: number[] }[]} vertices
 */
function addPolygon(geometry, vertices) {
  const base = geometry.positions.length / 3;
  for (const vertex of vertices) {
    geometry.positions.push(...vertex.p);
    geometry.normals.push(...vertex.n);
    geometry.uvs.push(...vertex.uv);
  }
  for (let i = 1; i < vertices.length - 1; i += 1) {
    geometry.indices.push(base, base + i, base + i + 1);
  }
}

/**
 * Ajoute un pavé centré sur `center`, de dimensions `size` (mm).
 * @param {Geometry} geometry
 * @param {number[]} center
 * @param {number[]} size
 */
function addBox(geometry, center, size) {
  const half = size.map((value) => value / 2);
  const along = (axis) => axis.findIndex((value) => value !== 0);
  for (const { n, u, v } of BOX_FACES) {
    const ni = along(n);
    const ui = along(u);
    const vi = along(v);
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    addPolygon(
      geometry,
      corners.map(([su, sv], index) => {
        const p = [...center];
        p[ni] += n[ni] * half[ni];
        p[ui] += su * half[ui];
        p[vi] += sv * half[vi];
        return { p, n, uv: QUAD_UVS[index] };
      }),
    );
  }
}

/**
 * Ajoute un cylindre d'axe Y (moyeu du rotor), côtés lissés.
 * @param {Geometry} geometry
 * @param {number[]} center
 * @param {number} radius
 * @param {number} height
 * @param {number} segments
 */
function addCylinder(geometry, center, radius, height, segments) {
  const [cx, cy, cz] = center;
  const bottom = cy - height / 2;
  const top = cy + height / 2;
  const ring = Array.from({ length: segments }, (_, i) => {
    const angle = (2 * Math.PI * i) / segments;
    return { cos: Math.cos(angle), sin: Math.sin(angle) };
  });
  ring.forEach((a0, i) => {
    const a1 = ring[(i + 1) % segments];
    const at = (a, y) => ({
      p: [cx + radius * a.cos, y, cz + radius * a.sin],
      n: [a.cos, 0, a.sin],
      uv: [0, 0],
    });
    addPolygon(geometry, [at(a1, bottom), at(a0, bottom), at(a0, top), at(a1, top)]);
  });
  const cap = (y, normal, order) =>
    addPolygon(
      geometry,
      order.map((a) => ({
        p: [cx + radius * a.cos, y, cz + radius * a.sin],
        n: normal,
        uv: [0, 0],
      })),
    );
  cap(top, [0, 1, 0], [...ring].reverse());
  cap(bottom, [0, -1, 0], ring);
}

/**
 * Ajoute une pale : un pavé fin tourné autour de l'axe Y passant par `axis`.
 * @param {Geometry} geometry
 * @param {number[]} axis
 * @param {number} angle en radians
 * @param {{ from: number, to: number, width: number, thickness: number }} blade
 */
function addBlade(geometry, axis, angle, blade) {
  const local = createGeometry();
  addBox(
    local,
    [(blade.from + blade.to) / 2, 0, 0],
    [blade.to - blade.from, blade.thickness, blade.width],
  );
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotate = (x, z) => [x * cos + z * sin, -x * sin + z * cos];
  const base = geometry.positions.length / 3;
  for (let i = 0; i < local.positions.length; i += 3) {
    const [x, z] = rotate(local.positions[i], local.positions[i + 2]);
    geometry.positions.push(axis[0] + x, axis[1] + local.positions[i + 1], axis[2] + z);
    const [nx, nz] = rotate(local.normals[i], local.normals[i + 2]);
    geometry.normals.push(nx, local.normals[i + 1], nz);
  }
  geometry.uvs.push(...local.uvs);
  geometry.indices.push(...local.indices.map((index) => base + index));
}

/**
 * Boîte englobante d'un ensemble de géométries (mm).
 * @param {Geometry[]} geometries
 */
function boundsOf(geometries) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const geometry of geometries) {
    for (let i = 0; i < geometry.positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], geometry.positions[i + axis]);
        max[axis] = Math.max(max[axis], geometry.positions[i + axis]);
      }
    }
  }
  return { min, max, center: min.map((value, axis) => (value + max[axis]) / 2) };
}

/**
 * Volumes simplifiés de la box, en millimètres, posée sur le sol (Y = 0) et
 * centrée en X et Z. Chaque pièce liste ses géométries par matériau.
 */
function buildParts() {
  const caseBase = createGeometry();
  addBox(caseBase, [0, 1, 0], [100, 2, 70]);
  addBox(caseBase, [0, 16, 34], [100, 32, 2]);
  addBox(caseBase, [0, 16, -34], [100, 32, 2]);
  addBox(caseBase, [-49, 16, 0], [2, 32, 66]);
  addBox(caseBase, [49, 16, 0], [2, 32, 66]);

  const caseLid = createGeometry();
  addBox(caseLid, [0, 35, 0], [100, 6, 70]);

  // Empilement du modèle dessiné en code : Raspberry Pi en bas, carte M.2
  // au-dessus (décalée du côté opposé aux ports), puis le ventilateur.
  const pcb = createGeometry();
  addBox(pcb, [0, 5.8, 0], [85, 1.6, 56]);
  const ports = createGeometry();
  addBox(ports, [33, 13.6, 9], [19, 14, 16]);
  addBox(ports, [33, 13.6, -9], [19, 14, 16]);
  addBox(ports, [33, 11.6, 22], [19, 10, 8]);
  const led = createGeometry();
  addBox(led, [-38, 7, 24], [2, 0.8, 1.2]);

  const nvmeBoard = createGeometry();
  addBox(nvmeBoard, [-10, 20.4, 0], [65, 1.6, 56]);

  const nvmeSsd = createGeometry();
  addBox(nvmeSsd, [-15, 22.4, 0], [30, 2.4, 22]);

  const fanCenter = [-15, 27.5, 0];
  const fanFrame = createGeometry();
  addBox(fanFrame, [fanCenter[0], fanCenter[1], 18.5], [40, 7, 3]);
  addBox(fanFrame, [fanCenter[0], fanCenter[1], -18.5], [40, 7, 3]);
  addBox(fanFrame, [fanCenter[0] - 18.5, fanCenter[1], 0], [3, 7, 34]);
  addBox(fanFrame, [fanCenter[0] + 18.5, fanCenter[1], 0], [3, 7, 34]);

  const rotor = createGeometry();
  addCylinder(rotor, fanCenter, 7, 6, 24);
  const bladeCount = 7;
  for (let i = 0; i < bladeCount; i += 1) {
    addBlade(rotor, fanCenter, (2 * Math.PI * i) / bladeCount, {
      from: 6.5,
      to: 16.5,
      width: 6,
      thickness: 1,
    });
  }

  const decal = createGeometry();
  addPolygon(decal, [
    { p: [-20, 8, 35.2], n: [0, 0, 1], uv: QUAD_UVS[0] },
    { p: [20, 8, 35.2], n: [0, 0, 1], uv: QUAD_UVS[1] },
    { p: [20, 24, 35.2], n: [0, 0, 1], uv: QUAD_UVS[2] },
    { p: [-20, 24, 35.2], n: [0, 0, 1], uv: QUAD_UVS[3] },
  ]);

  return {
    Case_Base: [{ geometry: caseBase, material: 'boitier' }],
    Case_Lid: [{ geometry: caseLid, material: 'boitier' }],
    NVMe_Board: [{ geometry: nvmeBoard, material: 'noir' }],
    NVMe_SSD: [{ geometry: nvmeSsd, material: 'noirBis' }],
    RPi5_Board: [
      { geometry: pcb, material: 'circuit' },
      { geometry: ports, material: 'metal' },
      { geometry: led, material: 'diode' },
    ],
    Fan: [{ geometry: fanFrame, material: 'noir' }],
    Fan_Rotor: [{ geometry: rotor, material: 'noir' }],
    Logo_Decal: [{ geometry: decal, material: 'logo' }],
  };
}

/**
 * Image du marquage d'essai : un cadre et trois barres couleur chocolat sur
 * fond transparent. Ce n'est pas le logo de HAKO, qui n'est jamais redessiné.
 * @param {number} width
 * @param {number} height
 */
async function createDecalImage(width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  const border = Math.round(height * 0.06);
  const inBar = (x, y) => {
    const left = width * 0.18;
    const right = width * 0.82;
    if (x < left || x > right) return false;
    return [0.3, 0.5, 0.7].some((row) => Math.abs(y - height * row) < height * 0.05);
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const onFrame = x < border || y < border || x >= width - border || y >= height - border;
      if (onFrame || inBar(x, y)) {
        const offset = (y * width + x) * 4;
        pixels[offset] = 0x41;
        pixels[offset + 1] = 0x2d;
        pixels[offset + 2] = 0x1e;
        pixels[offset + 3] = 0xff;
      }
    }
  }
  const png = await sharp(pixels, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return new Uint8Array(png);
}

/** Couleur sRGB #RRGGBB vers les composantes linéaires attendues par glTF. */
function linearColor(hex) {
  const toLinear = (value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return [1, 3, 5].map((start) => toLinear(Number.parseInt(hex.slice(start, start + 2), 16) / 255));
}

/**
 * Matériaux PBR métal/rugosité, comme les exporte un nœud Principled BSDF.
 * « noirBis » est un doublon volontaire (l'optimisation doit le fusionner).
 * @param {Document} document
 * @param {Uint8Array} decalImage
 */
function createMaterials(document, decalImage) {
  const pbr = (name, hex, metallic, roughness) =>
    document
      .createMaterial(name)
      .setBaseColorFactor([...linearColor(hex), 1])
      .setMetallicFactor(metallic)
      .setRoughnessFactor(roughness);
  const texture = document
    .createTexture('Marquage')
    .setImage(decalImage)
    .setMimeType('image/png')
    .setURI('marquage.png');
  return {
    boitier: pbr('Boitier_PLA', '#F2E6D6', 0, 0.8),
    noir: pbr('Noir_Mat', '#1A1A1A', 0, 0.6),
    noirBis: pbr('Noir_Mat.001', '#1A1A1A', 0, 0.6),
    circuit: pbr('Circuit_Vert', '#1F6B45', 0, 0.45),
    metal: pbr('Metal_Brosse', '#C8C8C8', 1, 0.35),
    diode: pbr('Diode', '#0B3D17', 0, 0.3).setEmissiveFactor([0.05, 0.9, 0.2]),
    logo: pbr('Marquage', '#FFFFFF', 0, 0.7)
      .setBaseColorTexture(texture)
      .setAlphaMode('MASK')
      .setAlphaCutoff(0.5),
  };
}

/**
 * Crée un nœud avec son maillage. Les sommets sont exprimés par rapport à
 * `origin` (mm, repère de la scène) puis multipliés par `unit`.
 * @param {Document} document
 * @param {{ name: string, parts: { geometry: Geometry, material: string }[], materials: Record<string, import('@gltf-transform/core').Material>, origin: number[], parentOrigin: number[], unit: number }} options
 */
function createPartNode(document, { name, parts, materials, origin, parentOrigin, unit }) {
  const buffer = document.getRoot().listBuffers()[0];
  const mesh = document.createMesh(name);
  for (const { geometry, material } of parts) {
    const positions = new Float32Array(geometry.positions.length);
    for (let i = 0; i < geometry.positions.length; i += 1) {
      positions[i] = (geometry.positions[i] - origin[i % 3]) * unit;
    }
    const primitive = document
      .createPrimitive()
      .setAttribute(
        'POSITION',
        document.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer),
      )
      .setAttribute(
        'NORMAL',
        document
          .createAccessor()
          .setType('VEC3')
          .setArray(new Float32Array(geometry.normals))
          .setBuffer(buffer),
      )
      .setAttribute(
        'TEXCOORD_0',
        document
          .createAccessor()
          .setType('VEC2')
          .setArray(new Float32Array(geometry.uvs))
          .setBuffer(buffer),
      )
      .setIndices(
        document
          .createAccessor()
          .setType('SCALAR')
          .setArray(new Uint16Array(geometry.indices))
          .setBuffer(buffer),
      )
      .setMaterial(materials[material] ?? null);
    mesh.addPrimitive(primitive);
  }
  return document
    .createNode(name)
    .setMesh(mesh)
    .setTranslation(
      /** @type {Vec3} */ (origin.map((value, axis) => (value - parentOrigin[axis]) * unit)),
    );
}

/**
 * Hiérarchie du modèle, la même que celle du modèle dessiné en code : le
 * rotor suit le ventilateur, le SSD sa carte et le marquage la base.
 */
export const FIXTURE_PARENTS = {
  Fan_Rotor: 'Fan',
  NVMe_SSD: 'NVMe_Board',
  Logo_Decal: 'Case_Base',
};

/**
 * Modèle conforme au contrat.
 * @returns {Promise<Document>}
 */
export async function createGoodDocument() {
  const document = new Document();
  document.getRoot().getAsset().generator = 'HAKO make-test-glb';
  document.createBuffer();
  const scene = document.createScene('HAKO');
  document.getRoot().setDefaultScene(scene);
  const materials = createMaterials(document, await createDecalImage(256, 128));
  const parts = buildParts();
  const origins = Object.fromEntries(
    Object.entries(parts).map(([name, list]) => [
      name,
      boundsOf(list.map((part) => part.geometry)).center,
    ]),
  );
  // Le rotor tourne autour de son moyeu : son origine est sur l'axe.
  origins.Fan_Rotor = [-15, 27.5, 0];

  const nodes = new Map();
  for (const [name, list] of Object.entries(parts)) {
    const parent = FIXTURE_PARENTS[name];
    nodes.set(
      name,
      createPartNode(document, {
        name,
        parts: list,
        materials,
        origin: origins[name],
        parentOrigin: parent ? origins[parent] : [0, 0, 0],
        unit: 0.001,
      }),
    );
  }
  for (const [name, node] of nodes) {
    const parent = FIXTURE_PARENTS[name];
    if (parent) nodes.get(parent).addChild(node);
    else scene.addChild(node);
  }
  return document;
}

/**
 * Modèle volontairement faux : exporté en millimètres, noms erronés ou
 * manquants, doublon, transformation non appliquée, origines décalées
 * (dont celle du rotor), texture trop grande, matériau sans éclairage et
 * lampe incluse.
 * @returns {Promise<Document>}
 */
export async function createBrokenDocument() {
  const document = new Document();
  document.getRoot().getAsset().generator = 'HAKO make-test-glb (modèle faux)';
  document.createBuffer();
  const scene = document.createScene('HAKO');
  document.getRoot().setDefaultScene(scene);
  const materials = createMaterials(document, await createDecalImage(256, 128));
  const parts = buildParts();
  const unit = 1;
  const centerOf = (name) => boundsOf(parts[name].map((part) => part.geometry)).center;
  const add = (nodeName, partName, origin = centerOf(partName), parentOrigin = [0, 0, 0]) =>
    createPartNode(document, {
      name: nodeName,
      parts: parts[partName],
      materials,
      origin,
      parentOrigin,
      unit,
    });

  // Origine laissée dans un coin, comme après un import depuis un logiciel de CAO.
  const caseBase = add('Case_Base', 'Case_Base', [-50, 0, -35]);
  caseBase.addChild(add('Logo_Decal', 'Logo_Decal', centerOf('Logo_Decal'), [-50, 0, -35]));
  scene.addChild(caseBase);
  scene.addChild(add('case_lid', 'Case_Lid'));
  // Origine du rotor laissée dans un coin du ventilateur : il tournerait de travers.
  const fan = add('Fan.001', 'Fan');
  fan.addChild(add('Fan_Rotor', 'Fan_Rotor', [-28, 27.5, -12], centerOf('Fan')));
  scene.addChild(fan);
  scene.addChild(add('RPi5_Board', 'RPi5_Board'));
  scene.addChild(add('RPi5_Board', 'RPi5_Board'));
  scene.addChild(add('NVMe_Board', 'NVMe_Board').setScale([1, 1, 2]));

  // Un objet en trop, avec une texture de 4096 px et un matériau sans éclairage.
  const bigTexture = await sharp({
    create: { width: 4096, height: 4096, channels: 3, background: { r: 230, g: 213, b: 191 } },
  })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  const unlit = document.createExtension(KHRMaterialsUnlit);
  const flat = document
    .createMaterial('Sans_Eclairage')
    .setBaseColorTexture(
      document
        .createTexture('Trop_Grande')
        .setImage(new Uint8Array(bigTexture))
        .setMimeType('image/png')
        .setURI('trop-grande.png'),
    )
    .setExtension('KHR_materials_unlit', unlit.createUnlit());
  const cubeGeometry = createGeometry();
  addBox(cubeGeometry, [80, 10, 0], [20, 20, 20]);
  const cube = createPartNode(document, {
    name: 'Cube',
    parts: [{ geometry: cubeGeometry, material: 'flat' }],
    materials: { ...materials, flat },
    origin: [80, 10, 0],
    parentOrigin: [0, 0, 0],
    unit,
  });
  scene.addChild(cube);

  const lights = document.createExtension(KHRLightsPunctual);
  scene.addChild(
    document
      .createNode('Lampe')
      .setTranslation([0, 200, 0])
      .setExtension(
        'KHR_lights_punctual',
        lights.createLight('Lampe').setType('point').setIntensity(50),
      ),
  );
  return document;
}

/**
 * Contenu .glb d'un document, octet pour octet celui qu'écrit writeGlb.
 * @param {Document} document
 * @returns {Promise<Uint8Array>}
 */
export async function toGlbBytes(document) {
  const io = new NodeIO().registerExtensions([KHRLightsPunctual, KHRMaterialsUnlit]);
  return io.writeBinary(document);
}

/**
 * Écrit un document en .glb et renvoie son poids en octets.
 * @param {Document} document
 * @param {string} target
 */
export async function writeGlb(document, target) {
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, await toGlbBytes(document));
  return statSync(target).size;
}

async function main() {
  const formatKb = (bytes) => `${(bytes / 1024).toFixed(1).replace('.', ',')} Ko`;
  const goodBytes = await writeGlb(await createGoodDocument(), GOOD_FIXTURE);
  console.log(`${path.relative(repoRoot, GOOD_FIXTURE)} : ${formatKb(goodBytes)} (conforme).`);
  const brokenBytes = await writeGlb(await createBrokenDocument(), BROKEN_FIXTURE);
  console.log(
    `${path.relative(repoRoot, BROKEN_FIXTURE)} : ${formatKb(brokenBytes)} (erreurs volontaires).`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
