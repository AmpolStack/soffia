const SESSION_KEY = 'soffia:local-session';
const SESSION_TTL = 12 * 60 * 60 * 1000;

export type LocalSession = {
  username: string;
  name: string;
  expiresAt: number;
};

function bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function validName(value: string): boolean {
  return value.length > 0 && value.length <= 20 && bytes(value) <= 70;
}

function validUsername(value: string): boolean {
  return value.length > 0 && value.length <= 15 && bytes(value) <= 70;
}

function validPassword(value: string): boolean {
  return value.length > 0 && bytes(value) <= 70;
}

const configuredName = (import.meta.env.VITE_LOCAL_AUTH_NAME ?? '').trim();
const configuredUsername = (import.meta.env.VITE_LOCAL_AUTH_USERNAME ?? '').trim();
const configuredPassword = import.meta.env.VITE_LOCAL_AUTH_PASSWORD ?? '';

export const LOCAL_AUTH = {
  name: validName(configuredName) ? configuredName : 'Soffia',
  username: validUsername(configuredUsername) ? configuredUsername : 'soffia',
  password: validPassword(configuredPassword) ? configuredPassword : 'soffia',
};

export function verifyLocalCredentials(
  username: string,
  password: string,
): boolean {
  return (
    username.trim() === LOCAL_AUTH.username &&
    password === LOCAL_AUTH.password
  );
}

export function createLocalSession(): LocalSession {
  const session: LocalSession = {
    username: LOCAL_AUTH.username,
    name: LOCAL_AUTH.name,
    expiresAt: Date.now() + SESSION_TTL,
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Sin persistencia: la sesión vive en memoria hasta recargar.
  }
  return session;
}

export function loadLocalSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalSession>;
    if (
      parsed.username !== LOCAL_AUTH.username ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Date.now()
    ) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return {
      username: LOCAL_AUTH.username,
      name:
        typeof parsed.name === 'string' && validName(parsed.name)
          ? parsed.name
          : LOCAL_AUTH.name,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function clearLocalSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Sin persistencia.
  }
}
