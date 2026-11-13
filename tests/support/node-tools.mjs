/**
 * Petits outils Node pour les tests des scripts (lecture de fichiers,
 * lancement d'un script en ligne de commande).
 *
 * En JavaScript pour la même raison que settings.mjs : les fichiers
 * TypeScript des tests n'ont pas besoin des types de Node.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from './settings.mjs';

/**
 * Chemin absolu d'un fichier du dépôt.
 * @param {string} relative
 * @returns {string}
 */
export function repoPath(relative) {
  return path.join(repoRoot, relative);
}

/**
 * Contenu d'un fichier du dépôt.
 * @param {string} relative chemin relatif à la racine
 * @returns {string}
 */
export function readRepoFile(relative) {
  return readFileSync(repoPath(relative), 'utf8');
}

/**
 * @param {string} absolute
 * @returns {boolean}
 */
export function pathExists(absolute) {
  return existsSync(absolute);
}

/**
 * Copie un dossier du dépôt (par exemple un site construit) à la place d'un
 * autre, vidé d'abord.
 * @param {string} from chemin relatif à la racine
 * @param {string} to chemin relatif à la racine
 */
export function copyRepoDir(from, to) {
  rmSync(repoPath(to), { recursive: true, force: true });
  cpSync(repoPath(from), repoPath(to), { recursive: true });
}

/**
 * Largeur et hauteur d'une image PNG du dépôt, lues dans son en-tête (IHDR).
 * @param {string} relative chemin relatif à la racine
 * @returns {{ width: number, height: number }}
 */
export function pngSize(relative) {
  const bytes = readFileSync(repoPath(relative));
  if (bytes.toString('latin1', 12, 16) !== 'IHDR')
    throw new Error(`${relative} : pas une image PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/**
 * Construit le site dans un dossier à part, avec des variables d'environnement
 * choisies (par exemple PUBLIC_SHOW_TODOS=false), sans toucher à dist/.
 * @param {string} outDir dossier de sortie, relatif à la racine (ex. .tmp/tests/dist-demo)
 * @param {Record<string, string>} env variables ajoutées à celles du terminal
 * @returns {{ status: number | null, stdout: string, stderr: string }}
 */
export function buildSite(outDir, env) {
  const result = spawnSync(
    process.execPath,
    [repoPath('node_modules/astro/bin/astro.mjs'), 'build', '--outDir', outDir],
    { cwd: repoRoot, encoding: 'utf8', env: { ...process.env, ...env } },
  );
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Lance un script de scripts/ et renvoie son code de sortie et ses sorties.
 * @param {string} script ex. 'scripts/contrast.mjs'
 * @param {string[]} args
 * @returns {{ status: number | null, stdout: string, stderr: string }}
 */
export function runScript(script, args = []) {
  const result = spawnSync(process.execPath, [repoPath(script), ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}
