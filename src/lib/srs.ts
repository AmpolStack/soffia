import type { CardProgress } from './storage/progress';

export const DAY_MS = 86_400_000;
export const GRADE_AGAIN = 0;
export const GRADE_HARD = 1;
export const GRADE_GOOD = 2;
export const GRADE_EASY = 3;

export type Grade = 0 | 1 | 2 | 3;

export function initialCardProgress(now = Date.now()): CardProgress {
  return {
    due: now,
    interval: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
  };
}

export function scheduleCard(
  current: CardProgress | undefined,
  grade: Grade,
  now = Date.now(),
): CardProgress {
  const state = current ?? initialCardProgress(now);
  let { interval, ease, reps, lapses } = state;

  if (grade === GRADE_AGAIN) {
    lapses += 1;
    reps = 0;
    interval = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else if (grade === GRADE_HARD) {
    interval = interval === 0 ? 1 : Math.max(1, interval * 1.2);
    ease = Math.max(1.3, ease - 0.15);
    reps += 1;
  } else if (grade === GRADE_GOOD) {
    interval = interval === 0 ? 1 : interval * ease;
    reps += 1;
  } else {
    interval = interval === 0 ? 3 : interval * ease * 1.3;
    ease = Math.min(3.2, ease + 0.15);
    reps += 1;
  }

  interval = Math.max(0, Math.round(interval * 10) / 10);
  const due =
    grade === GRADE_AGAIN ? now + 10 * 60 * 1000 : now + interval * DAY_MS;

  return {
    due,
    interval,
    ease,
    reps,
    lapses,
    lastGrade: grade,
    lastAt: now,
  };
}

export function isDue(
  progress: CardProgress | undefined,
  now = Date.now(),
): boolean {
  return !progress || progress.due <= now;
}

export function cardStateLabel(
  progress: CardProgress | undefined,
  now = Date.now(),
): string {
  if (!progress || progress.reps === 0) return 'Nueva';
  if (progress.due <= now) return 'Pendiente';
  if (progress.interval < 1) return 'En aprendizaje';
  const days = Math.max(1, Math.round(progress.interval));
  return `En ${days} ${days === 1 ? 'día' : 'días'}`;
}

export function dueCardCount(
  cards: Array<{ id: string }>,
  progress: Record<string, CardProgress>,
  now = Date.now(),
): number {
  return cards.filter((card) => isDue(progress[card.id], now)).length;
}
