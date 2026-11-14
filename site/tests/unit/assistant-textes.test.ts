/**
 * Textes de la page de la HAKO qui fait la première installation, et de sa
 * démonstration (src/content/assistant.ts), avec leurs faits
 * (src/data/assistant.ts) : les règles d’écriture du site, relues dans la
 * source, et ce qui rend la démonstration impossible à confondre avec la
 * vraie installation.
 *
 * - Typographie : espace insécable avant « : », « ; », « ? », « ! » et à
 *   l’intérieur des guillemets « » (src/content/ n’est pas repris par
 *   withFrenchTypography), apostrophe courbe, points de suspension « … ».
 * - Vocabulaire : « la HAKO », jamais « box » seul (sauf « box internet ») ;
 *   ni « belle » ni « beau » ; vouvoiement ; aucun code d’installation ni
 *   carte ; jamais « chiffré » sans « pas » ; jamais « nous ne pourrions
 *   pas ».
 * - Démonstration : bandeau et titre exacts, filigrane « EXEMPLE », mots de
 *   passe d’exemple fixes qui contiennent « exemple » et finissent par 00.
 *
 * Le fichier de textes importe des modules que Node ne sait pas résoudre
 * seul (imports sans extension) : il est donc relu comme du texte. Seuls ses
 * textes écrits en toutes lettres comptent (chaînes et parties fixes des
 * gabarits), pas ses commentaires.
 *
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  DEMO_ROUTE,
  EXAMPLE_FIRST_NAMES,
  EXAMPLE_PASSWORDS,
  FIRST_NAME_MAX_LENGTH,
  LOGIN_DOMAIN,
  MAX_PEOPLE,
  MIN_PEOPLE,
  duplicateExample,
  loginExample,
  pending,
} from '../../src/data/assistant.ts';
import { BOX_HOST } from '../../src/data/installation.ts';
import { isTodo } from '../../src/lib/todo.ts';

const CONTENT_FILE = 'src/content/assistant.ts';
const DATA_FILE = 'src/data/assistant.ts';

/** Contenu d’un fichier du dépôt, quel que soit le dossier d’où les tests sont lancés. */
const readRepoFile = (path: string): string =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

interface Literal {
  readonly text: string;
  readonly line: number;
}

/**
 * Textes écrits en toutes lettres dans une source TypeScript : chaînes entre
 * apostrophes ou guillemets droits, et parties fixes des gabarits `…${…}…`.
 * Les commentaires sont ignorés. Suffisant pour ces deux fichiers, qui
 * n’ont ni expression régulière ni gabarit imbriqué.
 */
function literals(source: string): Literal[] {
  const found: Literal[] = [];
  let line = 1;
  let index = 0;
  const advance = (): string => {
    const char = source[index] ?? '';
    if (char === '\n') line += 1;
    index += 1;
    return char;
  };
  while (index < source.length) {
    const char = source[index];
    if (source.startsWith('//', index)) {
      while (index < source.length && source[index] !== '\n') advance();
    } else if (source.startsWith('/*', index)) {
      while (index < source.length && !source.startsWith('*/', index)) advance();
      advance();
      advance();
    } else if (char === "'" || char === '"') {
      const start = line;
      advance();
      let text = '';
      while (index < source.length && source[index] !== char) {
        if (source[index] === '\\') text += advance();
        text += advance();
      }
      advance();
      found.push({ text, line: start });
    } else if (char === '`') {
      let start = line;
      advance();
      let text = '';
      while (index < source.length && source[index] !== '`') {
        if (source.startsWith('${', index)) {
          found.push({ text, line: start });
          text = '';
          let depth = 0;
          do {
            const inner = advance();
            if (inner === '{') depth += 1;
            if (inner === '}') depth -= 1;
          } while (index < source.length && depth > 0);
          start = line;
        } else {
          if (source[index] === '\\') text += advance();
          text += advance();
        }
      }
      advance();
      found.push({ text, line: start });
    } else {
      advance();
    }
  }
  // Les chemins des imports (« ./la-box ») ne sont pas des textes affichés.
  return found.filter(({ text }) => text.length > 0 && !/^\.{1,2}\//u.test(text));
}

const content = literals(readRepoFile(CONTENT_FILE));
const data = literals(readRepoFile(DATA_FILE));

/** Textes qui ressemblent à du texte affiché (au moins une lettre et une espace). */
const sentences = content.filter(({ text }) => /\p{L}/u.test(text) && /[\s\u00a0]/u.test(text));

/** « fichier:ligne : texte » pour chaque texte où l’expression trouve quelque chose. */
function offenders(list: readonly Literal[], pattern: RegExp, file = CONTENT_FILE): string[] {
  return list
    .filter(({ text }) => new RegExp(pattern.source, pattern.flags).test(text))
    .map(({ text, line }) => `${file}:${line} : ${text}`);
}

describe('textes de la page de la HAKO : typographie', () => {
  it('trouve bien les textes à vérifier', () => {
    assert.ok(sentences.length > 150, `${sentences.length} textes seulement`);
  });

  it('espace insécable avant « : », « ; », « ? », « ! » et « » »', () => {
    assert.deepEqual(offenders(content, / [:;?!»]/u), []);
  });

  it('espace insécable après « « »', () => {
    assert.deepEqual(offenders(content, /«(?!\u00a0)/u), []);
  });

  it('jamais de « : », « ; », « ? » ou « ! » collé au mot qui précède', () => {
    // Seules exceptions : les adresses (http://), et « ? » en tête d’un texte cité.
    assert.deepEqual(offenders(sentences, /[^\s\u00a0/]:(?!\/\/)|[^\s\u00a0][;!]/u), []);
    assert.deepEqual(offenders(sentences, /[\p{L}\d)][?]/u), []);
  });

  it('apostrophe courbe et points de suspension « … »', () => {
    assert.deepEqual(offenders(content, /\p{L}'\p{L}/u), []);
    assert.deepEqual(offenders(content, /\.\.\./u), []);
  });
});

describe('textes de la page de la HAKO : vocabulaire', () => {
  const both = [...content, ...data];

  it('« la HAKO », jamais « box » seul', () => {
    assert.deepEqual(offenders(both, /\bbox\b(?![\s\u00a0]+internet)/iu), []);
  });

  it('ni « belle » ni « beau », vouvoiement', () => {
    assert.deepEqual(offenders(both, /\b(?:belles?|beaux?)\b/iu), []);
    assert.deepEqual(
      offenders(sentences, /(?<![\p{L}’'-])(?:tu|toi|ton|ta|tes)(?![\p{L}’'-])/iu),
      [],
    );
  });

  it('ni code d’installation, ni carte', () => {
    assert.deepEqual(offenders(both, /code d[’']installation|\bcartes?\b/iu), []);
  });

  it('formulations honnêtes : rien n’est dit chiffré, jamais « nous ne pourrions pas »', () => {
    // « chiffré », « chiffrement », « chiffrer » ; « chiffre » (un nombre) reste permis.
    assert.deepEqual(offenders(both, /(?<!pas[\s\u00a0])chiffr(?:é|e[mr]|ant)/iu), []);
    assert.deepEqual(offenders(both, /pourrions/iu), []);
  });
});

describe('démonstration : impossible à confondre avec la vraie installation', () => {
  const texts = content.map(({ text }) => text);

  it('bandeau permanent et titre de la page', () => {
    assert.ok(
      texts.includes('Démonstration\u00a0: rien n’est envoyé, aucune HAKO n’est installée.'),
      'texte du bandeau',
    );
    assert.ok(
      texts.some((text) => text.startsWith('Démonstration de ')),
      'titre de la page',
    );
    assert.ok(texts.includes('EXEMPLE'), 'filigrane de la fiche');
  });

  it('mots de passe d’exemple fixes : « exemple », trois mots, puis 00', () => {
    assert.equal(EXAMPLE_PASSWORDS.length, MAX_PEOPLE, 'un par personne possible');
    assert.equal(new Set(EXAMPLE_PASSWORDS).size, EXAMPLE_PASSWORDS.length, 'tous différents');
    for (const password of EXAMPLE_PASSWORDS) {
      assert.match(password, /^exemple(?:-[a-z]{4,8}){3}-00$/u, password);
    }
  });

  it('aucun mot de passe écrit dans le fichier de textes', () => {
    assert.deepEqual(offenders(content, /(?:^|[^\p{L}])[a-z]{4,8}(?:-[a-z]{4,8}){2,}-\d\d\b/u), []);
  });
});

describe('faits de la page de la HAKO', () => {
  /** Identifiant tiré d’un prénom : minuscules, sans accent ni espace. */
  const login = (firstName: string): string =>
    firstName
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/\s+/gu, '');

  it('de 1 à 8 personnes, identifiants en @hako.local', () => {
    assert.equal(MIN_PEOPLE, 1);
    assert.equal(MAX_PEOPLE, 8);
    assert.equal(LOGIN_DOMAIN, `@${BOX_HOST}`);
    assert.equal(loginExample.login, `${login(loginExample.firstName)}${LOGIN_DOMAIN}`);
    assert.equal(duplicateExample.login, `${login(duplicateExample.firstName)}2${LOGIN_DOMAIN}`);
  });

  it('prénoms d’exemple acceptés par la page', () => {
    assert.ok(EXAMPLE_FIRST_NAMES.length <= MAX_PEOPLE);
    for (const name of EXAMPLE_FIRST_NAMES) {
      assert.match(name, /^\p{L}+$/u, name);
      assert.ok(name.length <= FIRST_NAME_MAX_LENGTH, name);
    }
  });

  it('informations à confirmer : texte provisoire entre crochets', () => {
    for (const [key, value] of Object.entries(pending)) {
      if (isTodo(value)) assert.match(value.placeholder, /^\[.+\]$/u, key);
      else assert.ok(value.trim().length > 0, key);
    }
  });

  it('page de démonstration sous le guide d’installation', () => {
    assert.match(DEMO_ROUTE, /^\/installer\/[a-z-]+\/$/u);
  });
});
