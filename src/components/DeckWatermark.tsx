import type { CSSProperties } from 'react';
import type { DeckRecord } from '../lib/storage';
import { getWatermarkMetrics } from '../lib/reader/watermark';

export function DeckWatermark({ deck }: { deck: DeckRecord | null }) {
  if (!deck) return null;

  const { text, fontSize } = getWatermarkMetrics(deck.title);
  if (!text) return null;

  return (
    <div
      className="deck-watermark"
      aria-hidden="true"
      style={{ '--watermark-size': `${fontSize}px` } as CSSProperties}
    >
      <span className="deck-watermark__text">{text}</span>
    </div>
  );
}
