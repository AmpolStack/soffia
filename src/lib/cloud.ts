export type CloudDeckMeta = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  tags: string[];
  language: string;
  author?: string;
  sourceName: string;
  fileName: string;
  shortId: string;
  assetKeys: string[];
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  summary: {
    sections: number;
    subsections: number;
    quizzes: number;
    cards: number;
    questions: number;
    references: number;
    images: number;
    words: number;
    minutes: number;
  };
  storageWarning?: string;
};

export type CloudValidationMessage = {
  line?: number;
  message: string;
  severity: 'error' | 'warning';
};

export type CloudImportItem = {
  file: string;
  ok: boolean;
  deck?: CloudDeckMeta;
  errors: CloudValidationMessage[];
  warnings: CloudValidationMessage[];
};

export type CloudImportResponse = {
  imported: number;
  failed: number;
  results: CloudImportItem[];
};

export type CloudAssetUpload = {
  key: string;
  contentType: string;
  base64: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export const isCloudMode = import.meta.env.VITE_STORAGE_MODE === 'cloud';

export class AuthError extends Error {
  constructor() {
    super('Sesión no iniciada.');
    this.name = 'AuthError';
  }
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('content-type', 'application/json');
  if (init.method && init.method !== 'GET') headers.set('x-soffia-request', '1');
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new Error('No se pudo contactar con el servidor. Revisa tu conexión.');
  }
  if (response.status === 401) {
    if (path !== '/auth/login') {
      window.dispatchEvent(new Event('soffia:unauthorized'));
    }
    throw new AuthError();
  }
  return response;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init);
  if (!response.ok) {
    let message =
      response.status === 429
        ? 'Demasiados intentos. Espera un minuto antes de volver a probar.'
        : response.status === 413
          ? 'El archivo o sus imágenes superan el límite de tamaño.'
          : `Error ${response.status}.`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Respuesta sin JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export async function cloudLogin(username: string, password: string) {
  try {
    return await json<{ ok: boolean; username: string; name: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error('Usuario o contraseña incorrectos.');
    }
    if (error instanceof TypeError) {
      throw new Error('No se pudo contactar con el servidor. Revisa tu conexión.');
    }
    throw error;
  }
}

export async function cloudLogout() {
  await json('/auth/logout', { method: 'POST' });
}

export async function cloudSession() {
  try {
    return await json<{ authenticated: boolean; username: string; name: string }>('/auth/session');
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }
}

export async function cloudList(): Promise<CloudDeckMeta[]> {
  return json<CloudDeckMeta[]>('/decks');
}

export async function cloudGet(id: string): Promise<{ meta: CloudDeckMeta; markdown: string }> {
  return json(`/decks/${encodeURIComponent(id)}`);
}

export async function cloudSave(input: {
  markdown: string;
  sourceName: string;
  assets: CloudAssetUpload[];
}): Promise<CloudImportResponse> {
  return json('/decks/import', {
    method: 'POST',
    body: JSON.stringify({ files: [input] }),
  });
}

export async function cloudTouch(id: string) {
  await json(`/decks/${encodeURIComponent(id)}/touch`, { method: 'POST' });
}

export async function cloudDeleteAsset(deckId: string, key: string) {
  const path = key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  const response = await request(`/decks/${encodeURIComponent(deckId)}/assets/${path}`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`No se pudo borrar la imagen anterior (${response.status}).`);
  }
}

export async function cloudDelete(id: string) {
  const response = await request(`/decks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) throw new Error(`No se pudo eliminar (${response.status}).`);
}

export async function cloudLoadProgress(id: string) {
  const response = await request(`/progress/${encodeURIComponent(id)}`);
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`No se pudo cargar el progreso (${response.status}).`);
  return (await response.json()) as unknown;
}

export async function cloudSaveProgress(id: string, progress: unknown) {
  await json(`/progress/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(progress),
  });
}

export async function cloudDownloadDeck(id: string): Promise<{ blob: Blob; fileName: string }> {
  const response = await request(`/decks/${encodeURIComponent(id)}/file`);
  if (!response.ok) throw new Error(`No se pudo descargar el deck (${response.status}).`);
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
  const fileName = match
    ? decodeURIComponent(match[1].replace(/"/g, '').trim())
    : `soffia-${id}.md`;
  return { blob: await response.blob(), fileName };
}

export function cloudAssetUrl(deckId: string, key: string): string {
  return `${API_BASE}/decks/${encodeURIComponent(deckId)}/assets/${key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}
