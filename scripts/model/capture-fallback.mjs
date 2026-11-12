#!/usr/bin/env node
/**
 * Images fixes PROVISOIRES de la scène 3D de l'accueil, rendues depuis la
 * scène elle-même :
 *   public/images/vue-eclatee-provisoire.webp      (800 × 800)
 *   public/images/vue-eclatee-provisoire@2x.webp   (1600 × 1600)
 *     la vue éclatée, affichée quand la 3D ne peut pas l'être (animations
 *     réduites, pas de WebGL, appareil modeste) ;
 *   public/images/box-fermee-provisoire.webp       (960 × 768)
 *   public/images/box-fermee-provisoire@2x.webp    (1600 × 1280)
 *     la box fermée, cadrée exactement comme au début de la piste : l'image
 *     d'attente de la scène, le temps que three.js arrive.
 * Chaque fichier doit peser 120 Ko au plus.
 *
 * Le script ouvre le site construit dans Chromium (rendu WebGL logiciel
 * SwiftShader, identique sur toutes les machines), fait défiler la section
 * jusqu'à chaque état, photographie la scène sans les étiquettes et recadre
 * sur fond crème.
 *
 * Utilisation, après une construction du site :
 *   npx astro build --outDir .tmp/dist
 *   node scripts/model/capture-fallback.mjs --dist .tmp/dist
 * ou sur un serveur déjà lancé :
 *   node scripts/model/capture-fallback.mjs --url http://localhost:4321/
 * Options : --port <n> (port du serveur temporaire, libre par défaut).
 *
 * À relancer après tout changement du modèle (hako.glb) ou de
 * src/data/model.config.json, puis reconstruire le site.
 */
// Les fonctions passées à page.evaluate s'exécutent dans le navigateur.
/* global document, window, getComputedStyle */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CREME = '#FDF7EF';
const MAX_BYTES = 120 * 1024;
const EXPLODED_OUTPUTS = [
  { file: 'public/images/vue-eclatee-provisoire.webp', width: 800, height: 800 },
  { file: 'public/images/vue-eclatee-provisoire@2x.webp', width: 1600, height: 1600 },
];
/**
 * Image d'attente : rectangle 5:4 centré sur la scène, haut de 80 % de la
 * scène. BoxScene.astro l'affiche à block-size: min(80cqh, 88cqw) : la box
 * de l'image tombe alors à la place de la box en 3D.
 */
const POSTER_SHARE = 0.8;
const POSTER_RATIO = 5 / 4;
const POSTER_OUTPUTS = [
  { file: 'public/images/box-fermee-provisoire.webp', width: 960, height: 768 },
  { file: 'public/images/box-fermee-provisoire@2x.webp', width: 1600, height: 1280 },
];

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

/** Milieu du palier « vue éclatée » de la piste explode (valeur 1). */
function explodedProgress() {
  const config = JSON.parse(readFileSync(path.join(root, 'src/data/model.config.json'), 'utf8'));
  const keys = config.timeline.explode;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (keys[i].value >= 1 && keys[i + 1].value >= 1) return (keys[i].at + keys[i + 1].at) / 2;
  }
  return 0.64;
}

/** Un port libre de la machine. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(String(port)));
    });
  });
}

/** Attend que le serveur réponde avec une page qui contient bien la scène 3D. */
async function waitForSite(url, child, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Le serveur de prévisualisation s'est arrêté (code ${child.exitCode}).`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        if ((await response.text()).includes('data-box-scene')) return;
        throw new Error(`${url} répond, mais sans la scène 3D : est-ce bien ce site ?`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('scène 3D')) throw error;
      // le serveur démarre encore
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Le serveur ne répond pas : ${url}`);
}

async function startPreview() {
  const dist = path.resolve(root, option('dist', 'dist'));
  if (!existsSync(path.join(dist, 'index.html'))) {
    throw new Error(`Site construit introuvable dans ${dist} : lancez d'abord la construction.`);
  }
  const port = option('port', null) ?? (await freePort());
  // --ignore-lock : un serveur ponctuel, au premier plan, même si un autre
  // serveur de prévisualisation tourne déjà pour ce projet.
  const server = spawn(
    path.join(root, 'node_modules', '.bin', 'astro'),
    ['preview', '--outDir', dist, '--port', port, '--ignore-lock'],
    { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] },
  );
  const url = `http://localhost:${port}/`;
  const stop = () => {
    if (server.exitCode === null) server.kill('SIGTERM');
  };
  try {
    await waitForSite(url, server);
  } catch (error) {
    stop();
    throw error;
  }
  return { url, stop };
}

async function scrollToProgress(page, progress) {
  await page.evaluate((p) => {
    const track = document.querySelector('[data-box-scene-track]');
    const stage = document.querySelector('[data-box-scene-stage]');
    const top = track.getBoundingClientRect().top + window.scrollY;
    const sticky = parseFloat(getComputedStyle(stage).top) || 0;
    const y = top - sticky + p * (track.offsetHeight - stage.offsetHeight);
    window.scrollTo({ top: y, behavior: 'instant' });
  }, progress);
  await page.waitForSelector('[data-box-scene][data-state="ready"]', { timeout: 60_000 });
  await page.waitForFunction(
    (p) => {
      const section = document.querySelector('[data-box-scene]');
      return (
        section?.dataset.settled === 'true' && Math.abs(Number(section.dataset.progress) - p) < 0.01
      );
    },
    progress,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(400);
}

async function capture(url) {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 1000 },
      deviceScaleFactor: 2,
    });
    await page.goto(url);
    await page.waitForSelector('[data-box-scene][data-mode="3d"]', { timeout: 15_000 });
    // Ni étiquettes ni ancienne image d'attente sur la photo ; pas de fondu.
    await page.addStyleTag({
      content:
        '.box-scene__labels, .box-scene__poster { display: none !important; }' +
        ' .box-scene__canvas { transition: none !important; }',
    });
    const stage = page.locator('[data-box-scene-stage]');
    await scrollToProgress(page, 0);
    const poster = await stage.screenshot();
    await scrollToProgress(page, explodedProgress());
    const exploded = await stage.screenshot();
    return { poster, exploded };
  } finally {
    await browser.close();
  }
}

async function writeWebp(source, output) {
  let quality = 86;
  let data;
  do {
    data = await sharp(source)
      .resize(output.width, output.height, { kernel: 'lanczos3' })
      .webp({ quality, effort: 6, smartSubsample: true })
      .toBuffer();
    quality -= 4;
  } while (data.length > MAX_BYTES && quality >= 50);
  if (data.length > MAX_BYTES) throw new Error(`${output.file} dépasse 120 Ko.`);
  writeFileSync(path.join(root, output.file), data);
  console.log(
    `${output.file} : ${output.width} × ${output.height}, ${(data.length / 1024).toFixed(1)} Ko`,
  );
}

async function writeExploded(png) {
  // Recadrage sur le dessin (ombre comprise), puis carré centré avec une marge.
  const trimmed = await sharp(png).trim({ background: CREME, threshold: 3 }).toBuffer();
  const { width = 1, height = 1 } = await sharp(trimmed).metadata();
  const side = Math.round(Math.max(width, height) * 1.12);
  const square = await sharp(trimmed)
    .extend({
      top: Math.floor((side - height) / 2),
      bottom: Math.ceil((side - height) / 2),
      left: Math.floor((side - width) / 2),
      right: Math.ceil((side - width) / 2),
      background: CREME,
    })
    .flatten({ background: CREME })
    .toBuffer();
  for (const output of EXPLODED_OUTPUTS) await writeWebp(square, output);
}

async function writePoster(png) {
  // Rectangle fixe centré sur la scène (pas de recadrage sur le dessin) : la
  // box garde sa place exacte par rapport au centre de la scène.
  const { width = 1, height = 1 } = await sharp(png).metadata();
  const cropHeight = Math.round(height * POSTER_SHARE);
  const cropWidth = Math.round(cropHeight * POSTER_RATIO);
  if (cropWidth > width) throw new Error('Scène trop étroite pour l’image d’attente.');
  const framed = await sharp(png)
    .extract({
      left: Math.round((width - cropWidth) / 2),
      top: Math.round((height - cropHeight) / 2),
      width: cropWidth,
      height: cropHeight,
    })
    .flatten({ background: CREME })
    .toBuffer();
  for (const output of POSTER_OUTPUTS) await writeWebp(framed, output);
}

const external = option('url', null);
const server = external ? { url: external, stop: () => {} } : await startPreview();
try {
  const { poster, exploded } = await capture(server.url);
  await writeExploded(exploded);
  await writePoster(poster);
} finally {
  server.stop();
}
