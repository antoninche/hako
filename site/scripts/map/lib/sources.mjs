// Téléchargement des données sources, une seule fois : chaque fichier est
// gardé en cache sous .tmp/ et vérifié par son empreinte SHA-256 à chaque
// lecture. Le site lui-même ne télécharge jamais rien.

import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/**
 * Renvoie le contenu d'un fichier source, depuis le cache ou depuis le réseau.
 * @param {{ url: string, sha256: string, name: string, cacheDir: string, log?: (m: string) => void }} source
 * @returns {Promise<Buffer>}
 */
export async function fetchPinned({ url, sha256: expected, name, cacheDir, log = () => {} }) {
  mkdirSync(cacheDir, { recursive: true });
  const cached = join(cacheDir, `${expected.slice(0, 16)}-${name}`);

  if (existsSync(cached)) {
    const buffer = readFileSync(cached);
    if (sha256(buffer) === expected) {
      log(`${name} : en cache`);
      return buffer;
    }
    log(`${name} : cache altéré, nouveau téléchargement`);
  }

  log(`${name} : téléchargement depuis ${url}`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`${name} : réponse ${response.status} pour ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const actual = sha256(buffer);
  if (actual !== expected) {
    throw new Error(
      `${name} : empreinte inattendue.\n  attendue : ${expected}\n  obtenue  : ${actual}\n` +
        'Le fichier source a changé : vérifiez-le avant de mettre à jour l’empreinte dans scripts/map/config.mjs.',
    );
  }
  // Écriture atomique : un téléchargement interrompu ne laisse pas de fichier tronqué.
  writeFileSync(`${cached}.part`, buffer);
  renameSync(`${cached}.part`, cached);
  return buffer;
}
