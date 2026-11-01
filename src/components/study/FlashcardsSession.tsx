import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Layers,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useDeck } from '../../contexts/DeckContext';
import type { Flashcard } from '../../lib/format/types';
import {
  GRADE_AGAIN,
  GRADE_EASY,
  GRADE_GOOD,
  GRADE_HARD,
  cardStateLabel,
  isDue,
  scheduleCard,
  type Grade,
} from '../../lib/srs';
import { Markdown } from '../Markdown';
import { ScoreRing } from './ScoreRing';

const GRADE_META: Array<{
  grade: Grade;
  label: string;
  short: string;
  hint: string;
}> = [
  { grade: GRADE_AGAIN, label: 'Otra vez', short: 'Otra vez', hint: '10 min' },
  { grade: GRADE_HARD, label: 'Difícil', short: 'Difícil', hint: '1 día' },
  { grade: GRADE_GOOD, label: 'Bien', short: 'Bien', hint: '3 días' },
  { grade: GRADE_EASY, label: 'Fácil', short: 'Fácil', hint: '6 días' },
];

function nextIntervalLabel(
  card: Flashcard,
  grade: Grade,
  current: ReturnType<typeof scheduleCard> | undefined,
): string {
  if (grade === GRADE_AGAIN) return '10 min';
  const next = scheduleCard(current, grade);
  const days = Math.max(1, Math.round(next.interval));
  return days === 1 ? '1 día' : `${days} días`;
}

export function FlashcardsSession() {
  const { deck, document: doc, progress, recordCardGrade, recordSession } = useDeck();
  const cards = doc?.flashcards ?? [];
  const [mode, setMode] = useState<'due' | 'all'>('due');
  const [queue, setQueue] = useState<string[]>(() =>
    cards.filter((card) => isDue(progress.cards[card.id])).map((card) => card.id),
  );
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [phase, setPhase] = useState<'session' | 'summary'>('session');
  const [reviewed, setReviewed] = useState<Grade[]>([]);

  const cardById = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards],
  );
  const currentCard = cardById.get(queue[index] ?? '');
  const dueCards = cards.filter((card) => isDue(progress.cards[card.id]));
  const total = queue.length;
  const goodCount = reviewed.filter(
    (grade) => grade === GRADE_GOOD || grade === GRADE_EASY,
  ).length;
  const percent = reviewed.length
    ? Math.round((goodCount / reviewed.length) * 100)
    : 0;

  const start = (nextMode: 'due' | 'all') => {
    const ids = cards
      .filter((card) =>
        nextMode === 'all' ? true : isDue(progress.cards[card.id]),
      )
      .map((card) => card.id);
    setMode(nextMode);
    setQueue(ids);
    setIndex(0);
    setFlipped(false);
    setPhase('session');
    setReviewed([]);
  };

  const grade = (value: Grade) => {
    if (!currentCard || !flipped) return;
    recordCardGrade(currentCard.id, value);
    const nextReviewed = [...reviewed, value];
    setReviewed(nextReviewed);

    if (index + 1 >= queue.length) {
      recordSession({ type: 'cards', total: nextReviewed.length });
      setPhase('summary');
      return;
    }

    setIndex((current) => current + 1);
    setFlipped(false);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (phase !== 'session' || !currentCard) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        setFlipped((current) => !current);
        return;
      }
      if (!flipped) return;
      const map: Record<string, Grade> = {
        '1': GRADE_AGAIN,
        '2': GRADE_HARD,
        '3': GRADE_GOOD,
        '4': GRADE_EASY,
      };
      const selected = map[event.key];
      if (selected !== undefined) {
        event.preventDefault();
        grade(selected);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // Las funciones dependen del estado actual de la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentCard, flipped, index, queue.length, reviewed]);

  if (!deck || !doc) return null;

  if (cards.length === 0) {
    return (
      <div className="study-page study-page--narrow">
        <Link className="text-link" to={`/deck/${deck.id}/study`}>
          <ArrowLeft size={15} aria-hidden="true" />
          Volver al modo estudio
        </Link>
        <div className="empty-state">
          <Layers size={26} aria-hidden="true" />
          <h1>Este deck no tiene tarjetas</h1>
          <p>
            Añade bloques <code>:::flashcards</code> al Markdown para crear un
            mazo de repaso espaciado.
          </p>
          <Link className="button button--solid" to={`/deck/${deck.id}`}>
            <BookOpen size={16} aria-hidden="true" />
            Volver a leer
          </Link>
        </div>
      </div>
    );
  }

  if (phase === 'summary') {
    return (
      <div className="study-page study-page--narrow">
        <div className="session-summary">
          <span className="study-header__eyebrow">Mazo completado</span>
          <h1>Repaso terminado</h1>
          <div className="session-summary__score">
            <ScoreRing
              value={percent}
              label="Recordadas"
              detail={`${goodCount} de ${reviewed.length} tarjetas`}
              size={196}
            />
            <div className="session-summary__copy">
              <p>
                El repaso espaciado funciona mejor si vuelves justo cuando toca.
                Las tarjetas que has marcado como difíciles aparecerán antes.
              </p>
              <div className="grade-summary">
                {GRADE_META.map((meta) => (
                  <span key={meta.grade}>
                    <i className={`grade-dot grade-dot--${meta.grade}`} />
                    {meta.label}: {reviewed.filter((grade) => grade === meta.grade).length}
                  </span>
                ))}
              </div>
              <div className="session-summary__actions">
                <button type="button" className="button button--solid" onClick={() => start('all')}>
                  <RotateCcw size={16} aria-hidden="true" />
                  Repasar todo
                </button>
                <Link className="button button--outline" to={`/deck/${deck.id}/study`}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  Modo estudio
                </Link>
                <Link className="button button--ghost" to={`/deck/${deck.id}`}>
                  <BookOpen size={16} aria-hidden="true" />
                  Leer apuntes
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="study-page study-page--narrow">
        <div className="empty-state">
          <Check size={28} aria-hidden="true" />
          <h1>No hay tarjetas pendientes</h1>
          <p>
            Has repasado todas las tarjetas para hoy. Puedes esperar al próximo
            repaso o adelantar el mazo completo.
          </p>
          <div className="card-state-grid">
            <div>
              <strong>{cards.length}</strong>
              <span>en total</span>
            </div>
            <div>
              <strong>{cards.filter((card) => !progress.cards[card.id]).length}</strong>
              <span>nuevas</span>
            </div>
            <div>
              <strong>{dueCards.length}</strong>
              <span>pendientes</span>
            </div>
          </div>
          <div className="button-row">
            <button type="button" className="button button--solid" onClick={() => start('all')}>
              <RotateCcw size={16} aria-hidden="true" />
              Repasar todo
            </button>
            <Link className="button button--ghost" to={`/deck/${deck.id}/study`}>
              <ArrowLeft size={16} aria-hidden="true" />
              Volver
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!currentCard) return null;

  return (
    <div className="study-page study-page--narrow">
      <div className="session-top">
        <Link className="text-link" to={`/deck/${deck.id}/study`}>
          <ArrowLeft size={15} aria-hidden="true" />
          Salir
        </Link>
        <span className="session-top__label">
          Tarjeta {index + 1} de {total}
          {mode === 'all' ? ' · mazo completo' : ' · pendientes de hoy'}
        </span>
      </div>

      <div className="session-progress" aria-hidden="true">
        <span style={{ width: `${(index / total) * 100}%` }} />
      </div>

      <section className="flashcard-session">
        <div className="flashcard-session__meta">
          <span className="chip">Repaso espaciado</span>
          <span className="chip">{cardStateLabel(progress.cards[currentCard.id])}</span>
        </div>

        <button
          type="button"
          className={`flashcard${flipped ? ' is-flipped' : ''}`}
          onClick={() => setFlipped((current) => !current)}
          aria-label={flipped ? 'Mostrar frente' : 'Mostrar reverso'}
        >
          <span className="flashcard__side">{flipped ? 'Reverso' : 'Frente'}</span>
          <span className="flashcard__content">
            <Markdown source={flipped ? currentCard.back : currentCard.front} />
          </span>
          <span className="flashcard__hint">
            <RefreshCw size={15} aria-hidden="true" />
            {flipped ? 'Toca para volver al frente' : 'Toca para revelar la respuesta'}
          </span>
        </button>

        {flipped ? (
          <div className="grade-buttons" aria-label="Valorar recuerdo">
            {GRADE_META.map((meta) => (
              <button
                key={meta.grade}
                type="button"
                className={`grade-button grade-button--${meta.grade}`}
                onClick={() => grade(meta.grade)}
              >
                <span className="grade-button__key">{meta.grade + 1}</span>
                <span className="grade-button__label">{meta.short}</span>
                <span className="grade-button__hint">
                  {nextIntervalLabel(
                    currentCard,
                    meta.grade,
                    progress.cards[currentCard.id],
                  )}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flashcard-session__prompt">
            <span>Intenta recordar la respuesta antes de girar.</span>
            <button
              type="button"
              className="button button--solid"
              onClick={() => setFlipped(true)}
            >
              Mostrar respuesta
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="session-footnote">
          <span>
            {reviewed.length} valoradas · {goodCount} recordadas
          </span>
          <span className="muted small">Espacio para girar · 1–4 para valorar</span>
        </div>
      </section>
    </div>
  );
}
