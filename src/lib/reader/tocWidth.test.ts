import { describe, expect, it } from 'vitest';
import {
  clampTocWidth,
  TOC_WIDTH_DEFAULT,
  TOC_WIDTH_MAX,
  TOC_WIDTH_MIN,
} from './tocWidth';

describe('tocWidth', () => {
  it('mantiene los anchos dentro del rango configurable', () => {
    expect(clampTocWidth(120)).toBe(TOC_WIDTH_MIN);
    expect(clampTocWidth(280)).toBe(280);
    expect(clampTocWidth(900)).toBe(TOC_WIDTH_MAX);
  });

  it('redondea y recupera el valor por defecto ante datos inválidos', () => {
    expect(clampTocWidth(250.6)).toBe(251);
    expect(clampTocWidth(Number.NaN)).toBe(TOC_WIDTH_DEFAULT);
    expect(clampTocWidth(Number.POSITIVE_INFINITY)).toBe(TOC_WIDTH_DEFAULT);
  });
});
