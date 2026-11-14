/**
 * Recensement des informations manquantes (« TODO ») du site.
 *
 * Chaque source d'information manquante est décrite par un « extracteur »
 * (liste EXTRACTORS ci-dessous). Pour ajouter une nouvelle syntaxe, par
 * exemple une notation propre au Markdown, il suffit d'écrire un extracteur
 * de plus : le parcours des fichiers, le tri et l'écriture de TODO.md ne
 * changent pas.
 */

import { readFileSync } from 'node:fs';

import { compareStrings, listFiles, repoRoot } from './files.mjs';
import { kindOf, scanSource } from './source-scanner.mjs';
import { createLocator, plural } from './text.mjs';

/**
 * @typedef {{ file: string, line: number, column: number, what: string, placeholder: string, source: string }} TodoItem
 * @typedef {{ file: string, line: number, column: number, message: string }} TodoWarning
 * @typedef {{ relative: string, text: string, scan: () => import('./source-scanner.mjs').ScanResult }} SourceFile
 * @typedef {{ name: string, extensions: string[], appliesTo?: (relative: string) => boolean, scanless?: boolean, extract: (file: SourceFile) => { offset: number, what: string, placeholder: string }[] }} Extractor
 */

/** Données du site : seules ces valeurs `null` commentées comptent. */
const DATA_FILE = /^src\/data\/.+\.ts$/;

/** Données du site au format JSON : chaque clé "todo" compte. */
const DATA_JSON_FILE = /^src\/data\/.+\.json$/;

/**
 * Clés "todo" d'un fichier JSON de données (par exemple les cotes provisoires
 * du modèle 3D dans src/data/model.config.json), avec leur position.
 * @param {string} text
 */
function jsonTodos(text) {
  const found = [];
  for (const match of text.matchAll(/"todo"\s*:\s*("(?:[^"\\]|\\.)*")/g)) {
    found.push({
      offset: match.index,
      what: JSON.parse(match[1]),
      placeholder: '(valeurs provisoires)',
    });
  }
  return found;
}

/** @type {Extractor[]} */
export const EXTRACTORS = [
  {
    // todo('Adresse e-mail de contact', '[adresse e-mail]')
    name: 'todo()',
    extensions: ['.ts', '.astro', '.md', '.mdx'],
    extract: (file) => file.scan().todos.filter((todo) => todo.type === 'call'),
  },
  {
    // <Todo what="Adresse e-mail de contact">[adresse e-mail]</Todo>
    name: '<Todo>',
    extensions: ['.astro', '.md', '.mdx'],
    extract: (file) => file.scan().todos.filter((todo) => todo.type === 'element'),
  },
  {
    // prixOption2To: null, // TODO: prix de l'option 2 To
    name: 'null',
    extensions: ['.ts'],
    appliesTo: (relative) => DATA_FILE.test(relative),
    extract: (file) => file.scan().todos.filter((todo) => todo.type === 'null'),
  },
  {
    // "procedural": { "todo": "Cotes provisoires, à confirmer…" } (src/data/*.json)
    name: 'json',
    extensions: ['.json'],
    appliesTo: (relative) => DATA_JSON_FILE.test(relative),
    scanless: true,
    extract: (file) => jsonTodos(file.text),
  },
];

/** Dossiers parcourus par défaut, relatifs à la racine du dépôt. */
export const DEFAULT_TARGETS = ['src'];

/**
 * Lit un fichier (déjà chargé) et renvoie ses informations manquantes.
 * @param {string} relative chemin relatif à la racine (format POSIX)
 * @param {string} text contenu du fichier
 * @param {Extractor[]} [extractors]
 */
export function extractTodos(relative, text, extractors = EXTRACTORS) {
  const kind = kindOf(relative);
  const extension = /\.[^./]+$/.exec(relative)?.[0]?.toLowerCase() ?? '';
  const applicable = extractors.filter(
    (extractor) =>
      extractor.extensions.includes(extension) &&
      (!extractor.appliesTo || extractor.appliesTo(relative)),
  );
  /** @type {TodoItem[]} */
  const items = [];
  /** @type {TodoWarning[]} */
  const warnings = [];
  if (applicable.length === 0) return { items, warnings };
  // Sans analyseur pour ce type de fichier, seuls les extracteurs qui lisent
  // le texte brut (scanless) s'appliquent.
  if (!kind && applicable.some((extractor) => !extractor.scanless)) return { items, warnings };

  /** @type {import('./source-scanner.mjs').ScanResult | null} */
  let cache = null;
  const nullTodos = applicable.some((extractor) => extractor.name === 'null');
  const file = {
    relative,
    text,
    scan: () => (cache ??= scanSource(text, { kind: kind ?? 'code', nullTodos })),
  };
  const locate = createLocator(text);

  for (const extractor of applicable) {
    for (const found of extractor.extract(file)) {
      const { line, column } = locate(found.offset);
      items.push({
        file: relative,
        line,
        column,
        what: found.what,
        placeholder: found.placeholder,
        source: extractor.name,
      });
    }
  }
  if (kind) {
    for (const warning of file.scan().warnings) {
      const { line, column } = locate(warning.offset);
      warnings.push({ file: relative, line, column, message: warning.message });
    }
  }
  return { items: sortItems(items), warnings };
}

/**
 * Parcourt les dossiers et rassemble toutes les informations manquantes.
 * @param {{ root?: string, targets?: string[], extractors?: Extractor[] }} [options]
 */
export function collectTodos(options = {}) {
  const root = options.root ?? repoRoot;
  const targets = options.targets ?? DEFAULT_TARGETS;
  const extractors = options.extractors ?? EXTRACTORS;
  const extensions = [...new Set(extractors.flatMap((extractor) => extractor.extensions))];
  /** @type {TodoItem[]} */
  const items = [];
  /** @type {TodoWarning[]} */
  const warnings = [];
  let fileCount = 0;
  const seen = new Set();

  for (const target of targets) {
    const files = listFiles(target, {
      base: root,
      extensions,
      ignoredFiles: new Set(['TODO.md']),
    });
    for (const file of files) {
      if (seen.has(file.relative)) continue;
      seen.add(file.relative);
      fileCount += 1;
      const result = extractTodos(file.relative, readFileSync(file.absolute, 'utf8'), extractors);
      items.push(...result.items);
      warnings.push(...result.warnings);
    }
  }
  return { items: sortItems(items), warnings: sortItems(warnings), fileCount };
}

/**
 * Tri par fichier, puis ligne, puis colonne : la sortie ne dépend ni du
 * système ni de l'ordre de lecture.
 * @template {{ file: string, line: number, column: number }} T
 * @param {T[]} list
 * @returns {T[]}
 */
function sortItems(list) {
  return [...list].sort(
    (a, b) => compareStrings(a.file, b.file) || a.line - b.line || a.column - b.column,
  );
}

/**
 * Protège les caractères qui ont un sens en Markdown.
 * @param {string} value
 */
function escapeMarkdown(value) {
  return value.replace(/([\\`*_<>])/g, '\\$1');
}

/**
 * Phrase de bilan : « 3 informations manquantes dans 2 fichiers ».
 * @param {TodoItem[]} items
 */
export function describeCount(items) {
  const files = new Set(items.map((item) => item.file)).size;
  if (items.length === 0) return 'aucune information manquante';
  return `${plural(items.length, 'information manquante', 'informations manquantes')} dans ${plural(files, 'fichier')}`;
}

/**
 * Contenu de TODO.md. Aucune date ni heure : le fichier ne change que si
 * les informations manquantes changent.
 * @param {TodoItem[]} items
 */
export function renderTodoMarkdown(items) {
  const lines = [
    '# Informations manquantes',
    '',
    'Ce fichier est produit par `npm run todos` : ne le modifiez pas à la main.',
    'Chaque ligne donne le numéro de ligne dans le fichier source, ce qui manque, puis le texte provisoire affiché sur le site.',
    '',
    `Total : ${describeCount(items)}.`,
  ];
  let currentFile = '';
  for (const item of sortItems(items)) {
    if (item.file !== currentFile) {
      currentFile = item.file;
      lines.push('', `## ${escapeMarkdown(currentFile)}`, '');
    }
    const placeholder =
      item.source === 'null' ? '`null`' : escapeMarkdown(item.placeholder) || '(vide)';
    lines.push(`- L${item.line} - ${escapeMarkdown(item.what)} - ${placeholder}`);
  }
  return `${lines.join('\n')}\n`;
}
