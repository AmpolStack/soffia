import type { DeckRecord } from './storage';

export type TagEntry = {
  key: string;
  label: string;
  count: number;
};

export function normalizeTag(tag: string): string {
  return tag.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

export function buildTagIndex(decks: DeckRecord[]): TagEntry[] {
  const entries = new Map<string, TagEntry>();

  for (const deck of decks) {
    const seen = new Set<string>();
    for (const tag of deck.tags) {
      const label = tag.trim().replace(/\s+/g, ' ');
      if (!label) continue;
      const key = normalizeTag(label);
      if (seen.has(key)) continue;
      seen.add(key);
      const current = entries.get(key);
      if (current) current.count += 1;
      else entries.set(key, { key, label, count: 1 });
    }
  }

  return Array.from(entries.values()).sort((a, b) =>
    a.label.localeCompare(b.label, 'es'),
  );
}

export function filterDecksByTags(
  decks: DeckRecord[],
  selectedTags: Iterable<string>,
): DeckRecord[] {
  const selected = new Set(
    Array.from(selectedTags).map((tag) => normalizeTag(tag)),
  );
  if (selected.size === 0) return decks;

  return decks.filter((deck) =>
    deck.tags.some((tag) => selected.has(normalizeTag(tag))),
  );
}
