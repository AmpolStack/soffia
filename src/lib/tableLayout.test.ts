import { describe, expect, it } from 'vitest';
import { allocateTableWidths } from './tableLayout';

describe('allocateTableWidths', () => {
  it('reparte el ancho disponible sin superar el contenedor', () => {
    const result = allocateTableWidths({
      available: 600,
      minWidths: [100, 100, 100],
      weights: [200, 200, 200],
    });

    expect(result.overflow).toBe(false);
    expect(result.widths).toEqual([200, 200, 200]);
    expect(result.widths.reduce((sum, width) => sum + width, 0)).toBe(600);
  });

  it('respeta los mínimos de encabezados largos', () => {
    const result = allocateTableWidths({
      available: 600,
      minWidths: [400, 50, 50],
      weights: [400, 100, 100],
    });

    expect(result.overflow).toBe(false);
    expect(result.widths[0]).toBeGreaterThanOrEqual(400);
    expect(result.widths[1]).toBeGreaterThanOrEqual(50);
    expect(result.widths[2]).toBeGreaterThanOrEqual(50);
    expect(result.widths.reduce((sum, width) => sum + width, 0)).toBe(600);
  });

  it('marca overflow cuando los mínimos no caben', () => {
    const result = allocateTableWidths({
      available: 280,
      minWidths: [140, 140, 140],
      weights: [1, 1, 1],
    });

    expect(result.overflow).toBe(true);
    expect(result.minWidth).toBeGreaterThan(280);
    expect(result.widths).toEqual([140, 140, 140]);
  });

  it('reparte a partes iguales cuando los pesos son iguales', () => {
    const result = allocateTableWidths({
      available: 500,
      minWidths: [60, 60],
      weights: [1, 1],
    });

    expect(result.widths).toEqual([250, 250]);
  });

  it('no devuelve columnas vacías', () => {
    const result = allocateTableWidths({
      available: 0,
      minWidths: [],
      weights: [],
    });

    expect(result).toEqual({ widths: [], minWidth: 0, overflow: false });
  });
});
