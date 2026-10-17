/**
 * ui/header.ts — Top navigation bar
 * Contains: logo, profile selector, reduced-motion toggle, scan button, scan progress
 */

import { appState } from '../state';
import type { AppState } from '../state';
import { PROFILES } from '../scanner';

export function createHeader(
  onProfileChange: (profileId: string) => void,
  onScanClick: () => void,
): HTMLElement {
  const header = document.createElement('header');
  header.className = 'app-header';
  header.setAttribute('role', 'banner');

  header.innerHTML = `
    <!-- Logo -->
    <a href="#" class="logo" aria-label="AccessLens home">
      <div class="logo-icon" aria-hidden="true">♿</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="logo-text">AccessLens</span>
        <span class="badge badge-neutral" style="font-size:10px;padding:2px 6px;text-transform:uppercase;letter-spacing:0.04em;">Studio</span>
      </div>
    </a>

    <!-- Spacer -->
    <div style="flex:1"></div>

    <!-- Reduced motion toggle -->
    <div class="header-rm-toggle" style="display:flex;align-items:center;gap:8px;">
      <label for="rm-toggle" style="font-size:var(--text-xs);color:var(--color-text-muted);cursor:pointer;white-space:nowrap;">
        Reduce motion
      </label>
      <button
        id="rm-toggle"
        role="switch"
        aria-checked="false"
        class="rm-switch"
        title="Toggle reduced motion"
        style="
          position:relative;width:36px;height:20px;border-radius:10px;border:none;
          background:var(--color-surface-3);border:1px solid var(--color-border);
          cursor:pointer;transition:background var(--duration-fast);outline:none;
          flex-shrink:0;
        "
      >
        <span class="rm-switch-thumb" style="
          position:absolute;top:2px;left:2px;width:14px;height:14px;
          border-radius:50%;background:var(--color-text-muted);
          transition:left var(--duration-fast),background var(--duration-fast);
        "></span>
      </button>
    </div>

    <!-- Profile selector -->
    <div class="select-wrap" style="flex-shrink:0;">
      <select id="profile-select" class="select" aria-label="Accessibility profile">
        ${PROFILES.map(p => `<option value="${p.id}">${p.icon} ${p.label}</option>`).join('')}
      </select>
    </div>

    <!-- Scan button -->
    <button id="scan-btn" class="scan-btn" aria-label="Run accessibility scan">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <span class="scan-btn-label">Scan</span>
    </button>

    <!-- Progress strip (hidden by default) -->
    <div id="header-progress" class="header-progress" hidden style="
      display:flex;align-items:center;gap:10px;
      background:var(--color-surface-2);border:1px solid var(--color-border);
      border-radius:var(--radius-md);padding:6px 12px;min-width:200px;
    ">
      <div class="spinner"></div>
      <div style="flex:1;min-width:0">
        <div id="progress-label" style="font-size:var(--text-xs);color:var(--color-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          Scanning…
        </div>
        <div class="progress-bar-wrap" style="margin-top:4px;">
          <div id="progress-fill" class="progress-bar-fill" style="width:0%"></div>
        </div>
      </div>
      <span id="progress-pct" style="font-size:var(--text-xs);font-weight:600;color:var(--color-text-muted);min-width:28px;text-align:right;">0%</span>
    </div>
  `;

  // Grab refs
  const profileSelect = header.querySelector<HTMLSelectElement>('#profile-select')!;
  const scanBtn       = header.querySelector<HTMLButtonElement>('#scan-btn')!;
  const rmToggle      = header.querySelector<HTMLButtonElement>('#rm-toggle')!;
  const rmThumb       = header.querySelector<HTMLSpanElement>('.rm-switch-thumb')!;
  const progressBox   = header.querySelector<HTMLDivElement>('#header-progress')!;
  const progressLabel = header.querySelector<HTMLDivElement>('#progress-label')!;
  const progressFill  = header.querySelector<HTMLDivElement>('#progress-fill')!;
  const progressPct   = header.querySelector<HTMLSpanElement>('#progress-pct')!;

  // Event: profile change
  profileSelect.addEventListener('change', () => {
    onProfileChange(profileSelect.value);
  });

  // Event: scan
  scanBtn.addEventListener('click', () => {
    if (!scanBtn.disabled) onScanClick();
  });
  scanBtn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scanBtn.click(); }
  });

  // Event: reduced motion toggle
  rmToggle.addEventListener('click', () => {
    const next = rmToggle.getAttribute('aria-checked') !== 'true';
    appState.setReducedMotion(next);
  });
  rmToggle.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rmToggle.click(); }
  });
  rmToggle.addEventListener('focus', () => { rmToggle.style.boxShadow = '0 0 0 2px var(--color-accent)'; });
  rmToggle.addEventListener('blur',  () => { rmToggle.style.boxShadow = ''; });

  // ── State subscription ─────────────────────────────────────────────────────
  appState.subscribe((state: AppState) => {
    const scanning = state.view === 'scanning';

    // Sync profile select (without triggering change)
    if (profileSelect.value !== state.profile) profileSelect.value = state.profile;

    // Scan button state
    scanBtn.disabled = scanning;
    scanBtn.querySelector('.scan-btn-label')!.textContent = scanning ? 'Scanning…' : 'Scan';

    // Progress visibility
    if (scanning && state.scanProgress) {
      progressBox.hidden = false;
      scanBtn.style.display = 'none';
      progressLabel.textContent = state.scanProgress.message;
      progressFill.style.width = `${state.scanProgress.percent}%`;
      progressPct.textContent = `${state.scanProgress.percent}%`;
    } else {
      progressBox.hidden = true;
      scanBtn.style.display = '';
    }

    // Reduced motion toggle
    const checked = state.reducedMotion;
    rmToggle.setAttribute('aria-checked', String(checked));
    rmToggle.style.background = checked ? 'var(--color-accent)' : 'var(--color-surface-3)';
    rmThumb.style.left = checked ? '18px' : '2px';
    rmThumb.style.background = checked ? '#fff' : 'var(--color-text-muted)';
  });

  return header;
}
