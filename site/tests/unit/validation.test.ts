/**
 * Règles de validation du formulaire de commande (src/lib/commande/validation.ts).
 * Lancement : node --test tests/unit/
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pricing } from '../../src/data/tarifs.ts';
import { computeQuote } from '../../src/lib/commande/pricing.ts';
import {
  FIELD_RULES,
  STEP_FIELDS,
  isCount,
  isEmail,
  isPhone,
  stepOf,
  toOrderRequest,
  validateConsent,
  validateFields,
  validateOrder,
  validateStep,
  validateText,
  type OrderDraft,
} from '../../src/lib/commande/validation.ts';

const valid: OrderDraft = {
  offer: 'home',
  storage: '1to',
  firstName: 'Camille',
  lastName: 'Martin',
  email: 'camille@domaine.fr',
  phone: '04 91 00 00 00',
  address: '12 rue des Oliviers',
  postalCode: '13100',
  city: 'Aix-en-Provence',
  companyName: '',
  users: '',
  timeSlots: [],
  availabilityNote: '',
  acceptTerms: true,
  acceptPrivacy: true,
};

describe('formats', () => {
  it('reconnaît une adresse e-mail', () => {
    assert.ok(isEmail('camille@domaine.fr'));
    assert.ok(isEmail(' prenom.nom+hako@exemple.org '));
    for (const wrong of ['camille', 'camille@', '@domaine.fr', 'camille@domaine', 'a b@c.fr']) {
      assert.equal(isEmail(wrong), false, wrong);
    }
  });

  it('reconnaît un numéro de téléphone français ou international', () => {
    for (const right of [
      '04 91 00 00 00',
      '0491000000',
      '06.12.34.56.78',
      '+33 4 91 00 00 00',
      '+33 (0)4 91 00 00 00',
      '0033491000000',
      '+44 20 7946 0958',
    ]) {
      assert.ok(isPhone(right), right);
    }
    for (const wrong of ['12345', '04 91 00 00', '00 00 00 00 00', 'téléphone', '+33 4 91']) {
      assert.equal(isPhone(wrong), false, wrong);
    }
  });

  it('demande un nombre entier de personnes, 1 ou plus', () => {
    assert.ok(isCount('1'));
    assert.ok(isCount(' 12 '));
    for (const wrong of ['0', '-2', '2,5', 'deux', '']) assert.equal(isCount(wrong), false, wrong);
  });
});

describe('un champ', () => {
  it('signale un champ obligatoire vide (les espaces ne comptent pas)', () => {
    assert.equal(validateText('firstName', ''), 'required');
    assert.equal(validateText('firstName', '   '), 'required');
    assert.equal(validateText('firstName', 'Camille'), null);
  });

  it('accepte un champ facultatif vide', () => {
    assert.equal(FIELD_RULES.availabilityNote.required, false);
    assert.equal(validateText('availabilityNote', ''), null);
  });

  it('signale un format faux et un texte trop long', () => {
    assert.equal(validateText('email', 'camille@'), 'invalid');
    assert.equal(validateText('postalCode', '1310'), 'invalid');
    assert.equal(validateText('postalCode', '13 100'), null);
    assert.equal(validateText('users', '0'), 'invalid');
    assert.equal(validateText('city', 'x'.repeat(FIELD_RULES.city.maxLength + 1)), 'tooLong');
  });

  it('demande que les cases obligatoires soient cochées', () => {
    assert.equal(validateConsent(false), 'unchecked');
    assert.equal(validateConsent(true), null);
  });
});

describe('les étapes', () => {
  it('n’a rien à vérifier à l’étape 1 (les choix sont toujours faits)', () => {
    assert.deepEqual(validateStep({ ...valid, firstName: '' }, 1), []);
  });

  it('rend les erreurs dans l’ordre de la page', () => {
    const errors = validateStep({ ...valid, firstName: '', email: 'x', postalCode: '' }, 2);
    assert.deepEqual(errors, [
      { field: 'firstName', code: 'required' },
      { field: 'email', code: 'invalid' },
      { field: 'postalCode', code: 'required' },
    ]);
  });

  it('ne demande l’entreprise et le nombre de personnes que pour Hako Pro', () => {
    assert.deepEqual(validateStep(valid, 2), []);
    assert.deepEqual(validateStep({ ...valid, offer: 'pro' }, 2), [
      { field: 'companyName', code: 'required' },
      { field: 'users', code: 'required' },
    ]);
    assert.deepEqual(
      validateStep({ ...valid, offer: 'pro', companyName: 'Atelier', users: '4' }, 2),
      [],
    );
  });

  it('vérifie les deux cases du récapitulatif', () => {
    assert.deepEqual(validateStep({ ...valid, acceptTerms: false, acceptPrivacy: false }, 3), [
      { field: 'acceptTerms', code: 'unchecked' },
      { field: 'acceptPrivacy', code: 'unchecked' },
    ]);
  });

  it('situe chaque champ dans son étape', () => {
    for (const step of [1, 2, 3] as const) {
      for (const field of STEP_FIELDS[step]) assert.equal(stepOf(field), step);
    }
  });

  it('accepte une demande complète', () => {
    assert.deepEqual(validateOrder(valid), []);
    assert.deepEqual(validateFields(valid, ['email', 'phone']), []);
  });
});

describe('mise en forme de la demande', () => {
  it('nettoie les valeurs et ne garde l’entreprise que pour Hako Pro', () => {
    const draft: OrderDraft = {
      ...valid,
      offer: 'pro',
      storage: '2to',
      firstName: '  Camille ',
      postalCode: '13 100',
      companyName: ' Atelier Martin ',
      users: ' 4 ',
      timeSlots: ['matin'],
    };
    const request = toOrderRequest(draft, computeQuote(pricing, 'pro', '2to'));
    assert.equal(request.contact.firstName, 'Camille');
    assert.equal(request.contact.postalCode, '13100');
    assert.deepEqual(request.company, { name: 'Atelier Martin', users: 4 });
    assert.deepEqual(request.timeSlots, ['matin']);
    assert.equal(request.outsideServiceArea, false);
    assert.equal(toOrderRequest(valid, computeQuote(pricing, 'home', '1to')).company, null);
  });

  it('note un code postal hors zone sans refuser la demande', () => {
    const request = toOrderRequest(
      { ...valid, postalCode: '06000', city: 'Nice' },
      computeQuote(pricing, 'home', '1to'),
    );
    assert.equal(request.outsideServiceArea, true);
  });

  it('reprend les montants affichés, sans inventer ceux qui manquent', () => {
    const quote = computeQuote(pricing, 'pro', '2to');
    const request = toOrderRequest({ ...valid, offer: 'pro', companyName: 'A', users: '2' }, quote);
    assert.equal(request.displayedQuote.oneTimeTotalEur, quote.oneTimeTotalEur);
    assert.equal(request.displayedQuote.monthlyEur, quote.monthlyEur);
    // Un seul paiement pour la box, puis l'abonnement : rien d'autre n'est transmis.
    assert.deepEqual(request.displayedQuote, {
      oneTimeTotalEur: quote.oneTimeTotalEur,
      monthlyEur: quote.monthlyEur,
    });
  });

  it('refuse de mettre en forme une demande incomplète', () => {
    assert.throws(
      () => toOrderRequest({ ...valid, email: '' }, computeQuote(pricing, 'home', '1to')),
      /email/,
    );
  });
});
