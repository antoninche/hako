/**
 * Pages La box, Notre engagement, Tutoriels, Contact et 404, et réseaux
 * sociaux du pied de page : ce que leurs textes promettent, vérifié dans la
 * page construite.
 *
 * - Une information manquante s'affiche en repère jaune, jamais en lien mort.
 * - Les tutoriels n'intègrent aucune vidéo : de simples liens, une fois les
 *   adresses connues ; avant, la carte dit « Bientôt », sans ligne de lien.
 * - Les réseaux sociaux sans adresse : nom sans lien et un seul repère jaune.
 * - Les liens vers d'autres sites gardent leur flèche sur la même ligne que
 *   le texte, même sur un écran étroit.
 * - Les faits partagés (src/data/faits.ts) se lisent avec les mêmes mots et
 *   le même repère jaune sur chaque page qui les cite.
 */

import { expect, test, type Page } from '@playwright/test';

import { tutoriels } from '../src/content/tutoriels';
import { company } from '../src/data/entreprise';
import { backupCopy, moverOffers, remoteAccess } from '../src/data/faits';
import { isTodo, type Maybe } from '../src/lib/todo';
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

test('/tutoriels/ : aucun lecteur intégré, aucune ligne « [lien à venir] »', async ({ page }) => {
  await page.goto('/tutoriels/');
  const main = page.locator('main');
  await expect(main.locator('iframe, video, audio, object, embed')).toHaveCount(0);
  await expect(main.locator('article.tutorial')).toHaveCount(tutoriels.items.length);
  // Une adresse de vidéo inconnue n'affiche rien dans sa fiche : elle reste listée
  // dans TODO.md. (Les chaînes, plus bas, gardent leur repère « [lien à venir] ».)
  await expect(main.locator('article.tutorial').getByText('[lien à venir]')).toHaveCount(0);

  // La copie de secours n'est pas disponible : le tutoriel annoncé le dit avec un repère jaune.
  for (const item of tutoriels.items.filter((tutorial) => 'soon' in tutorial && tutorial.soon)) {
    await expect(main.locator(`article#${item.slug} mark.todo`)).toHaveCount(1);
  }
});

test('/tutoriels/ : « Bientôt » sans vidéo en ligne, sinon un lien nommé par vidéo', async ({
  page,
}) => {
  await page.goto('/tutoriels/');
  for (const item of tutoriels.items) {
    const card = page.locator(`main article#${item.slug}`);
    const videos: Readonly<Record<string, Maybe<string>>> = 'videos' in item ? item.videos : {};
    const urls = Object.values(videos).filter((url): url is string => !isTodo(url));
    const badge = card.locator('.tutorial__badge');
    if (urls.length === 0 || ('soon' in item && item.soon)) {
      // Pas encore de vidéo : l'étiquette « Bientôt », et aucun lien.
      await expect(card, item.title).toHaveClass(/\btutorial--soon\b/);
      await expect(badge, item.title).toContainText(tutoriels.labels.soon);
      await expect(card.locator('a'), item.title).toHaveCount(0);
    } else {
      // Un lien par adresse connue, nommé avec la plateforme et le tutoriel.
      await expect(badge, item.title).toHaveCount(0);
      const links = card.locator('a.video');
      expect(
        await links.evaluateAll((all) => all.map((link) => link.getAttribute('href'))),
      ).toEqual(urls);
      for (const link of await links.all()) {
        await expect(link).toHaveAccessibleName(
          new RegExp(`(YouTube|PeerTube).*${literal(item.title)}`),
        );
      }
    }
  }
});

test('pied de page : réseaux sans adresse affichés sans lien, avec un seul repère jaune', async ({
  page,
}) => {
  await page.goto('/');
  const footer = page.locator('footer.site-footer');
  const known = company.social.flatMap((network) => (isTodo(network.url) ? [] : [network.url]));
  await expect(footer.locator('.social-links li')).toHaveCount(company.social.length);
  for (const network of company.social) {
    await expect(footer.locator('.social-links')).toContainText(network.name);
  }
  expect(
    await footer
      .locator('.social-links a')
      .evaluateAll((all) => all.map((a) => a.getAttribute('href'))),
  ).toEqual(known);
  // Aucun repère par réseau : un seul, après la liste, tant qu'une adresse manque.
  await expect(footer.locator('.social-links mark.todo')).toHaveCount(0);
  const marker = footer.locator(
    'mark.todo[data-todo="Adresses des pages et chaînes de HAKO sur les réseaux sociaux"]',
  );
  await expect(marker).toHaveCount(known.length < company.social.length ? 1 : 0);
});

test('/contact/ : les réseaux sociaux ne sont listés qu’une fois, dans le pied de page', async ({
  page,
}) => {
  await page.goto('/contact/');
  await expect(page.locator('.social-links')).toHaveCount(1);
  await expect(page.locator('main .social-links')).toHaveCount(0);
  // « Tutoriels vidéo » garde son texte et son lien vers les tutoriels.
  await expect(page.locator('main a[href="/tutoriels/"]').first()).toBeVisible();
});

test('/engagement/ à 390 px : « Pour aller plus loin », liens l’un sous l’autre, même largeur', async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/engagement/');
  const boxes = await page.locator('.next__links a').evaluateAll((links) =>
    links.map((link) => {
      const box = link.getBoundingClientRect();
      return { x: Math.round(box.x), width: Math.round(box.width) };
    }),
  );
  expect(boxes.length).toBeGreaterThan(1);
  expect(new Set(boxes.map((box) => box.x)).size, 'même bord gauche').toBe(1);
  expect(new Set(boxes.map((box) => box.width)).size, 'même largeur').toBe(1);
});

test('page 404 à 1440 px : quatre chemins en deux colonnes égales', async ({ page }) => {
  await page.goto('/cette-page-n-existe-pas/');
  const boxes = await page.locator('.not-found__links a').evaluateAll((links) =>
    links.map((link) => {
      const box = link.getBoundingClientRect();
      return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width) };
    }),
  );
  expect(boxes).toHaveLength(4);
  expect(new Set(boxes.map((box) => box.x)).size, 'deux colonnes').toBe(2);
  expect(new Set(boxes.map((box) => box.y)).size, 'deux rangées').toBe(2);
  expect(new Set(boxes.map((box) => box.width)).size, 'même largeur').toBe(1);
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
