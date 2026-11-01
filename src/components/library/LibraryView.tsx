import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Check,
  ChevronDown,
  Cloud,
  FileText,
  Lock,
  Sparkles,
  Tags,
  X,
} from 'lucide-react';
import { AppHeader } from '../AppHeader';
import { Modal } from '../Modal';
import { SoffiaMark } from '../SoffiaMark';
import { useToast } from '../../contexts/ToastContext';
import { isCloudMode } from '../../contexts/AuthContext';
import { createDemoDeck, DEMO_DECK_ID } from '../../lib/demo';
import {
  importFromUrl,
  importMarkdownFilesDetailed,
  importPasted,
  type ImportFile,
  type ImportItemResult,
} from '../../lib/import';
import {
  deleteDeck,
  deleteProgress,
  getDeck,
  listDecks,
  saveDeck,
  type DeckRecord,
} from '../../lib/storage';
import { DeckCard } from './DeckCard';
import { ImportPanel } from './ImportPanel';
import { buildTagIndex, filterDecksByTags, normalizeTag } from '../../lib/tags';

const SEED_KEY = 'soffia:demo-seeded';

function markSeeded(): void {
  try {
    localStorage.setItem(SEED_KEY, '1');
  } catch {
    // Sin persistencia: no pasa nada.
  }
}

function wasSeeded(): boolean {
  try {
    return localStorage.getItem(SEED_KEY) === '1';
  } catch {
    return false;
  }
}

export function LibraryView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [decks, setDecks] = useState<DeckRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [urlText, setUrlText] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeckRecord | null>(null);
  const [importErrors, setImportErrors] = useState<ImportItemResult[]>([]);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const tagMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedTags = useMemo(
    () =>
      (searchParams.get('tags') ?? '')
        .split(',')
        .map(normalizeTag)
        .filter(Boolean),
    [searchParams],
  );

  const tagIndex = useMemo(() => buildTagIndex(decks), [decks]);
  const visibleDecks = useMemo(
    () => filterDecksByTags(decks, selectedTags),
    [decks, selectedTags],
  );

  const setSelectedTags = (next: Iterable<string>) => {
    const values = Array.from(new Set(next));
    const params = new URLSearchParams(searchParams);
    if (values.length > 0) params.set('tags', values.join(','));
    else params.delete('tags');
    setSearchParams(params, { replace: true });
  };

  const toggleTag = (key: string) => {
    const next = new Set(selectedTags);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedTags(next);
  };

  const clearTags = () => setSelectedTags([]);

  useEffect(() => {
    if (!tagMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!tagMenuRef.current?.contains(event.target as Node)) {
        setTagMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTagMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [tagMenuOpen]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let records = await listDecks();
        if (records.length === 0 && !wasSeeded() && !isCloudMode) {
          await saveDeck(createDemoDeck());
          records = await listDecks();
        }
        if (records.length > 0) markSeeded();
        if (!cancelled) setDecks(records);
      } catch (cause) {
        if (!cancelled) {
          toast(
            cause instanceof Error
              ? cause.message
              : 'No se pudo abrir la biblioteca.',
            'error',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const refresh = async () => {
    const records = await listDecks();
    setDecks(records);
    if (records.length > 0) markSeeded();
  };

  const handleFiles = async (files: ImportFile[]) => {
    if (busy) return;
    setBusy(true);
    setImportErrors([]);
    try {
      const items = await importMarkdownFilesDetailed(files);
      await refresh();
      const failures = items.filter((item) => !item.deck);
      const successes = items.flatMap((item) => (item.deck ? [item.deck] : []));
      setImportErrors(failures);
      const warning = successes.find((result) => result.deck.storageWarning);
      if (warning?.deck.storageWarning) {
        toast(warning.deck.storageWarning, 'error');
      }
      if (failures.length > 0) {
        toast(
          `${successes.length} importado(s), ${failures.length} con error. Revisa el detalle.`,
          'error',
        );
      } else if (successes.length === 1) {
        const result = successes[0];
        toast(
          result.updated ? 'Deck actualizado.' : 'Deck importado.',
          'success',
        );
        navigate(`/deck/${result.deck.id}`);
      } else if (successes.length > 1) {
        toast(`${successes.length} decks importados.`, 'success');
      }
    } catch (cause) {
      toast(
        cause instanceof Error ? cause.message : 'No se pudo importar.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePaste = async () => {
    if (busy) return;
    setBusy(true);
    setDialogError(null);
    try {
      const results = await importPasted(pasteText);
      await refresh();
      setPasteOpen(false);
      setPasteText('');
      toast('Deck importado.', 'success');
      navigate(`/deck/${results[0].deck.id}`);
    } catch (cause) {
      setDialogError(
        cause instanceof Error ? cause.message : 'No se pudo importar el texto.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleUrl = async () => {
    if (busy) return;
    setBusy(true);
    setDialogError(null);
    try {
      const results = await importFromUrl(urlText);
      await refresh();
      setUrlOpen(false);
      setUrlText('');
      toast('Deck importado desde la URL.', 'success');
      navigate(`/deck/${results[0].deck.id}`);
    } catch (cause) {
      setDialogError(
        cause instanceof Error ? cause.message : 'No se pudo importar la URL.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDemo = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const existing = await getDeck(DEMO_DECK_ID);
      if (!existing) {
        await saveDeck(createDemoDeck());
        await refresh();
        toast('Ejemplo cargado.', 'success');
      }
      markSeeded();
      navigate(`/deck/${DEMO_DECK_ID}`);
    } catch (cause) {
      toast(
        cause instanceof Error ? cause.message : 'No se pudo cargar el ejemplo.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDeck(deleteTarget.id);
      await deleteProgress(deleteTarget.id);
      await refresh();
      toast('Deck eliminado.', 'success');
    } catch (cause) {
      toast(
        cause instanceof Error ? cause.message : 'No se pudo eliminar el deck.',
        'error',
      );
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="library-page">
      <AppHeader />

      <main className="library-main">
        <section className="library-hero">
          <div className="library-hero__copy">
            <h1>
              Estudia desde tu <em>Markdown</em>.
            </h1>
            <p>
              Lee, repasa y mide tu progreso con índices, quizzes, tarjetas y
              preguntas abiertas. Todo desde tus propios archivos.
            </p>
            <div className="library-hero__points">
              <span>
                <Cloud size={14} aria-hidden="true" />
                Local o nube
              </span>
              <span>
                <FileText size={14} aria-hidden="true" />
                Markdown + imágenes
              </span>
              <span>
                <BookOpen size={14} aria-hidden="true" />
                Progreso y repaso
              </span>
            </div>
          </div>

          <ImportPanel
            busy={busy}
            onFiles={handleFiles}
            onPaste={() => {
              setDialogError(null);
              setPasteOpen(true);
            }}
            onUrl={() => {
              setDialogError(null);
              setUrlOpen(true);
            }}
          />
        </section>

        <section className="library-decks" aria-label="Tus decks">
          <div className="library-decks__header">
            <div>
              <span className="eyebrow">Tu biblioteca</span>
              <h2>
                {loading
                  ? 'Cargando…'
                  : selectedTags.length > 0
                    ? `${visibleDecks.length} de ${decks.length} decks`
                    : `${decks.length} ${decks.length === 1 ? 'deck' : 'decks'}`}
              </h2>
            </div>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={handleDemo}
              disabled={busy}
            >
              <Sparkles size={15} aria-hidden="true" />
              Cargar ejemplo
            </button>
          </div>

          {!loading && tagIndex.length > 0 ? (
            <div className="tag-filter">
              <div className="tag-select" ref={tagMenuRef}>
                <button
                  type="button"
                  className="tag-select__trigger"
                  onClick={() => setTagMenuOpen((current) => !current)}
                  aria-haspopup="listbox"
                  aria-expanded={tagMenuOpen}
                  aria-controls="tag-filter-list"
                >
                  <Tags size={15} aria-hidden="true" />
                  <span>Etiqueta</span>
                  {selectedTags.length > 0 ? (
                    <span className="tag-select__count">{selectedTags.length}</span>
                  ) : null}
                  <ChevronDown
                    size={16}
                    className={`tag-select__chevron${tagMenuOpen ? ' is-open' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                {tagMenuOpen ? (
                  <div
                    className="tag-select__menu"
                    id="tag-filter-list"
                    role="listbox"
                    aria-multiselectable="true"
                    aria-label="Etiquetas"
                  >
                    <div className="tag-select__menu-head">
                      <span>Etiquetas</span>
                      <div className="tag-select__menu-actions">
                        {selectedTags.length > 0 ? (
                          <button
                            type="button"
                            className="text-link"
                            onClick={clearTags}
                          >
                            Limpiar
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => setTagMenuOpen(false)}
                          aria-label="Cerrar selector de etiquetas"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="tag-select__options">
                      {tagIndex.map((tag) => {
                        const active = selectedTags.includes(tag.key);
                        return (
                          <button
                            key={tag.key}
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={`tag-select__option${active ? ' is-active' : ''}`}
                            onClick={() => toggleTag(tag.key)}
                          >
                            <span className="tag-select__option-label">{tag.label}</span>
                            <span className="tag-select__option-count">{tag.count}</span>
                            <span className="tag-select__check" aria-hidden="true">
                              {active ? <Check size={14} /> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              {selectedTags.length > 0 ? (
                <div className="tag-filter__active">
                  {selectedTags.map((key) => {
                    const tag = tagIndex.find((item) => item.key === key);
                    return (
                      <button
                        key={key}
                        type="button"
                        className="chip chip--filter is-active"
                        onClick={() => toggleTag(key)}
                        aria-label={`Quitar filtro ${tag?.label ?? key}`}
                      >
                        {tag?.label ?? key}
                        <X size={14} aria-hidden="true" />
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="text-link tag-filter__clear"
                    onClick={clearTags}
                  >
                    Limpiar
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {importErrors.length > 0 ? (
            <div className="import-errors" role="alert">
              <div className="import-errors__header">
                <strong>Algunos archivos no se importaron</strong>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setImportErrors([])}
                >
                  Ocultar
                </button>
              </div>
              <ul>
                {importErrors.map((item, index) => (
                  <li key={`${item.file}-${index}`}>
                    <code>{item.file}</code>
                    <span>{item.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {loading ? (
            <div className="deck-grid" aria-hidden="true">
              {[0, 1].map((item) => (
                <div className="deck-card deck-card--skeleton" key={item}>
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : decks.length === 0 ? (
            <div className="empty-state empty-state--library">
              <BookOpen size={28} aria-hidden="true" />
              <h2>Tu biblioteca está vacía</h2>
              <p>
                Arrastra un archivo Markdown o una carpeta con imágenes para
                empezar. También puedes cargar el seminario de ejemplo.
              </p>
              <button type="button" className="button button--solid" onClick={handleDemo}>
                <Sparkles size={16} aria-hidden="true" />
                Cargar el ejemplo de Impétigo
              </button>
            </div>
          ) : visibleDecks.length === 0 ? (
            <div className="empty-state empty-state--library">
              <Tags size={28} aria-hidden="true" />
              <h2>No hay decks con esos tags</h2>
              <p>
                Prueba con otra combinación o limpia el filtro para ver toda la
                biblioteca.
              </p>
              <button
                type="button"
                className="button button--solid"
                onClick={clearTags}
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <div className="deck-grid">
              {visibleDecks.map((deck, index) => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  index={index}
                  isDemo={deck.id === DEMO_DECK_ID}
                  onDelete={() => setDeleteTarget(deck)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="library-note">
          <Lock size={18} aria-hidden="true" />
          <div>
            <strong>Privacidad</strong>
            <p>
              {isCloudMode
                ? 'Los decks, las imágenes locales y tu progreso se guardan en tu biblioteca privada de Cloudflare R2. Las imágenes web se enlazan, no se descargan. Solo tú puedes entrar, con el usuario definido en el servidor.'
                : 'Los decks y tu progreso se guardan en IndexedDB o en este navegador. Las imágenes locales se almacenan con el deck; las web se enlazan. Nada se envía a un servidor. Puedes exportar el Markdown original cuando quieras.'}
            </p>
          </div>
        </section>

        <footer className="library-footer">
          <span className="wordmark wordmark--small">
            <SoffiaMark size={17} />
            <span>soffia</span>
          </span>
          <Link className="text-link" to="/formato">
            Formato para agentes
          </Link>
        </footer>
      </main>

      <Modal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title="Pegar Markdown"
        description="Pega el seminario completo, con su frontmatter y bloques ::: si los tiene."
        footer={
          <>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setPasteOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="button button--solid"
              onClick={handlePaste}
              disabled={busy || !pasteText.trim()}
            >
              {busy ? 'Importando…' : 'Importar deck'}
            </button>
          </>
        }
      >
        <textarea
          className="textarea textarea--tall"
          value={pasteText}
          onChange={(event) => setPasteText(event.target.value)}
          placeholder={'---\ntitle: Mi seminario\n---\n\n# Mi seminario\n\n## Primera sección\n\nContenido…'}
          aria-label="Markdown del deck"
        />
        {dialogError ? <p className="form-error">{dialogError}</p> : null}
        <p className="form-hint">
          Las imágenes pueden ser URLs https:// directas o archivos locales. Si
          usas archivos locales, impórtalos como carpeta para que se guarden
          junto al deck.
        </p>
      </Modal>

      <Modal
        open={urlOpen}
        onClose={() => setUrlOpen(false)}
        title="Importar desde una URL"
        description="Descarga un Markdown publicado en la web."
        footer={
          <>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setUrlOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="button button--solid"
              onClick={handleUrl}
              disabled={busy || !urlText.trim()}
            >
              {busy ? 'Importando…' : 'Importar deck'}
            </button>
          </>
        }
      >
        <label className="field">
          <span>Dirección del Markdown</span>
          <input
            type="url"
            value={urlText}
            onChange={(event) => setUrlText(event.target.value)}
            placeholder="https://example.com/seminario.md"
            autoFocus
          />
        </label>
        {dialogError ? <p className="form-error">{dialogError}</p> : null}
        <p className="form-hint">
          El servidor debe permitir el acceso desde el navegador (CORS). Las
          imágenes absolutas se enlazan desde su origen; las relativas se
          resuelven contra la URL del documento. Usa https:// y añade crédito.
        </p>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar deck"
        description={
          deleteTarget
            ? isCloudMode
              ? `Se eliminará «${deleteTarget.title}» junto con su progreso guardado en la nube.`
              : `Se eliminará «${deleteTarget.title}» junto con su progreso de este navegador.`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </button>
            <button type="button" className="button button--solid" onClick={handleDelete}>
              Eliminar
            </button>
          </>
        }
      >
        <p className="muted">
          El archivo Markdown original no se modifica. Esta acción no se puede
          deshacer.
        </p>
      </Modal>
    </div>
  );
}
