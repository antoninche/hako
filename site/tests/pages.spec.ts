/**
 * Chaque page répond, sans erreur dans la console ni requête en échec ;
 * une adresse inconnue reçoit la page 404.
 */

import { expect, test } from '@playwright/test';

import { notFound, routes } from './routes';
import { settle, trackPage } from './support/page';

test.describe('Pages', () => {
  for (const route of routes) {
    test(`${route.path} répond 200, sans erreur ni requête en échec`, async ({ page }) => {
      const tracker = trackPage(page);
      const response = await page.goto(route.path);
      expect(response?.status(), 'statut HTTP de la page').toBe(200);
      await settle(page);
      expect(tracker.consoleErrors, 'erreurs dans la console').toEqual([]);
      expect(tracker.failedRequests, 'requêtes en échec').toEqual([]);
    });
  }

  test('une adresse inconnue affiche la page 404', async ({ page }) => {
    // Titre de référence : celui de la page 404 construite.
    await page.goto('/404.html');
    const expectedTitle = (await page.locator('main#contenu h1').first().textContent())?.trim();
    expect(expectedTitle, 'la page 404 a un titre <h1>').toBeTruthy();

    const tracker = trackPage(page);
    const response = await page.goto(notFound.path);
    expect(response?.status(), 'statut HTTP').toBe(404);
    await settle(page);
    await expect(page.locator('main#contenu h1').first()).toHaveText(expectedTitle ?? '');
    await expect(page.locator('header.site-header')).toBeVisible();
    await expect(page.locator('main#contenu a[href="/"]').first()).toBeVisible();

    // La réponse 404 du document lui-même est normale : seules les autres erreurs comptent.
    const documentUrl = response?.url() ?? '';
    const otherErrors = tracker.consoleErrors.filter(
      (error) => !(error.includes('404') && error.includes(documentUrl)),
    );
    const otherFailures = tracker.failedRequests.filter(
      (failure) => !failure.startsWith(`${documentUrl} :`),
    );
    expect(otherErrors, 'erreurs dans la console').toEqual([]);
    expect(otherFailures, 'requêtes en échec').toEqual([]);
  });

  test('les fichiers déclarés dans <head> et dans le manifeste existent', async ({ page }) => {
    await page.goto('/');
    const declared = await page
      .locator('head link[href]:not([rel="canonical"]):not([rel="alternate"])')
      .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    if (manifestHref) {
      const manifestUrl = new URL(manifestHref, page.url()).href;
      const manifest = (await (await page.request.get(manifestUrl)).json()) as {
        icons?: { src?: string }[];
      };
      for (const icon of manifest.icons ?? []) {
        if (icon.src) declared.push(new URL(icon.src, manifestUrl).href);
      }
    }
    const missing: string[] = [];
    for (const url of declared) {
      const response = await page.request.get(url);
      if (response.status() !== 200) missing.push(`${url} : HTTP ${response.status()}`);
    }
    expect(declared.length, 'fichiers déclarés').toBeGreaterThan(0);
    expect(missing, 'fichiers introuvables').toEqual([]);
  });

  test('chaque lien interne mène à une page ou un fichier qui existe', async ({ page }) => {
    // Pages, licences (crédits des mentions légales) et ancres (#contenu…).
    const targets = new Map<string, string>();
    const missingAnchors: string[] = [];
    for (const route of [...routes, notFound]) {
      await page.goto(route.path);
      const found = await page.locator('a[href]').evaluateAll((links) =>
        links.map((link) => {
          const url = new URL((link as HTMLAnchorElement).href);
          const samePage = url.origin === location.origin && url.pathname === location.pathname;
          const anchor = samePage && url.hash ? decodeURIComponent(url.hash.slice(1)) : '';
          return {
            href: url.href,
            // Lien vers la page elle-même (#contenu…) : seule son ancre compte.
            otherPage: url.origin === location.origin && !samePage,
            anchorMissing: anchor !== '' && document.getElementById(anchor) === null,
          };
        }),
      );
      for (const link of found) {
        if (link.anchorMissing) missingAnchors.push(`${route.path} : ${link.href}`);
        if (!link.otherPage) continue;
        const url = new URL(link.href);
        url.hash = '';
        if (!targets.has(url.href)) targets.set(url.href, route.path);
      }
    }
    const broken: string[] = [];
    for (const [url, from] of targets) {
      const response = await page.request.get(url);
      if (response.status() !== 200)
        broken.push(`${url} (lien de ${from}) : HTTP ${response.status()}`);
    }
    expect(targets.size, 'liens internes relevés').toBeGreaterThan(10);
    expect(broken, 'liens internes cassés').toEqual([]);
    expect(missingAnchors, 'ancres sans cible').toEqual([]);
  });

  test('chaque information manquante porte sa description (data-todo)', async ({ page }) => {
    const problems: string[] = [];
    for (const route of routes) {
      await page.goto(route.path);
      const missing = await page
        .locator('mark.todo')
        .evaluateAll((marks) =>
          marks
            .filter((mark) => !mark.getAttribute('data-todo')?.trim())
            .map((mark) => mark.outerHTML),
        );
      for (const html of missing) problems.push(`${route.path} : ${html}`);
    }
    expect(problems, '<mark class="todo"> sans data-todo').toEqual([]);
  });
});
