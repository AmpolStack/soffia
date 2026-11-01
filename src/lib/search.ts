import type {
  Block,
  SectionNode,
  SofiaDocument,
} from './format/types';
import { stripMarkdown } from './format/utils';

export type SearchResult = {
  anchorId: string;
  sectionId: string;
  title: string;
  snippet: string;
  score: number;
};

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function blockText(block: Block): string {
  switch (block.type) {
    case 'heading':
      return block.text;
    case 'markdown':
      return stripMarkdown(block.source);
    case 'image':
      return [block.image.alt, block.image.caption].filter(Boolean).join(' ');
    case 'gallery':
      return block.images
        .map((image) => [image.alt, image.caption].filter(Boolean).join(' '))
        .join(' ');
    case 'callout':
      return [block.title ?? '', ...block.blocks.map(blockText)].join(' ');
    case 'steps':
      return block.items
        .map((item) => [item.title, ...item.blocks.map(blockText)].join(' '))
        .join(' ');
    case 'quiz':
      return [
        block.question,
        ...block.options.map((option) => option.text),
        block.explanation,
      ].join(' ');
    case 'flashcards':
      return block.cards
        .map((card) => `${card.front} ${card.back}`)
        .join(' ');
    case 'qa':
      return block.items
        .map((item) => `${item.question} ${item.answer}`)
        .join(' ');
    case 'references':
      return block.items
        .map((item) => [item.title, item.note, item.url].filter(Boolean).join(' '))
        .join(' ');
    case 'keypoints':
      return block.items.join(' ');
    case 'grid':
      return block.blocks.map(blockText).join(' ');
    case 'unknown':
      return stripMarkdown(block.raw);
    default:
      return '';
  }
}

function sectionText(section: SectionNode): string {
  return [
    section.title,
    ...section.blocks.map(blockText),
    ...section.children.map(sectionText),
  ].join(' ');
}

function makeSnippet(text: string, query: string): string {
  const haystack = normalize(text);
  const needle = normalize(query);
  const index = haystack.indexOf(needle);
  if (index === -1) return text.slice(0, 160).trim();

  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + query.length + 90);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
}

export function searchDocument(
  document: SofiaDocument,
  query: string,
): SearchResult[] {
  const clean = query.trim();
  if (clean.length < 2) return [];
  const needle = normalize(clean);
  const results: SearchResult[] = [];

  const leadText = document.lead.map(blockText).join(' ');
  if (leadText) {
    const haystack = normalize(leadText);
    if (haystack.includes(needle)) {
      results.push({
        anchorId: 'inicio',
        sectionId: 'inicio',
        title: 'Introducción',
        snippet: makeSnippet(leadText, clean),
        score: 2,
      });
    }
  }

  for (const section of document.sections) {
    const ownText = sectionText({
      ...section,
      children: [],
    });
    const ownHaystack = normalize(ownText);
    if (ownHaystack.includes(needle)) {
      const titleMatch = normalize(section.title).includes(needle);
      results.push({
        anchorId: section.id,
        sectionId: section.id,
        title: section.title,
        snippet: makeSnippet(ownText, clean),
        score: titleMatch ? 10 : 4,
      });
    }

    for (const child of section.children) {
      const childText = sectionText({ ...child, children: [] });
      const childHaystack = normalize(childText);
      if (!childHaystack.includes(needle)) continue;
      const titleMatch = normalize(child.title).includes(needle);
      results.push({
        anchorId: child.id,
        sectionId: section.id,
        title: `${section.title} › ${child.title}`,
        snippet: makeSnippet(childText, clean),
        score: titleMatch ? 8 : 3,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 40);
}
