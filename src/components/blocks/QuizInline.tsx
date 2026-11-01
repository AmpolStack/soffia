import { useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { useDeck } from '../../contexts/DeckContext';
import type { QuizBlock } from '../../lib/format/types';
import { InlineMarkdown, Markdown } from '../Markdown';

export function QuizInline({ block }: { block: QuizBlock }) {
  const { recordQuizAnswer } = useDeck();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);

  const correctIds = new Set(
    block.options.filter((option) => option.correct).map((option) => option.id),
  );
  const isCorrect =
    correctIds.size > 0 &&
    selected.size === correctIds.size &&
    Array.from(selected).every((id) => correctIds.has(id));

  const toggle = (id: string) => {
    if (submitted) return;
    setSelected((current) => {
      if (block.multiple) {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  };

  const submit = () => {
    if (selected.size === 0 || submitted) return;
    setSubmitted(true);
    recordQuizAnswer(block.id, isCorrect);
  };

  const reset = () => {
    setSelected(new Set());
    setSubmitted(false);
  };

  return (
    <section className={`inline-quiz${submitted ? ' is-submitted' : ''}`}>
      <div className="inline-quiz__eyebrow">
        <span>Comprueba tu comprensión</span>
        {block.multiple ? <span className="chip">Varias respuestas</span> : null}
      </div>

      <div className="inline-quiz__question">
        <Markdown source={block.question} compact />
      </div>

      <div className="inline-quiz__options" role="group" aria-label="Opciones">
        {block.options.map((option, index) => {
          const isSelected = selected.has(option.id);
          const state = submitted
            ? option.correct
              ? 'correct'
              : isSelected
                ? 'wrong'
                : 'idle'
            : isSelected
              ? 'selected'
              : 'idle';

          return (
            <button
              key={option.id}
              type="button"
              className={`option option--${state}`}
              onClick={() => toggle(option.id)}
              aria-pressed={isSelected}
              disabled={submitted}
            >
              <span className="option__letter">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="option__text">
                <InlineMarkdown source={option.text} />
              </span>
              <span className="option__mark" aria-hidden="true">
                {submitted && option.correct ? <Check size={17} /> : null}
                {submitted && !option.correct && isSelected ? <X size={17} /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="quiz-print-answer">
        <div className="quiz-feedback__title">
          <Check size={18} aria-hidden="true" />
          <strong>Respuesta correcta</strong>
        </div>
        <ul>
          {block.options
            .filter((option) => option.correct)
            .map((option) => (
              <li key={option.id}>
                <InlineMarkdown source={option.text} />
              </li>
            ))}
        </ul>
        {block.explanation ? (
          <Markdown source={block.explanation} compact />
        ) : null}
      </div>

      {submitted ? (
        <div
          className={`quiz-feedback ${isCorrect ? 'is-correct' : 'is-wrong'}`}
          role="status"
        >
          <div className="quiz-feedback__title">
            {isCorrect ? <Check size={18} /> : <X size={18} />}
            <strong>{isCorrect ? 'Correcto' : 'Todavía no'}</strong>
          </div>
          {block.explanation ? (
            <Markdown source={block.explanation} compact />
          ) : (
            <p>Revisa las opciones marcadas y vuelve a intentarlo.</p>
          )}
          <button type="button" className="button button--ghost button--small" onClick={reset}>
            <RotateCcw size={15} aria-hidden="true" />
            Reintentar
          </button>
        </div>
      ) : (
        <div className="inline-quiz__actions">
          <button
            type="button"
            className="button button--solid"
            onClick={submit}
            disabled={selected.size === 0}
          >
            Comprobar
          </button>
          <span className="muted small">
            {block.multiple
              ? 'Selecciona todas las opciones correctas.'
              : 'Selecciona una opción.'}
          </span>
        </div>
      )}
    </section>
  );
}
