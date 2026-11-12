/**
 * Fichiers du logo (src/assets/brand/hako-<variante>.svg), chargés une fois
 * pour toutes et utilisés par <Logo> et par la charte graphique.
 *
 * Le cadre (viewBox) de chaque fichier est serré autour du dessin, sauf pour
 * « reseaux », qui garde la marge voulue pour les avatars. C'est
 * `npm run logo:build` qui le calcule (voir docs/logo.md) : une hauteur donnée
 * en CSS est donc la hauteur du dessin lui-même.
 */
import type { SvgComponent } from 'astro/types';

export type LogoVariant = 'paysage' | 'carre' | 'reseaux' | 'kanji' | 'mot';

/** Les cinq variantes, dans l'ordre de présentation de la charte. */
export const LOGO_VARIANTS: readonly LogoVariant[] = [
  'paysage',
  'carre',
  'reseaux',
  'kanji',
  'mot',
];

const components = import.meta.glob<{ default: SvgComponent }>('../assets/brand/hako-*.svg', {
  eager: true,
});

/** Le logo d'une variante, ou undefined si le fichier n'existe pas. */
export function logoFile(variant: LogoVariant): SvgComponent | undefined {
  return components[`../assets/brand/hako-${variant}.svg`]?.default;
}
