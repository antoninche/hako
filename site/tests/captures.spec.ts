/**
 * Captures d'écran de chaque page, en entier, à 390 et 1440 px (plus les
 * largeurs de CAPTURE_WIDTHS), et du menu mobile ouvert à 390 px.
 * Fichiers : qa/screenshots/<page>-<largeur>.png (dossier non versionné).
 * Seules : npm run screenshots ; elles tournent aussi avec npm test.
 */

import { expect, test } from '@playwright/test';

import { MOBILE, notFound, routes } from './routes';
import { header, settle } from './support/page';
import { captureDir, captureWidths } from './support/settings.mjs';

/** Hauteur d'écran plausible pour une largeur donnée. */
function heightFor(width: number): number {
  if (width < 600) return 844;
  if (width < 1000) return 1024;
  return 900;
}

for (const width of captureWidths) {
  test.describe(`Captures ${width} px`, () => {
    test.use({ viewport: { width, height: heightFor(width) } });

    for (const route of [...routes, notFound]) {
      test(`${route.slug}-${width}`, { tag: '@captures' }, async ({ page }) => {
        await page.goto(route.path);
        await settle(page);
        await page.screenshot({
          path: `${captureDir}/${route.slug}-${width}.png`,
          fullPage: true,
          animations: 'disabled',
          caret: 'hide',
        });
      });
    }
  });
}

test.describe('Capture du menu ouvert', () => {
  test.use({ viewport: MOBILE });

  test(`menu-ouvert-${MOBILE.width}`, { tag: '@captures' }, async ({ page }) => {
    await page.goto('/');
    await settle(page);
    const { toggle, panel } = header(page);
    await toggle.click();
    await expect(panel).toBeVisible();
    await page.screenshot({
      path: `${captureDir}/menu-ouvert-${MOBILE.width}.png`,
      animations: 'disabled',
      caret: 'hide',
    });
  });
});
