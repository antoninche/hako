/**
 * FAQ et textes MDX : questions dépliables (clavier, lien direct, sans
 * JavaScript), accessibilité avec toutes les réponses ouvertes, et repères
 * jaunes toujours valides dans le HTML. Page contact : cibles de 44 px pour
 * les liens de contact, dès qu'ils existent.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { backupCopy, payment, proSubscriptionPayment, warranty } from '../src/data/faits';
import { pricing } from '../src/data/tarifs';
import { formatEur } from '../src/lib/format';
import { isTodo } from '../src/lib/todo';
import { DESKTOP, MOBILE } from './routes';
import { settle } from './support/page';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const MDX_PAGES = ['/faq/', '/mentions-legales/', '/confidentialite/', '/cgv/'];

for (const viewport of [MOBILE, DESKTOP]) {
  test(`FAQ, toutes les réponses ouvertes : axe sans violation grave, ${viewport.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/faq/');
    await settle(page);
    const count = await page.locator('details').count();
    expect(count).toBeGreaterThan(0);
    await page.evaluate(() => {
      for (const details of document.querySelectorAll('details')) details.open = true;
    });
    await page.waitForTimeout(600);
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(blocking.map((violation) => `${violation.id} : ${violation.help}`)).toEqual([]);
  });
}

test('une question s’ouvre et se ferme au clavier (Entrée, puis Espace)', async ({ page }) => {
  await page.goto('/faq/');
  const details = page.locator('details').first();
  const summary = details.locator('summary');
  await summary.focus();
  await expect(summary).toBeFocused();
  await expect(details).not.toHaveAttribute('open');
  await page.keyboard.press('Enter');
  await expect(details).toHaveAttribute('open');
  await page.keyboard.press('Space');
  await expect(details).not.toHaveAttribute('open');
});

test('un lien /faq/#question ouvre la question, visible sous l’en-tête', async ({ page }) => {
  await page.goto('/faq/#abonnement');
  const details = page.locator('details#abonnement');
  await expect(details).toHaveAttribute('open');
  const summary = details.locator('summary');
  await expect(summary).toBeInViewport();
  const headerBottom = await page
    .locator('.site-header')
    .evaluate((element) => element.getBoundingClientRect().bottom);
  const summaryTop = await summary.evaluate((element) => element.getBoundingClientRect().top);
  expect(summaryTop).toBeGreaterThanOrEqual(headerBottom);
});

test('changer l’ancre ouvre la question visée', async ({ page }) => {
  await page.goto('/faq/');
  const details = page.locator('details#panne');
  await expect(details).not.toHaveAttribute('open');
  await page.evaluate(() => {
    window.location.hash = 'panne';
  });
  await expect(details).toHaveAttribute('open');
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('une question s’ouvre encore d’un clic', async ({ page }) => {
    await page.goto('/faq/');
    const details = page.locator('details').first();
    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open');
  });
});

for (const path of MDX_PAGES) {
  test(`${path} : aucun repère jaune ne contient de bloc (<p>, liste…)`, async ({ page }) => {
    await page.goto(path);
    expect(await page.locator('mark.todo').count()).toBeGreaterThan(0);
    await expect(page.locator('mark.todo :is(p, div, ul, ol, li, h2, h3)')).toHaveCount(0);
  });
}

test('CGV : « Commande et paiement », un seul paiement avant l’installation', async ({ page }) => {
  await page.goto('/cgv/');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Commande et paiement', exact: true }),
  ).toBeVisible();
  // Les CGV restent à rédiger : la section garde son repère jaune.
  const mark = page.locator('mark.todo', { hasText: '[étapes de la commande, paiement]' });
  await expect(mark).toHaveCount(1);
  await expect(mark).toHaveAttribute(
    'data-todo',
    /paiement en une seule fois, avant l’installation/,
  );
});

test('page contact : liens de contact d’au moins 44 px de haut, une fois renseignés', async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/contact/');
  const links = page.locator('.method__value a, a.founder__link, a.social-links__link');
  for (const link of await links.all()) {
    const box = await link.boundingBox();
    expect(box?.height ?? 0, await link.innerText()).toBeGreaterThanOrEqual(44);
  }
});

test('FAQ : les prix s’écrivent comme sur les pages Offres et Commander', async ({ page }) => {
  await page.goto('/faq/');
  const answer = (await page.locator('details#abonnement').textContent()) ?? '';
  const { home, pro } = pricing.offers;
  // Texte exact, espaces insécables comprises : « 750 € », « 1 000 € ».
  expect(answer).toContain(formatEur(home.priceEur));
  expect(answer).toContain(formatEur(pro.priceEur));
  // « 25 € HT par mois » : le statut de TVA suit le montant, avant « par mois ».
  if (pro.subscription) {
    const monthly = answer.replace(/\s+/gu, ' ');
    expect(monthly).toMatch(
      new RegExp(
        `${formatEur(pro.subscription.monthlyEur).replace(/\s/gu, ' ')} \\S[^,]* par mois`,
      ),
    );
  }
  // L'abonnement de Hako Pro se paie chaque mois, par virement (src/data/faits.ts).
  expect(answer.replace(/\s+/gu, ' ')).toContain(proSubscriptionPayment);
});

test('FAQ : les faits partagés gardent le repère jaune des autres pages', async ({ page }) => {
  await page.goto('/faq/');
  for (const value of [warranty.terms]) {
    if (!isTodo(value)) continue;
    const marks = page.locator(`main mark.todo[data-todo="${value.todo}"]`);
    await expect(marks).toHaveCount(1);
    await expect(marks).toHaveText(value.placeholder);
  }
});

test('FAQ : paiement, garantie et copie de secours, avec les phrases communes au site', async ({
  page,
}) => {
  await page.goto('/faq/');
  const normalize = (text: string | null) => (text ?? '').replace(/\s+/gu, ' ').trim();
  const order = normalize(await page.locator('details#commander').textContent());
  // La règle est dite une seule fois, par la phrase payment.
  expect(order.match(/en une seule fois/gu)).toHaveLength(1);
  expect(order).toContain(normalize(payment));
  const breakdown = normalize(await page.locator('details#panne').textContent());
  expect(breakdown).toContain(normalize(warranty.sentence));
  // La copie de secours : la phrase de src/data/faits.ts, sans date annoncée.
  expect(breakdown).toContain(normalize(backupCopy.sentence.join('')));
});
