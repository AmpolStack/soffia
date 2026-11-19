import type { SofiaDocument } from './format/types';
import { DAY_MS, isDue } from './srs';
import type { DeckProgress, SessionRecord } from './storage/progress';

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

export type LastAttemptStats = {
  quiz: {
    correct: number;
    total: number;
    accuracy: number;
    at: number;
  } | null;
  cards: {
    recalled: number;
    total: number;
    percent: number | null;
    at: number;
  } | null;
  qa: {
    revealed: number;
    total: number;
    at: number;
  } | null;
  lastAt: number | null;
};

export function latestSessionOfType(
  progress: DeckProgress,
  type: SessionRecord['type'],
): SessionRecord | null {
  let latest: SessionRecord | null = null;
  for (const session of progress.sessions) {
    if (session.type !== type) continue;
    if (!latest || session.at > latest.at) latest = session;
  }
  return latest;
}

export function computeLastAttempt(progress: DeckProgress): LastAttemptStats {
  const quiz = latestSessionOfType(progress, 'quiz');
  const cards = latestSessionOfType(progress, 'cards');
  const qa = latestSessionOfType(progress, 'qa');

  const quizTotal = quiz?.total ?? 0;
  const cardTotal = cards?.total ?? 0;
  const cardRecalled = cards?.correct;
  const lastAt = [quiz?.at, cards?.at, qa?.at].reduce<number | null>(
    (latest, at) =>
      at === undefined ? latest : latest === null || at > latest ? at : latest,
    null,
  );

  return {
    quiz: quiz
      ? {
          correct: quiz.correct ?? 0,
          total: quizTotal,
          accuracy: quizTotal
            ? Math.round(((quiz.correct ?? 0) / quizTotal) * 100)
            : 0,
          at: quiz.at,
        }
      : null,
    cards: cards
      ? {
          recalled: cardRecalled ?? 0,
          total: cardTotal,
          percent:
            cardRecalled !== undefined && cardTotal > 0
              ? Math.round((cardRecalled / cardTotal) * 100)
              : null,
          at: cards.at,
        }
      : null,
    qa: qa
      ? {
          revealed: qa.correct ?? 0,
          total: qa.total ?? 0,
          at: qa.at,
        }
      : null,
    lastAt,
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
