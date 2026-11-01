export type FontScale = 'compact' | 'normal' | 'large';
export type Theme = 'dark' | 'light';
export type Accent = 'blue' | 'green';

export type Settings = {
  fontScale: FontScale;
  reduceMotion: boolean;
  theme: Theme;
  accent: Accent;
};

const LS_SETTINGS_KEY = 'soffia:settings';

export const defaultSettings: Settings = {
  fontScale: 'normal',
  reduceMotion: false,
  theme: 'dark',
  accent: 'blue',
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      fontScale:
        parsed.fontScale === 'compact' || parsed.fontScale === 'large'
          ? parsed.fontScale
          : 'normal',
      reduceMotion: Boolean(parsed.reduceMotion),
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      accent: parsed.accent === 'green' ? 'green' : 'blue',
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Sin persistencia: se mantiene en memoria.
  }
}

export function applySettingsToDocument(settings: Settings): void {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.accent = settings.accent;
  root.dataset.fontScale = settings.fontScale;
  root.dataset.reduceMotion = settings.reduceMotion ? 'true' : 'false';
  root.style.colorScheme = settings.theme;
}
