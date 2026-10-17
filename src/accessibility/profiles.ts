/** Structural contract only: the integration layer owns and updates this state. */
export type AccessibilityProfile =
  | "default"
  | "low-vision"
  | "dyslexia"
  | "motor"
  | "reduced-motion";

export type AppState = {
  profile: AccessibilityProfile;
  contrast: boolean;
  textScale: number;
  reducedMotion: boolean;
};

/** Reapplying a profile replaces all previous profile overrides. */
export function applyProfile(root: HTMLElement, state: AppState): void {
  root.classList.add("sample-site");
  root.dataset.profile = state.profile;
  root.dataset.contrast = String(state.contrast || state.profile === "low-vision");
  root.dataset.reducedMotion = String(
    state.reducedMotion || state.profile === "reduced-motion",
  );
  const scale = Number.isFinite(state.textScale)
    ? Math.min(3, Math.max(0.75, state.textScale))
    : 1;
  root.style.setProperty(
    "--sample-text-scale",
    String(scale * (state.profile === "low-vision" ? 1.2 : 1)),
  );
}
