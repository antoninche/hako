/**
 * Plan du site pour les moteurs de recherche (sitemap.xml) : l'adresse
 * complète de chaque page publique à indexer, dans l'ordre de
 * src/data/navigation.ts (routes). La charte graphique (/charte/) et la page
 * 404 n'y figurent pas : elles ne sont pas indexées (noindex).
 *
 * Une page ajoutée au site s'ajoute à routes : tests/builds.spec.ts vérifie
 * que le plan liste exactement les pages qui ont une adresse canonique.
 *
 * Sans adresse du site (SITE_URL, voir astro.config.mjs), aucune adresse
 * complète n'est possible : la réponse est vide (404) et Astro n'écrit pas le
 * fichier. La construction le signale par un avertissement « Skipped writing
 * /sitemap.xml », attendu dans ce cas.
 */
import type { APIRoute } from 'astro';

import { routes } from '../data/navigation';

/** Caractères réservés du XML, écrits en entités. */
const escapeXml = (text: string): string =>
  text.replace(/[<>&'"]/g, (character) => `&#${character.charCodeAt(0)};`);

export const GET: APIRoute = ({ site }) => {
  if (!site) return new Response(null, { status: 404 });
  const urls = Object.values(routes).map(
    (path) => `  <url><loc>${escapeXml(new URL(path, site).href)}</loc></url>`,
  );
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
