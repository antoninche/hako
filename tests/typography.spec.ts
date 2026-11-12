/**
 * Typographie française des fichiers de données (src/lib/typography.ts), sans
 * navigateur : espaces insécables et apostrophe courbe posées à la définition.
 */

import { expect, test } from '@playwright/test';

import { company } from '../src/data/entreprise';
import { isTodo, todo } from '../src/lib/todo';
import { frenchTypography, withFrenchTypography } from '../src/lib/typography';

const NBSP = '\u00a0';
const THIN = '\u202f';

test.describe('Typographie française', () => {
  test('espaces insécables et apostrophe courbe', () => {
    expect(
      frenchTypography("Nos engagements : nous n'avons pas « accès » ; vraiment ? Oui !"),
    ).toBe(
      `Nos engagements${NBSP}: nous n’avons pas «${NBSP}accès${NBSP}»${THIN}; vraiment${THIN}? Oui${THIN}!`,
    );
  });

  test('adresses, heures et texte déjà correct : inchangés', () => {
    for (const text of [
      'https://exemple.fr/page?x=1',
      'bonjour@exemple.fr',
      'Rendez-vous à 10:30',
      `Nos engagements${NBSP}: nous`,
      'Salon-de-Provence',
    ]) {
      expect(frenchTypography(text)).toBe(text);
    }
  });

  test('objet de données : même forme, informations manquantes reconnues', () => {
    const data = withFrenchTypography({
      note: 'Note : oui',
      list: ['Pourquoi ?'],
      missing: todo("Ce qui manque : l'adresse", '[adresse]'),
      count: 3,
    });
    expect(data.note).toBe(`Note${NBSP}: oui`);
    expect(data.list).toEqual([`Pourquoi${THIN}?`]);
    expect(isTodo(data.missing)).toBe(true);
    expect(data.missing).toEqual({
      todo: `Ce qui manque${NBSP}: l’adresse`,
      placeholder: '[adresse]',
    });
    expect(data.count).toBe(3);
    expect(Object.isFrozen(data)).toBe(true);
  });

  test('phrase du pied de page, exacte', () => {
    expect(company.siteNotes.privacy).toBe(
      `Ce site ne vous piste pas${NBSP}: zéro cookie, zéro traceur.`,
    );
  });
});
