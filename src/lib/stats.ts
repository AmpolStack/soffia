import type { SofiaDocument } from './format/types';
import { DAY_MS, isDue } from './srs';
import type { DeckProgress } from './storage/progress';

export type DeckStats = {
  sectionsRead: number;
  sectionsTotal: number;
  sectionPercent: number;
  quizAttempts: number;
  quizCorrect: number;
  quizAccuracy: number | null;
  cardsTotal: number;
  cardsDue: number;
  cardsNew: number;
  cardsLearning: number;
  cardsMature: number;
  cardsReviewed: number;
  qaTotal: number;
  qaRevealed: number;
  sessions: DeckProgress['sessions'];
  streak: number;
  lastStudiedAt?: number;
};

export function computeDeckStats(
  doc: SofiaDocument,
  progress: DeckProgress,
  now = Date.now(),
): DeckStats {
  const sectionsRead = doc.sections.filter(
    (section) => progress.sections[section.id],
  ).length;
  const sectionsTotal = doc.sections.length;

  let quizAttempts = 0;
  let quizCorrect = 0;
  Object.values(progress.quizzes).forEach((quiz) => {
    quizAttempts += quiz.attempts;
    quizCorrect += quiz.correct;
  });

  let cardsDue = 0;
  let cardsNew = 0;
  let cardsLearning = 0;
  let cardsMature = 0;
  let cardsReviewed = 0;

  doc.flashcards.forEach((card) => {
    const cardProgress = progress.cards[card.id];
    if (!cardProgress || cardProgress.reps === 0) {
      cardsNew += 1;
      cardsDue += 1;
      return;
    }
    cardsReviewed += 1;
    if (isDue(cardProgress, now)) cardsDue += 1;
    if (cardProgress.interval >= 21) cardsMature += 1;
    else if (cardProgress.interval >= 1) cardsLearning += 1;
    else cardsLearning += 1;
  });

  const qaRevealed = doc.qa.filter((item) => progress.qa[item.id]?.revealed).length;

  return {
    sectionsRead,
    sectionsTotal,
    sectionPercent: sectionsTotal
      ? Math.round((sectionsRead / sectionsTotal) * 100)
      : 0,
    quizAttempts,
    quizCorrect,
    quizAccuracy: quizAttempts ? Math.round((quizCorrect / quizAttempts) * 100) : null,
    cardsTotal: doc.flashcards.length,
    cardsDue,
    cardsNew,
    cardsLearning,
    cardsMature,
    cardsReviewed,
    qaTotal: doc.qa.length,
    qaRevealed,
    sessions: progress.sessions,
    streak: computeStreak(progress, now),
    lastStudiedAt: progress.lastStudiedAt,
  };
}

function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function computeStreak(progress: DeckProgress, now = Date.now()): number {
  const days = new Set(
    progress.sessions.map((session) => dayKey(session.at)),
  );
  if (progress.lastStudiedAt) days.add(dayKey(progress.lastStudiedAt));
  if (days.size === 0) return 0;

  let cursor = now;
  if (!days.has(dayKey(cursor))) {
    cursor -= DAY_MS;
    if (!days.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

export function formatRelativeTime(timestamp: number | undefined, now = Date.now()): string {
  if (!timestamp) return 'Sin actividad';
  const diff = now - timestamp;
  if (diff < 60_000) return 'Hace un momento';
  if (diff < 3_600_000) {
    const minutes = Math.round(diff / 60_000);
    return `Hace ${minutes} min`;
  }
  if (diff < DAY_MS) {
    const hours = Math.round(diff / 3_600_000);
    return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  }
  if (diff < 7 * DAY_MS) {
    const days = Math.round(diff / DAY_MS);
    return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
  }
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
  }).format(timestamp);
}

export function formatSessionDate(timestamp: number): string {
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

export function sessionLabel(type: DeckProgress['sessions'][number]['type']): string {
  if (type === 'quiz') return 'Quiz';
  if (type === 'cards') return 'Tarjetas';
  return 'Preguntas';
}
