/**
 * Navigation au clavier et à l'écran tactile : lien d'évitement, menu
 * mobile (panneau dépliant, pas une fenêtre modale), menu principal.
 */

import { expect, test } from '@playwright/test';

import { DESKTOP, MOBILE, WIDE_SCREEN, mainNav, orderPath, routes } from './routes';
import { header } from './support/page';

test.describe("Lien d'évitement", () => {
  for (const viewport of [MOBILE, DESKTOP]) {
    test(`premier élément du clavier, il mène au contenu (${viewport.width} px)`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.keyboard.press('Tab');
      const skip = page.locator('a.skip-link');
      await expect(skip).toBeFocused();
      await expect(skip).toHaveAttribute('href', '#contenu');
      await expect(skip).toHaveText('Aller au contenu');
      await expect(skip).toBeInViewport();
      await page.keyboard.press('Enter');
      await expect(page.locator('main#contenu')).toBeFocused();
      await expect(page).toHaveURL(/#contenu$/);
    });
  }
});

test.describe('Menu mobile', () => {
  test.use({ viewport: MOBILE });

  test('fermé au départ : panneau caché, bouton prêt', async ({ page }) => {
    await page.goto('/');
    const { toggle, fallback, panel } = header(page);
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAttribute('aria-controls', 'menu-mobile');
    await expect(toggle).toHaveAccessibleName(/Menu/);
    await expect(panel).toBeHidden();
    await expect(panel).toHaveAttribute('hidden', '');
    // Le script a remplacé le lien de secours par le bouton.
    await expect(fallback).toBeHidden();
  });

  test('ouvert : aria-expanded, liens du menu et « Commander »', async ({ page }) => {
    await page.goto('/');
    const { toggle, panel, barCta, panelCta } = header(page);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    for (const link of mainNav) {
      const item = panel.getByRole('link', { name: link.label, exact: true });
      await expect(item).toBeVisible();
      await expect(item).toHaveAttribute('href', link.path);
    }
    await expect(panelCta).toBeVisible();
    await expect(panelCta).toHaveAttribute('href', orderPath);
    await expect(barCta).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();
  });

  test('Échap ferme le panneau et rend le focus au bouton', async ({ page }) => {
    await page.goto('/');
    const { toggle, panel } = header(page);
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(panel).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(panel.getByRole('link').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test('un clic sur un lien du panneau le ferme', async ({ page }) => {
    await page.goto('/');
    const { toggle, panel } = header(page);
    await toggle.click();
    await expect(panel).toBeVisible();
    // On empêche la navigation pour observer l'état du menu sur la même page.
    await page.evaluate(() => {
      window.addEventListener(
        'click',
        (event) => {
          if (event.target instanceof Element && event.target.closest('#menu-mobile a')) {
            event.preventDefault();
          }
        },
        { capture: true },
      );
    });
    await panel.getByRole('link', { name: mainNav[0].label, exact: true }).click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();
  });

  test('passer en écran large ferme le panneau', async ({ page }) => {
    await page.goto('/');
    const { toggle, panel } = header(page);
    await toggle.click();
    await expect(panel).toBeVisible();
    await page.setViewportSize({ width: WIDE_SCREEN + 76, height: 800 });
    await expect(toggle).toBeHidden();
    await expect(panel).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('cibles tactiles de 44 × 44 px au moins', async ({ page }) => {
    await page.goto('/');
    const { toggle, panel, barCta } = header(page);
    await toggle.click();
    await expect(panel).toBeVisible();
    const targets = [
      page.locator('header.site-header a[href="/"]').first(),
      toggle,
      barCta,
      ...(await panel.getByRole('link').all()),
    ];
    const tooSmall: string[] = [];
    for (const target of targets) {
      const box = await target.boundingBox();
      const name = (await target.textContent())?.trim() || (await target.getAttribute('href'));
      if (!box || box.width < 44 || box.height < 44) {
        tooSmall.push(
          `${name} : ${box ? `${Math.round(box.width)} × ${Math.round(box.height)}` : 'invisible'}`,
        );
      }
    }
    expect(tooSmall, 'cibles trop petites').toEqual([]);
  });
});

test.describe('Cibles tactiles de 44 × 44 px : en-tête et pied de page', () => {
  // Tous les liens et boutons visibles, menu principal d'écran large et plan du
  // site compris (« FAQ » est le plus court). Seuls les liens écrits dans une
  // phrase (display: inline) sont exclus, comme le prévoient les WCAG (2.5.8).
  for (const width of [320, MOBILE.width, 768, WIDE_SCREEN, DESKTOP.width]) {
    test(`${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const tooSmall = await page.evaluate(() => {
        const found: string[] = [];
        const targets = document.querySelectorAll<HTMLElement>(
          'header.site-header :is(a[href], button), footer.site-footer :is(a[href], button)',
        );
        for (const target of targets) {
          // Non affiché (panneau fermé, menu d'écran large sur téléphone…) : non concerné.
          if (!target.checkVisibility()) continue;
          if (getComputedStyle(target).display === 'inline') continue;
          const box = target.getBoundingClientRect();
          if (box.width < 44 || box.height < 44) {
            const name = target.textContent?.trim() || target.getAttribute('href');
            found.push(`${name} : ${Math.round(box.width)} × ${Math.round(box.height)}`);
          }
        }
        return found;
      });
      expect(tooSmall, 'cibles trop petites').toEqual([]);
    });
  }
});

test.describe('Menu mobile sans JavaScript', () => {
  test.use({ viewport: MOBILE, javaScriptEnabled: false });

  test('un lien « Menu » mène au plan du site', async ({ page }) => {
    await page.goto('/');
    const { toggle, fallback } = header(page);
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute('href', '#plan-du-site');
    await expect(toggle).toBeHidden();
    await expect(page.locator('nav#plan-du-site')).toHaveCount(1);
  });
});

test.describe('« Commander » toujours visible dans la barre', () => {
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    test(`${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      const { barCta } = header(page);
      await expect(barCta).toBeVisible();
      await expect(barCta).toHaveAttribute('href', orderPath);
      await expect(barCta).toBeInViewport({ ratio: 1 });
    });
  }
});

test.describe('Écran large', () => {
  for (const width of [WIDE_SCREEN, DESKTOP.width]) {
    test(`pas de bouton « Menu » à ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      const { toggle, fallback, mainNav: nav } = header(page);
      await expect(toggle).toBeHidden();
      await expect(fallback).toBeHidden();
      await expect(nav).toBeVisible();
    });
  }
});

test.describe('Menu principal : page en cours (aria-current)', () => {
  test.use({ viewport: DESKTOP });

  for (const link of mainNav) {
    test(`${link.label}`, async ({ page }) => {
      await page.goto(link.path);
      const current = header(page).mainNav.locator('[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveAttribute('href', link.path);
      await expect(current).toHaveText(link.label);
    });
  }

  test("accueil : aucun lien n'est marqué", async ({ page }) => {
    await page.goto('/');
    await expect(header(page).mainNav.locator('[aria-current]')).toHaveCount(0);
  });
});

test.describe('Affichage à 320 px (zoom à 400 %)', () => {
  test.use({ viewport: { width: 320, height: 700 } });

  for (const route of routes) {
    test(`${route.path} : pas de défilement horizontal`, async ({ page }) => {
      await page.goto(route.path);
      const { scrollWidth, clientWidth, culprits } = await page.evaluate(() => {
        const root = document.documentElement;
        // Pour le message d'erreur : les premiers éléments qui dépassent à droite.
        const culprits = [...document.querySelectorAll('body *')]
          .filter((element) => element.getBoundingClientRect().right > root.clientWidth + 1)
          .slice(0, 8)
          .map((element) => `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}`);
        return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, culprits };
      });
      expect(
        scrollWidth,
        `la page déborde ; éléments en cause : ${culprits.join(', ')}`,
      ).toBeLessThanOrEqual(clientWidth);
    });
  }
});
