#!/usr/bin/env node
/**
 * soffia validate
 * Validador sin dependencias para decks Markdown de soffia.
 *
 * Uso:
 *   node validate.mjs <archivo-o-carpeta...>
 *
 * No necesita node_modules. Está pensado para funcionar también cuando la
 * skill se copia a ~/.config/opencode/skills/soffia.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';

const VERSION = '1.2.0';

const MARKDOWN_RE = /\.(md|markdown|txt)$/i;
const HEADING_RE = /^\s*(#{1,6})\s+(.+?)\s*$/;
const DIRECTIVE_OPEN_RE = /^\s*:::\s*([a-zA-Z][\w-]*)(?:\s*\{([^}]*)\})?\s*(.*)$/;
const DIRECTIVE_CLOSE_RE = /^\s*:::\s*$/;
const FENCE_RE = /^\s*(```+|~~~+)/;
const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/;
const LIST_RE = /^\s*(?:[-*+]|\d+\.)\s+(.+)$/;
const CARD_SEPARATOR_RE = /^\s*---\s*$/;
const QUIZ_OPTION_RE = /^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$/;
// Detecta etiquetas HTML reales sin confundirlas con autolinks <https://...>.
const HTML_RE = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/;

const DIRECTIVES = new Set([
  'callout',
  'note',
  'quote',
  'grid',
  'steps',
  'quiz',
  'flashcards',
  'qa',
  'references',
  'keypoints',
  'gallery',
  'figure',
]);

const CALLOUT_VARIANTS = new Set([
  'why',
  'tip',
  'warning',
  'key',
  'info',
  'pearl',
  'quote',
]);

const NESTING_ALLOWED = new Set(['callout', 'note', 'quote', 'grid', 'steps']);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_ID_RE = /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,63}$/u;
const RESERVED_IDS = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
]);

function isSafeDeckId(id) {
  if (!SAFE_ID_RE.test(id) || id.includes('..') || id.endsWith('.')) return false;
  return !RESERVED_IDS.has(id.split('.')[0].toLowerCase());
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const options = {
    strict: false,
    json: false,
    allowPlain: false,
    noAssets: false,
    quiet: false,
    help: false,
    version: false,
    inputs: [],
  };

  for (const arg of argv) {
    if (arg === '--strict') options.strict = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--allow-plain') options.allowPlain = true;
    else if (arg === '--no-assets') options.noAssets = true;
    else if (arg === '--quiet' || arg === '-q') options.quiet = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--version' || arg === '-v') options.version = true;
    else if (arg.startsWith('-')) {
      throw new Error(`Opción desconocida: ${arg}`);
    } else {
      options.inputs.push(arg);
    }
  }

  return options;
}

function printHelp() {
  console.log(`soffia validate ${VERSION}

Valida decks Markdown de soffia sin instalar dependencias.

Uso:
  node validate.mjs [opciones] <archivo-o-carpeta...>

Opciones:
  --strict        Trata los avisos como errores (útil en CI).
  --json          Imprime un informe JSON.
  --allow-plain   Permite Markdown sin frontmatter.
  --no-assets     No comprueba que existan las imágenes locales.
  --quiet, -q     Solo muestra errores y el resumen.
  --help, -h      Muestra esta ayuda.
  --version, -v   Muestra la versión.

Ejemplos:
  node validate.mjs seminario.md
  node validate.mjs ejemplos/
  node validate.mjs --strict --json ejemplos/

Códigos de salida:
  0  Sin errores (o solo avisos sin --strict).
  1  Hay errores, avisos con --strict o no se encontraron archivos.
  2  Error de uso.
`);
}

// ---------------------------------------------------------------------------
// Entrada de archivos
// ---------------------------------------------------------------------------

function collectFiles(inputs) {
  const files = [];
  const seen = new Set();

  const add = (file) => {
    const key = resolve(file).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    files.push(resolve(file));
  };

  const walk = (directory) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      throw new Error(
        `No se pudo leer la carpeta ${directory}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    for (const entry of entries) {
      if (
        entry.name.startsWith('.') ||
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'dist-single'
      ) {
        continue;
      }
      const full = join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && MARKDOWN_RE.test(entry.name)) add(full);
    }
  };

  for (const input of inputs) {
    const absolute = resolve(process.cwd(), input);
    if (!existsSync(absolute)) {
      throw new Error(`No existe: ${input}`);
    }
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      walk(absolute);
    } else if (stats.isFile()) {
      if (!MARKDOWN_RE.test(absolute)) {
        throw new Error(
          `El archivo no parece Markdown (.md, .markdown o .txt): ${input}`,
        );
      }
      add(absolute);
    } else {
      throw new Error(`No es un archivo ni una carpeta: ${input}`);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Utilidades de texto y Markdown
// ---------------------------------------------------------------------------

const IMAGE_EXTENSION = /\.(avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
const IMAGE_HOST =
  /(^|\.)((images?|img|cdn|static|media)\.)|images\.openai\.com|images\.unsplash\.com|cloudinary\.com|imgur\.com/i;

function looksLikeImageUrl(url) {
  const clean = url.trim();
  if (!clean) return false;
  if (clean.startsWith('data:image/')) return true;
  if (IMAGE_EXTENSION.test(clean)) return true;
  return IMAGE_HOST.test(clean);
}

function normalizeMarkdown(input) {
  let text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
  text = text.replace(/&#x20;/gi, ' ');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/【[^】]*】/g, '');

  text = text.replace(/^(\s*)(\d+)\\\.\s+/gm, '$1$2. ');

  text = text.replace(
    /\[Image:\s*([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/gi,
    (_match, caption, url, title) =>
      `![${String(caption).trim()}](${url}${title ? ` "${title}"` : ''})`,
  );

  text = text.replace(
    /\[image\]\(https?:\/\/www\.google\.com\/s2\/favicons[^)]*\)/gi,
    '',
  );

  text = text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      const onlyLink = trimmed.match(
        /^\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/,
      );
      if (!onlyLink) return line;
      const [, label, url, title] = onlyLink;
      if (!looksLikeImageUrl(url)) return line;
      return `![${label}](${url}${title ? ` "${title}"` : ''})`;
    })
    .join('\n');

  text = text.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (match, label, url) => {
      if (!looksLikeImageUrl(url)) return match;
      if (/^!\[/.test(match)) return match;
      return `![${label}](${url})`;
    },
  );

  text = text.replace(/[ \t]+$/gm, '');
  text = text.replace(/\n{4,}/g, '\n\n\n');
  return `${text.trim()}\n`;
}

function slugify(value) {
  return (
    String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'seccion'
  );
}

function stripMarkdown(value) {
  return String(value)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~>#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(body) {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*:::[^\n]*$/gm, ' ')
    .replace(/[#>*_~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(' ').length : 0;
}

function joinEntries(entries) {
  return entries.map((entry) => entry.text).join('\n').trim();
}

function trimEntries(entries) {
  let start = 0;
  let end = entries.length;
  while (start < end && !entries[start].text.trim()) start += 1;
  while (end > start && !entries[end - 1].text.trim()) end -= 1;
  return entries.slice(start, end);
}

function firstNonEmpty(entries) {
  return entries.find((entry) => entry.text.trim());
}

function extractTrailingId(value) {
  const match = String(value).match(/^(.*?)\s*\{#([\w-]+)\}\s*$/);
  if (!match) return { text: String(value).trim() };
  return { text: match[1].trim(), explicitId: match[2] };
}

function parseAttrs(input) {
  const attrs = {};
  const re = /([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g;
  let match;
  while ((match = re.exec(input))) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? 'true';
  }
  return attrs;
}

function extractImagesFromText(text) {
  const images = [];
  IMAGE_RE.lastIndex = 0;
  let match;
  while ((match = IMAGE_RE.exec(text))) {
    images.push({
      src: match[2],
      alt: match[1] || '',
      caption: match[3] || '',
    });
  }
  return images;
}

function extractImagesFromEntries(entries) {
  const images = [];
  for (const entry of entries) {
    const found = extractImagesFromText(entry.text);
    for (const image of found) images.push({ ...image, line: entry.line });
  }
  return images;
}

function splitByHeading(entries, level) {
  const chunks = [];
  let current = null;
  let fence = null;
  const headingRe = new RegExp(`^\\s*#{${level}}\\s+(.+?)\\s*$`);

  for (const entry of entries) {
    const fenceMatch = entry.text.match(FENCE_RE);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      if (!fence) fence = char;
      else if (fence === char) fence = null;
    }

    const match = !fence ? entry.text.match(headingRe) : null;
    if (match) {
      if (current) chunks.push(current);
      current = { title: match[1], line: entry.line, body: [] };
      continue;
    }
    if (current) current.body.push(entry);
  }

  if (current) chunks.push(current);
  return chunks;
}

function splitCards(entries) {
  const chunks = [[]];
  let fence = null;

  for (const entry of entries) {
    const fenceMatch = entry.text.match(FENCE_RE);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      if (!fence) fence = char;
      else if (fence === char) fence = null;
    }

    if (!fence && CARD_SEPARATOR_RE.test(entry.text)) {
      chunks.push([]);
      continue;
    }
    chunks[chunks.length - 1].push(entry);
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Frontmatter YAML (subconjunto suficiente para soffia)
// ---------------------------------------------------------------------------

function splitFrontmatter(text) {
  if (!text.startsWith('---\n')) {
    return { hasFrontmatter: false, data: {}, body: text };
  }

  const match = text.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!match) {
    return {
      hasFrontmatter: true,
      data: {},
      body: text,
      error:
        'El frontmatter empieza con --- pero no tiene una línea de cierre ---.',
    };
  }

  const source = match[1];
  const body = text.slice(match[0].length).replace(/^\n+/, '');
  try {
    return {
      hasFrontmatter: true,
      data: parseYamlSubset(source),
      body,
      source,
    };
  } catch (error) {
    return {
      hasFrontmatter: true,
      data: {},
      body,
      source,
      error: `No se pudo leer el frontmatter YAML: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

function stripYamlComment(value) {
  let quote = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote && value[index - 1] !== '\\') quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '#' && (index === 0 || /\s/.test(value[index - 1]))) {
      return value.slice(0, index).trim();
    }
  }
  return value.trim();
}

function splitInlineArray(value) {
  const items = [];
  let current = '';
  let quote = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      current += char;
      if (char === quote && value[index - 1] !== '\\') quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === ',') {
      if (current.trim()) items.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) items.push(current.trim());
  return items.map(parseScalar);
}

function parseScalar(raw) {
  const value = stripYamlComment(raw);
  if (!value) return '';
  if (/^"(?:[^"\\]|\\.)*"$/.test(value)) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (/^'(?:[^']|'')*'$/.test(value)) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    return splitInlineArray(value.slice(1, -1));
  }
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^(null|~)$/i.test(value)) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function parseYamlSubset(source) {
  const lines = source.split('\n');
  const data = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim() || /^\s*#/.test(line)) {
      index += 1;
      continue;
    }
    if (/^\s/.test(line)) {
      throw new Error(`Indentación inesperada en la línea ${index + 1}.`);
    }

    const match = line.match(/^([A-Za-z0-9_-]+):(.*)$/);
    if (!match) {
      throw new Error(`No se pudo leer la línea ${index + 1}.`);
    }

    const key = match[1];
    const rest = stripYamlComment(match[2].trim());

    if (rest === '') {
      const block = [];
      let cursor = index + 1;
      while (
        cursor < lines.length &&
        (lines[cursor].trim() === '' || /^\s+/.test(lines[cursor]))
      ) {
        block.push(lines[cursor]);
        cursor += 1;
      }

      const meaningful = block.filter(
        (item) => item.trim() && !/^\s*#/.test(item),
      );
      if (
        meaningful.length > 0 &&
        meaningful.every((item) => /^\s*-\s+/.test(item))
      ) {
        data[key] = meaningful.map((item) =>
          parseScalar(item.replace(/^\s*-\s+/, '').trim()),
        );
      } else if (meaningful.length > 0) {
        const text = meaningful
          .map((item) => item.trim())
          .join(' ')
          .trim();
        data[key] = text;
      } else {
        data[key] = '';
      }
      index = cursor;
      continue;
    }

    if (/^[|>][+-]?$/.test(rest)) {
      const block = [];
      let cursor = index + 1;
      while (
        cursor < lines.length &&
        (lines[cursor].trim() === '' || /^\s+/.test(lines[cursor]))
      ) {
        block.push(lines[cursor]);
        cursor += 1;
      }
      const indents = block
        .filter((item) => item.trim())
        .map((item) => item.match(/^\s*/)[0].length);
      const indent = indents.length ? Math.min(...indents) : 0;
      const stripped = block
        .map((item) => item.slice(indent))
        .join('\n')
        .replace(/\n+$/, '');
      data[key] = rest.startsWith('>')
        ? stripped.replace(/\n/g, ' ').trim()
        : stripped;
      index = cursor;
      continue;
    }

    data[key] = parseScalar(rest);
    index += 1;
  }

  return data;
}

// ---------------------------------------------------------------------------
// Escaneo del cuerpo
// ---------------------------------------------------------------------------

function scanDirectives(bodyLines, report) {
  const root = {
    name: 'root',
    line: 0,
    start: -1,
    end: bodyLines.length,
    content: [],
    inner: [],
    children: [],
    attrs: {},
    title: '',
    unclosed: false,
  };
  const stack = [root];
  let fence = null;

  for (let index = 0; index < bodyLines.length; index += 1) {
    const line = bodyLines[index];
    const lineNumber = index + 1;
    const current = stack[stack.length - 1];

    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      if (!fence) fence = char;
      else if (fence === char) fence = null;
      current.content.push({ text: line, line: lineNumber });
      continue;
    }

    if (fence) {
      current.content.push({ text: line, line: lineNumber });
      continue;
    }

    const open = line.match(DIRECTIVE_OPEN_RE);
    if (open) {
      const name = open[1].toLowerCase();
      const node = {
        name,
        attrs: parseAttrs(open[2] || ''),
        title: (open[3] || '').trim(),
        line: lineNumber,
        start: index,
        end: null,
        content: [],
        inner: [],
        children: [],
        unclosed: false,
      };
      current.children.push(node);
      stack.push(node);
      continue;
    }

    if (DIRECTIVE_CLOSE_RE.test(line)) {
      if (stack.length > 1) {
        const node = stack.pop();
        node.end = index;
      } else {
        report('error', 'Cierre ::: sin un bloque abierto.', lineNumber);
      }
      continue;
    }

    if (/^\s*:::/.test(line)) {
      report(
        'warning',
        'Marcador ::: no reconocido. Usa :::nombre{atributos} para abrir o ::: para cerrar.',
        lineNumber,
      );
    }

    current.content.push({ text: line, line: lineNumber });
  }

  for (const node of stack.slice(1)) {
    node.unclosed = true;
    node.end = bodyLines.length;
    report(
      'error',
      `El bloque :::${node.name} no tiene cierre :::.`,
      node.line,
    );
  }

  const fillInner = (node) => {
    if (node.name === 'root') {
      node.inner = bodyLines.map((text, index) => ({
        text,
        line: index + 1,
      }));
    } else {
      const end = node.end ?? bodyLines.length;
      node.inner = bodyLines.slice(node.start + 1, end).map((text, index) => ({
        text,
        line: node.start + 2 + index,
      }));
    }
    node.children.forEach(fillInner);
  };
  fillInner(root);

  return root;
}

function scanHeadings(entries, report) {
  const headings = [];
  const explicitIds = new Map();
  let fence = null;

  for (const entry of entries) {
    const fenceMatch = entry.text.match(FENCE_RE);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      if (!fence) fence = char;
      else if (fence === char) fence = null;
      continue;
    }
    if (fence) continue;

    const match = entry.text.match(HEADING_RE);
    if (!match) continue;

    const level = Math.min(6, Math.max(1, match[1].length));
    const parsed = extractTrailingId(match[2].trim());
    const text = parsed.text;
    const explicitId = parsed.explicitId;
    const id = explicitId || slugify(stripMarkdown(text));

    if (explicitId) {
      if (explicitIds.has(explicitId)) {
        report(
          'warning',
          `El id de encabezado "{#${explicitId}}" se repite; la app añadirá un sufijo al segundo.`,
          entry.line,
        );
      } else {
        explicitIds.set(explicitId, entry.line);
      }
      if (!SLUG_RE.test(explicitId)) {
        report(
          'warning',
          `El id de encabezado "{#${explicitId}}" no usa el formato recomendado (minúsculas, números y guiones).`,
          entry.line,
        );
      }
    }

    if (level <= 3 && /^\d+(?:\.\d+)*[.)]\s+/.test(text)) {
      report(
        'warning',
        'El encabezado incluye numeración manual; soffia ya numera las secciones. Quita el prefijo para evitar duplicarlo.',
        entry.line,
      );
    }

    headings.push({ level, text, id, explicitId, line: entry.line });
  }

  return headings;
}

function scanImages(bodyLines, report) {
  const images = [];
  let fence = null;

  for (let index = 0; index < bodyLines.length; index += 1) {
    const line = bodyLines[index];
    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      if (!fence) fence = char;
      else if (fence === char) fence = null;
      continue;
    }
    if (fence) continue;

    for (const image of extractImagesFromText(line)) {
      images.push({ ...image, line: index + 1 });
    }
  }

  return images;
}

function scanRawHtml(bodyLines, report) {
  let fence = null;
  const warned = new Set();

  for (let index = 0; index < bodyLines.length; index += 1) {
    const line = bodyLines[index];
    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      if (!fence) fence = char;
      else if (fence === char) fence = null;
      continue;
    }
    if (fence) continue;

    if (HTML_RE.test(line) && !warned.has(index + 1)) {
      warned.add(index + 1);
      report(
        'warning',
        'El HTML no se renderiza en soffia. Usa Markdown (tablas, listas, énfasis) en su lugar.',
        index + 1,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

function add(report, severity, message, line) {
  report(severity, message, line);
}

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function sortFindings(findings) {
  return [...findings].sort(
    (a, b) =>
      (a.line ?? Number.MAX_SAFE_INTEGER) -
      (b.line ?? Number.MAX_SAFE_INTEGER),
  );
}

function isFile(candidate) {
  try {
    return existsSync(candidate) && statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function checkAsset(ctx, src, line, label = 'imagen') {
  if (!src || !String(src).trim()) return;
  const clean = String(src).trim();

  if (/^data:image\//i.test(clean)) {
    if (!/^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(clean)) {
      add(
        ctx.report,
        'warning',
        `El data URL de la ${label} no parece válido.`,
        line,
      );
    }
    return;
  }

  if (/^https:\/\//i.test(clean)) {
    return;
  }

  if (/^http:\/\//i.test(clean)) {
    if (!ctx.assetWarnings.has(clean)) {
      ctx.assetWarnings.add(clean);
      add(
        ctx.report,
        'warning',
        `La ${label} usa http:// sin cifrar. Usa https:// o una ruta local.`,
        line,
      );
    }
    return;
  }

  if (/^\/\//.test(clean)) {
    add(
      ctx.report,
      'warning',
      `La ${label} usa una URL protocol-relative. Usa https:// o una ruta relativa.`,
      line,
    );
    return;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) {
    add(
      ctx.report,
      'warning',
      `La ${label} usa un esquema de URL no compatible: ${clean}`,
      line,
    );
    return;
  }

  if (/^[A-Za-z]:[\\/]/.test(clean)) {
    add(
      ctx.report,
      'warning',
      `La ${label} usa una ruta absoluta de Windows. Usa una ruta relativa a la carpeta del deck.`,
      line,
    );
    return;
  }

  if (clean.startsWith('/')) {
    add(
      ctx.report,
      'warning',
      `La ${label} usa una ruta absoluta. En el archivo único y al importar carpetas conviene una ruta relativa (por ejemplo, images/foo.svg).`,
      line,
    );
  }

  if (/\s/.test(clean)) {
    add(
      ctx.report,
      'warning',
      `La ruta de la ${label} contiene espacios. Codifícalos como %20 o renombra el archivo.`,
      line,
    );
  }

  if (ctx.options.noAssets) return;

  const withoutQuery = clean.split(/[?#]/)[0];
  let decoded = withoutQuery;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    // Se usa la ruta tal cual.
  }

  const candidates = [];
  if (decoded.startsWith('/')) {
    candidates.push(resolve(ctx.fileDir, `.${decoded}`));
  } else {
    candidates.push(resolve(ctx.fileDir, decoded));
  }

  const found = candidates.find(isFile);
  if (!found) {
    const key = decoded.toLowerCase();
    if (!ctx.missingAssets.has(key)) {
      ctx.missingAssets.add(key);
      add(
        ctx.report,
        'error',
        `No se encuentra la ${label} "${clean}". Se buscó en ${ctx.fileDir}.`,
        line,
      );
    }
  }
}

function checkAlt(ctx, image, label = 'imagen') {
  if (!image.alt || !image.alt.trim()) {
    add(
      ctx.report,
      'warning',
      `La ${label} no tiene texto alternativo. Añade una descripción breve entre corchetes.`,
      image.line,
    );
  }
}

function registerExplicitId(ctx, id, line, kind) {
  if (!id) return;
  if (!SLUG_RE.test(id)) {
    add(
      ctx.report,
      'warning',
      `El id "${id}" de ${kind} no usa el formato recomendado (minúsculas, números y guiones).`,
      line,
    );
  }
  if (ctx.explicitIds.has(id)) {
    add(
      ctx.report,
      'warning',
      `El id "${id}" de ${kind} ya se usó en la línea ${ctx.explicitIds.get(id)}. La app añadirá un sufijo, pero el progreso puede separarse.`,
      line,
    );
  } else {
    ctx.explicitIds.set(id, line);
  }
}

function validateFrontmatter(model, ctx) {
  const { fm } = model;
  const data = fm.data || {};
  const h1 = model.headings.find((heading) => heading.level === 1);
  const title = asNonEmptyString(data.title);

  if (!fm.hasFrontmatter) {
    if (ctx.options.allowPlain) {
      add(
        ctx.report,
        'warning',
        'El documento no tiene frontmatter. Se derivarán el id y el título; para conservar el progreso al reimportar, añade id y title.',
        1,
      );
    } else {
      add(
        ctx.report,
        'error',
        'Falta el frontmatter YAML. Añade id, title, description, tags, language y estimatedMinutes entre líneas ---.',
        1,
      );
    }
    if (!title && !h1) {
      add(
        ctx.report,
        'error',
        'El deck no tiene título: añade title en el frontmatter o un H1 (# Título).',
        1,
      );
    }
    if (
      h1 &&
      model.headings.filter((heading) => heading.level === 1).length > 1
    ) {
      add(
        ctx.report,
        'warning',
        'Hay más de un H1. Solo el primero se usa como título; los demás se tratan como secciones.',
        h1.line,
      );
    }
    const fallback = title || h1?.text || basename(ctx.file, extname(ctx.file));
    ctx.result.deckId = slugify(fallback);
    return;
  }

  if (fm.error) {
    add(ctx.report, 'error', fm.error, 1);
  }

  if (!title && !h1) {
    add(
      ctx.report,
      'error',
      'El deck no tiene título: añade title en el frontmatter o un H1 (# Título).',
      1,
    );
  }
  if (title && h1 && title !== h1.text) {
    add(
      ctx.report,
      'warning',
      `El title del frontmatter ("${title}") no coincide con el H1 ("${h1.text}"). La app usará el del frontmatter.`,
      1,
    );
  }
  if (!h1) {
    add(
      ctx.report,
      'warning',
      'No hay un H1. La app puede usar title del frontmatter, pero un H1 hace el documento más claro.',
      1,
    );
  }
  if (h1 && model.headings.filter((heading) => heading.level === 1).length > 1) {
    add(
      ctx.report,
      'warning',
      'Hay más de un H1. Solo el primero se usa como título; los demás se tratan como secciones.',
      h1.line,
    );
  }

  const id = asNonEmptyString(data.id);
  if (!id) {
    if (fm.hasFrontmatter && !ctx.options.allowPlain) {
      add(
        ctx.report,
        'error',
        'Falta id en el frontmatter. Es la clave estable que permite actualizar el deck y conservar el progreso.',
        1,
      );
    }
    const fallback = title || h1?.text || basename(ctx.file, extname(ctx.file));
    ctx.result.deckId = slugify(fallback);
  } else {
    if (!isSafeDeckId(id)) {
      add(
        ctx.report,
        'error',
        `El id "${id}" no es válido: usa letras, números, guiones, puntos o guiones bajos (máximo 64), sin barras, espacios ni secuencias '..'.`,
        1,
      );
    } else if (!SLUG_RE.test(id)) {
      add(
        ctx.report,
        'warning',
        `El id "${id}" no usa el formato recomendado: minúsculas, números y guiones (por ejemplo, impetigo).`,
        1,
      );
    }
    if (ctx.shared.deckIds.has(id)) {
      add(
        ctx.report,
        'warning',
        `El id de deck "${id}" también aparece en ${ctx.shared.deckIds.get(id)}. Al importar ambos, el segundo recibirá un sufijo.`,
        1,
      );
    } else {
      ctx.shared.deckIds.set(id, ctx.display);
    }
    ctx.result.deckId = id;
  }

  const description = data.description;
  if (description === undefined || description === '') {
    add(
      ctx.report,
      'warning',
      'Falta description en el frontmatter; ayuda a presentar el deck en la biblioteca.',
      1,
    );
  } else if (typeof description !== 'string') {
    add(ctx.report, 'warning', 'description debe ser texto.', 1);
  }

  const subtitle = data.subtitle;
  if (subtitle !== undefined && typeof subtitle !== 'string') {
    add(ctx.report, 'warning', 'subtitle debe ser texto.', 1);
  }

  const tags = data.tags;
  if (tags === undefined || tags === '') {
    add(
      ctx.report,
      'warning',
      'Falta tags en el frontmatter; se usa para clasificar el deck en la biblioteca.',
      1,
    );
  } else if (Array.isArray(tags)) {
    if (tags.length === 0) {
      add(ctx.report, 'warning', 'tags está vacío.', 1);
    }
    tags.forEach((tag) => {
      if (typeof tag !== 'string' || !tag.trim()) {
        add(
          ctx.report,
          'warning',
          'Cada etiqueta de tags debe ser texto no vacío.',
          1,
        );
      }
    });
  } else if (typeof tags === 'string') {
    add(
      ctx.report,
      'warning',
      'tags debería ser una lista YAML, por ejemplo: tags: [Dermatología, Pediatría].',
      1,
    );
  } else {
    add(ctx.report, 'warning', 'tags debe ser una lista de textos.', 1);
  }

  const language = data.language;
  if (language === undefined || language === '') {
    add(
      ctx.report,
      'warning',
      'Falta language en el frontmatter; se usará es por defecto.',
      1,
    );
  } else if (typeof language !== 'string') {
    add(ctx.report, 'warning', 'language debe ser un código de idioma, por ejemplo es.', 1);
  }

  const estimated = data.estimatedMinutes;
  if (estimated === undefined || estimated === '') {
    add(
      ctx.report,
      'warning',
      'Falta estimatedMinutes; la app lo estimará a partir de las palabras.',
      1,
    );
  } else {
    const number =
      typeof estimated === 'number'
        ? estimated
        : typeof estimated === 'string'
          ? Number(estimated.trim())
          : NaN;
    if (!Number.isFinite(number) || number <= 0) {
      add(
        ctx.report,
        'warning',
        'estimatedMinutes debe ser un número positivo.',
        1,
      );
    } else if (!Number.isInteger(number)) {
      add(ctx.report, 'warning', 'estimatedMinutes debería ser un número entero.', 1);
    }
  }

  const author = data.author;
  if (author !== undefined && typeof author !== 'string') {
    add(ctx.report, 'warning', 'author debe ser texto.', 1);
  }

  const cover = data.cover;
  if (cover !== undefined && cover !== '') {
    if (typeof cover !== 'string') {
      add(ctx.report, 'warning', 'cover debe ser una ruta o URL de imagen.', 1);
    } else {
      checkAsset(ctx, cover, 1, 'portada');
    }
  }
}

function validateStructure(model, ctx) {
  const headings = model.headings;
  const h2s = headings.filter((heading) => heading.level === 2);
  const h3s = headings.filter((heading) => heading.level === 3);

  if (h2s.length === 0) {
    const severity = ctx.options.allowPlain ? 'warning' : 'error';
    add(
      ctx.report,
      severity,
      'No hay secciones H2. Usa ## para las secciones principales; el índice lateral se construye con ellas.',
      model.fm.body ? 1 : undefined,
    );
  }

  if (h2s.length > 25) {
    add(
      ctx.report,
      'warning',
      `Hay ${h2s.length} secciones H2. Un deck tan largo puede ser difícil de navegar; considera agrupar o dividir.`,
      1,
    );
  }

  let seenH2 = false;
  const titles = new Map();
  for (const heading of headings) {
    if (heading.level === 2) {
      seenH2 = true;
      const key = heading.text.trim().toLowerCase();
      if (titles.has(key)) {
        add(
          ctx.report,
          'warning',
          `La sección "${heading.text}" está repetida. Usa títulos distintos para que el índice sea claro.`,
          heading.line,
        );
      } else {
        titles.set(key, heading.line);
      }
    } else if (heading.level === 3 && !seenH2) {
      add(
        ctx.report,
        'warning',
        'Hay una subsección H3 antes de la primera sección H2; quedará fuera de la estructura de secciones.',
        heading.line,
      );
    }
  }

  if (h3s.length > 0 && h2s.length > 0) {
    // La estructura H3 bajo H2 ya la garantiza el parser; solo avisamos de
    // títulos demasiado largos, que rompen la lectura del índice y acordeón.
    for (const heading of h3s) {
      if (heading.text.length > 120) {
        add(
          ctx.report,
          'warning',
          'El título de la subsección es muy largo; acórtalo para que se lea bien en el acordeón.',
          heading.line,
        );
      }
    }
  }
}

function validateHeadingContent(model, ctx) {
  for (let index = 0; index < model.headings.length; index += 1) {
    const heading = model.headings[index];
    if (heading.level !== 2 && heading.level !== 3) continue;

    let next = null;
    for (
      let cursor = index + 1;
      cursor < model.headings.length;
      cursor += 1
    ) {
      if (model.headings[cursor].level <= heading.level) {
        next = model.headings[cursor];
        break;
      }
    }

    // heading.line es 1-based; la línea siguiente está en el mismo índice.
    const start = heading.line;
    const end = next ? next.line - 1 : model.bodyLines.length;
    const hasContent = model.bodyLines
      .slice(start, end)
      .some((line) => line.trim() !== '');

    if (!hasContent) {
      add(
        ctx.report,
        'warning',
        `La sección "${heading.text}" no tiene contenido. Añade texto o elimina el encabezado.`,
        heading.line,
      );
    }
  }
}

function validateGlobalImages(model, ctx) {
  for (const image of model.images) {
    checkAlt(ctx, image);
    checkAsset(ctx, image.src, image.line);
  }
}

function validateDirective(node, ctx) {
  if (!DIRECTIVES.has(node.name)) {
    add(
      ctx.report,
      'error',
      `Bloque desconocido :::${node.name}. Usa uno de: ${Array.from(DIRECTIVES).join(', ')}.`,
      node.line,
    );
  }

  if (node.children.length > 0 && !NESTING_ALLOWED.has(node.name)) {
    add(
      ctx.report,
      'warning',
      `El bloque :::${node.name} no interpreta bloques anidados; su contenido se tratará como texto.`,
      node.line,
    );
  }

  switch (node.name) {
    case 'callout':
    case 'note':
    case 'quote':
      validateCallout(node, ctx);
      break;
    case 'grid':
      validateGrid(node, ctx);
      break;
    case 'steps':
      validateSteps(node, ctx);
      break;
    case 'quiz':
      validateQuiz(node, ctx);
      break;
    case 'flashcards':
      validateCards(node, ctx, 'flashcards');
      break;
    case 'qa':
      validateCards(node, ctx, 'qa');
      break;
    case 'references':
      validateReferences(node, ctx);
      break;
    case 'keypoints':
      validateKeypoints(node, ctx);
      break;
    case 'gallery':
      validateGallery(node, ctx);
      break;
    case 'figure':
      validateFigure(node, ctx);
      break;
    default:
      break;
  }

  for (const child of node.children) validateDirective(child, ctx);
}

function validateCallout(node, ctx) {
  const requested = (
    node.attrs.type ||
    node.attrs.variant ||
    (node.name === 'quote' ? 'quote' : 'info')
  ).toLowerCase();

  if (!CALLOUT_VARIANTS.has(requested)) {
    add(
      ctx.report,
      'warning',
      `Tipo de callout desconocido "${requested}". Se usará info. Válidos: ${Array.from(CALLOUT_VARIANTS).join(', ')}.`,
      node.line,
    );
  }

  if (
    node.attrs.collapsible !== undefined &&
    !['true', 'false', '1', '0'].includes(node.attrs.collapsible)
  ) {
    add(
      ctx.report,
      'warning',
      'El atributo collapsible debe ser true o false.',
      node.line,
    );
  }

  const hasText = node.content.some((entry) => entry.text.trim());
  if (!hasText && node.children.length === 0) {
    add(ctx.report, 'warning', 'El callout está vacío.', node.line);
  }
}

function validateGrid(node, ctx) {
  if (node.attrs.columns !== undefined) {
    const columns = Number(node.attrs.columns);
    if (!Number.isInteger(columns) || columns < 1 || columns > 3) {
      add(
        ctx.report,
        'warning',
        'grid.columns se ajusta a 1-3 columnas. Usa un número entero entre 1 y 3.',
        node.line,
      );
    }
  }

  const hasText = node.content.some((entry) => entry.text.trim());
  if (!hasText && node.children.length === 0) {
    add(ctx.report, 'warning', 'El grid está vacío.', node.line);
  }
}

function validateSteps(node, ctx) {
  const chunks = splitByHeading(node.inner, 3);
  if (chunks.length === 0) {
    add(
      ctx.report,
      'warning',
      'El bloque :::steps no contiene pasos. Añade encabezados ### para cada paso.',
      node.line,
    );
    return;
  }

  const first = chunks[0];
  const preamble = node.inner.filter(
    (entry) => entry.line < first.line && entry.text.trim(),
  );
  if (preamble.length > 0) {
    add(
      ctx.report,
      'warning',
      'El texto anterior al primer ### dentro de :::steps no se muestra; muévelo fuera del bloque.',
      preamble[0].line,
    );
  }

  const titles = new Map();
  for (const chunk of chunks) {
    if (!chunk.title.trim()) {
      add(ctx.report, 'warning', 'Un paso de :::steps no tiene título.', chunk.line);
    } else {
      const key = chunk.title.trim().toLowerCase();
      if (titles.has(key)) {
        add(
          ctx.report,
          'warning',
          `El paso "${chunk.title}" está repetido.`,
          chunk.line,
        );
      } else {
        titles.set(key, chunk.line);
      }
    }

    if (!joinEntries(chunk.body)) {
      add(
        ctx.report,
        'warning',
        `El paso "${chunk.title || 'sin título'}" no tiene contenido.`,
        chunk.line,
      );
    }
  }
}

function validateQuiz(node, ctx) {
  ctx.stats.quizzes += 1;
  const lines = node.inner;
  const options = [];

  for (const entry of lines) {
    const match = entry.text.match(QUIZ_OPTION_RE);
    if (!match) continue;
    options.push({
      line: entry.line,
      correct: match[1].toLowerCase() === 'x',
      text: match[2].trim(),
    });
  }

  if (options.length === 0) {
    add(
      ctx.report,
      'error',
      'El quiz no tiene opciones con el formato "- [ ]" / "- [x]".',
      node.line,
    );
    return;
  }

  if (options.length < 2) {
    add(
      ctx.report,
      'error',
      'El quiz necesita al menos dos opciones.',
      node.line,
    );
  }

  const firstOption = lines.findIndex((entry) => QUIZ_OPTION_RE.test(entry.text));
  const lastOption = lines.findLastIndex((entry) =>
    QUIZ_OPTION_RE.test(entry.text),
  );

  for (const entry of lines.slice(firstOption, lastOption + 1)) {
    if (entry.text.trim() && !QUIZ_OPTION_RE.test(entry.text)) {
      add(
        ctx.report,
        'warning',
        'Hay texto entre las opciones del quiz; la app solo interpreta las líneas "- [ ]" / "- [x]".',
        entry.line,
      );
      break;
    }
  }

  let question = joinEntries(lines.slice(0, firstOption))
    .replace(/^\s*(?:\*\*)?Pregunta(?:\*\*)?\s*:?\s*/i, '')
    .trim();
  let explanation = joinEntries(lines.slice(lastOption + 1))
    .replace(/^\s*(?:>\s*)+(?=(?:\*\*)?Explicaci[oó]n)/i, '')
    .replace(/^\s*(?:\*\*)?Explicaci[oó]n(?:\*\*)?\s*:?\s*/i, '')
    .replace(/^\s*>\s?/gm, '')
    .trim();

  if (!question) {
    add(ctx.report, 'error', 'El quiz no tiene pregunta antes de las opciones.', node.line);
  }

  const correct = options.filter((option) => option.correct).length;
  if (correct === 0) {
    add(
      ctx.report,
      'error',
      'El quiz no tiene ninguna opción correcta marcada con [x].',
      node.line,
    );
  }

  const multipleAttr = node.attrs.multiple;
  const multiple =
    multipleAttr === 'true' ||
    multipleAttr === '1' ||
    correct > 1;
  if (
    multipleAttr !== undefined &&
    !['true', 'false', '1', '0'].includes(multipleAttr)
  ) {
    add(
      ctx.report,
      'warning',
      'El atributo multiple debe ser true o false.',
      node.line,
    );
  }
  if (multiple && correct < 2) {
    add(
      ctx.report,
      'warning',
      'El quiz está marcado como multiple pero solo tiene una opción correcta.',
      node.line,
    );
  }
  if (correct > 1 && multipleAttr !== 'true' && multipleAttr !== '1') {
    add(
      ctx.report,
      'warning',
      'Hay varias opciones correctas; la app marcará el quiz como multiple automáticamente.',
      node.line,
    );
  }

  const seenOptions = new Map();
  for (const option of options) {
    const key = option.text.toLowerCase();
    if (seenOptions.has(key)) {
      add(
        ctx.report,
        'warning',
        `La opción "${option.text}" está repetida en el quiz.`,
        option.line,
      );
    } else {
      seenOptions.set(key, option.line);
    }
  }

  if (!explanation) {
    add(
      ctx.report,
      'warning',
      'El quiz no tiene explicación. Añádela después de las opciones para reforzar el aprendizaje.',
      node.line,
    );
  }

  const id = node.attrs.id;
  if (!id) {
    add(
      ctx.report,
      'warning',
      'El quiz no tiene id explícito. La app generará uno a partir del contenido; si cambias la pregunta, el progreso puede separarse.',
      node.line,
    );
  } else {
    registerExplicitId(ctx, id, node.line, 'quiz');
  }

  if (node.attrs.difficulty !== undefined) {
    const difficulty = Number(node.attrs.difficulty);
    if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 5) {
      add(
        ctx.report,
        'warning',
        'difficulty debería ser un número entre 1 y 5.',
        node.line,
      );
    }
  }

  if (node.attrs.tags !== undefined && !node.attrs.tags.trim()) {
    add(ctx.report, 'warning', 'tags del quiz está vacío.', node.line);
  }
}

function parseCardChunk(chunk) {
  const entries = trimEntries(chunk);
  if (entries.length === 0) return null;

  const first = entries[0];
  const heading = first.text.match(/^###\s+(.+?)\s*$/);
  let front = '';
  let back = '';
  let explicitId;

  if (heading) {
    const parsed = extractTrailingId(heading[1].trim());
    front = parsed.text;
    explicitId = parsed.explicitId;
    back = joinEntries(entries.slice(1));
  } else {
    const text = joinEntries(entries);
    if (text.includes('||')) {
      const [left, ...rest] = text.split('||');
      front = left.trim();
      back = rest.join('||').trim();
    } else {
      front = first.text.trim();
      back = joinEntries(entries.slice(1));
    }
  }

  return { front, back, explicitId, line: first.line };
}

function validateCards(node, ctx, kind) {
  const chunks = splitCards(node.inner);
  const cards = [];
  const nonEmpty = chunks.filter((chunk) =>
    chunk.some((entry) => entry.text.trim()),
  );

  if (chunks.length > 1) {
    if (chunks[0].every((entry) => !entry.text.trim())) {
      add(
        ctx.report,
        'warning',
        'El bloque empieza con un separador --- innecesario; elimínalo.',
        node.line,
      );
    }
    if (chunks[chunks.length - 1].every((entry) => !entry.text.trim())) {
      add(
        ctx.report,
        'warning',
        'El bloque termina con un separador --- sin tarjeta después; elimínalo.',
        node.line,
      );
    }
    for (let index = 1; index < chunks.length - 1; index += 1) {
      if (chunks[index].every((entry) => !entry.text.trim())) {
        add(
          ctx.report,
          'warning',
          'Hay un separador --- consecutivo sin tarjeta entre medias.',
          node.line,
        );
        break;
      }
    }
  }

  if (nonEmpty.length === 0) {
    add(
      ctx.report,
      'error',
      `El bloque :::${kind} no contiene tarjetas. Separa cada tarjeta con una línea ---.`,
      node.line,
    );
    return;
  }

  const blockId = node.attrs.id;
  if (blockId) registerExplicitId(ctx, blockId, node.line, kind);

  for (const chunk of nonEmpty) {
    const card = parseCardChunk(chunk);
    if (!card) continue;

    if (!card.front) {
      add(
        ctx.report,
        'warning',
        `Una tarjeta de :::${kind} no tiene frente.`,
        card.line,
      );
      continue;
    }
    if (!card.back) {
      add(
        ctx.report,
        'warning',
        `La tarjeta "${stripMarkdown(card.front)}" no tiene reverso.`,
        card.line,
      );
    }
    if (card.explicitId) {
      registerExplicitId(ctx, card.explicitId, card.line, 'tarjeta');
    }
    cards.push(card);
  }

  if (kind === 'flashcards') {
    ctx.stats.flashcards += cards.length;
  } else {
    ctx.stats.qa += cards.length;
  }
}

function validateReferences(node, ctx) {
  const items = [];
  let current = null;
  const preamble = [];

  for (const entry of node.inner) {
    const match = entry.text.match(LIST_RE);
    if (match) {
      const text = match[1].trim();
      const link = text.match(LINK_RE);
      const title = link ? link[1].trim() : text;
      const url = link ? link[2].trim() : undefined;
      const rest = link ? text.replace(link[0], '').trim() : '';
      const note = rest.replace(/^[—–\-:·]\s*/, '').trim() || undefined;
      current = { title, url, note, line: entry.line };
      items.push(current);
      continue;
    }
    if (entry.text.trim()) {
      if (current) {
        current.note = [current.note, entry.text.trim()]
          .filter(Boolean)
          .join(' ');
      } else {
        preamble.push(entry);
      }
    }
  }

  if (preamble.length > 0) {
    add(
      ctx.report,
      'warning',
      'El texto anterior a la primera referencia no se muestra; muévelo fuera del bloque.',
      preamble[0].line,
    );
  }

  if (items.length === 0) {
    add(
      ctx.report,
      'error',
      'El bloque :::references no contiene una lista de referencias.',
      node.line,
    );
    return;
  }

  const urls = new Map();
  for (const item of items) {
    if (!item.title) {
      add(ctx.report, 'warning', 'Una referencia no tiene título.', item.line);
    }
    if (!item.url) {
      add(
        ctx.report,
        'warning',
        `La referencia "${item.title}" no tiene URL. Añade un enlace para que sea verificable.`,
        item.line,
      );
      continue;
    }
    if (urls.has(item.url)) {
      add(
        ctx.report,
        'warning',
        `La URL ${item.url} está repetida en las referencias.`,
        item.line,
      );
    } else {
      urls.set(item.url, item.line);
    }
    if (/^http:\/\//i.test(item.url)) {
      add(
        ctx.report,
        'warning',
        `La referencia usa http://; mejor https:// si está disponible: ${item.url}`,
        item.line,
      );
    } else if (!/^(https?:\/\/|mailto:)/i.test(item.url)) {
      add(
        ctx.report,
        'warning',
        `La URL de la referencia no es http(s) ni mailto: ${item.url}`,
        item.line,
      );
    } else {
      try {
        new URL(item.url);
      } catch {
        add(
          ctx.report,
          'warning',
          `La URL de la referencia no parece válida: ${item.url}`,
          item.line,
        );
      }
    }
  }

  ctx.stats.references += items.length;
}

function validateKeypoints(node, ctx) {
  const items = [];
  const preamble = [];
  for (const entry of node.inner) {
    const match = entry.text.match(LIST_RE);
    if (match && match[1].trim()) {
      items.push({ text: match[1].trim(), line: entry.line });
    } else if (entry.text.trim()) {
      preamble.push(entry);
    }
  }

  if (preamble.length > 0) {
    add(
      ctx.report,
      'warning',
      'El texto que no es una lista dentro de :::keypoints se ignora; muévelo fuera del bloque.',
      preamble[0].line,
    );
  }

  if (items.length === 0) {
    add(
      ctx.report,
      'error',
      'El bloque :::keypoints no contiene una lista de puntos clave.',
      node.line,
    );
    return;
  }

  if (items.length > 10) {
    add(
      ctx.report,
      'warning',
      `Hay ${items.length} puntos clave. Para que se recuerden, considera dejar entre 3 y 8.`,
      node.line,
    );
  }

  const seen = new Map();
  for (const item of items) {
    const key = item.text.toLowerCase();
    if (seen.has(key)) {
      add(
        ctx.report,
        'warning',
        `El punto clave "${item.text}" está repetido.`,
        item.line,
      );
    } else {
      seen.set(key, item.line);
    }
  }
}

function validateGallery(node, ctx) {
  const images = extractImagesFromEntries(node.inner);

  if (images.length === 0) {
    add(
      ctx.report,
      'warning',
      'La galería no contiene imágenes. Usa una imagen Markdown por línea.',
      node.line,
    );
  } else if (images.length < 2) {
    add(
      ctx.report,
      'warning',
      'Una galería con una sola imagen se ve mejor como :::figure.',
      node.line,
    );
  }

  if (node.attrs.columns !== undefined) {
    const columns = Number(node.attrs.columns);
    if (!Number.isInteger(columns) || columns < 1 || columns > 4) {
      add(
        ctx.report,
        'warning',
        'gallery.columns se ajusta a 1-4 columnas. Usa un número entero entre 1 y 4.',
        node.line,
      );
    }
  }

  for (const entry of node.inner) {
    if (!entry.text.trim()) continue;
    if (extractImagesFromText(entry.text).length > 0) continue;
    add(
      ctx.report,
      'warning',
      'La galería solo interpreta imágenes; este texto se ignorará.',
      entry.line,
    );
  }
}

function validateFigure(node, ctx) {
  const images = extractImagesFromEntries(node.inner);
  const src = node.attrs.src || images[0]?.src;

  if (!src) {
    add(
      ctx.report,
      'error',
      'El bloque :::figure no tiene src ni una imagen dentro.',
      node.line,
    );
    return;
  }

  if (node.attrs.src && images[0] && node.attrs.src !== images[0].src) {
    add(
      ctx.report,
      'warning',
      'El src del atributo y la imagen interior no coinciden; se usará el del atributo.',
      node.line,
    );
  }

  if (images.length > 1) {
    add(
      ctx.report,
      'warning',
      ':::figure solo usa la primera imagen; para varias usa :::gallery.',
      node.line,
    );
  }

  for (const entry of node.inner) {
    if (!entry.text.trim()) continue;
    if (extractImagesFromText(entry.text).length > 0) continue;
    add(
      ctx.report,
      'warning',
      ':::figure solo interpreta una imagen; este texto se ignorará.',
      entry.line,
    );
    break;
  }

  const alt = node.attrs.alt || images[0]?.alt || '';
  const caption = node.attrs.caption || images[0]?.caption || '';

  if (!alt.trim()) {
    add(
      ctx.report,
      'warning',
      'La figura no tiene texto alternativo. Añade alt="..." o una descripción entre corchetes.',
      node.line,
    );
  }
  if (!caption.trim()) {
    add(
      ctx.report,
      'warning',
      'La figura no tiene pie de foto. Añade caption="..." o un título entre comillas en la imagen.',
      node.line,
    );
  }

  const credit = node.attrs.credit || '';
  if (/^https?:\/\//i.test(src) && !credit.trim()) {
    add(
      ctx.report,
      'warning',
      'La figura usa una imagen web y no indica crédito. Añade credit="Fuente y licencia" para atribuirla.',
      node.line,
    );
  }

  checkAsset(ctx, src, node.line, 'figura');
}

// ---------------------------------------------------------------------------
// Análisis de un archivo
// ---------------------------------------------------------------------------

function validateFile(file, options, shared) {
  const display = relative(process.cwd(), file).replace(/\\/g, '/') || file;
  const result = {
    file,
    display,
    deckId: undefined,
    errors: [],
    warnings: [],
    stats: {
      sections: 0,
      subsections: 0,
      directives: 0,
      quizzes: 0,
      flashcards: 0,
      qa: 0,
      references: 0,
      images: 0,
      words: 0,
      minutes: 0,
    },
  };

  const report = (severity, message, line) => {
    const entry = { message, ...(line ? { line } : {}) };
    if (severity === 'error') result.errors.push(entry);
    else result.warnings.push(entry);
  };

  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (error) {
    report(
      'error',
      `No se pudo leer el archivo: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    result.ok = false;
    return result;
  }

  if (!raw.trim()) {
    report('error', 'El archivo está vacío.');
    result.ok = false;
    return result;
  }

  const normalized = normalizeMarkdown(raw);
  const fm = splitFrontmatter(normalized);
  const bodyLines = fm.body.split('\n');
  const root = scanDirectives(bodyLines, report);
  const headings = scanHeadings(root.content, report);
  const images = scanImages(bodyLines, report);

  const model = { normalized, fm, body: fm.body, bodyLines, root, headings, images };

  const ctx = {
    file,
    display,
    fileDir: dirname(file),
    options,
    shared,
    result,
    report,
    explicitIds: new Map(),
    missingAssets: new Set(),
    assetWarnings: new Set(),
    stats: result.stats,
  };

  // Los IDs de encabezado comparten espacio con quizzes, tarjetas y bloques.
  // Registrarlos permite avisar de colisiones que la app resolvería con sufijos.
  for (const heading of headings) {
    if (!ctx.explicitIds.has(heading.id)) {
      ctx.explicitIds.set(heading.id, heading.line);
    }
  }

  validateFrontmatter(model, ctx);
  validateStructure(model, ctx);
  validateHeadingContent(model, ctx);
  validateGlobalImages(model, ctx);
  scanRawHtml(bodyLines, report);

  for (const child of root.children) validateDirective(child, ctx);

  const h2s = headings.filter((heading) => heading.level === 2);
  const h3s = headings.filter((heading) => heading.level === 3);
  const attributeImages = Array.from(
    fm.body.matchAll(/\bsrc\s*=\s*["']([^"']+)["']/gi),
    (match) => match[1],
  );
  const cover = typeof fm.data?.cover === 'string' ? fm.data.cover : '';
  const uniqueImages = new Set([
    ...images.map((image) => image.src),
    ...attributeImages,
    ...(cover ? [cover] : []),
  ]);
  const estimated = Number(fm.data?.estimatedMinutes);
  const words = countWords(fm.body);

  result.stats.sections = h2s.length;
  result.stats.subsections = h3s.length;
  result.stats.directives = countDirectives(root);
  result.stats.images = uniqueImages.size;
  result.stats.words = words;
  result.stats.minutes =
    Number.isFinite(estimated) && estimated > 0
      ? estimated
      : Math.max(1, Math.round(words / 200));

  result.ok =
    result.errors.length === 0 &&
    (!options.strict || result.warnings.length === 0);
  return result;
}

function countDirectives(node) {
  let count = node.children.length;
  for (const child of node.children) count += countDirectives(child);
  return count;
}

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------

function printHuman(results, options) {
  console.log(`soffia validate ${VERSION}`);

  for (const result of results) {
    console.log(`\n${result.display}`);

    if (!options.quiet) {
      const stats = result.stats;
      const parts = [
        plural(stats.sections, 'sección', 'secciones'),
        stats.subsections
          ? plural(stats.subsections, 'subsección', 'subsecciones')
          : null,
        plural(stats.quizzes, 'quiz', 'quizzes'),
        plural(stats.flashcards, 'tarjeta', 'tarjetas'),
        plural(stats.qa, 'pregunta', 'preguntas'),
        plural(stats.references, 'referencia', 'referencias'),
        plural(stats.images, 'imagen', 'imágenes'),
        plural(stats.words, 'palabra', 'palabras'),
      ].filter(Boolean);
      console.log(`  ${parts.join(' · ')}`);
    }

    if (!options.quiet) {
      for (const warning of sortFindings(result.warnings)) {
        console.log(
          `  AVISO${warning.line ? ` línea ${warning.line}` : ''}: ${warning.message}`,
        );
      }
    }

    for (const error of sortFindings(result.errors)) {
      console.log(
        `  ERROR${error.line ? ` línea ${error.line}` : ''}: ${error.message}`,
      );
    }

    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log('  OK');
    } else if (!options.quiet && result.errors.length === 0) {
      console.log(`  ${plural(result.warnings.length, 'aviso', 'avisos')}.`);
    }
  }

  const totals = results.reduce(
    (acc, result) => {
      acc.errors += result.errors.length;
      acc.warnings += result.warnings.length;
      return acc;
    },
    { errors: 0, warnings: 0 },
  );

  console.log(
    `\n${plural(results.length, 'archivo', 'archivos')} · ${plural(
      totals.errors,
      'error',
      'errores',
    )} · ${plural(totals.warnings, 'aviso', 'avisos')}`,
  );

  if (options.strict && totals.warnings > 0 && totals.errors === 0) {
    console.log('Modo estricto: los avisos también hacen fallar la validación.');
  }
}

function printJson(results, options) {
  const totals = results.reduce(
    (acc, result) => {
      acc.errors += result.errors.length;
      acc.warnings += result.warnings.length;
      return acc;
    },
    { errors: 0, warnings: 0 },
  );

  const payload = {
    tool: 'soffia-validate',
    version: VERSION,
    strict: options.strict,
    files: results.map((result) => ({
      file: result.display,
      ok: result.ok,
      deckId: result.deckId,
      stats: result.stats,
      errors: sortFindings(result.errors),
      warnings: sortFindings(result.warnings),
    })),
    summary: {
      files: results.length,
      errors: totals.errors,
      warnings: totals.warnings,
      ok: results.every((result) => result.ok),
    },
  };

  console.log(JSON.stringify(payload, null, 2));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error('Usa --help para ver las opciones.');
    return 2;
  }

  if (options.help) {
    printHelp();
    return 0;
  }
  if (options.version) {
    console.log(VERSION);
    return 0;
  }
  if (options.inputs.length === 0) {
    printHelp();
    return 2;
  }

  let files;
  try {
    files = collectFiles(options.inputs);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 2;
  }

  if (files.length === 0) {
    console.error('No se encontraron archivos Markdown (.md, .markdown o .txt).');
    return 1;
  }

  const shared = { deckIds: new Map() };
  const results = files.map((file) => validateFile(file, options, shared));

  if (options.json) printJson(results, options);
  else printHuman(results, options);

  return results.every((result) => result.ok) ? 0 : 1;
}

process.exitCode = main();
