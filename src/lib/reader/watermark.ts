export const WATERMARK_MAX_CHARS = 34;
export const WATERMARK_MIN_SIZE = 34;
export const WATERMARK_MAX_SIZE = 190;

export type WatermarkMetrics = {
  text: string;
  fontSize: number;
};

/**
 * Prepara el título del aside vertical.
 *
 * Los títulos largos se recortan con puntos suspensivos y, antes de recortar,
 * la fuente se reduce de forma proporcional para conservar una altura visual
 * estable. El CSS añade una elipsis de respaldo si el contenedor es más bajo
 * de lo previsto.
 */
export function getWatermarkMetrics(title: string): WatermarkMetrics {
  const normalized = title.replace(/\s+/g, ' ').trim();
  const text =
    normalized.length > WATERMARK_MAX_CHARS
      ? `${normalized.slice(0, WATERMARK_MAX_CHARS - 1).trimEnd()}…`
      : normalized;

  const length = Math.max(6, text.length);
  const fontSize = Math.min(
    WATERMARK_MAX_SIZE,
    Math.max(WATERMARK_MIN_SIZE, Math.round(1150 / length)),
  );

  return { text, fontSize };
}
