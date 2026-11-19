import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../Modal';
import { parseDocument } from '../../lib/format/parse';
import {
  computeDeckStats,
  computeLastAttempt,
  formatRelativeTime,
  type DeckStats,
  type LastAttemptStats,
} from '../../lib/stats';
import {
  getDeck,
  loadProgress,
  type DeckRecord,
} from '../../lib/storage';

type LoadedResults = {
  stats: DeckStats;
  last: LastAttemptStats;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; results: LoadedResults };

function percent(value: number, total: number): number {
  return total ? Math.round((value / total) * 100) : 0;
}

export function DeckResultsModal({
  deck,
  onClose,
}: {
  deck: DeckRecord;
  onClose: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    async function load() {
      try {
        const [record, progress] = await Promise.all([
          getDeck(deck.id),
          loadProgress(deck.id),
        ]);
        if (!record) throw new Error('Deck no encontrado.');
        const doc = parseDocument(record.markdown, {
          sourceName: record.sourceName,
        });
        if (cancelled) return;
        setState({
          status: 'ready',
          results: {
            stats: computeDeckStats(doc, progress),
            last: computeLastAttempt(progress),
          },
        });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [deck.id]);

  return (
    <Modal
      open
      onClose={onClose}
      title="Resultados de estudio"
      description={deck.title}
      footer={
        <>
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
          >
            Cerrar
          </button>
          <Link
            className="button button--solid"
            to={`/deck/${deck.id}/study`}
            onClick={onClose}
          >
            Ver panel completo
          </Link>
        </>
      }
    >
      {state.status === 'loading' ? (
        <p className="results-loading" role="status">
          Cargando resultados…
        </p>
      ) : state.status === 'error' ? (
        <p className="muted">
          No se pudieron cargar los resultados de este deck. Vuelve a intentarlo
          desde la biblioteca.
        </p>
      ) : (
        <ResultsBody stats={state.results.stats} last={state.results.last} />
      )}
    </Modal>
  );
}

function ResultsBody({
  stats,
  last,
}: {
  stats: DeckStats;
  last: LastAttemptStats;
}) {
  const cardsPercent = percent(stats.cardsReviewed, stats.cardsTotal);
  const qaPercent = percent(stats.qaRevealed, stats.qaTotal);

  return (
    <div className="results-summary">
      <section className="results-block">
        <header className="results-block__header">
          <span className="eyebrow">Histórico del deck</span>
          <h3>Global</h3>
        </header>
        <dl className="results-list">
          <div>
            <dt>Precisión en quizzes</dt>
            <dd>
              {stats.quizAccuracy === null ? '—' : `${stats.quizAccuracy}%`}
              <small>
                {stats.quizAttempts
                  ? `${stats.quizCorrect} de ${stats.quizAttempts} respuestas`
                  : 'Sin intentos todavía'}
              </small>
            </dd>
          </div>
          <div>
            <dt>Tarjetas repasadas</dt>
            <dd>
              {stats.cardsReviewed}/{stats.cardsTotal}
              <small>{cardsPercent}% del mazo</small>
            </dd>
          </div>
          <div>
            <dt>Preguntas reveladas</dt>
            <dd>
              {stats.qaRevealed}/{stats.qaTotal}
              <small>{qaPercent}% del total</small>
            </dd>
          </div>
          <div>
            <dt>Actividad</dt>
            <dd>
              {formatRelativeTime(stats.lastStudiedAt)}
              <small>
                {stats.sessions.length}{' '}
                {stats.sessions.length === 1 ? 'sesión' : 'sesiones'} registradas
              </small>
            </dd>
          </div>
        </dl>
      </section>

      <section className="results-block">
        <header className="results-block__header">
          <span className="eyebrow">Resultado más reciente</span>
          <h3>Último intento</h3>
        </header>
        <dl className="results-list">
          <div>
            <dt>Quiz</dt>
            <dd>
              {last.quiz ? `${last.quiz.accuracy}%` : '—'}
              <small>
                {last.quiz
                  ? `${last.quiz.correct} de ${last.quiz.total} · ${formatRelativeTime(last.quiz.at)}`
                  : 'Sin intentos todavía'}
              </small>
            </dd>
          </div>
          <div>
            <dt>Tarjetas</dt>
            <dd>
              {last.cards
                ? last.cards.percent === null
                  ? `${last.cards.recalled}/${last.cards.total}`
                  : `${last.cards.percent}%`
                : '—'}
              <small>
                {last.cards
                  ? `${last.cards.recalled} recordadas de ${last.cards.total} · ${formatRelativeTime(last.cards.at)}`
                  : 'Sin repasos todavía'}
              </small>
            </dd>
          </div>
          <div>
            <dt>Preguntas</dt>
            <dd>
              {last.qa ? `${last.qa.revealed}/${last.qa.total}` : '—'}
              <small>
                {last.qa
                  ? `Abiertas en la última visita · ${formatRelativeTime(last.qa.at)}`
                  : 'Sin sesiones todavía'}
              </small>
            </dd>
          </div>
          <div>
            <dt>Última actividad</dt>
            <dd>
              {formatRelativeTime(last.lastAt ?? undefined)}
              <small>
                {last.lastAt
                  ? 'Basado en la última sesión completada'
                  : 'Completa un quiz, un repaso o una visita a preguntas'}
              </small>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
