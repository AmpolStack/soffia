const IMAGE_EXTENSION = /\.(avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

const IMAGE_HOST = /(^|\.)((images?|img|cdn|static|media)\.)|images\.openai\.com|images\.unsplash\.com|cloudinary\.com|imgur\.com/i;

export function looksLikeImageUrl(url: string): boolean {
  const clean = url.trim();
  if (!clean) return false;
  if (clean.startsWith('data:image/')) return true;
  if (IMAGE_EXTENSION.test(clean)) return true;
  return IMAGE_HOST.test(clean);
}

/**
 * Normaliza los artefactos más comunes que deja ChatGPT al copiar Markdown.
 * La idea es no romper el contenido: solo arreglar aquello que impide que se
 * vea bien (imágenes como enlaces, listas escapadas, entidades, etc.).
 */
export function normalizeMarkdown(input: string): string {
  let text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
  text = text.replace(/&#x20;/gi, ' ');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/【[^】]*】/g, '');

  // ChatGPT a veces escapa los números de lista: "1\. Texto".
  text = text.replace(/^(\s*)(\d+)\\\.\s+/gm, '$1$2. ');

  // "[Image: caption](url)" es una imagen, no un enlace.
  text = text.replace(
    /\[Image:\s*([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/gi,
    (_match, caption: string, url: string, title?: string) =>
      `![${caption.trim()}](${url}${title ? ` "${title}"` : ''})`,
  );

  // Los favicons que inserta ChatGPT no aportan nada visualmente.
  text = text.replace(
    /\[image\]\(https?:\/\/www\.google\.com\/s2\/favicons[^)]*\)/gi,
    '',
  );

  // Una línea que es solo un enlace a una imagen se convierte en imagen.
  text = text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      const onlyLink = trimmed.match(/^\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
      if (!onlyLink) return line;
      const [, label, url, title] = onlyLink;
      if (!looksLikeImageUrl(url)) return line;
      return `![${label}](${url}${title ? ` "${title}"` : ''})`;
    })
    .join('\n');

  // Un enlace suelto a una imagen dentro de una línea de texto.
  text = text.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (match, label: string, url: string) => {
      if (!looksLikeImageUrl(url)) return match;
      if (/^!\[/.test(match)) return match;
      return `![${label}](${url})`;
    },
  );

  // Espacios al final de línea y líneas en blanco excesivas.
  text = text.replace(/[ \t]+$/gm, '');
  text = text.replace(/\n{4,}/g, '\n\n\n');
  return `${text.trim()}\n`;
}
