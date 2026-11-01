import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  HelpCircle,
} from 'lucide-react';
import { useDeck } from '../../contexts/DeckContext';
import { InlineMarkdown, Markdown } from '../Markdown';

export function QASession() {
  const { deck, document: doc, progress, recordQaReveal } = useDeck();
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [recorded, setRecorded] = useState<Set<string>>(
    () => new Set(Object.keys(progress.qa)),
  );
  const [filter, setFilter] = useState<'all' | 'pending'>('all');

  const items = doc?.qa ?? [];
  const visible = useMemo(
    () =>
      filter === 'all'
        ? items
        : items.filter((item) => !revealed.has(item.id)),
    [filter, items, revealed],
  );
  const revealedHistory = items.filter(
    (item) => (progress.qa[item.id]?.revealed ?? 0) > 0,
  ).length;
  const percent = items.length
    ? Math.round((revealedHistory / items.length) * 100)
    : 0;
  const allOpen =
    visible.length > 0 && visible.every((item) => revealed.has(item.id));

  if (!deck || !doc) return null;

  if (items.length === 0) {
    return (
      <div className="study-page study-page--narrow">
        <Link className="text-link" to={`/deck/${deck.id}/study`}>
          <ArrowLeft size={15} aria-hidden="true" />
          Volver al modo estudio
        </Link>
        <div className="empty-state">
          <HelpCircle size={26} aria-hidden="true" />
          <h1>Este deck no tiene preguntas</h1>
          <p>
            Añade bloques <code>:::qa</code> al Markdown para crear preguntas
            abiertas de repaso.
          </p>
          <Link className="button button--solid" to={`/deck/${deck.id}`}>
            <BookOpen size={16} aria-hidden="true" />
            Volver a leer
          </Link>
        </div>
      </div>
    );
  }

  const toggle = (itemId: string) => {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

    if (!recorded.has(itemId)) {
      setRecorded((current) => new Set(current).add(itemId));
      recordQaReveal(itemId);
    }
  };

  const expandAll = () => {
    if (visible.length === 0) return;
    setRevealed((current) => {
      const next = new Set(current);
      visible.forEach((item) => next.add(item.id));
      return next;
    });
    const pending = visible.filter((item) => !recorded.has(item.id));
    if (pending.length > 0) {
      setRecorded((current) => {
        const next = new Set(current);
        pending.forEach((item) => next.add(item.id));
        return next;
      });
      pending.forEach((item) => recordQaReveal(item.id));
    }
  };

  const collapseAll = () => setRevealed(new Set());

  return (
    <div className="study-page study-page--narrow">
      <header className="study-header">
        <Link className="text-link" to={`/deck/${deck.id}/study`}>
          <ArrowLeft size={15} aria-hidden="true" />
          Volver al modo estudio
        </Link>
        <span className="study-header__eyebrow">Preguntas abiertas</span>
        <h1>Explícalo con tus palabras</h1>
        <p>
          Intenta responder antes de revelar. La respuesta no tiene que ser
          literal: busca las ideas clave.
        </p>
      </header>

      <div className="qa-toolbar">
        <div className="qa-toolbar__progress">
          <span>
            {revealedHistory} de {items.length} reveladas
          </span>
          <div className="progress-track">
            <span style={{ width: `${percent}%` }} />
          </div>
        </div>
        <div className="qa-toolbar__actions">
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={allOpen ? collapseAll : expandAll}
            disabled={visible.length === 0}
          >
            {allOpen ? (
              <ChevronsUp size={15} aria-hidden="true" />
            ) : (
              <ChevronsDown size={15} aria-hidden="true" />
            )}
            {allOpen ? 'Colapsar todo' : 'Expandir todo'}
          </button>
          <div className="segmented segmented--compact" role="group" aria-label="Filtro">
            <button
              type="button"
              className={`segmented__button${filter === 'all' ? ' is-active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Todas
            </button>
            <button
              type="button"
              className={`segmented__button${filter === 'pending' ? ' is-active' : ''}`}
              onClick={() => setFilter('pending')}
            >
              Sin abrir
            </button>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty-inline">
          <p>No quedan preguntas sin abrir en esta vista.</p>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => setFilter('all')}
          >
            Ver todas
          </button>
        </div>
      ) : (
        <div className="qa-list">
          {visible.map((item, index) => {
            const isOpen = revealed.has(item.id);
            return (
              <article className={`qa-card${isOpen ? ' is-open' : ''}`} key={item.id}>
                <button
                  type="button"
                  className="qa-card__question"
                  onClick={() => toggle(item.id)}
                  aria-expanded={isOpen}
                >
                  <span className="qa-card__number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="qa-card__text">
                    <InlineMarkdown source={item.question} />
                  </span>
                  <ChevronDown size={18} aria-hidden="true" />
                </button>
                {isOpen ? (
                  <div className="qa-card__answer">
                    <span className="eyebrow">Respuesta</span>
                    <Markdown source={item.answer} />
                  </div>
                ) : (
                  <div className="qa-card__hint">Intenta responder antes de abrir.</div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="qa-footer">
        <span className="muted small">
          {percent}% de las preguntas tienen al menos una revelación registrada.
        </span>
      </div>
    </div>
  );
}
