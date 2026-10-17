/**
 * app.ts — Part 3: Integration Owner
 * Orchestrates all modules:
 *   - Imports createAccessLensScene() from scene.ts (Part 1)
 *   - Imports applyProfile(), runAccessibilityScan(), getDemoIssues() from scanner.ts (Part 2)
 *   - Owns authoritative AppState
 *   - Wires profile ↔ scene + sample webpage
 *   - Wires scan progress → UI
 *   - Wires 3D click → issue selection
 *   - Renders complete shell: header, sidebar, canvas, details, report modal
 */

import { createAccessLensScene } from './scene';
import { applyProfile, runAccessibilityScan, getDemoIssues, PROFILES } from './scanner';
import type { Profile } from './scanner';
import { appState } from './state';

import { createHeader }       from './ui/header';
import { createToolbar }      from './ui/toolbar';
import { createIssuePanel, createDetailsPanel } from './ui/issuePanel';
import { createReportPanel }  from './ui/reportPanel';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

export function createApp(root: HTMLElement) {
  // ── Create 3D scene (Part 1) ───────────────────────────────────────────────
  const scene = createAccessLensScene();

  // ── Pre-link demo issues so elements are clickable before the first scan ───
  const demoIssues = getDemoIssues();
  scene.linkElementsToIssues(
    demoIssues.map(i => ({ id: i.id, elementId: i.elementId, severity: i.severity }))
  );

  // ── Build DOM structure ────────────────────────────────────────────────────
  root.innerHTML = '';

  //  Header
  const header = createHeader(handleProfileChange, handleScanClick);
  root.appendChild(header);

  //  App body
  const body = document.createElement('div');
  body.className = 'app-body';
  root.appendChild(body);

  //  Issue panel (left sidebar)
  const issuePanel = createIssuePanel(handleIssueSelect);
  body.appendChild(issuePanel);

  //  Canvas area (center)
  const canvasArea = document.createElement('main');
  canvasArea.className = 'canvas-area';
  canvasArea.id = 'main-content';
  canvasArea.setAttribute('aria-label', '3D accessibility canvas');
  body.appendChild(canvasArea);

  //  Toolbar
  const toolbar = createToolbar(handleViewReport);
  canvasArea.appendChild(toolbar);

  //  Canvas viewport
  const viewport = document.createElement('div');
  viewport.className = 'canvas-viewport';
  canvasArea.appendChild(viewport);

  //  Landing / Workspace Hero overlay
  const workspaceHero = createWorkspaceHero(handleScanClick, handleProfileChange);
  viewport.appendChild(workspaceHero);

  //  Website preview overlay (shows demo webpage)
  const preview = createWebsitePreview();
  viewport.appendChild(preview);

  //  Details panel (right)
  const detailsPanel = createDetailsPanel(handleDetailsClose);
  body.appendChild(detailsPanel);

  //  Report modal (full-screen overlay)
  const reportPanel = createReportPanel();
  root.appendChild(reportPanel);

  //  Toast container
  const toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  toastContainer.setAttribute('role', 'status');
  toastContainer.setAttribute('aria-live', 'polite');
  root.appendChild(toastContainer);

  // ── Mount 3D scene ─────────────────────────────────────────────────────────
  scene.mount(viewport);

  // ── Wire 3D element clicks → issue selection ───────────────────────────────
  scene.onElementClick((issueId: string) => {
    appState.selectIssue(issueId);
    // Ensure we're in results view to show the panel
    if (appState.state.view !== 'results' && appState.state.view !== 'report') {
      // Trigger a quick demo scan or just show the demo issue details
      showDemoIssue(issueId);
    }
  });

  // ── Resize observer ────────────────────────────────────────────────────────
  const ro = new ResizeObserver(() => scene.resize());
  ro.observe(viewport);

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  document.addEventListener('keydown', handleGlobalKey);

  // ── State → scene sync ────────────────────────────────────────────────────
  appState.subscribe(state => {
    // Landing hero visibility
    if (state.view === 'idle') {
      workspaceHero.classList.remove('hidden');
    } else {
      workspaceHero.classList.add('hidden');
    }
    // Update active profile chip
    workspaceHero.querySelectorAll<HTMLButtonElement>('.profile-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.profile === state.profile);
    });

    // Highlight selected element in 3D
    scene.highlightElement(state.selectedIssueId);

    // Profile → scene palette
    scene.setProfile(state.profile, state.reducedMotion);

    // Profile → sample webpage
    applyProfile(state.profile as Profile);
    applyProfileToPreview(state.profile as Profile, preview);

    // Profile → focus ring width
    const config = PROFILES.find(p => p.id === state.profile);
    if (config) {
      document.documentElement.style.setProperty('--focus-ring-width', `${config.focusRingWidth}px`);
    }
  });

  // ── Initial profile application ────────────────────────────────────────────
  applyProfile('default');

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleProfileChange(profileId: string) {
    appState.setProfile(profileId as Profile);
    showToast(`Profile: ${PROFILES.find(p => p.id === profileId)?.label ?? profileId}`, '🧑');
  }

  async function handleScanClick() {
    appState.startScan();

    try {
      const result = await runAccessibilityScan(
        appState.state.profile as Profile,
        progress => appState.updateScanProgress(progress),
      );

      // Link issues to 3D scene elements
      scene.linkElementsToIssues(
        result.issues.map(i => ({ id: i.id, elementId: i.elementId, severity: i.severity }))
      );

      appState.completeScan(result);

      const count = result.issues.length;
      showToast(
        `Scan complete — ${count} issue${count !== 1 ? 's' : ''} found`,
        count === 0 ? '✅' : '⚠️',
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      appState.failScan(msg);
      showToast(`Scan failed: ${msg}`, '❌');
    }
  }

  function handleIssueSelect(issueId: string | null) {
    appState.selectIssue(issueId);
  }

  function handleDetailsClose() {
    appState.selectIssue(null);
  }

  function handleViewReport() {
    appState.openReport();
  }

  function handleGlobalKey(e: KeyboardEvent) {
    // Escape: close details / deselect
    if (e.key === 'Escape') {
      if (appState.state.view === 'report') return; // report handles its own Esc
      if (appState.state.selectedIssueId) {
        e.preventDefault();
        appState.selectIssue(null);
      }
    }
    // Ctrl/Cmd + S: trigger scan
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (appState.state.view !== 'scanning') handleScanClick();
    }
    // Ctrl/Cmd + R: open report
    if ((e.ctrlKey || e.metaKey) && e.key === 'r' && appState.state.scanResult) {
      e.preventDefault();
      handleViewReport();
    }
  }

  // ── Show a demo issue without running a full scan ──────────────────────────
  function showDemoIssue(issueId: string) {
    const issue = demoIssues.find(i => i.id === issueId);
    if (!issue) return;
    // Create a minimal fake result so the UI can show the details panel
    const fakeResult = {
      issues: demoIssues,
      passedChecks: 37,
      testedElements: 47,
      score: 72,
      duration: 0,
    };
    appState.completeScan(fakeResult);
    appState.selectIssue(issueId);
  }

  // ── Toast notification ─────────────────────────────────────────────────────
  function showToast(message: string, icon: string = 'ℹ️') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span aria-hidden="true">${icon}</span><span>${escHtml(message)}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = `opacity var(--duration-slow) var(--ease-in)`;
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  return { scene, appState };
}

// ── Workspace Landing Hero ────────────────────────────────────────────────────

function createWorkspaceHero(
  onScan: () => void,
  onProfile: (profile: string) => void,
): HTMLElement {
  const hero = document.createElement('div');
  hero.className = 'workspace-hero';
  hero.innerHTML = `
    <div class="hero-pill">
      <span>✦</span>
      <span>Spatial Accessibility Studio</span>
    </div>
    <h1 class="hero-title">Audit Web Accessibility in 3D</h1>
    <p class="hero-subtitle">
      Inspect interactive DOM elements in an immersive 3D canvas. Simulate vision, motor, and cognitive profiles, and discover WCAG compliance barriers in real-time.
    </p>
    <div class="hero-actions">
      <button class="btn btn-primary btn-lg" id="hero-scan-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        Run Accessibility Scan
      </button>
    </div>
    <div class="profile-chips" role="radiogroup" aria-label="Quick profile selector">
      ${PROFILES.map(p => `
        <button class="profile-chip${p.id === 'default' ? ' active' : ''}" data-profile="${p.id}" role="radio" aria-checked="${p.id === 'default'}" title="${p.description}">
          <span>${p.icon}</span>
          <span>${p.label}</span>
        </button>
      `).join('')}
    </div>
  `;

  hero.querySelector('#hero-scan-btn')?.addEventListener('click', onScan);
  hero.querySelectorAll<HTMLButtonElement>('.profile-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const pid = chip.dataset.profile;
      if (pid) onProfile(pid);
    });
  });

  return hero;
}

// ── Website preview (demo sample page) ────────────────────────────────────────

function createWebsitePreview(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'website-preview';
  wrap.setAttribute('aria-label', 'Sample website preview');

  const bar = document.createElement('div');
  bar.className = 'website-preview-bar';
  bar.innerHTML = `
    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--color-pass);"></span>
    <span>Target Webpage (Live DOM)</span>
  `;
  wrap.appendChild(bar);

  // Create srcdoc iframe with a minimal sample page
  const iframe = document.createElement('iframe');
  iframe.title = 'Sample website for accessibility audit';
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.setAttribute('loading', 'lazy');
  iframe.srcdoc = buildSamplePageHTML('default');
  wrap.appendChild(iframe);

  return wrap;
}

function applyProfileToPreview(profileId: string, preview: HTMLElement) {
  const iframe = preview.querySelector('iframe');
  if (!iframe) return;
  iframe.srcdoc = buildSamplePageHTML(profileId);
}

function buildSamplePageHTML(profileId: string): string {
  const styles: Record<string, string> = {
    default:    'background:#fff;color:#111;',
    colorblind: 'background:#fff;color:#111;filter:url(#deuteranopia);',
    lowvision:  'background:#000;color:#fff;font-size:200%;filter:contrast(1.4);',
    motor:      'background:#fff;color:#111;',
    cognitive:  'background:#fafafa;color:#222;font-size:110%;letter-spacing:0.03em;',
  };
  const bodyStyle = styles[profileId] ?? styles.default;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sample Website</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; ${bodyStyle} }
  nav  { background: #4338ca; color: #e0e0e0; padding: 8px 16px;
         display: flex; gap: 12px; align-items: center; }
  nav .brand { font-weight: 700; color: #e0e0e0; margin-right: auto; }
  nav a { color: #e0e0e0; font-size: 12px; }
  main { padding: 16px; }
  h1   { font-size: 20px; margin-bottom: 8px; }
  h3   { font-size: 14px; color: #555; margin-bottom: 12px; }
  .btn { background: #818cf8; color: #e0e0e0; border: none;
         padding: 6px 14px; border-radius: 4px; cursor: pointer; }
  .field { margin-top: 12px; }
  input  { border: 1px solid #ddd; padding: 6px 10px; border-radius: 4px;
           width: 180px; font-size: 12px; }
  img  { width: 120px; height: 80px; object-fit: cover;
         background: #c7d2fe; border-radius: 4px; float: right; margin: 0 0 8px 12px; }
  footer { margin-top: 16px; font-size: 10px; color: #999; }
  footer a { color: #999; }
</style>
</head>
<body>
<svg style="position: absolute; width: 0; height: 0; pointer-events: none;" aria-hidden="true">
  <defs>
    <filter id="deuteranopia">
      <feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0" />
    </filter>
  </defs>
</svg>
<nav>
  <span class="brand">Acme Co</span>
  <a href="#">Home</a>
  <a href="#">About</a>
  <a href="#">Contact</a>
</nav>
<main>
  <!-- BUG: missing alt on img -->
  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80'%3E%3Crect width='120' height='80' fill='%23c7d2fe'/%3E%3C/svg%3E">
  <h1>Welcome to Acme</h1>
  <!-- BUG: jumps from h1 to h3 -->
  <h3>Discover our features</h3>
  <!-- BUG: ambiguous CTA contrast -->
  <button class="btn">Get Started</button>
  <div class="field">
    <!-- BUG: input has no label -->
    <input type="email" placeholder="Enter email">
    <!-- BUG: no focus ring on submit -->
    <button type="submit" style="outline:none;border:none;background:#4338ca;color:#fff;
      padding:6px 12px;border-radius:4px;cursor:pointer;margin-left:4px;">
      Subscribe
    </button>
  </div>
</main>
<footer>
  <!-- BUG: opens in new tab without warning -->
  <a href="#" target="_blank">Click here</a> · <a href="#" target="_blank">Privacy</a>
</footer>
</body>
</html>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
