export const TOC_WIDTH_KEY = 'soffia:toc-width';
export const TOC_WIDTH_MIN = 160;
export const TOC_WIDTH_MAX = 480;
export const TOC_WIDTH_DEFAULT = 240;

/** Limita el ancho del índice a un rango legible y estable. */
export function clampTocWidth(value: number): number {
  if (!Number.isFinite(value)) return TOC_WIDTH_DEFAULT;
  return Math.max(
    TOC_WIDTH_MIN,
    Math.min(TOC_WIDTH_MAX, Math.round(value)),
  );
}

export function loadTocWidth(): number {
  try {
    const raw = localStorage.getItem(TOC_WIDTH_KEY);
    if (!raw) return TOC_WIDTH_DEFAULT;
    return clampTocWidth(Number(raw));
  } catch {
    return TOC_WIDTH_DEFAULT;
  }
}

export function saveTocWidth(width: number): void {
  try {
    localStorage.setItem(TOC_WIDTH_KEY, String(clampTocWidth(width)));
  } catch {
    // Sin persistencia: el ancho se mantiene en esta vista.
  }
}
