import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Eraser, Highlighter } from 'lucide-react';
import {
  applyHighlight,
  commonHighlightRoot,
  createHighlightFromRange,
  loadHighlights,
  locateHighlight,
  removeHighlightMarks,
  saveHighlights,
  selectionOverlappingIds,
  type StoredHighlight,
} from '../../lib/reader/highlights';

type ToolbarState = {
  left: number;
  top: number;
  below: boolean;
  mode: 'add' | 'remove';
  ids: string[];
};

export function HighlightLayer({ deckId }: { deckId: string }) {
  const [highlights, setHighlights] = useState<StoredHighlight[]>(() =>
    loadHighlights(deckId),
  );
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const rangeRef = useRef<Range | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  // Reaplica los resaltados guardados cada vez que React monta o desmonta
  // contenido (acordeones, callouts plegables, cambios de vista).
  useEffect(() => {
    let frame = 0;
    let applying = false;

    const applyAll = () => {
      if (applying) return;
      applying = true;

      const roots = Array.from(
        document.querySelectorAll<HTMLElement>('[data-highlight-root]'),
      );
      const active = new Set(highlights.map((highlight) => highlight.id));

      roots.forEach((root) => {
        root
          .querySelectorAll<HTMLElement>('mark.user-highlight')
          .forEach((mark) => {
            const id = mark.dataset.highlightId;
            if (!id || !active.has(id)) removeHighlightMarks(root, id ?? '');
          });
      });

      const alreadyApplied = new Set(
        Array.from(
          document.querySelectorAll<HTMLElement>('mark.user-highlight'),
        )
          .map((mark) => mark.dataset.highlightId)
          .filter((id): id is string => Boolean(id)),
      );

      for (const highlight of highlights) {
        if (alreadyApplied.has(highlight.id)) continue;

        let target: { root: HTMLElement; score: number } | null = null;
        for (const root of roots) {
          const located = locateHighlight(root, highlight);
          if (!located) continue;
          if (!target || located.score > target.score) {
            target = { root, score: located.score };
          }
        }

        if (target && applyHighlight(target.root, highlight)) {
          alreadyApplied.add(highlight.id);
        }
      }

      observer.takeRecords();
      applying = false;
    };

    const schedule = () => {
      if (applying || frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        applyAll();
      });
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    applyAll();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [highlights]);

  // Barra flotante para resaltar o quitar el resaltado de la selección.
  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        rangeRef.current = null;
        rootRef.current = null;
        setToolbar(null);
        return;
      }

      const range = selection.getRangeAt(0);
      if (!range.toString().trim()) {
        rangeRef.current = null;
        rootRef.current = null;
        setToolbar(null);
        return;
      }

      const root = commonHighlightRoot(range);
      if (!root) {
        rangeRef.current = null;
        rootRef.current = null;
        setToolbar(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setToolbar(null);
        return;
      }

      const ids = selectionOverlappingIds(root, range);
      const below = rect.top < 72;
      rangeRef.current = range.cloneRange();
      rootRef.current = root;
      setToolbar({
        left: Math.min(
          window.innerWidth - 96,
          Math.max(96, rect.left + rect.width / 2),
        ),
        top: below ? rect.bottom + 10 : rect.top - 10,
        below,
        mode: ids.length > 0 ? 'remove' : 'add',
        ids,
      });
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    document.addEventListener('selectionchange', schedule);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('selectionchange', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  const keepSelection = (event: PointerEvent<HTMLDivElement>) => {
    // Sin esto, pulsar el botón colapsaría la selección antes del click.
    event.preventDefault();
  };

  const handleAction = () => {
    const range = rangeRef.current;
    const root = rootRef.current;
    if (!toolbar || !range || !root) return;

    if (toolbar.mode === 'remove') {
      const next = highlights.filter(
        (highlight) => !toolbar.ids.includes(highlight.id),
      );
      setHighlights(next);
      saveHighlights(deckId, next);
      toolbar.ids.forEach((id) => removeHighlightMarks(document, id));
    } else {
      const highlight = createHighlightFromRange(root, range);
      if (!highlight) return;
      const next = [...highlights, highlight];
      setHighlights(next);
      saveHighlights(deckId, next);
      applyHighlight(root, highlight);
    }

    window.getSelection()?.removeAllRanges();
    setToolbar(null);
  };

  if (!toolbar) return null;

  return (
    <div
      className={`highlight-toolbar${toolbar.below ? ' is-below' : ''}`}
      style={{ left: `${toolbar.left}px`, top: `${toolbar.top}px` }}
      role="toolbar"
      aria-label="Resaltado de texto"
      onPointerDown={keepSelection}
    >
      <button
        type="button"
        className="highlight-toolbar__button"
        onClick={handleAction}
        title={
          toolbar.mode === 'remove'
            ? 'Quitar el resaltado de la selección'
            : 'Resaltar la selección'
        }
      >
        {toolbar.mode === 'remove' ? (
          <Eraser size={15} aria-hidden="true" />
        ) : (
          <Highlighter size={15} aria-hidden="true" />
        )}
        <span>
          {toolbar.mode === 'remove' ? 'Quitar resaltado' : 'Resaltar'}
        </span>
      </button>
    </div>
  );
}
