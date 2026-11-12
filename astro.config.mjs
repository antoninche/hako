// @ts-check
import { defineConfig, envField } from 'astro/config';
import { loadEnv } from 'vite';

// Adresse publique du site, donnée par la variable SITE_URL : dans le terminal
// (SITE_URL=https://exemple.fr npm run build) ou dans le fichier .env.
// Astro lit ce fichier de configuration avant .env : loadEnv (outil de Vite,
// recommandé par la documentation d'Astro) va donc lire .env lui-même.
// Le nom de domaine n'est pas encore choisi : sans SITE_URL, Astro ne connaît
// pas l'adresse du site et les pages ne déclarent aucune adresse canonique
// (mieux qu'une adresse fausse comme http://localhost:4321, qui partirait en
// ligne avec le site).
const { SITE_URL } = loadEnv('production', '.', 'SITE_');

export default defineConfig({
  ...(SITE_URL ? { site: SITE_URL } : {}),
  output: 'static',
  // Toutes les adresses finissent par « / » (ex. /offres/) : chaque page est un
  // dossier avec son index.html, ce que tout hébergeur statique sait servir.
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Aucune feuille de style en ligne : compatible avec une CSP « self » stricte.
    inlineStylesheets: 'never',
  },
  // La barre d'outils de développement d'Astro n'apporte rien ici.
  devToolbar: { enabled: false },
  // Pas de préchargement spéculatif de pages.
  prefetch: false,
  env: {
    schema: {
      // true : les informations manquantes s'affichent surlignées en jaune.
      // false : le texte provisoire reste, sans surlignage.
      PUBLIC_SHOW_TODOS: envField.boolean({
        context: 'client',
        access: 'public',
        default: true,
      }),
    },
  },
  vite: {
    build: {
      // Aucun script ni fichier en ligne (data: URI) : tout part dans /_astro/.
      assetsInlineLimit: 0,
    },
  },
});
