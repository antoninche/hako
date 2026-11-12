/**
 * Textures dessinées en code, dans un canevas : aucune image à télécharger,
 * aucune adresse data: ou blob: (compatible avec une politique CSP stricte).
 */
import { CanvasTexture, NoColorSpace, RepeatWrapping } from 'three';

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
 * Carte de normales des couches d'impression 3D : de fines stries
 * horizontales, légèrement irrégulières, comme sur une vraie pièce en PLA.
 * Une tuile contient `layers` couches.
 */
export function createLayerLinesNormalMap(layers = 16): CanvasTexture {
  const rowsPerLayer = 8;
  const size = layers * rowsPerLayer;
  const { canvas, context } = canvas2d(4, size);
  const image = context.createImageData(4, size);
  const next = random(7);
  const amplitude = Array.from({ length: layers }, () => 0.75 + next() * 0.5);

  for (let row = 0; row < size; row += 1) {
    const layer = Math.floor(row / rowsPerLayer);
    // Profil arrondi de chaque cordon de plastique : pente du bord du cordon.
    const t = (row % rowsPerLayer) / (rowsPerLayer - 1) - 0.5; // -0,5 … 0,5
    const slope = -t * 2.4 * (amplitude[layer] ?? 1);
    const length = Math.hypot(slope, 1);
    const g = Math.round(((slope / length) * 0.5 + 0.5) * 255);
    const b = Math.round(((1 / length) * 0.5 + 0.5) * 255);
    for (let col = 0; col < 4; col += 1) {
      const i = (row * 4 + col) * 4;
      image.data[i] = 128;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
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
