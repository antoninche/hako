/**
 * npm run build:box : construit la page de la HAKO pour sa première
 * installation (box/pages/index.astro), servie par la HAKO elle-même, dans
 * dist-box/ (jamais versionné). HakOS la construit à partir d'un commit figé
 * de ce dépôt (docs/page-box.md).
 *
 * Usage : SITE_URL=https://exemple.fr npm run build:box
 *   SITE_URL     adresse du site public, en https (obligatoire), devant les
 *                liens de la page ; lue aussi dans le fichier .env ;
 *   BOX_OUT_DIR  autre dossier de sortie, relatif à la racine (tests) ;
 *   BOX_WORK_DIR autre dossier de travail, relatif à la racine (tests).
 *
 * 1. Fichiers statiques de la page, copiés de public/ dans .tmp/box/public/ :
 *    polices (avec leurs licences), icônes de l'onglet, licence des icônes.
 * 2. astro build avec astro.box.config.mjs (racine de travail .tmp/box/),
 *    sans surlignage des informations manquantes (PUBLIC_SHOW_TODOS=false).
 * 3. Contrôles : une seule page HTML, en français, non indexée, en mode
 *    « box » ; rien de la démonstration ; l'accès réel à la HAKO présent ;
 *    ni ressource d'ailleurs ni script en ligne (scripts/lib/check-dist.mjs).
 * Code de sortie 1 en cas d'échec.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import { checkDist } from '../lib/check-dist.mjs';
import { listFiles, repoRoot } from '../lib/files.mjs';

/** Fichiers de public/ dont la page a besoin. */
const PUBLIC_FILES = [
  'fonts',
  'favicon.ico',
  'favicon.svg',
  'licences/bootstrap-icons-LICENSE.txt',
];

/** Repère de l'accès réel à la HAKO dans le JavaScript construit (API_BASE, box-http.ts). */
const API_MARK = '/api/installation/';

const workDir = process.env.BOX_WORK_DIR ?? '.tmp/box';
const outDir = process.env.BOX_OUT_DIR ?? 'dist-box';
for (const [name, value] of [
  ['BOX_WORK_DIR', workDir],
  ['BOX_OUT_DIR', outDir],
]) {
  if (!/^[\w./-]+$/u.test(value) || value.startsWith('/') || value.split('/').includes('..')) {
    console.error(`${name} doit être un dossier du dépôt : ${value}`);
    process.exit(1);
  }
}
const work = path.join(repoRoot, workDir);
const out = path.join(repoRoot, outDir);

/** Arrête le script avec un message. */
function fail(message) {
  console.error(`\nPage de la HAKO : ${message}`);
  process.exit(1);
}

// 1. Fichiers statiques.
rmSync(work, { recursive: true, force: true });
for (const file of PUBLIC_FILES) {
  const from = path.join(repoRoot, 'public', file);
  if (!existsSync(from)) fail(`fichier introuvable : public/${file}`);
  const to = path.join(work, 'public', file);
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

// 2. Construction.
rmSync(out, { recursive: true, force: true });
const build = spawnSync(
  process.execPath,
  [
    path.join(repoRoot, 'node_modules/astro/bin/astro.mjs'),
    'build',
    '--config',
    'astro.box.config.mjs',
  ],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: '1',
      PUBLIC_SHOW_TODOS: 'false',
      BOX_WORK_DIR: workDir,
      BOX_OUT_DIR: outDir,
    },
  },
);
if (build.status !== 0) fail('la construction a échoué.');

// 3. Contrôles.
const files = listFiles(out, { base: out }).map((file) => file.relative);
const pages = files.filter((file) => file.endsWith('.html'));
if (pages.length !== 1 || pages[0] !== 'index.html') {
  fail(`une seule page attendue (index.html), trouvé : ${pages.join(', ') || 'aucune'}.`);
}
const html = readFileSync(path.join(out, 'index.html'), 'utf8');
const scripts = files
  .filter((file) => file.endsWith('.js'))
  .map((file) => readFileSync(path.join(out, file), 'utf8'))
  .join('\n');
const expectations = [
  [/<html lang="fr"/u.test(html), 'langue fr'],
  [/<meta name="robots" content="noindex/u.test(html), 'noindex'],
  [/<meta name="referrer" content="no-referrer"/u.test(html), 'référent coupé'],
  [/data-mode="box"/u.test(html), 'mode « box »'],
  [
    !/data-demo-banner|data-example-passwords|exemple-[a-z]+-/u.test(html),
    'rien de la démonstration',
  ],
  [scripts.includes(API_MARK), 'accès réel à la HAKO dans le script'],
];
const missing = expectations.filter(([ok]) => !ok).map(([, what]) => what);
if (missing.length > 0) fail(`contrôle échoué : ${missing.join(', ')}.`);

const report = checkDist(out, { localOrigins: [] });
if (report.violations.length > 0) {
  for (const finding of report.violations) {
    console.error(`- ${finding.file}:${finding.line}:${finding.column} ${finding.message}`);
  }
  fail(`${report.violations.length} infraction(s) : ressource d'ailleurs ou code en ligne.`);
}

console.log(
  `\nPage de la HAKO construite dans ${outDir}/ : 1 page, ${files.length} fichiers, aucune ressource d'ailleurs.`,
);
