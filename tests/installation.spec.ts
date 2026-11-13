/**
 * Guide d'installation (/installer/) : ce que le guide promet, vérifié dans
 * la page construite.
 *
 * - Sans JavaScript, tout le guide se lit de haut en bas.
 * - Avec JavaScript : une étape à la fois ; « C'est fait », « Étape
 *   précédente » et le sommaire ; l'étape est dans l'adresse (#etape-…), lue
 *   à l'ouverture et suivie par le bouton « Retour » du navigateur ; le titre
 *   de l'étape reçoit le focus ; choix de l'appareil ; chronomètre ;
 *   impression ; fin du guide.
 * - La progression dit la place dans le guide (« Étape 3 sur 8 ») ; seule une
 *   étape validée par « C'est fait » est dite faite. Sur téléphone, la liste
 *   des étapes est repliée.
 * - À l'étape 6, ce qu'il faut savoir avant d'ouvrir la page de la HAKO est
 *   écrit avant le bouton ; l'étape 7 reprend le même bouton après ses gestes.
 * - « Avant de commencer » se lit sur place : aucun de ses liens ne fait
 *   changer d'étape.
 * - Le guide est dans le menu de l'en-tête et sur l'accueil.
 * - Le lien vers la HAKO et les liens vers les boutiques sont exactement ceux
 *   de src/data/installation.ts ; rien n'est écrit dans le stockage du
 *   navigateur, aucune requête ne part pendant le parcours.
 *
 * - Tout le parcours respecte la politique de sécurité de production
 *   (scripts/serve-prod.mjs), pas seulement le chargement de la page.
 *
 * Les tests généraux (tests/routes.ts) couvrent aussi cette page : axe à 390
 * et 1440 px, CSP au chargement, aucune requête au chargement, 320 px,
 * captures.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { startProdServer } from '../scripts/serve-prod.mjs';
import { hero } from '../src/content/accueil';
import { installation, type DeviceId, type StepId } from '../src/content/installation';
import { apps, boxAddress } from '../src/data/installation';
import { mainNav, routes } from '../src/data/navigation';
import { DESKTOP, MOBILE } from './routes';
import { pathExists } from './support/node-tools.mjs';
import { builtDir } from './support/settings.mjs';

const PATH = '/installer/';
const { labels, steps, finish } = installation;
const total = steps.length;

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Guide d'installation : ${what} introuvable.`);
  return value;
}

type GuideStep = (typeof steps)[number];

/** Une étape du contenu, avec son type exact (chronomètre, appareils…). */
function stepById<Id extends StepId>(id: Id): Extract<GuideStep, { id: Id }> {
  return must(
    steps.find((step): step is Extract<GuideStep, { id: Id }> => step.id === id),
    `l’étape « ${id} »`,
  );
}

/** Texte cherché tel quel dans une expression régulière. */
const literal = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const { chronometer } = stepById('preparation');
const { devices, open } = stepById('page');
const deviceIds: readonly DeviceId[] = devices.options.map((option) => option.id);

/**
 * Libellé de progression, comme le calcule la page : la place dans le guide
 * (« Étape 3 sur 8 » pour l'étape de rang 2), puis « Fin du guide ».
 */
const progressName = (index: number): string =>
  index >= total
    ? labels.progressEnd
    : labels.stepOf.replace('{n}', String(index + 1)).replace('{total}', String(total));

const section = (page: Page, id: StepId): Locator => page.locator(`section#etape-${id}`);
const title = (page: Page, id: StepId): Locator => page.locator(`#etape-${id}-titre`);
const visibleSteps = (page: Page): Locator => page.locator('section[data-step]:visible');
const toc = (page: Page): Locator => page.getByRole('navigation', { name: labels.stepsList });
const progress = (page: Page, index: number): Locator =>
  page.getByRole('progressbar', { name: progressName(index) });

/** Ouvre le guide et attend que son script ait démarré. */
async function openGuide(page: Page, hash = '', base = ''): Promise<void> {
  await page.goto(`${base}${PATH}${hash}`);
  await expect(page.locator('[data-guide]')).toHaveAttribute('data-ready', 'true');
}

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoSeriousViolations(page: Page, context: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const serious = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.id} : ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`,
    );
  expect(serious, `violations axe graves ou critiques (${context})`).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page, context: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `la page ne doit pas défiler de côté (${context})`).toBeLessThanOrEqual(0);
}

test.describe('Guide d’installation sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('tout le guide se lit de haut en bas, aides comprises', async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(installation.intro.title);
    await expect(
      page.getByRole('heading', { level: 2, name: installation.before.title }),
    ).toBeVisible();

    // Chaque étape sous un h2 numéroté, dans l'ordre.
    const headings = page.locator('section[data-step] h2');
    await expect(headings).toHaveCount(total);
    for (const [index, step] of steps.entries()) {
      const heading = headings.nth(index);
      await expect(heading).toBeVisible();
      await expect(heading).toHaveText(
        new RegExp(`^Étape ${index + 1} sur ${total}\\s+${literal(step.title)}$`),
      );
    }
    await expect(page.locator('#hako-installee')).toBeVisible();

    // Les consignes de chaque appareil, l'une après l'autre.
    for (const id of deviceIds) await expect(page.locator(`[data-device="${id}"]`)).toBeVisible();

    // Les aides se déplient sans script.
    const problems = steps.reduce((count, step) => count + step.problems.length, 0);
    await expect(page.locator('section[data-step] details')).toHaveCount(problems);
    const vpn = page.locator('#etape-page-vpn');
    await vpn.locator('summary').click();
    await expect(vpn).toHaveAttribute('open', '');
    await expect(vpn.locator('.faq-item__answer')).toBeVisible();

    // Ce qui ne marche qu'avec JavaScript reste caché ; une note le dit.
    await expect(page.locator('[data-js-only]:visible')).toHaveCount(0);
    await expect(page.getByRole('button', { name: labels.next })).toHaveCount(0);
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    // Le moteur de texte de Playwright ignore <noscript> : on vise l'élément.
    await expect(page.locator('noscript p').first()).toBeVisible();

    // Le sommaire mène à chaque étape par une ancre.
    for (const step of steps) {
      await expect(toc(page).locator(`a[href="#etape-${step.id}"]`)).toHaveCount(1);
    }
    await expect(section(page, 'page').getByRole('link', { name: open.label })).toHaveAttribute(
      'href',
      boxAddress.url,
    );
  });
});

test.describe('Guide d’installation, une étape à la fois', () => {
  test('au départ : la première étape seule, sans déplacer le focus', async ({ page }) => {
    await openGuide(page);
    await expect(visibleSteps(page)).toHaveCount(1);
    await expect(section(page, 'carton')).toBeVisible();
    for (const step of steps.slice(1)) {
      // Cachées jusqu'à ce que la recherche du navigateur les trouve.
      await expect(section(page, step.id)).toHaveAttribute('hidden', 'until-found');
    }
    await expect(page.locator('#hako-installee')).toBeHidden();
    await expect(progress(page, 0)).toBeVisible();
    await expect(progress(page, 0)).toHaveJSProperty('value', 0);
    await expect(toc(page).locator('[aria-current="step"]')).toHaveAttribute(
      'href',
      '#etape-carton',
    );
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    expect(page.url()).not.toContain('#');
  });

  test('« C’est fait » puis « Étape précédente » : adresse, focus, progression', async ({
    page,
  }) => {
    await openGuide(page);
    await section(page, 'carton').getByRole('button', { name: labels.next }).click();

    await expect(page).toHaveURL(/\/installer\/#etape-place$/);
    await expect(visibleSteps(page)).toHaveCount(1);
    await expect(section(page, 'place')).toBeVisible();
    await expect(title(page, 'place')).toBeFocused();
    await expect(title(page, 'place')).toBeInViewport();
    await expect(progress(page, 1)).toBeVisible();
    await expect(toc(page).locator('a[href="#etape-carton"]')).toHaveAccessibleName(
      new RegExp(`${literal(stepById('carton').short)}\\s*${literal(labels.stepDone)}`),
    );

    // Le titre ne reste pas caché sous l'en-tête collant.
    const header = must(
      (await page.locator('header.site-header').boundingBox()) ?? undefined,
      'l’en-tête',
    );
    await expect
      .poll(async () => (await title(page, 'place').boundingBox())?.y ?? -1)
      .toBeGreaterThanOrEqual(header.y + header.height - 1);

    await section(page, 'place').getByRole('button', { name: labels.previous }).click();
    await expect(page).toHaveURL(/#etape-carton$/);
    await expect(section(page, 'carton')).toBeVisible();
    await expect(section(page, 'place')).toBeHidden();
    await expect(title(page, 'carton')).toBeFocused();
    await expect(progress(page, 0)).toBeVisible();
  });

  test('sommaire et renvois entre étapes : on reste sur la page', async ({ page }) => {
    await openGuide(page);
    await toc(page)
      .getByRole('link', { name: /La page de la HAKO/ })
      .click();
    await expect(page).toHaveURL(/#etape-page$/);
    await expect(visibleSteps(page)).toHaveCount(1);
    await expect(title(page, 'page')).toBeFocused();
    await expect(progress(page, 5)).toBeVisible();
    await expect(toc(page).locator('[aria-current="step"]')).toHaveAttribute('href', '#etape-page');

    // Un renvoi écrit dans le texte d'une aide (« voyez l'étape … »).
    const problem = page.locator('#etape-page-branchements');
    await problem.locator('summary').click();
    await problem
      .getByRole('link', { name: new RegExp(literal(stepById('alimentation').title)) })
      .click();
    await expect(page).toHaveURL(/#etape-alimentation$/);
    await expect(section(page, 'alimentation')).toBeVisible();
    await expect(title(page, 'alimentation')).toBeFocused();
  });

  test('ancre à l’ouverture, puis boutons « Retour » et « Suivant » du navigateur', async ({
    page,
  }) => {
    await openGuide(page, '#etape-preparation');
    await expect(visibleSteps(page)).toHaveCount(1);
    await expect(section(page, 'preparation')).toBeVisible();
    await expect(title(page, 'preparation')).toBeInViewport();
    await expect(progress(page, 4)).toBeVisible();

    await section(page, 'preparation').getByRole('button', { name: labels.next }).click();
    await expect(page).toHaveURL(/#etape-page$/);

    await page.goBack();
    await expect(page).toHaveURL(/#etape-preparation$/);
    await expect(section(page, 'preparation')).toBeVisible();
    await expect(section(page, 'page')).toBeHidden();
    await expect(title(page, 'preparation')).toBeFocused();

    await page.goForward();
    await expect(page).toHaveURL(/#etape-page$/);
    await expect(section(page, 'page')).toBeVisible();
    await expect(title(page, 'page')).toBeFocused();
  });

  test('une ancre vers une aide ouvre son étape et la déplie', async ({ page }) => {
    await openGuide(page, '#etape-page-vpn');
    await expect(section(page, 'page')).toBeVisible();
    await expect(page.locator('#etape-page-vpn')).toHaveAttribute('open', '');
    await expect(page.locator('#etape-page-vpn')).toBeInViewport();
  });

  test('recherche dans la page : l’étape trouvée s’affiche', async ({ page }) => {
    await openGuide(page);
    // Ce que fait le navigateur quand Ctrl+F trouve un texte d'une étape cachée.
    await section(page, 'cable').evaluate((element) => {
      element.dispatchEvent(new Event('beforematch'));
      element.removeAttribute('hidden');
    });
    await expect(page).toHaveURL(/#etape-cable$/);
    await expect(visibleSteps(page)).toHaveCount(1);
    await expect(section(page, 'cable')).toBeVisible();
    await expect(progress(page, 2)).toBeVisible();
  });

  test('fin du guide : « Votre HAKO est installée », puis retour au début', async ({ page }) => {
    await openGuide(page, '#etape-applications');
    await section(page, 'applications').getByRole('button', { name: labels.finish }).click();

    await expect(page).toHaveURL(/#hako-installee$/);
    const heading = page.getByRole('heading', { level: 2, name: finish.title });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(visibleSteps(page)).toHaveCount(0);
    await expect(progress(page, total)).toBeVisible();
    await expect(toc(page).locator('[aria-current]')).toHaveCount(0);

    await page.getByRole('button', { name: labels.restart }).click();
    await expect(page).toHaveURL(/#etape-carton$/);
    await expect(title(page, 'carton')).toBeFocused();
    await expect(page.locator('#hako-installee')).toBeHidden();
  });

  test('« Afficher tout le guide », puis « Revenir à une étape à la fois »', async ({ page }) => {
    await openGuide(page, '#etape-cable');
    await page.getByRole('button', { name: labels.showAll }).click();
    await expect(visibleSteps(page)).toHaveCount(total);
    await expect(page.locator('#hako-installee')).toBeVisible();
    // Le bouton est sous le guide : on reste sur l'étape en cours, son titre a le focus.
    await expect(title(page, 'cable')).toBeFocused();
    await expect(title(page, 'cable')).toBeInViewport();
    await expect(page.getByRole('button', { name: labels.showOne })).toBeVisible();
    await expect(progress(page, 2)).toBeVisible();

    await page.getByRole('button', { name: labels.showOne }).click();
    await expect(visibleSteps(page)).toHaveCount(1);
    await expect(section(page, 'cable')).toBeVisible();
    await expect(title(page, 'cable')).toBeFocused();
    await expect(page.getByRole('button', { name: labels.showAll })).toBeVisible();
  });

  test('défilement doux, sauf si l’appareil demande moins d’animations', async ({ browser }) => {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      const context = await browser.newContext({ reducedMotion });
      const page = await context.newPage();
      await page.addInitScript(() => {
        const calls: unknown[] = [];
        Object.defineProperty(window, '__defilements', { value: calls });
        const original = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = function (this: Element, options?: unknown) {
          calls.push(options);
          original.call(this, options as ScrollIntoViewOptions);
        };
      });
      await openGuide(page);
      await section(page, 'carton').getByRole('button', { name: labels.next }).click();
      await expect(title(page, 'place')).toBeFocused();
      const calls = await page.evaluate(
        () => (window as unknown as { __defilements: { behavior?: string }[] }).__defilements,
      );
      expect(calls.at(-1)?.behavior, reducedMotion).toBe(
        reducedMotion === 'reduce' ? 'auto' : 'smooth',
      );
      await context.close();
    }
  });
});

test.describe('Étape « Ouvrez la page de votre HAKO »', () => {
  test('choix de l’appareil : ses consignes, et les aides qui le concernent', async ({ page }) => {
    await openGuide(page, '#etape-page');
    const step = section(page, 'page');
    const choice = step.getByRole('group', { name: devices.question });
    await expect(choice.getByRole('radio')).toHaveCount(deviceIds.length);
    // Aucun appareil choisi : toutes les consignes.
    for (const id of deviceIds) await expect(step.locator(`[data-device="${id}"]`)).toBeVisible();

    await choice.getByRole('radio', { name: 'Android' }).check();
    await expect(step.locator('[data-device="android"]')).toBeVisible();
    await expect(step.locator('[data-device="iphone"]')).toBeHidden();
    await expect(step.locator('[data-device="ordinateur"]')).toBeHidden();
    await expect(page.locator('#etape-page-android-ancien')).toBeVisible();
    await expect(page.locator('#etape-page-iphone-autre-navigateur')).toBeHidden();
    await expect(page.locator('#etape-page-mac-reseau-local')).toBeHidden();
    // Un cas qui concerne tous les appareils reste.
    await expect(page.locator('#etape-page-vpn')).toBeVisible();

    await choice.getByRole('radio', { name: 'Ordinateur' }).check();
    await expect(step.locator('[data-device="ordinateur"]')).toBeVisible();
    await expect(step.locator('[data-device="android"]')).toBeHidden();
    await expect(page.locator('#etape-page-mac-reseau-local')).toBeVisible();
    await expect(page.locator('#etape-page-donnees-mobiles')).toBeHidden();

    await expectNoSeriousViolations(page, 'appareil choisi');
  });

  test('le lien vers la HAKO : adresse exacte, même onglet, « Retour » ramène ici', async ({
    page,
  }) => {
    await openGuide(page, '#etape-page');
    const link = section(page, 'page').getByRole('link', { name: open.label });
    await expect(link).toHaveAttribute('href', 'http://hako.local/');
    expect(await link.getAttribute('target'), 'même onglet').toBeNull();

    // L'adresse écrite en grand, sur une seule ligne, pour la recopier.
    const address = page.locator('.open__address-text');
    await expect(address).toHaveText(boxAddress.display);
    expect(await address.evaluate((element) => element.getClientRects().length)).toBe(1);
    await expect(address).toHaveCSS('white-space', 'nowrap');

    // Page de la HAKO simulée : aucune requête ne quitte la machine.
    await page.route(/^https?:\/\/hako\.local\//, (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><title>HAKO</title><p>Page de la HAKO</p>',
      }),
    );
    // Au retour, c'est le guide qui remet la page sur l'étape, pas le navigateur.
    expect(await page.evaluate(() => window.history.scrollRestoration)).toBe('manual');
    await link.click();
    await expect(page).toHaveURL('http://hako.local/');
    await page.goBack();
    await expect(page).toHaveURL(/\/installer\/#etape-page$/);
    await expect(page.locator('[data-guide]')).toHaveAttribute('data-ready', 'true');
    await expect(visibleSteps(page)).toHaveCount(1);
    await expect(section(page, 'page')).toBeVisible();
  });
});

test.describe('Chronomètre', () => {
  test('temps écoulé depuis le clic, lu en minutes, remise à zéro', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-13T10:00:00+01:00') });
    await openGuide(page, '#etape-preparation');
    const timer = page.getByRole('timer', { name: chronometer.label });
    const shown = timer.locator('[data-chrono-visual]');
    const spoken = timer.locator('[data-chrono-spoken]');
    const status = page.locator('[data-chrono-status]');
    // Au repos : « 0 min 00 s » en pâle, et « Pas encore lancé » sur une ligne d'état.
    await expect(shown).toHaveText('0 min 00 s');
    await expect(spoken).toHaveText(chronometer.idle);
    await expect(status).toHaveText(chronometer.idle);

    await page.getByRole('button', { name: chronometer.start }).click();
    const reset = page.getByRole('button', { name: chronometer.reset });
    await expect(reset).toBeFocused();
    await expect(status).toBeHidden();
    await expect(page.getByRole('button', { name: chronometer.start })).toBeHidden();
    await expect(shown).toHaveText('0 min 00 s');
    await expect(spoken).toHaveText(chronometer.spoken.zero);

    await page.clock.runFor(65_000);
    await expect(shown).toHaveText('1 min 05 s');
    await expect(spoken).toHaveText(chronometer.spoken.one);

    await page.clock.runFor(120_000);
    await expect(shown).toHaveText('3 min 05 s');
    await expect(spoken).toHaveText(chronometer.spoken.many.replace('{n}', '3'));

    await reset.click();
    await expect(shown).toHaveText('0 min 00 s');
    await page.clock.runFor(30_000);
    await expect(shown).toHaveText('0 min 30 s');
    await expect(spoken).toHaveText(chronometer.spoken.zero);
  });
});

test.describe('Impression', () => {
  test('« Imprimer ce guide » : toutes les étapes, aides ouvertes, sans l’interface', async ({
    page,
  }) => {
    await openGuide(page, '#etape-page');
    await section(page, 'page').getByRole('radio', { name: 'Android' }).check();

    // window.print remplacé : il prévient la page comme le ferait le navigateur.
    await page.evaluate(() => {
      const record = { calls: 0 };
      Object.defineProperty(window, '__impressions', { value: record });
      window.print = () => {
        record.calls += 1;
        window.dispatchEvent(new Event('beforeprint'));
      };
    });
    await page.getByRole('button', { name: labels.print }).click();
    expect(
      await page.evaluate(
        () => (window as unknown as { __impressions: { calls: number } }).__impressions.calls,
      ),
    ).toBe(1);

    await page.emulateMedia({ media: 'print' });
    for (const step of steps) await expect(title(page, step.id)).toBeVisible();
    await expect(page.locator('main details:not([open])')).toHaveCount(0);
    await expect(page.locator('#etape-carton-abimee .faq-item__answer')).toBeVisible();
    // Dépliées au beforeprint, les réponses ne restent pas figées à opacity 0
    // par l'animation d'ouverture : elles s'impriment lisibles.
    await expect(page.locator('#etape-carton-abimee .faq-item__answer')).toHaveCSS('opacity', '1');
    await expect(page.locator('#lexique .faq-item__answer')).toHaveCSS('opacity', '1');
    // Toutes les consignes et toutes les aides, quel que soit l'appareil choisi.
    for (const id of deviceIds) await expect(page.locator(`[data-device="${id}"]`)).toBeVisible();
    await expect(page.locator('#etape-page-iphone-autre-navigateur')).toBeVisible();
    // Ni en-tête, ni pied de page, ni sommaire, ni boutons du guide.
    await expect(page.locator('header.site-header')).toBeHidden();
    await expect(page.locator('footer.site-footer')).toBeHidden();
    await expect(toc(page)).toBeHidden();
    await expect(page.locator('[data-guide] button:visible')).toHaveCount(0);
    await expect(page.locator('.step__figure:visible')).toHaveCount(0);
    // L'adresse de la HAKO reste écrite.
    await expect(page.locator('.open__address-text')).toBeVisible();

    // Après l'impression, les aides se referment (la liste des étapes, elle,
    // reste dépliée sur grand écran).
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('main details[open]:not([data-toc-fold])')).toHaveCount(0);
    await expect(visibleSteps(page)).toHaveCount(1);
  });

  test('sans le bouton : la feuille d’impression montre aussi toutes les étapes', async ({
    page,
  }) => {
    await openGuide(page);
    await page.emulateMedia({ media: 'print' });
    for (const step of steps) await expect(title(page, step.id)).toBeVisible();
    await expect(page.locator('#etape-cable-pas-de-cable .faq-item__answer')).toBeVisible();
  });
});

test.describe('Liens et vie privée', () => {
  test('liens vers d’autres sites : exactement les boutiques et la HAKO', async ({ page }) => {
    await page.goto(PATH);
    const external = await page
      .locator('main a[href^="http"]')
      .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href') ?? ''))]);
    const expected = [
      apps.immich.appStore,
      apps.immich.googlePlay,
      apps.nextcloud.appStore,
      apps.nextcloud.googlePlay,
      boxAddress.url,
      boxAddress.secondUrl,
    ];
    expect(external.sort()).toEqual([...expected].sort());
    for (const url of [apps.immich.appStore, apps.nextcloud.appStore]) {
      expect(url).toMatch(/^https:\/\/apps\.apple\.com\/fr\/app\//);
    }
    for (const url of [apps.immich.googlePlay, apps.nextcloud.googlePlay]) {
      expect(url).toMatch(/^https:\/\/play\.google\.com\/store\/apps\/details\?id=/);
    }
    // Aucun lien vers la HAKO ne s'ouvre dans un autre onglet.
    await expect(
      page.locator('a[href*="hako.local"][target], a[href*="hako-2.local"][target]'),
    ).toHaveCount(0);
  });

  test('parcours complet : aucun stockage, aucun cookie, aucune requête', async ({
    page,
    context,
  }) => {
    await page.addInitScript(() => {
      const writes: string[] = [];
      Object.defineProperty(window, '__ecritures', { value: writes });
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
        writes.push(`setItem ${key}`);
        setItem.call(this, key, value);
      };
      const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
      Object.defineProperty(Document.prototype, 'cookie', {
        configurable: true,
        get(this: Document) {
          return cookie?.get?.call(this) as string;
        },
        set(this: Document, value: string) {
          writes.push(`cookie ${value}`);
          cookie?.set?.call(this, value);
        },
      });
      const open = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function (this: IDBFactory, name: string, version?: number) {
        writes.push(`indexedDB ${name}`);
        return open.call(this, name, version);
      };
    });
    await openGuide(page);
    await page.waitForLoadState('networkidle');
    // Toutes les polices sont chargées d'avance : la suite ne peut rien demander.
    await page.evaluate(async () => {
      await Promise.all([...document.fonts].map((font) => font.load().catch(() => undefined)));
      await document.fonts.ready;
    });
    const requests: string[] = [];
    page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));

    for (const step of steps.slice(0, 4)) {
      await section(page, step.id).getByRole('button', { name: labels.next }).click();
    }
    await page.getByRole('button', { name: chronometer.start }).click();
    await section(page, 'preparation').getByRole('button', { name: labels.next }).click();
    await toc(page)
      .getByRole('link', { name: /La page de la HAKO/ })
      .click();
    await section(page, 'page').getByRole('radio', { name: 'iPhone ou iPad' }).check();
    await page.locator('#etape-page-vpn summary').click();
    await page.goBack();
    await page.goForward();
    await page.getByRole('button', { name: labels.showAll }).click();
    await page.getByRole('button', { name: labels.showOne }).click();
    await section(page, 'page').getByRole('button', { name: labels.next }).click();
    await section(page, 'installation').getByRole('button', { name: labels.next }).click();
    await section(page, 'applications').getByRole('button', { name: labels.finish }).click();
    await expect(page.getByRole('heading', { level: 2, name: finish.title })).toBeFocused();

    expect(
      await page.evaluate(() => (window as unknown as { __ecritures: string[] }).__ecritures),
    ).toEqual([]);
    expect(
      await page.evaluate(() => [window.localStorage.length, window.sessionStorage.length]),
    ).toEqual([0, 0]);
    expect(await context.cookies()).toEqual([]);
    expect(requests, 'aucune requête pendant le parcours').toEqual([]);
  });
});

test.describe('Petits écrans', () => {
  test.use({ viewport: { width: 320, height: MOBILE.height } });

  test('320 px : aucune étape ne déborde, cibles de 44 px', async ({ page }) => {
    await openGuide(page);
    await page.getByRole('button', { name: labels.showAll }).click();
    await expect(visibleSteps(page)).toHaveCount(total);
    await expectNoHorizontalOverflow(page, 'toutes les étapes');

    const tooSmall = await page.evaluate(() => {
      const found: string[] = [];
      const targets = document.querySelectorAll<HTMLElement>(
        '[data-guide] :is(button, .toc__link, .device-option, .open__button), [data-guide] a.text-link',
      );
      for (const target of targets) {
        if (!target.checkVisibility()) continue;
        const box = target.getBoundingClientRect();
        if (box.width < 44 || box.height < 44) {
          found.push(
            `${target.textContent?.trim() ?? ''} : ${Math.round(box.width)} × ${Math.round(box.height)}`,
          );
        }
      }
      return found;
    });
    expect(tooSmall, 'cibles trop petites').toEqual([]);
  });

  test('390 px : axe à la fin du guide et en mode « toutes les étapes »', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await openGuide(page, '#hako-installee');
    await expectNoSeriousViolations(page, 'fin du guide');
    await page.getByRole('button', { name: labels.showAll }).click();
    await expectNoSeriousViolations(page, 'toutes les étapes');
  });
});

test.describe('Politique de sécurité de production', () => {
  test('tout le parcours, sans aucune violation ni erreur', async ({ page }) => {
    test.skip(
      !pathExists(`${builtDir}/installer/index.html`),
      `site non construit dans ${builtDir}`,
    );
    const server = await startProdServer({ root: builtDir });
    try {
      await page.addInitScript(() => {
        const store: string[] = [];
        Object.defineProperty(window, '__violationsCsp', { value: store });
        document.addEventListener(
          'securitypolicyviolation',
          (event) => store.push(`${event.effectiveDirective} ${event.blockedURI}`),
          true,
        );
      });
      const violations: string[] = [];
      const readViolations = async () =>
        violations.push(
          ...(await page.evaluate(
            () => (window as unknown as { __violationsCsp: string[] }).__violationsCsp,
          )),
        );
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });

      await openGuide(page, '', server.url);
      await section(page, 'carton').getByRole('button', { name: labels.next }).click();
      await toc(page)
        .getByRole('link', { name: /La préparation/ })
        .click();
      await page.getByRole('button', { name: chronometer.start }).click();
      await section(page, 'preparation').getByRole('button', { name: labels.next }).click();
      await section(page, 'page').getByRole('radio', { name: 'Ordinateur' }).check();
      await page.locator('#etape-page-windows summary').click();
      await page.goBack();
      await page.goForward();
      await page.getByRole('button', { name: labels.showAll }).click();
      await page.getByRole('button', { name: labels.showOne }).click();
      await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      await readViolations();
      await openGuide(page, '#etape-applications', server.url);
      await section(page, 'applications').getByRole('button', { name: labels.finish }).click();
      await expect(page.getByRole('heading', { level: 2, name: finish.title })).toBeFocused();

      await readViolations();
      expect(violations, 'violations de la politique de sécurité').toEqual([]);
      expect(errors, 'erreurs dans la console').toEqual([]);
    } finally {
      await server.close();
    }
  });
});

test.describe('Progression honnête et liens vers une aide', () => {
  test('« Avant de commencer » se lit sur place : aucun lien ne change d’étape', async ({
    page,
  }) => {
    await openGuide(page);
    await expect(page.locator('.needs a[href^="#etape-"]')).toHaveCount(0);
  });

  test('un renvoi vers une aide de l’étape 3 l’ouvre, sans dire d’étape faite', async ({
    page,
  }) => {
    await openGuide(page);
    const problem = page.locator('#etape-carton-pas-de-cable');
    await problem.locator('summary').click();
    await problem.locator('a[href="#etape-cable-pas-de-cable"]').click();
    await expect(page).toHaveURL(/#etape-cable-pas-de-cable$/);
    await expect(visibleSteps(page)).toHaveCount(1);
    await expect(section(page, 'cable')).toBeVisible();
    await expect(page.locator('#etape-cable-pas-de-cable')).toHaveAttribute('open', '');
    await expect(progress(page, 2)).toBeVisible();
    await expect(toc(page).locator('[data-state="done"]')).toHaveCount(0);
    await expect(toc(page)).not.toContainText(labels.stepDone);
  });

  test('seule une étape validée par « C’est fait » reçoit sa coche', async ({ page }) => {
    await openGuide(page);
    await section(page, 'carton').getByRole('button', { name: labels.next }).click();
    await toc(page)
      .getByRole('link', { name: /La première installation/ })
      .click();
    await expect(page).toHaveURL(/#etape-installation$/);
    await expect(progress(page, 6)).toBeVisible();
    const done = toc(page).locator('[data-state="done"]');
    await expect(done).toHaveCount(1);
    await expect(done).toHaveAttribute('href', '#etape-carton');
    await expect(done.locator('.toc__check')).toBeVisible();
  });

  test('adresse modifiée vers l’aide d’une étape cachée : l’aide s’ouvre, sans détour', async ({
    page,
  }) => {
    await openGuide(page);
    const before = await page.evaluate(() => window.history.length);
    await page.evaluate(() => {
      window.location.hash = '#etape-page-vpn';
    });
    await expect(section(page, 'page')).toBeVisible();
    await expect(page.locator('#etape-page-vpn')).toHaveAttribute('open', '');
    await expect(page).toHaveURL(/#etape-page-vpn$/);
    expect(await page.evaluate(() => window.history.length)).toBe(before + 1);
  });
});

test.describe('Étape 6 : tout ce qu’il faut savoir avant le bouton', () => {
  test('les mots, les consignes, puis « Avant d’appuyer » et « Pour revenir », puis le bouton', async ({
    page,
  }) => {
    await openGuide(page, '#etape-page');
    const step = section(page, 'page');
    const order = await step.evaluate((root) => {
      const all = [...root.querySelectorAll('*')];
      const at = (selector: string): number => {
        const element = root.querySelector(selector);
        return element ? all.indexOf(element) : -1;
      };
      return {
        words: at('.note'),
        devices: at('.devices'),
        before: at('.open__note'),
        button: at('.open__button'),
      };
    });
    expect(order.words).toBeGreaterThan(-1);
    expect(order.words).toBeLessThan(order.devices);
    expect(order.devices).toBeLessThan(order.before);
    expect(order.before).toBeLessThan(order.button);
    const { beforeOpen, back } = stepById('page');
    await expect(step.locator('.open__note-title')).toHaveText([beforeOpen.title, back.title]);
  });

  test('l’étape 7 reprend le même bouton, après ses gestes', async ({ page }) => {
    await openGuide(page, '#etape-installation');
    const step = section(page, 'installation');
    const link = step.getByRole('link', { name: open.label });
    await expect(link).toHaveAttribute('href', boxAddress.url);
    expect(await link.getAttribute('target'), 'même onglet').toBeNull();
    const order = await step.evaluate((root) => {
      const all = [...root.querySelectorAll('*')];
      const gestures = root.querySelector('ol');
      const button = root.querySelector('.step__open-button');
      return {
        gestures: gestures ? all.indexOf(gestures) : -1,
        button: button ? all.indexOf(button) : -1,
      };
    });
    expect(order.gestures).toBeGreaterThan(-1);
    expect(order.button).toBeGreaterThan(order.gestures);
  });

  test('l’appareil choisi n’est pas recoché par le navigateur au rechargement', async ({
    page,
  }) => {
    await openGuide(page, '#etape-page');
    const radios = section(page, 'page').getByRole('radio');
    for (const radio of await radios.all())
      await expect(radio).toHaveAttribute('autocomplete', 'off');
    await section(page, 'page').getByRole('radio', { name: 'Android' }).check();
    await expect(page.locator('[data-device="iphone"]')).toBeHidden();
    await page.reload();
    await expect(page.locator('[data-guide]')).toHaveAttribute('data-ready', 'true');
    await expect(section(page, 'page').locator('input[name="appareil"]:checked')).toHaveCount(0);
    for (const id of deviceIds) await expect(page.locator(`[data-device="${id}"]`)).toBeVisible();
  });
});

test.describe('Sommaire et colonne de gauche', () => {
  test('grand écran : la liste des étapes est dépliée, sans repli', async ({ page }) => {
    await openGuide(page);
    await expect(page.locator('[data-toc-fold]')).toHaveAttribute('open', '');
    await expect(page.locator('.toc__summary')).toBeHidden();
    for (const step of steps) {
      await expect(toc(page).locator(`a[href="#etape-${step.id}"]`)).toBeVisible();
    }
  });

  test('portable de 1366 × 640 : la colonne collante tient dans l’écran', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 640 });
    await openGuide(page, '#etape-page');
    await page.mouse.wheel(0, 900);
    await expect
      .poll(async () => (await page.locator('.guide__aside').boundingBox())?.y ?? -1)
      .toBeGreaterThan(0);
    const aside = must((await page.locator('.guide__aside').boundingBox()) ?? undefined, 'colonne');
    expect(aside.y + aside.height).toBeLessThanOrEqual(640);
  });
});

test.describe('Sommaire replié sur téléphone', () => {
  test.use({ viewport: MOBILE });

  test('« Aller directement à une étape » : replié au départ, puis se referme sur l’étape choisie', async ({
    page,
  }) => {
    await openGuide(page);
    const fold = page.locator('[data-toc-fold]');
    await expect(fold).not.toHaveAttribute('open', '');
    await expect(page.locator('.guide__progress')).toBeHidden();
    // La première étape suit de près le début du guide.
    const gap = await page.evaluate(
      () =>
        document.querySelector('#etape-carton-titre')!.getBoundingClientRect().top -
        document.querySelector('[data-guide]')!.getBoundingClientRect().top,
    );
    expect(gap, 'distance entre le haut du guide et le titre de l’étape 1').toBeLessThan(250);

    await fold.locator('summary').click();
    await expect(fold).toHaveAttribute('open', '');
    await toc(page)
      .getByRole('link', { name: /La préparation/ })
      .click();
    await expect(page).toHaveURL(/#etape-preparation$/);
    await expect(fold).not.toHaveAttribute('open', '');
    await expect(title(page, 'preparation')).toBeFocused();
  });
});

test.describe('Contraste élevé (Windows)', () => {
  test('icônes à la couleur du texte, bouton principal marqué, barre visible', async ({
    browser,
  }) => {
    const context = await browser.newContext({ forcedColors: 'active', viewport: DESKTOP });
    const page = await context.newPage();
    await openGuide(page, '#etape-cable');
    const step = section(page, 'cable');
    await expect(step.getByRole('button', { name: labels.next })).toHaveCSS(
      'border-top-width',
      '3px',
    );
    const colors = await step.evaluate((root) => ({
      icon: getComputedStyle(root.querySelector('.fact__icon')!).color,
      text: getComputedStyle(root.querySelector('.fact__text')!).color,
    }));
    expect(colors.icon).toBe(colors.text);
    await expect(page.locator('.guide__progress-bar')).toHaveCSS('border-top-width', '1px');
    await context.close();
  });
});

test.describe('Accès au guide', () => {
  const install = must(
    mainNav.find((link) => link.href === routes.install),
    'le lien du guide dans le menu',
  );

  test('menu de l’en-tête et accueil mènent au guide', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav.getByRole('link', { name: install.label })).toHaveAttribute('href', PATH);
    const received = page.locator('.hero__received');
    await expect(received).toContainText(hero.received.text);
    await expect(received.getByRole('link', { name: hero.received.link.label })).toHaveAttribute(
      'href',
      PATH,
    );
    await page.goto(PATH);
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('href', PATH);
  });

  for (const width of [1024, 1100, 1120]) {
    test(`${width} px : le menu tient sur une ligne`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      const tops = await page
        .locator('.site-header__link')
        .evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)));
      expect(new Set(tops).size, 'liens du menu sur une seule ligne').toBe(1);
      const height = await page.evaluate(
        () => document.querySelector('header.site-header')!.getBoundingClientRect().height,
      );
      const expected = await page.evaluate(
        () =>
          parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--header-height'),
          ) * parseFloat(getComputedStyle(document.documentElement).fontSize),
      );
      expect(Math.round(height)).toBe(Math.round(expected));
    });
  }

  test('téléphone : le panneau « Menu » propose le guide', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await page.locator('button.menu-toggle').click();
    await expect(
      page.locator('#menu-mobile').getByRole('link', { name: install.label }),
    ).toHaveAttribute('href', PATH);
  });
});
