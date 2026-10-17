import type { ScanIssue } from "./scan";

/** Illustrative review prompts; these are never returned by the automated scan. */
export function getDemoIssues(): ScanIssue[] {
  return [
    {
      id: "demo-reading-review",
      elementId: "sample-intro",
      title: "Review reading comfort with users",
      severity: "info",
      explanation: "Illustrative review prompt: automated checks cannot establish whether the wording and layout are comfortable for a particular reader. The reading profile is a preference, not a diagnosis or treatment for dyslexia.",
      recommendation: "Invite people with varied reading preferences to try the page, and let them choose spacing and text size.",
      source: "demo",
    },
    {
      id: "demo-keyboard-review",
      elementId: "sample-navigation",
      title: "Manually review the full keyboard journey",
      severity: "info",
      explanation: "Illustrative review prompt: this scanner does not simulate Tab order, detect every keyboard trap, or measure whether focus remains visible in every interaction.",
      recommendation: "Use Tab, Shift+Tab, Enter, Space, and browser zoom to complete every interaction and check focus visibility and order.",
      source: "demo",
    },
  ];
}
