import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, BookOpen, Cloud, Library, Search } from 'lucide-react';
import { isCloudMode } from '../contexts/AuthContext';
import { SettingsMenu } from './SettingsMenu';
import { SoffiaMark } from './SoffiaMark';

export function AppHeader({
  deckId,
  deckTitle,
  onSearch,
}: {
  deckId?: string;
  deckTitle?: string;
  onSearch?: () => void;
}) {
  const location = useLocation();
  const isStudy =
    Boolean(deckId) &&
    /\/(study|quiz|cards|qa)(\/|$)/.test(location.pathname);

  return (
    <header className="app-header">
      <div className="app-header__side app-header__side--left">
        {deckId ? (
          <div className="header-deck">
            <Link
              className="header-icon-link"
              to="/"
              aria-label="Volver a la biblioteca"
              title="Biblioteca"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
            <Link
              className="header-deck__title"
              to={`/deck/${deckId}`}
              title={deckTitle || 'Deck'}
            >
              {deckTitle || 'Deck'}
            </Link>
          </div>
        ) : (
          <span className="header-context">
            {isCloudMode ? (
              <Cloud size={15} aria-hidden="true" />
            ) : (
              <Library size={15} aria-hidden="true" />
            )}
            <span>{isCloudMode ? 'Biblioteca en la nube' : 'Biblioteca local'}</span>
          </span>
        )}
      </div>

      <Link className="wordmark" to="/" aria-label="soffia, inicio">
        <SoffiaMark size={24} />
        <span>soffia</span>
      </Link>

      <div className="app-header__side app-header__side--right">
        {deckId ? (
          <>
            {onSearch ? (
              <button
                type="button"
                className="icon-button header-action"
                onClick={onSearch}
                aria-label="Buscar en el deck"
                title="Buscar (/)"
              >
                <Search size={18} />
                <span className="header-action__label">Buscar</span>
              </button>
            ) : null}
            <Link
              className="icon-button header-action"
              to={isStudy ? `/deck/${deckId}` : `/deck/${deckId}/study`}
              aria-label={isStudy ? 'Volver a la lectura' : 'Ir al modo estudio'}
              title={isStudy ? 'Leer' : 'Estudiar'}
            >
              <BookOpen size={18} />
              <span className="header-action__label">
                {isStudy ? 'Leer' : 'Estudiar'}
              </span>
            </Link>
          </>
        ) : null}
        <SettingsMenu />
      </div>
    </header>
  );
}
