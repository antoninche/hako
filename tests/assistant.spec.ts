/**
 * Démonstration de la première installation (/installer/demonstration/) : la
 * page de la HAKO, avec une HAKO simulée dans le navigateur, vérifiée dans la
 * page construite.
 *
 * - Sans JavaScript : la page explique la démonstration et montre les écrans
 *   principaux l'un sous l'autre, avec des comptes d'exemple.
 * - Parcours complet, à 390 et 1440 px : du début à la fin, aucune requête,
 *   aucun cookie, aucun stockage ; bandeau de démonstration à chaque écran ;
 *   focus sur le titre de chaque écran ; mots de passe d'exemple fixes ;
 *   mots de passe effacés une fois les comptes créés.
 * - Clavier ; bouton « Retour » du navigateur (un seul appui après « C'est
 *   prêt » pour retrouver le guide) ; liens d'aide dans un nouvel onglet ;
 *   prénoms refusés ; doublons expliqués ; prénoms modifiés (nouveaux mots de
 *   passe) ; vérification (signes, annonce des refus) ; impression (seule la
 *   fiche, avec EXEMPLE) ; erreurs simulées ; « Recommencer » ; mouvement
 *   réduit ; axe à chaque écran ; 320 px ; tout le parcours sous la
 *   politique de sécurité de production.
 *
 * Les tests généraux (tests/routes.ts) couvrent aussi cette page : axe à 390
 * et 1440 px, CSP au chargement, aucune requête au chargement, 320 px,
 * captures.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { startProdServer } from '../scripts/serve-prod.mjs';
import { assistant } from '../src/content/assistant';
import {
  EXAMPLE_FIRST_NAMES,
  EXAMPLE_PASSWORDS,
  FIRST_NAME_MAX_LENGTH,
  MAX_PEOPLE,
} from '../src/data/assistant';
import { DESKTOP, MOBILE } from './routes';
import { pathExists } from './support/node-tools.mjs';
import { builtDir } from './support/settings.mjs';

const PATH = '/installer/demonstration/';
const { common, demo, page: copy, screens, states } = assistant;
const { people, check } = screens;

/** Écrans du parcours, dans l'ordre, et leur ancre (#ecran-…). */
const SCREENS = {
  welcome: 'bienvenue',
  people: 'personnes',
  passwords: 'mots-de-passe',
  sheet: 'fiche',
  check: 'verification',
  accounts: 'comptes',
  ready: 'pret',
} as const;
const STATES = {
  preparing: 'preparation',
  unreachable: 'injoignable',
  stopped: 'creation-arretee',
  unexpected: 'erreur',
  installed: 'deja-installee',
} as const;
type ViewId = keyof typeof SCREENS | keyof typeof STATES;
const slugOf = (view: ViewId): string =>
  view in SCREENS ? SCREENS[view as keyof typeof SCREENS] : STATES[view as keyof typeof STATES];

/** Texte cherché tel quel dans une expression régulière. */
const literal = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));

const section = (page: Page, view: ViewId): Locator => page.locator(`#ecran-${slugOf(view)}`);
const title = (page: Page, view: ViewId): Locator => page.locator(`#ecran-${slugOf(view)}-titre`);
const button = (page: Page, name: string): Locator =>
  page.getByRole('button', { name, exact: true });
const announcer = (page: Page): Locator => page.locator('[data-announcer]');
const ownerField = (page: Page): Locator => page.getByRole('textbox', { name: people.owner.label });
const memberField = (page: Page, n: number): Locator =>
  page.getByRole('textbox', { name: fill(people.member.label, { n }) });
/** « {de_prenom} » des libellés, pour Hélène : « d’Hélène ». */
const ofHelene = { de_prenom: fill(common.of.vowel, { prenom: 'Hélène' }) };

/** Ouvre la démonstration et attend que son script ait démarré. */
async function openDemo(page: Page, base = ''): Promise<void> {
  await page.goto(`${base}${PATH}`);
  await expect(page.locator('[data-assistant]')).toHaveAttribute('data-ready', 'true');
}

/** Un écran affiché seul, son titre avec le focus, et le bandeau de démonstration visible. */
async function expectScreen(page: Page, view: ViewId): Promise<void> {
  await expect(title(page, view)).toBeFocused();
  await expect(page.locator('section[data-screen]:visible')).toHaveCount(1);
  await expect(section(page, view)).toBeVisible();
  await expect(page.locator('[data-demo-banner]')).toBeVisible();
  await expect(page.locator('[data-demo-banner]')).toContainText(demo.banner.text);
}

/** Accueil → prénoms → mots de passe. */
async function toPasswords(page: Page, names: readonly string[] = ['Hélène']): Promise<void> {
  await button(page, screens.welcome.start).click();
  await expectScreen(page, 'people');
  for (const [index, name] of names.entries()) {
    if (index > 0) await button(page, people.add).click();
    await (index === 0 ? ownerField(page) : memberField(page, index + 1)).fill(name);
  }
  await button(page, people.next).click();
  await expectScreen(page, 'passwords');
}

/** … → fiche → vérification réussie. */
async function toChecked(page: Page, ownerPassword = EXAMPLE_PASSWORDS[0]): Promise<void> {
  await button(page, screens.passwords.next).click();
  await expectScreen(page, 'sheet');
  await button(page, screens.sheet.next).click();
  await expectScreen(page, 'check');
  await page.locator('[data-check-input]').fill(ownerPassword);
  await button(page, check.submit).click();
  await expect(page.locator('[data-check-success]')).toBeVisible();
  await expect(button(page, check.create)).toBeFocused();
}

/** window.print remplacé : il compte les appels et prévient la page comme le navigateur. */
async function stubPrint(page: Page): Promise<void> {
  await page.evaluate(() => {
    const record = { calls: 0 };
    Object.defineProperty(window, '__impressions', { value: record });
    window.print = () => {
      record.calls += 1;
      window.dispatchEvent(new Event('beforeprint'));
      window.dispatchEvent(new Event('afterprint'));
    };
  });
}

const printCalls = (page: Page): Promise<number> =>
  page.evaluate(
    () => (window as unknown as { __impressions: { calls: number } }).__impressions.calls,
  );

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoSeriousViolations(page: Page, context: string): Promise<void> {
  // Le filigrane « EXEMPLE » de la fiche est une pure décoration, cachée aux
  // lecteurs d'écran (le titre dit déjà « exemple ») et pâle exprès, pour ne
  // pas gêner la lecture des mots de passe : les WCAG (1.4.3) ne demandent
  // aucun contraste pour un tel texte. axe ne le mesure que si rien ne le
  // recouvre en son centre, selon la hauteur de la fiche : il est laissé de côté.
  const results = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .exclude('.printout__watermark')
    .analyze();
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

test.describe('Démonstration sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('la page explique la démonstration, et les écrans se lisent l’un sous l’autre', async ({
    page,
  }) => {
    await page.goto(PATH);
    await expect(page).toHaveTitle(/^Démonstration de la première installation/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy.intro.title);
    for (const point of copy.intro.points) {
      await expect(page.getByRole('heading', { level: 2, name: point.title })).toBeVisible();
    }
    await expect(page.locator('[data-demo-banner]')).toContainText(demo.banner.text);

    // Les écrans du parcours, dans l'ordre ; ceux d'attente et d'erreur restent cachés.
    const headings = page.locator('section[data-screen]:visible h2');
    await expect(headings).toHaveCount(assistant.order.length);
    for (const [index, view] of assistant.order.entries()) {
      await expect(headings.nth(index)).toContainText(screens[view].title);
    }
    for (const view of Object.keys(STATES) as ViewId[])
      await expect(section(page, view)).toBeHidden();

    // Des comptes d'exemple, et la fiche marquée EXEMPLE.
    for (const password of EXAMPLE_PASSWORDS.slice(0, EXAMPLE_FIRST_NAMES.length)) {
      await expect(page.locator('.account__password', { hasText: password })).toBeVisible();
    }
    await expect(page.locator('[data-printout] .printout__watermark')).toHaveText(
      demo.printout.watermark,
    );
    await expect(page.locator('[data-printout] h4')).toHaveText(demo.printout.title);

    // Ce qui ne marche qu'avec JavaScript reste caché ; une note le dit.
    await expect(page.locator('[data-js-only]:visible')).toHaveCount(0);
    await expect(page.locator('[data-assistant] button:visible')).toHaveCount(0);
    await expect(page.locator('[data-assistant] form:visible')).toHaveCount(0);
    // Le moteur de texte de Playwright ignore <noscript> : on vise l'élément.
    await expect(page.locator('noscript p').first()).toBeVisible();
  });
});

for (const viewport of [MOBILE, DESKTOP]) {
  test.describe(`Parcours complet, ${viewport.width} px`, () => {
    test.use({ viewport });

    test('du début à la fin : aucune requête, aucun stockage, aucun cookie', async ({
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
      const loading: string[] = [];
      const recordLoading = (request: { method(): string; url(): string }): void => {
        loading.push(`${request.method()} ${request.url()}`);
      };
      page.on('request', recordLoading);

      await openDemo(page);
      await page.waitForLoadState('networkidle');
      // Toutes les polices sont chargées d'avance : la suite ne peut rien demander.
      await page.evaluate(async () => {
        await Promise.all([...document.fonts].map((font) => font.load().catch(() => undefined)));
        await document.fonts.ready;
      });
      page.off('request', recordLoading);
      const origin = new URL(page.url()).origin;
      for (const request of loading) {
        expect(request, 'chargement : seulement les fichiers du site').toMatch(
          new RegExp(`^GET ${literal(origin)}/`),
        );
      }
      const requests: string[] = [];
      page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));
      await stubPrint(page);

      // Accueil : rien n'est encore demandé.
      await expect(section(page, 'welcome')).toBeVisible();
      await expect(page.locator('section[data-screen]:visible')).toHaveCount(1);
      expect(page.url()).not.toContain('#');

      // Prénoms, avec un doublon.
      await toPasswords(page, ['Hélène', 'Camille', 'camille']);
      await expect(page).toHaveURL(/#ecran-mots-de-passe$/);
      const cards = page.locator('[data-accounts] .account');
      await expect(cards).toHaveCount(3);
      await expect(cards.nth(0)).toContainText(screens.passwords.card.owner);
      await expect(cards.locator('.account__login')).toHaveText([
        'helene@hako.local',
        'camille@hako.local',
        'camille2@hako.local',
      ]);
      // Mots de passe d'exemple fixes, dans l'ordre : « exemple », trois mots, puis 00.
      await expect(cards.locator('.account__password')).toHaveText(EXAMPLE_PASSWORDS.slice(0, 3));
      for (const password of await cards.locator('.account__password').allTextContents()) {
        expect(password).toMatch(/^exemple(?:-[a-z]{4,8}){3}-00$/);
      }

      // Fiche de secours : impression, filigrane, comptes.
      await button(page, screens.passwords.next).click();
      await expectScreen(page, 'sheet');
      await button(page, screens.sheet.print).click();
      expect(await printCalls(page)).toBe(1);
      await expect(page.locator('[data-printed]')).toBeVisible();
      const fiche = page.locator('[data-printout]');
      await expect(fiche.locator('.printout__watermark')).toHaveText(demo.printout.watermark);
      await expect(fiche.locator('[data-printout-rows] .printout__row')).toHaveCount(3);
      await expect(fiche).toContainText(EXAMPLE_PASSWORDS[2]);

      // Vérification, puis création des comptes.
      await button(page, screens.sheet.next).click();
      await expectScreen(page, 'check');
      await expect(page.getByLabel(fill(check.field.label, ofHelene))).toBeVisible();
      await page.locator('[data-check-input]').fill(EXAMPLE_PASSWORDS[0]);
      await button(page, check.submit).click();
      await expect(page.locator('[data-check-success]')).toHaveText(check.success);
      await expect(announcer(page)).toHaveText(check.success);
      await button(page, check.create).click();
      await expectScreen(page, 'accounts');
      await expect(page.locator('[data-task="photos"]')).toHaveAttribute(
        'data-state',
        /running|done/,
      );
      await expect(title(page, 'ready')).toBeFocused({ timeout: 10_000 });
      await expectScreen(page, 'ready');
      // En démonstration, l'annonce dit que rien n'est installé.
      await expect(announcer(page)).toHaveText(demo.ready.done, { timeout: 10_000 });
      await expect(section(page, 'ready')).toContainText(demo.ready.note);
      await expect(page.locator('[data-step-indicator][data-state="done"]')).toHaveCount(5);

      // Les mots de passe ont quitté la page.
      const shown = await page.locator('main').innerText();
      for (const password of EXAMPLE_PASSWORDS) expect(shown).not.toContain(password);
      await expect(page.locator('[data-accounts] .account')).toHaveCount(0);

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
}

test.describe('Démonstration, gestes et retours', () => {
  test('au clavier : Entrée, ajout et retrait d’une personne, focus au bon endroit', async ({
    page,
  }) => {
    await openDemo(page);
    await button(page, screens.welcome.start).focus();
    await page.keyboard.press('Enter');
    await expectScreen(page, 'people');

    // Du titre, Tab mène au premier prénom.
    await page.keyboard.press('Tab');
    await expect(ownerField(page)).toBeFocused();
    await page.keyboard.type('Hélène');
    await page.keyboard.press('Tab');
    await expect(button(page, people.add)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(memberField(page, 2)).toBeFocused();
    await page.keyboard.type('Marc');
    await expect(page.locator('[data-person-login]:visible')).toHaveText([
      fill(people.login.preview, { identifiant: 'helene@hako.local' }),
      fill(people.login.preview, { identifiant: 'marc@hako.local' }),
    ]);
    await page.keyboard.press('Tab');
    const remove = page.getByRole('button', {
      name: fill(people.remove.named, { prenom: 'Marc' }),
    });
    await expect(remove).toBeFocused();
    await page.keyboard.press('Enter');
    // Ligne retirée : le focus revient au champ précédent.
    await expect(ownerField(page)).toBeFocused();
    await expect(page.locator('[data-person]')).toHaveCount(1);

    // Entrée dans un champ : « Continuer ».
    await page.keyboard.press('Enter');
    await expectScreen(page, 'passwords');
  });

  test('bouton « Retour » du navigateur : l’écran d’avant, la saisie gardée', async ({ page }) => {
    await openDemo(page);
    await toPasswords(page, ['Hélène', 'Marc']);
    await button(page, screens.passwords.next).click();
    await expectScreen(page, 'sheet');

    await page.goBack();
    await expect(page).toHaveURL(/#ecran-mots-de-passe$/);
    await expectScreen(page, 'passwords');
    await page.goBack();
    await expect(page).toHaveURL(/#ecran-personnes$/);
    await expectScreen(page, 'people');
    await expect(ownerField(page)).toHaveValue('Hélène');
    await expect(memberField(page, 2)).toHaveValue('Marc');
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    await expectScreen(page, 'welcome');
    await page.goForward();
    await expectScreen(page, 'people');
  });

  test('après « C’est prêt », un seul appui sur « Retour » ramène au guide', async ({ page }) => {
    await page.goto('/installer/');
    await openDemo(page);
    await toPasswords(page, ['Hélène', 'Marc']);
    await toChecked(page);
    await button(page, check.create).click();
    await expect(title(page, 'ready')).toBeFocused({ timeout: 10_000 });
    // Comptes créés : les écrans d'avant ne peuvent plus s'afficher. Un seul
    // appui sur « Retour » quitte la page, vers celle d'où l'on venait.
    await page.goBack();
    await expect(page).toHaveURL(/\/installer\/$/);
    await expect(page.locator('[data-assistant]')).toHaveCount(0);
  });

  test('liens d’aide : dans un nouvel onglet, les mots de passe restent affichés', async ({
    page,
    context,
  }) => {
    await openDemo(page);
    await toPasswords(page, ['Hélène', 'Marc']);
    const link = page
      .locator('.hako-page__help')
      .getByRole('link', { name: new RegExp(literal(common.newTab)) })
      .first();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener');
    await expect(link).toContainText(common.newTab);
    const [opened] = await Promise.all([context.waitForEvent('page'), link.click()]);
    await opened.close();
    await expect(section(page, 'passwords')).toBeVisible();
    await expect(page.locator('section[data-screen]:visible')).toHaveCount(1);
    await expect(page.locator('[data-accounts] .account__password')).toHaveText(
      EXAMPLE_PASSWORDS.slice(0, 2),
    );
    // Le bouton de retour de « C'est prêt » reste dans le même onglet.
    const back = section(page, 'ready').locator('[data-same-tab] a').first();
    await expect(back).toHaveAttribute('href', /#etape-page$/);
    await expect(back).not.toHaveAttribute('target', '_blank');
  });

  test('prénoms modifiés : de nouveaux mots de passe, la fiche est à refaire', async ({ page }) => {
    await openDemo(page);
    await toPasswords(page, ['Hélène']);
    const renewed = page.locator('[data-passwords-renewed]');
    await expect(renewed).toBeHidden();
    await button(page, screens.passwords.back).click();
    await expectScreen(page, 'people');
    await expect(page.locator('[data-people-renew]')).toBeVisible();
    await expect(page.locator('[data-people-renew]')).toContainText(people.renew.title);
    // Sans rien changer : les mêmes mots de passe, sans avertissement.
    await button(page, people.next).click();
    await expectScreen(page, 'passwords');
    await expect(renewed).toBeHidden();
    // Une personne de plus : nouveaux mots de passe pour tout le monde.
    await button(page, screens.passwords.back).click();
    await button(page, people.add).click();
    await memberField(page, 2).fill('Claire');
    await button(page, people.next).click();
    await expectScreen(page, 'passwords');
    await expect(renewed).toBeVisible();
    await expect(renewed).toContainText(screens.passwords.renewed.title);
    await expect(renewed).toContainText(demo.passwordsRenewed);
  });

  test('« Recommencer » : la démonstration repart de zéro', async ({ page }) => {
    await openDemo(page);
    await toPasswords(page, ['Hélène', 'Marc']);
    await button(page, demo.banner.restart).click();
    await expectScreen(page, 'welcome');
    await expect(announcer(page)).toHaveText(demo.restarted);
    await expect(page).not.toHaveURL(/#/);
    await button(page, screens.welcome.start).click();
    await expect(page.locator('[data-person]')).toHaveCount(1);
    await expect(ownerField(page)).toHaveValue('');
    await expect(page.locator('[data-accounts] .account')).toHaveCount(0);
  });

  test('« Recommencer », puis « Retour » du navigateur : un seul appui ramène au guide', async ({
    page,
  }) => {
    await page.goto('/installer/');
    await openDemo(page);
    await toPasswords(page, ['Hélène', 'Marc']);
    await button(page, screens.passwords.next).click();
    await expectScreen(page, 'sheet');
    await button(page, screens.sheet.next).click();
    await expectScreen(page, 'check');
    await button(page, demo.banner.restart).click();
    await expectScreen(page, 'welcome');
    await expect(page).toHaveURL(new RegExp(`${literal(PATH)}$`));
    // Les écrans de l'essai d'avant ne sont plus derrière l'accueil.
    await page.goBack();
    await expect(page).toHaveURL(/\/installer\/$/);
    await expect(page.locator('[data-assistant]')).toHaveCount(0);
  });
});

test.describe('Prénoms', () => {
  test('refusés : message relié au champ, résumé, correction', async ({ page }) => {
    await openDemo(page);
    await button(page, screens.welcome.start).click();

    // Prénom de la personne responsable manquant.
    await button(page, people.next).click();
    const summary = page.locator('[data-error-summary]');
    await expect(summary).toBeFocused();
    await expect(summary.getByRole('heading')).toHaveText(common.errors.titleOne);
    await expect(summary.getByRole('link')).toHaveText(people.errors.ownerMissing);
    const owner = ownerField(page);
    await expect(owner).toHaveAttribute('aria-invalid', 'true');
    await expect(owner).toHaveAccessibleDescription(
      new RegExp(literal(people.errors.ownerMissing)),
    );

    // Chiffres, prénom trop long : deux erreurs, deux liens.
    await owner.fill('Marc2');
    await expect(page.locator('[data-person-error]').first()).toContainText(
      people.errors.characters,
    );
    await button(page, people.add).click();
    await memberField(page, 2).fill('x'.repeat(FIRST_NAME_MAX_LENGTH + 1));
    await button(page, people.next).click();
    await expect(summary).toBeFocused();
    await expect(summary.getByRole('heading')).toHaveText(fill(common.errors.titleMany, { n: 2 }));
    await expect(summary.getByRole('link')).toHaveText([
      people.errors.characters,
      people.errors.tooLong,
    ]);
    await summary.getByRole('link').nth(1).click();
    await expect(memberField(page, 2)).toBeFocused();

    // Corrigé : l'erreur disparaît du champ et du résumé.
    await owner.fill('Marc');
    await expect(owner).not.toHaveAttribute('aria-invalid', 'true');
    await expect(summary.getByRole('heading')).toHaveText(common.errors.titleOne);
    await memberField(page, 2).fill('Léa');
    await expect(summary).toBeHidden();
    await button(page, people.next).click();
    await expectScreen(page, 'passwords');
  });

  test(`jusqu’à ${MAX_PEOPLE} personnes`, async ({ page }) => {
    await openDemo(page);
    await button(page, screens.welcome.start).click();
    for (let n = 2; n <= MAX_PEOPLE; n += 1) await button(page, people.add).click();
    await expect(page.locator('[data-person]')).toHaveCount(MAX_PEOPLE);
    await expect(button(page, people.add)).toBeHidden();
    await expect(page.locator('[data-people-full]')).toHaveText(people.errors.full);
    await expect(announcer(page)).toHaveText(people.errors.full);
    await page
      .getByRole('button', { name: fill(people.remove.numbered, { n: MAX_PEOPLE }) })
      .click();
    await expect(button(page, people.add)).toBeVisible();
    await expect(memberField(page, MAX_PEOPLE - 1)).toBeFocused();
  });

  test('Zoé puis Zoë : le chiffre ajouté est expliqué sous le prénom', async ({ page }) => {
    await openDemo(page);
    await button(page, screens.welcome.start).click();
    await ownerField(page).fill('Zoé');
    await button(page, people.add).click();
    await memberField(page, 2).fill('Zoë');
    await expect(page.locator('[data-person-login]:visible')).toHaveText([
      fill(people.login.preview, { identifiant: 'zoe@hako.local' }),
      fill(people.login.taken, {
        identifiant: 'zoe2@hako.local',
        autre: 'Zoé',
        pris: 'zoe@hako.local',
      }),
    ]);
  });

  test('doublons : la deuxième personne reçoit « 2 », la troisième « 3 »', async ({ page }) => {
    await openDemo(page);
    await toPasswords(page, ['Camille', 'Camille', 'Camille']);
    await expect(page.locator('[data-accounts] .account__login')).toHaveText([
      'camille@hako.local',
      'camille2@hako.local',
      'camille3@hako.local',
    ]);
    await expect(page.locator('[data-printout-rows]')).toContainText('camille3@hako.local');
  });

  test('« Remplir avec des prénoms d’exemple »', async ({ page }) => {
    await openDemo(page);
    await button(page, screens.welcome.start).click();
    await button(page, demo.people.fill).click();
    await expect(page.locator('[data-person-input]')).toHaveCount(EXAMPLE_FIRST_NAMES.length);
    for (const [index, name] of EXAMPLE_FIRST_NAMES.entries()) {
      await expect(page.locator('[data-person-input]').nth(index)).toHaveValue(name);
    }
  });
});

test.describe('Vérification de la fiche', () => {
  test('champ vide, majuscule, mot de passe faux, puis trois essais', async ({ page }) => {
    await openDemo(page);
    await toPasswords(page, ['Hélène']);
    await button(page, screens.passwords.next).click();
    await button(page, screens.sheet.next).click();
    await expectScreen(page, 'check');
    const field = page.locator('[data-check-input]');
    const error = page.locator('[data-check-error]');

    await button(page, check.submit).click();
    await expect(error).toContainText(fill(check.errors.empty, ofHelene));
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute('aria-invalid', 'true');

    await field.fill('Exemple-tulipe-melon-givre-00');
    await button(page, check.submit).click();
    await expect(error).toContainText(check.errors.uppercase);

    // Clavier d'ordinateur français : « 00 » tapé sans Maj donne « àà ». Le
    // refus est annoncé (Entrée dans le champ, qui a déjà le focus), sans
    // compter d'essai faux.
    await field.fill('exemple-tulipe-melon-givre-àà');
    await field.press('Enter');
    await expect(error).toContainText(check.errors.character);
    await expect(field).toBeFocused();
    await expect(announcer(page)).toContainText(check.errors.character);

    // « Afficher ce que je tape ».
    await expect(field).toHaveAttribute('type', 'password');
    await page.getByLabel(check.show).check();
    await expect(field).toHaveAttribute('type', 'text');

    for (const attempt of [1, 2, 3]) {
      await field.fill(`exemple-faux-mot-passe-0${attempt}`);
      await button(page, check.submit).click();
      await expect(error).toContainText(attempt < 3 ? check.errors.wrong : check.errors.again);
      await expect(field).toBeFocused();
    }
    await button(page, check.review).click();
    await expectScreen(page, 'passwords');
  });
});

test.describe('Impression', () => {
  test('seule la fiche s’imprime, avec EXEMPLE, même depuis un autre écran', async ({ page }) => {
    await openDemo(page);
    await toPasswords(page, ['Hélène', 'Marc']);
    await button(page, screens.passwords.next).click();
    await expectScreen(page, 'sheet');

    const visibleOutsideFiche = (): Promise<string[]> =>
      page.evaluate(() => {
        const fiche = document.querySelector('[data-printout]');
        return [...document.querySelectorAll('body *')]
          .filter(
            (element) =>
              element.checkVisibility() &&
              fiche !== null &&
              !fiche.contains(element) &&
              !element.contains(fiche),
          )
          .map((element) => `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}`);
      });

    for (const view of ['sheet', 'check'] as const) {
      if (view === 'check') {
        await button(page, screens.sheet.next).click();
        await expectScreen(page, 'check');
      }
      await page.emulateMedia({ media: 'print' });
      const fiche = page.locator('[data-printout]');
      await expect(fiche).toBeVisible();
      await expect(fiche.locator('.printout__watermark')).toBeVisible();
      await expect(fiche.locator('.printout__watermark')).toHaveText(demo.printout.watermark);
      await expect(fiche).toContainText(demo.printout.title);
      await expect(fiche).toContainText(EXAMPLE_PASSWORDS[1]);
      await expect(page.locator('header.site-header')).toBeHidden();
      await expect(page.locator('footer.site-footer')).toBeHidden();
      await expect(page.locator('[data-demo-banner]')).toBeHidden();
      expect(await visibleOutsideFiche(), `rien d’autre que la fiche (${view})`).toEqual([]);
      await page.emulateMedia({ media: 'screen' });
    }
  });
});

test.describe('Fiche de secours : un mot de passe sur une seule ligne', () => {
  /** Huit personnes, le plus possible, avec des prénoms longs et un doublon. */
  const EIGHT = [
    'Hélène',
    'Marc',
    'Léa',
    'Monique',
    'Jean-Baptiste',
    'Camille',
    'Camille',
    'Maximilien',
  ];
  /** Papier A4 moins les marges de la fiche (186 × 277 mm), en pixels CSS. */
  const A4_CONTENT = { width: 703, height: 1047 } as const;

  /** Mots de passe coupés sur plusieurs lignes, ou plus larges que leur colonne. */
  const brokenPasswords = (page: Page): Promise<string[]> =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-printout-rows] .printout__cell--password')].flatMap(
        (cell) => {
          const value = cell.lastElementChild;
          if (value === null) return ['mot de passe absent'];
          const lines = new Set(
            [...value.querySelectorAll('span')].map((chunk) =>
              Math.round(chunk.getBoundingClientRect().top),
            ),
          );
          const range = document.createRange();
          range.selectNodeContents(value);
          const overflow = range.getBoundingClientRect().right - cell.getBoundingClientRect().right;
          return lines.size === 1 && overflow <= 0.5
            ? []
            : [`${value.textContent} : ${lines.size} lignes, ${overflow.toFixed(1)} px de trop`];
        },
      ),
    );

  async function toSheet(page: Page, names: readonly string[]): Promise<void> {
    await openDemo(page);
    await toPasswords(page, names);
    await button(page, screens.passwords.next).click();
    await expectScreen(page, 'sheet');
    await expect(page.locator('[data-printout-rows] .printout__row')).toHaveCount(names.length);
  }

  for (const width of [360, MOBILE.width, 768, 1024, DESKTOP.width]) {
    test(`à l’écran, ${width} px, huit personnes`, async ({ page }) => {
      await page.setViewportSize({ width, height: DESKTOP.height });
      await toSheet(page, EIGHT);
      expect(await brokenPasswords(page)).toEqual([]);
    });
  }

  for (const count of [2, MAX_PEOPLE]) {
    test(`sur papier A4, ${count} personnes, et la fiche tient sur une page`, async ({ page }) => {
      await page.setViewportSize(A4_CONTENT);
      await toSheet(page, EIGHT.slice(0, count));
      await page.emulateMedia({ media: 'print' });
      expect(await brokenPasswords(page)).toEqual([]);
      // Le PDF que donnerait « Enregistrer au format PDF » : une seule page.
      const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
      expect(pdf.match(/\/Type\s*\/Page\b(?!s)/g) ?? []).toHaveLength(1);
    });
  }
});

test.describe('Erreurs simulées', () => {
  const openScenarios = async (page: Page): Promise<Locator> => {
    const panel = page.locator('#demonstration-autres-ecrans');
    if ((await panel.getAttribute('open')) === null) await panel.locator('summary').click();
    return panel;
  };

  test('coupure pendant la création des comptes, puis reprise', async ({ page }) => {
    await openDemo(page);
    await toPasswords(page, ['Hélène', 'Marc']);
    await toChecked(page);
    const panel = await openScenarios(page);
    await panel.getByRole('button', { name: demo.scenarios.items.stopped }).click();
    await expectScreen(page, 'accounts');
    await expect(title(page, 'stopped')).toBeFocused({ timeout: 10_000 });
    await expectScreen(page, 'stopped');
    await expect(section(page, 'stopped')).toContainText(states.stopped.title);
    await expect(section(page, 'stopped').locator('.state__fix li')).toHaveCount(
      states.stopped.fix.length,
    );
    // Les comptes des photos sont faits, et le restent.
    await expect(page.locator('[data-task="photos"]')).toHaveAttribute('data-state', 'done');
    await expect(page.locator('[data-task="files"]')).toHaveAttribute('data-state', 'waiting');

    await button(page, states.stopped.action ?? '').click();
    await expectScreen(page, 'accounts');
    await expect(title(page, 'ready')).toBeFocused({ timeout: 10_000 });
  });

  test('« La création s’est arrêtée » montrée après « C’est prêt » : les comptes restent en cours', async ({
    page,
  }) => {
    await openDemo(page);
    await toPasswords(page, ['Hélène']);
    await toChecked(page);
    await button(page, check.create).click();
    await expect(title(page, 'ready')).toBeFocused({ timeout: 10_000 });
    const panel = await openScenarios(page);
    await panel.getByRole('button', { name: demo.scenarios.items.stopped }).click();
    await expectScreen(page, 'stopped');
    // Quatre écrans faits, et celui des comptes en cours : pas cinq coches
    // au-dessus de « La création des comptes s’est arrêtée ».
    const items = page.locator('[data-steps] [data-step-indicator]');
    await expect(items).toHaveCount(5);
    for (const index of [0, 1, 2, 3]) {
      await expect(items.nth(index)).toHaveAttribute('data-state', 'done');
    }
    await expect(items.nth(4)).toHaveAttribute('data-state', 'current');
    await expect(items.nth(4)).toHaveAttribute('aria-current', 'step');
  });

  test('la HAKO ne répond plus, puis répond : retour là où l’on était', async ({ page }) => {
    await openDemo(page);
    await button(page, screens.welcome.start).click();
    await ownerField(page).fill('Hélène');
    const panel = await openScenarios(page);
    await panel.getByRole('button', { name: demo.scenarios.items.unreachable }).click();
    await expectScreen(page, 'unreachable');
    await expect(page).toHaveURL(/#ecran-injoignable$/);
    await button(page, states.unreachable.action ?? '').click();
    await expectScreen(page, 'people');
    await expect(ownerField(page)).toHaveValue('Hélène');
  });

  test('se prépare encore, erreur imprévue, déjà installée', async ({ page }) => {
    await openDemo(page);
    const panel = await openScenarios(page);
    await panel.getByRole('button', { name: demo.scenarios.items.preparing }).click();
    await expectScreen(page, 'preparing');
    await expect(page.locator('[data-steps]')).toBeHidden();
    await button(page, states.preparing.action ?? '').click();
    await expectScreen(page, 'welcome');

    await panel.getByRole('button', { name: demo.scenarios.items.unexpected }).click();
    await expectScreen(page, 'unexpected');
    await button(page, states.unexpected.action ?? '').click();
    await expectScreen(page, 'welcome');

    await panel.getByRole('button', { name: demo.scenarios.items.installed }).click();
    await expectScreen(page, 'installed');
    await expect(section(page, 'installed').locator('.app')).toHaveCount(2);
    await button(page, demo.banner.restart).click();
    await expectScreen(page, 'welcome');
  });
});

test.describe('Mouvement réduit', () => {
  test.use({ reducedMotion: 'reduce' });

  test('pas de défilement doux, pas d’animation de la ligne en cours', async ({ page }) => {
    await page.addInitScript(() => {
      const calls: unknown[] = [];
      Object.defineProperty(window, '__defilements', { value: calls });
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (this: Element, options?: unknown) {
        calls.push(options);
        original.call(this, options as ScrollIntoViewOptions);
      };
    });
    await openDemo(page);
    await button(page, screens.welcome.start).click();
    await expectScreen(page, 'people');
    const calls = await page.evaluate(
      () => (window as unknown as { __defilements: { behavior?: string }[] }).__defilements,
    );
    expect(calls.at(-1)?.behavior).toBe('auto');

    const animation = await page.locator('[data-task="photos"]').evaluate((task) => {
      (task as HTMLElement).dataset['state'] = 'running';
      const mark = task.querySelector('.task__mark');
      return mark ? getComputedStyle(mark).animationName : '';
    });
    expect(animation).toBe('none');
  });

  test('sans demande, la ligne en cours respire et la page défile en douceur', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference' });
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
    await openDemo(page);
    await button(page, screens.welcome.start).click();
    await expectScreen(page, 'people');
    const calls = await page.evaluate(
      () => (window as unknown as { __defilements: { behavior?: string }[] }).__defilements,
    );
    expect(calls.at(-1)?.behavior).toBe('smooth');
    const animation = await page.locator('[data-task="photos"]').evaluate((task) => {
      (task as HTMLElement).dataset['state'] = 'running';
      const mark = task.querySelector('.task__mark');
      return mark ? getComputedStyle(mark).animationName : '';
    });
    expect(animation).not.toBe('none');
    await context.close();
  });
});

test.describe('Accessibilité et petits écrans', () => {
  // Défilement instantané : axe voit chaque écran une fois en place, pas
  // pendant le défilement doux sous l'en-tête collant.
  test.use({ viewport: MOBILE, reducedMotion: 'reduce' });

  test('axe, 390 px : chaque écran, erreurs comprises', async ({ page }) => {
    await openDemo(page);
    await expectNoSeriousViolations(page, 'accueil');
    await button(page, screens.welcome.start).click();
    await button(page, people.next).click();
    await expectNoSeriousViolations(page, 'prénoms refusés');
    await ownerField(page).fill('Hélène');
    await button(page, people.next).click();
    await expectScreen(page, 'passwords');
    await expectNoSeriousViolations(page, 'mots de passe');
    await button(page, screens.passwords.next).click();
    await expectNoSeriousViolations(page, 'fiche');
    await button(page, screens.sheet.next).click();
    await button(page, check.submit).click();
    await expectNoSeriousViolations(page, 'vérification refusée');
    await page.locator('[data-check-input]').fill(EXAMPLE_PASSWORDS[0]);
    await button(page, check.submit).click();
    await expect(button(page, check.create)).toBeFocused();
    await button(page, check.create).click();
    await expectNoSeriousViolations(page, 'création des comptes');
    await expect(title(page, 'ready')).toBeFocused({ timeout: 10_000 });
    await expectNoSeriousViolations(page, 'c’est prêt');
    await page.locator('#demonstration-autres-ecrans summary').click();
    await page.getByRole('button', { name: demo.scenarios.items.unreachable }).click();
    await expectScreen(page, 'unreachable');
    await expectNoSeriousViolations(page, 'HAKO injoignable');
  });

  test('320 px : aucun écran ne déborde, cibles de 44 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: MOBILE.height });
    await openDemo(page);
    const tooSmall = (): Promise<string[]> =>
      page.evaluate(() => {
        const found: string[] = [];
        const targets = document.querySelectorAll<HTMLElement>(
          '[data-assistant] :is(button, .banner__guide, .faq-item__summary, input[type="text"], input[type="password"], input[type="checkbox"] + label)',
        );
        for (const target of targets) {
          if (!target.checkVisibility()) continue;
          const box = target.getBoundingClientRect();
          // Une case à cocher : toute sa rangée est cliquable.
          const row = target.closest('.check-show') ?? target;
          const area = row.getBoundingClientRect();
          if (area.width < 44 || area.height < 44 || (box.width < 44 && box.height < 44)) {
            found.push(
              `${target.textContent?.trim() ?? target.tagName} : ${Math.round(area.width)} × ${Math.round(area.height)}`,
            );
          }
        }
        return found;
      });

    await expectNoHorizontalOverflow(page, 'accueil');
    await button(page, screens.welcome.start).click();
    await button(page, demo.people.fill).click();
    await button(page, people.add).click();
    await memberField(page, 4).fill('Marie-Christine Élisabeth');
    await expectNoHorizontalOverflow(page, 'prénoms');
    expect(await tooSmall(), 'cibles trop petites (prénoms)').toEqual([]);
    await button(page, people.next).click();
    await expectScreen(page, 'passwords');
    await expectNoHorizontalOverflow(page, 'mots de passe');
    await button(page, screens.passwords.next).click();
    await expectNoHorizontalOverflow(page, 'fiche');
    expect(await tooSmall(), 'cibles trop petites (fiche)').toEqual([]);
    await button(page, screens.sheet.next).click();
    await expectNoHorizontalOverflow(page, 'vérification');
    expect(await tooSmall(), 'cibles trop petites (vérification)').toEqual([]);
  });
});

test.describe('Politique de sécurité de production', () => {
  test('tout le parcours, sans aucune violation ni erreur', async ({ page }) => {
    test.skip(
      !pathExists(`${builtDir}/installer/demonstration/index.html`),
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
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });

      await openDemo(page, server.url);
      await stubPrint(page);
      await toPasswords(page, ['Hélène', 'Camille', 'Camille']);
      await button(page, screens.passwords.next).click();
      await button(page, screens.sheet.print).click();
      await toCheckedFromSheet(page);
      await button(page, check.create).click();
      await expect(title(page, 'ready')).toBeFocused({ timeout: 10_000 });
      await button(page, demo.banner.restart).click();
      await expectScreen(page, 'welcome');

      const violations = await page.evaluate(
        () => (window as unknown as { __violationsCsp: string[] }).__violationsCsp,
      );
      expect(violations, 'violations de la politique de sécurité').toEqual([]);
      expect(errors, 'erreurs dans la console').toEqual([]);
    } finally {
      await server.close();
    }
  });
});

/** Depuis l'écran de la fiche : vérification réussie. */
async function toCheckedFromSheet(page: Page): Promise<void> {
  await button(page, screens.sheet.next).click();
  await expectScreen(page, 'check');
  await page.locator('[data-check-input]').fill(EXAMPLE_PASSWORDS[0]);
  await button(page, check.submit).click();
  await expect(button(page, check.create)).toBeFocused();
}
