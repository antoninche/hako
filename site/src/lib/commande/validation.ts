/**
 * Règles de validation du formulaire de commande.
 *
 * Ces fonctions ne touchent pas à la page : elles reçoivent des valeurs et
 * renvoient un code d'erreur (« required », « invalid »…). Le formulaire
 * affiche ensuite le message correspondant, écrit dans src/content/commande.ts.
 * Les attributs HTML des champs (required, type="email", maxlength…) décrivent
 * les mêmes règles pour les navigateurs et les lecteurs d'écran.
 */
import type { OfferId, StorageId } from '../../data/tarifs.ts';
import type { Quote } from './pricing.ts';
import { isOutsideServiceArea, isPostalCode, normalizePostalCode } from './service-area.ts';
import type { OrderRequest, StepNumber, TimeSlotId } from './types.ts';

export type TextField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'address'
  | 'postalCode'
  | 'city'
  | 'companyName'
  | 'users'
  | 'availabilityNote';

export type ConsentField = 'acceptTerms' | 'acceptPrivacy';

export type OrderField = TextField | ConsentField;

/** Raison du refus d'un champ. */
export type ValidationCode = 'required' | 'invalid' | 'tooLong' | 'unchecked';

export interface FieldRule {
  readonly required: boolean;
  /** Champ demandé seulement pour Hako Pro. */
  readonly proOnly?: boolean;
  readonly format?: 'email' | 'phone' | 'postalCode' | 'count';
  /** Longueur maximale, reprise dans l'attribut maxlength du champ. */
  readonly maxLength: number;
}

export const FIELD_RULES: Readonly<Record<TextField, FieldRule>> = {
  firstName: { required: true, maxLength: 100 },
  lastName: { required: true, maxLength: 100 },
  email: { required: true, format: 'email', maxLength: 254 },
  phone: { required: true, format: 'phone', maxLength: 30 },
  address: { required: true, maxLength: 200 },
  postalCode: { required: true, format: 'postalCode', maxLength: 10 },
  city: { required: true, maxLength: 100 },
  companyName: { required: true, proOnly: true, maxLength: 150 },
  users: { required: true, proOnly: true, format: 'count', maxLength: 6 },
  availabilityNote: { required: false, maxLength: 500 },
};

const CONSENT_FIELDS: readonly ConsentField[] = ['acceptTerms', 'acceptPrivacy'];

/** Champs vérifiés à chaque étape (l'étape 1 n'a que des choix déjà faits). */
export const STEP_FIELDS: Readonly<Record<StepNumber, readonly OrderField[]>> = {
  1: [],
  2: [
    'firstName',
    'lastName',
    'email',
    'phone',
    'address',
    'postalCode',
    'city',
    'companyName',
    'users',
    'availabilityNote',
  ],
  3: ['acceptTerms', 'acceptPrivacy'],
};

/** Adresse e-mail : un @, puis un nom de domaine avec au moins un point. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value.trim());
}

/**
 * Téléphone : numéro français à 10 chiffres (« 04 91 00 00 00 »), forme
 * internationale « +33 4 91… » ou « 0033… », ou autre numéro international.
 * Espaces, points, tirets et parenthèses sont acceptés.
 */
export function isPhone(value: string): boolean {
  const compact = value.trim().replace(/[\s.()-]/g, '');
  return (
    /^0[1-9]\d{8}$/.test(compact) ||
    /^(\+|00)330?[1-9]\d{8}$/.test(compact) ||
    /^(\+|00)(?!33)[1-9]\d{6,14}$/.test(compact)
  );
}

/** Nombre entier, 1 ou plus. */
export function isCount(value: string): boolean {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) && Number(trimmed) >= 1;
}

function matchesFormat(format: NonNullable<FieldRule['format']>, value: string): boolean {
  switch (format) {
    case 'email':
      return isEmail(value);
    case 'phone':
      return isPhone(value);
    case 'postalCode':
      return isPostalCode(value);
    case 'count':
      return isCount(value);
  }
}

/** Vérifie un champ de texte ; renvoie null s'il est accepté. */
export function validateText(field: TextField, value: string): ValidationCode | null {
  const rule = FIELD_RULES[field];
  const trimmed = value.trim();
  if (trimmed === '') return rule.required ? 'required' : null;
  if (trimmed.length > rule.maxLength) return 'tooLong';
  if (rule.format && !matchesFormat(rule.format, trimmed)) return 'invalid';
  return null;
}

/** Case à cocher obligatoire. */
export function validateConsent(checked: boolean): ValidationCode | null {
  return checked ? null : 'unchecked';
}

function isConsentField(field: OrderField): field is ConsentField {
  return (CONSENT_FIELDS as readonly string[]).includes(field);
}

/** Le champ est-il demandé pour cette offre ? (les champs « entreprise » : Hako Pro seulement) */
export function isFieldActive(field: OrderField, offer: OfferId): boolean {
  if (isConsentField(field)) return true;
  return !FIELD_RULES[field].proOnly || offer === 'pro';
}

/** Valeurs du formulaire, telles que saisies. */
export interface OrderDraft {
  readonly offer: OfferId;
  readonly storage: StorageId;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
  readonly postalCode: string;
  readonly city: string;
  readonly companyName: string;
  readonly users: string;
  readonly timeSlots: readonly TimeSlotId[];
  readonly availabilityNote: string;
  readonly acceptTerms: boolean;
  readonly acceptPrivacy: boolean;
}

export interface FieldError {
  readonly field: OrderField;
  readonly code: ValidationCode;
}

/** Vérifie les champs demandés, dans l'ordre donné (celui de la page). */
export function validateFields(draft: OrderDraft, fields: readonly OrderField[]): FieldError[] {
  const errors: FieldError[] = [];
  for (const field of fields) {
    if (!isFieldActive(field, draft.offer)) continue;
    const code = isConsentField(field)
      ? validateConsent(draft[field])
      : validateText(field, draft[field]);
    if (code) errors.push({ field, code });
  }
  return errors;
}

export function validateStep(draft: OrderDraft, step: StepNumber): FieldError[] {
  return validateFields(draft, STEP_FIELDS[step]);
}

/** Toutes les étapes, dans l'ordre. */
export function validateOrder(draft: OrderDraft): FieldError[] {
  return [...validateStep(draft, 1), ...validateStep(draft, 2), ...validateStep(draft, 3)];
}

/** Étape où se trouve un champ. */
export function stepOf(field: OrderField): StepNumber {
  if (STEP_FIELDS[3].includes(field)) return 3;
  if (STEP_FIELDS[2].includes(field)) return 2;
  return 1;
}

/**
 * Met en forme une demande déjà validée : espaces retirés, code postal
 * compacté, nombre de personnes converti, champs « entreprise » seulement
 * pour Hako Pro.
 */
export function toOrderRequest(draft: OrderDraft, quote: Quote): OrderRequest {
  const errors = validateOrder(draft);
  if (errors.length > 0) {
    throw new Error(`Demande incomplète : ${errors.map((error) => error.field).join(', ')}`);
  }
  const postalCode = normalizePostalCode(draft.postalCode);
  return {
    offer: draft.offer,
    storage: draft.storage,
    contact: {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      address: draft.address.trim(),
      postalCode,
      city: draft.city.trim(),
    },
    company:
      draft.offer === 'pro'
        ? { name: draft.companyName.trim(), users: Number(draft.users.trim()) }
        : null,
    timeSlots: [...draft.timeSlots],
    availabilityNote: draft.availabilityNote.trim(),
    outsideServiceArea: isOutsideServiceArea(postalCode),
    acceptedTerms: draft.acceptTerms,
    acknowledgedPrivacy: draft.acceptPrivacy,
    displayedQuote: {
      oneTimeTotalEur: quote.oneTimeTotalEur,
      monthlyEur: quote.monthlyEur,
    },
  };
}
