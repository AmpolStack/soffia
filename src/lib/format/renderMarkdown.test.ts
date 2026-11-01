import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './renderMarkdown';

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
