/**
 * Guide d'installation (/installer/) : la logique pure du script
 * (src/lib/installation/guide-state.ts), l'adresse de la HAKO écrite à un
 * seul endroit (src/data/installation.ts), et les promesses du script de la
 * page relues dans sa source : aucun stockage, aucune requête, aucune
 * adresse, aucun texte mis en forme avec Intl.
 *
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { BOX_HOST, boxAddress } from '../../src/data/installation.ts';
import {
  decodeHash,
  elapsedText,
  fillTemplate,
  progressText,
  spokenElapsed,
  splitElapsed,
  stepAnchor,
  stepFromHash,
} from '../../src/lib/installation/guide-state.ts';

const IDS = ['carton', 'place', 'cable', 'page'] as const;

/** Contenu d'un fichier du dépôt, quel que soit le dossier d'où les tests sont lancés. */
const readRepoFile = (path: string): string =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('ancres des étapes', () => {
  it('écrit et relit #etape-<id>', () => {
    assert.equal(stepAnchor('cable'), 'etape-cable');
    assert.equal(stepFromHash('#etape-cable', IDS), 'cable');
    assert.equal(stepFromHash('etape-page', IDS), 'page');
  });

  it('refuse ce qui ne désigne pas une étape connue', () => {
    for (const hash of [
      '',
      '#',
      '#contenu',
      '#etape-',
      '#etape-inconnue',
      '#cable',
      '#etape-page-vpn',
    ]) {
      assert.equal(stepFromHash(hash, IDS), null, hash);
    }
  });

  it('décode l’ancre, et ignore une ancre mal formée', () => {
    assert.equal(decodeHash('#etape-c%C3%A2ble'), 'etape-câble');
    assert.equal(decodeHash('#%E0%A4%A'), '');
    assert.equal(stepFromHash('#%E0%A4%A', IDS), null);
  });
});

describe('libellés', () => {
  it('remplit les repères connus, garde les autres', () => {
    assert.equal(fillTemplate('Étape {n} sur {total}', { n: 3, total: 8 }), 'Étape 3 sur 8');
    assert.equal(fillTemplate('{n} et {inconnu}', { n: 1 }), '1 et {inconnu}');
  });

  it('progression : singulier pour 0 et 1, pluriel ensuite', () => {
    const templates = {
      one: '{n} étape faite sur {total}',
      many: '{n} étapes faites sur {total}',
    };
    assert.equal(progressText(0, 8, templates), '0 étape faite sur 8');
    assert.equal(progressText(1, 8, templates), '1 étape faite sur 8');
    assert.equal(progressText(2, 8, templates), '2 étapes faites sur 8');
    assert.equal(progressText(8, 8, templates), '8 étapes faites sur 8');
  });
});

describe('chronomètre', () => {
  it('minutes et secondes entières, jamais négatives', () => {
    assert.deepEqual(splitElapsed(0), { minutes: 0, seconds: 0 });
    assert.deepEqual(splitElapsed(65_999), { minutes: 1, seconds: 5 });
    assert.deepEqual(splitElapsed(-5_000), { minutes: 0, seconds: 0 });
    assert.deepEqual(splitElapsed(75 * 60_000), { minutes: 75, seconds: 0 });
  });

  it('temps affiché : secondes sur deux chiffres', () => {
    assert.equal(elapsedText(0, '{m} min {s} s'), '0 min 00 s');
    assert.equal(elapsedText(65_000, '{m} min {s} s'), '1 min 05 s');
    assert.equal(elapsedText(754_000, '{m} min {s} s'), '12 min 34 s');
  });

  it('temps lu : en minutes entières seulement', () => {
    const spoken = { zero: 'Moins d’une minute', one: '1 minute', many: '{n} minutes' };
    assert.equal(spokenElapsed(59_999, spoken), 'Moins d’une minute');
    assert.equal(spokenElapsed(60_000, spoken), '1 minute');
    assert.equal(spokenElapsed(119_000, spoken), '1 minute');
    assert.equal(spokenElapsed(180_500, spoken), '3 minutes');
  });
});

describe('adresse de la HAKO', () => {
  it('hako.local, écrite une seule fois, et ses formes', () => {
    assert.equal(BOX_HOST, 'hako.local');
    assert.equal(boxAddress.url, 'http://hako.local/');
    assert.equal(boxAddress.display, 'http://hako.local');
    assert.equal(boxAddress.secondUrl, 'http://hako-2.local/');
  });

  it('aucun texte du site n’écrit encore l’ancienne adresse', () => {
    const files = [
      'src/content/installation.ts',
      'src/content/tutoriels.ts',
      'src/content/la-box.ts',
      'src/content/faq/branchement.mdx',
      'src/data/faits.ts',
    ];
    for (const file of files) {
      assert.doesNotMatch(readRepoFile(file), /mabox\.local/u, file);
    }
  });
});

describe('script du guide (source)', () => {
  /** Source sans ses commentaires : seul le code compte. */
  const code = ['src/components/installation/guide.ts', 'src/lib/installation/guide-state.ts']
    .map(readRepoFile)
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^\s*\/\/.*$/gmu, '');

  it('ne garde rien sur l’appareil', () => {
    assert.doesNotMatch(
      code,
      /localStorage|sessionStorage|indexedDB|document\.cookie|cookieStore/u,
    );
  });

  it('ne fait aucune requête et ne contient aucune adresse', () => {
    assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/u);
    assert.doesNotMatch(code, /https?:\/\//u);
  });

  it('ne met rien en forme avec Intl (réservé à src/lib/format.ts)', () => {
    assert.doesNotMatch(code, /\bIntl\.|toLocale\w*String/u);
  });

  it('n’écrit aucun HTML (CSP stricte)', () => {
    assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|setAttribute\('style'/u);
  });
});
