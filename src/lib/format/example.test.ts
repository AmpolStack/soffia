import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDocument } from './parse';

const raw = readFileSync(
  new URL('../../../examples/impetigo/seminario.md', import.meta.url),
  'utf8',
);

describe('ejemplo Impétigo', () => {
  const doc = parseDocument(raw, { sourceName: 'seminario.md' });

  it('lee los metadatos del frontmatter', () => {
    expect(doc.meta.id).toBe('impetigo');
    expect(doc.meta.title).toBe('Impétigo');
    expect(doc.meta.subtitle).toBe(
      'Infección cutánea bacteriana superficial',
    );
    expect(doc.meta.tags).toEqual([
      'Dermatología',
      'Pediatría',
      'Infectología',
    ]);
    expect(doc.meta.cover).toBe('images/lesion-costras.svg');
    expect(doc.meta.estimatedMinutes).toBe(32);
  });

  it('construye la estructura de secciones y subsecciones', () => {
    expect(doc.sections).toHaveLength(15);
    expect(doc.sections[0].title).toBe('Objetivos de aprendizaje');
    expect(doc.sections[1].children.map((child) => child.title)).toEqual([
      '¿Quién se afecta?',
      'Microbiología',
    ]);
    expect(doc.sections[3].children).toHaveLength(3);
    expect(doc.sections[6].children).toHaveLength(3);
  });

  it('extrae el contenido interactivo', () => {
    expect(doc.quizzes).toHaveLength(9);
    expect(doc.quizzes.every((quiz) => quiz.options.some((o) => o.correct))).toBe(
      true,
    );
    for (const quiz of doc.quizzes) {
      expect(quiz.question.startsWith('**')).toBe(false);
      expect(quiz.explanation?.startsWith('**') ?? false).toBe(false);
    }
    expect(doc.flashcards).toHaveLength(12);
    expect(doc.qa).toHaveLength(8);
    expect(doc.references).toHaveLength(6);
  });

  it('encuentra las ilustraciones referenciadas', () => {
    expect(doc.images.map((image) => image.src)).toEqual([
      'images/lesion-costras.svg',
      'images/impetigo-ampolloso.svg',
      'images/ectima.svg',
      'images/algoritmo-tratamiento.svg',
    ]);
  });

  it('no produce avisos de análisis', () => {
    expect(doc.warnings).toEqual([]);
  });
});
