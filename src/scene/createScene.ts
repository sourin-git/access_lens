import * as THREE from 'three';
import type { AccessibilityProfile } from '../types';
import { createWebsiteModel, SELECTABLE_ELEMENTS } from './createWebsiteModel';
import { createParticles } from './createParticles';
import { createScanEffect } from './effects';
import { createInteraction } from './interaction';

/** Disposes shared resources exactly once. Called on failure as well as normal teardown. */
function releaseScene(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    const renderable = object as THREE.Mesh;
    if (renderable.geometry) geometries.add(renderable.geometry);
    if (renderable.material) {
      const list = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
      for (const material of list) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  textures.forEach((texture) => { texture.dispose(); });
  materials.forEach((material) => { material.dispose(); });
  geometries.forEach((geometry) => { geometry.dispose(); });
  scene.clear();
}

export function createAccessLensScene(
  canvas: HTMLCanvasElement,
  callbacks: { onSelectElement: (id: string) => void },
): {
  setProfile: (profile: AccessibilityProfile) => void;
  setScanActive: (active: boolean) => void;
  setSelectedElement: (id: string | null) => void;
  resize: () => void;
  dispose: () => void;
} {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let profile: AccessibilityProfile = media.matches ? 'reduced-motion' : 'default';
  let disposed = false;
  let selected: string | null = null;
  let scanActive = false;
  let scanProgress = 0;
  let scanStartedAt = 0;
  let detected = false;
  let frame = 0;
  let lastTime = 0;
  let time = 0;
  let width = 1;
  let height = 1;
  let renderer: THREE.WebGLRenderer | null = null;
  let model: ReturnType<typeof createWebsiteModel> | null = null;
  let particles: ReturnType<typeof createParticles> | null = null;
  let effect: ReturnType<typeof createScanEffect> | null = null;
  let interaction: ReturnType<typeof createInteraction> | null = null;
  let fallback: HTMLDivElement | null = null;
  let fallbackStatus: HTMLParagraphElement | null = null;
  const fallbackButtons = new Map<string, HTMLButtonElement>();
  const originalDisplay = canvas.style.display;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  const target = new THREE.Vector3(0, 0, 0);
  const validIds = new Set<string>(SELECTABLE_ELEMENTS.map((element) => element.id));
  const isReduced = () => media.matches || profile === 'reduced-motion';

  function updateFallback() {
    if (!fallbackStatus) return;
    if (fallback) fallback.dataset.profile = profile;
    fallbackStatus.textContent = `Profile: ${profile}. ${scanActive || detected ? 'Illustrative issues: body text, hero image, primary button. No real analysis was performed.' : 'Idle. Illustrative website elements are available below.'} Selected: ${selected ?? 'none'}.`;
    for (const [id, button] of fallbackButtons) button.setAttribute('aria-pressed', String(id === selected));
  }
  function select(id: string) {
    if (disposed || !validIds.has(id)) return;
    selected = id;
    model?.setSelected(id);
    updateFallback();
    invalidate();
    callbacks.onSelectElement(id);
  }
  function onFallbackSelect(event: Event) {
    const id = (event.currentTarget as HTMLButtonElement).dataset.sceneElementId;
    if (id) select(id);
  }
  function releaseWebGL() {
    interaction?.dispose();
    interaction = null;
    releaseScene(scene);
    if (renderer) {
      // CanvasTexture uploads leave UNPACK_FLIP_Y_WEBGL enabled. Restore GL
      // defaults before a future renderer initializes textures on this context.
      if (!renderer.getContext().isContextLost()) renderer.resetState();
      renderer.dispose();
    }
    // The canvas remains reusable for a later mount; do not force a context loss.
    renderer = null;
    model = null;
    particles = null;
    effect = null;
  }
  function showFallback() {
    cancelAnimationFrame(frame);
    frame = 0;
    releaseWebGL();
    if (fallback || disposed) return;
    fallback = document.createElement('div');
    fallback.dataset.accessLensFallback = '';
    const root = fallback.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `:host{display:block;box-sizing:border-box;padding:24px;color:#edf4ff;background:#0c162b;border:1px solid #5486cc;border-radius:12px;font:16px/1.6 system-ui,sans-serif}:host([data-profile=low-vision]){font-size:19px;color:#fff;background:#050915;border-color:#fff}:host([data-profile=dyslexia]){font-family:Verdana,sans-serif;line-height:1.9;color:#fff0ce;background:#2b2836}:host([data-profile=motor]) button{padding:16px 24px;border-width:2px}h2{font-size:22px;margin:0 0 12px}p{max-width:65ch}button{font:inherit;cursor:pointer;background:#142c50;border:1px solid #8caee9;color:#fff;padding:12px 18px;border-radius:6px;margin:4px}button[aria-pressed=true]{background:#d5ff54;color:#0c162b}button:focus-visible{outline:3px solid #d5ff54;outline-offset:3px}`;
    const heading = document.createElement('h2');
    heading.textContent = 'AccessLens · accessible scene alternative';
    const explanation = document.createElement('p');
    explanation.textContent = 'The 3D preview is unavailable in this browser. You can still select every website element using these buttons.';
    fallbackStatus = document.createElement('p');
    fallbackStatus.setAttribute('role', 'status');
    root.append(style, heading, explanation, fallbackStatus);
    for (const element of SELECTABLE_ELEMENTS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = element.label;
      button.dataset.sceneElementId = element.id;
      button.addEventListener('click', onFallbackSelect);
      fallbackButtons.set(element.id, button);
      root.append(button);
    }
    canvas.insertAdjacentElement('afterend', fallback);
    canvas.style.display = 'none';
    updateFallback();
  }
  function render(timestamp: number) {
    frame = 0;
    if (disposed || !renderer || !model || !particles || !effect) return;
    const motion = !isReduced();
    const delta = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0;
    lastTime = timestamp;
    if (motion) time += delta;
    if (scanActive && !detected) {
      scanProgress = motion ? Math.min(1, (timestamp - scanStartedAt) / 4000) : 1;
      if (scanProgress >= 1) { detected = true; model.setIssues(true); }
    }
    model.update(time, motion);
    particles.update(time, motion);
    particles.points.visible = profile !== 'dyslexia' && profile !== 'low-vision';
    effect.update(scanActive && (!detected || !motion), scanProgress, !motion);
    // Fit both the website and satellites, including narrow portrait containers.
    const z = Math.max(9.4, Math.max(2.8, 5.2 / camera.aspect) / Math.tan(THREE.MathUtils.degToRad(19)) * 1.08);
    camera.position.set(motion ? Math.sin(time * 0.16) * 0.22 : 0, motion ? Math.cos(time * 0.13) * 0.11 : 0, z);
    camera.lookAt(target);
    renderer.render(scene, camera);
    if (motion && !document.hidden) frame = requestAnimationFrame(render);
  }
  function invalidate() {
    if (disposed || !renderer || document.hidden) return;
    if (isReduced()) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      render(performance.now());
    } else if (!frame) frame = requestAnimationFrame(render);
  }
  function resize() {
    if (disposed || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
  }
  function onMotionChange() { lastTime = 0; invalidate(); }
  function onVisibilityChange() {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    if (!document.hidden) invalidate();
  }
  function onContextLost(event: Event) { event.preventDefault(); showFallback(); }

  try {
    // Test-only opt-in on the supplied canvas; the public API remains unchanged.
    if (canvas.dataset.accessLensForceFallback === 'true') throw new Error('Forced scene fallback');
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene.add(new THREE.AmbientLight(0xabc9ff, 2.1));
    const light = new THREE.DirectionalLight(0x639cff, 3);
    light.position.set(-3, 4, 6);
    scene.add(light);
    // Attach first so even a partially constructed model is cleaned up on failure.
    const websiteRoot = new THREE.Group();
    scene.add(websiteRoot);
    model = createWebsiteModel(websiteRoot);
    particles = createParticles();
    scene.add(particles.points);
    effect = createScanEffect();
    model.group.add(effect.halo, effect.mesh);
    model.setProfile(profile);
    interaction = createInteraction(canvas, camera, model.pickables, select);
    resize();
  } catch (error) {
    console.warn('AccessLens: using the selectable DOM alternative.', error);
    showFallback();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  window.addEventListener('resize', resize);
  media.addEventListener('change', onMotionChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  canvas.addEventListener('webglcontextlost', onContextLost);

  return {
    setProfile(next) {
      if (disposed) return;
      profile = next;
      model?.setProfile(next);
      lastTime = 0;
      updateFallback();
      invalidate();
    },
    setScanActive(active) {
      if (disposed || scanActive === active) return;
      scanActive = active;
      scanProgress = 0;
      scanStartedAt = performance.now();
      detected = false;
      model?.setIssues(false);
      updateFallback();
      invalidate();
    },
    setSelectedElement(id) {
      if (disposed) return;
      selected = id && validIds.has(id) ? id : null;
      model?.setSelected(selected);
      updateFallback();
      invalidate();
    },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      media.removeEventListener('change', onMotionChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      releaseWebGL();
      for (const button of fallbackButtons.values()) button.removeEventListener('click', onFallbackSelect);
      fallback?.remove();
      fallbackButtons.clear();
      fallbackStatus = null;
      fallback = null;
      canvas.style.display = originalDisplay;
    },
  };
}
