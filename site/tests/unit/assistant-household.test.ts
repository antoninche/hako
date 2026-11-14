/**
 * Page de la HAKO, première installation : les prénoms de la maison, leurs
 * identifiants et le mot de passe recopié (src/lib/assistant/household.ts).
 *
 * - Prénoms : nettoyés, refusés quand ils sont vides, trop longs, ou faits
 *   d'autre chose que de lettres (espaces, traits d'union et apostrophes
 *   admis entre deux lettres).
 * - Identifiants : prénom en minuscules, sans accent, sans espace ni
 *   apostrophe, suivi de @hako.local ; « 2 », « 3 »… pour un identifiant déjà
 *   pris ; jamais plus de 64 caractères (limite de Nextcloud).
 * - Les exemples cités par la page (src/data/assistant.ts) suivent ces règles.
 *
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FIRST_NAME_MAX_LENGTH,
  LOGIN_DOMAIN,
  duplicateExample,
  loginExample,
} from '../../src/data/assistant.ts';
import {
  MAX_LOGIN_LENGTH,
  assignLogins,
  checkPeople,
  cleanFirstName,
  elides,
  firstNameError,
  loginBase,
  loginChunks,
  passwordChunks,
  takenBy,
  typedPasswordError,
} from '../../src/lib/assistant/household.ts';

const MAX = FIRST_NAME_MAX_LENGTH;

describe('prénoms', () => {
  it('nettoie les espaces en trop, garde le reste', () => {
    assert.equal(cleanFirstName('  Marie   Claire '), 'Marie Claire');
    assert.equal(cleanFirstName('\tLéa\n'), 'Léa');
    // Forme décomposée (e + accent) ramenée à la forme composée.
    assert.equal(cleanFirstName('Hélène'), 'Hélène');
  });

  it('accepte les lettres, accents, espaces, traits d’union et apostrophes', () => {
    for (const name of [
      'Hélène',
      'Jean-Marc',
      'N’Golo',
      "N'Golo",
      'Marie Claire',
      'Zoë',
      'Œdipe',
      'Ægir',
    ]) {
      assert.equal(firstNameError(cleanFirstName(name), MAX), null, name);
    }
  });

  it('refuse un prénom vide, trop long, ou qui n’est pas fait de lettres', () => {
    assert.equal(firstNameError('', MAX), 'missing');
    assert.equal(firstNameError('a'.repeat(MAX), MAX), null);
    assert.equal(firstNameError('a'.repeat(MAX + 1), MAX), 'tooLong');
    for (const name of ['Marc2', 'J.-P.', 'Léa 🙂', '-Léa', 'Léa-', 'Jean--Marc', 'Léa_B', '李']) {
      assert.equal(firstNameError(cleanFirstName(name), MAX), 'characters', name);
    }
  });

  it('la liste : la personne responsable d’abord, chaque refus à son rang', () => {
    const { firstNames, errors } = checkPeople(
      [' ', 'Marc', '', 'Léa 2', 'x'.repeat(MAX + 1)],
      MAX,
    );
    assert.deepEqual(firstNames.slice(0, 3), ['', 'Marc', '']);
    assert.deepEqual(errors, [
      { index: 0, code: 'ownerMissing' },
      { index: 2, code: 'missing' },
      { index: 3, code: 'characters' },
      { index: 4, code: 'tooLong' },
    ]);
    assert.deepEqual(checkPeople(['Hélène', 'Camille', 'Camille'], MAX).errors, []);
  });
});

describe('identifiants', () => {
  it('prénom en minuscules, sans accent, sans espace ni apostrophe', () => {
    assert.equal(loginBase('Hélène'), 'helene');
    assert.equal(loginBase('Marie Claire'), 'marieclaire');
    assert.equal(loginBase('Jean-Marc'), 'jean-marc');
    assert.equal(loginBase('N’Golo'), 'ngolo');
    assert.equal(loginBase('Œdipe'), 'oedipe');
    assert.equal(loginBase('Zoë'), 'zoe');
    assert.equal(loginBase('李'), '');
  });

  it('suivis de @hako.local, avec 2, 3… pour un identifiant déjà pris', () => {
    assert.deepEqual(assignLogins(['Camille', 'Hélène', 'camille', 'Camille'], LOGIN_DOMAIN), [
      'camille@hako.local',
      'helene@hako.local',
      'camille2@hako.local',
      'camille3@hako.local',
    ]);
    // Même identifiant sans les accents : c'est un doublon aussi.
    assert.deepEqual(assignLogins(['Hélène', 'Helene'], LOGIN_DOMAIN), [
      'helene@hako.local',
      'helene2@hako.local',
    ]);
    // Un prénom refusé n'a pas d'identifiant.
    assert.deepEqual(assignLogins(['', 'Léa'], LOGIN_DOMAIN), ['', 'lea@hako.local']);
  });

  it('jamais plus de 64 caractères, même avec des lettres doubles (œ, ß)', () => {
    assert.equal(MAX_LOGIN_LENGTH, 64);
    const long = 'Œ'.repeat(MAX);
    const logins = assignLogins([long, long], LOGIN_DOMAIN);
    for (const login of logins) {
      assert.ok(login.length <= MAX_LOGIN_LENGTH, `${login.length} caractères`);
      assert.match(login, /^[a-z-]+\d?@hako\.local$/u);
    }
    assert.notEqual(logins[0], logins[1]);
  });

  it('un identifiant qui reçoit un chiffre : la personne qui a déjà le même', () => {
    // Zoé et Zoë : le même identifiant sans les accents.
    assert.deepEqual(takenBy(['Zoé', 'Marc', 'Zoë', 'zoe'], LOGIN_DOMAIN), [null, null, 0, 0]);
    assert.deepEqual(takenBy(['Léa', '', 'Léa'], LOGIN_DOMAIN), [null, null, 0]);
    assert.deepEqual(takenBy(['Hélène', 'Marc'], LOGIN_DOMAIN), [null, null]);
  });

  it('se coupent devant « @ », jamais au milieu de @hako.local', () => {
    assert.deepEqual(loginChunks('zoe2@hako.local'), ['zoe2', '@hako.local']);
    assert.deepEqual(loginChunks('sans-arobase'), ['sans-arobase']);
  });

  it('les exemples de la page suivent la règle', () => {
    assert.deepEqual(assignLogins([loginExample.firstName], LOGIN_DOMAIN), [loginExample.login]);
    assert.deepEqual(
      assignLogins([duplicateExample.firstName, duplicateExample.firstName], LOGIN_DOMAIN)[1],
      duplicateExample.login,
    );
  });
});

describe('mot de passe recopié, avant de le montrer à la HAKO', () => {
  it('vide, majuscule, espace : refusé sur l’appareil', () => {
    assert.equal(typedPasswordError(''), 'empty');
    assert.equal(typedPasswordError('Exemple-tulipe-melon-givre-00'), 'uppercase');
    assert.equal(typedPasswordError('exemple-tulipe-melon-givre-00 '), 'space');
    assert.equal(typedPasswordError('exemple tulipe'), 'space');
    assert.equal(typedPasswordError('exemple-tulipe-melon-givre-00'), null);
  });

  it('chiffres tapés sans Maj sur un clavier français (« àà ») : un signe, refusé', () => {
    assert.equal(typedPasswordError('exemple-tulipe-melon-givre-àà'), 'character');
    assert.equal(typedPasswordError('exemple-tulipe-melon-givre-é&'), 'character');
    assert.equal(typedPasswordError('exemple_tulipe'), 'character');
    assert.equal(typedPasswordError('pomme-sable-42'), null);
  });
});

describe('mots de passe et prénoms à l’écran', () => {
  it('un mot de passe ne se coupe que devant ses tirets', () => {
    assert.deepEqual(passwordChunks('exemple-tulipe-melon-givre-00'), [
      'exemple',
      '-tulipe',
      '-melon',
      '-givre',
      '-00',
    ]);
    assert.equal(
      passwordChunks('exemple-tulipe-melon-givre-00').join(''),
      'exemple-tulipe-melon-givre-00',
    );
  });

  it('« d’Hélène », « d’Hugo », mais « de Marc »', () => {
    for (const name of ['Hélène', 'Hugo', 'Anne', 'Émile', 'Œdipe']) assert.ok(elides(name), name);
    for (const name of ['Marc', 'Léa', 'Camille']) assert.ok(!elides(name), name);
  });
});
