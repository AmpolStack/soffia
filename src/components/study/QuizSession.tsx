import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  RotateCcw,
  Target,
  X,
} from 'lucide-react';
import { useDeck } from '../../contexts/DeckContext';
import type { QuizBlock } from '../../lib/format/types';
import { InlineMarkdown, Markdown } from '../Markdown';
import { ScoreRing } from './ScoreRing';

type Answer = {
  quizId: string;
  selected: string[];
  correct: boolean;
};

function isAnswerCorrect(quiz: QuizBlock, selected: Set<string>): boolean {
  const correctIds = quiz.options
    .filter((option) => option.correct)
    .map((option) => option.id);
  return (
    correctIds.length > 0 &&
    selected.size === correctIds.length &&
    correctIds.every((id) => selected.has(id))
  );
}

export function QuizSession() {
  const { deck, document: doc, recordQuizAnswer, recordSession } = useDeck();
  const [phase, setPhase] = useState<'quiz' | 'summary'>('quiz');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);

  const quizzes = doc?.quizzes ?? [];
  const quiz = quizzes[index];
  const total = quizzes.length;
  const score = answers.filter((answer) => answer.correct).length;
  const percent = answers.length ? Math.round((score / answers.length) * 100) : 0;

  const correctIds = useMemo(
    () =>
      new Set(
        quiz?.options
          .filter((option) => option.correct)
          .map((option) => option.id) ?? [],
      ),
    [quiz],
  );

  const toggle = (id: string) => {
    if (submitted || !quiz) return;
    setSelected((current) => {
      if (quiz.multiple) {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  };

  const submit = () => {
    if (!quiz || selected.size === 0 || submitted) return;
    const correct = isAnswerCorrect(quiz, selected);
    setSubmitted(true);
    recordQuizAnswer(quiz.id, correct);
    setAnswers((current) => [
      ...current,
      { quizId: quiz.id, selected: Array.from(selected), correct },
    ]);
  };

  const next = () => {
    if (!submitted) return;
    if (index + 1 >= total) {
      const finalAnswers = answers;
      recordSession({
        type: 'quiz',
        correct: finalAnswers.filter((answer) => answer.correct).length,
        total: finalAnswers.length,
      });
      setPhase('summary');
      return;
    }
    setIndex((current) => current + 1);
    setSelected(new Set());
    setSubmitted(false);
  };

  const restart = () => {
    setPhase('quiz');
    setIndex(0);
    setSelected(new Set());
    setSubmitted(false);
    setAnswers([]);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (phase !== 'quiz' || !quiz) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (!submitted) {
        const number = Number(event.key);
        if (Number.isInteger(number) && number >= 1 && number <= quiz.options.length) {
          event.preventDefault();
          toggle(quiz.options[number - 1].id);
        } else if (event.key === 'Enter' && selected.size > 0) {
          event.preventDefault();
          submit();
        }
      } else if (event.key === 'Enter' || event.key === 'ArrowRight') {
        event.preventDefault();
        next();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // Las funciones dependen del estado actual de la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, quiz, selected, submitted, index, answers]);

  if (!deck || !doc) return null;

  if (total === 0) {
    return (
      <div className="study-page study-page--narrow">
        <Link className="text-link" to={`/deck/${deck.id}/study`}>
          <ArrowLeft size={15} aria-hidden="true" />
          Volver al modo estudio
        </Link>
        <div className="empty-state">
          <Target size={26} aria-hidden="true" />
          <h1>Este deck no tiene quizzes</h1>
          <p>
            Añade bloques <code>:::quiz</code> al Markdown para practicar con
            preguntas corregidas.
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
          <span className="study-header__eyebrow">Sesión completada</span>
          <h1>Quiz terminado</h1>
          <div className="session-summary__score">
            <ScoreRing
              value={percent}
              label="Precisión"
              detail={`${score} de ${answers.length} correctas`}
              size={196}
            />
            <div className="session-summary__copy">
              <p>
                {percent >= 80
                  ? 'Buen control del contenido. Revisa las preguntas falladas y vuelve a intentarlo en unos días.'
                  : percent >= 50
                    ? 'Vas por buen camino. Las explicaciones de las preguntas falladas son el mejor punto de partida.'
                    : 'Todavía hay margen. Vuelve a los apuntes, revisa las explicaciones y repite la sesión.'}
              </p>
              <div className="session-summary__actions">
                <button type="button" className="button button--solid" onClick={restart}>
                  <RotateCcw size={16} aria-hidden="true" />
                  Repetir quiz
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

        <section className="review-list" aria-label="Revisión de respuestas">
          <div className="section-kicker-row">
            <h2 className="section-kicker">Revisión</h2>
            <span className="muted small">{answers.length} preguntas</span>
          </div>
          {quizzes.map((item, itemIndex) => {
            const answer = answers[itemIndex];
            if (!answer) return null;
            const selectedSet = new Set(answer.selected);
            return (
              <details className="review-item" key={item.id} open={!answer.correct}>
                <summary>
                  <span className={`review-item__status${answer.correct ? ' is-correct' : ' is-wrong'}`}>
                    {answer.correct ? <Check size={15} /> : <X size={15} />}
                  </span>
                  <span className="review-item__question">
                    <InlineMarkdown source={item.question} />
                  </span>
                  <span className="review-item__tag">
                    {answer.correct ? 'Correcta' : 'Revisar'}
                  </span>
                </summary>
                <div className="review-item__body">
                  <ul className="review-options">
                    {item.options.map((option) => {
                      const chosen = selectedSet.has(option.id);
                      return (
                        <li
                          key={option.id}
                          className={`review-option${option.correct ? ' is-correct' : ''}${
                            chosen && !option.correct ? ' is-wrong' : ''
                          }`}
                        >
                          <span>{chosen ? '●' : '○'}</span>
                          <InlineMarkdown source={option.text} />
                          {option.correct ? <em>Correcta</em> : null}
                          {chosen && !option.correct ? <em>Elegida</em> : null}
                        </li>
                      );
                    })}
                  </ul>
                  {item.explanation ? (
                    <div className="review-explanation">
                      <span className="eyebrow">Explicación</span>
                      <Markdown source={item.explanation} compact />
                    </div>
                  ) : null}
                </div>
              </details>
            );
          })}
        </section>
      </div>
    );
  }

  if (!quiz) return null;

  const answeredCount = answers.length;

  return (
    <div className="study-page study-page--narrow">
      <div className="session-top">
        <Link className="text-link" to={`/deck/${deck.id}/study`}>
          <ArrowLeft size={15} aria-hidden="true" />
          Salir
        </Link>
        <span className="session-top__label">
          Pregunta {index + 1} de {total}
        </span>
      </div>

      <div className="session-progress" aria-hidden="true">
        <span style={{ width: `${(index / total) * 100}%` }} />
      </div>

      <section className="quiz-session">
        <div className="quiz-session__meta">
          <span className="chip">Quiz</span>
          {quiz.difficulty ? (
            <span className="chip">Dificultad {quiz.difficulty}/3</span>
          ) : null}
          {quiz.tags.map((tag) => (
            <span className="chip" key={tag}>
              {tag}
            </span>
          ))}
          {quiz.multiple ? <span className="chip">Varias respuestas</span> : null}
        </div>

        <div className="quiz-session__question">
          <Markdown source={quiz.question} />
        </div>

        <div className="quiz-session__options" role="group" aria-label="Opciones">
          {quiz.options.map((option, optionIndex) => {
            const chosen = selected.has(option.id);
            const state = submitted
              ? option.correct
                ? 'correct'
                : chosen
                  ? 'wrong'
                  : 'idle'
              : chosen
                ? 'selected'
                : 'idle';
            return (
              <button
                key={option.id}
                type="button"
                className={`option option--${state}`}
                onClick={() => toggle(option.id)}
                disabled={submitted}
                aria-pressed={chosen}
              >
                <span className="option__letter">
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span className="option__text">
                  <InlineMarkdown source={option.text} />
                </span>
                <span className="option__mark" aria-hidden="true">
                  {submitted && option.correct ? <Check size={17} /> : null}
                  {submitted && !option.correct && chosen ? <X size={17} /> : null}
                </span>
              </button>
            );
          })}
        </div>

        {submitted ? (
          <div
            className={`quiz-feedback ${
              answers[answers.length - 1]?.correct ? 'is-correct' : 'is-wrong'
            }`}
            role="status"
          >
            <div className="quiz-feedback__title">
              {answers[answers.length - 1]?.correct ? (
                <Check size={18} />
              ) : (
                <X size={18} />
              )}
              <strong>
                {answers[answers.length - 1]?.correct ? 'Correcto' : 'Revisa esta idea'}
              </strong>
            </div>
            {quiz.explanation ? <Markdown source={quiz.explanation} compact /> : null}
          </div>
        ) : null}

        <div className="quiz-session__actions">
          <span className="muted small">
            {quiz.multiple
              ? 'Selecciona todas las correctas.'
              : 'Selecciona una opción.'}
          </span>
          {submitted ? (
            <button type="button" className="button button--solid" onClick={next}>
              {index + 1 >= total ? 'Ver resultados' : 'Siguiente'}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="button button--solid"
              onClick={submit}
              disabled={selected.size === 0}
            >
              Comprobar
            </button>
          )}
        </div>
      </section>

      <div className="session-footnote">
        <span>
          {answeredCount} respondidas · {correctIds.size > 1 ? 'respuesta múltiple' : 'respuesta única'}
        </span>
        <span className="muted small">Atajos: 1–{quiz.options.length} para elegir · Enter para continuar</span>
      </div>
    </div>
  );
}
