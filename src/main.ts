import './styles.css';
import type { AccessibilityProfile, AppState } from './types';
import { createReport, ELEMENT_REPORTS } from './report';
import type { ScanPhase } from './report';
import type { createAccessLensScene } from './scene/createScene';

const PROFILE_DESCRIPTIONS: Record<AccessibilityProfile, string> = {
  default: 'Blue glass, a gently floating website, and a new way to explore.',
  'low-vision': 'Larger scene text, brighter outlines, and less visual clutter.',
  dyslexia: 'Warm tones, familiar letterforms, and more room between lines.',
  motor: 'More generous scene targets and a clearer primary action.',
  'reduced-motion': 'A still scene with all element selection available.',
};

function mountApp(root: HTMLElement) {
  function get<T extends HTMLElement>(id: string) {
    const element = root.querySelector<T>(`#${id}`);
    if (!element) throw new Error(`Missing AccessLens interface element: ${id}`);
    return element;
  }
  // The integration layer is the only owner of AppState. Scene/report receive updates.
  const state: AppState = { profile: 'default', contrast: false, textScale: 1, reducedMotion: false };
  let phase: ScanPhase = 'idle';
  let selectedId: string | null = null;
  let scene: ReturnType<typeof createAccessLensScene> | null = null;
  let scanTimer: number | undefined;
  let scanStartedAt = 0;
  let disposed = false;
  let mounting = false;
  let sceneUnavailable = false;
  const events = new AbortController();
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = get<HTMLCanvasElement>('access-lens-canvas');
  const host = get('scene-host');
  const profile = get<HTMLSelectElement>('profile-select');
  const contrast = get<HTMLInputElement>('contrast-toggle');
  const motion = get<HTMLInputElement>('motion-toggle');
  const scale = get<HTMLInputElement>('text-scale');
  const scanButton = get<HTMLButtonElement>('scan-button');
  const resetDemo = get<HTMLButtonElement>('reset-demo');
  const progress = get<HTMLProgressElement>('scan-progress');
  const clearSelection = get<HTMLButtonElement>('clear-selection');
  const retry = get<HTMLButtonElement>('retry-scene');
  const announcement = get('announcement');
  const report = createReport(get('report-items'), selectElement, events.signal);

  function announce(message: string) { announcement.textContent = message; }
  function renderReport() {
    report.render(phase, selectedId);
    const element = ELEMENT_REPORTS.find(item => item.id === selectedId);
    clearSelection.disabled = !element;
    get('selected-name').textContent = element ? `${element.name} selected` : 'No element selected';
    get('detail-heading').textContent = element ? phase === 'completed' ? element.title : element.name : 'Every element matters.';
    get('detail-description').textContent = element ? phase === 'completed' ? element.explanation : element.description : 'Choose an element to see its role in the experience. Run a demo scan for illustrative improvements.';
    get('detail-improvement').hidden = !element || phase !== 'completed';
    get('detail-suggestion').textContent = element?.suggestion ?? '';
    get('findings-summary').hidden = phase !== 'completed';
  }
  function selectElement(id: string | null) {
    if (disposed) return;
    const element = ELEMENT_REPORTS.find(item => item.id === id);
    selectedId = element?.id ?? null;
    scene?.setSelectedElement(selectedId);
    renderReport();
    announce(element ? `${element.name} selected. ${phase === 'completed' ? 'Example details are available in the element report.' : 'Run the demo scan for example improvements.'}` : 'Selection cleared.');
  }
  function renderPhase() {
    get('scan-status-card').dataset.phase = phase;
    get('scan-status-heading').textContent = phase === 'idle' ? 'Ready to explore' : phase === 'scanning' ? 'Exploring the example…' : 'Demo scan complete';
    get('scan-status-description').textContent = phase === 'idle' ? 'Run the demo scan to reveal three example findings. You can select any element now.' : phase === 'scanning' ? 'Following five elements in this procedural example. No website audit is being performed.' : '3 illustrative findings and 2 review notes. Select an element to explore possible improvements.';
    get('scan-button-label').textContent = !scene && !sceneUnavailable ? 'Loading explorer…' : phase === 'scanning' ? 'Scanning demo…' : phase === 'completed' ? 'Run scan again' : 'Run demo scan';
    scanButton.disabled = (!scene && !sceneUnavailable) || phase === 'scanning';
    resetDemo.disabled = phase === 'idle';
    progress.hidden = phase !== 'scanning';
    get('scan-percent').hidden = phase !== 'scanning';
    renderReport();
  }
  function renderMotion() {
    root.dataset.motion = motionPreference.matches || state.reducedMotion || state.profile === 'reduced-motion' ? 'reduced' : 'full';
    get('motion-note').textContent = motionPreference.matches ? 'Your system preference keeps motion reduced in every profile.' : state.reducedMotion && state.profile !== 'reduced-motion' ? 'Motion override is on. The scene uses its reduced-motion profile; your chosen UI perspective is preserved.' : state.profile === 'reduced-motion' ? 'The reduced-motion profile keeps the scene still. Selection stays available.' : 'Motion respects your system preference. You can keep the scene still at any time.';
  }
  function updateState(patch: Partial<AppState>) {
    Object.assign(state, patch);
    root.dataset.profile = state.profile;
    root.dataset.contrast = String(state.contrast);
    document.documentElement.style.setProperty('--ui-scale', String(state.textScale));
    profile.value = state.profile;
    contrast.checked = state.contrast;
    motion.checked = state.reducedMotion;
    scale.value = String(Math.round(state.textScale * 100));
    scale.setAttribute('aria-valuetext', `${scale.value} percent`);
    get('text-scale-value').textContent = `${scale.value}%`;
    get('profile-description').textContent = PROFILE_DESCRIPTIONS[state.profile];
    renderMotion();
    scene?.setProfile(state.reducedMotion ? 'reduced-motion' : state.profile);
  }
  function stopScanTimer() {
    if (scanTimer !== undefined) window.clearTimeout(scanTimer);
    scanTimer = undefined;
  }
  function tickScan() {
    if (disposed || phase !== 'scanning') return;
    const elapsed = performance.now() - scanStartedAt;
    progress.value = Math.min(100, Math.round(elapsed / 40));
    get('scan-percent').textContent = `${progress.value}%`;
    if (elapsed >= 4000) {
      stopScanTimer();
      phase = 'completed';
      // Leave scene scanning active: its completed illustrative markers remain visible.
      renderPhase();
      announce('Demo scan complete. Three illustrative findings and two review notes are available. No real website was audited.');
    } else scanTimer = window.setTimeout(tickScan, 100);
  }
  function startScan() {
    if (disposed || (!scene && !sceneUnavailable) || phase === 'scanning') return;
    stopScanTimer();
    scene?.setScanActive(false);
    scene?.setScanActive(true);
    phase = 'scanning';
    scanStartedAt = performance.now();
    progress.value = 0;
    renderPhase();
    announce('Demo scan started. Illustrative findings will be available in a few seconds.');
    tickScan();
  }
  function resetScan() {
    stopScanTimer();
    phase = 'idle';
    scene?.setScanActive(false);
    selectedId = null;
    scene?.setSelectedElement(null);
    renderPhase();
    announce('Demo reset. Preferences are preserved.');
  }
  function renderViewportMode() {
    if (!scene || disposed) return;
    const alternative = !!host.querySelector('[data-access-lens-fallback]');
    get('viewport-mode').textContent = alternative ? 'TEXT ALTERNATIVE' : 'LIVE 3D VIEW';
    retry.hidden = !alternative;
    get('scene-instructions').textContent = alternative ? 'The 3D view is unavailable. Use the alternative or the element report to select.' : '⌖ Select a website panel or use the element report.';
  }
  const fallbackObserver = new MutationObserver(renderViewportMode);
  fallbackObserver.observe(host, { childList: true });
  async function mountScene() {
    if (disposed || mounting) return;
    mounting = true;
    sceneUnavailable = false;
    scene?.dispose();
    scene = null;
    host.setAttribute('aria-busy', 'true');
    get('scene-loading').hidden = false;
    root.querySelector<HTMLElement>('.loading-orbit')!.hidden = false;
    get('loading-label').textContent = 'Preparing your perspective…';
    retry.hidden = true;
    renderPhase();
    try {
      const { createAccessLensScene } = await import('./scene/createScene');
      if (disposed) return;
      scene = createAccessLensScene(canvas, { onSelectElement: selectElement });
      scene.setProfile(state.reducedMotion ? 'reduced-motion' : state.profile);
      scene.setScanActive(phase !== 'idle');
      scene.setSelectedElement(selectedId);
      get('scene-loading').hidden = true;
      renderViewportMode();
    } catch (error) {
      sceneUnavailable = true;
      console.error('AccessLens could not load the explorer.', error);
      root.querySelector<HTMLElement>('.loading-orbit')!.hidden = true;
      get('loading-label').textContent = 'The 3D module could not load. The element report and demo scan are still available.';
      get('viewport-mode').textContent = 'PREVIEW UNAVAILABLE';
      retry.hidden = false;
      announce('3D preview unavailable. Select elements in the report or retry the view.');
    } finally {
      mounting = false;
      if (!disposed) { host.setAttribute('aria-busy', 'false'); renderPhase(); }
    }
  }

  profile.addEventListener('change', () => updateState({ profile: profile.value as AccessibilityProfile }), { signal: events.signal });
  contrast.addEventListener('change', () => updateState({ contrast: contrast.checked }), { signal: events.signal });
  motion.addEventListener('change', () => updateState({ reducedMotion: motion.checked }), { signal: events.signal });
  scale.addEventListener('input', () => updateState({ textScale: Number(scale.value) / 100 }), { signal: events.signal });
  get('reset-preferences').addEventListener('click', () => { updateState({ profile: 'default', contrast: false, textScale: 1, reducedMotion: false }); announce('Display preferences reset. Your system motion preference is still respected.'); }, { signal: events.signal });
  clearSelection.addEventListener('click', () => selectElement(null), { signal: events.signal });
  scanButton.addEventListener('click', startScan, { signal: events.signal });
  resetDemo.addEventListener('click', resetScan, { signal: events.signal });
  retry.addEventListener('click', () => { resetScan(); void mountScene(); }, { signal: events.signal });
  motionPreference.addEventListener('change', renderMotion, { signal: events.signal });
  updateState({});
  renderPhase();
  void mountScene();

  return () => {
    if (disposed) return;
    disposed = true;
    stopScanTimer();
    events.abort();
    fallbackObserver.disconnect();
    scene?.dispose();
    scene = null;
    document.documentElement.style.removeProperty('--ui-scale');
  };
}

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('AccessLens requires an #app element.');
let disposeApp = mountApp(root);
window.addEventListener('pagehide', () => disposeApp());
window.addEventListener('pageshow', event => { if (event.persisted) disposeApp = mountApp(root); });
