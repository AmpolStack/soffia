import { describe, expect, it } from 'vitest';
import { rfcFileName } from './download';

describe('rfcFileName', () => {
  it('genera el patrón soffia-slug-id.md', () => {
    expect(rfcFileName('Seminario de prueba.md')).toMatch(
      /^soffia-seminario-de-prueba-[0-9a-f]{4}\.md$/,
    );
  });

  it('normaliza acentos y signos', () => {
    expect(rfcFileName('Impétigo (clínico).md')).toMatch(
      /^soffia-impetigo-clinico-[0-9a-f]{4}\.md$/,
    );
  });

  it('usa deck cuando no hay nombre', () => {
    expect(rfcFileName('.md')).toMatch(/^soffia-deck-[0-9a-f]{4}\.md$/);
  });
});
