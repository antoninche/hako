/**
 * Pages Offres et Commander : prix lus dans src/data/tarifs.ts, formulaire
 * en trois étapes, erreurs accessibles, envoi de démonstration sans aucune
 * requête, et contrôle axe (aucune violation grave ou critique).
 *
 * Les montants attendus sont calculés à partir du fichier des tarifs : les
 * tests restent justes quand un prix est fixé (null → nombre).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { company } from '../src/data/entreprise.ts';
import { pricing } from '../src/data/tarifs.ts';
import { formatEur } from '../src/lib/format.ts';
import { computeQuote, findStorage } from '../src/lib/commande/pricing.ts';
import { isTodo } from '../src/lib/todo.ts';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoSeriousViolations(page: Page, context: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const serious = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.id} : ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`,
    );
  expect(serious, `violations axe graves ou critiques (${context})`).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'la page ne doit pas défiler de côté').toBeLessThanOrEqual(0);
}

const totalSlot = (page: Page) => page.locator('[data-quote-slot="total"]');

/** Remplit l'étape 2 avec des coordonnées valides (code postal dans la zone). */
async function fillContact(page: Page, options: { pro: boolean; postalCode?: string }) {
  await page.getByLabel('Prénom', { exact: true }).fill('Camille');
  await page.getByLabel('Nom', { exact: true }).fill('Martin');
  await page.getByLabel('Adresse e-mail').fill('camille@domaine.fr');
  await page.getByLabel('Téléphone').fill('04 91 00 00 00');
  await page.getByLabel('Adresse', { exact: true }).fill('12 rue des Oliviers');
  await page.getByLabel('Code postal').fill(options.postalCode ?? '13100');
  await page.getByLabel('Commune').fill('Aix-en-Provence');
  if (options.pro) {
    await page.getByLabel('Nom de l’entreprise').fill('Atelier Martin');
    await page.getByLabel('Nombre de personnes').fill('4');
  }
}

const continueButton = (page: Page) =>
  page.locator('[data-step]:not([hidden])').getByRole('button', { name: 'Continuer' });

test.describe('Page Offres', () => {
  test('présente les deux offres avec leur prix et un lien vers la commande', async ({ page }) => {
    await page.goto('/offres/');
    for (const offer of Object.values(pricing.offers)) {
      const card = page.getByRole('article', { name: offer.name });
      await expect(card).toContainText(formatEur(offer.priceEur));
      await expect(card.getByRole('link', { name: `Commander ${offer.name}` })).toHaveAttribute(
        'href',
        `/commander/?offre=${offer.id}`,
      );
    }
  });

  test('affiche un supplément pas encore fixé en jaune, jamais comme 0 €', async ({ page }) => {
    await page.goto('/offres/');
    const list = page.getByRole('list', { name: 'Capacités proposées' });
    for (const option of pricing.storage) {
      const item = list.getByRole('listitem').filter({ hasText: option.label });
      if (option.extraEur === null) {
        await expect(item.locator('mark.todo')).toHaveCount(1);
        await expect(item).not.toContainText('0 €');
      } else if (option.extraEur > 0) {
        await expect(item).toContainText(formatEur(option.extraEur));
      }
    }
  });

  test('les capacités de stockage ont le même contour : aucune ne semble choisie', async ({
    page,
  }) => {
    await page.goto('/offres/');
    const list = page.getByRole('list', { name: 'Capacités proposées' });
    const borders = await list
      .getByRole('listitem')
      .evaluateAll((items) => items.map((item) => getComputedStyle(item).borderColor));
    expect(borders).toHaveLength(pricing.storage.length);
    expect(new Set(borders).size, 'une seule couleur de contour').toBe(1);
  });

  for (const width of [320, 360]) {
    test(`compare les offres dans un vrai tableau, lisible à ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/offres/');
      const table = page.getByRole('table', { name: 'Hako Home et Hako Pro, point par point' });
      await expect(table).toBeVisible();
      // En-têtes de colonnes gardés pour les lecteurs d'écran…
      await expect(table.getByRole('columnheader', { name: 'Hako Home' })).toHaveCount(1);
      await expect(table.getByRole('rowheader', { name: 'Prix d’achat' })).toBeVisible();
      // … et chaque valeur porte le nom de son offre, visible.
      const firstRow = table.getByRole('row').filter({ has: page.getByText('Prix d’achat') });
      await expect(firstRow.locator('.compare__label')).toHaveText(['Hako Home', 'Hako Pro']);
      await expect(firstRow.locator('.compare__label').first()).toBeVisible();
      // Aucune cellule ne déborde, et la page ne défile pas de côté.
      const overflowing = await table.evaluate((element) =>
        [...element.querySelectorAll('th, td')]
          .filter((cell) => cell.scrollWidth > cell.clientWidth + 1)
          .map((cell) => cell.textContent?.trim().replace(/\s+/g, ' ')),
      );
      expect(overflowing, 'cellules qui débordent').toEqual([]);
      await expectNoHorizontalOverflow(page);
    });
  }

  test('le tableau garde ses colonnes sur grand écran', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/offres/');
    const table = page.getByRole('table', { name: 'Hako Home et Hako Pro, point par point' });
    await expect(table.getByRole('columnheader', { name: 'Hako Pro' })).toBeVisible();
    await expect(table.locator('.compare__label').first()).toBeHidden();
  });

  for (const width of [390, 1440]) {
    test(`axe : aucune violation grave à ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/offres/');
      await expectNoSeriousViolations(page, `offres ${width}`);
    });
  }
});

test.describe('Page Commander', () => {
  test('?offre=pro choisit Hako Pro d’avance', async ({ page }) => {
    await page.goto('/commander/?offre=pro');
    await expect(page.getByRole('radio', { name: 'Hako Pro' })).toBeChecked();
    await expect(totalSlot(page).locator('[data-quote-monthly]')).toBeVisible();
    await continueButton(page).click();
    await expect(page.getByLabel('Nom de l’entreprise')).toBeVisible();

    await page.goto('/commander/?offre=home');
    await expect(page.getByRole('radio', { name: 'Hako Home' })).toBeChecked();
    await expect(totalSlot(page).locator('[data-quote-monthly]')).toHaveCount(0);
  });

  test('Pro + 2 To met à jour le total d’après le fichier des tarifs', async ({ page }) => {
    await page.goto('/commander/');
    await expect(page.locator('[data-total]')).toHaveAttribute('aria-live', 'polite');
    await page.getByRole('radio', { name: 'Hako Pro' }).check();
    await page.getByRole('radio', { name: findStorage(pricing, '2to').label }).check();

    const quote = computeQuote(pricing, 'pro', '2to');
    const total = totalSlot(page).locator('[data-quote-total]');
    if (quote.oneTimeTotalEur === null) {
      // Supplément inconnu : la partie connue, puis le repère jaune, jamais « 0 € ».
      await expect(total).toContainText(formatEur(quote.oneTimeKnownEur));
      await expect(total.locator('mark.todo').first()).toBeVisible();
      await expect(total).toContainText('+');
    } else {
      await expect(total).toContainText(formatEur(quote.oneTimeTotalEur));
    }
    if (quote.monthlyEur !== null) {
      await expect(totalSlot(page).locator('[data-quote-monthly]')).toContainText(
        formatEur(quote.monthlyEur),
      );
    }
    // Conditions de l'abonnement : statut de TVA (carte de l'offre) et durée
    // d'engagement (total), en jaune tant qu'elles ne sont pas décidées.
    const subscription = pricing.offers.pro.subscription;
    if (subscription) {
      const proCard = page
        .locator('.choice')
        .filter({ has: page.getByRole('radio', { name: 'Hako Pro' }) });
      const monthlyLine = proCard.locator('.offer-choice__price').filter({ hasText: 'par mois' });
      const commitment = totalSlot(page).locator('[data-quote-commitment]');
      if (subscription.taxStatus === null) {
        await expect(monthlyLine.locator('mark.todo')).toHaveCount(1);
      } else {
        await expect(monthlyLine).toContainText(subscription.taxStatus);
      }
      if (subscription.commitment === null) {
        await expect(commitment.locator('mark.todo')).toHaveCount(1);
      } else {
        await expect(commitment).toContainText(subscription.commitment);
      }
    }
    const deposit = totalSlot(page).locator('[data-quote-deposit]');
    if (quote.deposit.percent === null) await expect(deposit.locator('mark.todo')).toHaveCount(1);
    else if (quote.deposit.amountEur !== null) {
      await expect(deposit).toContainText(formatEur(quote.deposit.amountEur));
    }
  });

  test('les erreurs sont annoncées, reliées aux champs et résumées', async ({ page }) => {
    await page.goto('/commander/');
    await continueButton(page).click();
    await expect(page.getByRole('heading', { name: /Vos coordonnées/ })).toBeFocused();
    await continueButton(page).click();

    const summary = page.locator('[data-error-summary]');
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(summary).toHaveAccessibleName(/\d+ points? à corriger/);
    await expect(summary).toHaveAccessibleDescription(/Indiquez votre prénom\./);

    const firstName = page.getByLabel('Prénom', { exact: true });
    await expect(firstName).toHaveAttribute('aria-invalid', 'true');
    await expect(firstName).toHaveAttribute('aria-describedby', /prenom-erreur/);
    await expect(firstName).toHaveAccessibleDescription(/Indiquez votre prénom\./);
    // Le message ne repose pas sur la couleur : texte visible au-dessus du champ.
    await expect(page.locator('#prenom-erreur')).toBeVisible();

    await summary.getByRole('link', { name: 'Indiquez votre prénom.' }).click();
    await expect(firstName).toBeFocused();

    // Une adresse mal saisie est signalée en quittant le champ, et annoncée.
    const email = page.getByLabel('Adresse e-mail');
    await email.fill('camille@');
    await email.blur();
    await expect(email).toHaveAccessibleDescription(/Vérifiez votre adresse e-mail/);
    await expect(page.locator('[data-announcer]')).toContainText('Vérifiez votre adresse e-mail');

    // Corrigé : l'erreur disparaît du champ et du résumé.
    await firstName.fill('Camille');
    await expect(firstName).not.toHaveAttribute('aria-invalid', 'true');
    await expect(summary.getByRole('link', { name: 'Indiquez votre prénom.' })).toHaveCount(0);
  });

  test('un code postal hors zone affiche une note sans bloquer la demande', async ({ page }) => {
    await page.goto('/commander/');
    await continueButton(page).click();
    await fillContact(page, { pro: false, postalCode: '06000' });
    const note = page.locator('[data-area-outside]');
    await expect(note).toBeVisible();
    const outside = company.serviceArea.outside;
    if (isTodo(outside)) await expect(note.locator('mark.todo')).toHaveCount(1);
    else await expect(note).toContainText(outside);
    await expect(page.getByLabel('Code postal')).toHaveAccessibleDescription(/hors de notre zone/);
    await continueButton(page).click();
    await expect(page.getByRole('heading', { name: /Récapitulatif/ })).toBeFocused();
    // Hors de la zone, la box est envoyée : le récapitulatif le dit.
    await expect(page.locator('[data-recap-installation="shipped"]')).toBeVisible();
    await expect(page.locator('[data-recap-installation="home"]')).toBeHidden();
  });

  test('l’envoi de démonstration confirme sans aucune requête réseau', async ({ page }) => {
    await page.goto('/commander/?offre=pro');
    await page.waitForLoadState('networkidle');
    // Toutes les polices déclarées sont chargées d'avance : l'envoi ne peut
    // déclencher aucun chargement, même pour afficher la confirmation.
    await page.evaluate(async () => {
      await Promise.all([...document.fonts].map((font) => font.load().catch(() => undefined)));
      await document.fonts.ready;
    });

    const requests: string[] = [];
    page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));

    await page.getByRole('radio', { name: findStorage(pricing, '2to').label }).check();
    await continueButton(page).click();
    await fillContact(page, { pro: true });
    await page.getByLabel('Le matin').check();
    await continueButton(page).click();

    const recap = page.locator('[data-recap]');
    await expect(recap).toContainText('Camille Martin');
    await expect(recap).toContainText('Atelier Martin');
    await page.getByLabel('J’ai lu et j’accepte les conditions générales de vente.').check();
    await page.getByLabel('J’ai lu comment mes données sont utilisées.').check();
    await page.getByRole('button', { name: 'Envoyer ma demande' }).click();

    const confirmation = page.getByRole('heading', {
      name: /Mode démonstration\s*:\s*aucune donnée n’a été envoyée/,
    });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toBeFocused();
    await expect(page.locator('[data-order-form]')).toBeHidden();

    expect(requests, 'aucune requête après le chargement de la page').toEqual([]);
    expect(page.url()).not.toContain('camille');
    expect(await page.context().cookies()).toEqual([]);
    expect(
      await page.evaluate(() => [window.localStorage.length, window.sessionStorage.length]),
    ).toEqual([0, 0]);

    // Rien n'est parti : le symbole « info », jamais la coche d'une demande reçue.
    const box = page.locator('[data-confirmation]');
    await expect(box).toHaveAttribute('data-status', 'demo');
    await expect(box.locator('.confirmation__icon--demo')).toBeVisible();
    await expect(box.locator('.confirmation__icon--received')).toBeHidden();
    // Une demande reçue par un vrai service (data-status="received") montre la coche.
    await box.evaluate((element) => {
      element.dataset['status'] = 'received';
    });
    await expect(box.locator('.confirmation__icon--received')).toBeVisible();
    await expect(box.locator('.confirmation__icon--demo')).toBeHidden();
  });

  test('Entrée dans un champ de l’étape 2 continue, sans envoyer', async ({ page }) => {
    await page.goto('/commander/');
    await continueButton(page).click();
    await fillContact(page, { pro: false });
    await page.getByLabel('Commune').press('Enter');
    await expect(page.getByRole('heading', { name: /Récapitulatif/ })).toBeFocused();
    await expect(page.locator('[data-confirmation]')).toBeHidden();
  });

  test('axe : aucune violation grave, à chaque étape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/commander/?offre=pro');
    await expectNoSeriousViolations(page, 'étape 1');
    await continueButton(page).click();
    await continueButton(page).click();
    await expect(page.locator('[data-error-summary]')).toBeVisible();
    await expectNoSeriousViolations(page, 'étape 2 avec erreurs');
    await fillContact(page, { pro: true, postalCode: '06000' });
    await continueButton(page).click();
    await expectNoSeriousViolations(page, 'étape 3');
    await page.getByLabel('J’ai lu et j’accepte les conditions générales de vente.').check();
    await page.getByLabel('J’ai lu comment mes données sont utilisées.').check();
    await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
    await expect(page.locator('[data-confirmation]')).toBeVisible();
    await expectNoSeriousViolations(page, 'confirmation');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/commander/');
    await expectNoSeriousViolations(page, 'étape 1 à 1440 px');
  });

  test('à 390 px, les intitulés des étapes commencent à la même hauteur', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/commander/');
    const labels = page.locator('[data-steps] .steps__label');
    await expect(labels).toHaveCount(3);
    const tops = await labels.evaluateAll((all) =>
      all.map((label) => Math.round(label.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size, `hauts des intitulés : ${tops.join(', ')}`).toBe(1);
  });

  test('ne déborde pas de côté à 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/commander/?offre=pro');
    await expectNoHorizontalOverflow(page);
    await continueButton(page).click();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('Page Commander sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('les étapes 1 et 2 restent lisibles, avec une note ; l’étape 3 est masquée', async ({
    page,
  }) => {
    await page.goto('/commander/');
    for (const title of ['Votre box', 'Vos coordonnées']) {
      await expect(page.getByRole('heading', { level: 2, name: new RegExp(title) })).toBeVisible();
    }
    // Récapitulatif, consentements et envoi ne servent à rien sans JavaScript.
    await expect(page.locator('[data-step="3"]')).toBeHidden();
    // La notice « Vos données » reste lisible sous le formulaire.
    await expect(page.getByRole('heading', { level: 2, name: 'Vos données' })).toBeVisible();
    // Le moteur de texte de Playwright ignore <noscript> : on vise l'élément.
    const notice = page.locator('noscript p');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('besoin de JavaScript');
    await expect(notice).toContainText('pas envoyer votre demande');
    await expect(notice).toContainText('écrivez-nous');
    // Les boutons des étapes ne servent à rien sans JavaScript : ils sont masqués,
    // et le bouton d'envoi reste désactivé (rien ne part dans l'adresse de la page).
    const submit = page.locator('[data-submit]');
    await expect(submit).toBeHidden();
    await expect(submit).toBeDisabled();
    await expect(page.locator('[data-order]').getByRole('button')).toHaveCount(0);
  });
});
