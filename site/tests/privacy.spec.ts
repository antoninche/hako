/**
 * La promesse « zéro traceur » : aucune requête ne quitte la machine, sur
 * aucune page, à 390 et 1440 px ; aucun cookie déposé, rien dans le
 * stockage local.
 */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { DESKTOP, MOBILE, notFound, routes } from './routes';
import { isLocalUrl, settle } from './support/page';

/**
 * Adresses que la page déclare sans forcément les demander :
 * - toutes les balises <link> qui déclenchent une connexion ou un
 *   téléchargement (préconnexion, préchargement, icônes, manifeste…) ; une
 *   préconnexion ne fait aucune requête HTTP, l'interception ne la voit donc
 *   pas, alors qu'elle contacte bien l'autre site ;
 * - les icônes citées par le manifeste.
 * Les polices, le manifeste et ses icônes sont aussi demandés pour de bon.
 * (Avec l'interception de Playwright, un fetch de « /favicon.ico » échoue
 * sans requête : d'où ce contrôle des adresses déclarées.)
 */
async function declaredResources(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    await Promise.allSettled([...document.fonts].map((font) => font.load()));
    // Valeurs de rel qui ne déclenchent aucune connexion.
    const navigation = new Set([
      'alternate',
      'author',
      'bookmark',
      'canonical',
      'external',
      'help',
      'license',
      'me',
      'next',
      'prev',
      'search',
      'sitemap',
      'tag',
    ]);
    const declared: string[] = [];
    for (const link of document.querySelectorAll<HTMLLinkElement>('link[href]')) {
      const rels = link.rel.toLowerCase().split(/\s+/).filter(Boolean);
      if (rels.length === 0 || rels.some((rel) => !navigation.has(rel))) declared.push(link.href);
    }
    const links = [
      ...document.querySelectorAll<HTMLLinkElement>(
        'link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"], link[rel="preload"]',
      ),
    ];
    for (const link of links) {
      try {
        const response = await fetch(link.href);
        if (link.rel === 'manifest' && response.ok) {
          const manifest = (await response.json()) as { icons?: { src?: string }[] };
          for (const icon of manifest.icons ?? []) {
            if (!icon.src) continue;
            const url = new URL(icon.src, link.href).href;
            declared.push(url);
            await fetch(url).catch(() => undefined);
          }
        }
      } catch {
        // Une adresse refusée est relevée par l'interception ou par le contrôle des adresses.
      }
    }
    return declared;
  });
}

for (const viewport of [MOBILE, DESKTOP]) {
  test.describe(`Aucune requête hors du site, ${viewport.width} px`, () => {
    test.use({ viewport });

    for (const route of [...routes, notFound]) {
      test(`${route.path}`, async ({ page, context }) => {
        const requested = new Set<string>();
        const outside: string[] = [];
        const cookieHeaders: Promise<string | null>[] = [];

        // Toute requête vers l'extérieur est relevée puis bloquée.
        await context.route('**/*', async (route) => {
          const url = route.request().url();
          requested.add(url);
          if (isLocalUrl(url)) {
            await route.continue();
          } else {
            outside.push(url);
            await route.abort('blockedbyclient');
          }
        });
        page.on('websocket', (socket) => {
          if (!isLocalUrl(socket.url())) outside.push(socket.url());
        });
        page.on('response', (response) => {
          cookieHeaders.push(
            response
              .headerValue('set-cookie')
              .then((value) => (value ? `${response.url()} : ${value}` : null)),
          );
        });

        await page.goto(route.path);
        await settle(page);
        for (const url of await declaredResources(page)) {
          requested.add(url);
          if (!isLocalUrl(url)) outside.push(url);
        }
        await page.waitForLoadState('networkidle');

        test.info().annotations.push({
          type: 'requêtes',
          description: [...requested].sort().join('\n'),
        });
        // Vérifications « souples » : tous les problèmes sont listés en une fois.
        const external = [...new Set(outside)];
        expect.soft(external, `requêtes vers l'extérieur :\n${external.join('\n')}`).toEqual([]);
        const cookies = (await Promise.all(cookieHeaders)).filter((value) => value !== null);
        expect.soft(cookies, 'en-têtes Set-Cookie').toEqual([]);
        expect.soft(await context.cookies(), 'cookies du navigateur').toEqual([]);
        expect.soft(await page.evaluate(() => localStorage.length), 'stockage local').toBe(0);
      });
    }
  });
}
