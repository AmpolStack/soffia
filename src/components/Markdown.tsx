import { useEffect, useMemo, useRef, type MouseEvent } from 'react';
import { renderInline, renderMarkdown } from '../lib/format/renderMarkdown';
import { useDeck } from '../contexts/DeckContext';
import { useToast } from '../contexts/ToastContext';
import { isRemoteImage } from '../lib/images';
import { hashString } from '../lib/format/utils';

function headerMinWidth(header: HTMLTableCellElement): number {
  const style = window.getComputedStyle(header);
  const probe = document.createElement('span');
  probe.textContent = header.textContent ?? '';
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
  const contentWidth = probe.getBoundingClientRect().width;
  probe.remove();
  const padding =
    Number.parseFloat(style.paddingLeft || '0') +
    Number.parseFloat(style.paddingRight || '0');
  return Math.max(56, Math.min(260, Math.ceil(contentWidth + padding + 2)));
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

      const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'));
      const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr'));
      if (headers.length === 0) return;
      const headerMinWidths = headers.map(headerMinWidth);

      const tableKey = hashString(
        `${deckId}|${index}|${table.textContent ?? ''}`,
      );
      const storageKey = `soffia:table-layout:${deckId}:${tableKey}`;
      table.dataset.tableKey = tableKey;
      table.style.tableLayout = 'fixed';
      table.style.width = '100%';
      wrapper.classList.add('table-resizable');

      // El botón de restablecer vive fuera del contenedor con scroll y borde
      // de la tabla: así no altera su gap ni su margen interior.
      let block = wrapper.parentElement;
      if (!block?.classList.contains('table-block')) {
        block = document.createElement('div');
        block.className = 'table-block';
        wrapper.parentElement?.insertBefore(block, wrapper);
        block.appendChild(wrapper);
      }
      block.querySelector(':scope > .table-actions')?.remove();

      // Se recrea el colgroup para no arrastrar anchos de una vista anterior.
      table.querySelector('colgroup')?.remove();
      const colgroup = document.createElement('colgroup');
      headers.forEach(() => colgroup.appendChild(document.createElement('col')));
      table.prepend(colgroup);
      const columns = Array.from(colgroup.querySelectorAll<HTMLTableColElement>('col'));

      let saved: { columns?: number[]; rows?: number[] } | null = null;
      try {
        saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      } catch {
        saved = null;
      }

      const apply = () => {
        columns.forEach((column, columnIndex) => {
          const width = saved?.columns?.[columnIndex];
          if (width) column.style.width = `${width}px`;
        });
        rows.forEach((row, rowIndex) => {
          const height = saved?.rows?.[rowIndex];
          if (height) row.style.height = `${height}px`;
        });
        if (saved?.rows?.length) table.style.tableLayout = 'fixed';
      };
      apply();

      const persist = () => {
        const layout = {
          columns: columns.map((column) => Math.round(column.getBoundingClientRect().width)),
          rows: rows.map((row) => Math.round(row.getBoundingClientRect().height)),
        };
        try {
          localStorage.setItem(storageKey, JSON.stringify(layout));
        } catch {
          // Sin localStorage: el cambio se mantiene en esta vista.
        }
      };

      const reset = (event: Event) => {
        event.stopPropagation();
        saved = null;
        columns.forEach((column) => { column.style.width = ''; });
        rows.forEach((row) => { row.style.height = ''; });
        try { localStorage.removeItem(storageKey); } catch { /* noop */ }
      };

      const actions = document.createElement('div');
      actions.className = 'table-actions';
      const resetButton = document.createElement('button');
      resetButton.type = 'button';
      resetButton.className = 'table-reset';
      resetButton.textContent = 'Restablecer tabla';
      resetButton.addEventListener('click', reset);
      actions.appendChild(resetButton);
      block.appendChild(actions);

      const addColumnHandle = (header: HTMLTableCellElement, columnIndex: number) => {
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
          const startX = event.clientX;
          const startWidth = columns[columnIndex].getBoundingClientRect().width;
          const move = (moveEvent: PointerEvent) => {
            const width = Math.max(minWidth, startWidth + moveEvent.clientX - startX);
            columns[columnIndex].style.width = `${width}px`;
          };
          const end = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', end);
            persist();
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', end, { once: true });
        };

        handle.addEventListener('pointerdown', start);
        handle.addEventListener('keydown', (event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const current = columns[columnIndex].getBoundingClientRect().width;
          columns[columnIndex].style.width = `${Math.max(
            minWidth,
            current + (event.key === 'ArrowRight' ? 8 : -8),
          )}px`;
          persist();
        });
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
          const startY = event.clientY;
          const startHeight = row.getBoundingClientRect().height;
          const move = (moveEvent: PointerEvent) => {
            row.style.height = `${Math.max(28, startHeight + moveEvent.clientY - startY)}px`;
          };
          const end = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', end);
            persist();
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', end, { once: true });
        };

        handle.addEventListener('pointerdown', start);
        handle.addEventListener('keydown', (event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          const current = row.getBoundingClientRect().height;
          row.style.height = `${Math.max(28, current + (event.key === 'ArrowDown' ? 8 : -8))}px`;
          persist();
        });
      });

      // Aborta los listeners base si el componente se desmonta.
      signal.addEventListener('abort', () => {
        resetButton.removeEventListener('click', reset);
      });
    });

    return () => controller.abort();
  }, [deck?.id, html]);

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
