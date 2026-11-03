import { useEffect, useState } from 'react';
import { Link, Outlet, useMatch, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { DeckProvider, useDeck } from '../contexts/DeckContext';
import { LightboxProvider } from '../contexts/LightboxContext';
import { AppHeader } from './AppHeader';
import { DeckWatermark } from './DeckWatermark';
import { SearchDialog } from './SearchDialog';
import { SoffiaMark } from './SoffiaMark';

export function DeckShell() {
  const { deckId } = useParams();

  if (!deckId) {
    return (
      <div className="deck-error">
        <p>No se indicó ningún deck.</p>
        <Link to="/" className="button button--solid">
          Volver a la biblioteca
        </Link>
      </div>
    );
  }

  return (
    <DeckProvider deckId={deckId}>
      <DeckShellInner deckId={deckId} />
    </DeckProvider>
  );
}

function DeckShellInner({ deckId }: { deckId: string }) {
  const { deck, document: doc, loading, error } = useDeck();
  const [searchOpen, setSearchOpen] = useState(false);
  // En el lector el aside vive dentro de la rejilla de tres columnas. En las
  // vistas de estudio se mantiene como marca de agua fija.
  const isReader = useMatch('/deck/:deckId');

  useEffect(() => {
    if (!deck) {
      document.title = 'soffia';
      return;
    }
    document.title = `${deck.title} · soffia`;
    return () => {
      document.title = 'soffia';
    };
  }, [deck]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (loading) {
    return (
      <>
        <AppHeader deckId={deckId} deckTitle={deck?.title} />
        <main className="deck-loading" aria-busy="true">
          <span className="loading-brand">
            <SoffiaMark size={34} />
            <span className="loading-mark">soffia</span>
          </span>
          <div className="loading-bar">
            <span />
          </div>
          <p>Abriendo el deck…</p>
        </main>
      </>
    );
  }

  if (error || !deck || !doc) {
    return (
      <>
        <AppHeader deckId={deckId} deckTitle={deck?.title} />
        <main className="deck-error">
          <span className="deck-error__icon">
            <AlertTriangle size={24} aria-hidden="true" />
          </span>
          <h1>No pudimos abrir este deck</h1>
          <p>{error || 'El documento está vacío o no se pudo interpretar.'}</p>
          <div className="button-row">
            <Link className="button button--solid" to="/">
              <ArrowLeft size={16} aria-hidden="true" />
              Biblioteca
            </Link>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Reintentar
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <LightboxProvider>
      <AppHeader
        deckId={deckId}
        deckTitle={deck.title}
        onSearch={() => setSearchOpen(true)}
      />
      {isReader ? null : <DeckWatermark deck={deck} />}
      <div className="deck-content">
        <Outlet />
      </div>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </LightboxProvider>
  );
}
