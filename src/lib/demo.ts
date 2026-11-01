import seminario from '../../examples/impetigo/seminario.md?raw';
import costras from '../../examples/impetigo/images/lesion-costras.svg?raw';
import ampolloso from '../../examples/impetigo/images/impetigo-ampolloso.svg?raw';
import ectima from '../../examples/impetigo/images/ectima.svg?raw';
import algoritmo from '../../examples/impetigo/images/algoritmo-tratamiento.svg?raw';
import { buildDeckRecord, type DeckRecord } from './storage/decks';

export const DEMO_DECK_ID = 'impetigo';
export const DEMO_TITLE = 'Impétigo';

function svgBlob(source: string): Blob {
  return new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
}

export function createDemoDeck(): DeckRecord {
  return buildDeckRecord({
    markdown: seminario,
    sourceName: 'seminario.md',
    assets: {
      'images/lesion-costras.svg': svgBlob(costras),
      'images/impetigo-ampolloso.svg': svgBlob(ampolloso),
      'images/ectima.svg': svgBlob(ectima),
      'images/algoritmo-tratamiento.svg': svgBlob(algoritmo),
    },
  });
}
