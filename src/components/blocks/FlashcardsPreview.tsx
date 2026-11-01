import { useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Layers, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDeck } from '../../contexts/DeckContext';
import type { FlashcardsBlock } from '../../lib/format/types';
import { Markdown } from '../Markdown';

export function FlashcardsPreview({ block }: { block: FlashcardsBlock }) {
  const { deck } = useDeck();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = block.cards[index];

  if (!card) {
    return <p className="muted">Este mazo no contiene tarjetas.</p>;
  }

  const move = (delta: number) => {
    setIndex((current) => {
      const next = (current + delta + block.cards.length) % block.cards.length;
      return next;
    });
    setFlipped(false);
  };

  return (
    <section className="deck-preview">
      <div className="deck-preview__top">
        <span className="inline-quiz__eyebrow">
          <Layers size={15} aria-hidden="true" />
          Mazo de repaso
        </span>
        <span className="muted small">
          {index + 1} / {block.cards.length}
        </span>
      </div>

      <button
        type="button"
        className={`flashcard-preview${flipped ? ' is-flipped' : ''}`}
        onClick={() => setFlipped((current) => !current)}
        aria-label={flipped ? 'Mostrar frente de la tarjeta' : 'Mostrar reverso de la tarjeta'}
      >
        <span className="flashcard-preview__face">
          {flipped ? 'Reverso' : 'Frente'}
        </span>
        <span className="flashcard-preview__content">
          <Markdown source={flipped ? card.back : card.front} compact />
        </span>
        <span className="flashcard-preview__hint">
          <RefreshCw size={14} aria-hidden="true" />
          Toca para girar
        </span>
      </button>

      <div className="deck-preview__actions">
        <div className="button-row">
          <button
            type="button"
            className="icon-button"
            onClick={() => move(-1)}
            aria-label="Tarjeta anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => move(1)}
            aria-label="Tarjeta siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        {deck ? (
          <Link className="button button--ghost button--small" to={`/deck/${deck.id}/cards`}>
            Estudiar mazo
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <div className="flashcards-print">
        {block.cards.map((item) => (
          <article className="flashcards-print__card" key={item.id}>
            <span className="flashcards-print__label">Frente</span>
            <Markdown source={item.front} compact />
            <span className="flashcards-print__label">Reverso</span>
            <Markdown source={item.back} compact />
          </article>
        ))}
      </div>
    </section>
  );
}
