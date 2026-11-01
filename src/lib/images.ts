const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Valida una fuente de imagen antes de pasarla al DOM.
 * Las rutas relativas se consideran locales; los esquemas desconocidos se rechazan.
 */
export function isSafeImageSrc(src: string): boolean {
  const clean = src.trim();
  if (!clean) return false;
  if (/^data:image\//i.test(clean)) return true;
  if (/^blob:/i.test(clean)) return true;
  if (/^\/\//.test(clean)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) {
    try {
      const url = new URL(clean);
      return SAFE_PROTOCOLS.has(url.protocol) && !url.username && !url.password;
    } catch {
      return false;
    }
  }
  return true;
}

export function isRemoteImage(src: string): boolean {
  return /^(https?:)?\/\//i.test(src.trim());
}

export function isHttpsImage(src: string): boolean {
  return /^https:\/\//i.test(src.trim());
}
