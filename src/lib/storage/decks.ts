import { parseDocument } from '../format/parse';
import type { SofiaDocument } from '../format/types';
import { hashString } from '../format/utils';
import {
  AuthError,
  cloudAssetUrl,
  cloudDelete,
  cloudGet,
  cloudList,
  cloudSave,
  cloudTouch,
  isCloudMode,
} from '../cloud';
import type { CloudDeckMeta, CloudAssetUpload } from '../cloud';
import { idbDelete, idbGet, idbGetAll, idbPut, STORES } from './db';

export type DeckAssetMap = Record<string, Blob>;

export type DeckSummary = {
  sections: number;
  quizzes: number;
  cards: number;
  qa: number;
  references: number;
  images: number;
  words: number;
  minutes: number;
};

export type DeckRecord = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  tags: string[];
  language: string;
  author?: string;
  sourceName: string;
  markdown: string;
  assets: DeckAssetMap;
  assetUrls?: Record<string, string>;
  baseUrl?: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
  summary: DeckSummary;
  storageWarning?: string;
};

const LS_DECKS_KEY = 'soffia:decks';

function readLocalDecks(): DeckRecord[] {
  try {
    const raw = localStorage.getItem(LS_DECKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeckRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((deck) => ({ ...deck, assets: {} }));
  } catch {
    return [];
  }
}

function writeLocalDecks(decks: DeckRecord[]): void {
  try {
    const serializable = decks.map((deck) => ({ ...deck, assets: {} }));
    localStorage.setItem(LS_DECKS_KEY, JSON.stringify(serializable));
  } catch {
    // Sin almacenamiento persistente: la sesión sigue funcionando en memoria.
  }
}

export function summarizeDocument(doc: SofiaDocument): DeckSummary {
  return {
    sections: doc.sections.length,
    quizzes: doc.quizzes.length,
    cards: doc.flashcards.length,
    qa: doc.qa.length,
    references: doc.references.length,
    images: doc.images.length,
    words: doc.wordCount,
    minutes: doc.meta.estimatedMinutes,
  };
}

function cloudToDeck(meta: CloudDeckMeta, markdown: string): DeckRecord {
  return {
    id: meta.id,
    title: meta.title,
    subtitle: meta.subtitle,
    description: meta.description,
    tags: meta.tags ?? [],
    language: meta.language || 'es',
    author: meta.author,
    sourceName: meta.sourceName,
    markdown,
    assets: {},
    assetUrls: Object.fromEntries(
      (meta.assetKeys ?? []).map((key) => [key.toLowerCase(), cloudAssetUrl(meta.id, key)]),
    ),
    createdAt: Date.parse(meta.createdAt),
    updatedAt: Date.parse(meta.updatedAt),
    lastOpenedAt: meta.lastOpenedAt ? Date.parse(meta.lastOpenedAt) : undefined,
    summary: {
      sections: meta.summary.sections,
      quizzes: meta.summary.quizzes,
      cards: meta.summary.cards,
      qa: meta.summary.questions,
      references: meta.summary.references,
      images: meta.summary.images,
      words: meta.summary.words,
      minutes: meta.summary.minutes,
    },
    storageWarning: meta.storageWarning,
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(blob);
  });
}

async function cloudSaveDeck(deck: DeckRecord): Promise<DeckRecord> {
  const assets: CloudAssetUpload[] = [];
  for (const [key, blob] of Object.entries(deck.assets)) {
    if (!(blob instanceof Blob)) continue;
    assets.push({
      key,
      contentType: blob.type || 'application/octet-stream',
      base64: await blobToBase64(blob),
    });
  }

  const response = await cloudSave({
    markdown: deck.markdown,
    sourceName: deck.sourceName,
    assets,
  });
  const item = response.results[0];
  if (!item?.ok || !item.deck) {
    const detail = item?.errors?.map((error) => error.message).join(' ') || 'El servidor rechazó el archivo.';
    throw new Error(detail);
  }
  return cloudToDeck(item.deck, deck.markdown);
}

export function buildDeckRecord(input: {
  markdown: string;
  sourceName: string;
  assets?: DeckAssetMap;
  baseUrl?: string;
}): DeckRecord {
  const doc = parseDocument(input.markdown, { sourceName: input.sourceName });
  const now = Date.now();

  return {
    id: doc.meta.id,
    title: doc.meta.title,
    subtitle: doc.meta.subtitle,
    description: doc.meta.description,
    tags: doc.meta.tags,
    language: doc.meta.language ?? 'es',
    author: doc.meta.author,
    sourceName: input.sourceName,
    markdown: input.markdown,
    assets: input.assets ?? {},
    baseUrl: input.baseUrl,
    createdAt: now,
    updatedAt: now,
    summary: summarizeDocument(doc),
  };
}

export async function listDecks(): Promise<DeckRecord[]> {
  if (isCloudMode) {
    const decks = await cloudList();
    return decks.map((meta) => cloudToDeck(meta, ''));
  }
  try {
    const decks = await idbGetAll<DeckRecord>(STORES.decks);
    return decks.sort(
      (a, b) =>
        (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt),
    );
  } catch {
    return readLocalDecks().sort(
      (a, b) =>
        (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt),
    );
  }
}

export async function getDeck(id: string): Promise<DeckRecord | null> {
  if (isCloudMode) {
    try {
      const deck = await cloudGet(id);
      return cloudToDeck(deck.meta, deck.markdown);
    } catch (error) {
      if (error instanceof AuthError) throw error;
      return null;
    }
  }
  try {
    const deck = await idbGet<DeckRecord>(STORES.decks, id);
    if (deck) return deck;
  } catch {
    // Fallback abajo.
  }
  return readLocalDecks().find((deck) => deck.id === id) ?? null;
}

export async function saveDeck(deck: DeckRecord): Promise<DeckRecord> {
  if (isCloudMode) return cloudSaveDeck(deck);

  const next: DeckRecord = {
    ...deck,
    updatedAt: Date.now(),
  };

  try {
    await idbPut(STORES.decks, next);
    return next;
  } catch {
    const warning =
      'Este navegador no permite guardar imágenes localmente. El deck se conservará sin archivos adjuntos.';
    const fallback: DeckRecord = {
      ...next,
      assets: {},
      storageWarning: warning,
    };
    const decks = readLocalDecks().filter((item) => item.id !== fallback.id);
    decks.push(fallback);
    writeLocalDecks(decks);
    return fallback;
  }
}

export async function touchDeck(id: string): Promise<void> {
  if (isCloudMode) {
    try {
      await cloudTouch(id);
    } catch {
      // Marcar como abierto es best-effort: no debe bloquear la lectura.
    }
    return;
  }
  const deck = await getDeck(id);
  if (!deck) return;
  await saveDeck({ ...deck, lastOpenedAt: Date.now() });
}

export async function deleteDeck(id: string): Promise<void> {
  if (isCloudMode) {
    await cloudDelete(id);
    return;
  }
  try {
    await idbDelete(STORES.decks, id);
  } catch {
    const decks = readLocalDecks().filter((deck) => deck.id !== id);
    writeLocalDecks(decks);
  }
}

export function uniqueDeckId(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

export function deckFingerprint(markdown: string): string {
  return hashString(markdown);
}
