// Rend chaque illustration en PNG (360 px et 1280 px de large, sur fond crème)
// et assemble une planche-contact pour la relecture.
//
// Usage : node scripts/illustrations/render.mjs [dossier] [dossier-de-sortie] [largeurs]
// Par défaut : les dessins de src/assets/illustrations, rendus dans
// design/illustrations/renders/ (ignoré par git). largeurs : liste séparée par
// des virgules (par exemple 88,258,1280), pour voir un dessin à la taille où il
// paraît dans la page (docs/illustrations.md).

import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const CREME = '#FDF7EF';

async function listSvg(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listSvg(full)));
    else if (entry.name.endsWith('.svg')) out.push(full);
  }
  return out.sort();
}

function render(svg, width) {
  const resvg = new Resvg(svg, {
    background: CREME,
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

function escapeXml(s) {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

async function contactSheet(items, file) {
  const cell = 360;
  const caption = 28;
  const gap = 24;
  const cols = 4;
  const rows = Math.ceil(items.length / cols);
  const tiles = [];
  for (const [i, item] of items.entries()) {
    const img = sharp(item.png360);
    const meta = await img.metadata();
    const h = Math.min(meta.height ?? cell, cell);
    const resized = await sharp(item.png360)
      .resize({ width: cell, height: h, fit: 'contain', background: CREME })
      .png()
      .toBuffer();
    const x = gap + (i % cols) * (cell + gap);
    const y = gap + Math.floor(i / cols) * (cell + caption + gap);
    tiles.push({ input: resized, left: x, top: y });
    const label = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${caption}"><text x="0" y="20" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#412D1E">${escapeXml(item.name)}</text></svg>`,
    );
    tiles.push({ input: label, left: x, top: y + cell + 2 });
  }
  const width = gap + cols * (cell + gap);
  const height = gap + rows * (cell + caption + gap);
  await sharp({ create: { width, height, channels: 3, background: CREME } })
    .composite(tiles)
    .png()
    .toFile(file);
}

const setDir = process.argv[2] ?? path.join('src', 'assets', 'illustrations');
const outDir = process.argv[3] ?? path.join('design', 'illustrations', 'renders');
const widths = process.argv[4]
  ? process.argv[4].split(',').map((w) => Number.parseInt(w, 10))
  : [360, 1280];
if (widths.some((w) => !Number.isInteger(w) || w <= 0)) {
  console.error(`Largeurs invalides : ${process.argv[4]}`);
  process.exit(1);
}
await mkdir(outDir, { recursive: true });

const items = [];
for (const file of await listSvg(setDir)) {
  const rel = path.relative(setDir, file).replace(/\.svg$/, '');
  const svg = await readFile(file);
  const name = rel.replaceAll(path.sep, '--');
  const item = { name: rel };
  for (const w of widths) {
    const png = render(svg, w);
    await writeFile(path.join(outDir, `${name}-${w}.png`), png);
    if (w === 360) item.png360 = png;
  }
  // la planche-contact montre toujours les dessins à 360 px
  item.png360 ??= render(svg, 360);
  items.push(item);
}
if (items.length > 0) await contactSheet(items, path.join(outDir, '_planche-contact.png'));
console.log(`${items.length} dessins rendus dans ${outDir}`);
