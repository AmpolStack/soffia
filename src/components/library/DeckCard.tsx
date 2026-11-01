import { ArrowRight, Clock, HelpCircle, Layers, Target, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DeckRecord } from '../../lib/storage/decks';
import { formatRelativeTime } from '../../lib/stats';

export function DeckCard({
  deck,
  index,
  isDemo,
  onDelete,
}: {
  deck: DeckRecord;
  index: number;
  isDemo: boolean;
  onDelete: () => void;
}) {
  return (
    <article className="deck-card">
      <Link className="deck-card__main" to={`/deck/${deck.id}`}>
        <div className="deck-card__top">
          <span className="deck-card__index">{String(index + 1).padStart(2, '0')}</span>
          <div className="deck-card__tags">
            {isDemo ? <span className="chip chip--solid">Ejemplo</span> : null}
            {deck.tags.slice(0, 3).map((tag) => (
              <span className="chip" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="deck-card__title-wrap">
          <h2 className="deck-card__title">{deck.title}</h2>
          {deck.subtitle ? <p className="deck-card__subtitle">{deck.subtitle}</p> : null}
        </div>

        <div className="deck-card__meta">
          <span>
            <Clock size={14} aria-hidden="true" />
            {deck.summary.minutes} min
          </span>
          <span>
            <Target size={14} aria-hidden="true" />
            {deck.summary.quizzes} quizzes
          </span>
          <span>
            <Layers size={14} aria-hidden="true" />
            {deck.summary.cards} tarjetas
          </span>
          <span>
            <HelpCircle size={14} aria-hidden="true" />
            {deck.summary.qa} preguntas
          </span>
        </div>

        <div className="deck-card__footer">
          <span>{deck.summary.sections} secciones · {deck.summary.images} imágenes</span>
          <span className="deck-card__open">
            {formatRelativeTime(deck.lastOpenedAt ?? deck.updatedAt)}
            <ArrowRight size={15} aria-hidden="true" />
          </span>
        </div>
      </Link>

      <button
        type="button"
        className="deck-card__delete"
        onClick={onDelete}
        aria-label={`Eliminar ${deck.title}`}
        title="Eliminar deck"
      >
        <Trash2 size={16} />
      </button>
    </article>
  );
}
