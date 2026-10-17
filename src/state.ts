/**
 * state.ts — Part 3: Authoritative Application State
 * Single source of truth for the entire AccessLens application.
 * Uses a simple pub/sub pattern — no external dependencies.
 */

import type { Profile, ScanResult } from './scanner';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AppView = 'idle' | 'scanning' | 'results' | 'report';

export interface ScanState {
  phase: string;
  percent: number;
  message: string;
}

export interface AppState {
  // Profile
  profile: Profile;
  reducedMotion: boolean;

  // Scan lifecycle
  view: AppView;
  scanProgress: ScanState | null;
  scanResult: ScanResult | null;
  scanError: string | null;

  // Issue selection
  selectedIssueId: string | null;
  activeTab: 'issues' | 'report';

  // UI toggles
  detailsPanelOpen: boolean;
}

export type StateListener = (state: Readonly<AppState>) => void;

// ── Default state ─────────────────────────────────────────────────────────────

function createDefaultState(): AppState {
  return {
    profile: 'default',
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    view: 'idle',
    scanProgress: null,
    scanResult: null,
    scanError: null,
    selectedIssueId: null,
    activeTab: 'issues',
    detailsPanelOpen: false,
  };
}

// ── State store ───────────────────────────────────────────────────────────────

class StateStore {
  private _state: AppState;
  private _listeners: Set<StateListener> = new Set();

  constructor() {
    this._state = createDefaultState();

    // Mirror OS reduced-motion preference
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', e => {
      this._patch({ reducedMotion: e.matches });
    });
  }

  get state(): Readonly<AppState> {
    return this._state;
  }

  subscribe(fn: StateListener): () => void {
    this._listeners.add(fn);
    fn(this._state); // immediate call with current state
    return () => this._listeners.delete(fn);
  }

  private _patch(partial: Partial<AppState>) {
    this._state = { ...this._state, ...partial };
    for (const fn of this._listeners) fn(this._state);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  setProfile(profile: Profile) {
    this._patch({ profile });
  }

  setReducedMotion(rm: boolean) {
    this._patch({ reducedMotion: rm });
  }

  startScan() {
    this._patch({
      view: 'scanning',
      scanProgress: { phase: 'Initialising', percent: 0, message: 'Starting audit…' },
      scanResult: null,
      scanError: null,
      selectedIssueId: null,
      detailsPanelOpen: false,
    });
  }

  updateScanProgress(progress: { phase: string; percent: number; message: string }) {
    this._patch({ scanProgress: progress });
  }

  completeScan(result: ScanResult) {
    this._patch({
      view: 'results',
      scanProgress: null,
      scanResult: result,
      scanError: null,
      activeTab: 'issues',
      detailsPanelOpen: result.issues.length > 0,
    });
  }

  failScan(error: string) {
    this._patch({
      view: 'idle',
      scanProgress: null,
      scanError: error,
    });
  }

  selectIssue(issueId: string | null) {
    this._patch({
      selectedIssueId: issueId,
      detailsPanelOpen: issueId !== null,
    });
  }

  setActiveTab(tab: 'issues' | 'report') {
    this._patch({ activeTab: tab });
  }

  toggleDetailsPanel() {
    this._patch({ detailsPanelOpen: !this._state.detailsPanelOpen });
  }

  openReport() {
    this._patch({ view: 'report', activeTab: 'report' });
  }

  closeReport() {
    this._patch({ view: 'results', activeTab: 'issues' });
  }

  resetToIdle() {
    this._patch({
      view: 'idle',
      scanProgress: null,
      scanResult: null,
      scanError: null,
      selectedIssueId: null,
      detailsPanelOpen: false,
    });
  }
}

// Export singleton
export const appState = new StateStore();
