/**
 * L'appareil peut-il afficher la scène 3D ? Ce test est volontairement
 * léger : il tourne dès le chargement de la page, avant tout téléchargement
 * de three.js.
 */

/** Raison d'afficher l'image fixe à la place de la scène 3D. */
export type FallbackReason = 'reduced-motion' | 'save-data' | 'low-end' | 'no-webgl' | 'error';

interface NetworkInformationLike {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
}

interface NavigatorHints {
  readonly deviceMemory?: number;
  readonly connection?: NetworkInformationLike;
}

export const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

/** WebGL 2 est nécessaire (three.js ne gère plus WebGL 1). Test sur un canevas jetable. */
export function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    // On rend tout de suite le contexte : le navigateur en limite le nombre.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function detectFallbackReason(): FallbackReason | null {
  if (window.matchMedia(reducedMotionQuery).matches) return 'reduced-motion';

  const hints = navigator as Navigator & NavigatorHints;
  const connection = hints.connection;
  if (connection?.saveData === true || /(^|-)2g$/.test(connection?.effectiveType ?? '')) {
    return 'save-data';
  }

  const cores = navigator.hardwareConcurrency;
  if ((cores > 0 && cores <= 2) || (hints.deviceMemory !== undefined && hints.deviceMemory <= 2)) {
    return 'low-end';
  }

  return hasWebGL2() ? null : 'no-webgl';
}
