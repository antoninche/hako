// Appel de potrace (http://potrace.sourceforge.net) et lecture de son tracé.
//
// potrace est un programme libre (GPL) installé sur la machine, appelé comme
// une commande : il n'est pas embarqué dans le site. Sur macOS :
// `brew install potrace` ; sur Debian/Ubuntu : `apt install potrace`.

import { spawnSync } from 'node:child_process';

/** Version de potrace installée, ou erreur explicite s'il manque. */
export function potraceVersion() {
  const r = spawnSync('potrace', ['--version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    throw new Error(
      'potrace est introuvable. Installez-le (macOS : brew install potrace ; ' +
        'Debian/Ubuntu : apt install potrace) puis relancez npm run logo:build.',
    );
  }
  const m = /potrace\s+(\d+\.\d+)/.exec(r.stdout);
  return m ? m[1] : r.stdout.trim();
}

/**
 * Vectorise un bitmap PBM. Options potrace :
 * alphamax (seuil des angles : 0 = que des angles vifs et des segments
 * droits), opttolerance (tolérance de fusion des courbes), turdsize (taille
 * des taches ignorées), unit (quantification des coordonnées).
 * Renvoie la liste des contours fermés, en coordonnées du bitmap (y vers le bas).
 */
export function trace(
  pbm,
  { alphamax = 1, opttolerance = 0.2, turdsize = 2, unit = 100, longcurve = false } = {},
) {
  const args = [
    '-b',
    'svg',
    '--flat',
    '-u',
    String(unit),
    '-a',
    String(alphamax),
    '-t',
    String(turdsize),
  ];
  if (longcurve) args.push('-n');
  else args.push('-O', String(opttolerance));
  args.push('-o', '-', '-');
  const r = spawnSync('potrace', args, { input: pbm, maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) {
    throw new Error(`potrace a échoué : ${r.error?.message ?? r.stderr.toString()}`);
  }
  const svg = r.stdout.toString('utf8');
  const tm = /translate\(([-\d.]+),([-\d.]+)\)\s*scale\(([-\d.]+),([-\d.]+)\)/.exec(svg);
  if (!tm) throw new Error('Sortie de potrace inattendue (transformation absente).');
  const [tx, ty, sx, sy] = tm.slice(1).map(Number);
  const ds = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
  const paths = [];
  for (const d of ds) {
    for (const sub of parsePathData(d)) {
      paths.push(mapPath(sub, ([x, y]) => [tx + sx * x, ty + sy * y]));
    }
  }
  return paths;
}

/**
 * Lit des données de tracé SVG (commandes M, L, H, V, C, Z, absolues ou
 * relatives, comme en produit potrace) et renvoie des contours fermés
 * en coordonnées absolues :
 * { start: [x, y], segs: [{ type: 'L', p }, { type: 'C', c1, c2, p }] }.
 */
export function parsePathData(d) {
  const tokens = d.match(/[MmLlHhVvCcZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const subs = [];
  let i = 0;
  let cmd = null;
  let cur = [0, 0];
  let start = [0, 0];
  let sub = null;
  const num = () => Number(tokens[i++]);
  const isCmd = (t) => /^[A-Za-z]$/.test(t);
  while (i < tokens.length) {
    if (isCmd(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'Z') {
      if (sub) {
        subs.push(sub);
        sub = null;
      }
      cur = start;
      continue;
    }
    if (C === 'M') {
      const x = num();
      const y = num();
      cur = rel ? [cur[0] + x, cur[1] + y] : [x, y];
      start = cur;
      if (sub) subs.push(sub);
      sub = { start: cur, segs: [] };
      // Les paires suivantes d'un M sont des L implicites.
      cmd = rel ? 'l' : 'L';
      continue;
    }
    if (C === 'L' || C === 'H' || C === 'V') {
      let p;
      if (C === 'L') {
        const x = num();
        const y = num();
        p = rel ? [cur[0] + x, cur[1] + y] : [x, y];
      } else if (C === 'H') {
        const x = num();
        p = [rel ? cur[0] + x : x, cur[1]];
      } else {
        const y = num();
        p = [cur[0], rel ? cur[1] + y : y];
      }
      sub.segs.push({ type: 'L', p });
      cur = p;
      continue;
    }
    if (C === 'C') {
      const v = [num(), num(), num(), num(), num(), num()];
      const o = rel ? cur : [0, 0];
      const c1 = [o[0] + v[0], o[1] + v[1]];
      const c2 = [o[0] + v[2], o[1] + v[3]];
      const p = [o[0] + v[4], o[1] + v[5]];
      sub.segs.push({ type: 'C', c1, c2, p });
      cur = p;
      continue;
    }
    throw new Error(`Commande de tracé non gérée : ${cmd}`);
  }
  if (sub) subs.push(sub);
  return subs;
}

/** Applique une transformation de points à un contour. */
export function mapPath(path, f) {
  return {
    start: f(path.start),
    segs: path.segs.map((s) =>
      s.type === 'L'
        ? { type: 'L', p: f(s.p) }
        : { type: 'C', c1: f(s.c1), c2: f(s.c2), p: f(s.p) },
    ),
  };
}
