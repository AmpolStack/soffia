import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Check,
  ChevronsDown,
  ChevronsUp,
  Download,
  GripVertical,
  List,
  Printer,
  X,
} from 'lucide-react';
import type { SectionNode } from '../../lib/format/types';
import {
  clampTocWidth,
  TOC_WIDTH_MAX,
  TOC_WIDTH_MIN,
} from '../../lib/reader/tocWidth';

export function Toc({
  sections,
  activeId,
  readSections,
  onNavigate,
  onPrint,
  onDownload,
  allExpanded,
  onToggleAll,
  mobileOpen,
  onClose,
  width,
  onWidthChange,
}: {
  sections: SectionNode[];
  activeId: string;
  readSections: Set<string>;
  onNavigate: (id: string) => void;
  onPrint: () => void;
  onDownload: () => void;
  allExpanded: boolean;
  onToggleAll: () => void;
  mobileOpen: boolean;
  onClose: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}) {
  const readCount = sections.filter((section) => readSections.has(section.id)).length;
  const percent = sections.length
    ? Math.round((readCount / sections.length) * 100)
    : 0;
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startWidth: width };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start) return;
    // Arrastrar hacia la izquierda ensancha el índice.
    onWidthChange(
      clampTocWidth(start.startWidth + start.startX - event.clientX),
    );
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="toc-backdrop"
          onClick={onClose}
          aria-label="Cerrar índice"
        />
      ) : null}

      <aside
        className={`toc${mobileOpen ? ' is-mobile-open' : ''}`}
        aria-label="Índice del deck"
      >
        <div
          className={`toc__drag${dragging ? ' is-dragging' : ''}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Cambiar el ancho del índice"
          aria-valuemin={TOC_WIDTH_MIN}
          aria-valuemax={TOC_WIDTH_MAX}
          aria-valuenow={Math.round(width)}
          tabIndex={0}
          title="Arrastra o usa ←/→ para cambiar el ancho del índice"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const delta = event.key === 'ArrowLeft' ? 16 : -16;
            onWidthChange(clampTocWidth(width + delta));
          }}
        >
          <GripVertical size={14} aria-hidden="true" />
        </div>

        <div className="toc__inner">
          <div className="toc__top">
            <span className="toc__label">
              <List size={15} aria-hidden="true" />
              Índice
            </span>
            <button
              type="button"
              className="icon-button toc__close"
              onClick={onClose}
              aria-label="Cerrar índice"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="toc__nav">
            <ol>
              <li>
                <button
                  type="button"
                  className={`toc__link${activeId === 'inicio' ? ' is-active' : ''}`}
                  onClick={() => onNavigate('inicio')}
                  aria-current={activeId === 'inicio' ? 'location' : undefined}
                >
                  <span>Inicio</span>
                </button>
              </li>
              {sections.map((section, index) => {
                const active = activeId === section.id;
                const read = readSections.has(section.id);
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      className={`toc__link${active ? ' is-active' : ''}${
                        read ? ' is-read' : ''
                      }`}
                      onClick={() => onNavigate(section.id)}
                      aria-current={active ? 'location' : undefined}
                    >
                      <span className="toc__number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="toc__text">{section.title}</span>
                      {read ? (
                        <Check
                          size={13}
                          className="toc__check"
                          aria-label="Leída"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="toc__footer">
            <div className="toc__progress">
              <div className="toc__progress-row">
                <span>Secciones leídas</span>
                <span>
                  {readCount}/{sections.length}
                </span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${percent}%` }} />
              </div>
            </div>
            <button
              type="button"
              className="button button--ghost button--small toc__toggle-all"
              onClick={onToggleAll}
              disabled={sections.length === 0}
            >
              {allExpanded ? (
                <ChevronsUp size={15} aria-hidden="true" />
              ) : (
                <ChevronsDown size={15} aria-hidden="true" />
              )}
              {allExpanded ? 'Colapsar todo' : 'Expandir todo'}
            </button>
            <button type="button" className="button button--ghost button--small toc__download" onClick={onDownload}>
              <Download size={15} aria-hidden="true" />
              Descargar
            </button>
            <button type="button" className="button button--ghost button--small toc__print" onClick={onPrint}>
              <Printer size={15} aria-hidden="true" />
              Imprimir
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
