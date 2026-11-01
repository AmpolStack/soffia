export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'seccion';
}

export function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let index = 2;
  while (used.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  used.add(id);
  return id;
}

export function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~>#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(value: string): number {
  const text = stripMarkdown(value);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function domainOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}
