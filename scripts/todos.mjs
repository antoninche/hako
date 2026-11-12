/**
 * npm run todos : recense les informations manquantes du site dans TODO.md.
 *
 * Sources lues dans src/ : les appels todo('…', '…') (.ts, .astro, .md, .mdx),
 * les composants <Todo what="…">…</Todo> (.astro, .md, .mdx) et, dans
 * src/data/, les valeurs null suivies d'un commentaire « // TODO: … ».
 * Ce qui est en commentaire est ignoré.
 *
 * Options :
 *   --check  ne réécrit pas TODO.md, mais échoue s'il n'est pas à jour.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from './lib/files.mjs';
import { collectTodos, describeCount, renderTodoMarkdown } from './lib/todos.mjs';

const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg !== '--check');
if (unknown.length > 0) {
  console.error(`Option inconnue : ${unknown.join(' ')}. Seule l'option --check existe.`);
  process.exit(2);
}

const { items, warnings } = collectTodos({ root: repoRoot });
for (const warning of warnings) {
  console.error(`Attention : ${warning.file}:${warning.line} : ${warning.message}`);
}

const markdown = renderTodoMarkdown(items);
const target = path.join(repoRoot, 'TODO.md');

if (args.includes('--check')) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current !== markdown) {
    console.error(`TODO.md n'est pas à jour (${describeCount(items)}) : lancez npm run todos.`);
    process.exit(1);
  }
  console.log(`TODO.md est à jour : ${describeCount(items)}.`);
} else {
  writeFileSync(target, markdown);
  console.log(`TODO.md : ${describeCount(items)}.`);
}
