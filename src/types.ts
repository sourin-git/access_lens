export type AccessibilityProfile =
  | 'default'
  | 'low-vision'
  | 'dyslexia'
  | 'motor'
  | 'reduced-motion';

/** Owned by the integration layer; the scene does not create an app state store. */
export type AppState = {
  profile: AccessibilityProfile;
  contrast: boolean;
  textScale: number;
  reducedMotion: boolean;
};
