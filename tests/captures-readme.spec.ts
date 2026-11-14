/**
 * Captures d'écran du README, à 1440 px de large, dans images/ (versionnées).
 * Seules : npm run screenshots:readme, qui construit le site comme en ligne
 * (sans surlignage des informations manquantes) dans .tmp/dist-readme/.
 * Exclues des autres lancements de Playwright (grepInvert, playwright.config.ts).
 */

import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { assistant } from '../src/content/assistant';
import { EXAMPLE_PASSWORDS } from '../src/data/assistant';
import { DESKTOP } from './routes';
import { settle } from './support/page';
import { repoRoot } from './support/settings.mjs';

const imagesDir = path.resolve(repoRoot, 'images');
const { demo, screens } = assistant;

test.use({ viewport: { ...DESKTOP }, colorScheme: 'light', reducedMotion: 'reduce' });

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `${imagesDir}/${name}.png`,
    animations: 'disabled',
    caret: 'hide',
  });
}

/** Fait défiler la page pour que l'élément arrive sous l'en-tête. */
async function scrollBelowHeader(page: Page, selector: string): Promise<void> {
  await page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const header = document.querySelector('header');
      const offset = (header?.getBoundingClientRect().height ?? 0) + 24;
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'instant' });
    });
}

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test.describe('Captures du README', () => {
  test('accueil', { tag: '@readme' }, async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await capture(page, 'accueil');
  });

  test('offres', { tag: '@readme' }, async ({ page }) => {
    await page.goto('/offres/');
    await settle(page);
    await scrollBelowHeader(page, '[aria-label="Les deux offres"]');
    await capture(page, 'offres');
  });

  test('guide d’installation', { tag: '@readme' }, async ({ page }) => {
    await page.goto('/installer/#etape-page');
    await settle(page);
    await expect(page.locator('#etape-page-titre')).toBeVisible();
    await scrollBelowHeader(page, '#etape-page');
    await capture(page, 'guide-installation');
  });

  test('démonstration : trois écrans', { tag: '@readme' }, async ({ page }) => {
    await page.goto('/installer/demonstration/');
    await expect(page.locator('[data-assistant]')).toHaveAttribute('data-ready', 'true');
    await settle(page);

    await scrollBelowHeader(page, '[data-demo-banner]');
    await capture(page, 'demonstration-bienvenue');

    await button(page, screens.welcome.start).click();
    await page.getByRole('textbox', { name: screens.people.owner.label }).fill('Hélène');
    for (const [index, name] of ['Marc', 'Camille'].entries()) {
      await button(page, screens.people.add).click();
      await page
        .getByRole('textbox', { name: screens.people.member.label.replace('{n}', `${index + 2}`) })
        .fill(name);
    }
    await button(page, screens.people.next).click();
    await expect(page.locator('#ecran-mots-de-passe-titre')).toBeFocused();
    await scrollBelowHeader(page, '#ecran-mots-de-passe-titre');
    await capture(page, 'demonstration-mots-de-passe');

    await button(page, screens.passwords.next).click();
    await button(page, screens.sheet.next).click();
    await page.locator('[data-check-input]').fill(EXAMPLE_PASSWORDS[0]);
    await button(page, screens.check.submit).click();
    await button(page, screens.check.create).click();
    await expect(page.locator('#ecran-pret-titre')).toBeFocused({ timeout: 10_000 });
    await expect(page.locator('[data-demo-banner]')).toContainText(demo.banner.text);
    await scrollBelowHeader(page, '#ecran-pret .ready-apps');
    await capture(page, 'demonstration-pret');
  });
});
