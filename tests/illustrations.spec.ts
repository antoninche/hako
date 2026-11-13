/**
 * Illustrations : chaque page construite montre ses dessins.
 *
 * Quand un fichier de src/assets/illustrations/ manque, le composant
 * Illustration affiche un cadre vide aux mêmes proportions (classe
 * illustration--attente). Aucune page publiée ne doit en garder un.
 */

import { expect, test } from '@playwright/test';

import { notFound, routes } from './routes';

/** Classe du cadre affiché à la place d'un dessin absent. */
const PLACEHOLDER = 'illustration--attente';

const pages = [...routes, notFound];

test.describe('Illustrations', () => {
  test('aucune page construite ne garde un cadre d’attente', async ({ request }) => {
    for (const route of pages) {
      const html = await (await request.get(route.path)).text();
      expect(html, `${route.path} : HTML de la page`).toContain('</html>');
      expect(html, `${route.path} : cadre d’attente à la place d’un dessin`).not.toContain(
        PLACEHOLDER,
      );
    }
  });

  for (const route of pages) {
    test(`${route.path} : chaque dessin est un SVG nommé ou masqué`, async ({ page }) => {
      await page.goto(route.path);
      const frames = await page.locator('.illustration').evaluateAll((elements) =>
        elements.map((element) => {
          const svg = element.querySelector(':scope > svg');
          return {
            placeholder: element.classList.contains('illustration--attente'),
            svgCount: element.querySelectorAll(':scope > svg').length,
            viewBox: svg?.getAttribute('viewBox') ?? '',
            shapes: svg?.querySelectorAll('path, rect, circle, ellipse, polygon, use').length ?? 0,
            role: svg?.getAttribute('role') ?? '',
            label: svg?.getAttribute('aria-label')?.trim() ?? '',
            hidden: svg?.getAttribute('aria-hidden') === 'true',
            // Le dessin est inséré sans son titre ni sa description : les lecteurs
            // d'écran entendent le texte de la page.
            ownText: svg?.querySelectorAll('title, desc').length ?? 0,
            ids: [...(svg?.querySelectorAll('[id]') ?? [])].map((node) => node.id),
          };
        }),
      );

      for (const [index, frame] of frames.entries()) {
        const where = `${route.path}, dessin n° ${index + 1}`;
        expect(frame.placeholder, `${where} : cadre d’attente`).toBe(false);
        expect(frame.svgCount, `${where} : un seul SVG`).toBe(1);
        expect(frame.viewBox, `${where} : viewBox`).toMatch(/^0 0 \d+ \d+$/);
        expect(frame.shapes, `${where} : formes dessinées`).toBeGreaterThan(0);
        expect(frame.ownText, `${where} : <title> ou <desc> restés dans le dessin`).toBe(0);
        if (frame.hidden) {
          expect(frame.role, `${where} : dessin décoratif sans rôle`).toBe('');
        } else {
          expect(frame.role, `${where} : rôle image`).toBe('img');
          expect(frame.label.length, `${where} : texte de remplacement`).toBeGreaterThan(10);
        }
      }

      // Identifiants préfixés par le nom du fichier : uniques dans la page.
      const ids = frames.flatMap((frame) => frame.ids);
      const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
      expect(repeated, `${route.path} : identifiants répétés`).toEqual([]);
    });
  }
});
