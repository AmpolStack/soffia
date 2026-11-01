import type { CSSProperties } from 'react';
import type { DeckRecord } from '../lib/storage';

export function DeckWatermark({ deck }: { deck: DeckRecord | null }) {
  if (!deck) return null;

  const title = deck.title.trim();
  if (!title) return null;

  // Ajusta el tamaño para que un título largo siga cabiendo en una sola columna.
  const size = Math.min(
    190,
    Math.max(64, Math.round(1150 / Math.max(6, title.length))),
  );

  return (
    <div
      className="deck-watermark"
      aria-hidden="true"
      style={{ '--watermark-size': `${size}px` } as CSSProperties}
    >
      <span className="deck-watermark__text">{title}</span>
    </div>
  );
}
