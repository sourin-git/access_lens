/**
 * scanner.ts — Part 2: Accessibility Scanner Module
 * Simulates an accessibility audit engine.
 * Exports: applyProfile(), runAccessibilityScan(), getDemoIssues()
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';
export type ImpactDomain = 'perceivable' | 'operable' | 'understandable' | 'robust';

export interface WCAGCriterion {
  id: string;       // e.g. "1.1.1"
  title: string;
  level: 'A' | 'AA' | 'AAA';
  url: string;
}

export interface AccessibilityIssue {
  id: string;
  elementId: string;       // maps to scene element id
  title: string;
  description: string;
  severity: Severity;
  domain: ImpactDomain;
  wcag: WCAGCriterion[];
  element: string;         // CSS selector / tag description
  recommendation: string;
  codeSnippet?: string;
  helpUrl?: string;
  affectedUsers: string[];
  profileRelevance: string[];  // which profiles surface this
}

export interface ScanProgress {
  phase: string;
  percent: number;
  message: string;
}

export interface ScanResult {
  issues: AccessibilityIssue[];
  passedChecks: number;
  testedElements: number;
  score: number;
  duration: number;
}

export type Profile =
  | 'default'
  | 'colorblind'
  | 'lowvision'
  | 'motor'
  | 'cognitive';

// ── Profile definitions ───────────────────────────────────────────────────────

export interface ProfileConfig {
  id: Profile;
  label: string;
  description: string;
  icon: string;
  cssClass: string;
  fontScale: number;
  contrast: 'normal' | 'high' | 'inverted';
  reducedMotion: boolean;
  focusRingWidth: number;
  simulationFilter?: string;
}

export const PROFILES: ProfileConfig[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Standard user experience',
    icon: '👤',
    cssClass: 'profile-default',
    fontScale: 1,
    contrast: 'normal',
    reducedMotion: false,
    focusRingWidth: 2,
  },
  {
    id: 'colorblind',
    label: 'Colour Blind',
    description: 'Deuteranopia simulation',
    icon: '🎨',
    cssClass: 'profile-colorblind',
    fontScale: 1,
    contrast: 'normal',
    reducedMotion: false,
    focusRingWidth: 3,
    simulationFilter: 'url(#deuteranopia)',
  },
  {
    id: 'lowvision',
    label: 'Low Vision',
    description: '200% zoom, high contrast',
    icon: '🔍',
    cssClass: 'profile-lowvision',
    fontScale: 2,
    contrast: 'high',
    reducedMotion: false,
    focusRingWidth: 4,
  },
  {
    id: 'motor',
    label: 'Motor Impaired',
    description: 'Keyboard-only, switch access',
    icon: '⌨️',
    cssClass: 'profile-motor',
    fontScale: 1,
    contrast: 'normal',
    reducedMotion: true,
    focusRingWidth: 4,
  },
  {
    id: 'cognitive',
    label: 'Cognitive',
    description: 'Simplified layout, reduced distractions',
    icon: '🧠',
    cssClass: 'profile-cognitive',
    fontScale: 1.1,
    contrast: 'normal',
    reducedMotion: true,
    focusRingWidth: 3,
  },
];

// ── Demo issue bank ───────────────────────────────────────────────────────────

export function getDemoIssues(): AccessibilityIssue[] {
  return [
    {
      id: 'issue-001',
      elementId: 'hero-image',
      title: 'Image missing alternative text',
      description: 'The hero image has no alt attribute. Screen readers will announce the filename, providing a confusing experience.',
      severity: 'critical',
      domain: 'perceivable',
      wcag: [{ id: '1.1.1', title: 'Non-text Content', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html' }],
      element: '<img src="hero.jpg">',
      recommendation: 'Add a descriptive alt attribute: alt="Team collaborating around a whiteboard" or alt="" for decorative images.',
      codeSnippet: '<!-- Before -->\n<img src="hero.jpg">\n\n<!-- After -->\n<img src="hero.jpg" alt="Team collaborating around a whiteboard">',
      affectedUsers: ['Screen reader users', 'Users with images disabled'],
      profileRelevance: ['default', 'lowvision', 'cognitive'],
    },
    {
      id: 'issue-002',
      elementId: 'cta-button',
      title: 'Insufficient colour contrast on primary CTA',
      description: 'The "Get Started" button has a contrast ratio of 2.8:1 against its background. WCAG AA requires a minimum of 4.5:1 for normal text.',
      severity: 'serious',
      domain: 'perceivable',
      wcag: [{ id: '1.4.3', title: 'Contrast (Minimum)', level: 'AA', url: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html' }],
      element: '<button class="btn-cta">Get Started</button>',
      recommendation: 'Darken button text or lighten the background. Target ratio ≥ 4.5:1. Suggested fix: text #ffffff on background #4338ca.',
      codeSnippet: '/* Current  */ .btn-cta { background: #818cf8; color: #e0e0e0; }\n/* Fixed    */ .btn-cta { background: #4338ca; color: #ffffff; }',
      affectedUsers: ['Users with low vision', 'Older users', 'Users in bright light'],
      profileRelevance: ['colorblind', 'lowvision', 'default'],
    },
    {
      id: 'issue-003',
      elementId: 'form-email',
      title: 'Form input has no associated label',
      description: 'The email input field is not programmatically associated with a visible label element via for/id pairing or aria-labelledby.',
      severity: 'critical',
      domain: 'perceivable',
      wcag: [
        { id: '1.3.1', title: 'Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' },
        { id: '4.1.2', title: 'Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
      ],
      element: '<input type="email" placeholder="Enter email">',
      recommendation: 'Add a visible <label> element with a matching for attribute, or use aria-label as a fallback.',
      codeSnippet: '<label for="email-field">Email address</label>\n<input id="email-field" type="email" placeholder="you@example.com">',
      affectedUsers: ['Screen reader users', 'Voice control users', 'Cognitive disabilities'],
      profileRelevance: ['default', 'motor', 'cognitive'],
    },
    {
      id: 'issue-004',
      elementId: 'nav-bar',
      title: 'Navigation landmark missing ARIA role',
      description: 'The primary navigation bar uses a generic <div> instead of <nav> or role="navigation", preventing landmark navigation for assistive technology users.',
      severity: 'serious',
      domain: 'robust',
      wcag: [{ id: '1.3.6', title: 'Identify Purpose', level: 'AAA', url: 'https://www.w3.org/WAI/WCAG21/Understanding/identify-purpose.html' }],
      element: '<div class="navbar">',
      recommendation: 'Replace the wrapping <div> with a <nav aria-label="Primary"> element.',
      codeSnippet: '<!-- Before -->\n<div class="navbar">...</div>\n\n<!-- After -->\n<nav aria-label="Primary">...</nav>',
      affectedUsers: ['Screen reader users', 'Keyboard-only users'],
      profileRelevance: ['default', 'motor', 'cognitive'],
    },
    {
      id: 'issue-005',
      elementId: 'form-submit',
      title: 'Submit button keyboard focus not visible',
      description: 'The form submit button removes the default focus ring via outline:none without providing a custom focus indicator, making it unusable for keyboard users.',
      severity: 'serious',
      domain: 'operable',
      wcag: [{ id: '2.4.7', title: 'Focus Visible', level: 'AA', url: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html' }],
      element: '<button type="submit">Subscribe</button>',
      recommendation: 'Restore a clearly visible focus indicator using :focus-visible with a high-contrast outline or box-shadow.',
      codeSnippet: '/* Remove this */\nbutton:focus { outline: none; }\n\n/* Add this */\nbutton:focus-visible {\n  outline: 3px solid #6366f1;\n  outline-offset: 2px;\n}',
      affectedUsers: ['Keyboard-only users', 'Motor-impaired users', 'Switch device users'],
      profileRelevance: ['motor', 'default'],
    },
    {
      id: 'issue-006',
      elementId: 'hero-heading',
      title: 'Heading hierarchy skipped (h1 → h3)',
      description: 'The page jumps from <h1> to <h3>, skipping <h2>. This breaks the document outline and confuses screen reader users navigating by headings.',
      severity: 'moderate',
      domain: 'perceivable',
      wcag: [{ id: '1.3.1', title: 'Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' }],
      element: '<h1>Welcome</h1>...  <h3>Features</h3>',
      recommendation: 'Restructure headings to follow a logical order: h1 → h2 → h3. Do not skip levels for visual styling purposes.',
      codeSnippet: '<!-- Before -->\n<h1>Welcome</h1>\n<h3>Our Features</h3>\n\n<!-- After -->\n<h1>Welcome</h1>\n<h2>Our Features</h2>',
      affectedUsers: ['Screen reader users', 'Users with cognitive disabilities'],
      profileRelevance: ['cognitive', 'default'],
    },
    {
      id: 'issue-007',
      elementId: 'link-1',
      title: 'Link has ambiguous text "Click here"',
      description: 'Multiple links on the page share the generic label "Click here". Out of context — as presented by screen readers — these links are indistinguishable.',
      severity: 'moderate',
      domain: 'operable',
      wcag: [{ id: '2.4.6', title: 'Headings and Labels', level: 'AA', url: 'https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html' }],
      element: '<a href="/pricing">Click here</a>',
      recommendation: 'Use descriptive link text that makes sense out of context, e.g. "View pricing plans". If the destination is clear from surrounding content, use aria-label.',
      codeSnippet: '<!-- Before -->\n<a href="/pricing">Click here</a>\n\n<!-- After -->\n<a href="/pricing">View pricing plans</a>',
      affectedUsers: ['Screen reader users', 'Cognitive disabilities'],
      profileRelevance: ['default', 'cognitive'],
    },
    {
      id: 'issue-008',
      elementId: 'skip-link',
      title: 'Skip navigation link not visible on focus',
      description: 'A skip-to-content link exists in the DOM but is permanently hidden via display:none, making it inaccessible to keyboard users.',
      severity: 'moderate',
      domain: 'operable',
      wcag: [{ id: '2.4.1', title: 'Bypass Blocks', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html' }],
      element: '<a class="skip-link" href="#main">',
      recommendation: 'Use CSS to show the skip link only on :focus, not display:none. The link must be visible and operable when it receives keyboard focus.',
      codeSnippet: '.skip-link {\n  position: absolute;\n  top: -40px;\n  left: 0;\n  transition: top 0.2s;\n}\n.skip-link:focus {\n  top: 0;\n}',
      affectedUsers: ['Keyboard-only users', 'Screen reader users'],
      profileRelevance: ['motor', 'default'],
    },
    {
      id: 'issue-009',
      elementId: 'link-2',
      title: 'External link opens without warning',
      description: 'Footer links open in a new tab (_blank) without notifying the user, violating the principle of predictable navigation.',
      severity: 'minor',
      domain: 'understandable',
      wcag: [{ id: '3.2.2', title: 'On Input', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/on-input.html' }],
      element: '<a href="https://external.com" target="_blank">',
      recommendation: 'Add an aria-label or visible icon indicating the link opens in a new tab. E.g. aria-label="Privacy Policy (opens in new tab)".',
      codeSnippet: '<a href="https://external.com" target="_blank"\n   rel="noopener noreferrer"\n   aria-label="Privacy Policy (opens in new tab)">\n  Privacy Policy\n  <span aria-hidden="true">↗</span>\n</a>',
      affectedUsers: ['Screen reader users', 'Cognitive disabilities'],
      profileRelevance: ['cognitive', 'default'],
    },
    {
      id: 'issue-010',
      elementId: 'sub-heading',
      title: 'Text resizes poorly at 200% zoom',
      description: 'At 200% browser zoom, the sub-heading text overflows its container and is clipped, making it impossible to read without horizontal scrolling.',
      severity: 'serious',
      domain: 'perceivable',
      wcag: [{ id: '1.4.4', title: 'Resize Text', level: 'AA', url: 'https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html' }],
      element: '<h2 class="subheading">',
      recommendation: 'Use relative units (rem/em) and ensure containers use min-width or allow wrapping. Test at 200% and 400% zoom.',
      codeSnippet: '/* Before */\n.subheading { font-size: 24px; white-space: nowrap; }\n\n/* After */\n.subheading { font-size: 1.5rem; white-space: normal; }',
      affectedUsers: ['Low vision users', 'Users who increase browser font size'],
      profileRelevance: ['lowvision'],
    },
  ];
}

// ── Apply profile to webpage ───────────────────────────────────────────────────

export function applyProfile(profileId: Profile, targetDocument?: Document): void {
  const doc = targetDocument ?? document;
  const config = PROFILES.find(p => p.id === profileId) ?? PROFILES[0];
  const root = doc.documentElement;

  // Remove all profile classes
  for (const p of PROFILES) root.classList.remove(p.cssClass);
  root.classList.add(config.cssClass);

  // Font scaling
  root.style.fontSize = `${config.fontScale * 100}%`;

  // Contrast
  if (config.contrast === 'high') {
    root.style.filter = 'contrast(1.4) brightness(1.1)';
  } else if (config.contrast === 'inverted') {
    root.style.filter = 'invert(1) hue-rotate(180deg)';
  } else if (config.simulationFilter) {
    root.style.filter = config.simulationFilter;
  } else {
    root.style.filter = '';
  }
}

// ── Run scan ──────────────────────────────────────────────────────────────────

export async function runAccessibilityScan(
  profileId: Profile,
  onProgress: (p: ScanProgress) => void,
): Promise<ScanResult> {
  const t0 = performance.now();

  const phases: Array<[string, string]> = [
    ['Initialising engine', 'Launching headless audit'],
    ['Parsing DOM', 'Building accessibility tree'],
    ['Running WCAG checks', 'Testing perceivable criteria'],
    ['Colour contrast analysis', 'Computing luminance ratios'],
    ['Keyboard navigation', 'Simulating tab order'],
    ['ARIA validation', 'Verifying role/state/property'],
    ['Generating report', 'Aggregating findings'],
  ];

  for (let i = 0; i < phases.length; i++) {
    const [phase, message] = phases[i];
    const percent = Math.round(((i + 1) / phases.length) * 100);
    onProgress({ phase, percent, message });
    await delay(280 + Math.random() * 200);
  }

  const allIssues = getDemoIssues();
  // Filter by profile relevance
  const issues = allIssues.filter(
    iss => iss.profileRelevance.includes(profileId) || profileId === 'default'
  );

  const testedElements = 47;
  const passedChecks = testedElements - issues.length;
  const criticalCount  = issues.filter(i => i.severity === 'critical').length;
  const seriousCount   = issues.filter(i => i.severity === 'serious').length;
  const score = Math.max(0, Math.round(100 - criticalCount * 15 - seriousCount * 8 - issues.length * 2));

  return {
    issues,
    passedChecks,
    testedElements,
    score,
    duration: performance.now() - t0,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
