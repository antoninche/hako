/**
 * Petits outils de texte partagés par les scripts du dossier scripts/.
 */

/**
 * Prépare la conversion d'une position (index dans le texte) en ligne et
 * colonne, toutes deux comptées à partir de 1.
 * @param {string} text
 * @returns {(offset: number) => { line: number, column: number }}
 */
export function createLocator(text) {
  const lineStarts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) lineStarts.push(i + 1);
  }
  return (offset) => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (lineStarts[middle] <= offset) low = middle;
      else high = middle - 1;
    }
    return { line: low + 1, column: offset - lineStarts[low] + 1 };
  };
}

/**
 * Réduit toute suite d'espaces (retours à la ligne compris) à une espace.
 * @param {string} value
 */
export function collapseWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  laquo: '«',
  raquo: '»',
  rsquo: '’',
  lsquo: '‘',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  euro: '€',
};

/**
 * Décode les entités HTML courantes (&amp;, &#39;, &#x27;…).
 * @param {string} value
 */
export function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, body) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/**
 * Lit une séquence d'échappement JavaScript qui commence par « \ » à la
 * position donnée. Renvoie le texte produit et la longueur consommée.
 * @param {string} text
 * @param {number} start position de la barre oblique inverse
 * @returns {{ value: string, length: number }}
 */
export function readEscape(text, start) {
  const next = text[start + 1];
  if (next === undefined) return { value: '', length: 1 };
  const simple = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };
  if (next === '\r' && text[start + 2] === '\n') return { value: '', length: 3 };
  if (next === '\n' || next === '\r' || next === '\u2028' || next === '\u2029') {
    return { value: '', length: 2 };
  }
  if (next === 'x') {
    const hex = text.slice(start + 2, start + 4);
    if (/^[0-9a-f]{2}$/i.test(hex)) {
      return { value: String.fromCharCode(Number.parseInt(hex, 16)), length: 4 };
    }
  }
  if (next === 'u') {
    if (text[start + 2] === '{') {
      const end = text.indexOf('}', start + 3);
      const hex = end === -1 ? '' : text.slice(start + 3, end);
      if (/^[0-9a-f]{1,6}$/i.test(hex)) {
        return { value: String.fromCodePoint(Number.parseInt(hex, 16)), length: end - start + 1 };
      }
    } else {
      const hex = text.slice(start + 2, start + 6);
      if (/^[0-9a-f]{4}$/i.test(hex)) {
        return { value: String.fromCharCode(Number.parseInt(hex, 16)), length: 6 };
      }
    }
  }
  if (Object.hasOwn(simple, next) && !(next === '0' && /[0-9]/.test(text[start + 2] ?? ''))) {
    return { value: simple[next], length: 2 };
  }
  return { value: next, length: 2 };
}

/**
 * Accorde un nom avec un nombre : plural(2, 'fichier') → « 2 fichiers ».
 * En français, 0 et 1 restent au singulier.
 * @param {number} count
 * @param {string} singular
 * @param {string} [pluralForm]
 */
export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${Math.abs(count) >= 2 ? pluralForm : singular}`;
}

/**
 * Met en forme un tableau de texte aligné, sans dépendance.
 * @param {string[]} headers
 * @param {string[][]} rows
 */
export function formatTable(headers, rows) {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => (row[index] ?? '').length)),
  );
  const line = (cells) =>
    cells
      .map((cell, index) => (cell ?? '').padEnd(widths[index]))
      .join('  ')
      .trimEnd();
  return [line(headers), line(widths.map((width) => '-'.repeat(width))), ...rows.map(line)].join(
    '\n',
  );
}

/**
 * Chemin au format POSIX (barres obliques), pour des sorties identiques sur
 * tous les systèmes.
 * @param {string} value
 */
export function toPosix(value) {
  return value.split('\\').join('/');
}
