/**
 * Menu mobile de l'en-tête : un panneau qui se déplie sous la barre.
 *
 * Ce n'est pas une fenêtre modale : le reste de la page reste utilisable et
 * le focus n'est jamais piégé. Fermé, le panneau porte l'attribut `hidden`,
 * donc rien n'y est atteignable au clavier.
 * - Le bouton « Menu » ouvre et ferme le panneau ; aria-expanded suit l'état.
 * - Échap ferme le panneau et rend le focus au bouton.
 * - Un clic sur un lien du panneau le ferme.
 * - Le passage à un écran large (64rem et plus) le ferme.
 * - Un clic en dehors de l'en-tête, ou le focus qui le quitte, le ferme aussi :
 *   ainsi le panneau ne recouvre jamais l'élément qui a le focus.
 *
 * Sans JavaScript, le bouton reste caché et un lien « Menu » mène au plan du
 * site, en bas de page. Ce script échange les deux (même taille, même place).
 * L'animation d'ouverture et de fermeture est entièrement en CSS (Header.astro).
 */

import { WIDE_SCREEN_QUERY } from '../lib/breakpoints';

interface MenuElements {
  header: HTMLElement;
  toggle: HTMLButtonElement;
  panel: HTMLElement;
  fallback: HTMLAnchorElement | null;
}

function findElements(root: ParentNode): MenuElements | null {
  const header = root.querySelector<HTMLElement>('.site-header');
  const toggle = header?.querySelector<HTMLButtonElement>('button.menu-toggle');
  const panelId = toggle?.getAttribute('aria-controls');
  const panel = panelId ? document.getElementById(panelId) : null;
  if (!header || !toggle || !panel) return null;
  const fallback = header.querySelector<HTMLAnchorElement>('a.menu-fallback');
  return { header, toggle, panel, fallback };
}

/**
 * Active le menu. Renvoie une fonction qui le désactive proprement
 * (écouteurs retirés, panneau fermé, lien de secours rétabli).
 */
export function initHeaderMenu(root: ParentNode = document): () => void {
  const elements = findElements(root);
  if (!elements) return () => {};
  const { header, toggle, panel, fallback } = elements;

  // Écouteurs permanents, retirés par la fonction de nettoyage.
  const lifetime = new AbortController();
  // Écouteurs posés seulement pendant que le panneau est ouvert.
  let whileOpen: AbortController | null = null;

  const isOpen = (): boolean => toggle.getAttribute('aria-expanded') === 'true';

  function open(): void {
    if (isOpen()) return;
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');

    whileOpen = new AbortController();
    const { signal } = whileOpen;
    document.addEventListener('keydown', onKeydown, { signal });
    document.addEventListener('pointerdown', onPointerDown, { signal });
    header.addEventListener('focusout', onFocusOut, { signal });
  }

  function close(returnFocus = false): void {
    if (!isOpen()) return;
    whileOpen?.abort();
    whileOpen = null;
    toggle.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    if (returnFocus) toggle.focus();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') close(true);
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.target instanceof Node && !header.contains(event.target)) close();
  }

  function onFocusOut(event: FocusEvent): void {
    // relatedTarget : l'élément qui reçoit le focus (null si la fenêtre le perd).
    const next = event.relatedTarget;
    if (next instanceof Node && !header.contains(next)) close();
  }

  const { signal } = lifetime;

  toggle.addEventListener('click', () => (isOpen() ? close() : open()), { signal });

  panel.addEventListener(
    'click',
    (event) => {
      if (event.target instanceof Element && event.target.closest('a[href]')) close();
    },
    { signal },
  );

  const wideScreen = window.matchMedia(WIDE_SCREEN_QUERY);
  wideScreen.addEventListener(
    'change',
    (event) => {
      if (event.matches) close();
    },
    { signal },
  );

  // La page mise en cache par le navigateur (retour arrière) revient menu fermé.
  window.addEventListener('pagehide', () => close(), { signal });

  // Le script est là : le vrai bouton remplace le lien de secours.
  toggle.hidden = false;
  if (fallback) fallback.hidden = true;

  return () => {
    close();
    lifetime.abort();
    toggle.hidden = true;
    if (fallback) fallback.hidden = false;
  };
}
