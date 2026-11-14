/**
 * Prépare le site construit pour une adresse dans un sous-dossier, par exemple
 * l'aperçu sur GitHub Pages : https://antoninche.github.io/hako/.
 *
 * Le site est écrit pour la racine d'un nom de domaine : ses liens et ses
 * fichiers commencent par « / » (/offres/, /_astro/…, /fonts/…). Ce script les
 * réécrit après la construction, dans dist/, pour qu'ils commencent par le
 * sous-dossier. Les sources ne changent pas : le jour où le site a son propre
 * nom de domaine, on publie dist/ tel quel, sans cette étape.
 *
 * Usage : node scripts/deploy/sous-dossier.mjs <dossier> <sous-dossier> [--site <adresse>]
 *   dossier       sortie de construction (dist)
 *   sous-dossier  chemin public, par exemple /hako/
 *   --site        adresse du site donnée à la construction (SITE_URL), dont les
 *                 adresses complètes (lien canonique) reçoivent aussi le sous-dossier
 *
 * Après réécriture, le script relit tout et échoue s'il reste une adresse
 * interne sans le sous-dossier.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const siteIndex = args.indexOf('--site');
const site = siteIndex >= 0 ? (args[siteIndex + 1] ?? '').replace(/\/+$/, '') : '';
const positional = args.filter((arg, i) => !arg.startsWith('--') && i !== siteIndex + 1);
const [dir, rawBase] = positional;

if (!dir || !rawBase || (siteIndex >= 0 && !site)) {
  console.error(
    'Usage : node scripts/deploy/sous-dossier.mjs <dossier> <sous-dossier> [--site <adresse>]',
  );
  process.exit(2);
}
if (!/^\/[\w-]+(\/[\w-]+)*\/?$/.test(rawBase)) {
  console.error(`Sous-dossier invalide : ${rawBase} (exemple attendu : /hako/).`);
  process.exit(2);
}
const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
const root = path.resolve(dir);

/** Premiers éléments des adresses internes : le contenu de dist/ (pages, _astro, fonts…). */
const topLevel = readdirSync(root).filter((name) => name !== 'index.html' && name !== '404.html');
const escaped = topLevel.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const internalPath = new RegExp(`^/(?:${escaped.join('|')})(?=[/?#"'\`]|$)`);

/** Ajoute le sous-dossier à une adresse interne commençant par « / ». */
function rebase(url) {
  if (url.startsWith(base) || url.startsWith('//')) return url;
  if (site && url.startsWith(`${site}/`)) {
    const rest = url.slice(site.length);
    return rest.startsWith(base) ? url : `${site}${base}${rest.slice(1)}`;
  }
  if (url === '/' || url.startsWith('/?') || url.startsWith('/#')) return `${base}${url.slice(1)}`;
  if (url.startsWith('/')) return `${base}${url.slice(1)}`;
  return url;
}

/** Chaînes JavaScript ou JSON qui sont des adresses internes : "/_astro/x.js", '/images/…'. */
function rebaseLiterals(text) {
  return text.replace(
    new RegExp(`(["'\`])(/(?:${escaped.join('|')})(?=[/?#"'\`]))`, 'g'),
    (match, quote, url) => `${quote}${rebase(url)}`,
  );
}

function rebaseSrcset(value) {
  return value
    .split(',')
    .map((candidate) => {
      const trimmed = candidate.trim();
      const [url, ...descriptor] = trimmed.split(/\s+/);
      return [rebase(url ?? ''), ...descriptor].join(' ');
    })
    .join(', ');
}

const URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'poster', 'formaction']);

function rewriteHtml(html) {
  let out = html.replace(/(\s)([\w:-]+)=(["'])([^"']*)\3/g, (match, space, name, quote, value) => {
    const attr = name.toLowerCase();
    let next = value;
    if (URL_ATTRIBUTES.has(attr)) next = rebase(value);
    else if (attr === 'srcset' || attr === 'imagesrcset') next = rebaseSrcset(value);
    else if (attr === 'content' || attr.startsWith('data-')) {
      if (internalPath.test(value) || (site && value.startsWith(`${site}/`))) next = rebase(value);
    }
    return `${space}${name}=${quote}${next}${quote}`;
  });
  // Blocs de données JSON (<script type="application/json">) : leurs chaînes d'adresses.
  out = out.replace(
    /(<script\b[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>)([\s\S]*?)(<\/script>)/g,
    (match, open, body, close) => `${open}${rebaseLiterals(body)}${close}`,
  );
  return out;
}

function rewriteCss(css) {
  return css.replace(/url\(\s*(["']?)(\/(?!\/)[^"')]*)\1\s*\)/g, (match, quote, url) => {
    return `url(${quote}${rebase(url)}${quote})`;
  });
}

function rewriteManifest(text) {
  const manifest = JSON.parse(text);
  for (const key of ['start_url', 'scope', 'id']) {
    if (typeof manifest[key] === 'string') manifest[key] = rebase(manifest[key]);
  }
  for (const list of ['icons', 'screenshots', 'shortcuts']) {
    for (const item of manifest[list] ?? []) {
      if (typeof item.src === 'string') item.src = rebase(item.src);
      if (typeof item.url === 'string') item.url = rebase(item.url);
    }
  }
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function listFiles(folder) {
  return readdirSync(folder).flatMap((name) => {
    const full = path.join(folder, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

const counts = { html: 0, css: 0, js: 0, manifest: 0, texte: 0 };
for (const file of listFiles(root)) {
  const ext = path.extname(file).toLowerCase();
  const before =
    ext === '.html' ||
    ext === '.css' ||
    ext === '.js' ||
    ext === '.mjs' ||
    ext === '.webmanifest' ||
    ext === '.xml' ||
    ext === '.txt'
      ? readFileSync(file, 'utf8')
      : null;
  if (before === null) continue;
  let after = before;
  if (ext === '.html') {
    after = rewriteHtml(before);
    counts.html += 1;
  } else if (ext === '.css') {
    after = rewriteCss(before);
    counts.css += 1;
  } else if (ext === '.js' || ext === '.mjs') {
    after = rebaseLiterals(before);
    counts.js += 1;
  } else if (ext === '.webmanifest') {
    after = rewriteManifest(before);
    counts.manifest += 1;
  } else if (site) {
    after = before
      .split(`${site}/`)
      .join(`${site}${base}`)
      .split(`${site}${base}${base.slice(1)}`)
      .join(`${site}${base}`);
    counts.texte += 1;
  }
  if (after !== before) writeFileSync(file, after);
}

// Contrôle : aucune adresse interne ne doit rester sans le sous-dossier.
const leftovers = [];
for (const file of listFiles(root)) {
  const ext = path.extname(file).toLowerCase();
  if (ext !== '.html' && ext !== '.css') continue;
  const text = readFileSync(file, 'utf8');
  const pattern =
    ext === '.html'
      ? /\s(?:href|src|action|poster|srcset)=["'](\/(?!\/)[^"']*)["']/g
      : /url\(\s*["']?(\/(?!\/)[^"')]*)/g;
  for (const match of text.matchAll(pattern)) {
    const url = match[1] ?? '';
    if (!url.startsWith(base)) leftovers.push(`${path.relative(root, file)} : ${url}`);
  }
}
if (leftovers.length > 0) {
  console.error(`Adresses restées sans ${base} :\n${leftovers.slice(0, 20).join('\n')}`);
  process.exit(1);
}
console.log(
  `Site préparé pour ${site || ''}${base} : ${counts.html} pages, ${counts.css} feuilles de style, ${counts.js} scripts, ${counts.manifest} manifeste.`,
);
