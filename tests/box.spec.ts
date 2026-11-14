/**
 * La page de la HAKO elle-même (npm run build:box), construite dans
 * .tmp/tests/dist-box/ puis servie comme sur la HAKO : avec ses en-têtes
 * (BOX_PAGE_HEADERS) et une API locale simulée qui suit le contrat
 * (docs/page-box.md). Aucune requête ne quitte la machine.
 *
 * - Construction : une seule page, en français, non indexée, sans référent,
 *   l'adresse du site public (SITE_URL) devant ses liens ; rien de la
 *   démonstration.
 * - Parcours complet sous la CSP de la HAKO : ni violation ni erreur, des
 *   requêtes vers la page elle-même seulement, le jeton de session en
 *   en-tête une fois reçu, la création des comptes suivie jusqu'à la fin, les
 *   liens vers le site dans un nouvel onglet ; confirmation avant de quitter
 *   tant que des mots de passe sont affichés.
 * - Cas difficiles (décisions du lot 5) : installation en cours ailleurs, la
 *   fiche qui donne la main, « Recommencer » refusé, page rouverte pendant la
 *   création, coupure de courant (nouveaux mots de passe).
 *
 * Les tests de ce fichier se suivent : une seule construction, au début.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { MIME_TYPES } from '../scripts/serve-prod.mjs';
import { assistant } from '../src/content/assistant';
import { LOGIN_DOMAIN } from '../src/data/assistant';
import {
  BOX_PAGE_HEADERS,
  MAX_WRONG_CHECKS,
  TASK_IDS,
  type BoxPhase,
  type CreationProgress,
} from '../src/lib/assistant/box-access';
import { assignLogins } from '../src/lib/assistant/household';
import { readRepoFile, repoPath } from './support/node-tools.mjs';

const OUT = '.tmp/tests/dist-box';
const SITE = 'https://exemple.fr';
const PASSWORDS = [
  'tulipe-melon-givre-sapin-42',
  'cerise-tambour-nuage-plume-17',
  'orange-bateau-moulin-pomme-63',
];
/** Mots de passe d'une installation commencée « ailleurs ». */
const OTHER_OWNER_PASSWORD = 'prune-castor-jardin-olive-28';

const { common, screens, states } = assistant;

test.describe.configure({ mode: 'serial', timeout: 60_000 });

test.beforeAll(() => {
  test.setTimeout(180_000);
  const build = spawnSync(process.execPath, [repoPath('scripts/box/build.mjs')], {
    cwd: repoPath('.'),
    encoding: 'utf8',
    env: {
      ...process.env,
      SITE_URL: SITE,
      BOX_OUT_DIR: OUT,
      BOX_WORK_DIR: '.tmp/tests/box',
    },
  });
  expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
});

/* ---------- La HAKO simulée : sa page, ses en-têtes, son API ---------- */

interface Call {
  readonly method: string;
  readonly path: string;
  readonly session: string | null;
  readonly body: unknown;
}

/** État de la HAKO simulée, réglable avant chaque test. */
class FakeBox {
  phase: BoxPhase = 'ready';
  /** Jeton de la session en cours (l'appareil qui a la main). */
  token: string | null = null;
  /** La session de l'autre appareil vit encore : « Recommencer » est refusé. */
  locked = false;
  ownerPassword: string | null = null;
  progress: CreationProgress = { photos: 'waiting', files: 'waiting', finish: 'waiting' };
  wrong = 0;
  /** Coupure de courant à la prochaine demande d'état pendant la création. */
  powerCut = false;
  readonly calls: Call[] = [];

  /** Une installation commencée sur un autre appareil. */
  startedElsewhere(phase: 'registered' | 'creating', locked: boolean): void {
    this.phase = phase;
    this.token = randomBytes(32).toString('hex');
    this.locked = locked;
    this.ownerPassword = OTHER_OWNER_PASSWORD;
    if (phase === 'creating')
      this.progress = { photos: 'done', files: 'running', finish: 'waiting' };
  }

  status(session: string | null): { status: number; body: unknown } {
    if (this.phase === 'creating') {
      if (this.powerCut) {
        // La HAKO redémarre : mots de passe et session oubliés.
        this.powerCut = false;
        Object.assign(this, { phase: 'ready', token: null, ownerPassword: null, locked: false });
      } else {
        this.advance();
      }
    }
    const busy =
      (this.phase === 'registered' || this.phase === 'creating') && session !== this.token;
    const body: Record<string, unknown> = { phase: this.phase, busy };
    if (this.phase === 'creating') body['progress'] = this.progress;
    return { status: 200, body };
  }

  /** Une ligne de plus à chaque demande d'état ; installée à la fin. */
  advance(): void {
    const next = TASK_IDS.find((task) => this.progress[task] !== 'done');
    if (!next) {
      Object.assign(this, { phase: 'installed', token: null, ownerPassword: null });
      return;
    }
    const state = this.progress[next] === 'waiting' ? 'running' : 'done';
    this.progress = { ...this.progress, [next]: state };
  }

  handle(method: string, route: string, session: string | null, body: unknown) {
    this.calls.push({ method, path: route, session, body });
    const data = (body ?? {}) as Record<string, unknown>;
    if (method === 'GET' && route === 'status') return this.status(session);
    if (method !== 'POST') return { status: 405, body: { error: 'method' } };
    switch (route) {
      case 'register': {
        if (this.phase === 'creating' || this.phase === 'installed') {
          return { status: 409, body: { error: 'wrong_phase' } };
        }
        if (this.locked && session !== this.token) return { status: 409, body: { error: 'busy' } };
        const names = data['firstNames'] as string[];
        const logins = assignLogins(names, LOGIN_DOMAIN);
        this.token = randomBytes(32).toString('hex');
        this.locked = true;
        this.phase = 'registered';
        this.ownerPassword = PASSWORDS[0] ?? '';
        this.wrong = 0;
        this.progress = { photos: 'waiting', files: 'waiting', finish: 'waiting' };
        return {
          status: 201,
          body: {
            token: this.token,
            accounts: names.map((firstName, index) => ({
              firstName,
              login: logins[index],
              owner: index === 0,
              password: PASSWORDS[index],
            })),
          },
        };
      }
      case 'check': {
        if (this.phase !== 'registered') return { status: 409, body: { error: 'wrong_phase' } };
        if (this.wrong >= MAX_WRONG_CHECKS)
          return { status: 423, body: { error: 'too_many_wrong' } };
        if (data['typed'] !== this.ownerPassword) {
          this.wrong += 1;
          return { status: 200, body: { result: 'wrong' } };
        }
        if (session === this.token) return { status: 200, body: { result: 'ok' } };
        // La fiche sert de preuve : cet appareil prend la main.
        this.token = randomBytes(32).toString('hex');
        return { status: 200, body: { result: 'ok', token: this.token } };
      }
      case 'accounts':
        if (session !== this.token) return { status: 401, body: { error: 'no_session' } };
        if (this.phase !== 'registered') return { status: 409, body: { error: 'wrong_phase' } };
        this.phase = 'creating';
        this.progress = { photos: 'running', files: 'waiting', finish: 'waiting' };
        return { status: 202, body: { progress: this.progress } };
      default:
        return { status: 404, body: { error: 'route' } };
    }
  }
}

/** Sert la page construite avec les en-têtes de la HAKO, et l'API simulée. */
async function serveBox(box: FakeBox): Promise<{ url: string; close: () => Promise<void> }> {
  const root = repoPath(OUT);
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://hako.test');
    const send = (status: number, type: string, payload: string | Buffer): void => {
      response.writeHead(status, { ...BOX_PAGE_HEADERS, 'Content-Type': type });
      response.end(payload);
    };
    if (url.pathname.startsWith('/api/installation/')) {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const reply = box.handle(
          request.method ?? 'GET',
          url.pathname.slice('/api/installation/'.length),
          (request.headers['x-hako-session'] as string | undefined) ?? null,
          text ? JSON.parse(text) : undefined,
        );
        send(reply.status, 'application/json', JSON.stringify(reply.body));
      });
      return;
    }
    const file = path.join(
      root,
      url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname,
    );
    if (!file.startsWith(root)) return send(403, 'text/plain', 'interdit');
    try {
      const type =
        (MIME_TYPES as Record<string, string>)[path.extname(file)] ?? 'application/octet-stream';
      send(200, type, readFileSync(file));
    } catch {
      send(404, 'text/plain', 'introuvable');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}

/* ---------- Gestes ---------- */

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const title = (page: Page, slug: string) => page.locator(`#ecran-${slug}-titre`);

/** Ouvre la page de la HAKO ; note les violations de CSP, erreurs et adresses demandées. */
async function openBox(
  page: Page,
  url: string,
): Promise<{ problems: () => Promise<string[]>; requests: string[] }> {
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
  const requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => requests.push(request.url()));
  await page.goto(`${url}/`);
  await expect(page.locator('[data-assistant]')).toHaveAttribute('data-ready', 'true');
  return {
    requests,
    problems: async () => [
      ...errors,
      ...(await page.evaluate(
        () => (window as unknown as { __violationsCsp: string[] }).__violationsCsp,
      )),
    ],
  };
}

/** Accueil → prénoms → mots de passe. */
async function toPasswords(page: Page, names: readonly string[]): Promise<void> {
  await button(page, screens.welcome.start).click();
  for (const [index, name] of names.entries()) {
    if (index > 0) await button(page, screens.people.add).click();
    await page.locator('[data-person-input]').nth(index).fill(name);
  }
  await button(page, screens.people.next).click();
  await expect(title(page, 'mots-de-passe')).toBeFocused();
}

/** Mots de passe → fiche → vérification → « Créer les comptes » → « C'est prêt ». */
async function toReady(page: Page, ownerPassword = PASSWORDS[0] ?? ''): Promise<void> {
  await button(page, screens.passwords.next).click();
  await button(page, screens.sheet.next).click();
  await page.locator('[data-check-input]').fill(ownerPassword);
  await button(page, screens.check.submit).click();
  await button(page, screens.check.create).click();
  await expect(title(page, 'comptes')).toBeFocused();
  await expect(title(page, 'pret')).toBeFocused({ timeout: 20_000 });
}

/* ---------- Tests ---------- */

test('construction : une page, en français, non indexée, sans rien de la démonstration', () => {
  const html = readRepoFile(`${OUT}/index.html`);
  expect(html).toMatch(/<html lang="fr"/);
  expect(html).toMatch(/<meta name="robots" content="noindex/);
  expect(html).toMatch(/<meta name="referrer" content="no-referrer"/);
  expect(html).toContain('data-mode="box"');
  expect(html).toContain(`data-site-url="${SITE}"`);
  expect(html).not.toMatch(/data-demo-banner|exemple-[a-z]+-[a-z]+/);
  // Le contenu dans <main>, sans l'en-tête ni le pied de page du site.
  expect(html).toMatch(/<main id="contenu"[^>]*>[\s\S]*data-assistant[\s\S]*<\/main>/);
  expect(html).not.toMatch(/class="site-header"|class="site-footer"/);
});

test('parcours complet sous les en-têtes de la HAKO', async ({ page, context }) => {
  const box = new FakeBox();
  const server = await serveBox(box);
  try {
    const { problems, requests } = await openBox(page, server.url);
    await toPasswords(page, ['Hélène', 'Marc']);
    await expect(page.locator('[data-accounts] [data-password]').first()).toHaveText(
      PASSWORDS[0] ?? '',
    );

    // Les liens vers le site : son adresse complète, dans un nouvel onglet.
    const help = page.locator('.hako-page__help a').first();
    await expect(help).toHaveAttribute('href', new RegExp(`^${SITE}/`));
    await expect(help).toHaveAttribute('target', '_blank');
    await expect(help).toContainText(common.newTab);

    await toReady(page);
    expect(await problems(), 'violations de CSP ou erreurs').toEqual([]);
    expect(requests.filter((url) => !url.startsWith(server.url))).toEqual([]);
    // Le jeton de session, une fois reçu, accompagne chaque demande.
    const register = box.calls.findIndex((call) => call.path === 'register');
    expect(box.calls[register]?.session).toBeNull();
    for (const call of box.calls.slice(register + 1, -1)) expect(call.session).not.toBeNull();
    expect(box.calls.filter((call) => call.path === 'status').length).toBeGreaterThan(3);
    expect(await context.cookies()).toEqual([]);
  } finally {
    await server.close();
  }
});

test('confirmation avant de quitter, tant que des mots de passe sont affichés', async ({
  page,
}) => {
  const server = await serveBox(new FakeBox());
  try {
    await openBox(page, server.url);
    await toPasswords(page, ['Hélène']);
    const dialog = page.waitForEvent('dialog');
    void page.close({ runBeforeUnload: true });
    const shown = await dialog;
    expect(shown.type()).toBe('beforeunload');
    await shown.dismiss();
  } finally {
    await server.close();
  }
});

test('installation en cours ailleurs : la fiche donne la main', async ({ page }) => {
  const box = new FakeBox();
  box.startedElsewhere('registered', true);
  const server = await serveBox(box);
  try {
    const { problems } = await openBox(page, server.url);
    await expect(title(page, 'installation-en-cours')).toBeFocused();
    await expect(page.locator('[data-accounts] [data-password]')).toHaveCount(0);
    const field = page.getByLabel(states.elsewhere.field.label);
    await field.fill('prune-castor-jardin-olive-29');
    await button(page, screens.check.submit).click();
    await expect(page.locator('[data-resume-error]')).toContainText(states.elsewhere.errors.wrong);
    await field.fill(OTHER_OWNER_PASSWORD);
    await button(page, screens.check.submit).click();
    await expect(page.locator('[data-resume-success]')).toBeVisible();
    await button(page, screens.check.create).click();
    await expect(title(page, 'pret')).toBeFocused({ timeout: 20_000 });
    expect(await problems()).toEqual([]);
  } finally {
    await server.close();
  }
});

test('installation en cours ailleurs : « Recommencer » refusé tant que l’autre a la main', async ({
  page,
}) => {
  const box = new FakeBox();
  box.startedElsewhere('registered', true);
  const server = await serveBox(box);
  try {
    await openBox(page, server.url);
    await button(page, states.elsewhere.restart).click();
    await page.locator('[data-person-input]').first().fill('Léa');
    await button(page, screens.people.next).click();
    await expect(title(page, 'installation-en-cours')).toBeFocused();
    await expect(page.locator('[data-resume-refused]')).toBeVisible();
    // L'autre session tombe (2 minutes sans signe de vie, ou HAKO redémarrée) : on recommence.
    box.locked = false;
    await button(page, states.elsewhere.restart).click();
    await page.locator('[data-person-input]').first().fill('Léa');
    await button(page, screens.people.next).click();
    await expect(title(page, 'mots-de-passe')).toBeFocused();
    await expect(page.locator('[data-passwords-renewed]')).toBeVisible();
  } finally {
    await server.close();
  }
});

test('page rouverte pendant la création : elle en montre la fin', async ({ page }) => {
  const box = new FakeBox();
  box.startedElsewhere('creating', true);
  const server = await serveBox(box);
  try {
    await openBox(page, server.url);
    await expect(title(page, 'comptes')).toBeFocused();
    await expect(title(page, 'pret')).toBeFocused({ timeout: 20_000 });
  } finally {
    await server.close();
  }
});

test('coupure de courant pendant la création : nouveaux mots de passe, nouvelle fiche', async ({
  page,
}) => {
  const box = new FakeBox();
  const server = await serveBox(box);
  try {
    await openBox(page, server.url);
    await toPasswords(page, ['Hélène', 'Marc']);
    await button(page, screens.passwords.next).click();
    await button(page, screens.sheet.next).click();
    await page.locator('[data-check-input]').fill(PASSWORDS[0] ?? '');
    await button(page, screens.check.submit).click();
    box.powerCut = true;
    await button(page, screens.check.create).click();
    await expect(title(page, 'creation-arretee')).toBeFocused({ timeout: 20_000 });
    await button(page, states.stopped.action ?? '').click();
    await expect(title(page, 'mots-de-passe')).toBeFocused();
    await expect(page.locator('[data-passwords-renewed]')).toBeVisible();
    await expect(page.locator('[data-accounts] [data-first-name]')).toHaveText(['Hélène', 'Marc']);
    await toReady(page);
  } finally {
    await server.close();
  }
});
