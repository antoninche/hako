/**
 * Scène 3D de l'accueil (section BoxScene) : rendu WebGL, étiquettes,
 * image d'attente, modèle hako.glb, repli sur l'image fixe (animations
 * réduites, WebGL absent, panne), stabilité de la mise en page et absence
 * d'erreur dans la console.
 *
 * Le rendu WebGL utilise SwiftShader (rendu logiciel) : les tests passent
 * sans carte graphique, sur toutes les machines.
 */
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';
import sharp from 'sharp';

const SWIFTSHADER = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];
const NO_WEBGL = ['--disable-webgl', '--disable-3d-apis'];
const CREME = [0xfd, 0xf7, 0xef] as const;
/**
 * Repères du code de three.js, reconnus au contenu des fichiers (leurs noms
 * peuvent changer) : le cœur, puis le chargeur glTF et le décodeur meshopt.
 */
const THREE_CORE = /WebGLRenderer/;
const GLB_LOADERS = /GLTFLoader|meshopt/;
/** Milieu du palier « vue éclatée » (voir timeline.explode dans model.config.json). */
const EXPLODED = 0.64;
/** Box refermée, hors de la fenêtre des étiquettes (timeline.labels). */
const CLOSED_END = 0.95;

// Rendu logiciel pour tout le fichier ; le navigateur sans WebGL est lancé à part.
test.use({
  launchOptions: { args: SWIFTSHADER },
  viewport: { width: 1280, height: 800 },
});
// Rendu logiciel : plus lent qu'une vraie carte graphique.
test.describe.configure({ timeout: 120_000 });

interface ConsoleLog {
  readonly errors: string[];
  readonly warnings: string[];
}

function collectConsole(page: Page): ConsoleLog {
  const log: ConsoleLog = { errors: [], warnings: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') log.errors.push(message.text());
    if (message.type() === 'warning') log.warnings.push(message.text());
  });
  page.on('pageerror', (error) => log.errors.push(error.message));
  page.on('requestfailed', (request) => log.errors.push(`échec : ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) log.errors.push(`HTTP ${response.status()} : ${response.url()}`);
  });
  return log;
}

interface ScriptLog {
  readonly url: string;
  readonly body: Promise<string>;
}

/** Relève chaque fichier JavaScript reçu, avec son contenu. */
function collectScripts(page: Page): ScriptLog[] {
  const scripts: ScriptLog[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script') {
      scripts.push({ url: response.url(), body: response.text().catch(() => '') });
    }
  });
  return scripts;
}

async function scriptsMatching(scripts: ScriptLog[], marker: RegExp): Promise<string[]> {
  const bodies = await Promise.all(scripts.map((script) => script.body));
  return scripts.filter((_, index) => marker.test(bodies[index] ?? '')).map(({ url }) => url);
}

/** Fait défiler la page pour que le bas de la piste 3D soit `distance` px au-dessus de l'écran. */
async function scrollBelowTrack(page: Page, distance: number): Promise<void> {
  await page.evaluate((gap) => {
    const track = document.querySelector<HTMLElement>('[data-box-scene-track]');
    if (!track) throw new Error('Scène 3D absente');
    const bottom = track.getBoundingClientRect().bottom + window.scrollY;
    window.scrollTo({ top: bottom + gap, behavior: 'instant' });
  }, distance);
}

/** Fait défiler la page jusqu'à la progression p (0 à 1) de la piste 3D. */
async function scrollToProgress(page: Page, p: number): Promise<void> {
  await page.evaluate((progress) => {
    const track = document.querySelector<HTMLElement>('[data-box-scene-track]');
    const stage = document.querySelector<HTMLElement>('[data-box-scene-stage]');
    if (!track || !stage) throw new Error('Scène 3D absente');
    const top = track.getBoundingClientRect().top + window.scrollY;
    const sticky = parseFloat(getComputedStyle(stage).top) || 0;
    const y = top - sticky + progress * (track.offsetHeight - stage.offsetHeight);
    window.scrollTo({ top: y, behavior: 'instant' });
  }, p);
}

async function waitForSettled(page: Page, p: number): Promise<void> {
  await page.waitForFunction(
    (progress) => {
      const section = document.querySelector<HTMLElement>('[data-box-scene]');
      return (
        section?.dataset.settled === 'true' &&
        Math.abs(Number(section.dataset.progress) - progress) < 0.01
      );
    },
    p,
    { timeout: 60_000 },
  );
}

async function labelOpacities(page: Page): Promise<number[]> {
  return page
    .locator('[data-box-scene-label]')
    .evaluateAll((labels) => labels.map((label) => Number(getComputedStyle(label).opacity)));
}

/** Enregistre, image par image, l'opacité maximale des étiquettes. */
async function startLabelRecorder(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = window as unknown as { __labelPeak: number; __labelRecording: boolean };
    store.__labelPeak = 0;
    store.__labelRecording = true;
    const tick = () => {
      document.querySelectorAll<HTMLElement>('[data-box-scene-label]').forEach((label) => {
        store.__labelPeak = Math.max(store.__labelPeak, Number(label.style.opacity || 0));
      });
      if (store.__labelRecording) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function stopLabelRecorder(page: Page): Promise<number> {
  return page.evaluate(() => {
    const store = window as unknown as { __labelPeak: number; __labelRecording: boolean };
    store.__labelRecording = false;
    return store.__labelPeak;
  });
}

/** Le fondu d'apparition du canevas est terminé. */
async function waitForCanvasShown(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page
        .locator('[data-box-scene-canvas]')
        .evaluate((mount) => Number(getComputedStyle(mount).opacity)),
    )
    .toBe(1);
}

/** Part des pixels qui ne sont pas du fond crème. */
async function inkRatio(png: Parameters<typeof sharp>[0]): Promise<number> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let ink = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const distance =
      Math.abs((data[i] ?? 0) - CREME[0]) +
      Math.abs((data[i + 1] ?? 0) - CREME[1]) +
      Math.abs((data[i + 2] ?? 0) - CREME[2]);
    if (distance > 24) ink += 1;
  }
  return ink / (info.width * info.height);
}

/** Relève les décalages de mise en page (CLS) dès le début de chaque chargement. */
async function observeLayoutShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const store = window as unknown as { __cls: number };
    store.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & { value: number; hadRecentInput: boolean }
      >) {
        if (!entry.hadRecentInput) store.__cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

async function layoutShift(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __cls: number }).__cls);
}

/** La section est en mode image fixe : image chargée, liste visible, aucun canevas. */
async function expectStaticFallback(page: Page): Promise<void> {
  const section = page.locator('[data-box-scene]');
  await expect(section).toHaveAttribute('data-mode', 'fallback');
  await expect(section.locator('[data-box-scene-track]')).toBeHidden();
  await section.locator('.box-scene__figure').scrollIntoViewIfNeeded();
  const picture = section.locator('.box-scene__figure img, .box-scene__figure svg').first();
  await expect(picture).toBeVisible();
  await expect
    .poll(() =>
      picture.evaluate((element) =>
        element instanceof HTMLImageElement ? element.complete && element.naturalWidth > 0 : true,
      ),
    )
    .toBe(true);
  await expect(section.locator('.box-scene__list')).toBeVisible();
  await expect(section.locator('.box-scene__list > li')).toHaveCount(5);
  await expect(section.locator('canvas')).toHaveCount(0);
}

/** Sert un modèle d'essai à la place de /models/hako.glb, sans reconstruire le site. */
async function serveModel(page: Page, testInfo: TestInfo, fixture: string): Promise<void> {
  await page.route('**/models/hako.glb', (route) =>
    route.fulfill({
      path: `${testInfo.project.testDir}/fixtures/${fixture}`,
      contentType: 'model/gltf-binary',
    }),
  );
  // Comme si public/models/hako.glb avait existé à la construction.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const section = document.querySelector<HTMLElement>('[data-box-scene]');
      if (section) section.dataset.modelUrl = '/models/hako.glb';
    });
  });
}

test.describe('Scène 3D : rendu WebGL', () => {
  test('la box s’affiche, s’ouvre et ses étiquettes apparaissent', async ({ page }) => {
    const log = collectConsole(page);
    const scripts = collectScripts(page);
    await page.goto('/');
    const section = page.locator('[data-box-scene]');
    await expect(section).toHaveAttribute('data-mode', '3d');
    // La liste des pièces reste dans la page pour les lecteurs d'écran.
    await expect(section.locator('.box-scene__list > li')).toHaveCount(5);
    await expect(section.locator('.box-scene__figure')).toBeHidden();

    await scrollToProgress(page, EXPLODED);
    await expect(section).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
    await expect(section).toHaveAttribute('data-model-source', 'procedural');
    await waitForSettled(page, EXPLODED);
    await waitForCanvasShown(page);
    await expect(section.locator('.box-scene__poster')).toBeHidden();

    const canvas = section.locator('canvas');
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(await inkRatio(await canvas.screenshot())).toBeGreaterThan(0.04);

    const opacities = await labelOpacities(page);
    expect(opacities).toHaveLength(5);
    expect(opacities.every((opacity) => opacity > 0.95)).toBe(true);

    // Au début de la piste, la box est fermée et les étiquettes sont masquées.
    await scrollToProgress(page, 0.05);
    await waitForSettled(page, 0.05);
    expect((await labelOpacities(page)).every((opacity) => opacity === 0)).toBe(true);

    // three.js est chargé après l'événement load (le haut de page passe en premier).
    const [sceneChunk] = await scriptsMatching(scripts, THREE_CORE);
    expect(sceneChunk).toBeDefined();
    const timing = await page.evaluate((url) => {
      const navigation = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;
      const entry = performance.getEntriesByType('resource').find(({ name }) => name === url);
      return { load: navigation.loadEventStart, scene: entry?.startTime ?? -1 };
    }, sceneChunk);
    expect(timing.scene).toBeGreaterThanOrEqual(timing.load);
    // Sans hako.glb, ni le chargeur glTF ni le décodeur ne sont téléchargés.
    expect(await scriptsMatching(scripts, GLB_LOADERS)).toEqual([]);
    expect(log.errors).toEqual([]);
  });

  test('l’image d’attente occupe la scène pendant le téléchargement de three.js', async ({
    page,
  }) => {
    const log = collectConsole(page);
    let releaseScene: () => void = () => {};
    const sceneHeld = new Promise<void>((resolve) => (releaseScene = resolve));
    await page.route('**/_astro/*.js', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (THREE_CORE.test(body)) await sceneHeld;
      await route.fulfill({ response, body });
    });
    await page.goto('/');
    await scrollToProgress(page, 0.1);
    const section = page.locator('[data-box-scene]');
    await expect(section).toHaveAttribute('data-state', 'loading');
    const poster = section.locator('.box-scene__poster');
    await expect(poster).toBeVisible();
    await expect
      .poll(() => poster.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);

    releaseScene();
    await expect(section).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
    await expect(poster).toBeHidden();
    expect(log.errors).toEqual([]);
  });

  test('retour après un saut : la scène ne rejoue ni l’ouverture ni les étiquettes', async ({
    page,
  }) => {
    const log = collectConsole(page);
    await page.goto('/');
    await scrollToProgress(page, 0.05);
    const section = page.locator('[data-box-scene]');
    await expect(section).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
    await waitForSettled(page, 0.05);

    // Grand saut à l'intérieur de la piste : la box ne passe pas par la vue éclatée.
    await startLabelRecorder(page);
    await scrollToProgress(page, CLOSED_END);
    await waitForSettled(page, CLOSED_END);
    expect(await stopLabelRecorder(page)).toBe(0);

    // Saut sous la section (touche Fin), puis retour à la fin de la piste.
    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
    );
    await page.waitForTimeout(400);
    await startLabelRecorder(page);
    await scrollToProgress(page, CLOSED_END);
    await waitForSettled(page, CLOSED_END);
    await page.waitForTimeout(300);
    expect(await stopLabelRecorder(page)).toBe(0);
    expect(log.errors).toEqual([]);
  });

  test.describe('écran très dense', () => {
    test.use({ deviceScaleFactor: 3 });

    test('pause hors écran, densité de pixels plafonnée, libération au départ de la page', async ({
      page,
    }) => {
      await checkPauseDensityAndRelease(page);
    });
  });

  test('contexte WebGL perdu : la scène se remonte, puis l’image fixe prend le relais sans saut', async ({
    page,
  }) => {
    const log = collectConsole(page);
    await page.goto('/');
    await scrollToProgress(page, 0.5);
    const section = page.locator('[data-box-scene]');
    await expect(section).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
    const loseContext = () =>
      page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('[data-box-scene] canvas');
        canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
      });
    const layout = () =>
      page.evaluate(() => ({
        y: Math.round(window.scrollY),
        height: document.documentElement.scrollHeight,
      }));
    const initial = await layout();

    // Première perte : nouveau montage, au même endroit.
    await loseContext();
    await expect(section).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
    await expect(section.locator('canvas')).toHaveCount(1);
    expect(await layout()).toEqual(initial);

    // Seconde perte : image d'attente à l'écran, et la page ne bouge pas tant
    // que le visiteur regarde la section.
    await loseContext();
    await expect(section).toHaveAttribute('data-state', 'error');
    await expect(section.locator('.box-scene__poster')).toBeVisible();
    await page.waitForTimeout(500);
    expect(await layout()).toEqual(initial);
    await expect(section).toHaveAttribute('data-mode', '3d');

    // Section dépassée : elle passe en image fixe, et ce qui la suit ne bouge pas à l'écran.
    const nextTop = () =>
      page.evaluate(
        () =>
          document.querySelector('[data-box-scene]')?.nextElementSibling?.getBoundingClientRect()
            .top ?? Number.NaN,
      );
    const passed = await page.evaluate(() => {
      const track = document.querySelector<HTMLElement>('[data-box-scene-track]');
      const next = document.querySelector('[data-box-scene]')?.nextElementSibling;
      if (!track || !next) throw new Error('Scène 3D ou section suivante absente');
      const bottom = track.getBoundingClientRect().bottom + window.scrollY;
      window.scrollTo({ top: bottom + 120, behavior: 'instant' });
      // Mesures prises avant que le changement de mode ait pu se produire.
      return {
        trackBottom: track.getBoundingClientRect().bottom,
        nextTop: next.getBoundingClientRect().top,
      };
    });
    expect(passed.trackBottom).toBeLessThan(0);
    await expect(section).toHaveAttribute('data-mode', 'fallback');
    await page.waitForTimeout(200);
    expect(Math.abs((await nextTop()) - passed.nextTop)).toBeLessThan(1);
    expect(log.errors).toEqual([]);
  });
});

/** Pause hors écran, plafond de densité de pixels, libération au départ de la page. */
async function checkPauseDensityAndRelease(page: Page): Promise<void> {
  const log = collectConsole(page);
  await page.addInitScript(() => {
    const store = window as unknown as { __draws: number };
    store.__draws = 0;
    const clear = WebGL2RenderingContext.prototype.clear;
    WebGL2RenderingContext.prototype.clear = function (mask: number) {
      store.__draws += 1;
      clear.call(this, mask);
    };
  });
  await page.goto('/');
  await scrollToProgress(page, EXPLODED);
  const section = page.locator('[data-box-scene]');
  await expect(section).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
  await waitForSettled(page, EXPLODED);

  // Ordinateur : 2 pixels par pixel CSS au plus, même sur un écran plus dense.
  const density = await section
    .locator('canvas')
    .evaluate((canvas: HTMLCanvasElement) => canvas.width / canvas.clientWidth);
  expect(density).toBeCloseTo(2, 1);

  // Section loin de l'écran (haut de la page) : dès que la scène le sait
  // (data-in-view, posé après une dernière image calée sur le défilement),
  // plus aucune image n'est dessinée. Ce moment dépend de la vitesse du rendu :
  // en rendu logiciel, à densité 3, avec la trace et d'autres tests en
  // parallèle, la première image après le saut arrive parfois une seconde
  // plus tard. Un délai fixe compterait donc ces deux dernières images.
  await expect(section).toHaveAttribute('data-in-view', 'true');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(section).toHaveAttribute('data-in-view', 'false', { timeout: 15_000 });
  const draws = () => page.evaluate(() => (window as unknown as { __draws: number }).__draws);
  const before = await draws();
  await page.waitForTimeout(1000);
  expect((await draws()) - before).toBe(0);

  // Départ de la page : le canevas est libéré ; retour par l'historique : la scène revient.
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
  );
  await expect(section.locator('canvas')).toHaveCount(0);
  await expect(section).toHaveAttribute('data-state', 'idle');
  await scrollToProgress(page, 0.2);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await expect(section).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
  await expect(section.locator('canvas')).toHaveCount(1);
  expect(log.errors).toEqual([]);
}

test.describe('Scène 3D : stabilité de la mise en page', () => {
  test('aucun décalage, du chargement à la fin du défilement', async ({ page }) => {
    const log = collectConsole(page);
    await observeLayoutShifts(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 250) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(500);
    const cls = await layoutShift(page);
    test.info().annotations.push({ type: 'CLS', description: cls.toFixed(4) });
    expect(cls).toBeLessThan(0.01);
    expect(log.errors).toEqual([]);
  });

  for (const where of ['au milieu de la piste', 'sous la section'] as const) {
    test(`aucun décalage au rechargement ${where}`, async ({ page }) => {
      const log = collectConsole(page);
      await observeLayoutShifts(page);
      await page.goto('/');
      await page.waitForLoadState('load');
      if (where === 'sous la section') await scrollBelowTrack(page, 200);
      else await scrollToProgress(page, 0.4);
      await page.waitForTimeout(400);
      const before = await page.evaluate(() => Math.round(window.scrollY));

      await page.reload();
      await page.waitForLoadState('load');
      await page.waitForTimeout(1500);
      const cls = await layoutShift(page);
      test.info().annotations.push({ type: 'CLS', description: cls.toFixed(4) });
      expect(cls).toBeLessThan(0.01);
      // Le navigateur a bien retrouvé la position, sur la même mise en page.
      expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(2);
      await expect(page.locator('[data-box-scene]')).toHaveAttribute('data-mode', '3d');
      expect(log.errors).toEqual([]);
    });
  }
});

test.describe('Scène 3D : place sous l’en-tête', () => {
  test('l’en-tête mesure exactement --header-height, la scène se colle juste dessous', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('[data-box-scene]')).toHaveAttribute('data-mode', '3d');
    await page.evaluate(() => document.fonts.ready);
    for (const width of [320, 360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      // Informations manquantes surlignées ou discrètes (PUBLIC_SHOW_TODOS).
      for (const todos of ['visible', 'discreet'] as const) {
        const sizes = await page.evaluate((mode) => {
          document.documentElement.dataset.todos = mode;
          window.scrollTo({ top: 0, behavior: 'instant' });
          const header = document.querySelector<HTMLElement>('header.site-header');
          const stage = document.querySelector<HTMLElement>('[data-box-scene-stage]');
          const toggle = header?.querySelector<HTMLElement>('button.menu-toggle');
          if (!header || !stage) throw new Error('En-tête ou scène 3D absente');
          const probe = document.createElement('div');
          probe.style.blockSize = 'var(--header-height)';
          document.body.append(probe);
          const token = probe.getBoundingClientRect().height;
          probe.remove();
          return {
            header: header.getBoundingClientRect().height,
            token,
            stageTop: parseFloat(getComputedStyle(stage).top),
            menuOpen: toggle?.getAttribute('aria-expanded') === 'true',
          };
        }, todos);
        const where = `${width} px, TODO ${todos}`;
        expect(sizes.menuOpen, `${where} : menu fermé`).toBe(false);
        expect(sizes.header, `${where} : hauteur de l’en-tête`).toBeCloseTo(sizes.token, 1);
        expect(sizes.stageTop, `${where} : haut de la scène collante`).toBeCloseTo(sizes.token, 1);
      }
      // Dans la piste, la scène collante commence au bord bas de l'en-tête.
      await scrollToProgress(page, 0.3);
      const edges = await page.evaluate(() => ({
        headerBottom:
          document.querySelector('header.site-header')?.getBoundingClientRect().bottom ?? NaN,
        stageTop:
          document.querySelector('[data-box-scene-stage]')?.getBoundingClientRect().top ?? NaN,
      }));
      expect(edges.stageTop, `${width} px : scène collée sous l’en-tête`).toBeCloseTo(
        edges.headerBottom,
        1,
      );
    }
  });
});

test.describe('Scène 3D : modèle hako.glb', () => {
  test('modèle conforme : chargé, vérifié et affiché', async ({ page }, testInfo) => {
    const log = collectConsole(page);
    const scripts = collectScripts(page);
    await serveModel(page, testInfo, 'hako-test.glb');
    await page.goto('/');
    await scrollToProgress(page, EXPLODED);
    const section = page.locator('[data-box-scene]');
    await expect(section).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
    await expect(section).toHaveAttribute('data-model-source', 'glb');
    await waitForSettled(page, EXPLODED);
    await waitForCanvasShown(page);
    expect(await inkRatio(await section.locator('canvas').screenshot())).toBeGreaterThan(0.02);
    expect((await labelOpacities(page)).every((opacity) => opacity > 0.95)).toBe(true);
    expect(await scriptsMatching(scripts, GLB_LOADERS)).not.toEqual([]);
    expect(log.warnings.filter((text) => text.includes('hako.glb'))).toEqual([]);
    expect(log.errors).toEqual([]);
  });

  test('modèle non conforme : un avertissement, puis le modèle provisoire', async ({
    page,
  }, testInfo) => {
    const log = collectConsole(page);
    await serveModel(page, testInfo, 'hako-test-mauvais.glb');
    await page.goto('/');
    await scrollToProgress(page, EXPLODED);
    const section = page.locator('[data-box-scene]');
    await expect(section).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
    await expect(section).toHaveAttribute('data-model-source', 'procedural');
    await waitForSettled(page, EXPLODED);
    expect(log.warnings.filter((text) => text.includes('hako.glb'))).toHaveLength(1);
    expect(log.errors).toEqual([]);
  });
});

test.describe('Scène 3D : animations réduites', () => {
  test.use({ reducedMotion: 'reduce' });

  test('image fixe et liste visibles, three.js jamais téléchargé', async ({ page }) => {
    const log = collectConsole(page);
    const scripts = collectScripts(page);
    await page.goto('/');
    await expect(page.locator('[data-box-scene]')).toHaveAttribute(
      'data-fallback-reason',
      'reduced-motion',
    );
    await expectStaticFallback(page);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
    );
    await page.waitForTimeout(500);
    expect(await scriptsMatching(scripts, THREE_CORE)).toEqual([]);
    expect(await scriptsMatching(scripts, GLB_LOADERS)).toEqual([]);
    expect(log.errors).toEqual([]);
  });
});

test.describe('Scène 3D : navigateur sans WebGL', () => {
  // Navigateur lancé à part, WebGL coupé : Playwright refuse des options de
  // lancement propres à un groupe de tests. Le lanceur de tests le suit comme
  // les autres (trace et capture d'écran en cas d'échec, selon
  // playwright.config.ts) : il démarre lui-même la trace de ce contexte et
  // l'enregistre quand le contexte se ferme. Le contexte est donc fermé avant
  // le navigateur, ce que browser.close() seul ne fait pas.
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  test.afterEach(async () => {
    const testInfo = test.info();
    const page = context?.pages()[0];
    // En cas d'échec, la page entière en plus : la section est sous l'écran.
    if (page && testInfo.status !== testInfo.expectedStatus) {
      const capture = await page.screenshot({ fullPage: true }).catch(() => null);
      if (capture) {
        await testInfo.attach('page entière', { body: capture, contentType: 'image/png' });
      }
    }
    await context?.close();
    await browser?.close();
    context = null;
    browser = null;
  });

  test('image fixe et liste visibles, three.js jamais téléchargé', async ({
    playwright,
    baseURL,
  }) => {
    browser = await playwright.chromium.launch({ args: NO_WEBGL });
    context = await browser.newContext({
      ...(baseURL ? { baseURL } : {}),
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    const log = collectConsole(page);
    const scripts = collectScripts(page);
    await page.goto('/');
    await expect(page.locator('[data-box-scene]')).toHaveAttribute(
      'data-fallback-reason',
      'no-webgl',
    );
    await expectStaticFallback(page);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
    );
    await page.waitForTimeout(500);
    expect(await scriptsMatching(scripts, THREE_CORE)).toEqual([]);
    expect(await scriptsMatching(scripts, GLB_LOADERS)).toEqual([]);
    expect(log.errors).toEqual([]);
  });
});
