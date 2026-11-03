import { describe, expect, it } from 'vitest';
import {
  getWatermarkMetrics,
  WATERMARK_MAX_CHARS,
  WATERMARK_MAX_SIZE,
  WATERMARK_MIN_SIZE,
} from './watermark';

describe('watermark', () => {
  it('reduce la fuente a medida que crece el título', () => {
    const short = getWatermarkMetrics('Tema');
    const medium = getWatermarkMetrics('Un tema con más palabras');
    expect(short.fontSize).toBe(WATERMARK_MAX_SIZE);
    expect(medium.fontSize).toBeLessThan(short.fontSize);
  });

  it('recorta los títulos largos con puntos suspensivos', () => {
    const title = 'Un título extraordinariamente largo que no cabe en el aside';
    const result = getWatermarkMetrics(title);
    expect(result.text.length).toBeLessThanOrEqual(WATERMARK_MAX_CHARS);
    expect(result.text.endsWith('…')).toBe(true);
    expect(result.fontSize).toBeGreaterThanOrEqual(WATERMARK_MIN_SIZE);
  });

  it('normaliza espacios y mantiene el texto corto intacto', () => {
    expect(getWatermarkMetrics('  Tema   corto  ').text).toBe('Tema corto');
  });
});
