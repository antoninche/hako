/**
 * Typographie de src/ : des caractères que les polices du site savent dessiner,
 * et des nombres mis en forme à un seul endroit (src/lib/format.ts).
 *
 * - L'espace fine insécable (U+202F) et le trait d'union insécable (U+2011)
 *   manquent aux trois polices du site : le navigateur les prendrait dans une
 *   police du système (« 1 000 € » se lirait « 1000 € »). Aucun fichier de
 *   src/ ne doit les écrire, ni tels quels, ni sous une forme codée
 *   (\u202f, \u{202f}, &#8239;, &#x202f;…). L'espace insécable ordinaire
 *   (U+00A0) les remplace.
 * - Intl met des espaces fines dans les nombres : seul src/lib/format.ts s'en
 *   sert, et les remplace. Partout ailleurs, un prix, un pourcentage ou un
 *   nombre passe par ce fichier.
 *
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { listFiles } from '../../scripts/lib/files.mjs';

/** Fichiers texte de src/ (les polices et les images sont dans public/). */
const TEXT_EXTENSIONS = ['.astro', '.css', '.js', '.json', '.md', '.mdx', '.mjs', '.svg', '.ts'];

const sources = listFiles('src', { extensions: TEXT_EXTENSIONS }).map((file) => ({
  path: file.relative,
  text: readFileSync(file.absolute, 'utf8'),
}));

/** Le seul fichier autorisé à mettre un nombre en forme avec Intl. */
const FORMAT_MODULE = 'src/lib/format.ts';

/** Lignes (numérotées à partir de 1) où l'expression trouve quelque chose. */
function findLines(text: string, pattern: RegExp): number[] {
  return text
    .split('\n')
    .flatMap((line, index) =>
      new RegExp(pattern.source, pattern.flags).test(line) ? [index + 1] : [],
    );
}

function report(pattern: RegExp, except: (path: string) => boolean = () => false): string[] {
  return sources.flatMap(({ path, text }) =>
    except(path) ? [] : findLines(text, pattern).map((line) => `${path}:${line}`),
  );
}

describe('typographie des fichiers de src/', () => {
  it('trouve bien les fichiers à vérifier', () => {
    assert.ok(sources.length > 50, `${sources.length} fichiers seulement`);
    assert.ok(sources.some(({ path }) => path === FORMAT_MODULE));
  });

  it('n’écrit jamais l’espace fine insécable ni le trait d’union insécable', () => {
    // Caractères eux-mêmes, construits ici pour que ce test ne les contienne pas.
    const characters = new RegExp(`[${String.fromCodePoint(0x202f, 0x2011)}]`, 'u');
    assert.deepEqual(report(characters), [], 'U+202F ou U+2011 écrit tel quel');
  });

  it('ne les écrit pas non plus sous une forme codée', () => {
    const escaped = /\\u\{?0*(?:202f|2011)\}?|&#(?:8239|8209);|&#x0*(?:202f|2011);/iu;
    assert.deepEqual(report(escaped), [], 'forme codée de U+202F ou U+2011');
  });

  it('met les nombres en forme dans src/lib/format.ts seulement', () => {
    const intl = /\bIntl\.(?:NumberFormat|ListFormat)\b|\.toLocaleString\(|\.toLocaleDateString\(/u;
    assert.deepEqual(
      report(intl, (path) => path === FORMAT_MODULE),
      [],
      'mise en forme hors de src/lib/format.ts',
    );
  });
});
