/**
 * Pages La box, Notre engagement, Tutoriels et 404 : ce que leurs textes
 * promettent, vérifié dans la page construite.
 *
 * - Une information manquante s'affiche en repère jaune, jamais en lien mort.
 * - Les tutoriels n'intègrent aucune vidéo : de simples liens, une fois les
 *   adresses connues.
 * - Les liens vers d'autres sites gardent leur flèche sur la même ligne que
 *   le texte, même sur un écran étroit.
 * - Les faits partagés (src/data/faits.ts) se lisent avec les mêmes mots et
 *   le même repère jaune sur chaque page qui les cite.
 */

import { expect, test, type Page } from '@playwright/test';

import { company } from '../src/data/entreprise';
import { backupCopy, moverOffers, remoteAccess } from '../src/data/faits';
import { isTodo } from '../src/lib/todo';
import { MOBILE } from './routes';

/** Toutes les espaces (insécables ou non) deviennent une espace simple. */
const normalize = (text: string | null): string => (text ?? '').replace(/\s+/gu, ' ').trim();

/** Texte de la page, sans le pied de page, espaces normalisées. */
async function mainText(page: Page): Promise<string> {
  return normalize(await page.locator('main').textContent());
}

const pages = ['/la-box/', '/engagement/', '/tutoriels/', '/cette-page-n-existe-pas/'] as const;

/** Texte cherché tel quel dans une expression régulière. */
const literal = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const path of pages) {
  test(`${path} : pas de lien sans adresse, chaque repère jaune dit ce qui manque`, async ({
    page,
  }) => {
    await page.goto(path);
    const main = page.locator('main');
    await expect(main.locator('a:not([href]), a[href=""], a[href="#"]')).toHaveCount(0);
    const marks = main.locator('mark.todo');
    for (const mark of await marks.all()) {
      await expect(mark).toHaveAttribute('data-todo', /\S/);
    }
  });
}

test('/tutoriels/ : aucun lecteur intégré, la carte « Bientôt » sans lien', async ({ page }) => {
  await page.goto('/tutoriels/');
  const main = page.locator('main');
  await expect(main.locator('iframe, video, audio, object, embed')).toHaveCount(0);
  await expect(main.locator('article.tutorial')).toHaveCount(4);

  const soon = main.locator('article.tutorial--soon');
  await expect(soon).toHaveCount(1);
  await expect(soon.locator('a')).toHaveCount(0);
  // La copie de secours n'est pas disponible : le tutoriel le dit avec un repère jaune.
  await expect(soon.locator('mark.todo')).toHaveCount(1);
});

test('/tutoriels/ : une adresse de vidéo connue devient un lien nommé', async ({ page }) => {
  await page.goto('/tutoriels/');
  // Chaque vidéo est soit un repère jaune (adresse inconnue), soit un lien
  // dont le nom accessible cite la plateforme et le tutoriel.
  const cards = page.locator('main article.tutorial:not(.tutorial--soon)');
  for (const card of await cards.all()) {
    const title = (await card.locator('h2').innerText()).trim();
    const links = card.locator('a.video');
    const pending = card.locator('.video--todo mark.todo');
    expect((await links.count()) + (await pending.count()), title).toBe(2);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute('href', /^https:\/\//);
      await expect(link).toHaveAccessibleName(new RegExp(`(YouTube|PeerTube).*${literal(title)}`));
    }
  }
});

test.describe('Écran étroit', () => {
  test.use({ viewport: { width: 320, height: MOBILE.height } });

  test('/la-box/ : la flèche des liens ne passe jamais seule à la ligne', async ({ page }) => {
    await page.goto('/la-box/');
    const groups = page.locator('main .text-link__keep');
    expect(await groups.count()).toBeGreaterThan(0);
    for (const group of await groups.all()) {
      const lines = await group.evaluate((element) => element.getClientRects().length);
      expect(lines, await group.innerText()).toBe(1);
    }
  });
});

test('/la-box/ : en mode discret, les repères ne sont plus surlignés', async ({ page }) => {
  await page.goto('/la-box/');
  const marks = page.locator('main mark.todo');
  expect(await marks.count()).toBeGreaterThan(0);
  await page.evaluate(() => {
    document.documentElement.dataset['todos'] = 'discreet';
  });
  for (const mark of await marks.all()) {
    await expect(mark).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }
});

test('/engagement/ : la phrase sur le nom est celle de l’accueil, kanji lu en japonais', async ({
  page,
}) => {
  await page.goto('/engagement/');
  const note = page.locator('.name-note__text');
  expect(normalize(await note.textContent())).toBe(normalize(company.nameMeaning));
  await expect(note.locator('[lang="ja"]')).toHaveText(company.kanji);
});

test.describe('Faits partagés : mêmes mots, même repère jaune', () => {
  const sameMark = async (page: Page, value: unknown) => {
    if (!isTodo(value)) return;
    const marks = page.locator(`main mark.todo[data-todo="${value.todo}"]`);
    expect(await marks.count(), value.todo).toBeGreaterThan(0);
    for (const mark of await marks.all()) {
      expect(normalize(await mark.textContent())).toBe(normalize(value.placeholder));
    }
  };

  for (const path of ['/', '/offres/', '/la-box/', '/engagement/']) {
    test(`${path} : pas d’accès depuis l’extérieur, par choix de sécurité`, async ({ page }) => {
      await page.goto(path);
      const text = await mainText(page);
      expect(text).toContain(normalize(remoteAccess.reason));
      expect(text).toContain(normalize(remoteAccess.consequence));
      expect(text).toContain(normalize(remoteAccess.choice));
    });
  }

  for (const path of ['/offres/', '/la-box/', '/tutoriels/']) {
    test(`${path} : la copie de secours, prévue mais pas encore là`, async ({ page }) => {
      await page.goto(path);
      const sentence = backupCopy.sentence.filter((part) => typeof part === 'string').join('');
      // Le repère jaune coupe la phrase : on cherche le début, puis le repère.
      expect(await mainText(page)).toContain(normalize(sentence.split(':')[0] ?? ''));
      await sameMark(page, backupCopy.status);
    });
  }

  test('/tutoriels/ : le déménageur, avec les offres qui le comprennent', async ({ page }) => {
    await page.goto('/tutoriels/');
    expect(await mainText(page)).toContain(
      `Avec ${normalize(moverOffers.names)}, nous vous aidons`,
    );
  });
});
