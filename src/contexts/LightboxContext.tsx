import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { isRemoteImage, isSafeImageSrc } from '../lib/images';
import { slugify } from '../lib/format/utils';
import { useDeck } from './DeckContext';

export type LightboxImage = {
  src: string;
  source?: string;
  alt?: string;
  caption?: string;
};

type LightboxContextValue = {
  open: (images: LightboxImage[], index?: number) => void;
  close: () => void;
};

const LightboxContext = createContext<LightboxContextValue | null>(null);

type Point = { x: number; y: number };

export function LightboxProvider({ children }: { children: ReactNode }) {
  const { replaceImage } = useDeck();
  const [images, setImages] = useState<LightboxImage[]>([]);
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editUrl, setEditUrl] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const dragStart = useRef<{ pointer: Point; origin: Point } | null>(null);
  const moved = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setImages([]);
    setIndex(0);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
    setEditing(false);
    setEditUrl('');
    setEditFile(null);
    setEditError(null);
    setEditBusy(false);
  }, []);

  const open = useCallback((nextImages: LightboxImage[], start = 0) => {
    const usable = nextImages.filter((image) => Boolean(image.src));
    if (usable.length === 0) return;
    restoreFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setImages(usable);
    setIndex(Math.max(0, Math.min(start, usable.length - 1)));
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setEditing(false);
    setEditUrl('');
    setEditFile(null);
    setEditError(null);
    setEditBusy(false);
  }, []);

  const isOpen = images.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocus.current?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (editing) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setEditing(false);
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((current) => (current - 1 + images.length) % images.length);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex((current) => (current + 1) % images.length);
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setScale((current) => Math.min(5, current + 0.35));
      } else if (event.key === '-') {
        event.preventDefault();
        setScale((current) => Math.max(1, current - 0.35));
      } else if (event.key === '0') {
        event.preventDefault();
        setScale(1);
        setOffset({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, editing, images.length, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [index, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && Math.abs(event.deltaY) < 2) return;
      event.preventDefault();
      const next = event.deltaY < 0 ? 0.25 : -0.25;
      setScale((current) => {
        const value = Math.max(1, Math.min(5, current + next));
        if (value === 1) setOffset({ x: 0, y: 0 });
        return value;
      });
    };

    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [isOpen]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const trigger = target?.closest<HTMLElement>('[data-lightbox]');
      if (!trigger) return;
      const triggers = Array.from(
        document.querySelectorAll<HTMLElement>('[data-lightbox]'),
      );
      const clickedIndex = triggers.indexOf(trigger);
      const gallery = triggers
        .map((element) => ({
          src: element.dataset.src || element.getAttribute('src') || '',
          source: element.dataset.source || '',
          alt: element.dataset.alt || element.getAttribute('alt') || '',
          caption: element.dataset.caption || '',
        }))
        .filter((image) => Boolean(image.src));
      if (gallery.length === 0) return;
      event.preventDefault();
      open(gallery, clickedIndex >= 0 ? clickedIndex : 0);
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  const zoomBy = (delta: number) => {
    setScale((current) => {
      const value = Math.max(1, Math.min(5, current + delta));
      if (value === 1) setOffset({ x: 0, y: 0 });
      return value;
    });
  };

  const current = images[index];

  const startEdit = () => {
    if (!current) return;
    const source = current.source || current.src;
    setEditUrl(isRemoteImage(source) ? source : '');
    setEditFile(null);
    setEditError(null);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!current) return;
    setEditBusy(true);
    setEditError(null);
    try {
      const oldSource = current.source || current.src;
      const localOld =
        !isRemoteImage(oldSource) && !/^(data|blob):/i.test(oldSource);
      const removeAssetKey = localOld
        ? oldSource.replace(/^\.\//, '').split(/[?#]/)[0]
        : undefined;

      if (!editFile && editUrl.trim() === oldSource) {
        close();
        return;
      }

      if (editFile) {
        if (editFile.size > 10 * 1024 * 1024) {
          throw new Error('La imagen supera el límite de 10 MB.');
        }
        const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg']);
        const mimeExtensions: Record<string, string> = {
          'image/png': '.png',
          'image/jpeg': '.jpg',
          'image/webp': '.webp',
          'image/gif': '.gif',
          'image/avif': '.avif',
          'image/svg+xml': '.svg',
        };
        const fromName = editFile.name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
        const extension =
          fromName && allowed.has(fromName)
            ? fromName
            : mimeExtensions[editFile.type] ?? '';
        if (!extension) {
          throw new Error('Formato no permitido. Usa PNG, JPG, WebP, GIF, AVIF o SVG.');
        }
        const base = slugify(editFile.name.replace(/\.[^.]+$/, '')) || 'imagen';
        const suffix =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
            : Math.random().toString(36).slice(2, 10).padEnd(8, '0');
        const key = `images/${base}-${suffix}${extension}`;
        await replaceImage({
          oldSource,
          newSource: key,
          asset: { key, blob: editFile },
          removeAssetKey: removeAssetKey === key ? undefined : removeAssetKey,
        });
      } else {
        const url = editUrl.trim();
        if (!url) {
          throw new Error('Escribe una URL o elige un archivo.');
        }
        if (/^http:\/\//i.test(url)) {
          throw new Error('Usa una URL https:// para la imagen.');
        }
        if (/^(data|blob):/i.test(url)) {
          throw new Error('Esa URL no se puede guardar en el deck.');
        }
        if (!isSafeImageSrc(url)) {
          throw new Error('La URL de la imagen no es válida.');
        }
        await replaceImage({
          oldSource,
          newSource: url,
          removeAssetKey,
        });
      }
      close();
    } catch (cause) {
      setEditError(
        cause instanceof Error ? cause.message : 'No se pudo cambiar la imagen.',
      );
    } finally {
      setEditBusy(false);
    }
  };

  const value = useMemo<LightboxContextValue>(() => ({ open, close }), [open, close]);

  return (
    <LightboxContext.Provider value={value}>
      {children}
      {isOpen && current
        ? createPortal(
            <div
              className="lightbox"
              role="dialog"
              aria-modal="true"
              aria-label="Visor de imágenes"
            >
              <div className="lightbox__top">
                <span className="lightbox__counter">
                  {index + 1} / {images.length}
                </span>
                <div className="lightbox__tools">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => zoomBy(-0.35)}
                    aria-label="Alejar"
                    title="Alejar (−)"
                  >
                    <ZoomOut size={18} />
                  </button>
                  <span className="lightbox__zoom">{Math.round(scale * 100)}%</span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => zoomBy(0.35)}
                    aria-label="Acercar"
                    title="Acercar (+)"
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      setScale(1);
                      setOffset({ x: 0, y: 0 });
                    }}
                    aria-label="Restablecer zoom"
                    title="Restablecer (0)"
                  >
                    <RotateCcw size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={startEdit}
                    disabled={!current.source}
                    aria-label="Editar imagen"
                    title="Editar imagen"
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    ref={closeRef}
                    type="button"
                    className="icon-button"
                    onClick={close}
                    aria-label="Cerrar visor"
                    title="Cerrar (Esc)"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div
                ref={stageRef}
                className={`lightbox__stage${dragging ? ' is-dragging' : ''}${
                  scale > 1 ? ' is-zoomed' : ''
                }`}
                onClick={(event) => {
                  if (event.target !== event.currentTarget || moved.current) return;
                  if (scale === 1) close();
                }}
                onPointerDown={(event) => {
                  if (scale <= 1) return;
                  moved.current = false;
                  dragStart.current = {
                    pointer: { x: event.clientX, y: event.clientY },
                    origin: offset,
                  };
                  setDragging(true);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const start = dragStart.current;
                  if (!start) return;
                  const dx = event.clientX - start.pointer.x;
                  const dy = event.clientY - start.pointer.y;
                  if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
                  setOffset({ x: start.origin.x + dx, y: start.origin.y + dy });
                }}
                onPointerUp={(event) => {
                  dragStart.current = null;
                  setDragging(false);
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  window.setTimeout(() => {
                    moved.current = false;
                  }, 0);
                }}
                onPointerCancel={() => {
                  dragStart.current = null;
                  setDragging(false);
                }}
                onDoubleClick={() => {
                  if (scale > 1) {
                    setScale(1);
                    setOffset({ x: 0, y: 0 });
                  } else {
                    setScale(2.5);
                  }
                }}
              >
                {images.length > 1 ? (
                  <button
                    type="button"
                    className="lightbox__arrow lightbox__arrow--prev"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIndex((current) => (current - 1 + images.length) % images.length);
                    }}
                    aria-label="Imagen anterior"
                  >
                    <ChevronLeft size={26} />
                  </button>
                ) : null}

                <img
                  className="lightbox__image"
                  src={current.src}
                  alt={current.alt || ''}
                  draggable={false}
                  referrerPolicy={
                    isRemoteImage(current.src) ? 'no-referrer' : undefined
                  }
                  style={{
                    transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
                  }}
                />

                {images.length > 1 ? (
                  <button
                    type="button"
                    className="lightbox__arrow lightbox__arrow--next"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIndex((current) => (current + 1) % images.length);
                    }}
                    aria-label="Imagen siguiente"
                  >
                    <ChevronRight size={26} />
                  </button>
                ) : null}
              </div>

              <div className="lightbox__bottom">
                {(current.caption || current.alt) && (
                  <p className="lightbox__caption">{current.caption || current.alt}</p>
                )}
                {images.length > 1 ? (
                  <div className="lightbox__thumbs" aria-label="Miniaturas">
                    {images.map((image, thumbIndex) => (
                      <button
                        key={`${image.src}-${thumbIndex}`}
                        type="button"
                        className={`lightbox__thumb${
                          thumbIndex === index ? ' is-active' : ''
                        }`}
                        onClick={() => setIndex(thumbIndex)}
                        aria-label={`Ver imagen ${thumbIndex + 1}`}
                        aria-current={thumbIndex === index}
                      >
                        <img src={image.src} alt="" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {editing ? (
                <div className="lightbox__edit" role="group" aria-label="Editar imagen">
                  <div className="lightbox__edit-head">
                    <strong>Editar imagen</strong>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setEditing(false)}
                      aria-label="Cerrar editor"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <p className="lightbox__edit-source">
                    <code>{current.source || current.src}</code>
                  </p>

                  <label className="field">
                    <span>Cambiar por URL</span>
                    <input
                      type="url"
                      value={editUrl}
                      onChange={(event) => setEditUrl(event.target.value)}
                      placeholder="https://…"
                      autoFocus
                      disabled={editBusy}
                    />
                  </label>

                  <label className="field">
                    <span>O subir un archivo</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
                      onChange={(event) => {
                        setEditFile(event.target.files?.[0] ?? null);
                        setEditError(null);
                      }}
                      disabled={editBusy}
                    />
                  </label>

                  <p className="lightbox__edit-hint">
                    {editFile
                      ? 'Se guardará el archivo nuevo y se borrará la imagen anterior.'
                      : 'Si cambias la URL, la imagen anterior se elimina cuando era un archivo local.'}
                  </p>

                  {editError ? (
                    <p className="form-error" role="alert">
                      {editError}
                    </p>
                  ) : null}

                  <div className="lightbox__edit-actions">
                    <button
                      type="button"
                      className="button button--solid"
                      onClick={saveEdit}
                      disabled={editBusy}
                    >
                      {editBusy ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => setEditing(false)}
                      disabled={editBusy}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </LightboxContext.Provider>
  );
}

export function useLightbox(): LightboxContextValue {
  const context = useContext(LightboxContext);
  if (!context) {
    throw new Error('useLightbox debe usarse dentro de LightboxProvider.');
  }
  return context;
}
