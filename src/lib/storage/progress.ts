import {
  cloudLoadProgress,
  cloudSaveProgress,
  isCloudMode,
} from '../cloud';
import { idbGet, idbPut, STORES } from './db';

export type QuizProgress = {
  attempts: number;
  correct: number;
  lastCorrect: boolean;
  lastAt: number;
};

export type CardProgress = {
  due: number;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  lastGrade?: number;
  lastAt?: number;
};

export type SessionRecord = {
  id: string;
  type: 'quiz' | 'cards' | 'qa';
  at: number;
  correct?: number;
  total?: number;
};

export type DeckProgress = {
  deckId: string;
  sections: Record<string, { readAt: number }>;
  quizzes: Record<string, QuizProgress>;
  cards: Record<string, CardProgress>;
  qa: Record<string, { revealed: number; lastAt?: number }>;
  sessions: SessionRecord[];
  lastStudiedAt?: number;
};

const LS_PROGRESS_KEY = 'soffia:progress';

// En modo nube se envía siempre la última instantánea y se evita que dos
// peticiones del mismo deck se pisen fuera de orden. Mientras una está en
// vuelo, los cambios se acumulan y se envían al terminar.
const remotePending = new Map<string, DeckProgress>();
const remoteInFlight = new Set<string>();

function queueRemoteSave(progress: DeckProgress): void {
  remotePending.set(progress.deckId, progress);
  void flushRemoteSave(progress.deckId);
}

async function flushRemoteSave(deckId: string): Promise<void> {
  if (remoteInFlight.has(deckId)) return;
  remoteInFlight.add(deckId);
  try {
    while (remotePending.has(deckId)) {
      const next = remotePending.get(deckId)!;
      remotePending.delete(deckId);
      try {
        await cloudSaveProgress(deckId, next);
      } catch {
        // La caché local conserva el avance; el siguiente cambio reintenta.
      }
    }
  } finally {
    remoteInFlight.delete(deckId);
  }
}

export function defaultProgress(deckId: string): DeckProgress {
  return {
    deckId,
    sections: {},
    quizzes: {},
    cards: {},
    qa: {},
    sessions: [],
  };
}

function readLocalProgress(): Record<string, DeckProgress> {
  try {
    const raw = localStorage.getItem(LS_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, DeckProgress>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalProgress(progress: DeckProgress): void {
  try {
    const all = readLocalProgress();
    all[progress.deckId] = progress;
    localStorage.setItem(LS_PROGRESS_KEY, JSON.stringify(all));
  } catch {
    // Sin persistencia: el progreso vive en memoria.
  }
}

export async function loadProgress(deckId: string): Promise<DeckProgress> {
  let remote: DeckProgress | null = null;
  if (isCloudMode) {
    try {
      const loaded = (await cloudLoadProgress(deckId)) as Partial<DeckProgress> | null;
      if (loaded) remote = { ...defaultProgress(deckId), ...loaded, deckId };
    } catch {
      // Sin red o sesión: se usa la caché local.
    }
  }

  let local: DeckProgress | null = null;
  try {
    const cached = await idbGet<DeckProgress>(STORES.progress, deckId);
    if (cached) local = { ...defaultProgress(deckId), ...cached, deckId };
  } catch {
    // Fallback a localStorage.
  }
  if (!local) {
    const fallback = readLocalProgress()[deckId];
    if (fallback) local = { ...defaultProgress(deckId), ...fallback, deckId };
  }

  // Si el navegador se cerró antes de que terminara un guardado remoto, la
  // caché local puede ser más reciente. En ese caso se recupera y se reenvía.
  if (remote && (!local || (remote.lastStudiedAt ?? 0) >= (local.lastStudiedAt ?? 0))) {
    void idbPut(STORES.progress, remote).catch(() => writeLocalProgress(remote));
    return remote;
  }
  if (local) {
    if (isCloudMode) queueRemoteSave(local);
    return local;
  }
  return defaultProgress(deckId);
}

export async function saveProgress(progress: DeckProgress): Promise<void> {
  if (isCloudMode) queueRemoteSave(progress);

  try {
    await idbPut(STORES.progress, progress);
    return;
  } catch {
    writeLocalProgress(progress);
  }
}

export async function deleteProgress(deckId: string): Promise<void> {
  const empty = defaultProgress(deckId);
  if (isCloudMode) queueRemoteSave(empty);
  try {
    await idbPut(STORES.progress, empty);
  } catch {
    writeLocalProgress(empty);
  }
}
