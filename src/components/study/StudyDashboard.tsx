import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  Flame,
  HelpCircle,
  Layers,
  RotateCcw,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useDeck } from '../../contexts/DeckContext';
import { useToast } from '../../contexts/ToastContext';
import { isCloudMode } from '../../contexts/AuthContext';
import {
  computeDeckStats,
  formatRelativeTime,
  formatSessionDate,
  sessionLabel,
} from '../../lib/stats';
import { Modal } from '../Modal';
import { ScoreRing } from './ScoreRing';

function ActionCard({
  icon,
  eyebrow,
  title,
  description,
  meta,
  to,
  disabled,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
  to: string;
  disabled?: boolean;
}) {
  const content = (
    <>
      <span className="action-card__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="action-card__eyebrow">{eyebrow}</span>
      <strong className="action-card__title">{title}</strong>
      <span className="action-card__description">{description}</span>
      <span className="action-card__footer">
        <span>{meta}</span>
        {!disabled ? <ArrowRight size={16} aria-hidden="true" /> : null}
      </span>
    </>
  );

  if (disabled) {
    return <div className="action-card is-disabled">{content}</div>;
  }

  return (
    <Link className="action-card" to={to}>
      {content}
    </Link>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="metric">
      <span className="metric__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="metric__label">{label}</span>
      <strong className="metric__value">{value}</strong>
      <span className="metric__detail">{detail}</span>
    </div>
  );
}

export function StudyDashboard() {
  const { deck, document: doc, progress, resetProgress } = useDeck();
  const { toast } = useToast();
  const [resetOpen, setResetOpen] = useState(false);

  const stats = useMemo(
    () => (doc ? computeDeckStats(doc, progress) : null),
    [doc, progress],
  );

  if (!deck || !doc || !stats) return null;

  const firstUnread =
    doc.sections.find((section) => !progress.sections[section.id]) ??
    doc.sections[0];
  const quizMeta = stats.quizAttempts
    ? `${stats.quizAccuracy}% de precisión en ${stats.quizAttempts} intentos`
    : `${doc.quizzes.length} preguntas disponibles`;
  const qaPercent = stats.qaTotal
    ? Math.round((stats.qaRevealed / stats.qaTotal) * 100)
    : 0;
  const cardPercent = stats.cardsTotal
    ? Math.round((stats.cardsReviewed / stats.cardsTotal) * 100)
    : 0;

  return (
    <div className="study-page">
      <header className="study-header">
        <Link className="text-link" to={`/deck/${deck.id}`}>
          <BookOpen size={15} aria-hidden="true" />
          Volver a la lectura
        </Link>
        <span className="study-header__eyebrow">Modo estudio</span>
        <h1>{doc.meta.title}</h1>
        <p>
          {isCloudMode
            ? 'Un panel para decidir qué repasar ahora. Tu progreso se guarda en tu biblioteca privada.'
            : 'Un panel para decidir qué repasar ahora. Tu progreso se guarda solo en este navegador.'}
        </p>
      </header>

      <section className="study-overview" aria-label="Resumen de progreso">
        <div className="study-overview__ring">
          <ScoreRing
            value={stats.sectionPercent}
            label="Lectura"
            detail={`${stats.sectionsRead} de ${stats.sectionsTotal} secciones`}
            size={186}
          />
          <div className="study-overview__ring-copy">
            <span className="eyebrow">Estado del deck</span>
            <strong>
              {stats.sectionPercent === 100
                ? 'Lectura completa'
                : stats.sectionPercent > 0
                  ? 'En progreso'
                  : 'Por empezar'}
            </strong>
            <p>
              {stats.lastStudiedAt
                ? `Última actividad ${formatRelativeTime(stats.lastStudiedAt).toLowerCase()}.`
                : 'Aún no hay actividad registrada.'}
            </p>
            {stats.streak > 0 ? (
              <span className="study-streak">
                <Flame size={15} aria-hidden="true" />
                {stats.streak} {stats.streak === 1 ? 'día' : 'días'} de racha
              </span>
            ) : null}
          </div>
        </div>

        <div className="study-metrics">
          <Metric
            label="Precisión en quizzes"
            value={stats.quizAccuracy === null ? '—' : `${stats.quizAccuracy}%`}
            detail={
              stats.quizAttempts
                ? `${stats.quizCorrect} correctas de ${stats.quizAttempts}`
                : 'Sin intentos todavía'
            }
            icon={<Target size={17} />}
          />
          <Metric
            label="Tarjetas para hoy"
            value={String(stats.cardsDue)}
            detail={`${stats.cardsNew} nuevas · ${stats.cardsTotal} en total`}
            icon={<Layers size={17} />}
          />
          <Metric
            label="Preguntas reveladas"
            value={`${stats.qaRevealed}/${stats.qaTotal}`}
            detail={stats.qaTotal ? `${qaPercent}% del total` : 'Sin preguntas'}
            icon={<HelpCircle size={17} />}
          />
          <Metric
            label="Secciones leídas"
            value={`${stats.sectionsRead}/${stats.sectionsTotal}`}
            detail={`${stats.sectionPercent}% del deck`}
            icon={<Check size={17} />}
          />
        </div>
      </section>

      <section className="study-actions" aria-label="Empezar a estudiar">
        <h2 className="section-kicker">Elige una sesión</h2>
        <div className="action-grid">
          <ActionCard
            icon={<Target size={20} />}
            eyebrow="Quiz"
            title="Comprueba lo que sabes"
            description="Preguntas con corrección inmediata y explicación razonada."
            meta={quizMeta}
            to={`/deck/${deck.id}/quiz`}
            disabled={doc.quizzes.length === 0}
          />
          <ActionCard
            icon={<Layers size={20} />}
            eyebrow="Tarjetas"
            title="Repaso espaciado"
            description="Gira la tarjeta, valora tu recuerdo y programa el próximo repaso."
            meta={
              stats.cardsDue > 0
                ? `${stats.cardsDue} pendientes hoy`
                : 'Sin tarjetas pendientes'
            }
            to={`/deck/${deck.id}/cards`}
            disabled={doc.flashcards.length === 0}
          />
          <ActionCard
            icon={<HelpCircle size={20} />}
            eyebrow="Preguntas"
            title="Resuelve dudas"
            description="Preguntas abiertas para explicar con tus propias palabras."
            meta={`${stats.qaRevealed} de ${stats.qaTotal} reveladas`}
            to={`/deck/${deck.id}/qa`}
            disabled={doc.qa.length === 0}
          />
          <ActionCard
            icon={<BookOpen size={20} />}
            eyebrow="Lectura"
            title={stats.sectionsRead === 0 ? 'Empieza por el principio' : 'Continúa leyendo'}
            description="Vuelve a los apuntes y marca las secciones que ya dominas."
            meta={
              firstUnread
                ? `Siguiente: ${firstUnread.title}`
                : 'Todas las secciones leídas'
            }
            to={
              firstUnread
                ? `/deck/${deck.id}?s=${encodeURIComponent(firstUnread.id)}`
                : `/deck/${deck.id}`
            }
          />
        </div>
      </section>

      <section className="study-detail-grid">
        <div className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Rendimiento</span>
              <h2>Quizzes</h2>
            </div>
            <TrendingUp size={19} aria-hidden="true" />
          </div>
          <div className="panel__big-value">
            {stats.quizAccuracy === null ? '—' : `${stats.quizAccuracy}%`}
          </div>
          <div className="progress-track">
            <span style={{ width: `${stats.quizAccuracy ?? 0}%` }} />
          </div>
          <div className="panel__legend">
            <span>{stats.quizAttempts} intentos</span>
            <span>{stats.quizCorrect} respuestas correctas</span>
          </div>
          <Link className="text-link panel__link" to={`/deck/${deck.id}/quiz`}>
            Hacer una sesión
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <div className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Memoria</span>
              <h2>Tarjetas</h2>
            </div>
            <Layers size={19} aria-hidden="true" />
          </div>
          <div className="panel__big-value">{cardPercent}%</div>
          <div className="stacked-bar" aria-hidden="true">
            <span
              className="stacked-bar__new"
              style={{
                width: `${
                  stats.cardsTotal ? (stats.cardsNew / stats.cardsTotal) * 100 : 0
                }%`,
              }}
            />
            <span
              className="stacked-bar__learning"
              style={{
                width: `${
                  stats.cardsTotal
                    ? (stats.cardsLearning / stats.cardsTotal) * 100
                    : 0
                }%`,
              }}
            />
            <span
              className="stacked-bar__mature"
              style={{
                width: `${
                  stats.cardsTotal
                    ? (stats.cardsMature / stats.cardsTotal) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="panel__legend panel__legend--wrap">
            <span>
              <i className="dot dot--new" /> {stats.cardsNew} nuevas
            </span>
            <span>
              <i className="dot dot--learning" /> {stats.cardsLearning} en curso
            </span>
            <span>
              <i className="dot dot--mature" /> {stats.cardsMature} maduras
            </span>
          </div>
          <Link className="text-link panel__link" to={`/deck/${deck.id}/cards`}>
            Repasar ahora
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <div className="panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Comprensión</span>
              <h2>Preguntas</h2>
            </div>
            <HelpCircle size={19} aria-hidden="true" />
          </div>
          <div className="panel__big-value">{qaPercent}%</div>
          <div className="progress-track">
            <span style={{ width: `${qaPercent}%` }} />
          </div>
          <div className="panel__legend">
            <span>{stats.qaRevealed} reveladas</span>
            <span>{stats.qaTotal - stats.qaRevealed} pendientes</span>
          </div>
          <Link className="text-link panel__link" to={`/deck/${deck.id}/qa`}>
            Practicar preguntas
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="study-sessions">
        <div className="study-sessions__header">
          <div>
            <span className="eyebrow">Historial</span>
            <h2>Sesiones recientes</h2>
          </div>
          <Calendar size={19} aria-hidden="true" />
        </div>

        {stats.sessions.length === 0 ? (
          <div className="empty-inline">
            <p>Todavía no has completado una sesión.</p>
            <p className="muted small">
              Empieza con un quiz o un mazo de tarjetas; aquí aparecerá el
              resumen.
            </p>
          </div>
        ) : (
          <ul className="session-list">
            {stats.sessions.slice(0, 8).map((session) => (
              <li key={session.id} className="session-row">
                <span className={`session-row__icon session-row__icon--${session.type}`}>
                  {session.type === 'quiz' ? (
                    <Target size={16} />
                  ) : session.type === 'cards' ? (
                    <Layers size={16} />
                  ) : (
                    <HelpCircle size={16} />
                  )}
                </span>
                <span className="session-row__type">{sessionLabel(session.type)}</span>
                <span className="session-row__result">
                  {session.type === 'quiz' && session.total
                    ? `${session.correct ?? 0} / ${session.total} correctas`
                    : `${session.total ?? 0} ${
                        session.type === 'cards' ? 'tarjetas' : 'preguntas'
                      }`}
                </span>
                <span className="session-row__date">{formatSessionDate(session.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="study-footer">
        <div>
          <span className="eyebrow">
            {isCloudMode ? 'Datos en la nube' : 'Datos locales'}
          </span>
          <p className="muted small">
            {isCloudMode
              ? 'El progreso, las tarjetas y los quizzes se guardan en tu biblioteca privada de R2 y se cachean en el navegador.'
              : 'El progreso, las tarjetas y los quizzes se guardan en IndexedDB o en este navegador. No se envía nada a un servidor.'}
          </p>
        </div>
        <button
          type="button"
          className="button button--danger-ghost button--small"
          onClick={() => setResetOpen(true)}
        >
          <RotateCcw size={15} aria-hidden="true" />
          Reiniciar progreso
        </button>
      </section>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reiniciar el progreso de este deck"
        description="Se borrarán las secciones leídas, los intentos de quiz, la programación de tarjetas y el historial de sesiones. El contenido del deck no se modifica."
        footer={
          <>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setResetOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="button button--solid"
              onClick={() => {
                resetProgress();
                setResetOpen(false);
                toast('Progreso reiniciado.', 'success');
              }}
            >
              Sí, reiniciar
            </button>
          </>
        }
      >
        <p className="muted">
          Esta acción no se puede deshacer. Si quieres conservar el contenido,
          puedes volver a importar el mismo Markdown sin perder el deck.
        </p>
      </Modal>
    </div>
  );
}
