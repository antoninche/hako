/**
 * robots.txt : les moteurs de recherche peuvent explorer tout le site.
 *
 * Quand l'adresse du site est connue (SITE_URL, voir astro.config.mjs), le
 * fichier indique aussi l'adresse du plan du site (sitemap.xml). Les pages à
 * ne pas indexer (charte graphique, page 404) le disent elles-mêmes, avec
 * <meta name="robots" content="noindex"> : elles ne sont pas bloquées ici,
 * sinon les moteurs ne pourraient pas lire cette consigne.
 *
 * Les moteurs ne lisent robots.txt qu'à la racine d'un nom de domaine : dans
 * un sous-dossier (aperçu sur GitHub Pages), ce fichier est ignoré.
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const lines = ['User-agent: *', 'Allow: /'];
  if (site) lines.push('', `Sitemap: ${new URL('/sitemap.xml', site).href}`);
  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
