#!/usr/bin/env node
/**
 * Image d'attente PROVISOIRE de la scène 3D de l'accueil, rendue depuis la
 * scène elle-même :
 *   public/images/box-fermee-provisoire.webp       (960 × 768)
 *   public/images/box-fermee-provisoire@2x.webp    (1600 × 1280)
 * la box fermée, cadrée exactement comme au début de la piste : elle
 * s'affiche le temps que three.js arrive, ou si la 3D tombe en panne pendant
 * que le visiteur regarde la section. Chaque fichier doit peser 120 Ko au
 * plus. (Sans 3D, la section montre le dessin de la vue éclatée,
 * src/assets/illustrations/vue-eclatee.svg : ce script n'y touche pas.)
 *
 * Le script ouvre le site construit dans Chromium (rendu WebGL logiciel
 * SwiftShader, identique sur toutes les machines), fait défiler la section
 * jusqu'au début de la piste, photographie la scène sans les étiquettes,
 * recadre et pose la photo sur le fond de la scène, lu dans la page. Si ce
 * fond change, il suffit donc de relancer le script. --background force une
 * couleur ; --background transparent garde la transparence (ombre comprise),
 * mais les fichiers pèsent alors trois à quatre fois plus.
 *
 * Utilisation, après une construction du site :
 *   npx astro build --outDir .tmp/dist
 *   node scripts/model/capture-fallback.mjs --dist .tmp/dist
 * ou sur un serveur déjà lancé :
 *   node scripts/model/capture-fallback.mjs --url http://localhost:4321/
 * Options : --port <n> (port du serveur temporaire, libre par défaut),
 * --background <#RRGGBB | transparent> (fond de l'image ; par défaut, celui
 * de la scène).
 *
 * À relancer après tout changement du modèle (hako.glb), de
 * src/data/model.config.json ou du fond de la scène, puis reconstruire le
 * site.
 */
// Les fonctions passées à page.evaluate s'exécutent dans le navigateur.
/* global document, window, getComputedStyle */
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAX_BYTES = 120 * 1024;
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
  // « attached » : la section est masquée (visibility) pendant la photo.
  await page.waitForSelector('[data-box-scene][data-state="ready"]', {
    state: 'attached',
    timeout: 60_000,
  });
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
    // Fond de la scène, lu avant de l'effacer pour la photo.
    const background = await page.evaluate(stageBackground);
    // Sur la photo, la scène seule : ni étiquettes, ni ancienne image
    // d'attente, ni bordure de l'en-tête qui déborde sur la scène, ni fond de
    // page (le fond est posé ensuite) ; pas de fondu.
    await page.addStyleTag({
      content:
        '.box-scene__labels, .box-scene__poster { display: none !important; }' +
        ' .box-scene__canvas { transition: none !important; }' +
        ' html, body, body * { background: transparent !important; visibility: hidden !important; }' +
        ' [data-box-scene-canvas], [data-box-scene-canvas] * { visibility: visible !important; }',
    });
    // Le calque du canevas couvre exactement la scène et reste visible.
    const stage = page.locator('[data-box-scene-canvas]');
    await scrollToProgress(page, 0);
    const poster = await stage.screenshot({ omitBackground: true });
    return { poster, background };
  } finally {
    await browser.close();
  }
}

/**
 * Exécuté dans la page : la première couleur de fond opaque en remontant
 * depuis la scène, en #RRGGBB, ou null si elle n'est pas lisible.
 */
function stageBackground() {
  for (
    let node = document.querySelector('[data-box-scene-stage]');
    node;
    node = node.parentElement
  ) {
    const color = getComputedStyle(node).backgroundColor;
    const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(color);
    if (rgb && rgb[4] !== undefined && Number(rgb[4]) === 0) continue;
    if (!rgb || (rgb[4] !== undefined && Number(rgb[4]) < 1)) return null;
    return `#${rgb
      .slice(1, 4)
      .map((value) => Number(value).toString(16).padStart(2, '0'))
      .join('')}`;
  }
  return null;
}

/** Fond forcé (--background), ou celui de la scène. */
const BACKGROUND_OPTION = option('background', null);
if (
  BACKGROUND_OPTION !== null &&
  BACKGROUND_OPTION !== 'transparent' &&
  !/^#[0-9a-f]{6}$/i.test(BACKGROUND_OPTION)
) {
  throw new Error('--background attend une couleur #RRGGBB ou « transparent ».');
}
/** Crème de la marque, si la page ne donne pas de fond lisible. */
const DEFAULT_BACKGROUND = '#FDF7EF';

/** Fond retenu pour l'image : null pour la transparence. */
function backgroundFor(fromPage) {
  if (BACKGROUND_OPTION === 'transparent') return null;
  if (BACKGROUND_OPTION) return BACKGROUND_OPTION;
  if (fromPage) return fromPage;
  console.warn(`Fond de la scène illisible dans la page : ${DEFAULT_BACKGROUND} par défaut.`);
  return DEFAULT_BACKGROUND;
}

async function writeWebp(source, output, background) {
  let quality = 86;
  let data;
  do {
    const resized = sharp(source).resize(output.width, output.height, { kernel: 'lanczos3' });
    data = await (background ? resized.flatten({ background }) : resized)
      .webp({ quality, alphaQuality: 90, effort: 6, smartSubsample: true })
      .toBuffer();
    quality -= 4;
  } while (data.length > MAX_BYTES && quality >= 50);
  if (data.length > MAX_BYTES) throw new Error(`${output.file} dépasse 120 Ko.`);
  writeFileSync(path.join(root, output.file), data);
  console.log(
    `${output.file} : ${output.width} × ${output.height}, ${(data.length / 1024).toFixed(1)} Ko, fond ${background ?? 'transparent'}`,
  );
}

async function writePoster(png, background) {
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
    .toBuffer();
  for (const output of POSTER_OUTPUTS) await writeWebp(framed, output, background);
}

const external = option('url', null);
const server = external ? { url: external, stop: () => {} } : await startPreview();
try {
  const { poster, background } = await capture(server.url);
  await writePoster(poster, backgroundFor(background));
} finally {
  server.stop();
}
