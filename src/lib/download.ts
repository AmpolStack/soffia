import { slugify } from './format/utils';

export function rfcFileName(sourceName: string): string {
  const base = sourceName.replace(/\.(md|markdown|txt)$/i, '').trim();
  const slug = base ? slugify(base).slice(0, 109).replace(/-+$/g, '') : 'deck';
  const bytes = new Uint8Array(2);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    bytes[0] = Math.floor(Math.random() * 256);
    bytes[1] = Math.floor(Math.random() * 256);
  }
  const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `soffia-${slug}-${id}.md`;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
