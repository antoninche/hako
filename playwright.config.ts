/**
 * Configuration de Playwright : les tests visitent la version de production
 * (astro build puis astro preview), dans Chromium.
 *
 * Par défaut, le site est construit dans dist/ et servi sur le port 4321.
 * Pour un essai isolé (sans toucher au dist/ partagé) :
 *   PW_OUT_DIR=.tmp/dist-essai PW_PORT=4410 npx playwright test
 * Les autres réglages (captures, dossiers) sont décrits dans tests/support/settings.mjs.
 */

import { defineConfig, devices } from '@playwright/test';

import { DESKTOP } from './tests/routes';
import { baseURL, isCI, resultsDir, webServerCommand } from './tests/support/settings.mjs';

export default defineConfig({
  testDir: './tests',
  // Les tests unitaires (node --test, npm run test:unit) ne sont pas pour Playwright.
  testIgnore: ['**/unit/**'],
  outputDir: resultsDir,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  ...(isCI ? { workers: 2 } : {}),
  timeout: 45_000,
  expect: { timeout: 5_000 },
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { ...DESKTOP } },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: `${baseURL}/`,
    // En local, un serveur déjà lancé sur ce port est réutilisé tel quel
    // (sans reconstruire) ; en intégration continue, jamais.
    reuseExistingServer: !isCI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
