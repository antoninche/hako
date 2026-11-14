// @ts-check
// Configuration de la page de la HAKO pour sa première installation, servie
// par la HAKO elle-même : une seule page, construite à part du site public
// par `npm run build:box` (scripts/box/build.mjs), qui prépare ses dossiers.
// Ne pas lancer `astro build` seul avec ce fichier : le script prépare les
// fichiers statiques et contrôle le résultat.
//
// - Source : box/pages/index.astro, avec les composants du site (src/).
// - Racine d'Astro dans .tmp/box/ : ses fichiers de travail (.astro/, cache)
//   ne touchent jamais ceux du site public.
// - Fichiers statiques : la copie préparée dans .tmp/box/public/ (polices,
//   icônes de l'onglet, licence des icônes), pas tout public/.
// - SITE_URL : adresse du site public, devant les liens de la page (guide,
//   questions fréquentes, contact). Obligatoire, en https.
// - Sortie : dist-box/ par défaut (BOX_OUT_DIR pour une autre, dans les tests).
import { defineConfig, envField } from 'astro/config';
import { loadEnv } from 'vite';

const { SITE_URL } = loadEnv('production', '.', 'SITE_');
const site = (process.env.SITE_URL ?? SITE_URL ?? '').trim();
if (!/^https:\/\/[^/?#\s]+(?:\/[^?#\s]*)?$/u.test(site)) {
  throw new Error(
    'Page de la HAKO : SITE_URL manquante ou invalide. Donnez l’adresse du site public, en https, par exemple SITE_URL=https://exemple.fr npm run build:box',
  );
}

const work = process.env.BOX_WORK_DIR ?? '.tmp/box';

export default defineConfig({
  root: work,
  srcDir: 'box',
  publicDir: `${work}/public`,
  outDir: process.env.BOX_OUT_DIR ?? 'dist-box',
  cacheDir: `${work}/cache`,
  site: site.replace(/\/+$/u, ''),
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Aucune feuille de style en ligne : compatible avec la CSP de la HAKO.
    inlineStylesheets: 'never',
  },
  devToolbar: { enabled: false },
  prefetch: false,
  markdown: { syntaxHighlight: false },
  env: {
    schema: {
      PUBLIC_SHOW_TODOS: envField.boolean({
        context: 'client',
        access: 'public',
        default: false,
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
