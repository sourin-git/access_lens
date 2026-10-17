/**
 * ui/issuePanel.ts — Left sidebar: issue list + details panel
 * Issue list: filterable, sortable, keyboard-navigable cards
 * Details: WCAG info, recommendation, code snippet
 */

import { appState } from '../state';
import type { AppState } from '../state';
import type { AccessibilityIssue, Severity } from '../scanner';

// ── Helpers ────────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Severity[] = ['critical', 'serious', 'moderate', 'minor'];

function severityLabel(s: Severity): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function domainIcon(d: string): string {
  const icons: Record<string, string> = {
    perceivable:    '👁',
    operable:       '⌨️',
    understandable: '🧩',
    robust:         '🔧',
  };
  return icons[d] ?? '●';
}

// ── Issue list sidebar ─────────────────────────────────────────────────────────

export function createIssuePanel(
  onIssueSelect: (issueId: string | null) => void,
): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.setAttribute('aria-label', 'Accessibility issues');

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <h2 style="font-size:var(--text-sm);font-weight:700;color:var(--color-text);margin:0;">
          Issues
        </h2>
        <span id="issue-total-badge" class="count-pill" style="display:none"></span>
      </div>

      <!-- Filter tabs -->
      <div class="tabs" id="severity-tabs" role="tablist" aria-label="Filter by severity" style="display:none">
        <button class="tab active" role="tab" aria-selected="true"  data-filter="all"      aria-controls="issue-list">All</button>
        <button class="tab"        role="tab" aria-selected="false" data-filter="critical"  aria-controls="issue-list">
          <span style="color:var(--color-critical)">●</span> Crit
        </button>
        <button class="tab"        role="tab" aria-selected="false" data-filter="serious"   aria-controls="issue-list">
          <span style="color:var(--color-serious)">●</span> High
        </button>
        <button class="tab"        role="tab" aria-selected="false" data-filter="moderate"  aria-controls="issue-list">
          <span style="color:var(--color-moderate)">●</span> Med
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="sidebar-body" id="issue-list" role="list" aria-live="polite" aria-label="Issue list">
      <!-- Populated by JS -->
    </div>
  `;

  const totalBadge  = sidebar.querySelector<HTMLElement>('#issue-total-badge')!;
  const tabsEl      = sidebar.querySelector<HTMLElement>('#severity-tabs')!;
  const listEl      = sidebar.querySelector<HTMLElement>('#issue-list')!;

  let currentFilter: string = 'all';
  let currentIssues: AccessibilityIssue[] = [];

  // ── Filter tab logic ────────────────────────────────────────────────────────
  tabsEl.addEventListener('click', e => {
    const tab = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-filter]');
    if (!tab) return;
    currentFilter = tab.dataset.filter!;
    tabsEl.querySelectorAll('.tab').forEach(t => {
      const active = t === tab;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    renderList(currentIssues, currentFilter, appState.state.selectedIssueId);
  });

  // ── Keyboard navigation in list ─────────────────────────────────────────────
  listEl.addEventListener('keydown', e => {
    const cards = Array.from(listEl.querySelectorAll<HTMLElement>('.issue-card'));
    const idx   = cards.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' && idx < cards.length - 1) {
      e.preventDefault();
      cards[idx + 1].focus();
    } else if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      cards[idx - 1].focus();
    } else if ((e.key === 'Enter' || e.key === ' ') && idx >= 0) {
      e.preventDefault();
      cards[idx].click();
    }
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  function renderList(
    issues: AccessibilityIssue[],
    filter: string,
    selectedId: string | null,
  ) {
    const visible = filter === 'all'
      ? issues
      : issues.filter(i => i.severity === filter);

    if (issues.length === 0) {
      listEl.innerHTML = renderIdleState();
      return;
    }

    if (visible.length === 0) {
      listEl.innerHTML = `
        <div class="state-empty">
          <div class="state-icon">🔍</div>
          <h3>No ${filter} issues</h3>
          <p>Try a different severity filter.</p>
        </div>`;
      return;
    }

    listEl.innerHTML = visible
      .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
      .map(issue => renderCard(issue, issue.id === selectedId))
      .join('');

    // Attach click handlers
    listEl.querySelectorAll<HTMLElement>('.issue-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.issueId!;
        onIssueSelect(id);
      });
    });
  }

  function renderCard(issue: AccessibilityIssue, isActive: boolean): string {
    return `
      <div
        class="issue-card issue-card--${issue.severity}${isActive ? ' active' : ''}"
        role="listitem"
        tabindex="0"
        data-issue-id="${issue.id}"
        aria-label="${issue.title}, ${severityLabel(issue.severity)} severity"
        aria-pressed="${isActive}"
      >
        <div class="issue-card-row">
          <span class="badge badge-${issue.severity}">${severityLabel(issue.severity)}</span>
          <span style="font-size:var(--text-xs);color:var(--color-text-subtle);">${domainIcon(issue.domain)}</span>
        </div>
        <div class="issue-card-title">${escHtml(issue.title)}</div>
        <div class="issue-card-element">${escHtml(issue.element)}</div>
      </div>
    `;
  }

  function renderIdleState(): string {
    return `
      <div class="state-empty">
        <div class="state-icon">🔬</div>
        <h3>No scan yet</h3>
        <p>Run a scan to discover accessibility issues on the demo page.</p>
      </div>
    `;
  }

  function renderScanningState(): string {
    return `
      <div class="state-loading">
        <div class="spinner" style="width:32px;height:32px;border-width:3px;opacity:0.6;"></div>
        <h3>Scanning…</h3>
        <p>Auditing elements against WCAG criteria.</p>
      </div>
    `;
  }

  // ── State subscription ──────────────────────────────────────────────────────
  appState.subscribe((state: AppState) => {
    const { view, scanResult, selectedIssueId } = state;

    if (view === 'scanning') {
      tabsEl.style.display = 'none';
      totalBadge.style.display = 'none';
      listEl.innerHTML = renderScanningState();
      currentIssues = [];
      return;
    }

    if ((view === 'results' || view === 'report') && scanResult) {
      currentIssues = scanResult.issues;
      tabsEl.style.display = '';
      totalBadge.style.display = '';
      totalBadge.textContent = String(currentIssues.length);
      renderList(currentIssues, currentFilter, selectedIssueId);

      // Scroll to and highlight selected card
      if (selectedIssueId) {
        const card = listEl.querySelector<HTMLElement>(`[data-issue-id="${selectedIssueId}"]`);
        if (card) {
          card.classList.add('highlighted');
          card.scrollIntoView({ behavior: state.reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
          setTimeout(() => card.classList.remove('highlighted'), 700);
        }
      }
      return;
    }

    // idle / error
    tabsEl.style.display = 'none';
    totalBadge.style.display = 'none';
    currentIssues = [];
    listEl.innerHTML = renderIdleState();
  });

  return sidebar;
}

// ── Details panel ──────────────────────────────────────────────────────────────

export function createDetailsPanel(
  onClose: () => void,
): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'details-panel';
  panel.setAttribute('aria-label', 'Issue details');

  panel.innerHTML = `
    <div class="details-panel-header">
      <h3 style="font-size:var(--text-sm);font-weight:700;margin:0;" id="details-title">
        Issue Details
      </h3>
      <button
        class="icon-btn"
        id="close-details"
        aria-label="Close issue details"
        title="Close"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="details-panel-body" id="details-body">
      <div class="state-empty" style="padding:var(--space-10) var(--space-4)">
        <div class="state-icon">←</div>
        <h3>Select an issue</h3>
        <p>Click an issue card or a 3D element to see details.</p>
      </div>
    </div>
  `;

  const body      = panel.querySelector<HTMLElement>('#details-body')!;
  const titleEl   = panel.querySelector<HTMLElement>('#details-title')!;
  const closeBtn  = panel.querySelector<HTMLButtonElement>('#close-details')!;

  closeBtn.addEventListener('click', onClose);

  // ── State subscription ──────────────────────────────────────────────────────
  appState.subscribe((state: AppState) => {
    // Panel visibility
    if (state.detailsPanelOpen) {
      panel.classList.remove('collapsed');
      panel.removeAttribute('hidden');
    } else {
      panel.classList.add('collapsed');
    }

    // Content
    const { selectedIssueId, scanResult } = state;
    if (!selectedIssueId || !scanResult) {
      titleEl.textContent = 'Issue Details';
      body.innerHTML = `
        <div class="state-empty" style="padding:var(--space-10) var(--space-4)">
          <div class="state-icon">←</div>
          <h3>Select an issue</h3>
          <p>Click an issue card or a 3D element to see details.</p>
        </div>`;
      return;
    }

    const issue = scanResult.issues.find(i => i.id === selectedIssueId);
    if (!issue) return;

    titleEl.textContent = issue.title;
    body.innerHTML = renderDetails(issue);
  });

  return panel;
}

function renderDetails(issue: AccessibilityIssue): string {
  const wcagPills = issue.wcag
    .map(w => `
      <a href="${escHtml(w.url)}" target="_blank" rel="noopener noreferrer"
         class="wcag-pill" aria-label="WCAG ${w.id} ${w.title} Level ${w.level} (opens new tab)">
        ${w.id} <span style="opacity:0.6">${w.level}</span>
      </a>`)
    .join(' ');

  const affectedPills = issue.affectedUsers
    .map(u => `<span class="badge badge-neutral">${escHtml(u)}</span>`)
    .join(' ');

  return `
    <!-- Severity header -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-5)">
      <span class="badge badge-${issue.severity}" style="font-size:var(--text-xs);">
        ${severityLabel(issue.severity)}
      </span>
      <span style="font-size:var(--text-xs);color:var(--color-text-muted);">
        ${domainIcon(issue.domain)} ${issue.domain.charAt(0).toUpperCase() + issue.domain.slice(1)}
      </span>
    </div>

    <!-- Description -->
    <div class="detail-block">
      <h4>What's wrong</h4>
      <p>${escHtml(issue.description)}</p>
    </div>

    <!-- Affected element -->
    <div class="detail-block">
      <h4>Affected element</h4>
      <div class="code-block">${escHtml(issue.element)}</div>
    </div>

    <!-- WCAG criteria -->
    <div class="detail-block">
      <h4>WCAG Criteria</h4>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">${wcagPills}</div>
    </div>

    <!-- Recommendation -->
    <div class="detail-block" style="border-color:rgba(99,102,241,0.25);background:var(--color-accent-dim)">
      <h4 style="color:var(--color-accent);">✓ Recommendation</h4>
      <p>${escHtml(issue.recommendation)}</p>
    </div>

    ${issue.codeSnippet ? `
    <!-- Code fix -->
    <div>
      <p class="section-label">Code fix</p>
      <div class="code-block">${escHtml(issue.codeSnippet)}</div>
    </div>
    ` : ''}

    <!-- Affected users -->
    <div style="margin-top:var(--space-4)">
      <p class="section-label">Affects</p>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${affectedPills}</div>
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
