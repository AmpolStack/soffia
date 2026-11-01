import { describe, expect, it } from 'vitest';
import type { DeckRecord } from './storage';
import { buildTagIndex, filterDecksByTags, normalizeTag } from './tags';

function deck(id: string, tags: string[]): DeckRecord {
  return {
    id,
    title: id,
    tags,
    language: 'es',
    sourceName: `${id}.md`,
    markdown: '',
    assets: {},
    createdAt: 0,
    updatedAt: 0,
    summary: {
      sections: 0,
      quizzes: 0,
      cards: 0,
      qa: 0,
      references: 0,
      images: 0,
      words: 0,
      minutes: 0,
    },
  };
}

const decks = [
  deck('a', ['Dermatología', 'Pediatría']),
  deck('b', ['dermatología', 'Infectología']),
  deck('c', ['Cardiología']),
];

describe('tags', () => {
  it('normaliza mayúsculas y espacios', () => {
    expect(normalizeTag('  Dermatología  ')).toBe('dermatología');
  });

  it('construye el índice con todos los tags y sus conteos', () => {
    const index = buildTagIndex(decks);
    expect(index.map((entry) => [entry.label, entry.count])).toEqual([
      ['Cardiología', 1],
      ['Dermatología', 2],
      ['Infectología', 1],
      ['Pediatría', 1],
    ]);
  });

  it('filtra por cualquiera de los tags seleccionados', () => {
    expect(filterDecksByTags(decks, ['dermatología']).map((item) => item.id)).toEqual([
      'a',
      'b',
    ]);
    expect(
      filterDecksByTags(decks, ['dermatología', 'cardiología']).map(
        (item) => item.id,
      ),
    ).toEqual(['a', 'b', 'c']);
  });

  it('devuelve todos los decks sin filtros', () => {
    expect(filterDecksByTags(decks, [])).toHaveLength(3);
  });
});
