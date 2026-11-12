// Configuration ESLint (format « flat », ESLint 10).
// Ordre : règles JavaScript, TypeScript, Astro, accessibilité (jsx-a11y,
// niveau strict, appliqué aux composants .astro), puis eslint-config-prettier
// en dernier pour couper les règles de mise en forme, laissées à Prettier.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '.astro/',
    '.tmp/',
    'blob-report/',
    'dist/',
    'node_modules/',
    'playwright-report/',
    'public/',
    'qa/',
    'test-results/',
    // Jeux d'essai des scripts : volontairement fautifs.
    'tests/fixtures/',
  ]),

  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  // Règles jsx-a11y adaptées à Astro ; le module eslint-plugin-jsx-a11y-x
  // (compatible ESLint 10) est chargé par eslint-plugin-astro.
  astro.configs['jsx-a11y-strict'],

  {
    // Outils, configuration et tests : exécutés par Node.
    files: ['*.{js,mjs,cjs,ts}', 'scripts/**/*.{js,mjs,cjs,ts}', 'tests/**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Scripts du site : exécutés par le navigateur.
    files: ['src/**/*.{js,mjs,ts}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  prettier,
]);
