/**
 * Informations manquantes : surlignées en jaune par défaut, discrètes quand
 * <html data-todos="discreet"> (PUBLIC_SHOW_TODOS=false).
 */

import { expect, test } from '@playwright/test';

test('surlignage jaune, puis mode discret', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-todos', 'visible');

  const mark = page.locator('mark.todo').first();
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute('data-todo', /\S/);
  // --todo (#ffe066) en fond, --chocolat (#412d1e) pour le texte.
  await expect(mark).toHaveCSS('background-color', 'rgb(255, 224, 102)');
  await expect(mark).toHaveCSS('color', 'rgb(65, 45, 30)');

  await page.evaluate(() => {
    document.documentElement.dataset['todos'] = 'discreet';
  });
  await expect(mark).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const parentColor = await mark.evaluate((element) =>
    element.parentElement ? getComputedStyle(element.parentElement).color : '',
  );
  await expect(mark).toHaveCSS('color', parentColor);
});
