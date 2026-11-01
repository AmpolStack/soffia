import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { useDeck } from '../contexts/DeckContext';
import { searchDocument, type SearchResult } from '../lib/search';
import { escapeRegExp } from '../lib/format/utils';
import { Modal } from './Modal';

function Highlight({ text, query }: { text: string; query: string }) {
  const clean = query.trim();
  if (clean.length < 2) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(clean)})`, 'gi'));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === clean.toLowerCase() ? (
          <mark key={index}>{part}</mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

export function SearchDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { deck, document } = useDeck();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo<SearchResult[]>(() => {
    if (!document) return [];
    return searchDocument(document, query);
  }, [document, query]);

  const sections = document?.sections ?? [];
  const visible = query.trim().length >= 2 ? results : [];

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!deck) return null;

  const go = (anchorId: string) => {
    navigate(`/deck/${deck.id}?s=${encodeURIComponent(anchorId)}`);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) =>
        visible.length ? (current + 1) % visible.length : 0,
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) =>
        visible.length ? (current - 1 + visible.length) % visible.length : 0,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (visible[activeIndex]) go(visible[activeIndex].anchorId);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Buscar en el deck"
      description={deck.title}
      size="wide"
    >
      <div className="search-box">
        <Search size={19} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Busca una sección, concepto o pregunta…"
          aria-label="Buscar en el deck"
        />
        {query ? (
          <button
            type="button"
            className="search-box__clear"
            onClick={() => setQuery('')}
          >
            Limpiar
          </button>
        ) : null}
      </div>

      {query.trim().length >= 2 ? (
        visible.length > 0 ? (
          <div className="search-results" role="listbox" aria-label="Resultados">
            {visible.map((result, index) => (
              <button
                key={`${result.anchorId}-${index}`}
                type="button"
                className={`search-result${
                  index === activeIndex ? ' is-active' : ''
                }`}
                onClick={() => go(result.anchorId)}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                aria-selected={index === activeIndex}
              >
                <span className="search-result__title">
                  <Highlight text={result.title} query={query} />
                </span>
                <span className="search-result__snippet">
                  <Highlight text={result.snippet} query={query} />
                </span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            <p>No encontramos coincidencias.</p>
            <p className="muted small">
              Prueba con una palabra más corta o revisa el índice de secciones.
            </p>
          </div>
        )
      ) : (
        <div className="search-index">
          <span className="search-index__label">Ir a una sección</span>
          <div className="search-index__list">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className="search-index__item"
                onClick={() => go(section.id)}
              >
                <span>{section.title}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="search-footer">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> navegar
        </span>
        <span>
          <kbd>Enter</kbd> abrir
        </span>
        <span>
          <kbd>Esc</kbd> cerrar
        </span>
      </div>
    </Modal>
  );
}
