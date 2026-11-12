/**
 * Scène 3D de la box, pilotée par le défilement. Ce module (et three.js)
 * n'est téléchargé qu'à l'approche de la section : voir boot.ts.
 *
 * Déroulé (réglé dans src/data/model.config.json) : la box tourne pour
 * montrer son côté « 箱 HAKO », s'ouvre en vue éclatée (couvercle,
 * ventilateur, disque, Raspberry Pi, base), les étiquettes apparaissent,
 * puis la box se referme.
 */
import {
  AgXToneMapping,
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Matrix3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
  type Object3D,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import rawConfig from '../../data/model.config.json';
import type { MountScene, SceneHandle } from './boot';
import { parseModelConfig, type ModelConfig, type PartMotion } from './config';
import type { NodeName } from './contract';
import {
  clamp01,
  ease,
  partProgress,
  sampleTrack,
  smoothDamp,
  snapTo,
  type Damped,
} from './motion';
import { buildProceduralModel, disposeObject } from './procedural';
import { createContactShadowTexture } from './textures';

/** Densité de pixels maximale : 2 sur ordinateur, 1,5 sur mobile. */
const DPR_CAP_DESKTOP = 2;
const DPR_CAP_MOBILE = 1.5;
/** L'affichage reprend un peu avant que la piste n'entre à l'écran. */
const VISIBILITY_MARGIN = '25% 0px 25% 0px';
/** Écart (px) entre le bord droit de la box et la colonne d'étiquettes. */
const LABEL_GAP = 28;
const LABEL_MARGIN = 12;

interface AnimatedPart {
  readonly node: Object3D;
  readonly rest: Vector3;
  readonly motion: PartMotion;
  readonly ancestor: PartMotion | null;
  /** Passe d'un décalage exprimé dans le repère du modèle au repère du parent. */
  readonly toParent: Matrix3;
}

interface LabelView {
  readonly root: HTMLElement;
  readonly leader: HTMLElement;
  readonly dot: HTMLElement;
  readonly text: HTMLElement;
  readonly node: Object3D;
  /** Quatre coins à mi-hauteur, dans le repère de la pièce. */
  readonly corners: readonly Vector3[];
  height: number;
  opacity: number;
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Élément introuvable : ${selector}`);
  return element;
}

function isMobile(): boolean {
  return window.matchMedia('(max-width: 47.99rem), (pointer: coarse)').matches;
}

function partFactor(motion: PartMotion, explode: number): number {
  return ease(motion.ease, partProgress(explode, motion.delay, motion.duration));
}

/** Modèle réel (hako.glb) ou modèle provisoire dessiné en code. */
type ModelSource = 'glb' | 'procedural';

async function loadModel(
  config: ModelConfig,
  section: HTMLElement,
): Promise<{ model: Object3D; source: ModelSource }> {
  const modelUrl = section.dataset.modelUrl;
  if (modelUrl) {
    try {
      const { loadGlbModel } = await import('./glb');
      return { model: await loadGlbModel(modelUrl), source: 'glb' };
    } catch (error) {
      console.warn('hako.glb inutilisable : affichage du modèle provisoire.', error);
    }
  }
  const logoUrl = section.dataset.logoUrl;
  let logo: Texture | null = null;
  if (logoUrl) logo = await new TextureLoader().loadAsync(logoUrl).catch(() => null);
  return { model: buildProceduralModel(config, { logo }), source: 'procedural' };
}

export const mountScene: MountScene = async (section, onFailure) => {
  const config = parseModelConfig(rawConfig);
  const track = required<HTMLElement>(section, '[data-box-scene-track]');
  const stage = required<HTMLElement>(section, '[data-box-scene-stage]');
  const mount = required<HTMLElement>(section, '[data-box-scene-canvas]');

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
  const canvas = renderer.domElement;
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  let destroyed = false;
  let raf = 0;

  const cleanups: Array<() => void> = [];
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    for (const cleanup of cleanups) cleanup();
    disposeObject(scene);
    scene.environment?.dispose();
    pmrem.dispose();
    renderer.dispose();
    canvas.remove();
    // Rend le contexte au navigateur tout de suite (sauf s'il est déjà perdu).
    if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
    section.querySelectorAll<HTMLElement>('[data-box-scene-label]').forEach((label) => {
      label.style.opacity = '0';
    });
    delete section.dataset.settled;
    delete section.dataset.modelSource;
    delete section.dataset.inView;
  };
  const fail = (error: unknown, retry = false) => {
    if (destroyed) return;
    destroy();
    onFailure(error, retry);
  };

  try {
    // ----- Rendu : couleurs sRGB, tons AgX, fond transparent (le crème de la page) -----
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = AgXToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.debug.onShaderError = () => fail(new Error('Erreur de compilation d’un shader.'));
    canvas.setAttribute('aria-hidden', 'true');
    // Contexte perdu (mise en veille, pilote réinitialisé) : la scène est
    // remontée une fois, puis l'image fixe prend le relais.
    const onContextLost = () => fail(new Error('Contexte WebGL perdu.'), true);
    canvas.addEventListener('webglcontextlost', onContextLost);
    cleanups.push(() => canvas.removeEventListener('webglcontextlost', onContextLost));

    // ----- Lumière : studio doux et chaud -----
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.7;
    scene.environmentRotation.set(0, -0.6, 0);
    const key = new DirectionalLight(new Color('#ffe4c8'), 2.1);
    key.position.set(-0.35, 0.6, 0.45);
    const rim = new DirectionalLight(new Color('#fff1de'), 0.9);
    rim.position.set(0.45, 0.3, -0.5);
    const fill = new HemisphereLight(new Color('#fff6ea'), new Color('#cdb69a'), 0.55);
    scene.add(key, rim, fill);

    // ----- Modèle : vrai fichier .glb s'il existe, sinon le modèle provisoire -----
    const { model, source } = await loadModel(config, section);
    if (destroyed) {
      disposeObject(model);
      return { destroy };
    }
    section.dataset.modelSource = source;
    const pivot = new Group();
    pivot.add(model);
    scene.add(pivot);
    model.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(model);
    const centre = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    model.position.x -= centre.x;
    model.position.z -= centre.z;
    model.position.y -= bounds.min.y;
    model.updateMatrixWorld(true);
    const restHeight = size.y;
    const footprint = Math.hypot(size.x, size.z);

    // ----- Ombre de contact (texture floue, sans calcul d'ombre en temps réel) -----
    const shadow = new Mesh(
      new PlaneGeometry(size.x / 0.56, size.z / 0.56),
      new MeshBasicMaterial({
        color: new Color('#412d1e'),
        alphaMap: createContactShadowTexture(size.x / size.z),
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.00005;
    shadow.renderOrder = -1;
    pivot.add(shadow);

    // ----- Pièces animées -----
    const rootInverse = new Matrix4().copy(model.matrixWorld).invert();
    const parts: AnimatedPart[] = [];
    for (const [name, motion] of Object.entries(config.parts)) {
      const node = model.getObjectByName(name);
      if (!node || !motion || !node.parent) continue;
      let ancestor: PartMotion | null = null;
      for (
        let parent: Object3D | null = node.parent;
        parent && parent !== model;
        parent = parent.parent
      ) {
        const parentMotion = config.parts[parent.name as NodeName];
        if (parentMotion) {
          ancestor = parentMotion;
          break;
        }
      }
      const parentToRoot = new Matrix4().multiplyMatrices(rootInverse, node.parent.matrixWorld);
      parts.push({
        node,
        rest: node.position.clone(),
        motion,
        ancestor,
        toParent: new Matrix3().setFromMatrix4(parentToRoot).invert(),
      });
    }
    const rotor = model.getObjectByName('Fan_Rotor');
    const rotorRest = rotor ? rotor.quaternion.clone() : null;
    const rotorAxis = new Vector3(
      config.rotor.axis === 'x' ? 1 : 0,
      config.rotor.axis === 'y' ? 1 : 0,
      config.rotor.axis === 'z' ? 1 : 0,
    );
    const fanMotion = config.parts.Fan ?? null;

    // ----- Étiquettes HTML -----
    const labels: LabelView[] = [];
    for (const name of config.order) {
      const root = section.querySelector<HTMLElement>(`[data-box-scene-label="${name}"]`);
      const node = model.getObjectByName(name);
      if (!root || !node) continue;
      node.updateMatrixWorld(true);
      const box = new Box3().setFromObject(node);
      const inverse = new Matrix4().copy(node.matrixWorld).invert();
      const midY = (box.min.y + box.max.y) / 2;
      const corners = [
        new Vector3(box.min.x, midY, box.min.z),
        new Vector3(box.max.x, midY, box.min.z),
        new Vector3(box.min.x, midY, box.max.z),
        new Vector3(box.max.x, midY, box.max.z),
      ].map((corner) => corner.applyMatrix4(inverse));
      labels.push({
        root,
        leader: required(root, '[data-box-scene-leader]'),
        dot: required(root, '[data-box-scene-dot]'),
        text: required(root, '[data-box-scene-text]'),
        node,
        corners,
        height: 0,
        opacity: -1,
      });
    }

    // ----- Caméra -----
    const camera = new PerspectiveCamera(config.camera.fov, 1, 0.01, 20);
    const target = new Vector3();
    let width = 1;
    let height = 1;
    let stickyTop = 0;
    let labelColumnMax = 240;
    let labelWidest = 0;

    const resize = () => {
      width = Math.max(1, stage.clientWidth);
      height = Math.max(1, stage.clientHeight);
      stickyTop = parseFloat(getComputedStyle(stage).top) || 0;
      const cap = isMobile() ? DPR_CAP_MOBILE : DPR_CAP_DESKTOP;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
      renderer.setSize(width, height, false);
      // Largeur maximale d'une étiquette : 17rem, moins sur petit écran (le texte passe à la ligne).
      labelColumnMax = Math.round(
        Math.min(272, Math.max(150, width * 0.5 - LABEL_GAP - LABEL_MARGIN)),
      );
      stage.style.setProperty('--box-scene-label-max', `${labelColumnMax}px`);
      labelWidest = 0;
      for (const label of labels) {
        label.height = label.text.offsetHeight;
        labelWidest = Math.max(labelWidest, label.text.offsetWidth);
      }
    };

    const placeCamera = (lift: number, elevation: number, presence: number) => {
      const aspect = width / height;
      const share =
        (aspect < 1 ? config.camera.labelSpace.narrow : config.camera.labelSpace.wide) * presence;
      const tanHalf = Math.tan((config.camera.fov * Math.PI) / 360);
      const frameHeight = restHeight + lift;
      const vertical = Math.max(
        frameHeight * Math.cos(elevation) + footprint * Math.sin(elevation),
        config.camera.minFrame,
      );
      const distanceV = vertical / 2 / tanHalf;
      const distanceH = footprint / 2 / (tanHalf * aspect * (1 - share));
      const distance = Math.max(distanceV, distanceH) * config.camera.margin + footprint / 2;
      target.set(0, frameHeight / 2, 0);
      camera.position.set(
        0,
        target.y + Math.sin(elevation) * distance,
        Math.cos(elevation) * distance,
      );
      camera.lookAt(target);
      camera.aspect = aspect;
      camera.setViewOffset(width, height, (share * width) / 2, 0, width, height);
    };

    // ----- Défilement → progression lissée -----
    const scrollTarget = () => {
      const rect = track.getBoundingClientRect();
      const range = rect.height - height;
      return range > 0 ? clamp01((stickyTop - rect.top) / range) : 0;
    };
    const progress: Damped = { value: 0, velocity: 0 };
    let rotorAngle = 0;
    let settled = false;

    const offset = new Vector3();
    const ancestorOffset = new Vector3();
    const projected = new Vector3();
    const anchors: Array<{ x: number; y: number }> = labels.map(() => ({ x: 0, y: 0 }));
    const rotorTurn = new Quaternion();

    const apply = (p: number, dt: number) => {
      const explode = clamp01(sampleTrack(config.timeline.explode, p));
      // Écran en hauteur : on écarte davantage les pièces pour occuper la place.
      const spread = width / height < 0.8 ? config.portraitSpread : 1;
      let lift = 0;
      for (const part of parts) {
        const factor = partFactor(part.motion, explode) * spread;
        offset.fromArray(part.motion.offset).multiplyScalar(factor);
        lift = Math.max(lift, offset.y);
        if (part.ancestor) {
          ancestorOffset
            .fromArray(part.ancestor.offset)
            .multiplyScalar(partFactor(part.ancestor, explode) * spread);
          offset.sub(ancestorOffset);
        }
        part.node.position.copy(part.rest).add(offset.applyMatrix3(part.toParent));
      }
      pivot.rotation.y = sampleTrack(config.timeline.rotationY, p);

      const spin = fanMotion ? partFactor(fanMotion, explode) : 0;
      if (rotor && rotorRest && spin > 0) {
        rotorAngle =
          (rotorAngle + dt * config.rotor.turnsPerSecond * Math.PI * 2 * spin) % (Math.PI * 2);
        rotor.quaternion
          .copy(rotorRest)
          .multiply(rotorTurn.setFromAxisAngle(rotorAxis, rotorAngle));
      }

      // La place des étiquettes se libère au rythme de l'ouverture.
      placeCamera(lift, sampleTrack(config.timeline.elevation, p), ease('inOutSine', explode));
      return spin;
    };

    const layoutLabels = (p: number) => {
      const visibility = clamp01(sampleTrack(config.timeline.labels, p));
      const count = labels.length;
      const span = Math.max(0.05, 1 - config.labelStagger * Math.max(0, count - 1));
      if (visibility <= 0) {
        for (const label of labels) {
          if (label.opacity !== 0) {
            label.opacity = 0;
            label.root.style.opacity = '0';
          }
        }
        return;
      }
      scene.updateMatrixWorld();
      let column = 0;
      labels.forEach((label, index) => {
        let best = -Infinity;
        let bestY = 0;
        for (const corner of label.corners) {
          projected.copy(corner).applyMatrix4(label.node.matrixWorld).project(camera);
          const x = ((projected.x + 1) / 2) * width;
          if (x > best) {
            best = x;
            bestY = ((1 - projected.y) / 2) * height;
          }
        }
        const anchor = anchors[index];
        if (anchor) {
          anchor.x = best;
          anchor.y = bestY;
        }
        column = Math.max(column, best + LABEL_GAP);
      });
      column = Math.min(column, width - LABEL_MARGIN - labelWidest);

      // Les étiquettes restent dans l'ordre, sans se chevaucher.
      const tops: number[] = [];
      labels.forEach((label, index) => {
        const anchor = anchors[index];
        if (!anchor) return;
        const previous =
          index > 0 ? (tops[index - 1] ?? 0) + (labels[index - 1]?.height ?? 0) + 8 : -Infinity;
        tops.push(Math.max(anchor.y - label.height / 2, previous));
      });
      const last = labels.length - 1;
      const overflow = (tops[last] ?? 0) + (labels[last]?.height ?? 0) - (height - LABEL_MARGIN);
      if (overflow > 0)
        for (let i = 0; i < tops.length; i += 1) tops[i] = (tops[i] ?? 0) - overflow;

      labels.forEach((label, index) => {
        const anchor = anchors[index];
        const top = tops[index];
        if (!anchor || top === undefined) return;
        const opacity = clamp01((visibility - index * config.labelStagger) / span);
        if (opacity !== label.opacity) {
          label.opacity = opacity;
          label.root.style.opacity = opacity.toFixed(3);
        }
        if (opacity <= 0) return;
        const endX = column - 8;
        const endY = top + label.height / 2;
        const dx = endX - anchor.x;
        const dy = endY - anchor.y;
        const length = Math.max(0, Math.hypot(dx, dy));
        label.leader.style.transform = `translate3d(${anchor.x.toFixed(1)}px, ${anchor.y.toFixed(1)}px, 0) rotate(${Math.atan2(dy, dx).toFixed(4)}rad) scaleX(${length.toFixed(1)})`;
        label.dot.style.transform = `translate3d(${anchor.x.toFixed(1)}px, ${anchor.y.toFixed(1)}px, 0)`;
        label.text.style.transform = `translate3d(${column.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
      });
    };

    // ----- Boucle d'affichage : seulement quand la section est à l'écran -----
    let visible = false;
    let last = 0;
    // État exposé dans la page (data-settled, data-progress, data-in-view) :
    // tests et captures.
    let shownProgress = '';
    section.dataset.inView = 'false';
    const setSettled = (value: boolean) => {
      if (value) {
        const label = progress.value.toFixed(3);
        if (label !== shownProgress) {
          shownProgress = label;
          section.dataset.progress = label;
        }
      }
      if (value === settled) return;
      settled = value;
      section.dataset.settled = String(value);
    };

    /** Dessine tout de suite l'état exact de la position de défilement. */
    const drawSnapped = () => {
      snapTo(progress, scrollTarget());
      last = 0;
      apply(progress.value, 0);
      renderer.render(scene, camera);
      layoutLabels(progress.value);
      setSettled(true);
    };

    const frame = (now: number) => {
      raf = 0;
      if (destroyed) return;
      try {
        const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
        last = now;
        const goal = scrollTarget();
        const { smoothTime, maxLag } = config.smoothing;
        smoothDamp(progress, goal, smoothTime, dt, maxLag);
        const done = Math.abs(progress.value - goal) < 2e-4 && Math.abs(progress.velocity) < 2e-3;
        if (done) snapTo(progress, goal);
        const spin = apply(progress.value, dt);
        renderer.render(scene, camera);
        layoutLabels(progress.value);
        setSettled(done);
        if (visible && (!done || spin > 0.001)) requestFrame();
        else last = 0;
      } catch (error) {
        fail(error);
      }
    };
    const requestFrame = () => {
      if (!raf && visible && !destroyed) raf = requestAnimationFrame(frame);
    };

    const onScroll = () => requestFrame();
    window.addEventListener('scroll', onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener('scroll', onScroll));

    const resizeObserver = new ResizeObserver(() => {
      resize();
      requestFrame();
    });
    resizeObserver.observe(stage);
    cleanups.push(() => resizeObserver.disconnect());

    // À l'arrivée comme au départ de la piste, la scène se cale exactement sur
    // la position de défilement : jamais d'ancien état rejoué (ouverture,
    // étiquettes) quand le visiteur revient après un saut.
    const visibility = new IntersectionObserver(
      (entries) => {
        const latest = entries[entries.length - 1];
        if (!latest || latest.isIntersecting === visible) return;
        visible = latest.isIntersecting;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        try {
          drawSnapped();
        } catch (error) {
          fail(error);
          return;
        }
        // Hors de l'écran, cette image calée est la dernière dessinée.
        section.dataset.inView = String(visible);
        if (visible) requestFrame();
      },
      { rootMargin: VISIBILITY_MARGIN },
    );
    visibility.observe(track);
    cleanups.push(() => visibility.disconnect());

    document.fonts?.ready.then(() => {
      if (!destroyed) {
        resize();
        requestFrame();
      }
    });

    // Première image prête avant l'arrivée du visiteur : shaders compilés d'avance.
    resize();
    progress.value = scrollTarget();
    apply(progress.value, 0);
    mount.append(canvas);
    await renderer.compileAsync(scene, camera).catch(() => renderer.compile(scene, camera));
    if (destroyed) return { destroy };
    renderer.render(scene, camera);
    layoutLabels(progress.value);
    requestFrame();
  } catch (error) {
    destroy();
    throw error;
  }

  const handle: SceneHandle = { destroy };
  return handle;
};
