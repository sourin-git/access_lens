import './scene-test.css';
import { createAccessLensScene } from './scene/createScene';
import { SELECTABLE_ELEMENTS } from './scene/createWebsiteModel';
import type { AccessibilityProfile } from './types';

function get<T extends HTMLElement>(id: string) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing test control: ${id}`);
  return element as T;
}
const canvas = get<HTMLCanvasElement>('scene');
const profile = get<HTMLSelectElement>('profile');
const scan = get<HTMLInputElement>('scan');
const fallback = get<HTMLInputElement>('fallback');
const stage = get('stage');
const selected = get('selected');
const controls = get('element-controls');
const lifecycle = get('lifecycle');
let scene: ReturnType<typeof createAccessLensScene> | null = null;
let mounts = 0;
let selectedId: string | null = null;
const buttons = new Map<string, HTMLButtonElement>();
const descriptions: Record<AccessibilityProfile, string> = {
  default: 'Default · blue glass, lime accents, gentle float and restrained particles.',
  'low-vision': 'Low vision · larger type, opaque dark panels, bright outlines, no particles.',
  dyslexia: 'Dyslexia · warm paper tones, Verdana, greater line spacing, no particles.',
  motor: 'Motor · expanded hit areas, stronger outlines, a lime primary action.',
  'reduced-motion': 'Reduced motion · fixed camera and panels, static particles and scan, selection stays available.',
};
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) profile.value = 'reduced-motion';
// This query parameter only affects this independent harness.
fallback.checked = new URLSearchParams(location.search).get('fallback') === '1';

function showSelection(id: string | null) {
  selectedId = id;
  selected.textContent = `Selected element: ${id ?? 'none'}`;
  for (const [elementId, button] of buttons) button.setAttribute('aria-pressed', String(elementId === id));
}
function setDescription() { get('profile-description').textContent = descriptions[profile.value as AccessibilityProfile]; }
function mount() {
  scene?.dispose();
  canvas.style.display = 'block';
  canvas.dataset.accessLensForceFallback = String(fallback.checked);
  scene = createAccessLensScene(canvas, { onSelectElement: showSelection });
  scene.setProfile(profile.value as AccessibilityProfile);
  scene.setSelectedElement(selectedId);
  scene.setScanActive(scan.checked);
  get('unmounted').hidden = true;
  lifecycle.textContent = `Scene mounted (${++mounts}). ${fallback.checked ? 'Forced fallback enabled.' : 'WebGL preview requested.'}`;
}
for (const element of SELECTABLE_ELEMENTS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = element.label;
  button.dataset.elementId = element.id;
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => { scene?.setSelectedElement(element.id); showSelection(element.id); });
  buttons.set(element.id, button);
  controls.append(button);
}
profile.addEventListener('change', () => { scene?.setProfile(profile.value as AccessibilityProfile); setDescription(); });
scan.addEventListener('change', () => scene?.setScanActive(scan.checked));
get('narrow').addEventListener('change', (event) => {
  stage.classList.toggle('narrow', (event.target as HTMLInputElement).checked);
  // Exercise ResizeObserver independently of the explicit resize control.
});
fallback.addEventListener('change', mount);
get('resize').addEventListener('click', () => { scene?.resize(); lifecycle.textContent = `Resize requested: ${Math.round(stage.clientWidth)} × ${Math.round(stage.clientHeight)}.`; });
get('dispose').addEventListener('click', () => {
  scene?.dispose(); scene = null;
  canvas.style.display = 'none';
  get('unmounted').hidden = false;
  lifecycle.textContent = 'Scene disposed. Animation, observers, listeners, fallback, and GPU resources released.';
});
get('remount').addEventListener('click', mount);
get('clear').addEventListener('click', () => { scene?.setSelectedElement(null); showSelection(null); });
window.addEventListener('pagehide', () => { scene?.dispose(); scene = null; });
setDescription();
mount();
