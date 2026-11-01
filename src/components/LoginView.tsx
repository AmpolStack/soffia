import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth, isCloudMode } from '../contexts/AuthContext';
import { SoffiaMark } from './SoffiaMark';

export function LoginView() {
  const { authenticated, checking, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!checking && authenticated) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-card">
        <Link className="login-brand" to="/login" aria-label="soffia">
          <SoffiaMark size={32} />
          <span>soffia</span>
        </Link>
        <h1>Entra en tu biblioteca.</h1>
        <p>
          {isCloudMode
            ? 'Entra con el usuario configurado en el servidor.'
            : 'Entra con el usuario configurado en este dispositivo.'}
        </p>

        <form className="login-form" onSubmit={submit}>
          <label className="field">
            <span>Usuario</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              maxLength={15}
              autoComplete="username"
              autoFocus
              disabled={checking}
              required
            />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              maxLength={70}
              autoComplete="current-password"
              disabled={checking}
              required
            />
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="button button--solid" disabled={busy || checking}>
            {checking ? 'Comprobando…' : busy ? 'Entrando…' : 'Entrar'}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </form>

        <p className="login-footnote">
          {isCloudMode
            ? 'Credenciales configuradas en el servidor.'
            : 'Credenciales configuradas en este dispositivo. Sesión de 12 h.'}
        </p>
      </div>
    </main>
  );
}
