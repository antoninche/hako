/**
 * Lecture tolérante du HTML produit par la construction (dist/) : balises
 * ouvrantes, attributs et contenu brut des <script> et <style>.
 * Les commentaires <!-- … --> et les sections <![CDATA[ … ]]> sont ignorés.
 */

import { decodeEntities } from './text.mjs';

/** Éléments dont le contenu est du texte brut (pas de balises dedans). */
const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'noembed']);

/**
 * @typedef {{ name: string, value: string, offset: number }} HtmlAttribute
 * @typedef {{ name: string, attributes: HtmlAttribute[], start: number, end: number, content: string | null, contentStart: number }} HtmlTag
 */

/**
 * Parcourt les balises ouvrantes d'un document HTML ou SVG.
 * @param {string} text
 * @returns {HtmlTag[]}
 */
export function scanTags(text) {
  /** @type {HtmlTag[]} */
  const tags = [];
  let pos = 0;
  while (pos < text.length) {
    const lt = text.indexOf('<', pos);
    if (lt === -1) break;
    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4);
      pos = end === -1 ? text.length : end + 3;
      continue;
    }
    if (text.startsWith('<![CDATA[', lt)) {
      const end = text.indexOf(']]>', lt + 9);
      pos = end === -1 ? text.length : end + 3;
      continue;
    }
    const next = text[lt + 1] ?? '';
    if (next === '!' || next === '?' || next === '/') {
      const end = text.indexOf('>', lt + 1);
      pos = end === -1 ? text.length : end + 1;
      continue;
    }
    if (!/[A-Za-z]/.test(next)) {
      pos = lt + 1;
      continue;
    }
    const tag = readTag(text, lt);
    pos = tag.end;
    const lower = tag.name.toLowerCase();
    if (RAW_TEXT_ELEMENTS.has(lower) && !tag.selfClosing) {
      const closing = new RegExp(`</${lower}\\s*>`, 'gi');
      closing.lastIndex = pos;
      const match = closing.exec(text);
      const contentEnd = match ? match.index : text.length;
      tags.push({
        name: lower,
        attributes: tag.attributes,
        start: lt,
        end: tag.end,
        content: text.slice(pos, contentEnd),
        contentStart: pos,
      });
      pos = match ? match.index + match[0].length : text.length;
      continue;
    }
    tags.push({
      name: lower,
      attributes: tag.attributes,
      start: lt,
      end: tag.end,
      content: null,
      contentStart: tag.end,
    });
  }
  return tags;
}

/**
 * @param {string} text
 * @param {number} start position du « < »
 */
function readTag(text, start) {
  let pos = start + 1;
  while (pos < text.length && /[^\s/>]/.test(text[pos])) pos += 1;
  const name = text.slice(start + 1, pos);
  /** @type {HtmlAttribute[]} */
  const attributes = [];
  let selfClosing = false;
  while (pos < text.length) {
    const char = text[pos];
    if (/\s/.test(char)) {
      pos += 1;
      continue;
    }
    if (char === '>') {
      pos += 1;
      break;
    }
    if (char === '/') {
      if (text[pos + 1] === '>') {
        selfClosing = true;
        pos += 2;
        break;
      }
      pos += 1;
      continue;
    }
    const nameStart = pos;
    while (pos < text.length && /[^\s/>=]/.test(text[pos])) pos += 1;
    const attributeName = text.slice(nameStart, pos).toLowerCase();
    let cursor = pos;
    while (/\s/.test(text[cursor] ?? '')) cursor += 1;
    if (text[cursor] !== '=') {
      attributes.push({ name: attributeName, value: '', offset: nameStart });
      continue;
    }
    pos = cursor + 1;
    while (/\s/.test(text[pos] ?? '')) pos += 1;
    const quote = text[pos];
    let raw;
    if (quote === '"' || quote === "'") {
      const end = text.indexOf(quote, pos + 1);
      raw = text.slice(pos + 1, end === -1 ? text.length : end);
      pos = end === -1 ? text.length : end + 1;
    } else {
      const valueStart = pos;
      while (pos < text.length && /[^\s>]/.test(text[pos])) pos += 1;
      raw = text.slice(valueStart, pos);
    }
    attributes.push({ name: attributeName, value: decodeEntities(raw), offset: nameStart });
  }
  return { name, attributes, selfClosing, end: pos };
}

/**
 * @param {HtmlTag} tag
 * @param {string} name
 */
export function attributeOf(tag, name) {
  return tag.attributes.find((attribute) => attribute.name === name);
}

/**
 * Adresses d'un attribut srcset : « a.png 1x, b.png 2x ».
 * @param {string} value
 */
export function parseSrcset(value) {
  const urls = [];
  let pos = 0;
  while (pos < value.length) {
    while (pos < value.length && /[\s,]/.test(value[pos])) pos += 1;
    const start = pos;
    while (pos < value.length && !/\s/.test(value[pos])) pos += 1;
    let url = value.slice(start, pos);
    if (url.endsWith(',')) url = url.replace(/,+$/, '');
    else {
      // Descripteurs (« 2x », « 640w ») jusqu'à la virgule suivante.
      let depth = 0;
      while (pos < value.length && !(value[pos] === ',' && depth === 0)) {
        if (value[pos] === '(') depth += 1;
        if (value[pos] === ')') depth -= 1;
        pos += 1;
      }
    }
    if (url) urls.push(url);
  }
  return urls;
}
