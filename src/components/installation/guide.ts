/**
 * Comportement du guide d'installation (voir InstallGuide.astro).
 *
 * Sans ce script, tout le guide se lit de haut en bas. Avec lui :
 * - une seule étape est visible à la fois. Les autres sont cachées avec
 *   hidden="until-found" : la recherche du navigateur (Ctrl+F) trouve aussi
 *   leur texte, et affiche alors l'étape qui le contient ;
 * - l'étape en cours est écrite dans l'adresse (#etape-cable). Chaque
 *   changement d'étape ajoute une entrée à l'historique : le bouton
 *   « Retour » du navigateur ramène à l'étape d'avant, et un lien partagé
 *   ouvre la bonne étape. C'est la seule mémoire du guide : rien n'est
 *   enregistré sur l'appareil ;
 * - au changement d'étape, le titre de l'étape reçoit le focus (sans faire
 *   défiler), puis la page défile jusqu'à lui, en douceur sauf si l'appareil
 *   demande moins d'animations ;
 * - progression : la place dans le guide (« Étape 3 sur 8 »), jamais ce qui
 *   a été fait, puisqu'on peut arriver à une étape par un lien. Dans le
 *   sommaire, une étape reçoit sa coche quand on la valide avec « C'est
 *   fait », pendant la visite seulement (rien n'est gardé) ;
 * - sommaire replié sous 64rem (« Aller directement à une étape »), toujours
 *   ouvert au-dessus ; « Afficher tout le guide sur une seule page » ;
 * - choix de l'appareil (étape « page ») : seules ses consignes restent, et
 *   les cas « Ça ne marche pas ? » qui le concernent ;
 * - chronomètre de l'étape « preparation » ;
 * - impression : toutes les aides s'ouvrent le temps d'imprimer (le reste
 *   est fait par les styles @media print des composants).
 *
 * Ce script n'écrit aucun texte : il les lit dans la page (attributs data-*).
 * Il ne fait aucune requête, ne contient aucune adresse et ne garde rien sur
 * l'appareil.
 */
import { WIDE_SCREEN_QUERY } from '../../lib/breakpoints.ts';
import {
  decodeHash,
  elapsedText,
  fillTemplate,
  spokenElapsed,
  stepAnchor,
  stepFromHash,
} from '../../lib/installation/guide-state.ts';

type Mode = 'one' | 'all';

/** Où aller : le rang de l'étape (le nombre d'étapes désigne la fin du guide) et l'élément visé. */
interface Target {
  readonly index: number;
  /** Titre de l'étape, ou un cas « Ça ne marche pas ? » (<details>) de cette étape. */
  readonly element: HTMLElement;
}

function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Guide d'installation : élément introuvable (${what}).`);
  }
  return value;
}

/** Vrai si l'appareil demande moins d'animations. */
function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Chronomètre : temps écoulé depuis « Lancer le chronomètre », jamais gardé en mémoire. */
function initChronometer(chrono: HTMLElement): void {
  const find = <T extends Element>(selector: string): T =>
    must(chrono.querySelector<T>(selector), selector);
  const visual = find<HTMLElement>('[data-chrono-visual]');
  const spoken = find<HTMLElement>('[data-chrono-spoken]');
  const status = find<HTMLElement>('[data-chrono-status]');
  const start = find<HTMLButtonElement>('[data-chrono-start]');
  const reset = find<HTMLButtonElement>('[data-chrono-reset]');
  const texts = chrono.dataset;
  let startedAt: number | null = null;
  let timer = 0;

  function tick(): void {
    if (startedAt === null) return;
    const elapsed = Date.now() - startedAt;
    visual.textContent = elapsedText(elapsed, texts['format'] ?? '');
    // Le temps lu par les lecteurs d'écran ne change qu'une fois par minute.
    const words = spokenElapsed(elapsed, {
      zero: texts['zero'] ?? '',
      one: texts['one'] ?? '',
      many: texts['many'] ?? '',
    });
    if (spoken.textContent !== words) spoken.textContent = words;
  }

  /** Part de zéro maintenant. L'heure de départ suffit : après une mise en veille, le temps reste juste. */
  function run(): void {
    startedAt = Date.now();
    tick();
    window.clearInterval(timer);
    timer = window.setInterval(tick, 1000);
  }

  start.addEventListener('click', () => {
    chrono.dataset['running'] = 'true';
    status.hidden = true;
    run();
    start.hidden = true;
    reset.hidden = false;
    reset.focus();
  });
  reset.addEventListener('click', run);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
}

export function initInstallGuide(root: HTMLElement): void {
  const find = <T extends Element>(selector: string, scope: ParentNode = root): T =>
    must(scope.querySelector<T>(selector), selector);

  const steps = [...root.querySelectorAll<HTMLElement>('[data-step]')];
  const ids = steps.map((section) => section.dataset['step'] ?? '');
  const finish = find<HTMLElement>('[data-finish]');
  /** Rang de la fin du guide, juste après la dernière étape. */
  const finishIndex = steps.length;
  const tocList = find<HTMLElement>('[data-toc-list]');
  const tocLinks = ids.map((id) => find<HTMLAnchorElement>(`[data-toc="${id}"]`, tocList));
  const progressBar = find<HTMLProgressElement>('[data-progress-bar]');
  const progressLabel = find<HTMLElement>('[data-progress-label]');
  const modeButton = find<HTMLButtonElement>('[data-action="mode"]');
  const modeLabel = find<HTMLElement>('[data-mode-label]', modeButton);
  const fold = find<HTMLDetailsElement>('[data-toc-fold]');
  const wideScreen = window.matchMedia(WIDE_SCREEN_QUERY);

  let current = 0;
  let mode: Mode = 'one';
  /** Étapes validées par « C'est fait » pendant cette visite (gardées en mémoire, nulle part ailleurs). */
  const validated = new Set<number>();

  const sectionOf = (index: number): HTMLElement =>
    index === finishIndex ? finish : must(steps[index], `étape ${index + 1}`);
  const titleOf = (index: number): HTMLElement => find<HTMLElement>('h2', sectionOf(index));
  const anchorOf = (index: number): string =>
    index === finishIndex ? finish.id : stepAnchor(ids[index] ?? '');
  const titleTarget = (index: number): Target => ({ index, element: titleOf(index) });

  // ------------------------------------------------------------- affichage

  function render(): void {
    steps.forEach((section, index) => {
      if (mode === 'all' || index === current) section.removeAttribute('hidden');
      else section.setAttribute('hidden', 'until-found');
    });
    finish.hidden = mode === 'one' && current !== finishIndex;

    const doneText = tocList.dataset['doneText'] ?? '';
    tocLinks.forEach((link, index) => {
      const done = validated.has(index);
      link.dataset['state'] = index === current ? 'current' : done ? 'done' : 'todo';
      if (index === current) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
      find<HTMLElement>('[data-toc-state]', link).textContent = done ? ` ${doneText}` : '';
    });

    // La place dans le guide : « Étape 3 sur 8 », puis « Fin du guide ».
    progressBar.value = Math.min(current, steps.length);
    progressLabel.textContent =
      current === finishIndex
        ? (progressLabel.dataset['end'] ?? '')
        : fillTemplate(progressLabel.dataset['stepOf'] ?? '', {
            n: current + 1,
            total: steps.length,
          });
  }

  /** Cible désignée par une ancre (#etape-cable, #hako-installee, #etape-page-vpn), ou null. */
  function resolve(hash: string): Target | null {
    const stepId = stepFromHash(hash, ids);
    if (stepId !== null) return titleTarget(ids.indexOf(stepId));
    const name = decodeHash(hash);
    if (name === '') return null;
    if (name === finish.id) return titleTarget(finishIndex);
    // Un élément à l'intérieur d'une étape, par exemple un cas « Ça ne marche pas ? ».
    const element = document.getElementById(name);
    const section = element?.closest<HTMLElement>('[data-step]');
    const index = section ? steps.indexOf(section) : -1;
    return element && index >= 0 ? { index, element } : null;
  }

  /** Affiche l'étape de la cible ; puis, au besoin, focus et défilement jusqu'à elle. */
  function show(
    target: Target,
    options: { readonly focus: boolean; readonly scroll: boolean; readonly smooth: boolean },
  ): void {
    current = target.index;
    render();
    const { element } = target;
    const details = element instanceof HTMLDetailsElement ? element : null;
    if (details) details.open = true;
    if (options.focus) {
      const focusable = details?.querySelector<HTMLElement>('summary') ?? element;
      focusable.focus({ preventScroll: true });
    }
    if (options.scroll) {
      element.scrollIntoView({
        block: 'start',
        behavior: options.smooth && !reducedMotion() ? 'smooth' : 'auto',
      });
    }
  }

  /** Va à la cible et l'écrit dans l'adresse : une nouvelle entrée dans l'historique. */
  function go(target: Target): void {
    const name =
      target.element instanceof HTMLDetailsElement ? target.element.id : anchorOf(target.index);
    const hash = `#${name}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    show(target, { focus: true, scroll: true, smooth: true });
  }

  function setMode(next: Mode): void {
    mode = next;
    root.dataset['mode'] = next;
    const label = next === 'one' ? modeButton.dataset['labelAll'] : modeButton.dataset['labelOne'];
    modeLabel.textContent = label ?? '';
    render();
    // Dans les deux sens, on reste sur l'étape en cours : son titre reçoit le
    // focus et la page revient à lui (le bouton est sous le guide, il
    // s'éloignerait sinon de ce qu'on lisait).
    const title = titleOf(current);
    title.focus({ preventScroll: true });
    title.scrollIntoView({ block: 'start' });
  }

  // ------------------------------------------------------------- sommaire

  /** Écran large : la liste des étapes est toujours dépliée ; plus étroit, elle se replie. */
  function syncFold(): void {
    fold.open = wideScreen.matches;
  }
  wideScreen.addEventListener('change', syncFold);

  // ------------------------------------------------------------- appareil

  /** Montre les consignes de l'appareil choisi (toutes, si aucun n'est choisi). */
  function applyDevice(device: string | null): void {
    for (const block of root.querySelectorAll<HTMLElement>('[data-device]')) {
      block.hidden = device !== null && block.dataset['device'] !== device;
    }
    for (const item of root.querySelectorAll<HTMLElement>('[data-devices]')) {
      const devices = (item.dataset['devices'] ?? '').split(' ').filter(Boolean);
      item.hidden = device !== null && !devices.includes(device);
    }
  }

  root.addEventListener('change', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.name === 'appareil' && input.checked) {
      applyDevice(input.value);
    }
  });

  // ------------------------------------------------------------- boutons

  root.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('button[data-action]')
        : null;
    if (!button) return;
    const section = button.closest<HTMLElement>('[data-step]');
    const index = section ? steps.indexOf(section) : current;
    switch (button.dataset['action']) {
      case 'next':
        if (section) validated.add(index);
        go(titleTarget(Math.min(index + 1, finishIndex)));
        break;
      case 'previous':
        go(titleTarget(Math.max(index - 1, 0)));
        break;
      case 'restart':
        go(titleTarget(0));
        break;
      case 'print':
        window.print();
        break;
      case 'mode':
        setMode(mode === 'one' ? 'all' : 'one');
        break;
      default:
        break;
    }
  });

  // ------------------------------------------------------------- liens et historique

  // Lien vers une étape ou un cas de cette page (sommaire, renvois entre
  // étapes) : on reste sur la page, et l'adresse suit. Un clic avec une touche
  // (nouvel onglet…) garde son comportement habituel.
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!(link instanceof HTMLAnchorElement)) return;
    const url = new URL(link.href);
    const here = window.location;
    if (url.origin !== here.origin || url.pathname !== here.pathname) return;
    if (url.search !== here.search) return;
    const target = resolve(url.hash);
    if (!target) return;
    event.preventDefault();
    // Sur téléphone, la liste repliée se referme avant de défiler jusqu'à l'étape.
    if (fold.contains(link) && !wideScreen.matches) fold.open = false;
    go(target);
  });

  // Bouton « Retour » ou « Suivant » du navigateur, ou adresse modifiée à la main.
  window.addEventListener('hashchange', () => {
    const target = window.location.hash === '' ? titleTarget(0) : resolve(window.location.hash);
    if (target) show(target, { focus: true, scroll: true, smooth: true });
  });

  // Recherche dans la page (Ctrl+F) : le navigateur affiche l'étape qui
  // contient le texte trouvé ; le guide passe à cette étape.
  for (const section of steps) {
    section.addEventListener('beforematch', () => {
      const index = steps.indexOf(section);
      // Navigation vers une ancre de cette étape (adresse tapée, lien vers une
      // aide comme #etape-page-vpn) : elle est déjà dans l'adresse, et
      // hashchange suivra. On montre la cible sans rien ajouter à l'historique.
      const here = resolve(window.location.hash);
      if (here !== null && here.index === index) {
        show(here, { focus: false, scroll: false, smooth: false });
        return;
      }
      const hash = `#${anchorOf(index)}`;
      if (window.location.hash !== hash) window.history.pushState(null, '', hash);
      show(titleTarget(index), { focus: false, scroll: false, smooth: false });
    });
  }

  // ------------------------------------------------------------- impression

  // Les aides repliées s'ouvrent le temps d'imprimer, puis se referment.
  const openedForPrint: HTMLDetailsElement[] = [];
  window.addEventListener('beforeprint', () => {
    for (const details of document.querySelectorAll<HTMLDetailsElement>('main details')) {
      if (details.open) continue;
      details.open = true;
      openedForPrint.push(details);
    }
  });
  window.addEventListener('afterprint', () => {
    for (const details of openedForPrint.splice(0)) details.open = false;
  });

  // ------------------------------------------------------------- démarrage

  for (const element of root.querySelectorAll<HTMLElement>('[data-js-only]')) {
    element.hidden = false;
  }
  syncFold();
  const chrono = root.querySelector<HTMLElement>('[data-chrono]');
  if (chrono) initChronometer(chrono);
  // Retour sur la page sans rechargement complet : le navigateur a pu garder l'appareil choisi.
  const checked = root.querySelector<HTMLInputElement>('input[name="appareil"]:checked');
  applyDevice(checked?.value ?? null);

  // Retour sur le guide après un rechargement (un téléphone à court de
  // mémoire recharge la page au retour depuis la page de la HAKO) : le
  // navigateur remettrait la page à l'endroit quitté, parfois au milieu d'une
  // autre étape. Le guide défile lui-même jusqu'au titre de l'étape.
  window.history.scrollRestoration = 'manual';

  // Une étape à la fois. Une adresse comme #etape-page ouvre cette étape
  // (lien partagé, retour depuis la page de la HAKO) : on la montre, sans
  // déplacer le focus.
  root.dataset['mode'] = mode;
  const initial = resolve(window.location.hash);
  if (initial) show(initial, { focus: false, scroll: true, smooth: false });
  else render();
  root.dataset['ready'] = 'true';
}
