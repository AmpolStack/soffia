import { parse as parseYaml } from 'yaml';
import { normalizeMarkdown } from './normalize';
import {
  asString,
  asStringArray,
  domainOf,
  hashString,
  parseNumber,
  slugify,
  stripMarkdown,
  uniqueId,
  wordCount,
} from './utils';
import type {
  Block,
  CalloutBlock,
  CalloutVariant,
  DocMeta,
  Flashcard,
  FlashcardsBlock,
  GalleryBlock,
  ImageRef,
  ParseOptions,
  ParseWarning,
  QAItem,
  QABlock,
  QuizBlock,
  QuizOption,
  Reference,
  ReferencesBlock,
  SectionNode,
  SofiaDocument,
  Step,
  StepsBlock,
} from './types';

type Ctx = {
  warnings: ParseWarning[];
  usedIds: Set<string>;
};

type FrontmatterResult = {
  data: Record<string, unknown>;
  body: string;
  warning?: string;
};

const HEADING_RE = /^\s*(#{1,6})\s+(.+?)\s*$/;
const DIRECTIVE_OPEN_RE = /^\s*:::\s*([a-zA-Z][\w-]*)(?:\s*\{([^}]*)\})?\s*(.*)$/;
const DIRECTIVE_CLOSE_RE = /^\s*:::\s*$/;
const DIRECTIVE_ANY_RE = /^\s*:::\s*[a-zA-Z]/;
const FENCE_RE = /^\s*(```|~~~)/;
const IMAGE_LINE_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/;
const IMAGE_ANY_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/;

const CALLOUT_VARIANTS: CalloutVariant[] = [
  'why',
  'tip',
  'warning',
  'key',
  'info',
  'pearl',
  'quote',
];

const CALLOUT_TITLES: Record<CalloutVariant, string> = {
  why: '¿Por qué?',
  tip: 'Consejo',
  warning: 'Atención',
  key: 'Idea clave',
  info: 'Nota',
  pearl: 'Perla',
  quote: 'Cita',
};

export function parseDocument(
  raw: string,
  options: ParseOptions = {},
): SofiaDocument {
  const normalized = normalizeMarkdown(raw);
  const ctx: Ctx = { warnings: [], usedIds: new Set<string>() };
  const frontmatter = splitFrontmatter(normalized);

  if (frontmatter.warning) {
    ctx.warnings.push({
      message: frontmatter.warning,
      severity: 'warning',
    });
  }

  const body = frontmatter.body;
  const blocks = parseBlocks(body.split('\n'), ctx, 0);
  const firstH1 = blocks.find(
    (block): block is Extract<Block, { type: 'heading' }> =>
      block.type === 'heading' && block.level === 1,
  );

  const meta = buildMeta(
    frontmatter.data,
    firstH1?.text,
    body,
    options,
    ctx,
  );

  const withoutFirstH1 = firstH1
    ? blocks.filter((block) => block !== firstH1)
    : blocks;
  const { lead, sections } = buildSections(withoutFirstH1);

  if (sections.length === 0) {
    ctx.warnings.push({
      message:
        'No se encontraron secciones H2. El índice lateral quedará vacío; usa ## para las secciones.',
      severity: 'warning',
    });
  }

  const images = collectImages(lead, sections);
  const quizzes = collectBlocks(lead, sections, 'quiz') as QuizBlock[];
  const flashcards = collectBlocks(lead, sections, 'flashcards').flatMap(
    (block) => (block as FlashcardsBlock).cards,
  );
  const qa = collectBlocks(lead, sections, 'qa').flatMap(
    (block) => (block as QABlock).items,
  );
  const references = collectBlocks(lead, sections, 'references').flatMap(
    (block) => (block as ReferencesBlock).items,
  );

  return {
    meta,
    lead,
    sections,
    images,
    quizzes,
    flashcards,
    qa,
    references,
    wordCount: wordCount(body),
    warnings: ctx.warnings,
    raw: normalized,
  };
}

function buildMeta(
  data: Record<string, unknown>,
  headingTitle: string | undefined,
  body: string,
  options: ParseOptions,
  ctx: Ctx,
): DocMeta {
  const fallbackTitle =
    headingTitle ||
    options.sourceName?.replace(/\.(md|markdown|txt)$/i, '').replace(/[-_]+/g, ' ') ||
    'Documento sin título';

  const title = asString(data.title) || fallbackTitle;
  if (!asString(data.title) && !headingTitle) {
    ctx.warnings.push({
      message: 'El documento no tiene título en el frontmatter ni un H1.',
      severity: 'warning',
    });
  }

  const words = wordCount(body);
  const estimated =
    parseNumber(data.estimatedMinutes) || Math.max(1, Math.round(words / 200));

  const rawId = asString(data.id) ?? '';
  const id = rawId ? slugify(rawId) : slugify(title);
  if (rawId && rawId !== id) {
    ctx.warnings.push({
      message: `El id «${rawId}» no es válido para una ruta. Se usará «${id}»; escribe letras, números, guiones, puntos o guiones bajos.`,
      severity: 'warning',
    });
  }

  return {
    id,
    title,
    subtitle: asString(data.subtitle),
    description: asString(data.description),
    tags: asStringArray(data.tags),
    language: asString(data.language) || 'es',
    author: asString(data.author),
    cover: asString(data.cover),
    estimatedMinutes: estimated,
  };
}

function splitFrontmatter(input: string): FrontmatterResult {
  if (!input.startsWith('---\n')) {
    return { data: {}, body: input };
  }

  const match = input.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) {
    return { data: {}, body: input };
  }

  const yamlSource = match[1];
  const body = input.slice(match[0].length).replace(/^\n+/, '');

  try {
    const parsed = parseYaml(yamlSource);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        data: {},
        body,
        warning: 'El frontmatter no contiene un objeto YAML válido.',
      };
    }
    return { data: parsed as Record<string, unknown>, body };
  } catch (error) {
    return {
      data: {},
      body,
      warning: `No se pudo leer el frontmatter YAML: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

function parseBlocks(lines: string[], ctx: Ctx, offset: number): Block[] {
  const blocks: Block[] = [];
  let prose: string[] = [];
  let index = 0;

  const flushProse = () => {
    const source = prose.join('\n').trim();
    prose = [];
    if (!source) return;

    const images = imageOnlyLines(source);
    if (images.length === 1) {
      blocks.push({ type: 'image', image: images[0] });
      return;
    }
    if (images.length > 1) {
      blocks.push({ type: 'gallery', images, columns: 3 });
      return;
    }
    blocks.push({ type: 'markdown', source });
  };

  while (index < lines.length) {
    const line = lines[index];

    if (FENCE_RE.test(line)) {
      const fence = line.trim().slice(0, 3);
      prose.push(line);
      index += 1;
      while (index < lines.length) {
        const current = lines[index];
        prose.push(current);
        index += 1;
        if (current.trim().startsWith(fence)) break;
      }
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      flushProse();
      const level = Math.min(6, Math.max(1, heading[1].length)) as
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6;
      const { text, explicitId } = extractTrailingId(heading[2].trim());
      const baseId = explicitId || slugify(stripMarkdown(text));
      const id = uniqueId(baseId, ctx.usedIds);
      blocks.push({ type: 'heading', level, text, id });
      index += 1;
      continue;
    }

    if (DIRECTIVE_OPEN_RE.test(line)) {
      flushProse();
      const parsed = parseDirective(lines, index, ctx, offset);
      if (parsed) {
        blocks.push(parsed.block);
        index = parsed.next;
        continue;
      }
    }

    prose.push(line);
    index += 1;
  }

  flushProse();
  return blocks;
}

function parseDirective(
  lines: string[],
  start: number,
  ctx: Ctx,
  offset: number,
): { block: Block; next: number } | null {
  const open = lines[start].match(DIRECTIVE_OPEN_RE);
  if (!open) return null;

  const name = open[1].toLowerCase();
  const attrs = parseAttrs(open[2] || '');
  const inlineTitle = open[3]?.trim() || '';
  const inner: string[] = [];
  let depth = 1;
  let inFence = false;
  let index = start + 1;

  while (index < lines.length) {
    const line = lines[index];

    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      inner.push(line);
      index += 1;
      continue;
    }

    if (!inFence) {
      if (DIRECTIVE_CLOSE_RE.test(line)) {
        depth -= 1;
        if (depth === 0) {
          index += 1;
          break;
        }
        inner.push(line);
        index += 1;
        continue;
      }

      if (DIRECTIVE_ANY_RE.test(line)) {
        depth += 1;
        inner.push(line);
        index += 1;
        continue;
      }
    }

    inner.push(line);
    index += 1;
  }

  if (depth > 0) {
    ctx.warnings.push({
      message: `El bloque :::${name} no tiene cierre :::.`,
      line: offset + start + 1,
      severity: 'warning',
    });
  }

  const content = inner.join('\n').trim();
  const block = buildDirectiveBlock(name, attrs, inlineTitle, content, ctx, offset + start + 1);
  return { block, next: index };
}

function buildDirectiveBlock(
  name: string,
  attrs: Record<string, string>,
  inlineTitle: string,
  content: string,
  ctx: Ctx,
  line: number,
): Block {
  switch (name) {
    case 'callout':
    case 'note':
    case 'quote': {
      const requested = (attrs.type || attrs.variant || (name === 'quote' ? 'quote' : 'info')).toLowerCase();
      const variant = (CALLOUT_VARIANTS.includes(requested as CalloutVariant)
        ? requested
        : 'info') as CalloutVariant;
      const title =
        attrs.title ||
        inlineTitle ||
        (name === 'quote' ? undefined : CALLOUT_TITLES[variant]);
      return {
        type: 'callout',
        variant,
        title,
        collapsible: attrs.collapsible === 'true' || attrs.collapsible === '1',
        blocks: parseBlocks(content.split('\n'), ctx, line),
      } satisfies CalloutBlock;
    }

    case 'grid': {
      return {
        type: 'grid',
        columns: parseNumber(attrs.columns),
        blocks: parseBlocks(content.split('\n'), ctx, line),
      };
    }

    case 'steps':
      return parseSteps(content, ctx, line);

    case 'quiz':
      return parseQuiz(content, attrs, ctx, line);

    case 'flashcards':
      return parseCards(content, attrs, ctx, line, 'flashcards') as FlashcardsBlock;

    case 'qa':
      return parseCards(content, attrs, ctx, line, 'qa') as QABlock;

    case 'references':
      return parseReferences(content, ctx, line);

    case 'keypoints':
      return parseKeypoints(content, ctx, line);

    case 'gallery':
      return parseGallery(content, attrs, ctx, line);

    case 'figure':
      return parseFigure(content, attrs, ctx, line);

    default:
      ctx.warnings.push({
        message: `Bloque desconocido :::${name}. Se mostrará como contenido sin formato.`,
        line,
        severity: 'warning',
      });
      return { type: 'unknown', name, raw: content };
  }
}

function parseSteps(content: string, ctx: Ctx, line: number): StepsBlock {
  const chunks = splitByHeading(content, 3);
  const items: Step[] = [];

  if (chunks.length === 0) {
    items.push({
      title: '',
      blocks: parseBlocks(content.split('\n'), ctx, line),
    });
  } else {
    for (const chunk of chunks) {
      const title = chunk.title.replace(/^\d+[.)]\s*/, '').trim();
      items.push({
        title,
        blocks: parseBlocks(chunk.body.split('\n'), ctx, line + chunk.line),
      });
    }
  }

  return { type: 'steps', items };
}

/**
 * Quita la etiqueta inicial de un quiz sin tocar el énfasis que pueda tener
 * la propia pregunta. Admite `**Pregunta:**`, `**Pregunta**:`, `Pregunta:` y
 * `**Pregunta**`, que son las variantes que aparecen al copiar Markdown.
 */
function stripQuizLabel(source: string, label: string): string {
  const re = new RegExp(
    `^\\s*(?:\\*\\*)?${label}(?:\\s*:\\s*\\*\\*|\\*\\*\\s*:?|:|\\s+)\\s*`,
    'i',
  );
  return source.replace(re, '').trim();
}

function parseQuiz(
  content: string,
  attrs: Record<string, string>,
  ctx: Ctx,
  line: number,
): QuizBlock {
  const lines = content.split('\n');
  const optionLines: Array<{ index: number; correct: boolean; text: string }> = [];

  lines.forEach((raw, index) => {
    const match = raw.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$/);
    if (!match) return;
    optionLines.push({
      index,
      correct: match[1].toLowerCase() === 'x',
      text: match[2].trim(),
    });
  });

  const firstOption = optionLines[0]?.index ?? lines.length;
  const lastOption = optionLines[optionLines.length - 1]?.index ?? -1;
  let question = lines.slice(0, firstOption).join('\n').trim();
  let explanation = lines.slice(lastOption + 1).join('\n').trim();

  question = stripQuizLabel(question, 'Pregunta');
  explanation = explanation
    .replace(/^\s*(?:>\s*)+(?=(?:\*\*)?Explicaci[oó]n)/i, '')
    .trim();
  explanation = stripQuizLabel(explanation, 'Explicaci[oó]n').replace(
    /^\s*>\s?/gm,
    '',
  );

  if (optionLines.length === 0) {
    ctx.warnings.push({
      message: 'El quiz no tiene opciones con el formato "- [ ]" / "- [x]".',
      line,
      severity: 'error',
    });
  }

  if (optionLines.length > 0 && !optionLines.some((option) => option.correct)) {
    ctx.warnings.push({
      message: 'El quiz no tiene ninguna opción marcada como correcta con [x].',
      line,
      severity: 'error',
    });
  }

  const correctCount = optionLines.filter((option) => option.correct).length;
  const multiple = attrs.multiple === 'true' || correctCount > 1;
  const id = uniqueId(
    attrs.id || `quiz-${hashString(question + optionLines.map((o) => o.text).join('|'))}`,
    ctx.usedIds,
  );

  const options: QuizOption[] = optionLines.map((option, index) => ({
    id: String.fromCharCode(97 + index),
    text: option.text,
    correct: option.correct,
  }));

  return {
    type: 'quiz',
    id,
    question,
    options,
    multiple,
    explanation,
    difficulty: parseNumber(attrs.difficulty),
    tags: asStringArray(attrs.tags),
  };
}

function parseCards(
  content: string,
  attrs: Record<string, string>,
  ctx: Ctx,
  line: number,
  kind: 'flashcards' | 'qa',
): FlashcardsBlock | QABlock {
  const chunks = splitCards(content);
  const blockId = uniqueId(
    attrs.id || `${kind}-${hashString(content)}`,
    ctx.usedIds,
  );
  const cards: Flashcard[] = [];

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    let front = '';
    let back = '';
    let explicitId: string | undefined;

    const heading = trimmed.match(/^###\s+(.+?)\s*(?:\n|$)/);
    if (heading) {
      const parsed = extractTrailingId(heading[1].trim());
      front = parsed.text;
      explicitId = parsed.explicitId;
      back = trimmed.slice(heading[0].length).trim();
    } else if (trimmed.includes('||')) {
      const [left, ...rest] = trimmed.split('||');
      front = left.trim();
      back = rest.join('||').trim();
    } else {
      const [left, ...rest] = trimmed.split('\n');
      front = left.trim();
      back = rest.join('\n').trim();
    }

    if (!front) {
      ctx.warnings.push({
        message: `Una tarjeta de :::${kind} no tiene frente.`,
        line,
        severity: 'warning',
      });
      continue;
    }

    if (!back) {
      ctx.warnings.push({
        message: `La tarjeta "${stripMarkdown(front)}" no tiene reverso.`,
        line,
        severity: 'warning',
      });
    }

    const id = uniqueId(
      explicitId || `card-${hashString(front + back)}`,
      ctx.usedIds,
    );
    cards.push({ id, front, back });
  }

  if (cards.length === 0) {
    ctx.warnings.push({
      message: `El bloque :::${kind} no contiene tarjetas.`,
      line,
      severity: 'warning',
    });
  }

  if (kind === 'qa') {
    const items: QAItem[] = cards.map((card) => ({
      id: card.id,
      question: card.front,
      answer: card.back,
    }));
    return { type: 'qa', id: blockId, items };
  }

  return { type: 'flashcards', id: blockId, cards };
}

function parseReferences(content: string, ctx: Ctx, line: number): ReferencesBlock {
  const items: Reference[] = [];
  const rawLines = content.split('\n');
  let current: Reference | null = null;

  for (const raw of rawLines) {
    const item = raw.match(/^\s*(?:\d+\.|[-*+])\s+(.+)$/);
    if (item) {
      const text = item[1].trim();
      const link = text.match(LINK_RE);
      const title = link ? link[1].trim() : text;
      const url = link ? link[2].trim() : undefined;
      const rest = link ? text.replace(link[0], '').trim() : '';
      const note = rest.replace(/^[—–\-:·]\s*/, '').trim() || undefined;
      current = {
        id: uniqueId(`ref-${items.length + 1}`, ctx.usedIds),
        title,
        url,
        note,
        domain: domainOf(url),
      };
      items.push(current);
      continue;
    }

    if (raw.trim() && current) {
      current.note = [current.note, raw.trim()].filter(Boolean).join(' ');
    }
  }

  if (items.length === 0) {
    ctx.warnings.push({
      message: 'El bloque :::references no contiene una lista de referencias.',
      line,
      severity: 'warning',
    });
  }

  return { type: 'references', items };
}

function parseKeypoints(content: string, ctx: Ctx, line: number): Block {
  const items = content
    .split('\n')
    .map((raw) => raw.match(/^\s*(?:[-*+]|\d+\.)\s+(.+)$/)?.[1]?.trim())
    .filter((item): item is string => Boolean(item));

  if (items.length === 0) {
    ctx.warnings.push({
      message: 'El bloque :::keypoints no contiene una lista.',
      line,
      severity: 'warning',
    });
    return { type: 'unknown', name: 'keypoints', raw: content };
  }

  return { type: 'keypoints', items };
}

function parseGallery(
  content: string,
  attrs: Record<string, string>,
  ctx: Ctx,
  line: number,
): GalleryBlock {
  const images = extractImages(content);
  if (images.length === 0) {
    ctx.warnings.push({
      message: 'La galería no contiene imágenes.',
      line,
      severity: 'warning',
    });
  }

  return {
    type: 'gallery',
    images,
    columns: parseNumber(attrs.columns) || 3,
  };
}

function parseFigure(
  content: string,
  attrs: Record<string, string>,
  ctx: Ctx,
  line: number,
): Block {
  const fromContent = extractImages(content)[0];
  const src = attrs.src || fromContent?.src;
  if (!src) {
    ctx.warnings.push({
      message: 'El bloque :::figure no tiene src ni una imagen dentro.',
      line,
      severity: 'warning',
    });
    return { type: 'unknown', name: 'figure', raw: content };
  }

  const image: ImageRef = {
    src,
    alt: attrs.alt || fromContent?.alt || '',
    caption: attrs.caption || fromContent?.caption,
    credit: attrs.credit || fromContent?.credit,
    href: attrs.href || fromContent?.href,
  };

  return { type: 'image', image };
}

function parseAttrs(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(input))) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? 'true';
    attrs[key] = value;
  }

  return attrs;
}

function extractTrailingId(value: string): { text: string; explicitId?: string } {
  const match = value.match(/^(.*?)\s*\{#([\w-]+)\}\s*$/);
  if (!match) return { text: value };
  return { text: match[1].trim(), explicitId: match[2] };
}

function imageOnlyLines(source: string): ImageRef[] {
  const lines = source
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const images: ImageRef[] = [];
  for (const line of lines) {
    const match = line.match(IMAGE_LINE_RE);
    if (!match) return [];
    images.push({
      src: match[2],
      alt: stripImagePrefix(match[1]),
      caption: match[3] || undefined,
    });
  }
  return images;
}

export function extractImages(markdown: string): ImageRef[] {
  const images: ImageRef[] = [];
  IMAGE_ANY_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = IMAGE_ANY_RE.exec(markdown))) {
    images.push({
      src: match[2],
      alt: stripImagePrefix(match[1]),
      caption: match[3] || undefined,
    });
  }

  return images;
}

function stripImagePrefix(value: string): string {
  return value.replace(/^image:\s*/i, '').trim();
}

function splitByHeading(
  content: string,
  level: number,
): Array<{ title: string; body: string; line: number }> {
  const lines = content.split('\n');
  const chunks: Array<{ title: string; body: string[]; line: number }> = [];
  let current: { title: string; body: string[]; line: number } | null = null;
  let inFence = false;
  const headingRe = new RegExp(`^\\s*#{${level}}\\s+(.+?)\\s*$`);

  lines.forEach((line, index) => {
    if (FENCE_RE.test(line)) inFence = !inFence;
    const match = !inFence ? line.match(headingRe) : null;
    if (match) {
      if (current) chunks.push(current);
      current = { title: match[1], body: [], line: index + 1 };
      return;
    }
    if (current) current.body.push(line);
  });

  if (current) chunks.push(current);
  return chunks.map((chunk) => ({
    title: chunk.title,
    body: chunk.body.join('\n').trim(),
    line: chunk.line,
  }));
}

function splitCards(content: string): string[] {
  const lines = content.split('\n');
  const chunks: string[][] = [[]];
  let inFence = false;

  for (const line of lines) {
    if (FENCE_RE.test(line)) inFence = !inFence;
    if (!inFence && /^\s*---\s*$/.test(line)) {
      chunks.push([]);
      continue;
    }
    chunks[chunks.length - 1].push(line);
  }

  return chunks.map((chunk) => chunk.join('\n'));
}

function buildSections(blocks: Block[]): {
  lead: Block[];
  sections: SectionNode[];
} {
  const lead: Block[] = [];
  const sections: SectionNode[] = [];
  let currentSection: SectionNode | null = null;
  let currentSub: SectionNode | null = null;

  for (const block of blocks) {
    if (block.type === 'heading' && (block.level === 2 || block.level === 1)) {
      currentSection = {
        id: block.id,
        level: 2,
        title: block.text,
        blocks: [],
        children: [],
      };
      sections.push(currentSection);
      currentSub = null;
      continue;
    }

    if (block.type === 'heading' && block.level === 3) {
      if (currentSection) {
        currentSub = {
          id: block.id,
          level: 3,
          title: block.text,
          blocks: [],
          children: [],
        };
        currentSection.children.push(currentSub);
      } else {
        lead.push(block);
      }
      continue;
    }

    if (currentSub) {
      currentSub.blocks.push(block);
    } else if (currentSection) {
      currentSection.blocks.push(block);
    } else {
      lead.push(block);
    }
  }

  return { lead, sections };
}

function collectImages(lead: Block[], sections: SectionNode[]): ImageRef[] {
  const images: ImageRef[] = [];
  const seen = new Set<string>();

  const add = (image: ImageRef) => {
    if (!image.src || seen.has(image.src)) return;
    seen.add(image.src);
    images.push(image);
  };

  const visit = (block: Block) => {
    if (block.type === 'image') add(block.image);
    if (block.type === 'gallery') block.images.forEach(add);
    if (block.type === 'markdown') extractImages(block.source).forEach(add);
    if (block.type === 'callout') block.blocks.forEach(visit);
    if (block.type === 'grid') block.blocks.forEach(visit);
    if (block.type === 'steps') block.items.forEach((item) => item.blocks.forEach(visit));
    if (block.type === 'quiz') {
      extractImages(block.question).forEach(add);
      extractImages(block.explanation).forEach(add);
    }
    if (block.type === 'flashcards') {
      block.cards.forEach((card) => {
        extractImages(card.front).forEach(add);
        extractImages(card.back).forEach(add);
      });
    }
    if (block.type === 'qa') {
      block.items.forEach((item) => {
        extractImages(item.question).forEach(add);
        extractImages(item.answer).forEach(add);
      });
    }
  };

  lead.forEach(visit);
  const visitSection = (section: SectionNode) => {
    section.blocks.forEach(visit);
    section.children.forEach(visitSection);
  };
  sections.forEach(visitSection);
  return images;
}

function collectBlocks(
  lead: Block[],
  sections: SectionNode[],
  type: 'quiz' | 'flashcards' | 'qa' | 'references',
): Block[] {
  const result: Block[] = [];

  const visit = (block: Block) => {
    if (block.type === type) result.push(block);
    if (block.type === 'callout') block.blocks.forEach(visit);
    if (block.type === 'grid') block.blocks.forEach(visit);
    if (block.type === 'steps') block.items.forEach((item) => item.blocks.forEach(visit));
  };

  lead.forEach(visit);
  const visitSection = (section: SectionNode) => {
    section.blocks.forEach(visit);
    section.children.forEach(visitSection);
  };
  sections.forEach(visitSection);
  return result;
}
