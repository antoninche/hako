/**
 * Lecture des sources du site (.ts, .astro, .md, .mdx) sans les exécuter.
 *
 * Le lecteur distingue le code (chaînes, gabarits `…`, commentaires,
 * expressions régulières) du balisage (texte, balises, commentaires HTML).
 * Il peut ainsi ignorer tout ce qui est en commentaire et lire le texte
 * français avec ses apostrophes sans les prendre pour des guillemets.
 *
 * Il relève :
 * - les appels todo('ce qui manque', '[texte provisoire]') ;
 * - les composants <Todo what="ce qui manque">[texte provisoire]</Todo> ;
 * - si demandé, les valeurs `null` suivies d'un commentaire « // TODO: … » ;
 * - les blocs <style> des composants .astro (pour le contrôle des contrastes).
 */

import { collapseWhitespace, decodeEntities, readEscape } from './text.mjs';

const ID_START = /[\p{ID_Start}$_]/u;
const ID_CONTINUE = /[\p{ID_Continue}$‌‍]/u;
const TAG_NAME = /[A-Za-z0-9_:.-]/;

/** Mots-clés après lesquels une expression (ou une expression régulière) peut commencer. */
const EXPRESSION_KEYWORDS = new Set([
  'await',
  'case',
  'default',
  'delete',
  'do',
  'else',
  'extends',
  'function',
  'in',
  'instanceof',
  'new',
  'of',
  'return',
  'throw',
  'typeof',
  'void',
  'yield',
]);

const OPERATORS = [
  '>>>=',
  '...',
  '===',
  '!==',
  '**=',
  '<<=',
  '>>=',
  '>>>',
  '&&=',
  '||=',
  '??=',
  '=>',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '??',
  '?.',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '&=',
  '|=',
  '^=',
  '**',
  '<<',
  '>>',
];

/** Éléments HTML sans balise fermante. */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/** Ce qui peut précéder une valeur `null` de données (« prix: null », « = null »…). */
const NULL_VALUE_PREFIXES = new Set([':', '=', ',', '[', '(']);

const NULL_TODO_COMMENT = /^\s*TODO\s*:\s*(.+?)\s*$/i;

/** @param {string | undefined} char */
function isIdentifierStart(char) {
  return char !== undefined && ID_START.test(char);
}

/** @param {string | undefined} char */
function isIdentifierChar(char) {
  return char !== undefined && ID_CONTINUE.test(char);
}

/** @param {string | undefined} char */
function isSpace(char) {
  return char !== undefined && /\s/.test(char);
}

/**
 * Peut-on trouver ici le début d'une expression (et donc une expression
 * régulière ou un élément JSX) plutôt qu'un opérateur ?
 * @param {string | null} previous dernier élément significatif lu
 */
function expressionAllowed(previous) {
  return previous === null || (previous !== 'value' && previous !== '}');
}

/** @param {string | null} previous */
function regexAllowed(previous) {
  return previous === null || previous !== 'value';
}

/**
 * Repère l'en-tête de code (« frontmatter ») d'un composant .astro.
 * @param {string} text
 */
function findFrontmatter(text) {
  const open = /^\s*---[ \t]*\r?\n/.exec(text);
  if (!open) return null;
  const codeStart = open[0].length;
  const close = /^---[ \t]*$/gm;
  close.lastIndex = codeStart;
  const match = close.exec(text);
  if (!match) return { codeStart, codeEnd: text.length, end: text.length };
  return { codeStart, codeEnd: match.index, end: match.index + match[0].length };
}

/**
 * Nettoie le contenu d'un <Todo> pour en faire un texte provisoire lisible.
 * @param {string} raw
 */
function cleanPlaceholder(raw) {
  return collapseWhitespace(
    decodeEntities(raw.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '')),
  );
}

/**
 * @typedef {{ type: 'call' | 'element' | 'null', offset: number, what: string, placeholder: string }} RawTodo
 * @typedef {{ offset: number, message: string }} ScanWarning
 * @typedef {{ offset: number, content: string, attributes: Record<string, string> }} StyleBlock
 * @typedef {{ todos: RawTodo[], styles: StyleBlock[], warnings: ScanWarning[] }} ScanResult
 * @typedef {'code' | 'astro' | 'markdown' | 'mdx'} SourceKind
 */

class SourceScanner {
  /**
   * @param {string} text
   * @param {{ kind: SourceKind, nullTodos?: boolean }} options
   */
  constructor(text, options) {
    this.text = text;
    this.kind = options.kind;
    this.nullTodos = options.nullTodos ?? false;
    this.pos = 0;
    /** @type {RawTodo[]} */
    this.todos = [];
    /** @type {StyleBlock[]} */
    this.styles = [];
    /** @type {ScanWarning[]} */
    this.warnings = [];
  }

  run() {
    if (this.kind === 'code') {
      this.scanCode({ stopAtBrace: false, jsx: false });
      return;
    }
    if (this.kind === 'astro') {
      const frontmatter = findFrontmatter(this.text);
      if (frontmatter) {
        this.scanCodeRegion(frontmatter.codeStart, frontmatter.codeEnd);
        this.pos = frontmatter.end;
      }
      this.scanMarkup({ mode: 'document', expressions: true, textCalls: false, markdown: false });
      return;
    }
    this.scanMarkup({
      mode: 'document',
      expressions: this.kind === 'mdx',
      textCalls: true,
      markdown: true,
    });
  }

  /**
   * Lit une portion du texte comme du code TypeScript (en-tête .astro,
   * contenu d'un <script>) et reporte ce qui y est trouvé.
   * @param {number} start
   * @param {number} end
   */
  scanCodeRegion(start, end) {
    const region = new SourceScanner(this.text.slice(start, end), {
      kind: 'code',
      nullTodos: this.nullTodos,
    });
    region.run();
    for (const todo of region.todos) this.todos.push({ ...todo, offset: todo.offset + start });
    for (const warning of region.warnings) {
      this.warnings.push({ ...warning, offset: warning.offset + start });
    }
  }

  // ---------------------------------------------------------------- code

  /**
   * Parcourt du code jusqu'à la fin du texte, ou jusqu'à l'accolade fermante
   * qui termine l'expression en cours (`stopAtBrace`).
   * @param {{ stopAtBrace: boolean, jsx: boolean }} options
   */
  scanCode({ stopAtBrace, jsx }) {
    const text = this.text;
    let depth = 0;
    /** @type {string | null} */
    let previous = null;
    while (this.pos < text.length) {
      const char = text[this.pos];
      const next = text[this.pos + 1];
      if (isSpace(char)) {
        this.pos += 1;
      } else if (char === '/' && next === '/') {
        this.skipLineComment();
      } else if (char === '/' && next === '*') {
        this.skipBlockComment();
      } else if (char === '"' || char === "'") {
        this.readString();
        previous = 'value';
      } else if (char === '`') {
        this.readTemplate(jsx);
        previous = 'value';
      } else if (isIdentifierStart(char)) {
        const start = this.pos;
        const word = this.readIdentifier();
        const member = previous === '.' || previous === '?.';
        if (word === 'todo' && !member && previous !== 'keyword:function') {
          if (this.tryTodoCall(start, true)) {
            previous = 'value';
            continue;
          }
        }
        if (word === 'null' && this.nullTodos && previous !== null) {
          if (NULL_VALUE_PREFIXES.has(previous)) this.checkNullTodo(start);
        }
        previous = !member && EXPRESSION_KEYWORDS.has(word) ? `keyword:${word}` : 'value';
      } else if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(next ?? ''))) {
        this.readNumber();
        previous = 'value';
      } else if (char === '{') {
        depth += 1;
        this.pos += 1;
        previous = '{';
      } else if (char === '}') {
        if (depth === 0 && stopAtBrace) return;
        depth = Math.max(0, depth - 1);
        this.pos += 1;
        previous = '}';
      } else if (char === '(' || char === '[') {
        this.pos += 1;
        previous = char;
      } else if (char === ')' || char === ']') {
        this.pos += 1;
        previous = 'value';
      } else if (char === '/' && regexAllowed(previous)) {
        this.readRegex();
        previous = 'value';
      } else if (
        char === '<' &&
        jsx &&
        expressionAllowed(previous) &&
        (isIdentifierStart(next) || next === '>')
      ) {
        this.scanMarkup({ mode: 'element', expressions: true, textCalls: false, markdown: false });
        previous = 'value';
      } else {
        previous = this.readOperator();
      }
    }
  }

  skipLineComment() {
    const end = this.text.indexOf('\n', this.pos);
    this.pos = end === -1 ? this.text.length : end;
  }

  skipBlockComment() {
    const end = this.text.indexOf('*/', this.pos + 2);
    this.pos = end === -1 ? this.text.length : end + 2;
  }

  /** Espaces et commentaires. */
  skipTrivia() {
    for (;;) {
      while (isSpace(this.text[this.pos])) this.pos += 1;
      if (this.text.startsWith('//', this.pos)) this.skipLineComment();
      else if (this.text.startsWith('/*', this.pos)) this.skipBlockComment();
      else return;
    }
  }

  readIdentifier() {
    const start = this.pos;
    this.pos += 1;
    while (isIdentifierChar(this.text[this.pos])) this.pos += 1;
    return this.text.slice(start, this.pos);
  }

  readNumber() {
    this.pos += 1;
    while (/[0-9A-Za-z_.]/.test(this.text[this.pos] ?? '')) this.pos += 1;
  }

  readOperator() {
    for (const operator of OPERATORS) {
      if (this.text.startsWith(operator, this.pos)) {
        this.pos += operator.length;
        return operator;
      }
    }
    const char = this.text[this.pos] ?? '';
    this.pos += 1;
    return char;
  }

  /** Chaîne entre apostrophes ou guillemets droits, échappements décodés. */
  readString() {
    const text = this.text;
    const quote = text[this.pos];
    let value = '';
    this.pos += 1;
    while (this.pos < text.length) {
      const char = text[this.pos];
      if (char === quote) {
        this.pos += 1;
        return { value, closed: true };
      }
      if (char === '\\') {
        const escape = readEscape(text, this.pos);
        value += escape.value;
        this.pos += escape.length;
      } else if (char === '\n' || char === '\r') {
        return { value, closed: false };
      } else {
        value += char;
        this.pos += 1;
      }
    }
    return { value, closed: false };
  }

  /**
   * Gabarit `…`. Il est « statique » s'il ne contient aucune interpolation ${…}.
   * @param {boolean} jsx
   */
  readTemplate(jsx) {
    const text = this.text;
    let value = '';
    let isStatic = true;
    this.pos += 1;
    while (this.pos < text.length) {
      const char = text[this.pos];
      if (char === '`') {
        this.pos += 1;
        return { value, isStatic, closed: true };
      }
      if (char === '\\') {
        const escape = readEscape(text, this.pos);
        value += escape.value;
        this.pos += escape.length;
      } else if (char === '$' && text[this.pos + 1] === '{') {
        isStatic = false;
        this.pos += 2;
        this.scanCode({ stopAtBrace: true, jsx });
        if (text[this.pos] === '}') this.pos += 1;
      } else if (char === '\r') {
        value += '\n';
        this.pos += text[this.pos + 1] === '\n' ? 2 : 1;
      } else {
        value += char;
        this.pos += 1;
      }
    }
    return { value, isStatic, closed: false };
  }

  readRegex() {
    const text = this.text;
    let inClass = false;
    this.pos += 1;
    while (this.pos < text.length) {
      const char = text[this.pos];
      if (char === '\\') {
        this.pos += 2;
        continue;
      }
      if (char === '\n') return;
      if (char === '[') inClass = true;
      else if (char === ']') inClass = false;
      else if (char === '/' && !inClass) {
        this.pos += 1;
        while (isIdentifierChar(text[this.pos])) this.pos += 1;
        return;
      }
      this.pos += 1;
    }
  }

  /**
   * Texte littéral (chaîne ou gabarit sans interpolation) à la position
   * courante, ou null.
   * @returns {string | null}
   */
  readStaticString() {
    const char = this.text[this.pos];
    if (char === '"' || char === "'") {
      const literal = this.readString();
      return literal.closed ? literal.value : null;
    }
    if (char === '`') {
      const literal = this.readTemplate(false);
      return literal.closed && literal.isStatic ? literal.value : null;
    }
    return null;
  }

  /**
   * Après l'identifiant `todo` : lit un appel todo('…', '…') complet.
   * @param {number} start position de l'identifiant
   * @param {boolean} warn signaler un appel illisible (dans le code seulement)
   */
  tryTodoCall(start, warn) {
    const resume = this.pos;
    const fail = (message) => {
      if (warn && message) this.warnings.push({ offset: start, message });
      this.pos = resume;
      return false;
    };
    this.skipTrivia();
    if (this.text[this.pos] !== '(') return fail(null);
    this.pos += 1;
    const args = [];
    for (let index = 0; index < 2; index += 1) {
      this.skipTrivia();
      const value = this.readStaticString();
      if (value === null) {
        return fail(
          'appel todo() ignoré : ses deux arguments doivent être des textes écrits en toutes lettres (sans variable ni ${…})',
        );
      }
      args.push(value);
      this.skipTrivia();
      if (index === 0) {
        if (this.text[this.pos] !== ',') {
          return fail(
            'appel todo() ignoré : il faut deux arguments (ce qui manque, texte provisoire)',
          );
        }
        this.pos += 1;
      }
    }
    if (this.text[this.pos] === ',') {
      this.pos += 1;
      this.skipTrivia();
    }
    if (this.text[this.pos] !== ')') {
      return fail('appel todo() ignoré : il faut exactement deux arguments');
    }
    this.pos += 1;
    this.todos.push({
      type: 'call',
      offset: start,
      what: collapseWhitespace(args[0]),
      placeholder: collapseWhitespace(args[1]),
    });
    return true;
  }

  /**
   * `null` suivi, sur la même ligne, d'un commentaire « // TODO: description ».
   * @param {number} start
   */
  checkNullTodo(start) {
    const text = this.text;
    let cursor = this.pos;
    while (cursor < text.length && /[ \t,;)\]}]/.test(text[cursor])) cursor += 1;
    if (!text.startsWith('//', cursor)) return;
    const lineEnd = text.indexOf('\n', cursor);
    const comment = text.slice(cursor + 2, lineEnd === -1 ? text.length : lineEnd);
    const match = NULL_TODO_COMMENT.exec(comment);
    if (match) {
      this.todos.push({ type: 'null', offset: start, what: match[1], placeholder: 'null' });
    }
  }

  // ---------------------------------------------------------- balisage

  /**
   * Parcourt du balisage : un document entier, ou un seul élément (avec ses
   * enfants) quand il apparaît dans une expression {…}.
   * @param {{ mode: 'document' | 'element', expressions: boolean, textCalls: boolean, markdown: boolean }} options
   */
  scanMarkup({ mode, expressions, textCalls, markdown }) {
    const text = this.text;
    /** @type {{ name: string, contentStart: number, todo: { offset: number, what: string } | null }[]} */
    const stack = [];
    const done = () => mode === 'element' && stack.length === 0;

    while (this.pos < text.length) {
      const char = text[this.pos];

      if (markdown && (this.pos === 0 || text[this.pos - 1] === '\n') && this.skipFencedCode()) {
        continue;
      }

      if (char === '<') {
        if (text.startsWith('<!--', this.pos)) {
          const end = text.indexOf('-->', this.pos + 4);
          this.pos = end === -1 ? text.length : end + 3;
          continue;
        }
        if (text.startsWith('</', this.pos)) {
          const closeStart = this.pos;
          const name = this.readClosingTag();
          this.closeElement(stack, name, closeStart);
          if (done()) return;
          continue;
        }
        const next = text[this.pos + 1];
        if (next === '!' || next === '?') {
          const end = text.indexOf('>', this.pos);
          this.pos = end === -1 ? text.length : end + 1;
          continue;
        }
        if (isIdentifierStart(next) || next === '>') {
          const tag = this.readOpenTag();
          const todo = tag.name === 'Todo' ? this.readTodoAttribute(tag) : null;
          const isVoid = tag.name === tag.name.toLowerCase() && VOID_ELEMENTS.has(tag.name);
          if (tag.selfClosing || isVoid) {
            if (todo) this.recordTodoElement(todo, '');
            if (done() || (mode === 'element' && stack.length === 0)) return;
            continue;
          }
          if (tag.name === 'script' || tag.name === 'style') {
            this.readRawElement(tag);
            if (mode === 'element' && stack.length === 0) return;
            continue;
          }
          stack.push({ name: tag.name, contentStart: this.pos, todo });
          continue;
        }
        this.pos += 1;
        continue;
      }

      if (char === '{' && expressions) {
        this.pos += 1;
        this.scanCode({ stopAtBrace: true, jsx: true });
        if (text[this.pos] === '}') this.pos += 1;
        continue;
      }

      if (markdown && char === '`') {
        this.skipCodeSpan();
        continue;
      }

      if (
        textCalls &&
        char === 't' &&
        text.startsWith('todo', this.pos) &&
        !isIdentifierChar(text[this.pos - 1]) &&
        text[this.pos - 1] !== '.' &&
        !isIdentifierChar(text[this.pos + 4])
      ) {
        const start = this.pos;
        this.pos += 4;
        this.tryTodoCall(start, false);
        continue;
      }

      this.pos += 1;
    }
  }

  readOpenTag() {
    const text = this.text;
    const start = this.pos;
    this.pos += 1;
    const nameStart = this.pos;
    while (this.pos < text.length && TAG_NAME.test(text[this.pos])) this.pos += 1;
    const name = text.slice(nameStart, this.pos);
    /** @type {{ name: string, kind: 'string' | 'expression' | 'template' | 'boolean', value: string, isStatic: boolean }[]} */
    const attributes = [];
    let selfClosing = false;

    while (this.pos < text.length) {
      const char = text[this.pos];
      if (isSpace(char)) {
        this.pos += 1;
        continue;
      }
      if (char === '>') {
        this.pos += 1;
        break;
      }
      if (char === '/' && text[this.pos + 1] === '>') {
        selfClosing = true;
        this.pos += 2;
        break;
      }
      if (char === '{') {
        const expressionStart = this.pos + 1;
        this.pos += 1;
        this.scanCode({ stopAtBrace: true, jsx: true });
        attributes.push({
          name: '',
          kind: 'expression',
          value: text.slice(expressionStart, this.pos),
          isStatic: false,
        });
        if (text[this.pos] === '}') this.pos += 1;
        continue;
      }
      const attributeStart = this.pos;
      while (
        this.pos < text.length &&
        !/[\s=>]/.test(text[this.pos]) &&
        !(text[this.pos] === '/' && text[this.pos + 1] === '>')
      ) {
        this.pos += 1;
      }
      if (this.pos === attributeStart) {
        this.pos += 1;
        continue;
      }
      const attributeName = text.slice(attributeStart, this.pos);
      let cursor = this.pos;
      while (isSpace(text[cursor])) cursor += 1;
      if (text[cursor] !== '=') {
        attributes.push({ name: attributeName, kind: 'boolean', value: '', isStatic: true });
        continue;
      }
      this.pos = cursor + 1;
      while (isSpace(text[this.pos])) this.pos += 1;
      const quote = text[this.pos];
      if (quote === '"' || quote === "'") {
        const end = text.indexOf(quote, this.pos + 1);
        const valueEnd = end === -1 ? text.length : end;
        attributes.push({
          name: attributeName,
          kind: 'string',
          value: text.slice(this.pos + 1, valueEnd),
          isStatic: true,
        });
        this.pos = Math.min(text.length, valueEnd + 1);
      } else if (quote === '{') {
        const expressionStart = this.pos + 1;
        this.pos += 1;
        this.scanCode({ stopAtBrace: true, jsx: true });
        attributes.push({
          name: attributeName,
          kind: 'expression',
          value: text.slice(expressionStart, this.pos),
          isStatic: false,
        });
        if (text[this.pos] === '}') this.pos += 1;
      } else if (quote === '`') {
        const template = this.readTemplate(true);
        attributes.push({
          name: attributeName,
          kind: 'template',
          value: template.value,
          isStatic: template.isStatic,
        });
      } else {
        const valueStart = this.pos;
        while (this.pos < text.length && !/[\s>]/.test(text[this.pos])) this.pos += 1;
        attributes.push({
          name: attributeName,
          kind: 'string',
          value: text.slice(valueStart, this.pos),
          isStatic: true,
        });
      }
    }
    return { name, start, attributes, selfClosing };
  }

  readClosingTag() {
    const text = this.text;
    this.pos += 2;
    const nameStart = this.pos;
    while (this.pos < text.length && TAG_NAME.test(text[this.pos])) this.pos += 1;
    const name = text.slice(nameStart, this.pos);
    const end = text.indexOf('>', this.pos);
    this.pos = end === -1 ? text.length : end + 1;
    return name;
  }

  /**
   * <script> et <style> : contenu brut jusqu'à la balise fermante. Les styles
   * sont mis de côté ; les scripts d'un composant .astro sont lus comme du code.
   * @param {{ name: string, attributes: { name: string, value: string }[] }} tag
   */
  readRawElement(tag) {
    const text = this.text;
    const contentStart = this.pos;
    const closing = new RegExp(`</${tag.name}\\s*>`, 'gi');
    closing.lastIndex = contentStart;
    const match = closing.exec(text);
    const contentEnd = match ? match.index : text.length;
    if (tag.name === 'style') {
      /** @type {Record<string, string>} */
      const attributes = {};
      for (const attribute of tag.attributes) {
        if (attribute.name) attributes[attribute.name] = attribute.value;
      }
      this.styles.push({
        offset: contentStart,
        content: text.slice(contentStart, contentEnd),
        attributes,
      });
    } else if (this.kind === 'astro') {
      this.scanCodeRegion(contentStart, contentEnd);
    }
    this.pos = match ? match.index + match[0].length : text.length;
  }

  /**
   * @param {{ name: string, contentStart: number, todo: { offset: number, what: string } | null }[]} stack
   * @param {string} name
   * @param {number} closeStart
   */
  closeElement(stack, name, closeStart) {
    let index = -1;
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const open = stack[i].name;
      if (open === name || (open === open.toLowerCase() && open === name.toLowerCase())) {
        index = i;
        break;
      }
    }
    if (index === -1) return;
    for (let i = stack.length - 1; i >= index; i -= 1) {
      const element = stack[i];
      if (element.todo) {
        this.recordTodoElement(element.todo, this.text.slice(element.contentStart, closeStart));
      }
    }
    stack.length = index;
  }

  /**
   * Valeur de l'attribut `what` d'un <Todo>, si elle est écrite en toutes
   * lettres. Un `what={valeur.todo}` calculé (composant d'affichage comme
   * <Fact>) n'est pas une source : il est ignoré sans avertissement.
   * @param {{ start: number, attributes: { name: string, kind: string, value: string, isStatic: boolean }[] }} tag
   */
  readTodoAttribute(tag) {
    const attribute = tag.attributes.find((candidate) => candidate.name === 'what');
    if (!attribute) {
      this.warnings.push({ offset: tag.start, message: '<Todo> sans attribut what' });
      return null;
    }
    if (attribute.kind === 'string') {
      return { offset: tag.start, what: collapseWhitespace(decodeEntities(attribute.value)) };
    }
    if (attribute.kind === 'template') {
      return attribute.isStatic
        ? { offset: tag.start, what: collapseWhitespace(attribute.value) }
        : null;
    }
    if (attribute.kind === 'expression') {
      const value = staticStringOf(attribute.value);
      return value === null ? null : { offset: tag.start, what: collapseWhitespace(value) };
    }
    return null;
  }

  /**
   * @param {{ offset: number, what: string }} todo
   * @param {string} rawContent
   */
  recordTodoElement(todo, rawContent) {
    const placeholder = cleanPlaceholder(rawContent);
    if (!placeholder) {
      this.warnings.push({ offset: todo.offset, message: '<Todo> sans texte provisoire' });
    }
    this.todos.push({ type: 'element', offset: todo.offset, what: todo.what, placeholder });
  }

  /** Bloc de code Markdown entre ``` ou ~~~ (ligne d'ouverture à la position courante). */
  skipFencedCode() {
    const text = this.text;
    const lineEnd = text.indexOf('\n', this.pos);
    const line = text.slice(this.pos, lineEnd === -1 ? text.length : lineEnd);
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (!open) return false;
    const fence = open[1];
    const closing = new RegExp(`^ {0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`);
    let cursor = lineEnd === -1 ? text.length : lineEnd + 1;
    while (cursor < text.length) {
      const end = text.indexOf('\n', cursor);
      const current = text.slice(cursor, end === -1 ? text.length : end);
      cursor = end === -1 ? text.length : end + 1;
      if (closing.test(current)) break;
    }
    this.pos = cursor;
    return true;
  }

  /** Code en ligne Markdown `…` (même nombre d'accents graves pour fermer). */
  skipCodeSpan() {
    const text = this.text;
    let length = 0;
    while (text[this.pos + length] === '`') length += 1;
    const closing = new RegExp(`(?<!\`)\`{${length}}(?!\`)`, 'g');
    closing.lastIndex = this.pos + length;
    const match = closing.exec(text);
    this.pos = match ? match.index + length : this.pos + length;
  }
}

/**
 * Valeur d'une expression qui n'est qu'un texte littéral ('…', "…" ou `…`
 * sans interpolation), sinon null.
 * @param {string} expression
 */
export function staticStringOf(expression) {
  const scanner = new SourceScanner(expression, { kind: 'code' });
  scanner.skipTrivia();
  const value = scanner.readStaticString();
  if (value === null) return null;
  scanner.skipTrivia();
  return scanner.pos >= expression.length ? value : null;
}

/**
 * Lit un fichier source et renvoie ce qu'il contient d'intéressant.
 * @param {string} text contenu du fichier
 * @param {{ kind: SourceKind, nullTodos?: boolean }} options
 * @returns {ScanResult}
 */
export function scanSource(text, options) {
  const scanner = new SourceScanner(text, options);
  scanner.run();
  const byOffset = (a, b) => a.offset - b.offset;
  return {
    todos: scanner.todos.sort(byOffset),
    styles: scanner.styles.sort(byOffset),
    warnings: scanner.warnings.sort(byOffset),
  };
}

/**
 * Type de lecture selon l'extension du fichier.
 * @param {string} file
 * @returns {SourceKind | null}
 */
export function kindOf(file) {
  const extension = /\.[^./]+$/.exec(file)?.[0]?.toLowerCase();
  if (extension === '.ts' || extension === '.mts' || extension === '.js' || extension === '.mjs') {
    return 'code';
  }
  if (extension === '.astro') return 'astro';
  if (extension === '.md') return 'markdown';
  if (extension === '.mdx') return 'mdx';
  return null;
}
