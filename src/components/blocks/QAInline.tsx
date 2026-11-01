import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronsDown, ChevronsUp, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDeck } from '../../contexts/DeckContext';
import type { QABlock } from '../../lib/format/types';
import { InlineMarkdown, Markdown } from '../Markdown';

export function QAInline({ block }: { block: QABlock }) {
  const { deck, recordQaReveal } = useDeck();
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [recorded, setRecorded] = useState<Set<string>>(() => new Set());
  const allOpen =
    block.items.length > 0 && block.items.every((item) => revealed.has(item.id));

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
    setRevealed(new Set(block.items.map((item) => item.id)));
    const pending = block.items.filter((item) => !recorded.has(item.id));
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
    <section className="qa-inline">
      <div className="qa-inline__top">
        <span className="inline-quiz__eyebrow">
          <HelpCircle size={15} aria-hidden="true" />
          Preguntas para repasar
        </span>
        <div className="qa-inline__actions">
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={allOpen ? collapseAll : expandAll}
            disabled={block.items.length === 0}
          >
            {allOpen ? (
              <ChevronsUp size={14} aria-hidden="true" />
            ) : (
              <ChevronsDown size={14} aria-hidden="true" />
            )}
            {allOpen ? 'Colapsar todo' : 'Expandir todo'}
          </button>
          {deck ? (
            <Link className="text-link" to={`/deck/${deck.id}/qa`}>
              Practicar
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="qa-inline__list">
        {block.items.map((item) => {
          const isOpen = revealed.has(item.id);
          return (
            <article className={`qa-item${isOpen ? ' is-open' : ''}`} key={item.id}>
              <button
                type="button"
                className="qa-item__question"
                onClick={() => toggle(item.id)}
                aria-expanded={isOpen}
              >
                <span>
                  <InlineMarkdown source={item.question} />
                </span>
                <ChevronDown size={17} aria-hidden="true" />
              </button>
              <div className="qa-item__answer" hidden={!isOpen}>
                <Markdown source={item.answer} compact />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
