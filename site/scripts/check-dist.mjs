/**
 * npm run check:dist : contrôle le site construit avant sa mise en ligne.
 *
 * Usage : node scripts/check-dist.mjs [dossier] [--json]
 *   dossier  sortie de construction à contrôler (par défaut dist) ;
 *   --json   sortie JSON au lieu du rapport lisible.
 * La variable SITE_URL, si elle est définie, désigne le site lui-même : ses
 * adresses absolues ne comptent pas comme externes.
 * Code de sortie 1 en cas d'infraction, 2 si le dossier est introuvable.
 */

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

import { checkDist } from './lib/check-dist.mjs';
import { repoRoot } from './lib/files.mjs';
import { plural } from './lib/text.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const positional = args.filter((arg) => !arg.startsWith('--'));
const unknown = args.filter((arg) => arg.startsWith('--') && arg !== '--json');
if (unknown.length > 0 || positional.length > 1) {
  console.error('Usage : node scripts/check-dist.mjs [dossier] [--json]');
  process.exit(2);
}

const directory = path.resolve(positional[0] ?? path.join(repoRoot, 'dist'));
if (!existsSync(directory) || !statSync(directory).isDirectory()) {
  console.error(
    `Dossier introuvable : ${directory}. Lancez d'abord la construction (npm run build).`,
  );
  process.exit(2);
}

const siteUrl = process.env.SITE_URL;
const report = checkDist(directory, { localOrigins: siteUrl ? [siteUrl] : [] });
const ok = report.violations.length === 0;

if (json) {
  console.log(JSON.stringify({ ok, directory, ...report }, null, 2));
  process.exit(ok ? 0 : 1);
}

const label = path.relative(process.cwd(), directory) || '.';
const { counts } = report;
console.log(
  `Contrôle de ${label} : ${plural(counts.html, 'page HTML', 'pages HTML')}, ${plural(counts.css, 'feuille de style', 'feuilles de style')}, ${plural(counts.js, 'script')}, ${plural(counts.svg, 'fichier SVG', 'fichiers SVG')}, ${plural(counts.manifest, 'manifeste')}.`,
);

const print = (title, findings) => {
  if (findings.length === 0) return;
  console.log(`\n${title} (${findings.length}) :`);
  for (const finding of findings) {
    console.log(`- ${finding.file}:${finding.line}:${finding.column} ${finding.message}`);
    if (finding.excerpt) console.log(`    ${finding.excerpt}`);
  }
};

print('Infractions', report.violations);
print('À vérifier', report.warnings);

if (report.externalLinks.length > 0) {
  console.log(`\nLiens vers d'autres sites, pour information (${report.externalLinks.length}) :`);
  for (const link of report.externalLinks) {
    console.log(`- ${link.url} (${plural(link.files.length, 'page')} : ${link.files.join(', ')})`);
  }
}

console.log(
  ok
    ? '\nAucune infraction : aucune ressource externe, sortie compatible avec une CSP stricte.'
    : `\n${plural(report.violations.length, 'infraction')}.`,
);
process.exit(ok ? 0 : 1);
