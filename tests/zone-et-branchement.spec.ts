/**
 * Hors de notre zone, et branchement de la HAKO : les décisions de l'équipe
 * (13 novembre 2026), vérifiées dans les pages construites.
 *
 * - Hors de la zone, l'envoi de la HAKO et son installation par le client ne
 *   sont pas encore ouverts : les pages le disent au futur, avec la phrase de
 *   company.serviceArea.outside (src/data/entreprise.ts), et aucune n'annonce
 *   de frais d'envoi.
 * - La HAKO se branche à la box internet par un câble réseau, qui n'est pas
 *   fourni ; le Wi-Fi est aussi possible : aucune page ne dit le contraire.
 */

import { expect, test, type Page } from '@playwright/test';

import { tutoriels } from '../src/content/tutoriels';
import { company } from '../src/data/entreprise';
import { routes as siteRoutes } from '../src/data/navigation';
import { isTodo } from '../src/lib/todo';
import { routes } from './routes';

/** Toutes les espaces (insécables ou non) deviennent une espace simple. */
const normalize = (text: string | null): string => (text ?? '').replace(/\s+/gu, ' ').trim();

/** Tout le texte de la page : en-tête, réponses repliées et parties masquées comprises. */
async function pageText(page: Page): Promise<string> {
  return normalize(await page.locator('body').textContent());
}

const outside = company.serviceArea.outside;
const outsideText = isTodo(outside) ? outside.placeholder : outside;

/** Ce que plus aucune page ne doit dire : l'envoi au présent, ses frais, le Wi-Fi impossible. */
const outdated: readonly RegExp[] = [
  /frais d[’']envoi/iu,
  /nous (?:vous )?(?:l[’'])?envoyons/iu,
  /vous l[’']installez/iu,
  /avez reçu votre HAKO/iu,
  /\b(?:ne|n[’'])(?: se)? (?:relie|peut|pouvez)\b[^.?!]*\bWi-Fi/iu,
];

test.describe('Hors de notre zone : l’envoi, pour bientôt', () => {
  test('la phrase de src/data/entreprise.ts est au futur', () => {
    expect(outsideText).toMatch(/^bientôt, nous vous enverrons la box/u);
  });

  for (const path of ['/', '/offres/', '/engagement/', '/faq/', '/contact/', '/commander/']) {
    test(`${path} : la page reprend cette phrase`, async ({ page }) => {
      await page.goto(path);
      expect(await pageText(page)).toContain(normalize(outsideText));
    });
  }

  test('/tutoriels/ : le lien vers le guide d’installation, pour bientôt', async ({ page }) => {
    await page.goto('/tutoriels/');
    const line = page.locator('.install-guide');
    await expect(line).toContainText(tutoriels.intro.guide.text);
    await expect(line).toContainText('Bientôt');
    await expect(
      line.getByRole('link', { name: tutoriels.intro.guide.link.label }),
    ).toHaveAttribute('href', siteRoutes.install);
  });

  test('aucune page n’annonce l’envoi au présent, des frais d’envoi ni un Wi-Fi impossible', async ({
    page,
  }) => {
    for (const route of routes) {
      await page.goto(route.path);
      const text = await pageText(page);
      for (const pattern of outdated) {
        expect(text, `${route.path} : ${String(pattern)}`).not.toMatch(pattern);
      }
    }
  });
});

test.describe('Branchement : un câble réseau, non fourni, et le Wi-Fi aussi possible', () => {
  test('/la-box/', async ({ page }) => {
    await page.goto('/la-box/');
    const text = normalize(await page.locator('main').textContent());
    expect(text).toContain('par un câble réseau (Ethernet). Le Wi-Fi reste possible');
    expect(text).toContain('Le câble réseau ne l’est pas');
  });

  test('FAQ « Comment brancher ma HAKO chez moi ? »', async ({ page }) => {
    await page.goto('/faq/');
    const answer = normalize(await page.locator('details#branchement').textContent());
    expect(answer).toContain('Un câble réseau (Ethernet) relie votre HAKO à votre box internet');
    expect(answer).toContain('le Wi-Fi est aussi possible');
    expect(answer).toContain('il n’est pas fourni');
    expect(answer).toContain('bientôt, nous vous enverrons votre HAKO');
  });
});
