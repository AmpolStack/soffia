import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { AppHeader } from './components/AppHeader';
import { DeckShell } from './components/DeckShell';
import { FormatGuideView } from './components/FormatGuideView';
import { LoginView } from './components/LoginView';
import { LibraryView } from './components/library/LibraryView';
import { ReaderView } from './components/reader/ReaderView';
import { FlashcardsSession } from './components/study/FlashcardsSession';
import { QASession } from './components/study/QASession';
import { QuizSession } from './components/study/QuizSession';
import { StudyDashboard } from './components/study/StudyDashboard';
import { useAuth } from './contexts/AuthContext';

function NotFound() {
  return (
    <div className="library-page">
      <AppHeader />
      <main className="deck-error">
        <span className="deck-error__icon">
          <Compass size={24} aria-hidden="true" />
        </span>
        <h1>Esta página no existe</h1>
        <p>Puede que el enlace esté mal escrito o que el deck se haya movido.</p>
        <Link className="button button--solid" to="/">
          <ArrowLeft size={16} aria-hidden="true" />
          Volver a la biblioteca
        </Link>
      </main>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { checking, authenticated } = useAuth();
  if (checking) {
    return (
      <main className="deck-loading" aria-busy="true">
        <span className="loading-mark">soffia</span>
        <div className="loading-bar">
          <span />
        </div>
        <p>Comprobando sesión…</p>
      </main>
    );
  }
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route path="/formato" element={<FormatGuideView />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <LibraryView />
            </RequireAuth>
          }
        />
        <Route
          path="/deck/:deckId"
          element={
            <RequireAuth>
              <DeckShell />
            </RequireAuth>
          }
        >
          <Route index element={<ReaderView />} />
          <Route path="study" element={<StudyDashboard />} />
          <Route path="quiz" element={<QuizSession />} />
          <Route path="cards" element={<FlashcardsSession />} />
          <Route path="qa" element={<QASession />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
