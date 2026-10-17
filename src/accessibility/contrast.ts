export type RGBA = { r: number; g: number; b: number; a: number };

/** Accept computed sRGB colors; unsupported color spaces are deliberately skipped. */
export function parseColor(value: string): RGBA | null {
  const input = value.trim().toLowerCase();
  if (input === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const hex = input.match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i);
  if (hex) {
    const expanded = hex[1].length <= 4
      ? [...hex[1]].map((char) => char + char).join("")
      : hex[1];
    return {
      r: parseInt(expanded.slice(0, 2), 16),
      g: parseInt(expanded.slice(2, 4), 16),
      b: parseInt(expanded.slice(4, 6), 16),
      a: expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
    };
  }
  const match = input.match(/^rgba?\(([^)]+)\)$/);
  if (!match) return null;
  const parts = match[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const channel = (part: string, maximum: number): number =>
    Number.parseFloat(part) * (part.endsWith("%") ? maximum / 100 : 1);
  const values = parts.map((part, index) => channel(part, index === 3 ? 1 : 255));
  if (values.some((value, index) => !Number.isFinite(value) || value < 0 || value > (index === 3 ? 1 : 255))) return null;
  return { r: values[0], g: values[1], b: values[2], a: values[3] ?? 1 };
}

export function composite(foreground: RGBA, background: RGBA): RGBA {
  const a = foreground.a + background.a * (1 - foreground.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const blend = (key: "r" | "g" | "b"): number =>
    (foreground[key] * foreground.a + background[key] * background.a * (1 - foreground.a)) / a;
  return { r: blend("r"), g: blend("g"), b: blend("b"), a };
}

export function contrastRatio(first: RGBA, second: RGBA): number {
  const luminance = (color: RGBA): number => {
    const linear = [color.r, color.g, color.b].map((value) => {
      const s = value / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Null means a reliable flat background cannot be determined. */
export function getEffectiveBackground(element: HTMLElement): RGBA | null {
  const view = element.ownerDocument.defaultView;
  if (!view) return null;
  let result: RGBA = { r: 0, g: 0, b: 0, a: 0 };
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = view.getComputedStyle(current);
    if (Number(style.opacity) < 1 || style.filter !== "none" && style.filter !== "" || style.mixBlendMode !== "normal" && style.mixBlendMode !== "") return null;
    if (result.a < 0.999) {
      if (style.backgroundImage && style.backgroundImage !== "none") return null;
      const background = parseColor(style.backgroundColor);
      if (!background) return null;
      result = composite(result, background);
    }
  }
  return result.a >= 0.999 ? result : null;
}
