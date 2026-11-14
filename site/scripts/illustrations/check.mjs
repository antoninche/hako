// Contrôle technique des illustrations : poids, viewBox, titre et description,
// couleurs de la palette uniquement, éléments et attributs interdits (règles
// dans docs/illustrations.md).
//
// Usage : node scripts/illustrations/check.mjs [dossier] [--json]
// Dossier par défaut : src/assets/illustrations (npm run illustrations:check).
// Sortie en erreur (code 1) si un fichier enfreint une règle.

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const MAX_BYTES = 20 * 1024;
const PALETTE = new Set([
  '#fdf7ef', // creme
  '#412d1e', // chocolat
  '#f2e6d6', // sable
  '#e6d5bf', // lin
  '#5f3e27', // noyer (le socle du prototype)
  '#9a4e2b', // terre
  '#b9773f', // caramel
  '#5e6b45', // olive
  '#bab1a7', // pierre (le fond des images du prototype), à petites doses
  '#e3d9c6', // perle (la coque du prototype, RAL 1013 « blanc perlé »)
]);
const NEUTRAL = new Set(['none', 'transparent']);
const FORBIDDEN_ELEMENTS = [
  'image',
  'text',
  'tspan',
  'textPath',
  'style',
  'script',
  'foreignObject',
  'filter',
  'linearGradient',
  'radialGradient',
  'mask',
  'font',
  'a',
];
const FORBIDDEN_ATTRIBUTES = [
  'style',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'href',
  'xlink:href',
];

async function listSvg(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listSvg(full)));
    else if (entry.name.endsWith('.svg')) out.push(full);
  }
  return out.sort();
}

function expandHex(value) {
  const v = value.toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return v;
}

function checkSvg(source, file) {
  const problems = [];
  const prefix = path.basename(file, '.svg');
  if (!/<svg[^>]*\sviewBox="[^"]+"/.test(source)) problems.push('viewBox absent');
  if (/<svg[^>]*\s(width|height)="/.test(source)) problems.push('attributs width/height sur <svg>');
  if (!/<title[\s>]/.test(source)) problems.push('<title> absent');
  if (!/<desc[\s>]/.test(source)) problems.push('<desc> absent');
  for (const el of FORBIDDEN_ELEMENTS) {
    if (new RegExp(`<${el}[\\s/>]`).test(source)) problems.push(`élément interdit <${el}>`);
  }
  for (const attr of FORBIDDEN_ATTRIBUTES) {
    if (new RegExp(`\\s${attr.replace(':', '\\:')}="`).test(source)) {
      // href est permis uniquement pour <use href="#…"> interne
      if (
        (attr === 'href' || attr === 'xlink:href') &&
        !new RegExp(`\\s${attr}="(?!#)`).test(source)
      )
        continue;
      problems.push(`attribut interdit ${attr}`);
    }
  }
  if (/url\(\s*['"]?(?!#)/.test(source)) problems.push('référence externe url(…)');
  if (/data:/.test(source)) problems.push('URI data:');
  const colors = new Set();
  for (const m of source.matchAll(/\s(fill|stroke|stop-color|color)="([^"]+)"/g)) {
    const value = expandHex(m[2].trim());
    if (NEUTRAL.has(value) || value.startsWith('url(#')) continue;
    colors.add(value);
    if (!PALETTE.has(value)) problems.push(`couleur hors palette ${m[2]}`);
  }
  for (const m of source.matchAll(/\sid="([^"]+)"/g)) {
    if (!m[1].startsWith(prefix))
      problems.push(`id non préfixé « ${m[1]} » (attendu : ${prefix}…)`);
  }
  return { problems: [...new Set(problems)], colors: [...colors] };
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const dir = args.find((arg) => !arg.startsWith('--')) ?? 'src/assets/illustrations';

const results = [];
for (const file of await listSvg(dir)) {
  const source = await readFile(file, 'utf8');
  const { size } = await stat(file);
  const { problems, colors } = checkSvg(source, file);
  if (size > MAX_BYTES) problems.unshift(`${(size / 1024).toFixed(1)} Ko > 20 Ko`);
  results.push({ file: path.relative(dir, file), bytes: size, colors, problems });
}

if (asJson) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) {
    const verdict = r.problems.length === 0 ? 'ok' : r.problems.join(' ; ');
    console.log(`${r.file.padEnd(40)} ${(r.bytes / 1024).toFixed(1).padStart(5)} Ko  ${verdict}`);
  }
  const bad = results.filter((r) => r.problems.length > 0).length;
  console.log(`\n${results.length} fichiers, ${bad} en défaut.`);
}
process.exit(results.some((r) => r.problems.length > 0) ? 1 : 0);
