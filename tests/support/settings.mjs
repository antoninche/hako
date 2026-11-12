/**
 * Réglages des tests, lus dans les variables d'environnement.
 *
 * Ce module est en JavaScript : il utilise Node (process, node:path) sans
 * demander les types de Node aux fichiers TypeScript qui l'importent.
 *
 * Variables reconnues :
 *   PW_PORT         port du serveur de prévisualisation (4321 par défaut) ;
 *   PW_OUT_DIR      dossier de construction (dist par défaut), pour lancer
 *                   les tests sans toucher au dist/ partagé ;
 *   PW_RESULTS_DIR  dossier des résultats de Playwright (test-results par défaut) ;
 *   CAPTURE_DIR     dossier des captures (qa/screenshots par défaut) ;
 *   CAPTURE_WIDTHS  largeurs de capture en plus de 390 et 1440, ex. 360,768,1024 ;
 *   CI              présent sur un serveur d'intégration continue.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const env = process.env;

/** Racine du dépôt. */
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Vrai sur un serveur d'intégration continue. */
export const isCI = Boolean(env.CI);

/** Port du serveur de prévisualisation. */
export const port = Number.parseInt(env.PW_PORT ?? '', 10) || 4321;

/** Adresse du site pendant les tests. */
export const baseURL = `http://localhost:${port}`;

/** Dossier de construction ('' : dist/, le dossier par défaut d'Astro). */
export const outDir = env.PW_OUT_DIR ?? '';
if (outDir && !/^[\w./-]+$/.test(outDir)) {
  throw new Error(
    `PW_OUT_DIR ne doit contenir que des lettres, chiffres, « . », « _ », « - » et « / » : ${outDir}`,
  );
}

/** Dossier construit, en chemin absolu. */
export const builtDir = path.resolve(repoRoot, outDir || 'dist');

/**
 * Construction puis prévisualisation du site, comme en production.
 * --ignore-lock : Astro 7 n'autorise qu'un serveur de prévisualisation par
 * projet (fichier .astro/preview.json) ; Playwright lance et arrête le sien
 * lui-même, sans gêner un autre serveur déjà ouvert.
 */
export const webServerCommand = outDir
  ? `npx astro build --outDir ${outDir} && npx astro preview --ignore-lock --outDir ${outDir} --port ${port}`
  : `npx astro build && npx astro preview --ignore-lock --port ${port}`;

/** Résultats de Playwright (traces, captures d'échec). */
export const resultsDir = env.PW_RESULTS_DIR || 'test-results';

/** Dossier des captures d'écran, en chemin absolu. */
export const captureDir = path.resolve(repoRoot, env.CAPTURE_DIR || 'qa/screenshots');

/** Largeurs de capture : 390 et 1440, plus celles de CAPTURE_WIDTHS. */
export const captureWidths = [
  ...new Set([
    390,
    1440,
    ...(env.CAPTURE_WIDTHS ?? '')
      .split(',')
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isInteger(value) && value >= 280 && value <= 3840),
  ]),
].sort((a, b) => a - b);
