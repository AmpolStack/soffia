import { parseDocument } from './format/parse';
import {
  buildDeckRecord,
  getDeck,
  saveDeck,
  uniqueDeckId,
  type DeckAssetMap,
  type DeckRecord,
} from './storage/decks';

export type ImportFile = {
  file: File;
  path: string;
};

export type ImportedDeck = {
  deck: DeckRecord;
  updated: boolean;
};

const MARKDOWN_EXTENSION = /\.(md|markdown|txt)$/i;

function isMarkdownFile(file: File): boolean {
  return MARKDOWN_EXTENSION.test(file.name);
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index === -1 ? '' : normalized.slice(0, index);
}

function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/{2,}/g, '/');
}

function baseName(path: string): string {
  const parts = normalizePath(path).split('/');
  return parts[parts.length - 1] ?? path;
}

function relativeToDirectory(path: string, directory: string): string {
  const clean = normalizePath(path);
  const dir = normalizePath(directory);
  if (!dir) return clean;
  if (clean.startsWith(`${dir}/`)) return clean.slice(dir.length + 1);
  return baseName(clean);
}

function referencedSources(markdown: string): Set<string> {
  const doc = parseDocument(markdown);
  const sources = new Set<string>();
  doc.images.forEach((image) => sources.add(image.src));
  if (doc.meta.cover) sources.add(doc.meta.cover);

  return new Set(
    Array.from(sources).map((source) => {
      const clean = source.replace(/[?#].*$/, '').replace(/^\.\//, '');
      return clean.toLowerCase();
    }),
  );
}

function pickAssets(
  markdown: string,
  mdPath: string,
  images: ImportFile[],
): DeckAssetMap {
  const referenced = referencedSources(markdown);
  const mdDir = dirname(mdPath);
  const assets: DeckAssetMap = {};
  const available = images.map((image) => ({
    ...image,
    relative: relativeToDirectory(image.path, mdDir),
  }));

  for (const image of available) {
    const relative = image.relative.toLowerCase();
    const name = baseName(image.path).toLowerCase();
    if (!referenced.has(relative) && !referenced.has(name)) continue;
    assets[image.relative] = image.file;
  }

  return assets;
}

export type ImportItemResult = {
  file: string;
  deck?: ImportedDeck;
  error?: string;
  warnings?: string[];
};

export async function importMarkdownFilesDetailed(
  files: ImportFile[],
  options: { baseUrl?: string } = {},
): Promise<ImportItemResult[]> {
  const markdownFiles = files.filter((item) => isMarkdownFile(item.file));
  if (markdownFiles.length === 0) {
    throw new Error(
      'No encontramos ningún archivo Markdown (.md, .markdown o .txt) en la selección.',
    );
  }

  const images = files.filter((item) => !isMarkdownFile(item.file));
  const usedInBatch = new Set<string>();
  const results: ImportItemResult[] = [];

  for (const item of markdownFiles) {
    try {
      const markdown = await item.file.text();
      if (!markdown.trim()) throw new Error('El archivo está vacío.');

      const doc = parseDocument(markdown, { sourceName: item.file.name });
      const errors = doc.warnings.filter((warning) => warning.severity === 'error');
      if (errors.length > 0) {
        throw new Error(
          errors.map((error) => `${error.line ? `Línea ${error.line}: ` : ''}${error.message}`).join(' '),
        );
      }

      const previous = await getDeck(doc.meta.id);
      const id = usedInBatch.has(doc.meta.id)
        ? uniqueDeckId(doc.meta.id, usedInBatch)
        : doc.meta.id;
      usedInBatch.add(id);

      const record = buildDeckRecord({
        markdown,
        sourceName: item.file.name,
        assets: pickAssets(markdown, item.path, images),
        baseUrl: options.baseUrl,
      });

      const deck: DeckRecord = {
        ...record,
        id,
        createdAt: previous?.createdAt ?? record.createdAt,
        lastOpenedAt: previous?.lastOpenedAt,
        assets: { ...(previous?.assets ?? {}), ...record.assets },
        assetUrls: previous?.assetUrls,
      };

      const saved = await saveDeck(deck);
      results.push({
        file: item.file.name,
        deck: { deck: saved, updated: Boolean(previous) },
        warnings: doc.warnings
          .filter((warning) => warning.severity === 'warning')
          .map((warning) => warning.message),
      });
    } catch (cause) {
      results.push({
        file: item.file.name,
        error: cause instanceof Error ? cause.message : 'No se pudo importar el archivo.',
      });
    }
  }

  return results;
}

export async function importMarkdownFiles(
  files: ImportFile[],
  options: { baseUrl?: string } = {},
): Promise<ImportedDeck[]> {
  const items = await importMarkdownFilesDetailed(files, options);
  const successes = items.flatMap((item) => (item.deck ? [item.deck] : []));
  if (successes.length === 0) {
    const first = items.find((item) => item.error);
    throw new Error(first?.error ?? 'No se pudo importar ningún deck.');
  }
  return successes;
}

export async function importFromUrl(url: string): Promise<ImportedDeck[]> {
  const clean = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    throw new Error('La dirección no es una URL válida.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Solo se pueden importar direcciones http o https.');
  }

  let response: Response;
  try {
    response = await fetch(parsed.href, { credentials: 'omit' });
  } catch {
    throw new Error(
      'No se pudo descargar la URL. Puede que el servidor bloquee el acceso desde el navegador (CORS).',
    );
  }

  if (!response.ok) {
    throw new Error(`El servidor respondió ${response.status}.`);
  }

  const markdown = await response.text();
  if (!markdown.trim()) {
    throw new Error('La URL devolvió un documento vacío.');
  }

  const fileName =
    parsed.pathname.split('/').filter(Boolean).pop() || 'documento.md';
  const file = new File([markdown], fileName, { type: 'text/markdown' });
  return importMarkdownFiles([{ file, path: fileName }], {
    baseUrl: new URL('.', parsed.href).href,
  });
}

export async function importPasted(
  markdown: string,
  sourceName = 'documento.md',
): Promise<ImportedDeck[]> {
  if (!markdown.trim()) {
    throw new Error('El texto está vacío.');
  }
  const file = new File([markdown], sourceName, { type: 'text/markdown' });
  return importMarkdownFiles([{ file, path: sourceName }]);
}

export function filesFromInput(fileList: FileList): ImportFile[] {
  return Array.from(fileList).map((file) => ({
    file,
    path: file.webkitRelativePath || file.name,
  }));
}

type FsEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (
    success: (file: File) => void,
    error?: (error: DOMException) => void,
  ) => void;
  createReader?: () => {
    readEntries: (
      success: (entries: FsEntry[]) => void,
      error?: (error: DOMException) => void,
    ) => void;
  };
};

function readDirectory(
  reader: NonNullable<ReturnType<NonNullable<FsEntry['createReader']>>>,
): Promise<FsEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FsEntry[] = [];
    const readBatch = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(all);
          return;
        }
        all.push(...entries);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

function readFileEntry(entry: FsEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!entry.file) {
      reject(new Error(`No se pudo leer ${entry.name}.`));
      return;
    }
    entry.file(resolve, reject);
  });
}

async function walkEntry(entry: FsEntry, parent: string): Promise<ImportFile[]> {
  const path = parent ? `${parent}/${entry.name}` : entry.name;
  if (entry.isFile) {
    return [{ file: await readFileEntry(entry), path }];
  }

  if (entry.isDirectory && entry.createReader) {
    const children = await readDirectory(entry.createReader());
    const nested = await Promise.all(
      children.map((child) => walkEntry(child, path)),
    );
    return nested.flat();
  }

  return [];
}

export async function filesFromDrop(
  dataTransfer: DataTransfer,
): Promise<ImportFile[]> {
  const entries: FsEntry[] = [];
  const plainFiles: ImportFile[] = [];

  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind !== 'file') continue;
    const withEntry = item as DataTransferItem & {
      webkitGetAsEntry?: () => FsEntry | null;
    };
    const entry = withEntry.webkitGetAsEntry?.();
    if (entry) {
      entries.push(entry);
    } else {
      const file = item.getAsFile();
      if (file) plainFiles.push({ file, path: file.name });
    }
  }

  if (entries.length > 0) {
    const walked = await Promise.all(entries.map((entry) => walkEntry(entry, '')));
    return [...walked.flat(), ...plainFiles];
  }

  return Array.from(dataTransfer.files).map((file) => ({
    file,
    path: file.webkitRelativePath || file.name,
  }));
}
