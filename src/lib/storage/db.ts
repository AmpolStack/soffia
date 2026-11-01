const DB_NAME = 'soffia';
const DB_VERSION = 1;

export const STORES = {
  decks: 'decks',
  progress: 'progress',
  settings: 'settings',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function indexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function openDb(): Promise<IDBDatabase> {
  if (!indexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB no está disponible.'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORES.decks)) {
          db.createObjectStore(STORES.decks, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.progress)) {
          db.createObjectStore(STORES.progress, { keyPath: 'deckId' });
        }
        if (!db.objectStoreNames.contains(STORES.settings)) {
          db.createObjectStore(STORES.settings, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('No se pudo abrir IndexedDB.'));
      request.onblocked = () =>
        reject(new Error('IndexedDB está bloqueado por otra pestaña.'));
    });
  }

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Error de IndexedDB.'));
  });
}

export async function idbGet<T>(
  store: string,
  key: IDBValidKey,
): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  return requestToPromise(tx.objectStore(store).get(key) as IDBRequest<T | undefined>);
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  return requestToPromise(tx.objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function idbPut<T>(store: string, value: T): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  await requestToPromise(tx.objectStore(store).put(value as unknown as object));
}

export async function idbDelete(
  store: string,
  key: IDBValidKey,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  await requestToPromise(tx.objectStore(store).delete(key));
}
