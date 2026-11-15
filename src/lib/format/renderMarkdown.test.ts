import { describe, expect, it } from 'vitest';
import { renderInline, renderMarkdown } from './renderMarkdown';

describe('renderMarkdown con resaltados', () => {
  it('convierte ==texto== en un mark semántico', () => {
    const html = renderMarkdown('Una idea ==importante== para recordar.');
    expect(html).toContain(
      '<mark class="text-highlight">importante</mark>',
    );
  });

  it('permite marcas inline dentro del resaltado', () => {
    const html = renderInline('==Una **idea** clave==');
    expect(html).toContain('<mark class="text-highlight">');
    expect(html).toContain('<strong>idea</strong>');
  });

  it('deja intactos los marcadores sin cierre o vacíos', () => {
    expect(renderInline('a == b')).toContain('a == b');
    expect(renderInline('a ==== b')).toContain('a ==== b');
  });

  it('no interpreta == dentro de código en línea', () => {
    const html = renderInline('`a == b == c` y ==real==');
    expect(html).toContain('a == b == c');
    expect(html).toContain('<mark class="text-highlight">real</mark>');
  });
});

describe('renderMarkdown con imágenes web', () => {
  it('añade referrerpolicy a imágenes remotas', () => {
    const html = renderMarkdown(
      '![Radiografía](https://example.com/radiografia.jpg "Figura 1")',
    );
    expect(html).toContain('referrerpolicy="no-referrer"');
    expect(html).toContain('src="https://example.com/radiografia.jpg"');
  });

  it('no añade referrerpolicy a imágenes locales', () => {
    const html = renderMarkdown('![Esquema](images/esquema.png)');
    expect(html).not.toContain('referrerpolicy');
  });
});
