/**
 * Petit moteur d'animation de la scène : courbes d'accélération, lecture
 * des pistes de clés et lissage du défilement. Aucune bibliothèque externe.
 */
import type { EasingName, Track } from './config';

type Easing = (t: number) => number;

const easings: Record<EasingName, Easing> = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outQuart: (t) => 1 - (1 - t) ** 4,
  inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
};

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function ease(name: EasingName, t: number): number {
  return easings[name](clamp01(t));
}

/** Valeur d'une piste à la progression p (constante avant la première clé et après la dernière). */
export function sampleTrack(track: Track, p: number): number {
  const first = track[0];
  const last = track[track.length - 1];
  if (!first || !last) return 0;
  if (p <= first.at) return first.value;
  if (p >= last.at) return last.value;
  for (let i = 1; i < track.length; i += 1) {
    const to = track[i];
    const from = track[i - 1];
    if (!to || !from || p > to.at) continue;
    const span = to.at - from.at;
    const t = span > 0 ? (p - from.at) / span : 1;
    return from.value + (to.value - from.value) * ease(to.ease ?? 'linear', t);
  }
  return last.value;
}

/** Avancement local d'une pièce (0 à 1) dans l'ouverture globale. */
export function partProgress(explode: number, delay: number, duration: number): number {
  return clamp01((explode - delay) / duration);
}

/**
 * Lissage à amortissement critique (sans rebond) d'une valeur vers sa cible.
 * Approximation de Padé de l'exponentielle, stable même si l'image saute.
 *
 * `maxLag` borne le retard sur la cible : un défilement rapide reste suivi
 * de façon continue, et un grand saut (touche Fin, lien d'ancre) ne fait pas
 * rejouer toute l'animation intermédiaire.
 */
export interface Damped {
  value: number;
  velocity: number;
}

export function smoothDamp(
  state: Damped,
  target: number,
  smoothTime: number,
  dt: number,
  maxLag = Infinity,
): void {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = state.value - target;
  const temp = (state.velocity + omega * change) * dt;
  state.velocity = (state.velocity - omega * temp) * decay;
  state.value = target + (change + temp) * decay;
  const lag = state.value - target;
  if (Math.abs(lag) > maxLag) state.value = target + Math.sign(lag) * maxLag;
}

/** Ramène immédiatement la valeur sur sa cible, sans élan. */
export function snapTo(state: Damped, target: number): void {
  state.value = target;
  state.velocity = 0;
}
