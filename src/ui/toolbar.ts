/**
 * ui/toolbar.ts — Canvas toolbar
 * Contains: view mode tabs, zoom controls, element count badge, report button
 */

import { appState } from '../state';
import type { AppState } from '../state';

export function createToolbar(
  onViewReport: () => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'canvas-toolbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Canvas controls');

  bar.innerHTML = `
    <!-- Scene label -->
    <span style="font-size:var(--text-xs);font-weight:600;color:var(--color-text-subtle);letter-spacing:0.06em;text-transform:uppercase;">
      3D VIEWPORT
    </span>

    <div style="flex:1"></div>

    <!-- Element count -->
    <div id="element-count" style="display:flex;align-items:center;gap:6px;font-size:var(--text-xs);color:var(--color-text-muted);" hidden>
      <span id="issue-count-badge" class="count-pill">0</span>
      <span>issues detected</span>
    </div>

    <!-- Divider -->
    <div style="width:1px;height:20px;background:var(--color-border);margin:0 4px;" id="toolbar-divider" hidden></div>

    <!-- View report button -->
    <button
      id="view-report-btn"
      class="btn btn-secondary btn-sm"
      aria-label="View full accessibility report"
      hidden
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
      Full Report
    </button>

    <!-- Camera hint -->
    <span id="camera-hint" style="font-size:var(--text-xs);color:var(--color-text-subtle);">
      Click elements to inspect
    </span>
  `;

  const countEl       = bar.querySelector<HTMLElement>('#element-count')!;
  const countBadge    = bar.querySelector<HTMLElement>('#issue-count-badge')!;
  const reportBtn     = bar.querySelector<HTMLButtonElement>('#view-report-btn')!;
  const divider       = bar.querySelector<HTMLElement>('#toolbar-divider')!;
  const cameraHint    = bar.querySelector<HTMLElement>('#camera-hint')!;

  reportBtn.addEventListener('click', onViewReport);
  reportBtn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewReport(); }
  });

  appState.subscribe((state: AppState) => {
    const hasResults = state.view === 'results' || state.view === 'report';
    const issueCount = state.scanResult?.issues.length ?? 0;

    if (hasResults) {
      countEl.hidden = false;
      divider.hidden = false;
      reportBtn.hidden = false;
      cameraHint.style.display = 'none';
      countBadge.textContent = String(issueCount);
    } else {
      countEl.hidden = true;
      divider.hidden = true;
      reportBtn.hidden = true;
      cameraHint.style.display = '';
    }
  });

  return bar;
}
