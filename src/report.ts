export type ScanPhase = 'idle' | 'scanning' | 'completed';

/** Educational fixtures, never the output of an audit or automated analysis. */
export const ELEMENT_REPORTS = [
  { id: 'navigation', name: 'Navigation', topic: 'Structure & wayfinding', severity: 'note', title: 'Keep navigation predictable.', description: 'The navigation helps people find their way through a website.', explanation: 'Review note: clear link names and a consistent order can make navigation easier to understand.', suggestion: 'Use a navigation landmark, descriptive links, and a visible focus indicator. Keep the order consistent across pages.' },
  { id: 'hero', name: 'Hero heading', topic: 'Content hierarchy', severity: 'note', title: 'Give the page a clear starting point.', description: 'A prominent heading introduces the purpose of this example website.', explanation: 'Review note: a strong visual heading also needs a meaningful place in the document structure.', suggestion: 'Use a descriptive main heading and a logical heading hierarchy. Keep the text concise and easy to understand.' },
  { id: 'body-text', name: 'Body text', topic: 'Readability & contrast', severity: 'high', title: 'Make supporting text easier to read.', description: 'Supporting copy explains the main idea and provides context.', explanation: 'Example finding: small, muted supporting text could be difficult for someone with low vision to read.', suggestion: 'Increase the supporting text size and contrast. Use comfortable line spacing and allow text to resize without clipping.' },
  { id: 'hero-image', name: 'Hero image', topic: 'Non-text content', severity: 'high', title: 'Communicate the image’s purpose.', description: 'The abstract illustration introduces a different visual perspective.', explanation: 'Example finding: a meaningful image without a text alternative could leave screen-reader users without its context.', suggestion: 'Provide a concise text alternative when an image conveys meaning. Mark purely decorative images as decorative.' },
  { id: 'primary-button', name: 'Primary button', topic: 'Pointer & keyboard access', severity: 'moderate', title: 'Make the next step easier to reach.', description: 'The primary button invites someone to explore the website.', explanation: 'Example finding: a compact action with limited spacing could be harder for someone with motor difficulties to activate.', suggestion: 'Give the action a generous target and surrounding space. Make it keyboard operable and provide a clear focus state.' },
] as const;

export function createReport(root: HTMLElement, onSelect: (id: string) => void, signal: AbortSignal) {
  const buttons = new Map<string, HTMLButtonElement>();
  const badges = new Map<string, HTMLSpanElement>();
  root.replaceChildren();
  for (const [index, element] of ELEMENT_REPORTS.entries()) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'report-item';
    button.dataset.elementId = element.id;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-controls', 'element-detail');
    const number = document.createElement('span');
    number.className = 'element-number';
    number.textContent = String(index + 1).padStart(2, '0');
    number.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = 'element-label';
    const name = document.createElement('strong');
    name.textContent = element.name;
    const topic = document.createElement('small');
    topic.textContent = element.topic;
    text.append(name, topic);
    const badge = document.createElement('span');
    badge.className = `severity-badge ${element.severity}`;
    badge.textContent = element.severity === 'note' ? 'Review note' : element.severity === 'high' ? 'High' : 'Moderate';
    badge.hidden = true;
    button.append(number, text, badge);
    button.addEventListener('click', () => onSelect(element.id), { signal });
    item.append(button);
    root.append(item);
    buttons.set(element.id, button);
    badges.set(element.id, badge);
  }
  return {
    render(phase: ScanPhase, selectedId: string | null) {
      for (const element of ELEMENT_REPORTS) {
        buttons.get(element.id)!.setAttribute('aria-pressed', String(element.id === selectedId));
        badges.get(element.id)!.hidden = phase !== 'completed';
      }
    },
  };
}
