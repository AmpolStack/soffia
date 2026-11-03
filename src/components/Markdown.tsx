import { useEffect, useMemo, useRef, type MouseEvent } from 'react';
import { renderInline, renderMarkdown } from '../lib/format/renderMarkdown';
import { useDeck } from '../contexts/DeckContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { isRemoteImage } from '../lib/images';
import { hashString } from '../lib/format/utils';
import {
  allocateTableWidths,
  type TableLayoutMode,
} from '../lib/tableLayout';

function measureTextWidth(text: string, style: CSSStyleDeclaration): number {
  if (!text.trim()) return 0;
  const probe = document.createElement('span');
  probe.textContent = text;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.whiteSpace = 'nowrap';
  probe.style.pointerEvents = 'none';
  probe.style.fontFamily = style.fontFamily;
  probe.style.fontSize = style.fontSize;
  probe.style.fontWeight = style.fontWeight;
  probe.style.letterSpacing = style.letterSpacing;
  probe.style.textTransform = style.textTransform;
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

function paddingWidth(style: CSSStyleDeclaration): number {
  return (
    Number.parseFloat(style.paddingLeft || '0') +
    Number.parseFloat(style.paddingRight || '0')
  );
}

function longestWordWidth(text: string, style: CSSStyleDeclaration): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reduce((width, word) => Math.max(width, measureTextWidth(word, style)), 0);
}

function headerMinWidth(header: HTMLTableCellElement): number {
  const style = window.getComputedStyle(header);
  const contentWidth = longestWordWidth(header.textContent ?? '', style);
  return Math.max(
    56,
    Math.min(240, Math.ceil(contentWidth + paddingWidth(style) + 2)),
  );
}

function headerPreferredWidth(header: HTMLTableCellElement): number {
  const style = window.getComputedStyle(header);
  const contentWidth = measureTextWidth(header.textContent ?? '', style);
  return Math.max(
    56,
    Math.min(360, Math.ceil(contentWidth + paddingWidth(style) + 2)),
  );
}

function cellPreferredWidth(cell: HTMLTableCellElement): number {
  const style = window.getComputedStyle(cell);
  const contentWidth = measureTextWidth(cell.textContent ?? '', style);
  return Math.max(
    56,
    Math.min(360, Math.ceil(contentWidth + paddingWidth(style) + 2)),
  );
}

function mapRowCells(
  row: HTMLTableRowElement,
  columnCount: number,
): Array<HTMLTableCellElement | undefined> {
  const cells: Array<HTMLTableCellElement | undefined> =
    new Array(columnCount);
  let column = 0;
  for (const cell of Array.from(row.cells)) {
    if (column >= columnCount) break;
    cells[column] = cell;
    column += Math.max(1, cell.colSpan || 1);
  }
  return cells;
}

export function Markdown({
  source,
  className = '',
  compact = false,
}: {
  source: string;
  className?: string;
  compact?: boolean;
}) {
  const { deck, resolveSrc } = useDeck();
  const { settings } = useSettings();
  const { toast } = useToast();
  const ref = useRef<HTMLDivElement | null>(null);
  const html = useMemo(
    () => renderMarkdown(source, { resolveSrc }),
    [resolveSrc, source],
  );

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controller = new AbortController();
    const { signal } = controller;
    const deckId = deck?.id ?? 'local';

    const tables = Array.from(
      node.querySelectorAll<HTMLTableElement>('.table-wrap table'),
    );

    tables.forEach((table, index) => {
      const wrapper = table.parentElement;
      if (!wrapper) return;

      const headers = Array.from(
        table.querySelectorAll<HTMLTableCellElement>('thead th'),
      );
      const rows = Array.from(
        table.querySelectorAll<HTMLTableRowElement>('tbody tr'),
      );
      if (headers.length === 0) return;

      const headerMinWidths = headers.map(headerMinWidth);
      const headerPreferredWidths = headers.map(headerPreferredWidth);
      // Medir todas las celdas de tablas grandes puede ser costoso; con las
      // primeras filas basta para estimar el reparto ideal.
      const sampleRows = rows.slice(0, 30);
      const sampledCells = sampleRows.map((row) =>
        mapRowCells(row, headers.length),
      );
      const preferredWidths = headerMinWidths.map((minimum, columnIndex) => {
        let width = Math.max(minimum, headerPreferredWidths[columnIndex] ?? 0);
        sampledCells.forEach((cells) => {
          const cell = cells[columnIndex];
          if (!cell || cell.colSpan > 1) return;
          width = Math.max(width, cellPreferredWidth(cell));
        });
        return width;
      });

      const tableKey = hashString(
        `${deckId}|${index}|${table.textContent ?? ''}`,
      );
      const storageKey = `soffia:table-layout:${deckId}:${tableKey}`;
      table.dataset.tableKey = tableKey;
      table.style.tableLayout = 'fixed';
      table.style.width = '100%';
      wrapper.classList.add('table-resizable');

      // En móvil cada columna conserva un ancho legible; si no cabe, la
      // tabla se desplaza en horizontal en lugar de comprimir el texto.
      const mobileMinWidths = headerMinWidths.map((minimum, columnIndex) => {
        const preferred = preferredWidths[columnIndex] ?? minimum;
        return Math.max(minimum, Math.min(240, Math.max(96, preferred)));
      });
      const mobileQuery = window.matchMedia(
        '(max-width: 720px), (hover: none), (pointer: coarse)',
      );

      // Las acciones viven fuera del contenedor con scroll y borde de la
      // tabla: así no alteran su gap ni su margen interior.
      let block = wrapper.parentElement;
      if (!block?.classList.contains('table-block')) {
        block = document.createElement('div');
        block.className = 'table-block';
        wrapper.parentElement?.insertBefore(block, wrapper);
        block.appendChild(wrapper);
      }
      if (!block) return;
      block
        .querySelectorAll(
          ':scope > .table-actions, :scope > .table-fullscreen-close',
        )
        .forEach((node) => node.remove());

      // Se recrea el colgroup para no arrastrar anchos de una vista anterior.
      table.querySelector('colgroup')?.remove();
      const colgroup = document.createElement('colgroup');
      headers.forEach(() =>
        colgroup.appendChild(document.createElement('col')),
      );
      table.prepend(colgroup);
      const columns = Array.from(
        colgroup.querySelectorAll<HTMLTableColElement>('col'),
      );

      type SavedTableLayout = {
        mode?: TableLayoutMode;
        columns?: number[];
        rows?: number[];
      };

      let saved: SavedTableLayout | null = null;
      try {
        saved = JSON.parse(
          localStorage.getItem(storageKey) ?? 'null',
        ) as SavedTableLayout | null;
      } catch {
        saved = null;
      }

      const hasSavedColumns =
        Array.isArray(saved?.columns) &&
        saved.columns.some(
          (width) => Number.isFinite(width) && width > 0,
        );
      let mode: TableLayoutMode =
        saved?.mode ?? (hasSavedColumns ? 'custom' : 'fit');
      if (mode !== 'fit' && mode !== 'equal' && mode !== 'custom') {
        mode = hasSavedColumns ? 'custom' : 'fit';
      }
      if (mode === 'custom' && !hasSavedColumns) {
        mode = 'fit';
      }

      let isFullscreen = false;
      let isResizingRow = false;
      let controlsOpen = false;
      let backdrop: HTMLDivElement | null = null;
      let resizeFrame = 0;
      let overflowFrame = 0;

      type TableAction = 'fit' | 'equal' | 'fullscreen' | 'reset';

      const makeActions = (position: 'top' | 'bottom') => {
        const bar = document.createElement('div');
        bar.className = `table-actions table-actions--${position}`;
        bar.setAttribute('role', 'toolbar');
        bar.setAttribute(
          'aria-label',
          `Opciones de tabla, ${position === 'top' ? 'arriba' : 'abajo'}`,
        );
        return bar;
      };

      const topActions = makeActions('top');
      const bottomActions = makeActions('bottom');
      const actionButtons: Record<TableAction, HTMLButtonElement[]> = {
        fit: [],
        equal: [],
        fullscreen: [],
        reset: [],
      };

      const makeAction = (
        bar: HTMLDivElement,
        label: string,
        action: TableAction,
        extraClass = '',
      ) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `table-action ${extraClass}`.trim();
        button.dataset.action = action;
        button.textContent = label;
        bar.appendChild(button);
        actionButtons[action].push(button);
        return button;
      };

      [topActions, bottomActions].forEach((bar) => {
        const fitButton = makeAction(bar, 'Ajustar', 'fit', 'table-action--fit');
        fitButton.title =
          'Distribuir las columnas según el encabezado y el contenido';
        const equalButton = makeAction(
          bar,
          'Igualar',
          'equal',
          'table-action--equal',
        );
        equalButton.title =
          'Repartir el ancho de las columnas a partes iguales';
        const fullscreenButton = makeAction(
          bar,
          'Pantalla completa',
          'fullscreen',
          'table-action--fullscreen',
        );
        fullscreenButton.title = 'Ver la tabla a pantalla completa';
        const resetButton = makeAction(
          bar,
          'Restablecer',
          'reset',
          'table-reset',
        );
        resetButton.title = 'Quitar los anchos y altos personalizados';
      });

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'table-fullscreen-close';
      closeButton.setAttribute('aria-label', 'Salir de pantalla completa');
      closeButton.title = 'Salir de pantalla completa';
      closeButton.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      closeButton.hidden = true;

      block.insertBefore(topActions, wrapper);
      block.appendChild(wrapper);
      block.appendChild(bottomActions);
      block.appendChild(closeButton);

      const syncActions = () => {
        const setActive = (
          buttons: HTMLButtonElement[],
          active: boolean,
        ) => {
          buttons.forEach((button) => {
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
          });
        };

        setActive(actionButtons.fit, mode === 'fit');
        setActive(actionButtons.equal, mode === 'equal');
        setActive(actionButtons.fullscreen, isFullscreen);
        actionButtons.fullscreen.forEach((button) => {
          button.hidden = isFullscreen;
        });
        closeButton.hidden = !isFullscreen;
        block.classList.toggle('is-fullscreen', isFullscreen);
        block.classList.toggle('is-controls-open', controlsOpen);
      };

      const applyRows = () => {
        rows.forEach((row, rowIndex) => {
          const height = saved?.rows?.[rowIndex];
          row.style.height =
            Number.isFinite(height) && (height ?? 0) > 0
              ? `${height}px`
              : '';
        });
      };

      const clearColumnWidths = () => {
        columns.forEach((column) => {
          column.style.width = '';
        });
        table.style.minWidth = '';
      };

      const syncOverflow = () => {
        const overflowing = wrapper.scrollWidth > wrapper.clientWidth + 1;
        wrapper.classList.toggle('has-overflow', overflowing);
        if (overflowing) wrapper.tabIndex = 0;
        else wrapper.removeAttribute('tabindex');
      };

      const scheduleOverflowSync = () => {
        window.cancelAnimationFrame(overflowFrame);
        overflowFrame = window.requestAnimationFrame(syncOverflow);
      };

      const applyWidths = (
        widths: number[],
        minWidth: number,
        overflow: boolean,
      ) => {
        columns.forEach((column, columnIndex) => {
          const width = widths[columnIndex];
          column.style.width = width ? `${width}px` : '';
        });
        table.style.width = '100%';
        table.style.minWidth =
          overflow && minWidth > 0 ? `${Math.ceil(minWidth)}px` : '';
      };

      const applyFit = (nextMode: 'fit' | 'equal') => {
        const available = Math.max(1, wrapper.clientWidth);
        const minWidths = mobileQuery.matches
          ? mobileMinWidths
          : headerMinWidths;
        const result = allocateTableWidths({
          available,
          minWidths,
          weights:
            nextMode === 'fit'
              ? preferredWidths
              : minWidths.map(() => 1),
        });
        applyWidths(result.widths, result.minWidth, result.overflow);
        applyRows();
        scheduleOverflowSync();
      };

      const applyCustom = () => {
        clearColumnWidths();
        const savedColumns = Array.isArray(saved?.columns)
          ? saved.columns
          : [];
        savedColumns.forEach((width, columnIndex) => {
          const column = columns[columnIndex];
          if (!column || !Number.isFinite(width) || width <= 0) return;
          column.style.width = `${width}px`;
        });
        const total = savedColumns.reduce(
          (sum, width) =>
            sum + (Number.isFinite(width) && width > 0 ? width : 0),
          0,
        );
        const available = Math.max(1, wrapper.clientWidth);
        const overflow = total > available + 1;
        table.style.minWidth =
          overflow && total > 0 ? `${Math.ceil(total)}px` : '';
        applyRows();
        scheduleOverflowSync();
      };

      const apply = () => {
        const nextMode = mode;
        if (nextMode === 'custom') applyCustom();
        else applyFit(nextMode);
        syncActions();
      };

      const persist = () => {
        const layout: SavedTableLayout = {
          mode,
          columns: columns.map((column) =>
            Math.round(column.getBoundingClientRect().width),
          ),
          // Solo se guardan las alturas ajustadas a mano; las automáticas
          // deben seguir respondiendo al ancho disponible.
          rows: rows.map((row) => {
            const height = Number.parseFloat(row.style.height);
            return Number.isFinite(height) && height > 0
              ? Math.round(height)
              : 0;
          }),
        };
        saved = layout;
        try {
          localStorage.setItem(storageKey, JSON.stringify(layout));
        } catch {
          // Sin localStorage: el cambio se mantiene en esta vista.
        }
      };

      const setMode = (nextMode: TableLayoutMode) => {
        mode = nextMode;
        apply();
        persist();
      };

      const reset = (event: Event) => {
        event.stopPropagation();
        saved = null;
        mode = 'fit';
        clearColumnWidths();
        rows.forEach((row) => {
          row.style.height = '';
        });
        try {
          localStorage.removeItem(storageKey);
        } catch {
          // Sin localStorage: no hay nada que borrar.
        }
        apply();
      };

      const releaseBodyLock = () => {
        if (!document.querySelector('.table-block.is-fullscreen')) {
          document.body.classList.remove('has-table-fullscreen');
        }
      };

      const closeFullscreen = (restoreFocus = true) => {
        if (!isFullscreen) return;
        isFullscreen = false;
        if (mobileQuery.matches) controlsOpen = true;
        syncActions();
        backdrop?.remove();
        backdrop = null;
        releaseBodyLock();
        if (restoreFocus) {
          actionButtons.fullscreen[0]?.focus({ preventScroll: true });
        }
      };

      const openFullscreen = () => {
        if (isFullscreen) return;
        document
          .querySelectorAll<HTMLElement>('.table-block.is-fullscreen')
          .forEach((other) => {
            if (other !== block) {
              other.dispatchEvent(
                new CustomEvent('soffia:close-table-fullscreen'),
              );
            }
          });
        isFullscreen = true;
        controlsOpen = true;
        document.body.classList.add('has-table-fullscreen');
        backdrop = document.createElement('div');
        backdrop.className = 'table-fullscreen-backdrop';
        backdrop.addEventListener('click', () => closeFullscreen(), { signal });
        block.parentElement?.insertBefore(backdrop, block);
        syncActions();
        window.requestAnimationFrame(() => {
          if (!isFullscreen) return;
          const nextMode = mode;
          if (nextMode !== 'custom') applyFit(nextMode);
        });
        closeButton.focus({ preventScroll: true });
      };

      const onWrapperClick = (event: Event) => {
        if (!mobileQuery.matches || isFullscreen) return;
        const target = event.target as HTMLElement | null;
        if (
          !target ||
          target === wrapper ||
          target.closest('a, button, input, select, textarea, .table-resize')
        ) {
          return;
        }
        controlsOpen = !controlsOpen;
        syncActions();
      };
      wrapper.addEventListener('click', onWrapperClick, { signal });

      const onMobileLayoutChange = () => {
        controlsOpen = false;
        apply();
      };
      mobileQuery.addEventListener('change', onMobileLayoutChange);
      signal.addEventListener('abort', () => {
        mobileQuery.removeEventListener('change', onMobileLayoutChange);
      });

      actionButtons.fit.forEach((button) =>
        button.addEventListener('click', () => setMode('fit'), { signal }),
      );
      actionButtons.equal.forEach((button) =>
        button.addEventListener('click', () => setMode('equal'), { signal }),
      );
      actionButtons.reset.forEach((button) =>
        button.addEventListener('click', reset, { signal }),
      );
      actionButtons.fullscreen.forEach((button) =>
        button.addEventListener(
          'click',
          () => {
            if (isFullscreen) closeFullscreen();
            else openFullscreen();
          },
          { signal },
        ),
      );
      closeButton.addEventListener('click', () => closeFullscreen(), { signal });
      block.addEventListener(
        'soffia:close-table-fullscreen',
        () => closeFullscreen(false),
        { signal },
      );

      const onFullscreenKeyDown = (event: KeyboardEvent) => {
        if (
          event.key !== 'Escape' ||
          !isFullscreen ||
          event.defaultPrevented
        ) {
          return;
        }
        event.preventDefault();
        closeFullscreen();
      };
      window.addEventListener('keydown', onFullscreenKeyDown, { signal });

      const addColumnHandle = (
        header: HTMLTableCellElement,
        columnIndex: number,
      ) => {
        header.classList.add('table-has-resize');
        header
          .querySelectorAll(':scope > .table-resize--col')
          .forEach((node) => node.remove());
        const handle = document.createElement('span');
        handle.className = 'table-resize table-resize--col';
        handle.tabIndex = 0;
        handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-orientation', 'vertical');
        handle.setAttribute('aria-label', 'Cambiar ancho de columna');
        header.appendChild(handle);

        const minWidth = headerMinWidths[columnIndex] ?? 48;
        const start = (event: PointerEvent) => {
          event.preventDefault();
          mode = 'custom';
          syncActions();
          const startX = event.clientX;
          const startWidth = columns[columnIndex].getBoundingClientRect().width;
          const move = (moveEvent: PointerEvent) => {
            const width = Math.max(
              minWidth,
              startWidth + moveEvent.clientX - startX,
            );
            columns[columnIndex].style.width = `${width}px`;
            const total = columns.reduce(
              (sum, column) => sum + column.getBoundingClientRect().width,
              0,
            );
            table.style.minWidth = `${Math.ceil(total)}px`;
            scheduleOverflowSync();
          };
          const end = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', end);
            window.removeEventListener('pointercancel', end);
            persist();
          };
          window.addEventListener('pointermove', move, { signal });
          window.addEventListener('pointerup', end, { signal });
          window.addEventListener('pointercancel', end, { signal });
        };

        handle.addEventListener('pointerdown', start, { signal });
        handle.addEventListener(
          'keydown',
          (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
              return;
            }
            event.preventDefault();
            mode = 'custom';
            syncActions();
            const current = columns[columnIndex].getBoundingClientRect().width;
            columns[columnIndex].style.width = `${Math.max(
              minWidth,
              current + (event.key === 'ArrowRight' ? 8 : -8),
            )}px`;
            const total = columns.reduce(
              (sum, column) => sum + column.getBoundingClientRect().width,
              0,
            );
            table.style.minWidth = `${Math.ceil(total)}px`;
            scheduleOverflowSync();
            persist();
          },
          { signal },
        );
      };

      headers.forEach(addColumnHandle);

      rows.forEach((row) => {
        const firstCell = row.querySelector<HTMLTableCellElement>('td, th');
        if (!firstCell) return;
        firstCell.classList.add('table-has-resize-row');
        firstCell
          .querySelectorAll(':scope > .table-resize--row')
          .forEach((node) => node.remove());
        const handle = document.createElement('span');
        handle.className = 'table-resize table-resize--row';
        handle.tabIndex = 0;
        handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-orientation', 'horizontal');
        handle.setAttribute('aria-label', 'Cambiar alto de fila');
        firstCell.appendChild(handle);

        const start = (event: PointerEvent) => {
          event.preventDefault();
          isResizingRow = true;
          const startY = event.clientY;
          const startHeight = row.getBoundingClientRect().height;
          const move = (moveEvent: PointerEvent) => {
            row.style.height = `${Math.max(
              28,
              startHeight + moveEvent.clientY - startY,
            )}px`;
          };
          const end = () => {
            isResizingRow = false;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', end);
            window.removeEventListener('pointercancel', end);
            persist();
          };
          window.addEventListener('pointermove', move, { signal });
          window.addEventListener('pointerup', end, { signal });
          window.addEventListener('pointercancel', end, { signal });
        };

        handle.addEventListener('pointerdown', start, { signal });
        handle.addEventListener(
          'keydown',
          (event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            const current = row.getBoundingClientRect().height;
            row.style.height = `${Math.max(
              28,
              current + (event.key === 'ArrowDown' ? 8 : -8),
            )}px`;
            persist();
          },
          { signal },
        );
      });

      const resizeObserver =
        typeof ResizeObserver === 'undefined'
          ? null
          : new ResizeObserver(() => {
              scheduleOverflowSync();
              if (mode === 'custom' || isResizingRow) return;
              window.cancelAnimationFrame(resizeFrame);
              resizeFrame = window.requestAnimationFrame(() => {
                const nextMode = mode;
                if (nextMode !== 'custom' && !isResizingRow) {
                  applyFit(nextMode);
                }
              });
            });
      resizeObserver?.observe(wrapper);

      apply();

      signal.addEventListener('abort', () => {
        window.cancelAnimationFrame(resizeFrame);
        window.cancelAnimationFrame(overflowFrame);
        resizeObserver?.disconnect();
        closeFullscreen(false);
        backdrop?.remove();
        releaseBodyLock();
      });
    });

    return () => controller.abort();
  }, [deck?.id, html, settings.fontScale]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const onClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const copy = target?.closest<HTMLButtonElement>('.code-copy');
      if (copy) {
        const block = copy.closest('.code-block');
        const code = block?.querySelector('code')?.textContent ?? '';
        try {
          await navigator.clipboard.writeText(code);
          copy.textContent = 'Copiado';
          window.setTimeout(() => {
            copy.textContent = 'Copiar';
          }, 1800);
        } catch {
          toast('No se pudo copiar el código.', 'error');
        }
        return;
      }

      const anchor = target?.closest<HTMLAnchorElement>('a[href^="#"]');
      if (anchor) {
        const id = decodeURIComponent(anchor.getAttribute('href')?.slice(1) ?? '');
        const destination = id ? document.getElementById(id) : null;
        if (destination) {
          event.preventDefault();
          destination.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    node.addEventListener('click', onClick as unknown as EventListener);

    const onImageError = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      const holder = target.closest('.figure__button') ?? target;
      if (!holder.parentElement) return;

      const note = document.createElement('div');
      note.className = 'missing-image missing-image--inline';

      const text = document.createElement('span');
      const label = target.alt ? `: ${target.alt}` : '';
      text.textContent = `No se pudo cargar la imagen${label}.`;
      note.appendChild(text);

      if (isRemoteImage(target.src)) {
        const link = document.createElement('a');
        link.className = 'text-link';
        link.href = target.src;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Abrir original';
        note.appendChild(link);
      }

      holder.replaceWith(note);
    };

    node.addEventListener('error', onImageError, true);

    return () => {
      node.removeEventListener('click', onClick as unknown as EventListener);
      node.removeEventListener('error', onImageError, true);
    };
  }, [toast]);

  return (
    <div
      ref={ref}
      className={`prose${compact ? ' prose--compact' : ''}${
        className ? ` ${className}` : ''
      }`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function InlineMarkdown({
  source,
  className = '',
}: {
  source: string;
  className?: string;
}) {
  const { resolveSrc } = useDeck();
  const html = useMemo(
    () => renderInline(source, { resolveSrc }),
    [resolveSrc, source],
  );
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
