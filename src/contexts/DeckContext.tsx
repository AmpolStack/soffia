import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { parseDocument } from '../lib/format/parse';
import type { SofiaDocument } from '../lib/format/types';
import { scheduleCard, type Grade } from '../lib/srs';
import {
  defaultProgress,
  getDeck,
  loadProgress,
  saveDeck,
  saveProgress,
  touchDeck,
  type DeckRecord,
  type DeckProgress,
  type SessionRecord,
} from '../lib/storage';
import { createDemoDeck, DEMO_DECK_ID } from '../lib/demo';
import { isSafeImageSrc } from '../lib/images';
import { cloudDeleteAsset, isCloudMode } from '../lib/cloud';

type DeckContextValue = {
  deck: DeckRecord | null;
  document: SofiaDocument | null;
  progress: DeckProgress;
  loading: boolean;
  error: string | null;
  resolveSrc: (src: string) => string | null;
  replaceImage: (input: {
    oldSource: string;
    newSource: string;
    asset?: { key: string; blob: Blob };
    removeAssetKey?: string;
  }) => Promise<void>;
  markSectionRead: (sectionId: string) => void;
  unmarkSectionRead: (sectionId: string) => void;
  recordQuizAnswer: (quizId: string, correct: boolean) => void;
  recordCardGrade: (cardId: string, grade: Grade) => void;
  recordQaReveal: (itemId: string) => void;
  recordSession: (session: Omit<SessionRecord, 'id' | 'at'>) => void;
  resetProgress: () => void;
};

const DeckContext = createContext<DeckContextValue | null>(null);

function normalizeAssetKey(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Se usa el valor original si no es una URI válida.
  }
  return decoded.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
}

function baseName(value: string): string {
  const clean = value.replace(/[?#].*$/, '');
  const parts = clean.split('/');
  return parts[parts.length - 1] ?? clean;
}

export function DeckProvider({
  deckId,
  children,
}: {
  deckId: string;
  children: ReactNode;
}) {
  const [deck, setDeck] = useState<DeckRecord | null>(null);
  const [document, setDocument] = useState<SofiaDocument | null>(null);
  const [progress, setProgress] = useState<DeckProgress>(() =>
    defaultProgress(deckId),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetUrls, setAssetUrls] = useState<Map<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDeck(null);
    setDocument(null);
    setProgress(defaultProgress(deckId));

    async function load() {
      try {
        let record = await getDeck(deckId);

        if (!record && deckId === DEMO_DECK_ID) {
          record = await saveDeck(createDemoDeck());
        }

        if (!record) {
          throw new Error(
            'No encontramos este deck en este navegador. Puede que se haya eliminado o que el enlace sea de otro dispositivo.',
          );
        }

        const parsed = parseDocument(record.markdown, {
          sourceName: record.sourceName,
        });
        const storedProgress = await loadProgress(record.id);

        if (cancelled) return;
        setDeck(record);
        setDocument(parsed);
        setProgress(storedProgress);
        void touchDeck(record.id);
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudo cargar el deck.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  useEffect(() => {
    if (!deck) {
      setAssetUrls(new Map());
      return;
    }

    const urls: string[] = [];
    const map = new Map<string, string>();

    for (const [key, blob] of Object.entries(deck.assets)) {
      if (!(blob instanceof Blob)) continue;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      const normalized = normalizeAssetKey(key);
      map.set(normalized, url);
      map.set(normalizeAssetKey(baseName(key)), url);
    }

    setAssetUrls(map);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [deck]);

  const resolveSrc = useCallback(
    (src: string): string | null => {
      const raw = src.trim();
      if (!raw) return null;
      if (!isSafeImageSrc(raw)) return null;
      if (/^(data:|blob:|https?:)/i.test(raw)) return raw;
      if (raw.startsWith('//')) return `https:${raw}`;

      const withoutQuery = raw.replace(/[?#].*$/, '');
      const direct =
        deck?.assetUrls?.[normalizeAssetKey(raw)] ??
        deck?.assetUrls?.[normalizeAssetKey(withoutQuery)] ??
        deck?.assetUrls?.[normalizeAssetKey(baseName(withoutQuery))];
      if (direct) return direct;

      const candidates = [
        raw,
        withoutQuery,
        withoutQuery.replace(/^\.?\//, ''),
        baseName(withoutQuery),
      ];

      for (const candidate of candidates) {
        const found = assetUrls.get(normalizeAssetKey(candidate));
        if (found) return found;
      }

      if (deck?.baseUrl) {
        try {
          const resolved = new URL(raw, deck.baseUrl).href;
          return isSafeImageSrc(resolved) ? resolved : null;
        } catch {
          // La URL base no es válida; se intenta el siguiente fallback.
        }
      }

      if (raw.startsWith('/')) return raw;
      return null;
    },
    [assetUrls, deck?.baseUrl],
  );

  const commitProgress = useCallback(
    (recipe: (current: DeckProgress) => DeckProgress) => {
      setProgress((current) => {
        const next = recipe(current);
        void saveProgress(next);
        return next;
      });
    },
    [],
  );

  const markSectionRead = useCallback(
    (sectionId: string) => {
      commitProgress((current) => {
        if (current.sections[sectionId]) return current;
        return {
          ...current,
          sections: {
            ...current.sections,
            [sectionId]: { readAt: Date.now() },
          },
          lastStudiedAt: Date.now(),
        };
      });
    },
    [commitProgress],
  );

  const unmarkSectionRead = useCallback(
    (sectionId: string) => {
      commitProgress((current) => {
        if (!current.sections[sectionId]) return current;
        const sections = { ...current.sections };
        delete sections[sectionId];
        return {
          ...current,
          sections,
          lastStudiedAt: Date.now(),
        };
      });
    },
    [commitProgress],
  );

  const replaceImage = useCallback(
    async ({
      oldSource,
      newSource,
      asset,
      removeAssetKey,
    }: {
      oldSource: string;
      newSource: string;
      asset?: { key: string; blob: Blob };
      removeAssetKey?: string;
    }) => {
      if (!deck) return;
      if (!oldSource.trim() || !newSource.trim()) {
        throw new Error('La imagen necesita un origen y un destino.');
      }

      const nextMarkdown = deck.markdown.split(oldSource).join(newSource);
      if (nextMarkdown === deck.markdown) {
        throw new Error('No se encontró la imagen en el Markdown del deck.');
      }

      const nextAssets = { ...deck.assets };
      if (asset) nextAssets[asset.key] = asset.blob;
      if (removeAssetKey && removeAssetKey !== asset?.key) {
        const storedKey = Object.keys(nextAssets).find(
          (key) =>
            key.replace(/^\.\//, '').toLowerCase() ===
            removeAssetKey.toLowerCase(),
        );
        if (storedKey) delete nextAssets[storedKey];
      }

      const saved = await saveDeck({
        ...deck,
        markdown: nextMarkdown,
        assets: nextAssets,
      });

      if (isCloudMode && removeAssetKey && removeAssetKey !== asset?.key) {
        try {
          await cloudDeleteAsset(deck.id, removeAssetKey);
        } catch {
          // La imagen nueva ya está guardada; el archivo anterior puede quedar huérfano.
        }
        try {
          const refreshed = await getDeck(deck.id);
          if (refreshed) {
            setDeck(refreshed);
            setDocument(
              parseDocument(refreshed.markdown, { sourceName: refreshed.sourceName }),
            );
            return;
          }
        } catch {
          // Si falla la recarga, se usa la respuesta del guardado.
        }
      }

      setDeck(saved);
      setDocument(
        parseDocument(saved.markdown, { sourceName: saved.sourceName }),
      );
    },
    [deck],
  );

  const recordQuizAnswer = useCallback(
    (quizId: string, correct: boolean) => {
      commitProgress((current) => {
        const previous = current.quizzes[quizId];
        return {
          ...current,
          quizzes: {
            ...current.quizzes,
            [quizId]: {
              attempts: (previous?.attempts ?? 0) + 1,
              correct: (previous?.correct ?? 0) + (correct ? 1 : 0),
              lastCorrect: correct,
              lastAt: Date.now(),
            },
          },
          lastStudiedAt: Date.now(),
        };
      });
    },
    [commitProgress],
  );

  const recordCardGrade = useCallback(
    (cardId: string, grade: Grade) => {
      commitProgress((current) => ({
        ...current,
        cards: {
          ...current.cards,
          [cardId]: scheduleCard(current.cards[cardId], grade),
        },
        lastStudiedAt: Date.now(),
      }));
    },
    [commitProgress],
  );

  const recordQaReveal = useCallback(
    (itemId: string) => {
      commitProgress((current) => {
        const previous = current.qa[itemId];
        return {
          ...current,
          qa: {
            ...current.qa,
            [itemId]: {
              revealed: (previous?.revealed ?? 0) + 1,
              lastAt: Date.now(),
            },
          },
          lastStudiedAt: Date.now(),
        };
      });
    },
    [commitProgress],
  );

  const recordSession = useCallback(
    (session: Omit<SessionRecord, 'id' | 'at'>) => {
      commitProgress((current) => ({
        ...current,
        sessions: [
          {
            ...session,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            at: Date.now(),
          },
          ...current.sessions,
        ].slice(0, 100),
        lastStudiedAt: Date.now(),
      }));
    },
    [commitProgress],
  );

  const resetProgress = useCallback(() => {
    const next = defaultProgress(deckId);
    setProgress(next);
    void saveProgress(next);
  }, [deckId]);

  const value = useMemo<DeckContextValue>(
    () => ({
      deck,
      document,
      progress,
      loading,
      error,
      resolveSrc,
      replaceImage,
      markSectionRead,
      unmarkSectionRead,
      recordQuizAnswer,
      recordCardGrade,
      recordQaReveal,
      recordSession,
      resetProgress,
    }),
    [
      deck,
      document,
      progress,
      loading,
      error,
      resolveSrc,
      replaceImage,
      markSectionRead,
      unmarkSectionRead,
      recordQuizAnswer,
      recordCardGrade,
      recordQaReveal,
      recordSession,
      resetProgress,
    ],
  );

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDeck(): DeckContextValue {
  const context = useContext(DeckContext);
  if (!context) {
    throw new Error('useDeck debe usarse dentro de DeckProvider.');
  }
  return context;
}
