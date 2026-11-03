import { useEffect, useRef, useState } from 'react';
import { LogOut, Moon, Palette, Settings, Sun } from 'lucide-react';
import { isCloudMode, useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { SoffiaMark } from './SoffiaMark';
import type { Accent, FontScale, Theme } from '../lib/storage/settings';

const FONT_OPTIONS: Array<{ value: FontScale; label: string; sample: string }> = [
  { value: 'compact', label: 'Pequeño', sample: 'A' },
  { value: 'normal', label: 'Normal', sample: 'A' },
  { value: 'large', label: 'Grande', sample: 'A' },
];

const THEME_OPTIONS: Array<{
  value: Theme;
  label: string;
  icon: typeof Sun;
}> = [
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'light', label: 'Claro', icon: Sun },
];

const ACCENT_OPTIONS: Array<{ value: Accent; label: string }> = [
  { value: 'blue', label: 'Azul' },
  { value: 'green', label: 'Verde' },
];

export function SettingsMenu() {
  const {
    settings,
    setFontScale,
    setReduceMotion,
    setTheme,
    setAccent,
  } = useSettings();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="settings" ref={wrapper}>
      <button
        type="button"
        className="icon-button header-action"
        onClick={() => setOpen((current) => !current)}
        aria-label="Ajustes de lectura"
        aria-expanded={open}
        title="Ajustes"
      >
        <Settings size={18} />
        <span className="header-action__label">Ajustes</span>
      </button>

      {open ? (
        <div className="settings-popover" role="dialog" aria-label="Ajustes de lectura">
          <div className="settings-popover__section">
            <span className="settings-popover__label">Tema</span>
            <div className="segmented" role="group" aria-label="Tema">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`segmented__button${
                      settings.theme === option.value ? ' is-active' : ''
                    }`}
                    onClick={() => setTheme(option.value)}
                    aria-pressed={settings.theme === option.value}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-popover__section">
            <span className="settings-popover__label">Resaltado</span>
            <div className="accent-options" role="group" aria-label="Color de resaltado">
              {ACCENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`accent-option accent-option--${option.value}${
                    settings.accent === option.value ? ' is-active' : ''
                  }`}
                  onClick={() => setAccent(option.value)}
                  aria-pressed={settings.accent === option.value}
                >
                  <span className="accent-option__swatch" aria-hidden="true" />
                  <span>{option.label}</span>
                  <Palette size={13} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <div className="settings-popover__section">
            <span className="settings-popover__label">Tamaño del texto</span>
            <div className="segmented" role="group" aria-label="Tamaño del texto">
              {FONT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`segmented__button${
                    settings.fontScale === option.value ? ' is-active' : ''
                  }`}
                  onClick={() => setFontScale(option.value)}
                  aria-pressed={settings.fontScale === option.value}
                >
                  <span
                    className={`segmented__sample segmented__sample--${option.value}`}
                    aria-hidden="true"
                  >
                    {option.sample}
                  </span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-popover__row">
            <div>
              <span className="settings-popover__label">Reducir movimiento</span>
              <p className="settings-popover__hint">
                Desactiva animaciones y desplazamientos suaves.
              </p>
            </div>
            <button
              type="button"
              className={`switch${settings.reduceMotion ? ' is-on' : ''}`}
              role="switch"
              aria-checked={settings.reduceMotion}
              onClick={() => setReduceMotion(!settings.reduceMotion)}
              aria-label="Reducir movimiento"
            >
              <span />
            </button>
          </div>

          {user ? (
            <div className="settings-popover__session">
              <div>
                <span className="settings-popover__label">{user.name}</span>
                <p className="settings-popover__hint">@{user.username}</p>
              </div>
              <button
                type="button"
                className="settings-popover__logout"
                onClick={() => {
                  setOpen(false);
                  void logout();
                }}
              >
                <LogOut size={14} aria-hidden="true" />
                Cerrar sesión
              </button>
            </div>
          ) : null}

          <div className="settings-popover__about">
            <span className="settings-popover__brand">
              <SoffiaMark size={13} />
              <span>soffia</span>
            </span>
            <span>{isCloudMode ? 'v0.1 · nube privada' : 'v0.1 · local y privado'}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
