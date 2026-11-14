/**
 * Accessibilité automatique (axe) : aucune violation grave ou critique des
 * WCAG 2.2 niveau AA, sur chaque page, à 390 et 1440 px, et menu mobile ouvert.
 * Les violations mineures ou modérées sont jointes au rapport sans faire échouer.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { DESKTOP, MOBILE, notFound, routes } from './routes';
import { header, settle, waitForAnimations } from './support/page';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type Violation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];

function describe(violations: Violation[]): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .slice(0, 5)
        .map((node) => `    ${node.target.join(' ')}`)
        .join('\n');
      return `${violation.impact ?? '?'} · ${violation.id} : ${violation.help}\n${targets}\n    ${violation.helpUrl}`;
    })
    .join('\n');
}

async function audit(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  const others = results.violations.filter((violation) => !blocking.includes(violation));
  if (others.length > 0) {
    test.info().annotations.push({ type: 'axe (mineur ou modéré)', description: describe(others) });
  }
  expect(blocking, `violations graves ou critiques :\n${describe(blocking)}`).toEqual([]);
}

for (const viewport of [MOBILE, DESKTOP]) {
  test.describe(`Accessibilité (axe), ${viewport.width} px`, () => {
    test.use({ viewport });

    for (const route of [...routes, notFound]) {
      test(`${route.path}`, async ({ page }) => {
        await page.goto(route.path);
        await settle(page);
        await audit(page);
      });
    }
  });
}

test.describe('Accessibilité (axe), menu mobile ouvert', () => {
  test.use({ viewport: MOBILE });

  for (const route of [routes[0], routes[1]]) {
    if (!route) continue;
    test(`${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      await settle(page);
      const { toggle, panel } = header(page);
      await toggle.click();
      await expect(panel).toBeVisible();
      await waitForAnimations(panel);
      await audit(page);
    });
  }
});
