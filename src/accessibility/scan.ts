import { composite, contrastRatio, getEffectiveBackground, parseColor } from "./contrast";

export type ScanIssue = {
  id: string;
  elementId: string;
  title: string;
  severity: "critical" | "warning" | "info";
  explanation: string;
  recommendation: string;
  source: "automated" | "demo";
};

export { getDemoIssues } from "./sampleData";

function isVisible(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = view.getComputedStyle(current);
    if (current.hidden || current.getAttribute("aria-hidden") === "true" || current.hasAttribute("inert") || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
    if (current.tagName === "DETAILS" && !current.hasAttribute("open") && current !== element) {
      const summary = current.querySelector("summary");
      if (!summary?.contains(element)) return false;
    }
  }
  return true;
}

function readableText(element: Element): string {
  if (element.getAttribute("aria-hidden") === "true" || element.hasAttribute("hidden")) return "";
  if (element.tagName === "IMG") return element.getAttribute("alt") ?? "";
  return Array.from(element.childNodes).map((node) =>
    node.nodeType === 3 ? node.textContent ?? "" : node.nodeType === 1 ? readableText(node as Element) : "",
  ).join(" ").trim();
}

/** A conservative subset of accessible-name computation, not a browser AX tree. */
function hasAccessibleName(element: HTMLElement): boolean {
  const references = element.getAttribute("aria-labelledby")?.trim();
  if (references) {
    const text = references.split(/\s+/).map((id) => {
      const label = element.ownerDocument.getElementById(id);
      return label?.textContent?.trim() ?? "";
    }).join(" ").trim();
    if (text) return true;
  }
  if (element.getAttribute("aria-label")?.trim()) return true;
  const control = element as HTMLInputElement;
  if (control.labels && Array.from(control.labels).some((label) => readableText(label))) return true;
  if (element.tagName === "IMG" || control.type === "image") return Boolean(element.getAttribute("alt")?.trim());
  if (element.tagName === "INPUT" && ["submit", "reset"].includes(control.type)) return true;
  if (element.tagName === "INPUT" && control.type === "button" && control.value.trim()) return true;
  const contentNames = element.matches("button, a[href], summary, [role='button'], [role='link'], [role='checkbox'], [role='tab'], [role='menuitem'], [role='switch']");
  if (contentNames && readableText(element)) return true;
  if (element.matches("svg[role='img']") && element.querySelector("title")?.textContent?.trim()) return true;
  return Boolean(element.getAttribute("title")?.trim());
}

/** Static DOM checks only. Call after mounting the sample and loading its CSS. */
export function runAccessibilityScan(root: HTMLElement): ScanIssue[] {
  const view = root.ownerDocument.defaultView;
  if (!view) return [];
  const issues: ScanIssue[] = [];
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  const add = (element: HTMLElement, rule: string, title: string, severity: ScanIssue["severity"], explanation: string, recommendation: string): void => {
    if (!element.id) {
      let suffix = elements.indexOf(element);
      while (root.ownerDocument.getElementById(`accesslens-element-${suffix}`)) suffix++;
      element.id = `accesslens-element-${suffix}`;
    }
    issues.push({ id: `${rule}:${element.id}`, elementId: element.id, title, severity, explanation, recommendation, source: "automated" });
  };
  let previousHeading = 0;
  for (const element of elements) {
    if (!isVisible(element) || element.matches("script, style, template, input[type='hidden']")) continue;
    const decorativeImage = element.matches("img[alt='']:not([role='img'])");
    const needsName = element.matches("button, a[href], input:not([type='hidden']), select, textarea, img, [role='img'], [role='button'], [role='link'], [role='checkbox'], [role='switch'], [role='tab'], [role='menuitem'], [role='textbox'], [role='combobox']");
    if (needsName && !decorativeImage && !hasAccessibleName(element)) {
      add(element, "accessible-name", "Missing accessible name", "critical", "This visible image or control has no name recognized by the scanner's supported labeling checks.", "Use descriptive visible button/link text, an associated label for a field, alt text for an image, or an appropriate aria-label / aria-labelledby.");
    }
    const nativeHeading = /^H[1-6]$/.test(element.tagName);
    const level = nativeHeading ? Number(element.tagName[1]) : element.getAttribute("role") === "heading" ? Number(element.getAttribute("aria-level")) : 0;
    if (nativeHeading || element.getAttribute("role") === "heading") {
      if (!Number.isInteger(level) || level < 1) {
        add(element, "heading-level", "Heading needs a valid level", "warning", "A custom heading is missing a positive integer aria-level.", "Use a native h1–h6 element or provide a valid aria-level.");
      } else {
        if (level > previousHeading + 1) add(element, "heading-order", "Heading level is skipped", "warning", `This heading is level ${level}, following ${previousHeading ? `level ${previousHeading}` : "the start of the sample"}. This can make the content hierarchy confusing.`, "Use sequential heading levels to represent the content hierarchy; choose visual size with CSS.");
        previousHeading = level;
      }
    }
    if (!element.matches(":disabled, [aria-disabled='true']")) {
      if (element.tabIndex > 0) add(element, "positive-tabindex", "Custom keyboard order", "warning", `tabindex="${element.tabIndex}" moves this element ahead of the normal document order.`, "Remove the positive tabindex and arrange the DOM in the intended reading and interaction order.");
      const customControl = element.matches("[role='button'], [role='link'], [role='checkbox'], [role='switch'], [role='tab'], [role='menuitem'], [role='textbox'], [role='combobox']");
      if (customControl && element.tabIndex < 0 && !element.closest("[role='tablist'], [role='menu'], [role='menubar'], [role='tree'], [role='grid'], [role='listbox'], [role='radiogroup']")) {
        add(element, "keyboard-focus", "Custom control is outside the Tab order", "warning", "This custom control cannot be reached using ordinary Tab navigation. A scripted focus strategy may exist and needs manual review.", "Prefer a native button or input. Otherwise provide keyboard focus and keyboard activation, or verify the composite widget's managed focus behavior.");
      }
    }
    const hasDirectText = Array.from(element.childNodes).some((node) => node.nodeType === 3 && Boolean(node.textContent?.trim()));
    if (!hasDirectText || element.namespaceURI !== "http://www.w3.org/1999/xhtml") continue;
    const style = view.getComputedStyle(element);
    const background = getEffectiveBackground(element);
    const foreground = parseColor(style.color);
    if (!background || !foreground || style.textShadow && style.textShadow !== "none" || style.backgroundClip === "text" || style.getPropertyValue("-webkit-text-fill-color") && style.getPropertyValue("-webkit-text-fill-color") !== style.color) continue;
    const size = Number.parseFloat(style.fontSize);
    if (!Number.isFinite(size)) continue;
    const weight = style.fontWeight === "bold" ? 700 : Number.parseInt(style.fontWeight, 10);
    const large = size >= 24 || size >= 18.6667 && weight >= 700;
    const minimum = large ? 3 : 4.5;
    const ratio = contrastRatio(composite(foreground, background), background);
    if (ratio < minimum) add(element, "text-contrast", "Text contrast is too low", "warning", `Computed flat-color contrast is ${ratio.toFixed(2)}:1; the threshold for this ${large ? "large" : "normal-sized"} text is ${minimum}:1.`, "Adjust the text or background color to meet the threshold. Recheck after changing the profile or text size.");
  }
  return issues;
}
