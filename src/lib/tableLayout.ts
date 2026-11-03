export type TableLayoutMode = 'fit' | 'equal' | 'custom';

export type TableWidthInput = {
  /** Ancho disponible para la tabla, sin contar el borde del contenedor. */
  available: number;
  /** Ancho mínimo legible de cada columna, normalmente el del encabezado. */
  minWidths: number[];
  /** Peso relativo de cada columna para repartir el espacio sobrante. */
  weights: number[];
};

export type TableWidthResult = {
  widths: number[];
  /** Ancho mínimo de la tabla para evitar que las columnas se aplasten. */
  minWidth: number;
  /** true cuando los mínimos no caben y el contenedor debe hacer scroll. */
  overflow: boolean;
};

function safeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Reparte el ancho disponible entre columnas respetando sus mínimos.
 *
 * Primero asigna a cada columna su mínimo y después reparte el espacio
 * restante de forma proporcional a `weights`. Si una columna no llega a su
 * mínimo con el reparto proporcional, se fija a ese mínimo y se recalcula el
 * resto. Si ni siquiera caben los mínimos, devuelve los mínimos y marca
 * `overflow` para que la tabla pueda desplazarse en horizontal.
 */
export function allocateTableWidths({
  available,
  minWidths,
  weights,
}: TableWidthInput): TableWidthResult {
  const count = minWidths.length;
  if (count === 0) {
    return { widths: [], minWidth: 0, overflow: false };
  }

  const safeAvailable = Math.max(1, safeNumber(available, 1));
  const minimums = minWidths.map((width) => Math.max(1, safeNumber(width, 1)));
  const minTotal = minimums.reduce((sum, width) => sum + width, 0);

  if (minTotal >= safeAvailable) {
    return {
      widths: minimums.map((width) => Math.round(width)),
      minWidth: Math.ceil(minTotal),
      overflow: true,
    };
  }

  let remaining = safeAvailable;
  let free = minimums.map((_, index) => index);
  const widths = new Array<number>(count).fill(0);

  while (free.length > 0) {
    const weightTotal = free.reduce((sum, index) => {
      const weight = weights[index];
      return sum + (Number.isFinite(weight) && weight > 0 ? weight : 1);
    }, 0);

    const shares = new Map<number, number>();
    free.forEach((index) => {
      const weight = weights[index];
      const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : 1;
      shares.set(index, (remaining * safeWeight) / weightTotal);
    });

    const constrained = free.filter(
      (index) => (shares.get(index) ?? 0) < minimums[index],
    );

    if (constrained.length === 0) {
      free.forEach((index) => {
        widths[index] = shares.get(index) ?? 0;
      });
      break;
    }

    constrained.forEach((index) => {
      widths[index] = minimums[index];
      remaining -= minimums[index];
    });
    const constrainedSet = new Set(constrained);
    free = free.filter((index) => !constrainedSet.has(index));
  }

  const rounded = widths.map((width) => Math.round(width));
  const target = Math.round(safeAvailable);
  const total = rounded.reduce((sum, width) => sum + width, 0);

  if (total !== target) {
    let widest = 0;
    for (let index = 1; index < rounded.length; index += 1) {
      if (rounded[index] > rounded[widest]) widest = index;
    }
    rounded[widest] = Math.max(
      minimums[widest],
      rounded[widest] + target - total,
    );
  }

  return {
    widths: rounded,
    minWidth: rounded.reduce((sum, width) => sum + width, 0),
    overflow: false,
  };
}
