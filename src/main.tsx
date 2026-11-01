import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import '@fontsource-variable/red-rose';
import { App } from './App';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ToastProvider } from './contexts/ToastContext';
import {
  applySettingsToDocument,
  loadSettings,
} from './lib/storage/settings';
import './styles/index.css';

applySettingsToDocument(loadSettings());

const Router =
  import.meta.env.VITE_STORAGE_MODE === 'cloud' ? BrowserRouter : HashRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <ToastProvider>
        <Router>
          <AuthProvider>
            <App />
          </AuthProvider>
        </Router>
      </ToastProvider>
    </SettingsProvider>
  </StrictMode>,
);
