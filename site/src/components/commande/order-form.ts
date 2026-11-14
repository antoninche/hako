/**
 * Comportement du formulaire de commande (voir OrderForm.astro).
 *
 * - Une seule étape visible à la fois ; l'indicateur d'étapes suit, et le
 *   focus va sur le titre de l'étape affichée.
 * - Total en direct : le gabarit de la combinaison offre + stockage choisie
 *   remplace l'ancien, dans une zone annoncée poliment par les lecteurs d'écran.
 * - Vérification des champs avec les règles de src/lib/commande/validation.ts :
 *   message au-dessus du champ, aria-invalid, aria-describedby, et résumé des
 *   erreurs qui reçoit le focus, avec un lien vers chaque champ.
 * - Note « hors zone » d'après le code postal, sans jamais bloquer la demande :
 *   hors de la zone, la box est envoyée et le récapitulatif le dit.
 * - Envoi par l'OrderSubmitter reçu : en démonstration, rien ne quitte le
 *   navigateur (ni requête, ni stockage).
 *
 * Ce script ne contient aucun texte affiché : tout vient de la page.
 */
import { pricing, type OfferId, type StorageId } from '../../data/tarifs.ts';
import { computeQuote, parseOfferId, quoteKey } from '../../lib/commande/pricing.ts';
import { isOutsideServiceArea, normalizePostalCode } from '../../lib/commande/service-area.ts';
import type { OrderSubmitter, SubmitResult } from '../../lib/commande/submitter.ts';
import type { StepNumber, TimeSlotId } from '../../lib/commande/types.ts';
import {
  STEP_FIELDS,
  stepOf,
  toOrderRequest,
  validateFields,
  validateOrder,
  validateStep,
  type FieldError,
  type OrderDraft,
  type OrderField,
  type TextField,
  type ValidationCode,
} from '../../lib/commande/validation.ts';

type Control = HTMLInputElement | HTMLTextAreaElement;

/** Attribut data-* qui porte le message de chaque raison de refus. */
const MESSAGE_KEYS: Readonly<Record<ValidationCode, string>> = {
  required: 'msgRequired',
  invalid: 'msgInvalid',
  tooLong: 'msgTooLong',
  unchecked: 'msgUnchecked',
};

const STEPS: readonly StepNumber[] = [1, 2, 3];
const PRO_FIELDS: readonly OrderField[] = ['companyName', 'users'];

function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Formulaire de commande : élément introuvable (${what}).`);
  }
  return value;
}

function isStepNumber(value: number): value is StepNumber {
  return value === 1 || value === 2 || value === 3;
}

export function initOrderForm(root: HTMLElement, submitter: OrderSubmitter): void {
  const find = <T extends Element>(selector: string, scope: ParentNode = root): T =>
    must(scope.querySelector<T>(selector), selector);

  const form = find<HTMLFormElement>('[data-order-form]');
  const indicatorList = find<HTMLElement>('[data-steps]');
  const summary = find<HTMLElement>('[data-error-summary]');
  const summaryTitle = find<HTMLElement>('[data-error-summary-title]', summary);
  const summaryList = find<HTMLUListElement>('[data-error-summary-list]', summary);
  const announcer = find<HTMLElement>('[data-announcer]');
  const total = find<HTMLElement>('[data-total]');
  const totalSlot = find<HTMLElement>('[data-quote-slot="total"]');
  const recapSlot = find<HTMLElement>('[data-quote-slot="recap"]');
  const recapList = find<HTMLElement>('[data-no-preference]');
  const proGroup = find<HTMLFieldSetElement>('[data-pro-only]');
  const areaOutside = find<HTMLElement>('[data-area-outside]');
  const submitButton = find<HTMLButtonElement>('[data-submit]');
  const sendError = find<HTMLElement>('[data-send-error]');
  const confirmation = find<HTMLElement>('[data-confirmation]');
  const confirmationTitle = find<HTMLElement>('h2', confirmation);

  const steps = new Map<StepNumber, HTMLElement>(
    STEPS.map((step) => [step, find<HTMLElement>(`[data-step="${step}"]`)]),
  );
  const indicators = new Map<StepNumber, HTMLElement>(
    STEPS.map((step) => [step, find<HTMLElement>(`[data-step-indicator="${step}"]`)]),
  );
  const templates = new Map<string, HTMLTemplateElement>();
  for (const template of root.querySelectorAll<HTMLTemplateElement>('[data-quote-template]')) {
    templates.set(template.dataset['quoteTemplate'] ?? '', template);
  }

  let current: StepNumber = 1;
  let sending = false;
  let outsideArea = false;
  let announceTimer = 0;

  // ---------------------------------------------------------------- lecture

  const control = (field: OrderField): Control => find<Control>(`[data-field="${field}"]`, form);
  const checkbox = (field: OrderField): HTMLInputElement =>
    find<HTMLInputElement>(`input[data-field="${field}"]`, form);
  const value = (field: TextField): string => control(field).value;

  function selectedOffer(): OfferId {
    const checked = form.querySelector<HTMLInputElement>('input[name="offre"]:checked');
    return parseOfferId(checked?.value) ?? 'home';
  }

  function selectedStorage(): StorageId {
    const checked = form.querySelector<HTMLInputElement>('input[name="stockage"]:checked');
    const option = pricing.storage.find((candidate) => candidate.id === checked?.value);
    return option?.id ?? pricing.includedStorage;
  }

  function selectedTimeSlots(): HTMLInputElement[] {
    return [...form.querySelectorAll<HTMLInputElement>('input[data-time-slot]:checked')];
  }

  function readDraft(): OrderDraft {
    return {
      offer: selectedOffer(),
      storage: selectedStorage(),
      firstName: value('firstName'),
      lastName: value('lastName'),
      email: value('email'),
      phone: value('phone'),
      address: value('address'),
      postalCode: value('postalCode'),
      city: value('city'),
      companyName: value('companyName'),
      users: value('users'),
      timeSlots: selectedTimeSlots().map((input) => input.value as TimeSlotId),
      availabilityNote: value('availabilityNote'),
      acceptTerms: checkbox('acceptTerms').checked,
      acceptPrivacy: checkbox('acceptPrivacy').checked,
    };
  }

  const labelOf = (input: HTMLElement): string =>
    form.querySelector(`label[for="${input.id}"]`)?.textContent?.trim() ?? '';

  // ---------------------------------------------------------------- annonces

  /** Message lu poliment par les lecteurs d'écran, sans déplacer le focus. */
  function announce(message: string): void {
    announcer.textContent = '';
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => {
      announcer.textContent = message;
    }, 100);
  }

  // ---------------------------------------------------------------- erreurs

  function messageFor(input: HTMLElement, code: ValidationCode): string {
    return input.dataset[MESSAGE_KEYS[code]] ?? input.dataset['msgInvalid'] ?? '';
  }

  const errorElement = (input: HTMLElement): HTMLElement =>
    must(document.getElementById(`${input.id}-erreur`), `${input.id}-erreur`);

  /** Description du champ : son erreur d'abord, puis son aide, puis la note « hors zone ». */
  function refreshDescription(field: OrderField): void {
    const input = control(field);
    const ids = (input.dataset['describedby'] ?? '').split(/\s+/).filter(Boolean);
    const error = errorElement(input);
    if (!error.hidden) ids.unshift(error.id);
    if (field === 'postalCode' && outsideArea) ids.push(areaOutside.id);
    if (ids.length > 0) input.setAttribute('aria-describedby', ids.join(' '));
    else input.removeAttribute('aria-describedby');
  }

  function setFieldError(field: OrderField, code: ValidationCode | null): void {
    const input = control(field);
    const error = errorElement(input);
    const text = find<HTMLElement>('[data-error-text]', error);
    if (code) {
      text.textContent = messageFor(input, code);
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
    } else {
      text.textContent = '';
      error.hidden = true;
      input.removeAttribute('aria-invalid');
    }
    refreshDescription(field);
  }

  function updateSummaryTitle(count: number): void {
    const one = summary.dataset['titleOne'] ?? '';
    const many = summary.dataset['titleMany'] ?? '';
    summaryTitle.textContent = count === 1 ? one : many.replace('{n}', String(count));
  }

  function hideSummary(): void {
    summary.hidden = true;
    summaryList.replaceChildren();
  }

  function showSummary(errors: readonly FieldError[]): void {
    summaryList.replaceChildren(
      ...errors.map((error) => {
        const input = control(error.field);
        const item = document.createElement('li');
        item.dataset['errorItem'] = error.field;
        const link = document.createElement('a');
        link.href = `#${input.id}`;
        link.textContent = messageFor(input, error.code);
        item.append(link);
        return item;
      }),
    );
    updateSummaryTitle(errors.length);
    summary.hidden = false;
    summary.focus();
  }

  /** Une erreur corrigée disparaît aussi du résumé. */
  function clearFromSummary(field: OrderField): void {
    summaryList.querySelector(`[data-error-item="${field}"]`)?.remove();
    const remaining = summaryList.children.length;
    if (remaining === 0) hideSummary();
    else updateSummaryTitle(remaining);
  }

  /** Affiche les erreurs d'une étape (et efface celles qui sont corrigées). */
  function showErrors(errors: readonly FieldError[], fields: readonly OrderField[]): void {
    const failed = new Map<OrderField, ValidationCode>(
      errors.map((error) => [error.field, error.code]),
    );
    for (const field of fields) setFieldError(field, failed.get(field) ?? null);
    if (errors.length > 0) showSummary(errors);
    else hideSummary();
  }

  /** Lien du résumé : l'intitulé du champ en vue, puis le focus dans le champ. */
  summaryList.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest('a');
    const id = link?.getAttribute('href')?.slice(1);
    const input = id ? document.getElementById(id) : null;
    if (!input) return;
    event.preventDefault();
    const label = form.querySelector(`label[for="${input.id}"]`) ?? input;
    label.scrollIntoView({ block: 'center' });
    input.focus({ preventScroll: true });
  });

  // ---------------------------------------------------------------- choix et total

  function renderQuote(slot: HTMLElement, offer: OfferId, storage: StorageId): void {
    const template = templates.get(quoteKey(offer, storage));
    if (template) slot.replaceChildren(template.content.cloneNode(true));
  }

  function syncChoices(): void {
    const offer = selectedOffer();
    renderQuote(totalSlot, offer, selectedStorage());
    const isPro = offer === 'pro';
    proGroup.hidden = !isPro;
    proGroup.disabled = !isPro;
    if (!isPro) {
      for (const field of PRO_FIELDS) {
        setFieldError(field, null);
        clearFromSummary(field);
      }
    }
  }

  function updateServiceArea(): void {
    const outside = isOutsideServiceArea(value('postalCode'));
    if (outside === outsideArea) return;
    outsideArea = outside;
    areaOutside.hidden = !outside;
    refreshDescription('postalCode');
  }

  // ---------------------------------------------------------------- étapes

  function setRecap(name: string, text: string): void {
    find<HTMLElement>(`[data-recap-field="${name}"]`).textContent = text;
  }

  function showRecapRow(name: string, visible: boolean): void {
    find<HTMLElement>(`[data-recap-row="${name}"]`).hidden = !visible;
  }

  function fillRecap(): void {
    const draft = readDraft();
    renderQuote(recapSlot, draft.offer, draft.storage);
    setRecap('name', `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim());
    setRecap('email', draft.email.trim());
    setRecap('phone', draft.phone.trim());
    const town = `${normalizePostalCode(draft.postalCode)} ${draft.city.trim()}`.trim();
    setRecap('address', [draft.address.trim(), town].filter(Boolean).join(', '));
    // Installation chez vous, ou envoi de la box hors de la zone : les deux
    // textes sont dans la page, le code postal choisit lequel s'affiche.
    const shipped = isOutsideServiceArea(draft.postalCode);
    for (const option of root.querySelectorAll<HTMLElement>('[data-recap-installation]')) {
      option.hidden = (option.dataset['recapInstallation'] === 'shipped') !== shipped;
    }
    const isPro = draft.offer === 'pro';
    showRecapRow('company', isPro);
    showRecapRow('users', isPro);
    setRecap('company', draft.companyName.trim());
    setRecap('users', draft.users.trim());
    const slots = selectedTimeSlots().map(labelOf);
    setRecap(
      'timeSlots',
      slots.length > 0 ? slots.join(', ') : (recapList.dataset['noPreference'] ?? ''),
    );
    const note = draft.availabilityNote.trim();
    showRecapRow('note', note !== '');
    setRecap('note', note);
  }

  function goTo(step: StepNumber, options: { focus: boolean }): void {
    current = step;
    for (const [number, section] of steps) section.hidden = number !== step;
    const doneText = indicatorList.dataset['doneText'] ?? '';
    for (const [number, item] of indicators) {
      const state = number < step ? 'done' : number === step ? 'current' : 'upcoming';
      item.dataset['state'] = state;
      if (state === 'current') item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
      find<HTMLElement>('[data-step-state]', item).textContent =
        state === 'done' ? ` ${doneText}` : '';
    }
    hideSummary();
    sendError.hidden = true;
    if (step === 3) fillRecap();
    if (options.focus) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      indicatorList.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      find<HTMLElement>('h2', must(steps.get(step), `étape ${step}`)).focus({
        preventScroll: true,
      });
    }
  }

  function next(): void {
    const errors = validateStep(readDraft(), current);
    showErrors(errors, STEP_FIELDS[current]);
    const following = current + 1;
    if (errors.length === 0 && isStepNumber(following)) goTo(following, { focus: true });
  }

  // ---------------------------------------------------------------- envoi

  function showConfirmation(result: SubmitResult): void {
    form.hidden = true;
    indicatorList.hidden = true;
    confirmation.dataset['status'] = result.status;
    confirmation.hidden = false;
    confirmationTitle.focus();
  }

  async function send(): Promise<void> {
    if (sending) return;
    const draft = readDraft();
    const errors = validateOrder(draft);
    const [first] = errors;
    if (first) {
      const step = stepOf(first.field);
      if (step !== current) goTo(step, { focus: false });
      showErrors(
        errors.filter((error) => stepOf(error.field) === step),
        STEP_FIELDS[step],
      );
      return;
    }
    sending = true;
    sendError.hidden = true;
    const label = submitButton.textContent;
    submitButton.setAttribute('aria-disabled', 'true');
    submitButton.textContent = submitButton.dataset['sendingText'] ?? label;
    try {
      const quote = computeQuote(pricing, draft.offer, draft.storage);
      const result = await submitter.submit(toOrderRequest(draft, quote));
      showConfirmation(result);
    } catch {
      sendError.hidden = false;
    } finally {
      sending = false;
      submitButton.removeAttribute('aria-disabled');
      submitButton.textContent = label;
    }
  }

  // ---------------------------------------------------------------- événements

  root.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
      'button[data-action]',
    );
    if (!button) return;
    const action = button.dataset['action'];
    if (action === 'next') next();
    else if (action === 'back') {
      const previous = current - 1;
      if (isStepNumber(previous)) goTo(previous, { focus: true });
    } else if (action === 'goto') {
      const target = Number(button.dataset['goto']);
      if (isStepNumber(target)) goTo(target, { focus: true });
    } else if (action === 'restart') {
      confirmation.hidden = true;
      form.hidden = false;
      indicatorList.hidden = false;
      goTo(3, { focus: true });
    }
  });

  // Entrée dans un champ des étapes 1 et 2 : « Continuer », jamais l'envoi.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (current < 3) next();
    else void send();
  });

  form.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.name === 'offre' || target.name === 'stockage') syncChoices();
    const field = target.dataset['field'] as OrderField | undefined;
    if (field && target.type === 'checkbox' && target.checked) {
      setFieldError(field, null);
      clearFromSummary(field);
    }
  });

  // Pendant la saisie : la note « hors zone » suit le code postal, et une
  // erreur disparaît dès que le champ est correct (jamais de nouvelle erreur).
  const isControl = (target: EventTarget | null): target is Control =>
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

  form.addEventListener('input', (event) => {
    const target = event.target;
    if (!isControl(target)) return;
    const field = target.dataset['field'] as OrderField | undefined;
    if (!field || target.type === 'checkbox') return;
    if (field === 'postalCode') updateServiceArea();
    if (target.getAttribute('aria-invalid') !== 'true') return;
    if (validateFields(readDraft(), [field]).length === 0) {
      setFieldError(field, null);
      clearFromSummary(field);
    }
  });

  // En quittant un champ rempli : vérification, et annonce de l'erreur éventuelle.
  form.addEventListener('focusout', (event) => {
    const target = event.target;
    if (!isControl(target)) return;
    const field = target.dataset['field'] as OrderField | undefined;
    if (!field || target.type === 'checkbox') return;
    const wasInvalid = target.getAttribute('aria-invalid') === 'true';
    if (target.value.trim() === '' && !wasInvalid) return;
    const [error] = validateFields(readDraft(), [field]);
    setFieldError(field, error?.code ?? null);
    if (error) announce(messageFor(target, error.code));
    else clearFromSummary(field);
  });

  // ---------------------------------------------------------------- démarrage

  const fromAddress = parseOfferId(new URLSearchParams(window.location.search).get('offre'));
  if (fromAddress) {
    const radio = form.querySelector<HTMLInputElement>(
      `input[name="offre"][value="${fromAddress}"]`,
    );
    if (radio) radio.checked = true;
  }
  syncChoices();
  updateServiceArea();
  // Le total n'est annoncé qu'après ce premier affichage, à chaque changement de choix.
  total.setAttribute('aria-live', 'polite');
  submitButton.disabled = false;
  goTo(1, { focus: false });
  root.dataset['ready'] = 'true';
}
