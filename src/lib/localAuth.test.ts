// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLocalSession,
  createLocalSession,
  loadLocalSession,
  LOCAL_AUTH,
  verifyLocalCredentials,
} from './localAuth';

describe('localAuth', () => {
  beforeEach(() => {
    clearLocalSession();
  });

  it('valida las credenciales locales', () => {
    expect(LOCAL_AUTH.username).toBe('soffia');
    expect(verifyLocalCredentials(' soffia ', 'soffia')).toBe(true);
    expect(verifyLocalCredentials('soffia', 'otra')).toBe(false);
  });

  it('crea y recupera una sesión', () => {
    const session = createLocalSession();
    expect(session.username).toBe('soffia');
    expect(loadLocalSession()?.username).toBe('soffia');
  });

  it('ignora y elimina sesiones caducadas', () => {
    localStorage.setItem(
      'soffia:local-session',
      JSON.stringify({
        username: LOCAL_AUTH.username,
        name: LOCAL_AUTH.name,
        expiresAt: Date.now() - 1000,
      }),
    );

    expect(loadLocalSession()).toBeNull();
    expect(localStorage.getItem('soffia:local-session')).toBeNull();
  });
});
