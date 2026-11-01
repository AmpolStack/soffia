import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  cloudLogin,
  cloudLogout,
  cloudSession,
  isCloudMode,
} from '../lib/cloud';
import {
  clearLocalSession,
  createLocalSession,
  loadLocalSession,
  verifyLocalCredentials,
} from '../lib/localAuth';

type AuthUser = { username: string; name: string };

type AuthContextValue = {
  checking: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(isCloudMode);
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (isCloudMode) return null;
    const session = loadLocalSession();
    return session ? { username: session.username, name: session.name } : null;
  });

  useEffect(() => {
    if (!isCloudMode) return;
    const onUnauthorized = () => setUser(null);
    window.addEventListener('soffia:unauthorized', onUnauthorized);
    return () => window.removeEventListener('soffia:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    if (!isCloudMode) return;
    let cancelled = false;
    void cloudSession()
      .then((session) => {
        if (cancelled) return;
        setUser(session ? { username: session.username, name: session.name } : null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isCloudMode || !user) return;
    const session = loadLocalSession();
    if (!session) return;
    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) {
      clearLocalSession();
      setUser(null);
      return;
    }
    const timer = window.setTimeout(() => {
      clearLocalSession();
      setUser(null);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [user]);

  const login = useCallback(async (username: string, password: string) => {
    if (!isCloudMode) {
      if (!verifyLocalCredentials(username, password)) {
        throw new Error('Usuario o contraseña incorrectos.');
      }
      const session = createLocalSession();
      setUser({ username: session.username, name: session.name });
      return;
    }
    const response = await cloudLogin(username, password);
    setUser({ username: response.username, name: response.name });
  }, []);

  const logout = useCallback(async () => {
    if (!isCloudMode) {
      clearLocalSession();
      setUser(null);
      return;
    }
    try {
      await cloudLogout();
    } catch {
      // Aunque falle la red, la sesión local se cierra.
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      checking,
      authenticated: Boolean(user),
      user,
      login,
      logout,
    }),
    [checking, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return context;
}

export { isCloudMode };
