import { describe, expect, it } from 'vitest';
import { computeLastAttempt, latestSessionOfType } from './stats';
import type { DeckProgress, SessionRecord } from './storage/progress';

function progressWith(sessions: SessionRecord[]): DeckProgress {
  return {
    deckId: 'deck-test',
    sections: {},
    quizzes: {},
    cards: {},
    qa: {},
    sessions,
  };
}

function record(
  type: SessionRecord['type'],
  at: number,
  fields: Pick<SessionRecord, 'correct' | 'total'> = {},
): SessionRecord {
  return { id: `${type}-${at}`, type, at, ...fields };
}

describe('latestSessionOfType', () => {
  it('devuelve null cuando no hay sesiones de ese tipo', () => {
    const progress = progressWith([record('quiz', 1000, { correct: 2, total: 3 })]);
    expect(latestSessionOfType(progress, 'cards')).toBeNull();
  });

  it('elige la sesión más reciente aunque el array no esté ordenado', () => {
    const progress = progressWith([
      record('quiz', 2000, { correct: 1, total: 4 }),
      record('cards', 3000, { correct: 2, total: 2 }),
      record('quiz', 5000, { correct: 3, total: 4 }),
    ]);
    expect(latestSessionOfType(progress, 'quiz')?.at).toBe(5000);
  });
});

describe('computeLastAttempt', () => {
  it('devuelve todos los contextos vacíos sin sesiones', () => {
    expect(computeLastAttempt(progressWith([]))).toEqual({
      quiz: null,
      cards: null,
      qa: null,
      lastAt: null,
    });
  });

  it('calcula la precisión del último quiz', () => {
    const progress = progressWith([
      record('quiz', 1000, { correct: 1, total: 5 }),
      record('quiz', 9000, { correct: 4, total: 5 }),
    ]);

    expect(computeLastAttempt(progress).quiz).toEqual({
      correct: 4,
      total: 5,
      accuracy: 80,
      at: 9000,
    });
  });

  it('calcula el recuerdo del último repaso de tarjetas', () => {
    const progress = progressWith([
      record('cards', 4000, { correct: 7, total: 10 }),
    ]);

    expect(computeLastAttempt(progress).cards).toEqual({
      recalled: 7,
      total: 10,
      percent: 70,
      at: 4000,
    });
  });

  it('deja el porcentaje en null para sesiones antiguas sin detalle', () => {
    const progress = progressWith([record('cards', 4000, { total: 12 })]);

    expect(computeLastAttempt(progress).cards).toEqual({
      recalled: 0,
      total: 12,
      percent: null,
      at: 4000,
    });
  });

  it('registra las preguntas abiertas en la última visita', () => {
    const progress = progressWith([
      record('qa', 3000, { correct: 2, total: 8 }),
      record('qa', 6000, { correct: 5, total: 8 }),
    ]);

    expect(computeLastAttempt(progress).qa).toEqual({
      revealed: 5,
      total: 8,
      at: 6000,
    });
  });

  it('usa la sesión más reciente de cualquier tipo como última actividad', () => {
    const progress = progressWith([
      record('quiz', 1000, { correct: 1, total: 2 }),
      record('cards', 7000, { correct: 1, total: 1 }),
      record('qa', 4000, { correct: 2, total: 4 }),
    ]);

    expect(computeLastAttempt(progress).lastAt).toBe(7000);
  });
});
