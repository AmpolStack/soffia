import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applySettingsToDocument,
  defaultSettings,
  loadSettings,
  type Settings,
} from './settings';

function mockStorage(value: string | null) {
  const getItem = vi.fn(() => value);
  vi.stubGlobal('localStorage', { getItem, setItem: vi.fn() });
  return getItem;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('settings', () => {
  it('usa los valores por defecto sin configuración', () => {
    mockStorage(null);
    expect(loadSettings()).toEqual(defaultSettings);
  });

  it('migra configuraciones antiguas a tema oscuro y acento azul', () => {
    mockStorage(JSON.stringify({ fontScale: 'large', reduceMotion: true }));
    expect(loadSettings()).toEqual({
      fontScale: 'large',
      reduceMotion: true,
      theme: 'dark',
      accent: 'blue',
    });
  });

  it('lee tema y acento persistidos', () => {
    mockStorage(
      JSON.stringify({
        fontScale: 'compact',
        reduceMotion: false,
        theme: 'light',
        accent: 'green',
      }),
    );
    expect(loadSettings()).toEqual({
      fontScale: 'compact',
      reduceMotion: false,
      theme: 'light',
      accent: 'green',
    });
  });

  it('ignora valores inválidos', () => {
    mockStorage(
      JSON.stringify({
        fontScale: 'tiny',
        theme: 'sepia',
        accent: 'red',
      }),
    );
    expect(loadSettings()).toMatchObject({
      fontScale: 'normal',
      theme: 'dark',
      accent: 'blue',
    });
  });

  it('aplica los atributos al documento', () => {
    const dataset: Record<string, string> = {};
    const root = { dataset, style: { colorScheme: '' } };
    vi.stubGlobal('document', { documentElement: root });
    const settings: Settings = {
      fontScale: 'large',
      reduceMotion: true,
      theme: 'light',
      accent: 'green',
    };

    applySettingsToDocument(settings);

    expect(dataset).toEqual({
      theme: 'light',
      accent: 'green',
      fontScale: 'large',
      reduceMotion: 'true',
    });
    expect(root.style.colorScheme).toBe('light');
  });
});
