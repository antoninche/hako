/**
 * Parcours de dossiers, dans un ordre stable d'une machine à l'autre.
 */

import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { toPosix } from './text.mjs';

/** Racine du dépôt (le dossier qui contient scripts/). */
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Dossiers jamais parcourus : dépendances, sorties de construction, fichiers de travail. */
export const IGNORED_DIRECTORIES = new Set([
  '.astro',
  '.git',
  '.tmp',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);

/**
 * Comparaison stable (ordre des points de code), indépendante de la langue
 * du système.
 * @param {string} a
 * @param {string} b
 */
export function compareStrings(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Liste récursivement les fichiers d'un dossier (ou le fichier lui-même),
 * triés, avec leur chemin relatif à `base` au format POSIX.
 * @param {string} target dossier ou fichier à parcourir
 * @param {{ base?: string, extensions?: string[], ignoredDirectories?: Set<string>, ignoredFiles?: Set<string> }} [options]
 * @returns {{ absolute: string, relative: string }[]}
 */
export function listFiles(target, options = {}) {
  const base = options.base ?? repoRoot;
  const ignoredDirectories = options.ignoredDirectories ?? IGNORED_DIRECTORIES;
  const ignoredFiles = options.ignoredFiles ?? new Set();
  const extensions = options.extensions;
  const found = [];

  const visit = (absolute) => {
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      const entries = readdirSync(absolute).sort(compareStrings);
      for (const entry of entries) {
        const child = path.join(absolute, entry);
        if (statSync(child).isDirectory()) {
          if (!ignoredDirectories.has(entry)) visit(child);
        } else {
          visit(child);
        }
      }
      return;
    }
    const name = path.basename(absolute);
    if (ignoredFiles.has(name)) return;
    if (extensions && !extensions.includes(path.extname(name).toLowerCase())) return;
    found.push({ absolute, relative: toPosix(path.relative(base, absolute)) });
  };

  visit(path.resolve(base, target));
  return found.sort((a, b) => compareStrings(a.relative, b.relative));
}
