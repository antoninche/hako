/**
 * Contrôle des contrastes du site (WCAG 2.x), à partir des feuilles de style.
 *
 * Quatre vérifications :
 * 1. chaque rôle de texte (--text, --text-muted, --link, --link-hover,
 *    --success) contre le fond (--surface) de chaque surface : 4,5:1 ;
 * 2. chaque règle CSS qui déclare une couleur de texte et un fond uni
 *    (états :hover, :focus, :focus-visible, :active compris ; un état qui ne
 *    change que le fond est apparié à la couleur de la règle de base) : 4,5:1 ;
 *    une règle qui ne pose qu'un fond est vérifiée avec la couleur héritée,
 *    --text de chaque surface ;
 * 3. garde-fou : une couleur de texte tirée directement de la palette (ou
 *    écrite en #hex, rgb()…) sans fond dans la même règle est refusée, car
 *    son contraste dépendrait de l'endroit où le composant est posé ;
 * 4. éléments non textuels : --focus et --line-strong contre chaque surface : 3:1.
 *
 * Une règle qui ne nomme pas de surface (.surface-sable…) est évaluée sur
 * toutes les surfaces : un composant peut être posé sur n'importe laquelle.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import postcss from 'postcss';

import { composite, contrastRatio, parseColor, toHex } from './colors.mjs';
import { compareStrings, listFiles, repoRoot } from './files.mjs';
import { scanSource } from './source-scanner.mjs';
import { createLocator, toPosix } from './text.mjs';

export const TEXT_THRESHOLD = 4.5;
export const NON_TEXT_THRESHOLD = 3;
export const TEXT_ROLES = ['--text', '--text-muted', '--link', '--link-hover', '--success'];
export const NON_TEXT_ROLES = ['--focus', '--line-strong'];
export const DEFAULT_TOKENS = 'src/styles/tokens.css';
export const DEFAULT_TARGETS = ['src'];

/** Valeurs de couleur qui ne fixent rien par elles-mêmes. */
const KEYWORDS = new Set([
  'currentcolor',
  'inherit',
  'initial',
  'revert',
  'revert-layer',
  'transparent',
  'unset',
]);

/** Mots-clés du raccourci `background` qui ne sont pas des couleurs. */
const BACKGROUND_KEYWORDS = new Set([
  'auto',
  'border-box',
  'bottom',
  'center',
  'contain',
  'content-box',
  'cover',
  'fixed',
  'left',
  'local',
  'no-repeat',
  'none',
  'padding-box',
  'repeat',
  'repeat-x',
  'repeat-y',
  'right',
  'round',
  'scroll',
  'space',
  'text',
  'top',
]);

const STATE_PSEUDO = /:(?:hover|focus-visible|focus-within|focus|active|visited)(?![\w-])/;
const STATE_PSEUDO_ALL = new RegExp(STATE_PSEUDO.source, 'g');
const IMAGE_FUNCTION =
  /\b(?:url|image-set|image|cross-fade|element|(?:repeating-)?(?:linear|radial|conic)-gradient)\(/i;
const NESTABLE_AT_RULES = new Set([
  'container',
  'document',
  'layer',
  'media',
  'scope',
  'starting-style',
  'supports',
]);

/**
 * @typedef {import('./colors.mjs').Rgba} Rgba
 * @typedef {{ value: string, file: string, line: number }} Definition
 * @typedef {{ name: string, isDefault: boolean, vars: Map<string, Definition>, surface: Rgba | null, file: string, line: number }} Context
 * @typedef {{ check: 'role' | 'non-text' | 'pair' | 'guard' | 'error', surfaces: string[], subject: string, foreground: string, background: string, ratio: number | null, threshold: number | null, ok: boolean, file: string, line: number, message: string }} ContrastResult
 */

// ------------------------------------------------------------ outils

/**
 * Découpe une valeur au niveau supérieur (hors parenthèses et guillemets).
 * @param {string} value
 * @param {string} separators caractères séparateurs
 */
export function splitTopLevel(value, separators) {
  const parts = [];
  let depth = 0;
  /** @type {string | null} */
  let quote = null;
  let current = '';
  for (const char of value) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (depth === 0 && separators.includes(char)) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part !== '');
}

/** @param {string} selector */
function normalizeSelector(selector) {
  return selector
    .replace(/:global\(([^()]*)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s*([>+~])\s*/g, '$1')
    .trim();
}

/** Sélecteur sans ses états (:hover…) : celui de la règle de base. */
function stripStates(selector) {
  return normalizeSelector(
    selector.replace(STATE_PSEUDO_ALL, '').replace(/:(?:is|where)\(\s*(?:,\s*)*\)/g, ''),
  );
}

/**
 * Sélecteurs imbriqués (CSS nesting) : « & » prend la place du parent.
 * @param {string[]} parents
 * @param {string[]} children
 */
function combineSelectors(parents, children) {
  return children.flatMap((child) =>
    parents.map((parent) =>
      child.includes('&') ? child.replaceAll('&', parent) : `${parent} ${child}`,
    ),
  );
}

/**
 * Remplace les var(--x) par leur valeur, en remontant les chaînes de
 * variables. Les portées sont lues de la plus proche à la plus lointaine.
 * @param {string} value
 * @param {Map<string, Definition>[]} scopes
 * @param {Set<string>} [seen] variables déjà traversées (boucles)
 * @returns {{ value: string | null, missing: string | null }}
 */
function resolveVariables(value, scopes, seen = new Set()) {
  let output = '';
  let index = 0;
  for (;;) {
    const start = value.indexOf('var(', index);
    if (start === -1) {
      output += value.slice(index);
      return { value: output.trim(), missing: null };
    }
    output += value.slice(index, start);
    let depth = 0;
    let close = -1;
    for (let cursor = start + 3; cursor < value.length; cursor += 1) {
      if (value[cursor] === '(') depth += 1;
      else if (value[cursor] === ')') {
        depth -= 1;
        if (depth === 0) {
          close = cursor;
          break;
        }
      }
    }
    if (close === -1) return { value: null, missing: value };
    const inner = value.slice(start + 4, close);
    const comma = splitTopLevel(inner, ',');
    const name = (comma[0] ?? '').trim();
    const fallback = comma.length > 1 ? inner.slice(inner.indexOf(',') + 1).trim() : null;
    /** @type {string | null} */
    let replacement = null;
    const definition = seen.has(name) ? undefined : lookup(name, scopes);
    if (definition) {
      replacement = resolveVariables(definition.value, scopes, new Set([...seen, name])).value;
    }
    if (replacement === null && fallback !== null) {
      replacement = resolveVariables(fallback, scopes, seen).value;
    }
    if (replacement === null) return { value: null, missing: name };
    output += replacement;
    index = close + 1;
  }
}

/**
 * @param {string} name
 * @param {Map<string, Definition>[]} scopes
 */
function lookup(name, scopes) {
  for (const scope of scopes) {
    const found = scope.get(name);
    if (found) return found;
  }
  return undefined;
}

/**
 * @param {string} value
 * @param {Map<string, Definition>[]} scopes
 * @returns {{ state: 'color', color: Rgba, text: string } | { state: 'keyword', text: string } | { state: 'unknown', text: string }}
 */
function resolveColor(value, scopes) {
  const resolved = resolveVariables(value, scopes);
  if (resolved.value === null) {
    return { state: 'unknown', text: `variable ${resolved.missing} introuvable` };
  }
  const text = resolved.value;
  if (KEYWORDS.has(text.toLowerCase())) return { state: 'keyword', text };
  const color = parseColor(text);
  return color ? { state: 'color', color, text } : { state: 'unknown', text };
}

/**
 * Couleur de fond effective d'une déclaration background ou background-color.
 * @param {postcss.Declaration} declaration
 * @param {Map<string, Definition>[]} scopes
 * @returns {{ state: 'solid', color: Rgba, text: string, withImage: boolean } | { state: 'none' | 'image' } | { state: 'unknown', text: string }}
 */
function resolveBackground(declaration, scopes) {
  const resolved = resolveVariables(declaration.value, scopes);
  if (resolved.value === null) {
    return { state: 'unknown', text: `variable ${resolved.missing} introuvable` };
  }
  const value = resolved.value;
  const lower = value.toLowerCase();
  if (lower === 'currentcolor') return { state: 'unknown', text: value };
  if (KEYWORDS.has(lower) || lower === 'none') return { state: 'none' };

  if (declaration.prop.toLowerCase() === 'background-color') {
    const color = parseColor(value);
    if (!color) return { state: 'unknown', text: value };
    return color.a === 0
      ? { state: 'none' }
      : { state: 'solid', color, text: value, withImage: false };
  }

  const withImage = IMAGE_FUNCTION.test(value);
  const layers = splitTopLevel(value, ',');
  const tokens = splitTopLevel(layers[layers.length - 1] ?? '', ' \t\n/');
  /** @type {{ color: Rgba, text: string } | null} */
  let found = null;
  for (const token of tokens) {
    const color = parseColor(token);
    if (color) {
      found = { color, text: token };
      continue;
    }
    const word = token.toLowerCase();
    const isWord = /^[a-z-]+$/.test(word);
    if (isWord && !BACKGROUND_KEYWORDS.has(word) && !KEYWORDS.has(word)) {
      return { state: 'unknown', text: value };
    }
  }
  if (found && found.color.a > 0) {
    return { state: 'solid', color: found.color, text: found.text, withImage };
  }
  return { state: withImage ? 'image' : 'none' };
}

/**
 * Nature d'une couleur de texte déclarée seule (sans fond uni).
 * @param {string} value
 * @param {Map<string, Definition>[]} localScopes variables du composant
 * @param {Set<string>} roles variables propres aux surfaces
 * @param {Map<string, Definition>} globals variables de :root
 * @returns {'role' | 'keyword' | 'raw' | 'non-text-role' | 'unknown'}
 */
function classifyTextColor(value, localScopes, roles, globals, depth = 0) {
  const text = value.trim();
  if (KEYWORDS.has(text.toLowerCase())) return 'keyword';
  const direct = /^var\(\s*(--[\w-]+)\s*(?:,[\s\S]*)?\)$/.exec(text);
  if (direct) {
    const name = direct[1];
    if (TEXT_ROLES.includes(name)) return 'role';
    if (roles.has(name)) return 'non-text-role';
    const local = lookup(name, localScopes);
    if (local && depth < 20) {
      return classifyTextColor(local.value, localScopes, roles, globals, depth + 1);
    }
    return globals.has(name) ? 'raw' : 'unknown';
  }
  if (parseColor(text) || /^[a-z]+$/i.test(text)) return 'raw';
  return 'unknown';
}

// ------------------------------------------------------------ jetons

/**
 * Lit tokens.css : variables de :root et surfaces (.surface-xxx).
 * @param {string} file chemin affiché
 * @param {string} css
 */
export function readTokens(file, css) {
  const root = postcss.parse(css, { from: file });
  /** @type {Map<string, Definition>} */
  const globals = new Map();
  /** @type {{ selectors: string[], vars: Map<string, Definition>, line: number }[]} */
  const surfaceRules = [];
  /** @type {Set<string>} */
  const roles = new Set();

  root.each((node) => {
    if (node.type !== 'rule') return;
    const selectors = splitTopLevel(node.selector, ',');
    /** @type {Map<string, Definition>} */
    const vars = new Map();
    node.each((child) => {
      if (child.type === 'decl' && child.prop.startsWith('--')) {
        vars.set(child.prop, { value: child.value, file, line: child.source?.start?.line ?? 0 });
      }
    });
    if (selectors.includes(':root'))
      for (const [name, definition] of vars) globals.set(name, definition);
    if (vars.has('--surface')) {
      surfaceRules.push({ selectors, vars, line: node.source?.start?.line ?? 0 });
      for (const name of vars.keys()) roles.add(name);
    }
  });

  /** @type {Context[]} */
  const contexts = surfaceRules.map((rule) => {
    const named = rule.selectors
      .map((selector) => /^\.surface-([\w-]+)$/.exec(selector))
      .find(Boolean);
    const vars = new Map([...globals, ...rule.vars]);
    const surface = resolveColor('var(--surface)', [vars]);
    return {
      name: named ? named[1] : ':root',
      isDefault: rule.selectors.includes(':root'),
      vars,
      surface: surface.state === 'color' && surface.color.a === 1 ? surface.color : null,
      file,
      line: rule.line,
    };
  });
  return { globals, roles, contexts };
}

// ------------------------------------------------------------ sources

/**
 * @typedef {{ file: string, css: string, offset: number, locate: (offset: number) => { line: number, column: number }, scope: string }} CssSource
 */

/**
 * Feuilles .css et blocs <style> des composants .astro.
 * @param {string} root
 * @param {string[]} targets
 */
export function loadCssSources(root, targets) {
  /** @type {CssSource[]} */
  const sources = [];
  const seen = new Set();
  for (const target of targets) {
    for (const file of listFiles(target, { base: root, extensions: ['.css', '.astro'] })) {
      if (seen.has(file.relative)) continue;
      seen.add(file.relative);
      const text = readFileSync(file.absolute, 'utf8');
      const locate = createLocator(text);
      if (file.relative.endsWith('.css')) {
        sources.push({ file: file.relative, css: text, offset: 0, locate, scope: 'global' });
        continue;
      }
      for (const style of scanSource(text, { kind: 'astro' }).styles) {
        const lang = style.attributes.lang;
        if (lang && lang !== 'css') continue;
        const isGlobal = Object.hasOwn(style.attributes, 'is:global');
        sources.push({
          file: file.relative,
          css: style.content,
          offset: style.offset,
          locate,
          scope: isGlobal ? 'global' : file.relative,
        });
      }
    }
  }
  return sources;
}

/**
 * Règles « à plat » : sélecteurs complets (imbrication résolue) et
 * déclarations directes. Les @keyframes, @font-face… sont ignorés.
 * @param {postcss.Root} root
 */
function flattenRules(root) {
  /** @type {{ selectors: string[], declarations: postcss.Declaration[], node: postcss.Rule | postcss.AtRule }[]} */
  const rules = [];
  /**
   * @param {postcss.Container} container
   * @param {string[] | null} parents
   */
  const visit = (container, parents) => {
    container.each((node) => {
      if (node.type === 'rule') {
        const own = splitTopLevel(node.selector, ',');
        const selectors = parents ? combineSelectors(parents, own) : own;
        const declarations = /** @type {postcss.Declaration[]} */ (
          node.nodes.filter((child) => child.type === 'decl')
        );
        rules.push({ selectors, declarations, node });
        visit(node, selectors);
      } else if (node.type === 'atrule' && NESTABLE_AT_RULES.has(node.name.toLowerCase())) {
        if (parents && node.nodes) {
          const declarations = /** @type {postcss.Declaration[]} */ (
            node.nodes.filter((child) => child.type === 'decl')
          );
          if (declarations.length > 0) rules.push({ selectors: parents, declarations, node });
        }
        if (node.nodes) visit(node, parents);
      }
    });
  };
  visit(root, null);
  return rules;
}

/**
 * @param {postcss.Declaration[]} declarations
 * @param {string[]} properties
 */
function lastDeclaration(declarations, properties) {
  /** @type {postcss.Declaration | null} */
  let found = null;
  for (const declaration of declarations) {
    if (properties.includes(declaration.prop.toLowerCase())) found = declaration;
  }
  return found;
}

/** @param {postcss.Declaration[]} declarations */
function customProperties(declarations) {
  /** @type {Map<string, Definition>} */
  const vars = new Map();
  for (const declaration of declarations) {
    if (declaration.prop.startsWith('--')) {
      vars.set(declaration.prop, { value: declaration.value, file: '', line: 0 });
    }
  }
  return vars;
}

// ------------------------------------------------------------ analyse

/**
 * Lance les quatre vérifications.
 * @param {{ root?: string, tokens?: string, targets?: string[] }} [options]
 * @returns {{ results: ContrastResult[], ok: boolean, sourceCount: number }}
 */
export function checkContrast(options = {}) {
  const root = options.root ?? repoRoot;
  const tokensFile = options.tokens ?? DEFAULT_TOKENS;
  const targets = options.targets ?? DEFAULT_TARGETS;
  const tokensPath = path.resolve(root, tokensFile);
  const tokensLabel = toPosix(path.relative(root, tokensPath));
  const tokens = readTokens(tokensLabel, readFileSync(tokensPath, 'utf8'));
  const sources = loadCssSources(root, targets);
  const results = [...checkRoles(tokens), ...checkRules(sources, tokens)];
  const order = { role: 0, 'non-text': 1, pair: 2, guard: 3, error: 4 };
  results.sort(
    (a, b) =>
      order[a.check] - order[b.check] ||
      compareStrings(a.file, b.file) ||
      a.line - b.line ||
      compareStrings(a.subject, b.subject),
  );
  return { results, ok: results.every((result) => result.ok), sourceCount: sources.length };
}

/**
 * Vérifications 1 et 4 : rôles de chaque surface.
 * @param {ReturnType<typeof readTokens>} tokens
 */
function checkRoles(tokens) {
  /** @type {ContrastResult[]} */
  const results = [];
  if (tokens.contexts.length === 0) {
    results.push({
      check: 'error',
      surfaces: [],
      subject: '--surface',
      foreground: '',
      background: '',
      ratio: null,
      threshold: null,
      ok: false,
      file: '',
      line: 0,
      message: 'aucune surface (règle qui définit --surface) dans le fichier de jetons',
    });
  }
  for (const context of tokens.contexts) {
    const groups = [
      { check: /** @type {const} */ ('role'), roles: TEXT_ROLES, threshold: TEXT_THRESHOLD },
      {
        check: /** @type {const} */ ('non-text'),
        roles: NON_TEXT_ROLES,
        threshold: NON_TEXT_THRESHOLD,
      },
    ];
    for (const group of groups) {
      for (const role of group.roles) {
        const definition = context.vars.get(role);
        const base = {
          check: group.check,
          surfaces: [context.name],
          subject: role,
          threshold: group.threshold,
          file: definition?.file ?? context.file,
          line: definition?.line ?? context.line,
        };
        const foreground = resolveColor(`var(${role})`, [context.vars]);
        if (!definition || !context.surface || foreground.state !== 'color') {
          results.push({
            ...base,
            foreground: foreground.text ?? '',
            background: context.surface ? toHex(context.surface) : '',
            ratio: null,
            ok: false,
            message: !definition
              ? `rôle ${role} absent de la surface`
              : !context.surface
                ? '--surface doit être une couleur opaque'
                : `valeur non vérifiable : ${foreground.text}`,
          });
          continue;
        }
        const visible = composite(foreground.color, context.surface);
        const ratio = contrastRatio(visible, context.surface);
        results.push({
          ...base,
          foreground: `${definition.value} ${toHex(foreground.color)}`,
          background: `--surface ${toHex(context.surface)}`,
          ratio,
          ok: ratio >= group.threshold,
          message: '',
        });
      }
    }
  }
  return results;
}

/**
 * Vérifications 2 et 3 : règles de toutes les feuilles de style.
 * @param {CssSource[]} sources
 * @param {ReturnType<typeof readTokens>} tokens
 */
function checkRules(sources, tokens) {
  /** @type {ContrastResult[]} */
  const results = [];
  /** @type {{ selectors: string[], declarations: postcss.Declaration[], node: postcss.Rule | postcss.AtRule, source: CssSource, fileVars: Map<string, Definition> }[]} */
  const rules = [];
  /** @type {Map<string, postcss.Declaration[]>} */
  const index = new Map();
  const key = (scope, selector) => `${scope}\u0000${selector}`;

  for (const source of sources) {
    /** @type {postcss.Root} */
    let root;
    try {
      root = postcss.parse(source.css, { from: source.file });
    } catch (error) {
      const offset = typeof error?.input?.offset === 'number' ? error.input.offset : 0;
      results.push({
        check: 'error',
        surfaces: [],
        subject: '',
        foreground: '',
        background: '',
        ratio: null,
        threshold: null,
        ok: false,
        file: source.file,
        line: source.locate(source.offset + offset).line,
        message: `CSS illisible : ${error?.reason ?? error}`,
      });
      continue;
    }
    const flat = flattenRules(root);
    // Variables propres au fichier (hors :root et surfaces, déjà connues).
    /** @type {Map<string, Definition>} */
    const fileVars = new Map();
    for (const rule of flat) {
      if (
        rule.selectors.some(
          (selector) => selector === ':root' || /^\.surface-[\w-]+$/.test(selector),
        )
      ) {
        continue;
      }
      for (const [name, definition] of customProperties(rule.declarations)) {
        if (!tokens.roles.has(name)) fileVars.set(name, definition);
      }
    }
    for (const rule of flat) {
      rules.push({ ...rule, source, fileVars });
      for (const selector of rule.selectors) {
        const entry = key(source.scope, normalizeSelector(selector));
        index.set(entry, [...(index.get(entry) ?? []), ...rule.declarations]);
      }
    }
  }

  const lineOf = (source, node) =>
    source.locate(source.offset + (node.source?.start?.offset ?? 0)).line;
  const defaultContexts = tokens.contexts.filter((context) => context.isDefault);
  const seenGuards = new Set();
  /** @type {WeakMap<object, number>} */
  const ids = new WeakMap();
  let nextId = 1;
  const idOf = (node) => {
    if (!node) return 0;
    let id = ids.get(node);
    if (id === undefined) {
      id = nextId;
      nextId += 1;
      ids.set(node, id);
    }
    return id;
  };

  for (const rule of rules) {
    const ownColor = lastDeclaration(rule.declarations, ['color']);
    const ownBackground = lastDeclaration(rule.declarations, ['background', 'background-color']);
    if (!ownColor && !ownBackground) continue;
    // Plusieurs sélecteurs d'une même règle qui donnent la même paire : une seule ligne.
    const seenPairs = new Set();

    for (const selector of rule.selectors) {
      let base = /** @type {postcss.Declaration[]} */ ([]);
      if (STATE_PSEUDO.test(selector)) {
        const stripped = stripStates(selector);
        base =
          index.get(key(rule.source.scope, stripped)) ??
          (rule.source.scope === 'global' ? undefined : index.get(key('global', stripped))) ??
          [];
      }
      const colorDeclaration = ownColor ?? lastDeclaration(base, ['color']);
      const backgroundDeclaration =
        ownBackground ?? lastDeclaration(base, ['background', 'background-color']);
      // Sans couleur de texte (ni dans la règle, ni dans sa règle de base), le
      // texte garde celle qu'il hérite : --text de la surface. Un fond posé seul
      // est donc vérifié avec --text, comme une règle « color: inherit ».
      const inherited = !colorDeclaration;
      if (inherited && !backgroundDeclaration) continue;
      const foregroundLabel = colorDeclaration ? colorDeclaration.value : 'var(--text) (héritée)';

      // Surfaces concernées : la dernière nommée dans le sélecteur, sinon toutes.
      const normalized = normalizeSelector(selector);
      const named = [...normalized.matchAll(/\.surface-([\w-]+)/g)]
        .map((match) => tokens.contexts.find((context) => context.name === match[1]))
        .filter(Boolean);
      const contexts =
        named.length > 0
          ? [named[named.length - 1]]
          : normalized === ':root' || normalized === 'html'
            ? defaultContexts
            : tokens.contexts;

      const localVars = customProperties([...base, ...rule.declarations]);
      const scopesFor = (context) => [localVars, rule.fileVars, context.vars];
      const background = backgroundDeclaration
        ? contexts.map((context) => resolveBackground(backgroundDeclaration, scopesFor(context)))
        : [];
      const hasSolid = background.some(
        (entry) => entry.state === 'solid' || entry.state === 'unknown',
      );

      if (!backgroundDeclaration || !hasSolid) {
        // Vérification 3 : une couleur seule doit être un rôle de texte.
        if (!ownColor || seenGuards.has(ownColor)) continue;
        seenGuards.add(ownColor);
        const kind = classifyTextColor(
          ownColor.value,
          [localVars, rule.fileVars],
          tokens.roles,
          tokens.globals,
        );
        if (kind === 'role' || kind === 'keyword') continue;
        results.push({
          check: 'guard',
          surfaces: [],
          subject: selector,
          foreground: ownColor.value,
          background: background.some((entry) => entry.state === 'image')
            ? '(image ou dégradé)'
            : '(aucun fond uni)',
          ratio: null,
          threshold: TEXT_THRESHOLD,
          ok: false,
          file: rule.source.file,
          line: lineOf(rule.source, ownColor),
          message:
            kind === 'non-text-role'
              ? `couleur de texte non vérifiée : ${ownColor.value} n'est pas un rôle de texte (--text, --text-muted, --link, --link-hover, --success)`
              : kind === 'unknown'
                ? `couleur de texte non vérifiable : ${ownColor.value}`
                : 'couleur de texte non vérifiée : utilisez un rôle (--text, --text-muted, --link, --link-hover, --success) ou déclarez le fond dans la même règle',
        });
        continue;
      }

      // Vérification 2 : la couleur et le fond, surface par surface.
      const pairKey = [
        idOf(colorDeclaration),
        idOf(backgroundDeclaration),
        ...contexts.map((context) => context.name),
      ].join('|');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      /** @type {Map<string, ContrastResult>} */
      const grouped = new Map();
      contexts.forEach((context, position) => {
        const scopes = scopesFor(context);
        const backgroundState = background[position];
        let foreground = colorDeclaration
          ? resolveColor(colorDeclaration.value, scopes)
          : resolveColor('var(--text)', [context.vars]);
        if (foreground.state === 'keyword') {
          // Couleur héritée : celle du texte de la surface.
          const lower = foreground.text.toLowerCase();
          if (lower === 'inherit' || lower === 'unset' || lower === 'currentcolor') {
            foreground = resolveColor('var(--text)', [context.vars]);
          } else {
            return;
          }
        }
        const baseResult = {
          check: /** @type {const} */ ('pair'),
          surfaces: [context.name],
          subject: selector,
          threshold: TEXT_THRESHOLD,
          file: rule.source.file,
          line: lineOf(rule.source, rule.node),
        };
        if (foreground.state !== 'color' || backgroundState.state !== 'solid' || !context.surface) {
          if (backgroundState.state === 'none' || backgroundState.state === 'image') return;
          const unknown = [foreground, backgroundState].find((entry) => entry.state === 'unknown');
          const id = `?${unknown && 'text' in unknown ? unknown.text : ''}`;
          if (grouped.has(id)) {
            grouped.get(id)?.surfaces.push(context.name);
            return;
          }
          grouped.set(id, {
            ...baseResult,
            foreground: foregroundLabel,
            background: backgroundDeclaration.value,
            ratio: null,
            ok: false,
            message: `valeur non vérifiable : ${unknown && 'text' in unknown ? unknown.text : '?'}`,
          });
          return;
        }
        const backdrop = composite(backgroundState.color, context.surface);
        // Texte hérité sur le fond même de la surface : déjà vérifié par les rôles.
        if (inherited && toHex(backdrop) === toHex(context.surface)) return;
        const visible = composite(foreground.color, backdrop);
        const ratio = contrastRatio(visible, backdrop);
        const id = `${toHex(visible)}/${toHex(backdrop)}`;
        if (grouped.has(id)) {
          grouped.get(id)?.surfaces.push(context.name);
          return;
        }
        grouped.set(id, {
          ...baseResult,
          foreground: `${foregroundLabel} ${toHex(visible)}`,
          background: `${backgroundDeclaration.value} ${toHex(backdrop)}`,
          ratio,
          ok: ratio >= TEXT_THRESHOLD,
          message:
            backgroundState.withImage && ratio >= TEXT_THRESHOLD
              ? 'image de fond ignorée : contraste calculé sur la couleur de fond'
              : '',
        });
      });
      results.push(...grouped.values());
    }
  }
  return results;
}
