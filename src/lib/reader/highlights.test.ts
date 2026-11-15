// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyHighlight,
  createHighlightFromRange,
  loadHighlights,
  locateHighlight,
  removeHighlightMarks,
  saveHighlights,
  selectionOverlappingIds,
  type StoredHighlight,
} from './highlights';

function setup(html: string) {
  document.body.innerHTML = `<div data-highlight-root>${html}</div>`;
  return document.querySelector<HTMLElement>('[data-highlight-root]')!;
}

function select(root: HTMLElement, quote: string): Range {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let text = '';
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    text += (current as Text).data;
    current = walker.nextNode();
  }

  const start = text.indexOf(quote);
  const end = start + quote.length;
  let startNode = nodes[0];
  let endNode = nodes[0];
  let startOffset = 0;
  let endOffset = 0;
  let offset = 0;

  for (const node of nodes) {
    if (start >= offset && start <= offset + node.data.length) {
      startNode = node;
      startOffset = start - offset;
    }
    if (end >= offset && end <= offset + node.data.length) {
      endNode = node;
      endOffset = end - offset;
    }
    offset += node.data.length;
  }

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

describe('resaltados de usuario', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('crea un resaltado con contexto y lo localiza de nuevo', () => {
    const root = setup('Una idea clave y otra idea clave al final.');
    const range = select(root, 'idea clave');
    const highlight = createHighlightFromRange(root, range);

    expect(highlight?.quote).toBe('idea clave');
    expect(highlight?.prefix).toContain('Una ');
    expect(highlight?.suffix).toContain(' y otra');

    const located = locateHighlight(root, highlight!);
    expect(located?.start).toBe(4);
  });

  it('prefiere la aparición cuyo contexto coincide', () => {
    const root = setup('Primera idea. Segunda idea.');
    const quote = 'idea';
    const second = root.textContent!.lastIndexOf(quote);
    const highlight: StoredHighlight = {
      id: 'h-test',
      quote,
      prefix: 'Segunda ',
      suffix: '.',
      createdAt: 1,
    };
    expect(locateHighlight(root, highlight)?.start).toBe(second);
  });

  it('no reaplica una cita cuyo contexto ya no coincide', () => {
    const root = setup('Texto nuevo con idea repetida y otra idea repetida.');
    const highlight: StoredHighlight = {
      id: 'h-test',
      quote: 'idea repetida',
      prefix: 'Contexto que ya no existe ',
      suffix: ' tampoco',
      createdAt: 1,
    };
    expect(locateHighlight(root, highlight)).toBeNull();
  });

  it('envuelve el texto en un mark y lo puede quitar', () => {
    const root = setup('Texto importante aquí.');
    const highlight = createHighlightFromRange(root, select(root, 'importante'))!;

    expect(applyHighlight(root, highlight)).toBe(true);
    const mark = root.querySelector<HTMLElement>('mark.user-highlight');
    expect(mark?.textContent).toBe('importante');
    expect(mark?.dataset.highlightId).toBe(highlight.id);

    expect(removeHighlightMarks(root, highlight.id)).toBe(1);
    expect(root.querySelector('mark.user-highlight')).toBeNull();
    expect(root.textContent).toBe('Texto importante aquí.');
  });

  it('detecta los resaltados que toca la selección', () => {
    const root = setup('Texto importante aquí.');
    const highlight = createHighlightFromRange(root, select(root, 'importante'))!;
    applyHighlight(root, highlight);

    const range = select(root, 'Texto importante');
    expect(selectionOverlappingIds(root, range)).toEqual([highlight.id]);
  });

  it('guarda y carga los resaltados por deck', () => {
    const highlight: StoredHighlight = {
      id: 'h-1',
      quote: 'texto',
      prefix: '',
      suffix: '',
      createdAt: 1,
    };
    saveHighlights('deck-a', [highlight]);
    expect(loadHighlights('deck-a')).toEqual([highlight]);
    expect(loadHighlights('deck-b')).toEqual([]);
  });
});
