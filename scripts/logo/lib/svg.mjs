// Écriture et optimisation (svgo) des fichiers SVG livrés.

import { optimize } from 'svgo';

/**
 * Optimise un SVG avec svgo. La précision (nombre de décimales) est fixée
 * pour que l'arrondi reste invisible : 0,01 pixel du PNG d'origine.
 */
export function optimizeSvg(svg, precision) {
  const result = optimize(svg, {
    multipass: true,
    floatPrecision: precision,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            // On garde l'ordre des attributs tel qu'écrit (lisibilité).
            sortAttrs: false,
            // Les couleurs restent écrites comme dans la charte (#412D1E).
            convertColors: { convertCase: false },
            convertPathData: { floatPrecision: precision },
          },
        },
      },
    ],
  });
  return result.data;
}

/** SVG du logo pour le site : viewBox seul, couleur héritée du texte. */
export function brandSvg(viewBox, d, precision) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(' ')}"><path fill="currentColor" d="${d}"/></svg>`;
  return `${optimizeSvg(svg, precision)}\n`;
}

/** SVG autonome (pour /brand/) : couleur chocolat explicite et dimensions. */
export function standaloneSvg(viewBox, d, colour, precision) {
  const [, , w, h] = viewBox;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox.join(' ')}"><path fill="${colour}" d="${d}"/></svg>`;
  return `${optimizeSvg(svg, precision)}\n`;
}

/** Données de tracé d'un SVG optimisé (premier attribut d). */
export function pathDataOf(svg) {
  const m = /<path[^>]*\sd="([^"]+)"/.exec(svg);
  if (!m) throw new Error('Aucun tracé trouvé dans le SVG.');
  return m[1];
}
