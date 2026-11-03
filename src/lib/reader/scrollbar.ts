export type ScrollThumbMetrics = {
  visible: boolean;
  top: number;
  height: number;
  maxScroll: number;
  progress: number;
};

export type ScrollThumbInput = {
  scrollTop: number;
  scrollHeight: number;
  viewportHeight: number;
  railHeight: number;
  minThumb?: number;
};

/**
 * Calcula la posición y el tamaño del pulgar de una barra de scroll vertical.
 * `top` es relativo al carril, no a la ventana.
 */
export function getScrollThumbMetrics({
  scrollTop,
  scrollHeight,
  viewportHeight,
  railHeight,
  minThumb = 44,
}: ScrollThumbInput): ScrollThumbMetrics {
  const viewport = Math.max(0, Number.isFinite(viewportHeight) ? viewportHeight : 0);
  const total = Math.max(viewport, Number.isFinite(scrollHeight) ? scrollHeight : 0);
  const rail = Math.max(0, Number.isFinite(railHeight) ? railHeight : 0);
  const maxScroll = Math.max(0, total - viewport);

  if (maxScroll <= 0 || rail <= 0) {
    return { visible: false, top: 0, height: 0, maxScroll, progress: 0 };
  }

  const proportional = (viewport / total) * rail;
  const height = Math.min(rail, Math.max(minThumb, proportional));
  const travel = Math.max(0, rail - height);
  const progress = Math.min(
    1,
    Math.max(0, (Number.isFinite(scrollTop) ? scrollTop : 0) / maxScroll),
  );

  return {
    visible: true,
    top: progress * travel,
    height,
    maxScroll,
    progress,
  };
}
