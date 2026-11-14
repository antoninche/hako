/**
 * npm run contrast : recalcule le contraste (WCAG 2.x) de chaque couple
 * texte/fond des feuilles de style et des blocs <style> des composants.
 *
 * Usage : node scripts/contrast.mjs [--json] [--tokens fichier.css] [dossiers…]
 *   --json    sortie JSON (pour d'autres outils) au lieu du tableau ;
 *   --tokens  fichier des jetons (par défaut src/styles/tokens.css) ;
 *   dossiers  ce qui est parcouru (par défaut src).
 * Code de sortie 1 si un contraste est insuffisant ou ne peut pas être vérifié.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import { formatRatio } from './lib/colors.mjs';
import {
  DEFAULT_TARGETS,
  DEFAULT_TOKENS,
  NON_TEXT_THRESHOLD,
  TEXT_THRESHOLD,
  checkContrast,
} from './lib/contrast.mjs';
import { repoRoot } from './lib/files.mjs';
import { formatTable, plural } from './lib/text.mjs';

const args = process.argv.slice(2);
let json = false;
let tokens = DEFAULT_TOKENS;
const targets = [];
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--json') json = true;
  else if (arg === '--tokens') {
    tokens = args[index + 1] ?? '';
    index += 1;
  } else if (arg.startsWith('--')) {
    console.error(`Option inconnue : ${arg}`);
    process.exit(2);
  } else targets.push(arg);
}

for (const target of [tokens, ...targets]) {
  if (!target || !existsSync(path.resolve(repoRoot, target))) {
    console.error(`Introuvable : ${target || '(fichier de jetons manquant)'}`);
    process.exit(2);
  }
}

const { results, ok, sourceCount } = checkContrast({
  root: repoRoot,
  tokens,
  targets: targets.length > 0 ? targets : DEFAULT_TARGETS,
});

if (json) {
  console.log(
    JSON.stringify(
      { ok, thresholds: { text: TEXT_THRESHOLD, nonText: NON_TEXT_THRESHOLD }, results },
      null,
      2,
    ),
  );
  process.exit(ok ? 0 : 1);
}

const LABELS = {
  role: 'rôle de texte',
  'non-text': 'non-texte',
  pair: 'paire déclarée',
  guard: 'garde-fou',
  error: 'erreur',
};
const decimal = (value) => String(value).replace('.', ',');
const shorten = (value, length = 48) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

const rows = results.map((result) => [
  LABELS[result.check],
  result.surfaces.join(', ') || '-',
  shorten(result.subject),
  shorten(result.foreground, 36),
  shorten(result.background, 36),
  result.ratio === null ? '-' : formatRatio(result.ratio),
  result.threshold === null ? '-' : `${decimal(result.threshold)}:1`,
  result.ok ? 'OK' : 'ÉCHEC',
  result.line ? `${result.file}:${result.line}` : result.file,
]);

console.log(
  `Contrastes WCAG 2.x : texte ${decimal(TEXT_THRESHOLD)}:1 minimum, éléments non textuels ${decimal(NON_TEXT_THRESHOLD)}:1 (${plural(sourceCount, 'feuille de style', 'feuilles de style')} lues).\n`,
);
console.log(
  formatTable(
    [
      'Contrôle',
      'Surface',
      'Sélecteur ou rôle',
      'Texte',
      'Fond',
      'Ratio',
      'Seuil',
      'Résultat',
      'Emplacement',
    ],
    rows,
  ),
);

const failures = results.filter((result) => !result.ok);
if (failures.length > 0) {
  console.log(`\n${plural(failures.length, 'problème')} :`);
  for (const failure of failures) {
    const where = failure.line ? `${failure.file}:${failure.line}` : failure.file;
    const ratio = failure.ratio === null ? '' : ` (${formatRatio(failure.ratio)})`;
    const detail = failure.message || 'contraste insuffisant';
    console.log(`- ${where} ${failure.subject}${ratio} : ${detail}`);
  }
}
console.log(`\n${plural(results.length, 'contrôle')}, ${plural(failures.length, 'échec')}.`);
process.exit(ok ? 0 : 1);
