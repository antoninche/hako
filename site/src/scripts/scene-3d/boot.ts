/**
 * Démarrage de la scène 3D de l'accueil (section BoxScene).
 *
 * Ce module est minuscule et s'exécute dès le chargement de la page :
 * 1. il confirme le mode d'affichage. La feuille de style prévoit déjà la
 *    longue piste de défilement quand la 3D est probable (JavaScript actif,
 *    animations non réduites) : au rechargement, le navigateur restaure la
 *    position de défilement sur la bonne mise en page. Le script confirme
 *    « 3d » ou revient à « fallback » (image fixe et liste des pièces) sur un
 *    appareil sans WebGL, modeste ou en mode économie de données ;
 * 2. il ne télécharge three.js (import dynamique) qu'une fois la page
 *    chargée, et seulement lorsque la section approche de l'écran ;
 * 3. à la moindre erreur de la 3D, il revient à l'image fixe : la page
 *    reste utilisable quoi qu'il arrive.
 *
 * Un changement de mode ne déplace jamais ce que le visiteur regarde : si la
 * section est à l'écran, le changement attend qu'elle en sorte (la scène
 * montre son image d'attente) ; si elle est au-dessus, le défilement est
 * compensé.
 */
import { detectFallbackReason, reducedMotionQuery, type FallbackReason } from './capability';

export interface SceneHandle {
  destroy(): void;
}

/**
 * Signature du module chargé à la demande (scene.ts). `onFailure` signale
 * une panne de la scène ; `retry` vaut vrai quand un nouvel essai a un sens
 * (contexte WebGL perdu, par exemple après une mise en veille).
 */
export type MountScene = (
  section: HTMLElement,
  onFailure: (error: unknown, retry: boolean) => void,
) => Promise<SceneHandle>;

/** La 3D se prépare quand la section est à moins d'un écran et demi. */
const PRELOAD_MARGIN = '150% 0px 150% 0px';
/** Nombre de remontages tentés après une perte du contexte WebGL. */
const MAX_RETRIES = 1;

type Mode = '3d' | 'fallback';

/** Changements de mode en attente (section à l'écran), par section. */
const pendingSwitches = new WeakMap<HTMLElement, IntersectionObserver>();

/**
 * Partie de la section qui change avec le mode : la piste quand elle est
 * affichée, sinon le bloc image fixe et liste. Le titre et l'introduction,
 * au-dessus, ne bougent jamais.
 */
function changingPart(section: HTMLElement): { element: HTMLElement; isTrack: boolean } | null {
  const track = section.querySelector<HTMLElement>('[data-box-scene-track]');
  const fallback = section.querySelector<HTMLElement>('[data-box-scene-fallback]');
  if (!track || !fallback) return null;
  const isTrack = getComputedStyle(track).display !== 'none';
  return { element: isTrack ? track : fallback, isTrack };
}

function switchNow(section: HTMLElement, mode: Mode): void {
  const part = changingPart(section);
  const changeStart = part?.element.getBoundingClientRect().top ?? 0;
  const bottomBefore = section.getBoundingClientRect().bottom;
  section.dataset.mode = mode;
  // Le changement commence au-dessus de l'écran : on compense la nouvelle
  // hauteur, ce que le visiteur regarde reste en place. Si le navigateur a
  // déjà ancré le défilement de lui-même, l'écart mesuré est nul.
  if (changeStart <= 0) {
    const delta = section.getBoundingClientRect().bottom - bottomBefore;
    if (delta !== 0) window.scrollBy({ top: delta, behavior: 'instant' });
  }
}

/**
 * Passe la section dans le mode voulu. Si la partie qui change est à
 * l'écran, le changement attend qu'elle en sorte.
 */
function applyMode(section: HTMLElement, mode: Mode, onApplied?: () => void): void {
  pendingSwitches.get(section)?.disconnect();
  pendingSwitches.delete(section);
  delete section.dataset.pendingMode;

  const part = changingPart(section);
  const rect = part?.element.getBoundingClientRect();
  const visible = rect !== undefined && rect.bottom > 0 && rect.top < window.innerHeight;
  if (!part || part.isTrack === (mode === '3d') || !visible) {
    switchNow(section, mode);
    onApplied?.();
    return;
  }
  section.dataset.pendingMode = mode;
  const observer = new IntersectionObserver((entries) => {
    const latest = entries[entries.length - 1];
    if (!latest || latest.isIntersecting) return;
    observer.disconnect();
    pendingSwitches.delete(section);
    delete section.dataset.pendingMode;
    switchNow(section, mode);
    onApplied?.();
  });
  observer.observe(part.element);
  pendingSwitches.set(section, observer);
}

function bootSection(section: HTMLElement): void {
  const reason = detectFallbackReason();
  if (reason) {
    section.dataset.fallbackReason = reason;
    applyMode(section, 'fallback');
    return;
  }

  let handle: SceneHandle | null = null;
  let observer: IntersectionObserver | null = null;
  let stopped = false;
  let pending = false;
  let pageHidden = false;
  let retries = 0;
  // Change à chaque départ de la page ou panne : un montage commencé avant
  // est abandonné à son arrivée au lieu de s'ajouter au suivant.
  let generation = 0;

  const fallBack = (why: FallbackReason, error?: unknown) => {
    if (stopped) return;
    stopped = true;
    generation += 1;
    observer?.disconnect();
    observer = null;
    handle?.destroy();
    handle = null;
    section.dataset.state = why === 'error' ? 'error' : 'idle';
    section.dataset.fallbackReason = why;
    applyMode(section, 'fallback');
    if (error !== undefined) {
      // Avertissement seulement : l'image fixe prend le relais.
      console.warn('Scène 3D indisponible, image fixe affichée à la place.', error);
    }
  };

  const arm = () => {
    if (stopped || handle || pending) return;
    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          observer = null;
          load();
        }
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    observer.observe(section);
  };

  const onFailure = (error: unknown, retry: boolean) => {
    if (stopped) return;
    if (!retry || retries >= MAX_RETRIES) {
      fallBack('error', error);
      return;
    }
    // Contexte WebGL perdu : on remonte la scène une fois. L'observateur ne
    // se déclenche que lorsque la page est de nouveau affichée.
    retries += 1;
    generation += 1;
    handle?.destroy();
    handle = null;
    section.dataset.state = 'idle';
    arm();
  };

  function load() {
    if (stopped || handle || pending) return;
    pending = true;
    const ticket = generation;
    section.dataset.state = 'loading';
    import('./scene')
      .then(({ mountScene }) => mountScene(section, onFailure))
      .then((mounted) => {
        pending = false;
        if (stopped || ticket !== generation) {
          // Page quittée ou scène perdue pendant le chargement : ce montage
          // est abandonné, un nouveau commencera quand la page sera affichée.
          mounted.destroy();
          if (!stopped) {
            section.dataset.state = 'idle';
            if (!pageHidden) arm();
          }
          return;
        }
        handle = mounted;
        section.dataset.state = 'ready';
      })
      .catch((error: unknown) => {
        pending = false;
        fallBack('error', error);
      });
  }

  applyMode(section, '3d', () => {
    if (stopped) return;
    // Rien n'est téléchargé avant la fin du chargement de la page : les
    // images et polices du haut de page (LCP) passent en premier.
    if (document.readyState === 'complete') arm();
    else window.addEventListener('load', arm, { once: true });
  });

  // Le visiteur active « réduire les animations » en cours de route.
  window.matchMedia(reducedMotionQuery).addEventListener('change', (event) => {
    if (event.matches) fallBack('reduced-motion');
  });

  // Page quittée : on libère la carte graphique. Retour par l'historique
  // (page gardée en mémoire) : on réarme le chargement à la demande.
  window.addEventListener('pagehide', () => {
    pageHidden = true;
    generation += 1;
    observer?.disconnect();
    observer = null;
    handle?.destroy();
    handle = null;
    if (!stopped && !pending) section.dataset.state = 'idle';
  });
  window.addEventListener('pageshow', (event) => {
    pageHidden = false;
    if (event.persisted && section.dataset.mode === '3d') arm();
  });
}

export function bootBoxScenes(): void {
  document.querySelectorAll<HTMLElement>('[data-box-scene]').forEach(bootSection);
}
