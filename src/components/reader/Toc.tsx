import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Check,
  ChevronsDown,
  ChevronsUp,
  Download,
  GripHorizontal,
  List,
  Printer,
  X,
} from 'lucide-react';
import type { SectionNode } from '../../lib/format/types';

const TOC_SHIFT_KEY = 'soffia:toc-shift';
const TOC_SHIFT_MIN = -180;
const TOC_SHIFT_MAX = 24;

function clampShift(value: number): number {
  return Math.max(TOC_SHIFT_MIN, Math.min(TOC_SHIFT_MAX, Math.round(value)));
}

function loadShift(): number {
  try {
    const raw = localStorage.getItem(TOC_SHIFT_KEY);
    if (!raw) return 0;
    const value = Number(raw);
    return Number.isFinite(value) ? clampShift(value) : 0;
  } catch {
    return 0;
  }
}

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
}) {
  const readCount = sections.filter((section) => readSections.has(section.id)).length;
  const percent = sections.length
    ? Math.round((readCount / sections.length) * 100)
    : 0;
  const [shift, setShift] = useState(loadShift);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startShift: number } | null>(null);
  const shiftRef = useRef(shift);

  const persistShift = (value: number) => {
    try {
      localStorage.setItem(TOC_SHIFT_KEY, String(value));
    } catch {
      // Sin persistencia: el desplazamiento dura esta vista.
    }
  };

  const applyShift = (value: number): number => {
    const next = clampShift(value);
    shiftRef.current = next;
    setShift(next);
    return next;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startShift: shiftRef.current };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start) return;
    applyShift(start.startShift + event.clientX - start.startX);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    persistShift(shiftRef.current);
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
        style={{ '--toc-shift': `${shift}px` } as CSSProperties}
      >
        <div className="toc__inner">
          <div
            className={`toc__drag${dragging ? ' is-dragging' : ''}`}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Mover el índice"
            aria-valuemin={TOC_SHIFT_MIN}
            aria-valuemax={TOC_SHIFT_MAX}
            aria-valuenow={shift}
            tabIndex={0}
            title="Arrastra o usa ←/→ para mover el índice"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              const next = applyShift(
                shiftRef.current + (event.key === 'ArrowRight' ? 8 : -8),
              );
              persistShift(next);
            }}
          >
            <GripHorizontal size={16} aria-hidden="true" />
          </div>

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
