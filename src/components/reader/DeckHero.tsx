import { useEffect, useState } from 'react';
import {
  BookOpen,
  Clock,
  HelpCircle,
  ImageOff,
  Layers,
  Maximize2,
  Play,
  Printer,
  Target,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDeck } from '../../contexts/DeckContext';
import type { SofiaDocument } from '../../lib/format/types';
import { isRemoteImage } from '../../lib/images';

export function DeckHero({
  document: doc,
  readCount,
  onStartReading,
  onPrint,
}: {
  document: SofiaDocument;
  readCount: number;
  onStartReading: () => void;
  onPrint: () => void;
}) {
  const { deck, resolveSrc } = useDeck();
  const cover = doc.meta.cover ? resolveSrc(doc.meta.cover) : null;
  const [coverFailed, setCoverFailed] = useState(false);
  const sectionCount = doc.sections.length;
  const percent = sectionCount
    ? Math.round((readCount / sectionCount) * 100)
    : 0;

  useEffect(() => {
    setCoverFailed(false);
  }, [cover]);

  return (
    <header className="deck-hero" id="inicio">
      {cover && !coverFailed ? (
        <button
          type="button"
          className="deck-hero__cover"
          data-lightbox="true"
          data-src={cover}
          data-source={doc.meta.cover || ''}
          data-alt={doc.meta.title}
          data-caption={doc.meta.subtitle || doc.meta.title}
          aria-label={`Ampliar portada: ${doc.meta.title}`}
        >
          <img
            src={cover}
            alt={doc.meta.title}
            loading="lazy"
            decoding="async"
            {...(isRemoteImage(cover) ? { referrerPolicy: 'no-referrer' as const } : {})}
            onError={() => setCoverFailed(true)}
          />
          <span className="deck-hero__cover-zoom" aria-hidden="true">
            <Maximize2 size={16} />
            Ampliar
          </span>
        </button>
      ) : coverFailed ? (
        <div className="missing-image">
          <ImageOff size={18} aria-hidden="true" />
          <span>No se pudo cargar la portada del deck.</span>
        </div>
      ) : null}

      <div className="deck-hero__content">
        <div className="deck-hero__eyebrow">
          {doc.meta.tags.length > 0 ? (
            doc.meta.tags.map((tag) => (
              <span className="chip" key={tag}>
                {tag}
              </span>
            ))
          ) : (
            <span className="chip">Seminario</span>
          )}
        </div>

        <h1 className="deck-hero__title">{doc.meta.title}</h1>
        {doc.meta.subtitle ? (
          <p className="deck-hero__subtitle">{doc.meta.subtitle}</p>
        ) : null}
        {doc.meta.description ? (
          <p className="deck-hero__description">{doc.meta.description}</p>
        ) : null}

        <div className="deck-hero__meta">
          <span>
            <Clock size={15} aria-hidden="true" />
            {doc.meta.estimatedMinutes} min
          </span>
          <span>
            <BookOpen size={15} aria-hidden="true" />
            {sectionCount} secciones
          </span>
          <span>
            <Target size={15} aria-hidden="true" />
            {doc.quizzes.length} quizzes
          </span>
          <span>
            <Layers size={15} aria-hidden="true" />
            {doc.flashcards.length} tarjetas
          </span>
          <span>
            <HelpCircle size={15} aria-hidden="true" />
            {doc.qa.length} preguntas
          </span>
        </div>

        {readCount > 0 ? (
          <div className="deck-hero__progress">
            <div className="deck-hero__progress-row">
              <span>Progreso de lectura</span>
              <span>{percent}%</span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${percent}%` }} />
            </div>
          </div>
        ) : null}

        <div className="deck-hero__actions">
          <button type="button" className="button button--solid" onClick={onStartReading}>
            <Play size={16} aria-hidden="true" />
            {readCount > 0 ? 'Continuar leyendo' : 'Empezar a leer'}
          </button>
          {deck ? (
            <>
              <Link className="button button--outline" to={`/deck/${deck.id}/study`}>
                <BookOpen size={16} aria-hidden="true" />
                Modo estudio
              </Link>
              <Link className="button button--ghost" to={`/deck/${deck.id}/quiz`}>
                <Target size={16} aria-hidden="true" />
                Quiz rápido
              </Link>
            </>
          ) : null}
          <button
            type="button"
            className="icon-button"
            onClick={onPrint}
            aria-label="Imprimir deck"
            title="Imprimir"
          >
            <Printer size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
