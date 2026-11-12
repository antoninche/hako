/**
 * Mouvement réduit (prefers-reduced-motion) : le menu s'ouvre sans animation.
 */

import { expect, test } from '@playwright/test';

import { MOBILE } from './routes';
import { header } from './support/page';

/** Durées CSS (« 0.28s, 1e-05s ») converties en secondes. */
function toSeconds(list: string): number[] {
  return list
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) =>
      value.endsWith('ms') ? Number.parseFloat(value) / 1000 : Number.parseFloat(value),
    );
}

test.describe('Mouvement réduit', () => {
  test.use({ viewport: MOBILE, reducedMotion: 'reduce' });

  test("le panneau du menu s'ouvre sans transition", async ({ page }) => {
    await page.goto('/');
    const { toggle, panel } = header(page);
    await toggle.click();
    await expect(panel).toBeVisible();
    const durations = await panel.evaluate((element) => {
      const style = getComputedStyle(element);
      return { transition: style.transitionDuration, animation: style.animationDuration };
    });
    const seconds = [...toSeconds(durations.transition), ...toSeconds(durations.animation)];
    expect(seconds.length, 'durées lues').toBeGreaterThan(0);
    expect(
      Math.max(...seconds),
      `durées : transition ${durations.transition}, animation ${durations.animation}`,
    ).toBeLessThanOrEqual(0.01);
  });
});
