/**
 * ui/reportPanel.ts — Full-screen accessibility report modal
 * Score ring, stat grid, severity breakdown, issue table, export button
 */

import { appState } from '../state';
import type { AppState } from '../state';
import type { ScanResult } from '../scanner';

export function createReportPanel(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'overlay-backdrop';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'report-title');
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="modal" style="width:min(740px,92vw);max-height:88vh;" id="report-modal">
      <!-- Header -->
      <div class="modal-header">
        <div>
          <h2 id="report-title" style="font-size:var(--text-lg);font-weight:700;margin:0;">
            Accessibility Report
          </h2>
          <p style="font-size:var(--text-sm);color:var(--color-text-muted);margin:4px 0 0;">
            <span id="report-profile"></span> · <span id="report-time"></span>
          </p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-secondary btn-sm" id="export-btn" aria-label="Export report as JSON">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
          <button class="icon-btn" id="close-report" aria-label="Close report">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="modal-body" id="report-body">
        <!-- Filled by JS -->
      </div>
    </div>
  `;

  const body       = overlay.querySelector<HTMLElement>('#report-body')!;
  const closeBtn   = overlay.querySelector<HTMLButtonElement>('#close-report')!;
  const exportBtn  = overlay.querySelector<HTMLButtonElement>('#export-btn')!;
  const profileEl  = overlay.querySelector<HTMLElement>('#report-profile')!;
  const timeEl     = overlay.querySelector<HTMLElement>('#report-time')!;

  // Close via button or backdrop click
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  // Keyboard escape
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });

  // Export
  exportBtn.addEventListener('click', () => {
    const { scanResult, profile } = appState.state;
    if (!scanResult) return;
    const data = {
      profile,
      timestamp: new Date().toISOString(),
      score: scanResult.score,
      testedElements: scanResult.testedElements,
      passedChecks: scanResult.passedChecks,
      issues: scanResult.issues.map(i => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        wcag: i.wcag.map(w => w.id),
        recommendation: i.recommendation,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accesslens-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  function close() {
    appState.closeReport();
    overlay.hidden = true;
  }

  // ── State subscription ──────────────────────────────────────────────────────
  appState.subscribe((state: AppState) => {
    const visible = state.view === 'report';
    overlay.hidden = !visible;

    if (visible && state.scanResult) {
      const { scanResult, profile } = state;
      profileEl.textContent = `Profile: ${profile}`;
      timeEl.textContent = `${Math.round(scanResult.duration / 1000)}s scan`;
      body.innerHTML = renderReport(scanResult);
      // Focus modal for keyboard users
      setTimeout(() => overlay.querySelector<HTMLElement>('#close-report')?.focus(), 50);
    }
  });

  return overlay;
}

function renderReport(result: ScanResult): string {
  const { issues, score, testedElements, passedChecks } = result;

  const counts = {
    critical: issues.filter(i => i.severity === 'critical').length,
    serious:  issues.filter(i => i.severity === 'serious').length,
    moderate: issues.filter(i => i.severity === 'moderate').length,
    minor:    issues.filter(i => i.severity === 'minor').length,
  };

  const total = issues.length;

  // Score ring SVG
  const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#f43f5e';
  const circumference = 2 * Math.PI * 36; // r=36
  const dash = (score / 100) * circumference;

  return `
    <!-- Score + stats row -->
    <div style="display:flex;gap:var(--space-6);align-items:flex-start;margin-bottom:var(--space-6);flex-wrap:wrap;">

      <!-- Score ring -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex-shrink:0;">
        <div style="position:relative;width:100px;height:100px;">
          <svg width="100" height="100" viewBox="0 0 100 100" role="img" aria-label="Accessibility score ${score} out of 100">
            <circle cx="50" cy="50" r="36" fill="none" stroke="var(--color-surface-3)" stroke-width="8"/>
            <circle cx="50" cy="50" r="36" fill="none" stroke="${scoreColor}" stroke-width="8"
                    stroke-dasharray="${dash.toFixed(1)} ${circumference.toFixed(1)}"
                    stroke-dashoffset="${(circumference * 0.25).toFixed(1)}"
                    stroke-linecap="round"
                    transform="rotate(-90 50 50)"/>
          </svg>
          <div style="
            position:absolute;inset:0;display:flex;flex-direction:column;
            align-items:center;justify-content:center;
          ">
            <span style="font-size:var(--text-xl);font-weight:800;color:${scoreColor};line-height:1;">${score}</span>
            <span style="font-size:var(--text-xs);color:var(--color-text-muted);">/ 100</span>
          </div>
        </div>
        <p style="font-size:var(--text-xs);color:var(--color-text-muted);text-align:center;margin:0;">
          Accessibility<br>Score
        </p>
      </div>

      <!-- Stats -->
      <div class="stat-grid" style="flex:1;min-width:200px;">
        <div class="stat-card">
          <span class="stat-card-value">${total}</span>
          <span class="stat-card-label">Total Issues</span>
        </div>
        <div class="stat-card">
          <span class="stat-card-value" style="color:var(--color-pass)">${passedChecks}</span>
          <span class="stat-card-label">Checks Passed</span>
        </div>
        <div class="stat-card">
          <span class="stat-card-value">${testedElements}</span>
          <span class="stat-card-label">Elements Tested</span>
        </div>
        <div class="stat-card">
          <span class="stat-card-value" style="color:var(--color-critical)">${counts.critical}</span>
          <span class="stat-card-label">Critical Issues</span>
        </div>
      </div>
    </div>

    <!-- Severity breakdown bars -->
    <div style="margin-bottom:var(--space-6);">
      <p class="section-label">Severity Breakdown</p>
      ${renderImpactRow('Critical', counts.critical, total, 'var(--color-critical)')}
      ${renderImpactRow('Serious',  counts.serious,  total, 'var(--color-serious)')}
      ${renderImpactRow('Moderate', counts.moderate, total, 'var(--color-moderate)')}
      ${renderImpactRow('Minor',    counts.minor,    total, 'var(--color-minor)')}
    </div>

    <!-- Issue table -->
    <div>
      <p class="section-label">All Issues</p>
      <div style="border:1px solid var(--color-border);border-radius:var(--radius-md);overflow:hidden;">
        <table style="
          width:100%;border-collapse:collapse;
          font-size:var(--text-xs);
        " role="table" aria-label="Accessibility issues table">
          <thead>
            <tr style="background:var(--color-surface-2);">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:var(--color-text-muted);border-bottom:1px solid var(--color-border);" scope="col">Issue</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:var(--color-text-muted);border-bottom:1px solid var(--color-border);width:90px;" scope="col">Severity</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:var(--color-text-muted);border-bottom:1px solid var(--color-border);width:80px;" scope="col">WCAG</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:var(--color-text-muted);border-bottom:1px solid var(--color-border);width:100px;" scope="col">Domain</th>
            </tr>
          </thead>
          <tbody>
            ${issues.map((issue, idx) => `
              <tr style="border-bottom:${idx < issues.length - 1 ? '1px solid var(--color-border)' : 'none'};"
                  role="row">
                <td style="padding:10px 12px;color:var(--color-text);">${escHtml(issue.title)}</td>
                <td style="padding:10px 12px;">
                  <span class="badge badge-${issue.severity}">${issue.severity}</span>
                </td>
                <td style="padding:10px 12px;font-family:var(--font-mono);color:var(--color-text-muted);">
                  ${issue.wcag.map(w => w.id).join(', ')}
                </td>
                <td style="padding:10px 12px;color:var(--color-text-muted);text-transform:capitalize;">
                  ${issue.domain}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderImpactRow(label: string, count: number, total: number, color: string): string {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return `
    <div class="impact-row">
      <span class="impact-label">${label}</span>
      <div class="impact-track">
        <div class="impact-fill" style="width:${pct.toFixed(1)}%;background:${color};"></div>
      </div>
      <span class="impact-count" style="color:${color}">${count}</span>
    </div>
  `;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
