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
  applySettingsToDocument,
  defaultSettings,
  loadSettings,
  saveSettings,
  type Accent,
  type FontScale,
  type Settings,
  type Theme,
} from '../lib/storage/settings';

type SettingsContextValue = {
  settings: Settings;
  setFontScale: (fontScale: FontScale) => void;
  setReduceMotion: (reduceMotion: boolean) => void;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: Accent) => void;
  updateSettings: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  useEffect(() => {
    saveSettings(settings);
    applySettingsToDocument(settings);
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const setFontScale = useCallback(
    (fontScale: FontScale) => updateSettings({ fontScale }),
    [updateSettings],
  );

  const setReduceMotion = useCallback(
    (reduceMotion: boolean) => updateSettings({ reduceMotion }),
    [updateSettings],
  );

  const setTheme = useCallback(
    (theme: Theme) => updateSettings({ theme }),
    [updateSettings],
  );

  const setAccent = useCallback(
    (accent: Accent) => updateSettings({ accent }),
    [updateSettings],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      setFontScale,
      setReduceMotion,
      setTheme,
      setAccent,
      updateSettings,
    }),
    [settings, setFontScale, setReduceMotion, setTheme, setAccent, updateSettings],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings debe usarse dentro de SettingsProvider.');
  }
  return context;
}

export { defaultSettings };
