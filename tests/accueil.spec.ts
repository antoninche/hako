/**
 * Accueil : ce qui est propre à cette page.
 *
 * - Les prix affichés sont ceux de src/data/tarifs.ts, mis en forme par
 *   src/lib/format.ts, et aucun prix n'est écrit en dur dans les textes de la
 *   page (src/content/accueil.ts).
 * - Chaque tarif encore manquant (null dans tarifs.ts) apparaît en repère jaune,
 *   avec le texte commun à tout le site (missingPrice, src/data/faits.ts) ;
 *   dès qu'il est renseigné, le repère disparaît.
 * - Le déménageur et la phrase sur le nom viennent de src/data/faits.ts et
 *   de src/data/entreprise.ts, comme sur les autres pages.
 * - L'ouverture montre la box du prototype (image de synthèse), seule image
 *   chargée en priorité.
 * - Les boutons de commande choisissent l'offre (?offre=home ou ?offre=pro).
 * - Le fait d'actualité garde sa source : un seul lien, vers l'article en anglais.
 * - Une seule h1, aucune accolade visible, la zone d'intervention dite une fois.
 */

import { expect, test } from '@playwright/test';

import { offers, problem } from '../src/content/accueil';
import { company } from '../src/data/entreprise';
import { missingPrice, moverOffers } from '../src/data/faits';
import { pricing } from '../src/data/tarifs';
import { formatEur } from '../src/lib/format';
import type { TodoValue } from '../src/lib/todo';
import { readRepoFile } from './support/node-tools.mjs';

/** Toutes les espaces (insécables ou non) deviennent une espace simple. */
function normalize(text: string | null): string {
  return (text ?? '').replace(/[\s\u00a0\u202f]+/g, ' ').trim();
}

const { home, pro } = pricing.offers;

/** Tarifs affichés sur l'accueil, avec le repère attendu tant qu'ils valent null. */
const displayedPrices: readonly { readonly gap: TodoValue; readonly value: unknown }[] = [
  { gap: missingPrice.taxStatus(home), value: home.taxStatus },
  { gap: missingPrice.securityUpdates(home), value: home.securityUpdates },
  { gap: missingPrice.afterSalesRate(home), value: home.afterSalesRateEur },
  { gap: missingPrice.taxStatus(pro), value: pro.taxStatus },
  { gap: missingPrice.subscriptionTax(pro), value: pro.subscription?.taxStatus },
  { gap: missingPrice.commitment(pro), value: pro.subscription?.commitment },
  { gap: missingPrice.responseTime(pro), value: pro.subscription?.responseTime },
  { gap: missingPrice.deposit, value: pricing.depositPercent },
];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('une seule h1, l’accroche', async ({ page }) => {
  const headings = page.locator('h1');
  await expect(headings).toHaveCount(1);
  expect(normalize(await headings.textContent())).toBe(normalize(company.headline));
});

test('les prix des offres viennent de tarifs.ts', async ({ page }) => {
  for (const id of ['home', 'pro'] as const) {
    const card = page.locator('main article', { has: page.locator(`#offre-${id}`) });
    await expect(card).toHaveCount(1);
    // Texte exact, espaces insécables comprises : « 1 000 € », comme sur toutes les pages.
    const amount = await card.locator('.offer__amount').textContent();
    expect(amount?.trim()).toBe(formatEur(pricing.offers[id].priceEur));
  }

  const subscription = pricing.offers.pro.subscription;
  expect(subscription, 'Hako Pro a un abonnement dans tarifs.ts').toBeDefined();
  if (subscription) {
    const proCard = page.locator('main article', { has: page.locator('#offre-pro') });
    const monthly = await proCard.locator('.offer__monthly').textContent();
    expect(monthly).toContain(formatEur(subscription.monthlyEur));
    // « 25 € HT par mois » : le statut de TVA vient avant « par mois ».
    expect(normalize(monthly)).toMatch(/€ \S.* par mois$/);
  }
});

test('aucun prix écrit en dur dans les textes de l’accueil', () => {
  const source = readRepoFile('src/content/accueil.ts');
  expect(source).not.toMatch(/\d[\d\s\u00a0\u202f]*€|€\s*\d/);
});

test('chaque tarif manquant est un repère jaune', async ({ page }) => {
  const marks = await page.locator('main mark.todo').evaluateAll((elements) =>
    elements.map((element) => ({
      what: element.getAttribute('data-todo') ?? '',
      text: element.textContent ?? '',
    })),
  );
  for (const { gap, value } of displayedPrices) {
    const { todo: what, placeholder } = gap;
    const found = marks.filter((mark) => mark.what === what);
    if (value === null || value === undefined) {
      expect(found.length, `repère attendu : ${what}`).toBeGreaterThan(0);
      for (const mark of found) expect(normalize(mark.text)).toBe(normalize(placeholder));
    } else {
      expect(found, `plus de repère une fois renseigné : ${what}`).toHaveLength(0);
    }
  }
});

test('les boutons de commande choisissent l’offre', async ({ page }) => {
  for (const id of ['home', 'pro'] as const) {
    const card = page.locator('main article', { has: page.locator(`#offre-${id}`) });
    const link = card.locator(`a[href="/commander/?offre=${id}"]`);
    await expect(link).toHaveCount(1);
    await expect(link).toHaveText(offers[id].cta);
    // Le déménageur figure sur la carte des offres qui le comprennent (src/data/faits.ts).
    await expect(card.locator('.offer__feature', { hasText: 'déménageur' })).toHaveCount(
      moverOffers.includes(id) ? 1 : 0,
    );
  }
});

test('le déménageur et la phrase sur le nom viennent des fichiers de données', async ({ page }) => {
  // « Compris dans Hako Home et Hako Pro » : les offres viennent de src/data/faits.ts.
  await expect(page.locator('.mover__included')).toHaveText(`Compris dans ${moverOffers.names}`, {
    useInnerText: true,
  });
  // Sous l'image de l'ouverture : « image de synthèse », puis la phrase sur le
  // nom, la même que sur la page Notre engagement.
  const caption = normalize(await page.locator('.hero-visual figcaption').textContent());
  expect(caption).toContain('image de synthèse');
  expect(caption.endsWith(normalize(company.nameMeaning))).toBe(true);
  await expect(page.locator('.hero-visual figcaption [lang="ja"]')).toHaveText(company.kanji);
});

test('l’image de l’ouverture est la box du prototype, chargée en premier', async ({ page }) => {
  const image = page.locator('.hero-visual img');
  await expect(image).toHaveCount(1);
  await expect(image).toHaveAttribute('fetchpriority', 'high');
  await expect(image).not.toHaveAttribute('loading', 'lazy');
  await expect(image).toHaveAttribute('alt', /kanji/);
  await expect(page.locator('.hero-visual source[type="image/avif"]')).toHaveCount(1);
  // Seule image demandée en priorité dans la page.
  await expect(page.locator('main img[fetchpriority="high"]')).toHaveCount(1);
  // Elle est bien arrivée (largeur réelle non nulle).
  expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test('le fait d’actualité garde sa source, en anglais', async ({ page }) => {
  const sources = page.locator('main a[href^="https://apnews.com/"]');
  await expect(sources).toHaveCount(1);
  await expect(sources).toHaveAttribute('href', problem.example.source.href);
  await expect(sources).toHaveAttribute('hreflang', 'en');
  await expect(sources).toHaveAttribute('rel', /\bnoreferrer\b/);
});

test('aucune accolade visible, la zone d’intervention dite une fois', async ({ page }) => {
  const text = normalize(await page.locator('main').textContent());
  expect(text).not.toMatch(/[{}]/);
  expect(text.split(normalize(company.serviceArea.sentence))).toHaveLength(2);
});
