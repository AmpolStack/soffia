export type StoredHighlight = {
  id: string;
  quote: string;
  prefix: string;
  suffix: string;
  createdAt: number;
};

export type LocatedHighlight = {
  start: number;
  end: number;
  score: number;
};

type TextRun = {
  node: Text;
  start: number;
};

const CONTEXT_LENGTH = 40;
const MAX_HIGHLIGHTS = 500;

function storageKey(deckId: string): string {
  return `soffia:highlights:${deckId}`;
}

function isHighlight(value: unknown): value is StoredHighlight {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StoredHighlight>;
  return (
    typeof item.id === 'string' &&
    Boolean(item.id) &&
    typeof item.quote === 'string' &&
    Boolean(item.quote.trim()) &&
    typeof item.prefix === 'string' &&
    typeof item.suffix === 'string' &&
    typeof item.createdAt === 'number'
  );
}

export function loadHighlights(deckId: string): StoredHighlight[] {
  try {
    const raw = localStorage.getItem(storageKey(deckId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter(isHighlight).filter((highlight) => {
      if (seen.has(highlight.id)) return false;
      seen.add(highlight.id);
      return true;
    });
  } catch {
    return [];
  }
}

export function saveHighlights(
  deckId: string,
  highlights: StoredHighlight[],
): void {
  try {
    localStorage.setItem(
      storageKey(deckId),
      JSON.stringify(highlights.slice(-MAX_HIGHLIGHTS)),
    );
  } catch {
    // Sin localStorage el resaltado sigue visible durante la sesión.
  }
}

export function createHighlightId(): string {
  return `h-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function collectTextRuns(root: HTMLElement): {
  runs: TextRun[];
  text: string;
} {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const runs: TextRun[] = [];
  let text = '';
  let current = walker.nextNode();
  while (current) {
    const value = (current as Text).data;
    if (value) {
      runs.push({ node: current as Text, start: text.length });
      text += value;
    }
    current = walker.nextNode();
  }
  return { runs, text };
}

export function normalizeHighlightRoot(node: Node | null): HTMLElement | null {
  if (!node) return null;
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  return element?.closest<HTMLElement>('[data-highlight-root]') ?? null;
}

export function commonHighlightRoot(range: Range): HTMLElement | null {
  const start = normalizeHighlightRoot(range.startContainer);
  const end = normalizeHighlightRoot(range.endContainer);
  if (!start || start !== end) return null;
  return start;
}

export function locateHighlight(
  root: HTMLElement,
  highlight: Pick<StoredHighlight, 'quote' | 'prefix' | 'suffix'>,
): LocatedHighlight | null {
  const { text } = collectTextRuns(root);
  if (!highlight.quote) return null;

  let best: LocatedHighlight | null = null;
  let from = 0;
  while (from < text.length) {
    const index = text.indexOf(highlight.quote, from);
    if (index === -1) break;

    const before = highlight.prefix
      ? text.slice(Math.max(0, index - highlight.prefix.length), index)
      : '';
    const after = highlight.suffix
      ? text.slice(
          index + highlight.quote.length,
          index + highlight.quote.length + highlight.suffix.length,
        )
      : '';

    let score = 0;
    if (highlight.prefix && before.endsWith(highlight.prefix)) score += 2;
    if (highlight.suffix && after.startsWith(highlight.suffix)) score += 2;
    if (highlight.prefix && !highlight.suffix && before === highlight.prefix) {
      score += 1;
    }
    if (highlight.suffix && !highlight.prefix && after === highlight.suffix) {
      score += 1;
    }

    if (!best || score > best.score) {
      best = {
        start: index,
        end: index + highlight.quote.length,
        score,
      };
    }
    from = index + 1;
  }

  // Con contexto guardado, una coincidencia sin contexto fiable está en otro
  // lugar del documento: es mejor no resaltar que resaltar la frase equivocada.
  if (best && (highlight.prefix || highlight.suffix) && best.score === 0) {
    return null;
  }

  return best;
}

export function createHighlightFromRange(
  root: HTMLElement,
  range: Range,
): StoredHighlight | null {
  const quote = range.toString();
  if (!quote.trim()) return null;

  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);

  const after = document.createRange();
  after.selectNodeContents(root);
  after.setStart(range.endContainer, range.endOffset);

  return {
    id: createHighlightId(),
    quote,
    prefix: before.toString().slice(-CONTEXT_LENGTH),
    suffix: after.toString().slice(0, CONTEXT_LENGTH),
    createdAt: Date.now(),
  };
}

function unwrapMark(mark: Element): void {
  const parent = mark.parentNode;
  if (!parent) return;
  while (mark.firstChild) {
    parent.insertBefore(mark.firstChild, mark);
  }
  parent.removeChild(mark);
  parent.normalize();
}

export function removeHighlightMarks(root: ParentNode, id: string): number {
  const marks = Array.from(
    root.querySelectorAll<HTMLElement>('mark.user-highlight'),
  ).filter((mark) => mark.dataset.highlightId === id);
  marks.forEach(unwrapMark);
  return marks.length;
}

export function selectionOverlappingIds(
  root: HTMLElement,
  range: Range,
): string[] {
  const ids = new Set<string>();
  root.querySelectorAll<HTMLElement>('mark.user-highlight').forEach((mark) => {
    if (!range.intersectsNode(mark)) return;
    const id = mark.dataset.highlightId;
    if (id) ids.add(id);
  });
  return Array.from(ids);
}

export function applyHighlight(
  root: HTMLElement,
  highlight: StoredHighlight,
): boolean {
  const located = locateHighlight(root, highlight);
  if (!located) return false;

  const { runs } = collectTextRuns(root);
  const segments: Array<{ node: Text; from: number; to: number; start: number }> =
    [];
  for (const run of runs) {
    const runEnd = run.start + run.node.data.length;
    const from = Math.max(located.start, run.start);
    const to = Math.min(located.end, runEnd);
    if (from < to) {
      segments.push({
        node: run.node,
        from: from - run.start,
        to: to - run.start,
        start: from,
      });
    }
  }

  // Se envuelve de atrás hacia delante para que los desplazamientos de los
  // segmentos anteriores sigan siendo válidos cuando se parte un nodo de texto.
  segments.sort((a, b) => b.start - a.start);

  let applied = false;
  for (const segment of segments) {
    if (segment.node.parentElement?.closest('mark.user-highlight')) continue;
    const range = document.createRange();
    range.setStart(segment.node, segment.from);
    range.setEnd(segment.node, segment.to);
    const mark = document.createElement('mark');
    mark.className = 'user-highlight';
    mark.dataset.highlightId = highlight.id;
    try {
      range.surroundContents(mark);
      applied = true;
    } catch {
      // Un rango que cruza un elemento no se puede envolver; se intenta con
      // los segmentos restantes.
    }
  }
  return applied;
}
