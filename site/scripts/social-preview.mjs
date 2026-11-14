/**
 * Image de partage du dépôt sur GitHub (Settings → General → Social preview) :
 * .github/assets/social-preview.png, 1280 × 640 px.
 *
 *   npm run social-preview
 *
 * Une petite page HTML aux couleurs de la charte (crème, chocolat, terre), avec
 * le logo, « HAKO 箱 » et l'accroche, photographiée par le Chromium de
 * Playwright. Les polices et le logo viennent de public/ ; le kanji du titre
 * s'affiche avec une police japonaise installée sur la machine (macOS :
 * Hiragino). Rien n'est chargé d'internet.
 */

import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

import { repoRoot } from './lib/files.mjs';

const LARGEUR = 1280;
const HAUTEUR = 640;
const SORTIE = path.resolve(repoRoot, '..', '.github', 'assets', 'social-preview.png');

/** Police en adresse data:, pour une page sans aucun fichier externe. */
const police = (fichier) =>
  `data:font/woff2;base64,${readFileSync(path.join(repoRoot, 'public', 'fonts', fichier)).toString('base64')}`;

const logo = readFileSync(path.join(repoRoot, 'public', 'brand', 'hako-carre.svg'), 'utf8');

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'Fraunces'; font-weight: 100 900; src: url('${police('fraunces/fraunces-1.003-latin-fr-a093887f.woff2')}') format('woff2'); }
  @font-face { font-family: 'Atkinson'; font-weight: 200 800; src: url('${police('atkinson-hyperlegible-next/atkinson-hyperlegible-next-2.001-latin-fr-9c6e8230.woff2')}') format('woff2'); }
  @font-face { font-family: 'D-DIN'; font-weight: 700; src: url('${police('d-din/d-din-1.00-bold-90072887.woff2')}') format('woff2'); }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${LARGEUR}px; height: ${HAUTEUR}px; }
  body {
    display: flex; align-items: center; gap: 72px; padding: 0 96px;
    background: #fdf7ef; color: #412d1e; font-family: 'Atkinson', sans-serif;
    border-bottom: 24px solid #9a4e2b;
  }
  .logo { flex: none; width: 300px; padding: 40px; background: #f2e6d6; border-radius: 32px; }
  .logo svg { display: block; width: 100%; height: auto; }
  h1 { font-family: 'Fraunces', serif; font-weight: 700; font-size: 112px; line-height: 1; letter-spacing: -0.01em; }
  h1 span { font-family: 'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif CJK JP', serif; font-weight: 600; margin-left: 0.2em; }
  p.accroche { margin-top: 28px; font-size: 44px; font-weight: 700; line-height: 1.2; color: #412d1e; }
  p.details { margin-top: 28px; font-size: 27px; line-height: 1.35; color: #5f3e27; }
  p.adresse { margin-top: 32px; font-family: 'D-DIN', sans-serif; font-weight: 700; font-size: 26px; letter-spacing: 0.04em; color: #9a4e2b; }
</style>
</head>
<body>
  <div class="logo">${logo}</div>
  <div>
    <h1>HAKO<span lang="ja">箱</span></h1>
    <p class="accroche">Vos souvenirs restent à la maison.</p>
    <p class="details">La box qui garde les photos et les fichiers<br>de la famille chez elle, avec Immich et Nextcloud.</p>
    <p class="adresse">antoninche.github.io/hako</p>
  </div>
</body>
</html>`;

const navigateur = await chromium.launch();
try {
  const page = await navigateur.newPage({
    viewport: { width: LARGEUR, height: HAUTEUR },
    deviceScaleFactor: 1,
  });
  // Aucune requête ne doit quitter la page.
  await page.route('**/*', (route) =>
    route.request().url().startsWith('data:') ? route.continue() : route.abort(),
  );
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate('document.fonts.ready.then(() => true)');
  await mkdir(path.dirname(SORTIE), { recursive: true });
  await page.screenshot({ path: SORTIE, type: 'png' });
  console.log(`Image de partage : ${path.relative(path.resolve(repoRoot, '..'), SORTIE)}`);
} finally {
  await navigateur.close();
}
