/**
 * Contrôle du site construit (dist/) : ce que le navigateur recevra
 * vraiment. Il vérifie les promesses du site :
 * - aucune ressource chargée depuis un autre site (scripts, styles, polices,
 *   images, iframes, préconnexions…) ;
 * - une sortie compatible avec une politique de sécurité stricte
 *   (Content-Security-Policy « default-src 'self' ») : pas de script en
 *   ligne exécutable, pas d'attribut style, pas de <style> en ligne, pas
 *   d'URI data: ;
 * - aucun cookie ni stockage persistant dans le JavaScript.
 * Les liens <a href> vers d'autres sites sont permis (ce ne sont pas des
 * téléchargements) : ils sont seulement listés pour information.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import postcss from 'postcss';

import { listFiles } from './files.mjs';
import { attributeOf, parseSrcset, scanTags } from './html-scanner.mjs';
import { collapseWhitespace, createLocator } from './text.mjs';

/** Valeurs de rel qui ne déclenchent aucun téléchargement. */
const NAVIGATION_RELS = new Set([
  'alternate',
  'author',
  'bookmark',
  'canonical',
  'external',
  'help',
  'license',
  'me',
  'next',
  'nofollow',
  'noopener',
  'noreferrer',
  'opener',
  'prev',
  'privacy-policy',
  'search',
  'sitemap',
  'tag',
  'terms-of-service',
]);

/** Attributs qui font télécharger une ressource, par élément. */
const RESOURCE_ATTRIBUTES = {
  audio: ['src'],
  base: ['href'],
  button: ['formaction'],
  embed: ['src'],
  feimage: ['href', 'xlink:href'],
  form: ['action'],
  frame: ['src'],
  iframe: ['src'],
  image: ['href', 'xlink:href'],
  img: ['src', 'srcset'],
  input: ['src', 'formaction'],
  link: ['href', 'imagesrcset'],
  object: ['data'],
  script: ['src', 'href', 'xlink:href'],
  source: ['src', 'srcset'],
  track: ['src'],
  use: ['href', 'xlink:href'],
  video: ['src', 'poster'],
};

const SRCSET_ATTRIBUTES = new Set(['srcset', 'imagesrcset']);

/** Recherches dans le JavaScript construit. */
const JS_RULES = [
  {
    pattern: /\bdocument\s*\.\s*cookie\b/g,
    severity: 'violation',
    message: 'accès à document.cookie',
  },
  { pattern: /\bcookieStore\b/g, severity: 'violation', message: 'API cookieStore (cookies)' },
  { pattern: /\blocalStorage\b/g, severity: 'violation', message: 'stockage localStorage' },
  { pattern: /\bdata:[a-z]+\/[a-z0-9.+-]+[;,]/gi, severity: 'violation', message: 'URI data:' },
  {
    pattern: /\bsessionStorage\b/g,
    severity: 'warning',
    message: 'stockage sessionStorage : à vérifier',
  },
  { pattern: /\bindexedDB\b/g, severity: 'warning', message: 'base indexedDB : à vérifier' },
  { pattern: /\bsendBeacon\b/g, severity: 'warning', message: 'navigator.sendBeacon : à vérifier' },
  {
    pattern: /\b(?:https?|wss?):\/\/[^\s"'`)\\]+/gi,
    severity: 'warning',
    message:
      'adresse externe dans le JavaScript : à vérifier (commentaire de licence ou requête ?)',
  },
];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * @typedef {{ file: string, line: number, column: number, message: string, excerpt: string }} Finding
 * @typedef {{ violations: Finding[], warnings: Finding[], externalLinks: { url: string, files: string[] }[], counts: Record<string, number> }} DistReport
 */

/**
 * Nature d'une adresse trouvée dans un attribut ou dans du CSS.
 * @param {string} raw
 * @param {Set<string>} localOrigins origines considérées comme le site lui-même
 * @returns {'local' | 'external' | 'data' | 'javascript' | 'contact' | 'other'}
 */
export function classifyUrl(raw, localOrigins = new Set()) {
  // Les navigateurs ignorent tabulations et retours à la ligne dans les adresses.
  const value = raw.replace(/[\t\n\r]/g, '').trim();
  const lower = value.toLowerCase();
  if (lower.startsWith('data:')) return 'data';
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return 'javascript';
  if (lower.startsWith('//')) return 'external';
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(lower);
  if (!scheme) return 'local';
  if (['mailto', 'tel', 'sms'].includes(scheme[1])) return 'contact';
  if (scheme[1] === 'blob') return 'local';
  if (['http', 'https', 'ws', 'wss', 'ftp'].includes(scheme[1])) {
    try {
      const url = new URL(value);
      if (LOCAL_HOSTS.has(url.hostname) || localOrigins.has(url.origin)) return 'local';
    } catch {
      return 'external';
    }
    return 'external';
  }
  return 'other';
}

/**
 * Contrôle un dossier construit.
 * @param {string} directory dossier à contrôler (chemin absolu ou relatif au dossier courant)
 * @param {{ localOrigins?: string[] }} [options]
 * @returns {DistReport}
 */
export function checkDist(directory, options = {}) {
  const base = path.resolve(directory);
  const localOrigins = new Set(
    (options.localOrigins ?? []).flatMap((origin) => {
      try {
        return [new URL(origin).origin];
      } catch {
        return [];
      }
    }),
  );
  /** @type {DistReport} */
  const report = {
    violations: [],
    warnings: [],
    externalLinks: [],
    counts: { html: 0, css: 0, js: 0, svg: 0, manifest: 0, other: 0 },
  };
  /** @type {Map<string, Set<string>>} */
  const links = new Map();

  for (const file of listFiles('.', { base, ignoredDirectories: new Set() })) {
    const extension = path.extname(file.relative).toLowerCase();
    const read = () => readFileSync(file.absolute, 'utf8');
    if (extension === '.html' || extension === '.htm') {
      report.counts.html += 1;
      checkHtml(read(), file.relative, report, links, localOrigins, false);
    } else if (extension === '.svg') {
      report.counts.svg += 1;
      checkHtml(read(), file.relative, report, links, localOrigins, true);
    } else if (extension === '.css') {
      report.counts.css += 1;
      checkCss(read(), file.relative, 0, report, localOrigins);
    } else if (extension === '.js' || extension === '.mjs' || extension === '.cjs') {
      report.counts.js += 1;
      checkJs(read(), file.relative, report);
    } else if (extension === '.webmanifest' || path.basename(file.relative) === 'manifest.json') {
      report.counts.manifest += 1;
      checkManifest(read(), file.relative, report, localOrigins);
    } else {
      report.counts.other += 1;
    }
  }

  report.externalLinks = [...links.entries()]
    .map(([url, files]) => ({ url, files: [...files].sort() }))
    .sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  const byPlace = (a, b) =>
    (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) || a.line - b.line || a.column - b.column;
  report.violations.sort(byPlace);
  report.warnings.sort(byPlace);
  return report;
}

/**
 * @param {string} text
 * @param {number} start
 * @param {number} end
 */
function excerptOf(text, start, end) {
  const slice = collapseWhitespace(text.slice(start, Math.min(end, start + 140)));
  return end - start > 140 ? `${slice}…` : slice;
}

/**
 * HTML (ou SVG autonome, avec `standaloneSvg`).
 * @param {string} text
 * @param {string} file
 * @param {DistReport} report
 * @param {Map<string, Set<string>>} links
 * @param {Set<string>} localOrigins
 * @param {boolean} standaloneSvg
 */
function checkHtml(text, file, report, links, localOrigins, standaloneSvg) {
  const locate = createLocator(text);
  const add = (severity, offset, message, excerpt) => {
    const { line, column } = locate(offset);
    const finding = { file, line, column, message, excerpt };
    if (severity === 'violation') report.violations.push(finding);
    else report.warnings.push(finding);
  };

  for (const tag of scanTags(text)) {
    const excerpt = excerptOf(text, tag.start, tag.end);
    const checkUrl = (value, label, offset) => {
      const kind = classifyUrl(value, localOrigins);
      if (kind === 'external') add('violation', offset, `ressource externe (${label})`, excerpt);
      else if (kind === 'data') add('violation', offset, `URI data: (${label})`, excerpt);
      else if (kind === 'javascript')
        add('violation', offset, `URL javascript: (${label})`, excerpt);
    };

    // Attributs qui font télécharger quelque chose : contrôlés plus bas.
    let resourceNames = RESOURCE_ATTRIBUTES[tag.name] ?? [];
    if (tag.name === 'link') {
      const rels = (attributeOf(tag, 'rel')?.value ?? '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      const isResource = rels.length === 0 || rels.some((rel) => !NAVIGATION_RELS.has(rel));
      if (!isResource) resourceNames = [];
    }
    if (tag.name === 'input' && (attributeOf(tag, 'type')?.value ?? '').toLowerCase() !== 'image') {
      resourceNames = ['formaction'];
    }

    for (const attribute of tag.attributes) {
      if (attribute.name === 'style') {
        const message = 'attribut style (refusé par une CSP stricte)';
        add(standaloneSvg ? 'warning' : 'violation', attribute.offset, message, excerpt);
      } else if (/^on[a-z]+$/.test(attribute.name)) {
        add(
          'violation',
          attribute.offset,
          `gestionnaire d'événement en ligne (${attribute.name})`,
          excerpt,
        );
      } else if (
        !resourceNames.includes(attribute.name) &&
        attribute.value.trim().toLowerCase().startsWith('data:')
      ) {
        add('violation', attribute.offset, `URI data: (attribut ${attribute.name})`, excerpt);
      }
    }

    if (tag.name === 'style') {
      if ((tag.content ?? '').trim()) {
        const message = 'élément <style> en ligne (refusé par une CSP stricte)';
        add(standaloneSvg ? 'warning' : 'violation', tag.start, message, excerpt);
        checkCss(tag.content ?? '', file, tag.contentStart, report, localOrigins, locate);
      }
      continue;
    }

    if (tag.name === 'script') {
      const src =
        attributeOf(tag, 'src') ?? attributeOf(tag, 'href') ?? attributeOf(tag, 'xlink:href');
      if (standaloneSvg) {
        add('violation', tag.start, 'script dans un fichier SVG', excerpt);
      } else if (!src && (tag.content ?? '').trim()) {
        const type = (attributeOf(tag, 'type')?.value ?? '').split(';')[0].trim().toLowerCase();
        if (type !== 'application/json') {
          add(
            'violation',
            tag.start,
            `script en ligne${type ? ` de type ${type}` : ''} (seul type="application/json" est admis)`,
            excerpt,
          );
        }
      }
    }

    if (tag.name === 'meta') {
      const equiv = (attributeOf(tag, 'http-equiv')?.value ?? '').toLowerCase();
      if (equiv === 'set-cookie')
        add('violation', tag.start, 'cookie déposé par <meta http-equiv>', excerpt);
      if (equiv === 'refresh')
        add('warning', tag.start, 'redirection <meta http-equiv="refresh">', excerpt);
    }

    if (tag.name === 'a' || tag.name === 'area') {
      for (const name of ['href', 'xlink:href']) {
        const href = attributeOf(tag, name);
        if (!href) continue;
        const kind = classifyUrl(href.value, localOrigins);
        if (kind === 'external') {
          const url = href.value.trim();
          links.set(url, (links.get(url) ?? new Set()).add(file));
        } else if (kind === 'javascript') {
          add('violation', href.offset, 'URL javascript: (lien)', excerpt);
        }
      }
      const ping = attributeOf(tag, 'ping');
      if (ping)
        add(
          'violation',
          ping.offset,
          'attribut ping (signalement des clics à un serveur)',
          excerpt,
        );
    }

    for (const name of resourceNames) {
      const attribute = attributeOf(tag, name);
      if (!attribute) continue;
      const label = `<${tag.name} ${name}>`;
      const values = SRCSET_ATTRIBUTES.has(name) ? parseSrcset(attribute.value) : [attribute.value];
      for (const value of values) checkUrl(value, label, attribute.offset);
    }
  }
}

/**
 * Adresses url(…), @import et image-set("…") d'une feuille de style.
 * @param {string} css
 * @param {string} file
 * @param {number} offset position du CSS dans le fichier (bloc <style>)
 * @param {DistReport} report
 * @param {Set<string>} localOrigins
 * @param {(offset: number) => { line: number, column: number }} [fileLocate]
 */
function checkCss(css, file, offset, report, localOrigins, fileLocate) {
  const locate = fileLocate ?? createLocator(css);
  const at = (node) => locate(offset + (node.source?.start?.offset ?? 0));
  let root;
  try {
    root = postcss.parse(css, { from: file });
  } catch (error) {
    report.violations.push({
      file,
      ...locate(offset),
      message: `CSS illisible : ${error?.reason ?? error}`,
      excerpt: '',
    });
    return;
  }
  const inspect = (value, node, label) => {
    const urls = [];
    for (const match of value.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi)) {
      urls.push(match[1] ?? match[2] ?? match[3] ?? '');
    }
    for (const match of value.matchAll(/image-set\(([^)]*)\)/gi)) {
      for (const string of match[1].matchAll(/"([^"]*)"|'([^']*)'/g)) {
        urls.push(string[1] ?? string[2] ?? '');
      }
    }
    if (label === '@import') {
      const plain = /^\s*(?:"([^"]*)"|'([^']*)')/.exec(value);
      if (plain) urls.push(plain[1] ?? plain[2] ?? '');
    }
    for (const url of urls) {
      const kind = classifyUrl(url, localOrigins);
      if (kind === 'external' || kind === 'data' || kind === 'javascript') {
        report.violations.push({
          file,
          ...at(node),
          message:
            kind === 'data'
              ? `URI data: dans le CSS (${label})`
              : `ressource externe dans le CSS (${label})`,
          excerpt: excerptOf(value, 0, value.length),
        });
      }
    }
  };
  root.walkAtRules((rule) => inspect(rule.params, rule, `@${rule.name}`));
  root.walkDecls((declaration) => inspect(declaration.value, declaration, declaration.prop));
}

/**
 * @param {string} text
 * @param {string} file
 * @param {DistReport} report
 */
function checkJs(text, file, report) {
  const locate = createLocator(text);
  for (const rule of JS_RULES) {
    const seen = new Set();
    for (const match of text.matchAll(rule.pattern)) {
      const key = rule.severity === 'warning' ? match[0] : `${match.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const start = match.index ?? 0;
      const finding = {
        file,
        ...locate(start),
        message: rule.message,
        excerpt: excerptOf(text, Math.max(0, start - 40), start + match[0].length + 40),
      };
      if (rule.severity === 'violation') report.violations.push(finding);
      else report.warnings.push(finding);
    }
  }
}

/**
 * Manifeste d'application : aucune icône ou adresse hors du site.
 * @param {string} text
 * @param {string} file
 * @param {DistReport} report
 * @param {Set<string>} localOrigins
 */
function checkManifest(text, file, report, localOrigins) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    report.violations.push({
      file,
      line: 1,
      column: 1,
      message: `manifeste illisible : ${error}`,
      excerpt: '',
    });
    return;
  }
  const visit = (value, where) => {
    if (typeof value === 'string') {
      const kind = classifyUrl(value, localOrigins);
      if (kind === 'external' || kind === 'data') {
        report.violations.push({
          file,
          line: 1,
          column: 1,
          message: `${kind === 'data' ? 'URI data:' : 'adresse externe'} dans le manifeste (${where})`,
          excerpt: value.slice(0, 140),
        });
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${where}[${index}]`));
    } else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) visit(item, where ? `${where}.${key}` : key);
    }
  };
  visit(data, '');
}
