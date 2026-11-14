/**
 * Couleurs : lecture des valeurs CSS, superposition des transparences et
 * calcul du contraste selon les WCAG 2.x.
 *
 * Formules : https://www.w3.org/TR/WCAG22/#dfn-relative-luminance et
 * https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio (seuil sRGB 0,04045 ;
 * l'ancienne valeur 0,03928 donne exactement les mêmes résultats pour des
 * couleurs codées sur 8 bits).
 */

/** @typedef {{ r: number, g: number, b: number, a: number }} Rgba */

/**
 * @param {string} value
 * @param {number} scale valeur qui correspond à 100 %
 */
function parseComponent(value, scale) {
  const text = value.trim().toLowerCase();
  if (text === 'none') return 0;
  if (text.endsWith('%')) {
    const percent = Number.parseFloat(text);
    return Number.isFinite(percent) ? (percent / 100) * scale : Number.NaN;
  }
  return Number.parseFloat(text);
}

/** @param {number} value */
function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/**
 * Sépare les arguments d'une fonction de couleur : « 65 45 30 / 0.06 » ou
 * « 65, 45, 30, 0.06 ».
 * @param {string} inner
 */
function splitArguments(inner) {
  const [channels, alpha] = inner.split('/');
  const parts = channels.includes(',')
    ? channels.split(',').map((part) => part.trim())
    : channels.trim().split(/\s+/);
  if (alpha !== undefined) parts.push(alpha.trim());
  return parts.filter((part) => part !== '');
}

/**
 * @param {number} hue en degrés
 * @param {number} saturation entre 0 et 1
 * @param {number} lightness entre 0 et 1
 */
function hslToRgb(hue, saturation, lightness) {
  const h = (((hue % 360) + 360) % 360) / 360;
  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const channel = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)].map((value) => value * 255);
}

/**
 * Lit une couleur CSS : #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba(),
 * hsl()/hsla() et transparent. Toute autre valeur (couleur nommée,
 * color-mix()…) donne null.
 * @param {string} value
 * @returns {Rgba | null}
 */
export function parseColor(value) {
  const text = value.trim().toLowerCase();
  if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);
  if (hex) {
    let digits = hex[1];
    if (digits.length <= 4) digits = [...digits].map((digit) => digit + digit).join('');
    const read = (index) => Number.parseInt(digits.slice(index, index + 2), 16);
    return {
      r: read(0),
      g: read(2),
      b: read(4),
      a: digits.length === 8 ? read(6) / 255 : 1,
    };
  }

  const rgb = /^rgba?\((.*)\)$/.exec(text);
  if (rgb) {
    const parts = splitArguments(rgb[1]);
    if (parts.length < 3 || parts.length > 4) return null;
    const [r, g, b] = parts.slice(0, 3).map((part) => parseComponent(part, 255));
    const a = parts[3] === undefined ? 1 : parseComponent(parts[3], 1);
    if (![r, g, b, a].every(Number.isFinite)) return null;
    return {
      r: Math.min(255, Math.max(0, r)),
      g: Math.min(255, Math.max(0, g)),
      b: Math.min(255, Math.max(0, b)),
      a: clamp01(a),
    };
  }

  const hsl = /^hsla?\((.*)\)$/.exec(text);
  if (hsl) {
    const parts = splitArguments(hsl[1]);
    if (parts.length < 3 || parts.length > 4) return null;
    const hue = Number.parseFloat(parts[0].replace(/deg$/, ''));
    const saturation = clamp01(parseComponent(parts[1], 1));
    const lightness = clamp01(parseComponent(parts[2], 1));
    const a = parts[3] === undefined ? 1 : parseComponent(parts[3], 1);
    if (![hue, saturation, lightness, a].every(Number.isFinite)) return null;
    const [r, g, b] = hslToRgb(hue, saturation, lightness);
    return { r, g, b, a: clamp01(a) };
  }

  return null;
}

/**
 * Superpose une couleur (éventuellement transparente) sur un fond opaque.
 * @param {Rgba} top
 * @param {Rgba} bottom
 * @returns {Rgba}
 */
export function composite(top, bottom) {
  const mix = (front, back) => front * top.a + back * (1 - top.a);
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

/**
 * Luminance relative (WCAG 2.x).
 * @param {Rgba} color
 */
export function relativeLuminance(color) {
  const linear = (channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

/**
 * Rapport de contraste entre deux couleurs opaques (de 1 à 21).
 * @param {Rgba} first
 * @param {Rgba} second
 */
export function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Écriture hexadécimale (#rrggbb, ou #rrggbbaa si la couleur est transparente).
 * @param {Rgba} color
 */
export function toHex(color) {
  const byte = (value) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, '0');
  const alpha = color.a < 1 ? byte(color.a * 255) : '';
  return `#${byte(color.r)}${byte(color.g)}${byte(color.b)}${alpha}`;
}

/**
 * Rapport affiché à la française, tronqué (jamais arrondi vers le haut) :
 * 4,499 s'affiche 4,49 et ne peut pas passer pour 4,5.
 * @param {number} ratio
 */
export function formatRatio(ratio) {
  // Le petit terme évite qu'une erreur d'arrondi binaire (12,21 lu 12,2099…) fasse perdre un centième.
  return `${(Math.floor(ratio * 100 + 1e-9) / 100).toFixed(2).replace('.', ',')}:1`;
}
