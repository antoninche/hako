/**
 * Mesure Lighthouse de chaque page, sur téléphone ou sur ordinateur.
 *
 * Mesure le site déjà construit (dist/), servi par scripts/serve-prod.mjs avec
 * les en-têtes de production, ou un site en ligne (--url). Réglages de
 * Lighthouse par défaut : téléphone, réseau 4G lente et processeur ralenti
 * simulés ; avec --preset desktop, ses réglages « ordinateur » (grand écran,
 * réseau rapide, processeur non ralenti). Les rapports (HTML et JSON, en
 * français) vont dans qa/lighthouse/ (qa/lighthouse/ordinateur/ pour
 * l'ordinateur), avec un résumé : resume.md et resume.json.
 *
 * Utilisation :
 *   node scripts/lighthouse.mjs [options]
 *
 *   --dir <dossier>      site construit à servir (par défaut : dist)
 *   --url <adresse>      mesurer un site en ligne, par exemple https://exemple.fr
 *   --routes /,/offres/  pages à mesurer (par défaut : toutes les pages du
 *                        dossier, sauf celles marquées « noindex » comme /charte/)
 *   --not-found <adresse>
 *                        mesure aussi la page 404 du site, ouverte à cette
 *                        adresse inconnue (par exemple /cette-page-n-existe-pas/) :
 *                        le code 404 y est attendu
 *   --preset <nom>       mobile (par défaut) ou desktop
 *   --runs <n>           mesures par page, la mesure médiane est gardée (par défaut : 1)
 *   --out <dossier>      dossier des rapports (par défaut : qa/lighthouse, ou
 *                        qa/lighthouse/ordinateur avec --preset desktop)
 *   --strict             code de sortie 1 si une page passe sous un objectif
 *
 * Navigateur : celui de la variable CHROME_PATH, sinon Google Chrome installé,
 * sinon le Chromium de Playwright. Chrome sans interface utilise la carte
 * graphique de la machine : la scène 3D est mesurée avec WebGL.
 */

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { getChromePath, launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { computeMedianRun, filterToValidRuns } from 'lighthouse/core/lib/median-run.js';

import { startProdServer } from './serve-prod.mjs';

/** Objectifs du cahier des charges (score sur 100, sur téléphone comme sur ordinateur). */
const TARGETS = Object.freeze({
  performance: 85,
  accessibility: 95,
  'best-practices': 95,
  seo: 95,
});

/** Catégories mesurées, dans l'ordre d'affichage. */
const CATEGORIES = Object.freeze([
  { id: 'performance', label: 'Perf.', name: 'Performance' },
  { id: 'accessibility', label: 'Access.', name: 'Accessibilité' },
  { id: 'best-practices', label: 'Pratiques', name: 'Bonnes pratiques' },
  { id: 'seo', label: 'SEO', name: 'SEO' },
]);

/** Réglages de Lighthouse : ceux par défaut (téléphone) ou « ordinateur ». */
const PRESETS = Object.freeze({
  mobile: {
    config: undefined,
    description: 'mobile (4G lente et processeur ralenti simulés)',
    outDir: 'qa/lighthouse',
  },
  desktop: {
    config: desktopConfig,
    description: 'ordinateur (réseau rapide simulé, processeur non ralenti)',
    outDir: 'qa/lighthouse/ordinateur',
  },
});

const numberFr = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/**
 * @typedef {{
 *   route: string,
 *   url: string,
 *   slug: string,
 *   scores: Record<string, number | null>,
 *   lcpMs: number | null,
 *   cls: number | null,
 *   tbtMs: number | null,
 *   scriptBytes: number | null,
 *   error: string | null,
 *   warnings: string[],
 * }} PageResult
 */

function parseOptions() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', default: 'dist' },
      url: { type: 'string' },
      routes: { type: 'string' },
      'not-found': { type: 'string' },
      preset: { type: 'string', default: 'mobile' },
      runs: { type: 'string', default: '1' },
      out: { type: 'string' },
      strict: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const runs = Number.parseInt(values.runs, 10);
  if (!Number.isInteger(runs) || runs < 1 || runs > 9) {
    fail(`--runs attend un nombre entre 1 et 9 (reçu : ${values.runs}).`);
  }
  const routes = values.routes
    ?.split(',')
    .map((route) => route.trim())
    .filter(Boolean);
  for (const route of routes ?? []) {
    if (!route.startsWith('/'))
      fail(`Chaque page de --routes commence par « / » (reçu : ${route}).`);
  }
  const notFound = values['not-found'];
  if (notFound !== undefined && !notFound.startsWith('/')) {
    fail(`--not-found attend une adresse qui commence par « / » (reçu : ${notFound}).`);
  }
  if (!Object.hasOwn(PRESETS, values.preset)) {
    fail(`--preset attend mobile ou desktop (reçu : ${values.preset}).`);
  }
  const preset = /** @type {keyof typeof PRESETS} */ (values.preset);
  if (values.url && !/^https?:\/\//.test(values.url)) {
    fail(
      `--url attend une adresse complète, par exemple https://exemple.fr (reçu : ${values.url}).`,
    );
  }
  return {
    ...values,
    runs,
    routes,
    notFound,
    preset,
    out: values.out ?? PRESETS[preset].outDir,
  };
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(message);
  process.exit(2);
}

/**
 * Nom de fichier d'une page : « accueil » pour /, « offres » pour /offres/.
 *
 * @param {string} route
 */
function slugFor(route) {
  const slug = route.replace(/^\/+|\/+$/g, '').replaceAll('/', '-');
  return slug || 'accueil';
}

/**
 * Vrai si la page demande à ne pas être indexée (<meta name="robots" content="noindex">).
 *
 * @param {string} html
 */
function isNoindex(html) {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (/\bname\s*=\s*["']?robots\b/i.test(tag) && /\bcontent\s*=\s*["'][^"']*noindex/i.test(tag)) {
      return true;
    }
  }
  return false;
}

/**
 * Pages trouvées dans le site construit : chaque index.html est une page.
 *
 * @param {string} root
 * @returns {Promise<{ indexable: string[], noindex: string[] }>}
 */
async function discoverRoutes(root) {
  /** @type {string[]} */
  const indexable = [];
  /** @type {string[]} */
  const noindex = [];
  /**
   * @param {string} dir
   * @param {string} route
   */
  async function walk(dir, route) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === '_astro' || entry.name.startsWith('.')) continue;
        await walk(path.join(dir, entry.name), `${route}${entry.name}/`);
      } else if (entry.name === 'index.html') {
        const html = await readFile(path.join(dir, entry.name), 'utf8');
        (isNoindex(html) ? noindex : indexable).push(route);
      }
    }
  }
  await walk(root, '/');
  const byPath = (/** @type {string} */ a, /** @type {string} */ b) =>
    a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b, 'fr');
  return { indexable: indexable.sort(byPath), noindex: noindex.sort(byPath) };
}

/** Chemin du navigateur : CHROME_PATH, Google Chrome, ou le Chromium de Playwright. */
async function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try {
    return getChromePath();
  } catch {
    try {
      const { chromium } = await import('@playwright/test');
      const executable = chromium.executablePath();
      await stat(executable);
      return executable;
    } catch {
      fail(
        'Aucun navigateur trouvé : installez Google Chrome, lancez « npx playwright install chromium », ' +
          'ou indiquez le chemin dans la variable CHROME_PATH.',
      );
    }
  }
}

/**
 * Médiane d'une liste de nombres (null ignorés).
 *
 * @param {(number | null)[]} values
 */
function median(values) {
  const sorted = values.filter((value) => typeof value === 'number').sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Mesure une page `runs` fois et garde la mesure médiane (méthode de Lighthouse).
 * `expectNotFound` : la page 404, dont le code 404 est attendu (Lighthouse
 * refuse sinon de mesurer une page qui ne répond pas 200).
 *
 * @param {string} url
 * @param {{ port: number, runs: number, config: any, expectNotFound?: boolean }} options
 */
async function measure(url, { port, runs, config, expectNotFound = false }) {
  /** @type {{ lhr: any, report: string[] }[]} */
  const results = [];
  for (let run = 0; run < runs; run += 1) {
    const result = await lighthouse(
      url,
      {
        port,
        output: ['html', 'json'],
        logLevel: 'error',
        onlyCategories: CATEGORIES.map((category) => category.id),
        locale: 'fr',
        ...(expectNotFound ? { ignoreStatusCode: true } : {}),
      },
      config,
    );
    if (!result) throw new Error(`Lighthouse n'a rien renvoyé pour ${url}.`);
    results.push({
      lhr: result.lhr,
      report: Array.isArray(result.report) ? result.report : [result.report],
    });
  }
  const valid = filterToValidRuns(results.map((result) => result.lhr));
  const medianLhr = valid.length > 0 ? computeMedianRun(valid) : results[0]?.lhr;
  return results.find((result) => result.lhr === medianLhr) ?? results[0];
}

/**
 * @param {string} route
 * @param {string} url
 * @param {any} lhr
 * @returns {PageResult}
 */
function summarize(route, url, lhr) {
  /** @type {Record<string, number | null>} */
  const scores = {};
  for (const { id } of CATEGORIES) {
    const score = lhr.categories?.[id]?.score;
    scores[id] = typeof score === 'number' ? Math.round(score * 100) : null;
  }
  const numeric = (/** @type {string} */ audit) => {
    const value = lhr.audits?.[audit]?.numericValue;
    return typeof value === 'number' ? value : null;
  };
  // Scripts reçus pendant la mesure, en octets transférés (donc compressés).
  const scripts = lhr.audits?.['resource-summary']?.details?.items?.find(
    (/** @type {{ resourceType?: string }} */ item) => item.resourceType === 'script',
  );
  return {
    route,
    url,
    slug: slugFor(route),
    scores,
    lcpMs: numeric('largest-contentful-paint'),
    cls: numeric('cumulative-layout-shift'),
    tbtMs: numeric('total-blocking-time'),
    scriptBytes: typeof scripts?.transferSize === 'number' ? scripts.transferSize : null,
    error: lhr.runtimeError ? `${lhr.runtimeError.code} : ${lhr.runtimeError.message}` : null,
    warnings: lhr.runWarnings ?? [],
  };
}

/** Pages ou catégories sous les objectifs. */
function belowTargets(/** @type {PageResult[]} */ pages) {
  /** @type {string[]} */
  const problems = [];
  for (const page of pages) {
    if (page.error) {
      problems.push(`${page.route} : mesure impossible (${page.error})`);
      continue;
    }
    for (const { id, name } of CATEGORIES) {
      const score = page.scores[id];
      const target = TARGETS[/** @type {keyof typeof TARGETS} */ (id)];
      if (score === null || score === undefined || score < target) {
        problems.push(`${page.route} : ${name} ${score ?? 'sans note'}, objectif ${target}`);
      }
    }
  }
  return problems;
}

const formatSeconds = (/** @type {number | null} */ ms) =>
  ms === null ? '–' : `${numberFr.format(Math.round(ms / 100) / 10)} s`;
const formatCls = (/** @type {number | null} */ cls) =>
  cls === null ? '–' : numberFr.format(Math.round(cls * 1000) / 1000);
const formatMs = (/** @type {number | null} */ ms) =>
  ms === null ? '–' : `${numberFr.format(Math.round(ms))} ms`;
const formatKb = (/** @type {number | null} */ bytes) =>
  bytes === null ? '–' : `${numberFr.format(Math.round(bytes / 102.4) / 10)} Ko`;

/**
 * Lignes du tableau des résultats (texte aligné, pour le terminal et le résumé).
 *
 * @param {PageResult[]} pages
 */
function tableRows(pages) {
  const scoreCell = (/** @type {number | null | undefined} */ score, /** @type {string} */ id) => {
    if (score === null || score === undefined) return '–';
    const target = TARGETS[/** @type {keyof typeof TARGETS} */ (id)];
    return score < target ? `${score}*` : String(score);
  };
  const header = [
    'Page',
    ...CATEGORIES.map((category) => category.label),
    'LCP',
    'CLS',
    'TBT',
    'JS',
  ];
  const rows = pages.map((page) => [
    page.route,
    ...CATEGORIES.map(({ id }) => (page.error ? 'erreur' : scoreCell(page.scores[id], id))),
    formatSeconds(page.lcpMs),
    formatCls(page.cls),
    formatMs(page.tbtMs),
    formatKb(page.scriptBytes),
  ]);
  const measured = pages.filter((page) => !page.error);
  const medians = [
    'Médiane',
    ...CATEGORIES.map(({ id }) => {
      const value = median(measured.map((page) => page.scores[id] ?? null));
      return value === null ? '–' : scoreCell(Math.round(value), id);
    }),
    formatSeconds(median(measured.map((page) => page.lcpMs))),
    formatCls(median(measured.map((page) => page.cls))),
    formatMs(median(measured.map((page) => page.tbtMs))),
    formatKb(median(measured.map((page) => page.scriptBytes))),
  ];
  const targets = [
    'Objectif',
    ...CATEGORIES.map(({ id }) => `≥ ${TARGETS[/** @type {keyof typeof TARGETS} */ (id)]}`),
    '',
    '',
    '',
    '',
  ];
  return { header, rows: [...rows, medians, targets] };
}

function renderText(/** @type {{ header: string[], rows: string[][] }} */ { header, rows }) {
  const all = [header, ...rows];
  const widths = header.map((_, column) =>
    Math.max(...all.map((row) => (row[column] ?? '').length)),
  );
  const line = (/** @type {string[]} */ row) =>
    row
      .map((cell, column) =>
        column === 0 ? cell.padEnd(widths[column] ?? 0) : cell.padStart(widths[column] ?? 0),
      )
      .join('  ');
  const separator = widths.map((width) => '-'.repeat(width)).join('  ');
  // Pages, puis la médiane et les objectifs sous un trait.
  return [
    line(header),
    separator,
    ...rows.slice(0, -2).map(line),
    separator,
    ...rows.slice(-2).map(line),
  ].join('\n');
}

function renderMarkdown(/** @type {{ header: string[], rows: string[][] }} */ { header, rows }) {
  const escape = (/** @type {string} */ cell) => cell.replaceAll('|', '\\|');
  return [
    `| ${header.map(escape).join(' | ')} |`,
    `| ${header.map((_, column) => (column === 0 ? '---' : '---:')).join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`),
  ].join('\n');
}

async function main() {
  const options = parseOptions();
  if (options.help) {
    console.log(
      'node scripts/lighthouse.mjs [--dir dist] [--url https://…] [--routes /,/offres/] ' +
        '[--not-found /adresse-inconnue/] [--preset mobile|desktop] [--runs 1] ' +
        '[--out qa/lighthouse] [--strict]',
    );
    return;
  }

  const root = path.resolve(options.dir);
  const hasBuild = await stat(path.join(root, 'index.html')).then(
    () => true,
    () => false,
  );
  if (!options.url && !hasBuild)
    fail(`Aucun site construit dans ${root} : lancez d’abord npm run build.`);

  /** @type {string[]} */
  let routes;
  if (options.routes) {
    routes = options.routes;
  } else if (hasBuild) {
    const found = await discoverRoutes(root);
    routes = found.indexable;
    if (found.noindex.length > 0) {
      console.log(`Pages non mesurées (marquées noindex) : ${found.noindex.join(', ')}`);
    }
  } else {
    routes = ['/'];
  }
  if (options.notFound) routes = [...routes, options.notFound];
  const { config, description } = PRESETS[options.preset];

  const outDir = path.resolve(options.out);
  await mkdir(outDir, { recursive: true });

  const server = options.url ? null : await startProdServer({ root });
  const base = options.url ?? server?.url ?? '';
  const chrome = await launch({
    chromePath: await findChrome(),
    chromeFlags: ['--headless=new'],
    logLevel: 'silent',
  });
  // Version exacte du navigateur : l'identifiant envoyé aux sites l'arrondit (157.0.0.0).
  const browserVersion = await fetch(`http://127.0.0.1:${chrome.port}/json/version`)
    .then((response) => response.json())
    .then((info) => /\/([\d.]+)$/.exec(String(info.Browser))?.[1] ?? '?')
    .catch(() => '?');
  const stop = () => {
    chrome.kill();
    void server?.close();
  };
  process.once('SIGINT', () => {
    stop();
    process.exit(130);
  });

  /** @type {PageResult[]} */
  const pages = [];
  /** @type {any} */
  let environment = null;
  try {
    console.log(
      `Mesure de ${routes.length} page(s) sur ${base}, ${options.runs} fois chacune, ` +
        `${description}.`,
    );
    // La toute première mesure d'un Chrome qui vient de démarrer est souvent
    // faussée (temps de blocage gonflé) : une mesure d'échauffement, non
    // comptée, passe avant les autres.
    process.stdout.write('  échauffement du navigateur … ');
    await lighthouse(
      new URL(routes[0] ?? '/', `${base}/`).href,
      { port: chrome.port, logLevel: 'error', onlyCategories: ['performance'] },
      config,
    );
    console.log('fait');
    for (const [index, route] of routes.entries()) {
      const url = new URL(route, `${base}/`).href;
      process.stdout.write(`  ${index + 1}/${routes.length} ${route} … `);
      const expectNotFound = route === options.notFound;
      const { lhr, report } = await measure(url, {
        port: chrome.port,
        runs: options.runs,
        config,
        expectNotFound,
      });
      environment ??= {
        lighthouse: lhr.lighthouseVersion,
        browser: browserVersion,
        benchmarkIndex: lhr.environment?.benchmarkIndex ?? null,
      };
      const result = summarize(route, url, lhr);
      if (expectNotFound) result.slug = '404';
      pages.push(result);
      await writeFile(path.join(outDir, `${result.slug}.html`), report[0] ?? '');
      await writeFile(path.join(outDir, `${result.slug}.json`), report[1] ?? '');
      console.log(result.error ? `erreur (${result.error})` : 'fait');
      for (const warning of result.warnings) console.log(`    Avertissement : ${warning}`);
    }
  } finally {
    stop();
  }

  const table = tableRows(pages);
  const problems = belowTargets(pages);
  const context =
    `Lighthouse ${environment?.lighthouse ?? '?'}, Chrome ${browserVersion}, ${description}, ` +
    'indice de vitesse de la machine : ' +
    `${environment?.benchmarkIndex ? numberFr.format(environment.benchmarkIndex) : '?'}. ` +
    'TBT : temps de blocage total ; JS : scripts reçus pendant la mesure (octets transférés).';

  console.log(`\n${renderText(table)}\n\n* sous l’objectif. ${context}`);
  console.log(`Rapports : ${path.relative(process.cwd(), outDir) || '.'}/<page>.html`);

  const date = new Date();
  await writeFile(
    path.join(outDir, 'resume.json'),
    `${JSON.stringify({ date: date.toISOString(), base, options: { runs: options.runs, preset: options.preset }, environment, targets: TARGETS, pages }, null, 2)}\n`,
  );
  await writeFile(
    path.join(outDir, 'resume.md'),
    [
      '# Mesures Lighthouse',
      '',
      `Mesuré le ${date.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })} sur ${base}.`,
      context,
      '',
      renderMarkdown(table),
      '',
      '\\* sous l’objectif. Rapport détaillé de chaque page : `<page>.html` dans ce dossier.',
      '',
      problems.length > 0
        ? `À corriger :\n\n${problems.map((problem) => `- ${problem}`).join('\n')}`
        : 'Toutes les pages atteignent les objectifs.',
      '',
    ].join('\n'),
  );

  if (problems.length > 0) {
    console.log(`\nSous les objectifs :\n${problems.map((problem) => `  ${problem}`).join('\n')}`);
    if (options.strict) process.exit(1);
  } else {
    console.log('\nToutes les pages atteignent les objectifs.');
  }
}

try {
  await main();
} catch (error) {
  console.error('La mesure a échoué :', error instanceof Error ? error.message : error);
  process.exit(2);
}
