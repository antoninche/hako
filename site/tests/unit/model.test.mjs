/**
 * Tests des outils du modèle 3D : npm run model:check, npm run model:optimize
 * et du contrat (src/scripts/scene-3d/contract.ts).
 *
 * Lancement : node --test tests/unit/
 * Les modèles d'essai se régénèrent avec npm run model:test-glb.
 */

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';

import sharp from 'sharp';
import { Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

import {
  checkBytes,
  checkDocument,
  checkFile,
  checkModelConfig,
  countErrors,
  createIO,
  formatReport,
  main as checkMain,
  readGlbJson,
  readModelConfig,
  suggestNodeName,
} from '../../scripts/model/check.mjs';
import {
  BROKEN_FIXTURE,
  GOOD_FIXTURE,
  createBrokenDocument,
  createGoodDocument,
  toGlbBytes,
} from '../../scripts/model/make-test-glb.mjs';
import {
  MIN_PSNR,
  main as optimizeMain,
  measurePsnr,
  optimizeDocument,
} from '../../scripts/model/optimize.mjs';
import {
  ALL_NODES,
  MODEL_LIMITS,
  REQUIRED_NODES,
  compareNodeNames,
} from '../../src/scripts/scene-3d/contract.ts';

const scratch = mkdtempSync(path.join(tmpdir(), 'hako-model-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const silent = () => {};

/** Réglages minimaux au format de src/data/model.config.json. */
function motionConfig(overrides = {}) {
  const motion = (y) => ({ offset: [0, y, 0], delay: 0.1, duration: 0.6, ease: 'inOutCubic' });
  return {
    order: ['Case_Lid', 'Fan'],
    labels: { Case_Lid: { title: 'Couvercle' }, Fan: { title: 'Ventilateur' } },
    parts: {
      Case_Lid: motion(0.1),
      Fan: motion(0.08),
      Fan_Rotor: motion(0.08),
      NVMe_Board: motion(0.06),
      NVMe_SSD: motion(0.07),
      RPi5_Board: motion(0.04),
      Case_Base: { offset: [0, 0, 0], delay: 0, duration: 1, ease: 'linear' },
      ...overrides,
    },
    rotor: { axis: 'y', turnsPerSecond: 0.45 },
  };
}

function messages(result, level = 'error') {
  return result.findings
    .filter((finding) => finding.level === level)
    .map((finding) => `${finding.message} ${finding.hint ?? ''}`);
}

function findingCodes(result, level) {
  return result.findings.filter((finding) => finding.level === level).map((f) => f.code);
}

/**
 * PSNR calculé ici, indépendamment de optimize.mjs : couleurs pondérées par
 * l'opacité (ce qui se voit), et transparence ; le plus faible des deux.
 */
function visiblePsnr(got, expected) {
  let colour = 0;
  let alpha = 0;
  for (let i = 0; i < expected.length; i += 4) {
    alpha += (got[i + 3] - expected[i + 3]) ** 2;
    for (let c = 0; c < 3; c += 1) {
      colour += ((got[i + c] * got[i + 3] - expected[i + c] * expected[i + 3]) / 255) ** 2;
    }
  }
  const pixels = expected.length / 4;
  const psnr = (sum, samples) =>
    sum === 0 ? Infinity : 10 * Math.log10((255 * 255) / (sum / samples));
  return Math.min(psnr(colour, pixels * 3), psnr(alpha, pixels));
}

function assertMessage(result, pattern, level = 'error') {
  const list = messages(result, level);
  assert.ok(
    list.some((text) => pattern.test(text)),
    `Message attendu (${level}) : ${pattern}\nReçus :\n${list.join('\n')}`,
  );
}

/** Contrôle d'un document en mémoire (écrit puis relu, comme un vrai fichier). */
async function checkInMemory(document, options = {}) {
  const io = await createIO();
  const bytes = await io.writeBinary(document);
  return checkBytes(bytes, { io, config: null, ...options });
}

/**
 * Charge un .glb avec le GLTFLoader de three.js, comme le site, et son
 * décodeur meshopt pour les fichiers produits avec --meshopt. Hors navigateur, les images sont seulement mesurées.
 */
async function loadWithThree(bytes) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.register((parser) => {
    parser.loadImageSource = async (sourceIndex) => {
      const image = parser.json.images[sourceIndex];
      const buffer = await parser.getDependency('bufferView', image.bufferView);
      const meta = await sharp(Buffer.from(buffer)).metadata();
      const texture = new Texture({ width: meta.width, height: meta.height });
      texture.userData.format = meta.format;
      return texture;
    };
    return { name: 'node_images' };
  });
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return loader.parseAsync(data, '');
}

describe('contrat du modèle', () => {
  test('compareNodeNames repère les absents, les doublons et les inconnus', () => {
    const report = compareNodeNames(['Case_Base', 'Fan', 'Fan', 'Cube', '', 'Fan_Rotor']);
    assert.deepEqual(report.missing, ['Case_Lid', 'NVMe_Board', 'NVMe_SSD', 'RPi5_Board']);
    assert.deepEqual(report.missingOptional, ['Logo_Decal']);
    assert.deepEqual(report.duplicated, ['Fan']);
    assert.deepEqual(report.unknown, ['Cube']);
  });

  test('un modèle complet ne manque de rien', () => {
    const report = compareNodeNames(ALL_NODES);
    assert.deepEqual(report, { missing: [], missingOptional: [], duplicated: [], unknown: [] });
  });

  test('les noms approchants sont reconnus', () => {
    assert.equal(suggestNodeName('case_lid'), 'Case_Lid');
    assert.equal(suggestNodeName('Fan.001'), 'Fan');
    assert.equal(suggestNodeName('Couvercle'), 'Case_Lid');
    assert.equal(suggestNodeName('Hélice'), 'Fan_Rotor');
    assert.equal(suggestNodeName('Raspberry Pi 5'), 'RPi5_Board');
    assert.equal(suggestNodeName('Cube'), null);
  });
});

describe('npm run model:check', () => {
  test('le modèle d’essai conforme passe, avec les réglages du dépôt', async () => {
    const result = await checkFile(GOOD_FIXTURE);
    const report = formatReport(result).join('\n');
    assert.equal(countErrors(result.findings), 0, report);
    assert.deepEqual(result.summary.present, [...ALL_NODES]);
    assert.ok(statSync(GOOD_FIXTURE).size < 200 * 1024, 'le modèle d’essai doit rester léger');
    const size = result.summary.sizeMetres;
    assert.ok(size && Math.max(...size) > 0.03 && Math.max(...size) < 0.5);
    // Le générateur affiché est celui du fichier, pas celui de la bibliothèque de lecture.
    assert.equal(result.summary.generator, 'HAKO make-test-glb');
  });

  test('le modèle faux échoue, avec un message clair pour chaque défaut', async () => {
    const result = await checkFile(BROKEN_FIXTURE, { config: null });
    assert.ok(countErrors(result.findings) >= 10, formatReport(result).join('\n'));
    assertMessage(result, /« Case_Lid » est absent : c’est sans doute l’objet « case_lid »/);
    assertMessage(result, /« Fan » est absent : c’est sans doute l’objet « Fan\.001 »/);
    assertMessage(result, /« NVMe_SSD » est absent : c’est une pièce obligatoire/);
    assertMessage(result, /« RPi5_Board » est porté par 2 objets/);
    assertMessage(result, /« Cube » ne fait pas partie du contrat/);
    assertMessage(result, /140 m dans sa plus grande dimension.*exporté en millimètres/);
    assertMessage(result, /« NVMe_Board » a une échelle de 1 × 1 × 2/);
    assertMessage(result, /L’origine de « Fan_Rotor » est à .* du centre de ses pales/);
    assertMessage(result, /« Sans_Eclairage » est « sans éclairage » \(KHR_materials_unlit\)/);
    assertMessage(result, /« Trop_Grande » mesure 4096 × 4096 px \(limite : 2048 px\)/);
    assertMessage(result, /1 lampe \(« Lampe »\)/);
    assertMessage(result, /L’origine de « Case_Base » est à/, 'warning');
  });

  test('avant optimisation (--source), textures et lampes ne bloquent pas', async () => {
    const result = await checkFile(BROKEN_FIXTURE, { config: null, stage: 'source' });
    const codes = result.findings.filter((f) => f.level === 'error').map((f) => f.code);
    assert.ok(!codes.includes('texture-size') && !codes.includes('lights'));
    assert.ok(codes.includes('node-missing'));
  });

  test('au-delà de 100 000 triangles, le contrôle échoue', async () => {
    const document = await createGoodDocument();
    const primitive = document.getRoot().listMeshes()[0].listPrimitives()[0];
    const count = (MODEL_LIMITS.maxTriangles + 1) * 3;
    const indices = new Uint32Array(count).map((_, i) => i % 3);
    primitive.getIndices().setArray(indices);
    const result = await checkInMemory(document);
    // Les nombres sont écrits à la française, avec une espace fine insécable.
    assertMessage(result, /100\s323 triangles \(limite : 100\s000\).*« Case_Base » 100\s001/);
  });

  test('un modèle réduit deux fois est signalé', async () => {
    const document = await createGoodDocument();
    for (const accessor of document.getRoot().listAccessors()) {
      if (accessor.getType() !== 'VEC3') continue;
      const isPosition = accessor
        .listParents()
        .some((parent) => parent.getAttribute?.('POSITION') === accessor);
      if (isPosition) accessor.setArray(accessor.getArray().map((value) => value * 0.001));
    }
    for (const node of document.getRoot().listNodes()) {
      node.setTranslation(node.getTranslation().map((value) => value * 0.001));
    }
    const result = await checkInMemory(document);
    assertMessage(result, /ne mesure que 0,1 mm/);
  });

  test('un modèle couché (export sans +Y Up) est signalé', async () => {
    const document = await createGoodDocument();
    const scene = document.getRoot().listScenes()[0];
    const holder = document.createNode('Export').setRotation([-Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
    for (const child of scene.listChildren()) holder.addChild(child);
    scene.addChild(holder);
    const result = await checkInMemory(document);
    assertMessage(result, /le modèle semble couché/, 'warning');
    // Le support « Export » est un simple groupe : aucune erreur.
    assert.deepEqual(messages(result, 'error'), [], formatReport(result).join('\n'));
  });

  test('un objet vide qui regroupe les pièces est accepté', async () => {
    for (const [name, dropDecal] of [
      ['Boite', false],
      // « HAKO » n'est pas pris pour le marquage absent.
      ['HAKO', true],
    ]) {
      const document = await createGoodDocument();
      const root = document.getRoot();
      if (dropDecal)
        root
          .listNodes()
          .find((node) => node.getName() === 'Logo_Decal')
          ?.dispose();
      const scene = root.listScenes()[0];
      const group = document.createNode(name);
      for (const child of scene.listChildren()) group.addChild(child);
      scene.addChild(group);
      const result = await checkInMemory(document);
      assert.deepEqual(messages(result, 'error'), [], formatReport(result).join('\n'));
      assert.ok(
        findingCodes(result, 'info').includes('node-group'),
        formatReport(result).join('\n'),
      );
    }
  });

  test('dans un groupe, un objet hors contrat reste signalé', async () => {
    const document = await createGoodDocument();
    const root = document.getRoot();
    const scene = root.listScenes()[0];
    const group = document.createNode('Boite');
    for (const child of scene.listChildren()) group.addChild(child);
    const lid = root.listNodes().find((node) => node.getName() === 'Case_Lid');
    group.addChild(document.createNode('Vis').setMesh(lid?.getMesh() ?? null));
    scene.addChild(group);
    const result = await checkInMemory(document);
    assertMessage(result, /« Vis » ne fait pas partie du contrat : il resterait immobile/);
    assert.ok(findingCodes(result, 'info').includes('node-group'));
  });

  test('un maillage hors contrat qui porte les pièces est une erreur', async () => {
    const document = await createGoodDocument();
    const root = document.getRoot();
    const scene = root.listScenes()[0];
    const base = root.listNodes().find((node) => node.getName() === 'Case_Base');
    const holder = document.createNode('Socle_Bois').setMesh(base?.getMesh() ?? null);
    for (const child of scene.listChildren()) holder.addChild(child);
    scene.addChild(holder);
    const result = await checkInMemory(document);
    assertMessage(
      result,
      /« Socle_Bois » ne fait pas partie du contrat : sa géométrie resterait immobile/,
    );
  });

  test('un mauvais axe de rotor est signalé', async () => {
    const result = await checkFile(GOOD_FIXTURE, {
      config: { ...motionConfig(), rotor: { axis: 'x', turnsPerSecond: 0.45 } },
    });
    assertMessage(result, /Le rotor n’est pas rond vu le long de l’axe x/, 'warning');
  });

  test('le rotor et le marquage doivent suivre leur pièce', async () => {
    const ok = await checkFile(GOOD_FIXTURE, { config: motionConfig() });
    assert.equal(messages(ok, 'warning').filter((text) => /ne bougera pas/.test(text)).length, 0);
    const result = await checkFile(GOOD_FIXTURE, {
      config: motionConfig({
        Fan_Rotor: { offset: [0, 0.03, 0], delay: 0.1, duration: 0.6, ease: 'inOutCubic' },
        Logo_Decal: { offset: [0, 0.05, 0], delay: 0, duration: 1, ease: 'linear' },
      }),
    });
    assertMessage(result, /« Fan_Rotor » ne bougera pas avec « Fan »/, 'warning');
    assertMessage(result, /« Logo_Decal »\) ne bougera pas avec « Case_Base »/, 'warning');
  });

  test('model.config.json : une clé inconnue est une erreur, avec une suggestion', () => {
    const findings = checkModelConfig({
      order: ['Case_Lid', 'Ventilateur'],
      labels: { case_lid: { title: 'Couvercle' } },
      parts: { Case_Lid: {} },
      rotor: { axis: 'w' },
    });
    const errors = findings.filter((finding) => finding.level === 'error');
    assert.equal(errors.length, 3);
    assert.ok(errors.some((f) => /order\[1\]/.test(f.message) && /« Fan »/.test(f.hint ?? '')));
    assert.ok(
      errors.some((f) => /labels\.case_lid/.test(f.message) && /« Case_Lid »/.test(f.hint ?? '')),
    );
    assert.ok(errors.some((f) => f.code === 'config-rotor-axis'));
  });

  test('les réglages du dépôt respectent le contrat', () => {
    const config = readModelConfig();
    if (!config) return;
    assert.ok('data' in config, 'model.config.json doit être un JSON valide');
    const errors = checkModelConfig(config.data).filter((finding) => finding.level === 'error');
    assert.deepEqual(errors, []);
  });

  test('un .gltf texte et un fichier quelconque sont refusés', () => {
    const gltf = readGlbJson(new TextEncoder().encode('{"asset":{"version":"2.0"}}'));
    assert.ok('problem' in gltf && /\.gltf \(texte\)/.test(gltf.problem));
    const other = readGlbJson(new TextEncoder().encode('bonjour, ceci n’est pas un modèle'));
    assert.ok('problem' in other);
  });

  test('ligne de commande : sans modèle par défaut, le modèle dessiné en code est utilisé', async () => {
    const lines = [];
    const code = await checkMain([], { root: scratch, log: (line) => lines.push(line) });
    assert.equal(code, 0);
    assert.match(lines.join('\n'), /le site affiche le modèle dessiné en code/);
  });

  test('ligne de commande : fichier introuvable, option inconnue', async () => {
    assert.equal(await checkMain([path.join(scratch, 'absent.glb')], { log: silent }), 1);
    assert.equal(await checkMain(['--vite'], { log: silent }), 2);
    assert.equal(await checkMain([BROKEN_FIXTURE], { log: silent }), 1);
  });
});

describe('npm run model:optimize', () => {
  // Sorties partagées par plusieurs tests : produites une fois, avant eux.
  const output = path.join(scratch, 'optimise', 'hako.glb');
  const meshoptOutput = path.join(scratch, 'optimise', 'hako-meshopt.glb');
  const exitCodes = {};
  before(async () => {
    exitCodes.default = await optimizeMain([GOOD_FIXTURE, output], { log: silent, config: null });
    exitCodes.meshopt = await optimizeMain([GOOD_FIXTURE, meshoptOutput, '--meshopt'], {
      log: silent,
      config: null,
    });
  });

  test('par défaut : sortie plus légère, conforme, quantifiée, lisible sans décodeur', async () => {
    assert.equal(exitCodes.default, 0);
    const before = statSync(GOOD_FIXTURE).size;
    const afterBytes = readFileSync(output);
    assert.ok(afterBytes.byteLength < before, `${afterBytes.byteLength} ≥ ${before}`);
    const header = readGlbJson(new Uint8Array(afterBytes));
    assert.ok('json' in header);
    assert.ok(!(header.json.extensionsUsed ?? []).includes('EXT_meshopt_compression'));
    assert.ok(header.json.extensionsRequired.includes('KHR_mesh_quantization'));
    const result = await checkFile(output, { config: null });
    assert.equal(countErrors(result.findings), 0, formatReport(result).join('\n'));
    assert.deepEqual(result.summary.present, [...ALL_NODES]);
    // Ni « pas optimisé », ni avertissement sur la CSP.
    assert.deepEqual(messages(result, 'warning'), [], formatReport(result).join('\n'));
  });

  test('--meshopt : encore plus légère, et la CSP à adapter est signalée', async () => {
    assert.equal(exitCodes.meshopt, 0);
    const bytes = readFileSync(meshoptOutput);
    assert.ok(bytes.byteLength < statSync(output).size);
    const header = readGlbJson(new Uint8Array(bytes));
    assert.ok('json' in header);
    assert.ok(header.json.extensionsRequired.includes('EXT_meshopt_compression'));
    assert.ok(header.json.extensionsRequired.includes('KHR_mesh_quantization'));
    const result = await checkFile(meshoptOutput, { config: null });
    assert.equal(countErrors(result.findings), 0, formatReport(result).join('\n'));
    assert.deepEqual(result.summary.present, [...ALL_NODES]);
    assertMessage(result, /compressé avec meshopt.*default-src 'self'/, 'warning');
    assert.ok(!result.findings.some((finding) => finding.code === 'not-optimized'));
  });

  test('three.js (GLTFLoader et décodeur meshopt) relit les deux sorties à l’identique', async () => {
    const source = await loadWithThree(readFileSync(GOOD_FIXTURE));
    for (const file of [output, meshoptOutput]) {
      const optimised = await loadWithThree(readFileSync(file));
      const label = path.basename(file);
      let triangles = 0;
      optimised.scene.traverse((object) => {
        if (object.isMesh) triangles += object.geometry.index.count / 3;
      });
      assert.equal(triangles, 382, label);
      for (const name of ALL_NODES) {
        const a = source.scene.getObjectByName(name);
        const b = optimised.scene.getObjectByName(name);
        assert.ok(a && b, `${label} : ${name} introuvable`);
        assert.ok(a.position.distanceTo(b.position) < 1e-6, `${label} : ${name} a bougé`);
        assert.ok(a.quaternion.angleTo(b.quaternion) < 1e-6, `${label} : ${name} a tourné`);
        assert.deepEqual(b.scale.toArray(), [1, 1, 1], `${label} : ${name} a changé d’échelle`);
        assert.equal(b.parent?.name, a.parent?.name, `${label} : ${name} a changé de parent`);
      }
      const decal = optimised.scene.getObjectByName('Logo_Decal');
      let map = null;
      decal?.traverse((object) => {
        if (object.isMesh && object.material.map) map = object.material.map;
      });
      assert.ok(map, `${label} : la texture du marquage doit être conservée`);
    }
  });

  test('un objet vide qui regroupe les pièces ne bloque pas l’optimisation', async () => {
    const document = await createGoodDocument();
    const scene = document.getRoot().listScenes()[0];
    const group = document.createNode('Boite');
    for (const child of scene.listChildren()) group.addChild(child);
    scene.addChild(group);
    const io = await createIO();
    const source = path.join(scratch, 'groupe-source.glb');
    writeFileSync(source, await io.writeBinary(document));
    const target = path.join(scratch, 'groupe.glb');
    assert.equal(await optimizeMain([source, target], { log: silent, config: null }), 0);
    const result = await checkFile(target, { config: null });
    assert.equal(countErrors(result.findings), 0, formatReport(result).join('\n'));
  });

  test('un modèle faux n’est jamais écrit', async () => {
    const target = path.join(scratch, 'jamais.glb');
    const lines = [];
    const code = await optimizeMain([BROKEN_FIXTURE, target], {
      log: (line) => lines.push(line),
      config: null,
    });
    assert.equal(code, 1);
    assert.ok(!existsSync(target));
    assert.match(lines.join('\n'), /Corrigez ces erreurs dans Blender/);
  });

  test('fichier source absent : explication, code 1 ; option inconnue : code 2', async () => {
    const lines = [];
    const code = await optimizeMain([], { root: scratch, log: (line) => lines.push(line) });
    assert.equal(code, 1);
    assert.match(lines.join('\n'), /design\/3d\/hako-source\.glb/);
    assert.equal(await optimizeMain(['--no-meshopt'], { root: scratch, log: silent }), 2);
  });

  test('textures : 2048 px au plus, WebP quand la qualité est préservée', async () => {
    const document = await createGoodDocument();
    const root = document.getRoot();
    // Couleur : un dégradé avec un léger grain, comme une photo, trop grand.
    const width = 3000;
    const height = 1500;
    const pixels = Buffer.alloc(width * height * 3);
    let seed = 7;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const grain = (seed >>> 24) % 9;
        const i = (y * width + x) * 3;
        pixels[i] = 120 + Math.round((x / width) * 100) + grain;
        pixels[i + 1] = 90 + Math.round((y / height) * 80) + grain;
        pixels[i + 2] = 60 + grain;
      }
    }
    const photo = await sharp(pixels, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer();
    // Données : une carte de normales, qui doit rester exacte.
    const normals = await sharp({
      create: { width: 512, height: 512, channels: 3, background: { r: 128, g: 128, b: 255 } },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 256,
              height: 512,
              channels: 3,
              background: { r: 160, g: 128, b: 240 },
            },
          })
            .png()
            .toBuffer(),
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toBuffer();
    const material = root.listMaterials().find((item) => item.getName() === 'Boitier_PLA');
    assert.ok(material);
    material
      .setBaseColorTexture(
        document.createTexture('Photo').setImage(new Uint8Array(photo)).setMimeType('image/png'),
      )
      .setNormalTexture(
        document
          .createTexture('Normales')
          .setImage(new Uint8Array(normals))
          .setMimeType('image/png'),
      );

    const { textures } = await optimizeDocument(document);
    const photoTexture = root.listTextures().find((texture) => texture.getName() === 'Photo');
    const normalTexture = root.listTextures().find((texture) => texture.getName() === 'Normales');
    assert.ok(photoTexture && normalTexture, JSON.stringify(textures));
    assert.equal(photoTexture.getMimeType(), 'image/webp');
    const photoMeta = await sharp(Buffer.from(photoTexture.getImage())).metadata();
    assert.deepEqual([photoMeta.width, photoMeta.height], [2048, 1024]);
    assert.ok(photoTexture.getImage().byteLength < photo.byteLength);

    // Qualité : le WebP comparé à la même image réduite en PNG, sans perte.
    const reference = await sharp(photo)
      .resize(2048, 1024, { fit: 'fill', kernel: 'lanczos3' })
      .raw()
      .toBuffer();
    const decoded = await sharp(Buffer.from(photoTexture.getImage()))
      .removeAlpha()
      .raw()
      .toBuffer();
    let sum = 0;
    for (let i = 0; i < decoded.length; i += 1) sum += (decoded[i] - reference[i]) ** 2;
    const psnr = 10 * Math.log10((255 * 255) / (sum / decoded.length));
    assert.ok(psnr >= MIN_PSNR - 0.5, `PSNR ${psnr.toFixed(1)} dB`);

    // La carte de normales reste identique au pixel près (WebP sans perte ou PNG).
    const original = await sharp(normals).removeAlpha().raw().toBuffer();
    const kept = await sharp(Buffer.from(normalTexture.getImage())).removeAlpha().raw().toBuffer();
    assert.ok(original.equals(kept), 'la carte de normales a été altérée');

    const result = await checkInMemory(document);
    assert.equal(countErrors(result.findings), 0, formatReport(result).join('\n'));
  });

  test('textures : un marquage transparent ne grossit pas', async () => {
    // Marquage d'essai fait de formes simples (pas le logo de HAKO) : aplat
    // chocolat aux bords adoucis sur fond transparent, PNG à palette comme
    // les fichiers du logo, et plus large que 2048 px.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="600">
      <g fill="#412D1E"><circle cx="300" cy="300" r="220"/>
      <rect x="620" y="140" width="1500" height="90" rx="45"/>
      <rect x="620" y="370" width="1100" height="90" rx="45" transform="rotate(-3 1170 415)"/></g>
    </svg>`;
    const source = await sharp(Buffer.from(svg))
      .png({ palette: true, compressionLevel: 9 })
      .toBuffer();
    const document = await createGoodDocument();
    const texture = document
      .getRoot()
      .listTextures()
      .find((item) => item.getName() === 'Marquage');
    assert.ok(texture);
    texture.setImage(new Uint8Array(source)).setMimeType('image/png');
    await optimizeDocument(document);
    const kept = Buffer.from(texture.getImage());
    const meta = await sharp(kept).metadata();
    assert.deepEqual([meta.width, meta.height], [2048, 512]);

    // Pas plus lourd que le même marquage simplement réduit, en PNG à palette.
    const resized = () => sharp(source).resize(2048, 512, { fit: 'fill', kernel: 'lanczos3' });
    const equivalent = await resized().png({ palette: true, compressionLevel: 9 }).toBuffer();
    assert.ok(
      kept.byteLength <= equivalent.byteLength,
      `${kept.byteLength} > ${equivalent.byteLength}`,
    );

    // Et sans différence visible.
    const expected = await resized().ensureAlpha().raw().toBuffer();
    const got = await sharp(kept).ensureAlpha().raw().toBuffer();
    const psnr = visiblePsnr(got, expected);
    assert.ok(psnr >= MIN_PSNR, `PSNR ${psnr.toFixed(1)} dB`);
  });

  test('qualité : une couleur sous un pixel transparent ne compte que si elle ferait un liseré', async () => {
    const width = 64;
    const height = 16;
    /** Moitié gauche chocolat opaque, moitié droite transparente de couleur `under`. */
    const image = (under) => {
      const pixels = Buffer.alloc(width * height * 4);
      for (let i = 0; i < width * height; i += 1) {
        const opaque = i % width < width / 2;
        pixels.set(opaque ? [0x41, 0x2d, 0x1e, 255] : [...under, 0], i * 4);
      }
      return pixels;
    };
    const encode = (pixels) =>
      sharp(pixels, { raw: { width, height, channels: 4 } })
        .png()
        .toBuffer();
    const reference = { data: image([0, 0, 0]), width, height, opaque: false };
    assert.equal(await measurePsnr(await encode(image([0, 0, 0])), reference), Infinity);
    // Sous la transparence, une couleur proche de celle du bord passe ; du blanc ferait un liseré clair.
    assert.ok((await measurePsnr(await encode(image([0x41, 0x2d, 0x1e])), reference)) >= MIN_PSNR);
    assert.ok((await measurePsnr(await encode(image([255, 255, 255])), reference)) < MIN_PSNR);
  });

  test('les pièces obligatoires sont toutes nommées dans la sortie', async () => {
    const io = await createIO();
    const document = await io.read(output);
    const names = document
      .getRoot()
      .listNodes()
      .map((node) => node.getName());
    for (const name of REQUIRED_NODES) assert.ok(names.includes(name), name);
    const result = checkDocument(document, { config: null });
    assert.equal(countErrors(result.findings), 0);
  });
});

// Garde-fou : les modèles d'essai doivent refléter le générateur (npm run model:test-glb).
test('les modèles d’essai sont à jour', async () => {
  for (const [file, create] of [
    [GOOD_FIXTURE, createGoodDocument],
    [BROKEN_FIXTURE, createBrokenDocument],
  ]) {
    const fresh = Buffer.from(await toGlbBytes(await create()));
    assert.ok(
      fresh.equals(readFileSync(file)),
      `tests/fixtures/${path.basename(file)} ne correspond plus au générateur : relancez npm run model:test-glb`,
    );
  }
});
