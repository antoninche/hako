/**
 * Textures dessinées en code, dans un canevas : aucune image à télécharger,
 * aucune adresse data: ou blob: (compatible avec une politique CSP stricte).
 */
import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';

function canvas2d(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canevas 2D indisponible.');
  return { canvas, context };
}

/** Générateur pseudo-aléatoire déterministe : le même rendu à chaque visite. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Veinage discret du socle (bois imprimé, couleur noyer) : de fines veines
 * à peine plus claires ou plus sombres, légèrement ondulées, dans le sens de
 * la longueur (u), autour de la couleur `hex` (#RRGGBB). Une tuile couvre
 * `period` mètres de long et `period / 3` de large ou de haut (coordonnées
 * de texture en mètres).
 */
export function createWoodGrainTexture(hex: string, period = 0.09) {
  const base = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  const width = 128;
  const height = 256;
  const { canvas, context } = canvas2d(width, height);
  const image = context.createImageData(width, height);
  const next = random(11);
  // Veines : position (0 à 1 dans la tuile), épaisseur et intensité au hasard.
  const veins = Array.from({ length: 18 }, () => ({
    at: next(),
    width: 0.004 + next() * 0.012,
    strength: (next() - 0.45) * 0.14,
    phase: next() * Math.PI * 2,
  }));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      let shade = 0;
      for (const vein of veins) {
        // Ondulation lente le long de la veine, raccordée d'un bord à l'autre de la tuile.
        const centre = vein.at + 0.012 * Math.sin(Math.PI * 2 * u + vein.phase);
        let distance = Math.abs(y / height - centre);
        distance = Math.min(distance, 1 - distance);
        shade += vein.strength * Math.exp(-((distance / vein.width) ** 2));
      }
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        image.data[i + c] = Math.max(0, Math.min(255, Math.round((base[c] ?? 0) * (1 + shade))));
      }
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1 / period, 3 / period);
  return texture;
}

/**
 * Ombre de contact douce sous la box : un rectangle arrondi flou, plus
 * dense au centre. Niveaux de gris (utilisée comme alphaMap).
 * `aspect` = largeur / profondeur de l'empreinte de la box.
 */
export function createContactShadowTexture(aspect: number): CanvasTexture {
  const size = 256;
  const { canvas, context } = canvas2d(size, size);
  const image = context.createImageData(size, size);
  // Empreinte de la box dans la texture (en fraction de la demi-taille).
  const halfW = 0.56;
  const halfH = halfW / aspect;
  const radius = 0.1;

  const smooth = (edge0: number, edge1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = Math.abs((x + 0.5) / size - 0.5) * 2;
      const v = Math.abs((y + 0.5) / size - 0.5) * 2;
      // Distance signée à un rectangle arrondi.
      const qx = u - halfW + radius;
      const qy = v - halfH + radius;
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const d = outside + Math.min(Math.max(qx, qy), 0) - radius;
      const core = 1 - smooth(-0.06, 0.07, d);
      const penumbra = 1 - smooth(-0.1, 0.34, d);
      const alpha = Math.min(1, core * 0.55 + penumbra * 0.45);
      const value = Math.round(alpha * 255);
      const i = (y * size + x) * 4;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  return texture;
}
