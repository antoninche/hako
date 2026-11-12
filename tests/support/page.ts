/**
 * Outils partagés par les tests dans le navigateur.
 */

import type { Locator, Page } from '@playwright/test';

/** Erreurs de la console et requêtes en échec d'une page. */
export interface PageTracker {
  readonly consoleErrors: string[];
  readonly failedRequests: string[];
}

/** Commence à relever les erreurs de la page (à appeler avant page.goto). */
export function trackPage(page: Page): PageTracker {
  const tracker: PageTracker = { consoleErrors: [], failedRequests: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') {
      tracker.consoleErrors.push(`${message.text()} [${message.location().url}]`);
    }
  });
  page.on('pageerror', (error) => tracker.consoleErrors.push(`exception : ${error.message}`));
  page.on('requestfailed', (request) => {
    tracker.failedRequests.push(`${request.url()} : ${request.failure()?.errorText ?? 'échec'}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      tracker.failedRequests.push(`${response.url()} : HTTP ${response.status()}`);
    }
  });
  return tracker;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Vrai si l'adresse ne quitte pas la machine (le site local, data:, blob:, about:). */
export function isLocalUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (['data:', 'blob:', 'about:'].includes(parsed.protocol)) return true;
  return LOCAL_HOSTS.has(parsed.hostname);
}

/**
 * Attend que la page soit stable : polices chargées, page parcourue jusqu'en
 * bas (pour déclencher les chargements différés), puis plus aucune requête.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await page.evaluate(async () => {
    await document.fonts.ready;
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForLoadState('networkidle');
}

/**
 * Attend la fin des transitions et animations CSS d'un élément et de ses
 * enfants (par exemple le panneau du menu qui apparaît en fondu) : sinon,
 * les couleurs mesurées seraient celles d'un état intermédiaire.
 */
export async function waitForAnimations(target: Locator): Promise<void> {
  await target.evaluate(async (element) => {
    await Promise.allSettled(
      element.getAnimations({ subtree: true }).map((animation) => animation.finished),
    );
  });
}

/** Éléments de l'en-tête sur lesquels portent les tests. */
export function header(page: Page): {
  toggle: Locator;
  fallback: Locator;
  panel: Locator;
  barCta: Locator;
  panelCta: Locator;
  mainNav: Locator;
} {
  const site = page.locator('header.site-header');
  return {
    toggle: site.locator('button.menu-toggle'),
    fallback: site.locator('a.menu-fallback'),
    panel: page.locator('#menu-mobile'),
    barCta: site.locator('[data-cta="commander"]:not(#menu-mobile *)'),
    panelCta: page.locator('#menu-mobile [data-cta="commander"]'),
    mainNav: page.locator('nav[aria-label="Navigation principale"]'),
  };
}
