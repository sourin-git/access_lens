import type { ScanIssue } from "./scan";

export type { ScanIssue } from "./scan";

export const SCAN_LIMITATIONS = "Automated findings cover a limited set of DOM and flat-color checks. Gradients, images, unsupported color spaces, complex accessible names, scripted keyboard behavior, focus visibility, and the full accessibility tree need manual review. A scan does not prove complete WCAG compliance. Illustrative results are review prompts, not detected failures.";

export function summarizeIssues(issues: readonly ScanIssue[]) {
  return {
    total: issues.length,
    automated: issues.filter((issue) => issue.source === "automated").length,
    demo: issues.filter((issue) => issue.source === "demo").length,
    critical: issues.filter((issue) => issue.severity === "critical").length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
    info: issues.filter((issue) => issue.severity === "info").length,
  };
}

/** Safe DOM renderer; the integration layer chooses where and when to mount it. */
export function createScanReport(
  issues: readonly ScanIssue[],
  options: { document?: Document; onInspect?: (elementId: string) => void } = {},
): HTMLElement {
  const doc = options.document ?? document;
  const section = doc.createElement("section");
  section.className = "sample-site sample-report";
  section.setAttribute("aria-label", "Accessibility scan report");
  const append = (parent: HTMLElement, tag: string, text: string): HTMLElement => {
    const element = doc.createElement(tag);
    element.textContent = text;
    parent.append(element);
    return element;
  };
  append(section, "h2", "Accessibility findings");
  const summary = summarizeIssues(issues);
  const status = append(section, "p", `${summary.automated} automated findings · ${summary.demo} illustrative review prompts. ${summary.critical} critical, ${summary.warning} warning, ${summary.info} informational.`);
  status.setAttribute("role", "status");
  append(section, "p", SCAN_LIMITATIONS);
  for (const source of ["automated", "demo"] as const) {
    append(section, "h3", source === "automated" ? "Automated findings" : "Illustrative sample results");
    const group = issues.filter((issue) => issue.source === source);
    if (!group.length) {
      append(section, "p", source === "automated" ? "No issues detected by these limited checks. Manual review is still required." : "No illustrative results included.");
      continue;
    }
    const list = doc.createElement("ul");
    for (const issue of group) {
      const item = doc.createElement("li");
      item.dataset.severity = issue.severity;
      append(item, "h4", `${issue.title} — ${issue.severity}`);
      append(item, "p", `Source: ${source === "automated" ? "Automated DOM check" : "Illustrative sample"} · Affected element: #${issue.elementId}`);
      append(item, "p", issue.explanation);
      append(item, "p", `Suggested fix: ${issue.recommendation}`);
      if (options.onInspect) {
        const button = doc.createElement("button");
        button.type = "button";
        button.textContent = `Inspect element: ${issue.elementId}`;
        button.addEventListener("click", () => options.onInspect?.(issue.elementId));
        item.append(button);
      }
      list.append(item);
    }
    section.append(list);
  }
  return section;
}
