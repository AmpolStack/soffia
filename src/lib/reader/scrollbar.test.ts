import { describe, expect, it } from 'vitest';
import { getScrollThumbMetrics } from './scrollbar';

describe('getScrollThumbMetrics', () => {
  it('oculta la barra cuando no hay contenido desplazable', () => {
    const metrics = getScrollThumbMetrics({
      scrollTop: 0,
      scrollHeight: 800,
      viewportHeight: 800,
      railHeight: 700,
    });

    expect(metrics.visible).toBe(false);
    expect(metrics.height).toBe(0);
  });

  it('calcula el tamaño proporcional y la posición inicial', () => {
    const metrics = getScrollThumbMetrics({
      scrollTop: 0,
      scrollHeight: 2000,
      viewportHeight: 1000,
      railHeight: 500,
    });

    expect(metrics.visible).toBe(true);
    expect(metrics.height).toBe(250);
    expect(metrics.top).toBe(0);
    expect(metrics.progress).toBe(0);
  });

  it('coloca el pulgar al final cuando el scroll está al máximo', () => {
    const metrics = getScrollThumbMetrics({
      scrollTop: 1000,
      scrollHeight: 2000,
      viewportHeight: 1000,
      railHeight: 500,
    });

    expect(metrics.top).toBe(250);
    expect(metrics.progress).toBe(1);
  });

  it('respeta el tamaño mínimo del pulgar', () => {
    const metrics = getScrollThumbMetrics({
      scrollTop: 0,
      scrollHeight: 100_000,
      viewportHeight: 800,
      railHeight: 600,
      minThumb: 48,
    });

    expect(metrics.height).toBe(48);
  });

  it('limita el progreso entre 0 y 1', () => {
    const metrics = getScrollThumbMetrics({
      scrollTop: 9999,
      scrollHeight: 2000,
      viewportHeight: 1000,
      railHeight: 500,
    });

    expect(metrics.progress).toBe(1);
  });
});
