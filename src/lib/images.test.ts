import { describe, expect, it } from 'vitest';
import { isHttpsImage, isRemoteImage, isSafeImageSrc } from './images';

describe('imágenes', () => {
  it('acepta https, data:image, blob y rutas relativas', () => {
    expect(isSafeImageSrc('https://example.com/foto.jpg')).toBe(true);
    expect(isSafeImageSrc('data:image/png;base64,abc')).toBe(true);
    expect(isSafeImageSrc('blob:https://example.com/123')).toBe(true);
    expect(isSafeImageSrc('images/foto.png')).toBe(true);
    expect(isSafeImageSrc('/images/foto.png')).toBe(true);
  });

  it('rechaza esquemas peligrosos o desconocidos', () => {
    expect(isSafeImageSrc('javascript:alert(1)')).toBe(false);
    expect(isSafeImageSrc('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeImageSrc('file:///C:/foto.png')).toBe(false);
    expect(isSafeImageSrc('https://user:pass@example.com/foto.jpg')).toBe(false);
  });

  it('detecta imágenes remotas y https', () => {
    expect(isRemoteImage('https://example.com/foto.jpg')).toBe(true);
    expect(isRemoteImage('//example.com/foto.jpg')).toBe(true);
    expect(isRemoteImage('images/foto.jpg')).toBe(false);
    expect(isHttpsImage('https://example.com/foto.jpg')).toBe(true);
    expect(isHttpsImage('http://example.com/foto.jpg')).toBe(false);
  });
});
