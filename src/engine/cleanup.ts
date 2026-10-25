// Tidies a mapped grid: removes "confetti" (single stitches with no neighbour of their colour)
// and, if asked, clears the background so it is left unstitched.

import { EMPTY } from './map-palette';

/** Merges each isolated single cell into the colour most common among its eight neighbours. */
export function removeConfetti(cells: Uint16Array, width: number, height: number) {
  const src = cells.slice();
  let changed = 0;
  const counts = new Map<number, number>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const c = src[i];
      if (c === EMPTY) continue;
      counts.clear();
      let alone = true;
      for (let dy = -1; dy <= 1 && alone; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = src[ny * width + nx];
          if (n === c) { alone = false; break; }
          if (n !== EMPTY) counts.set(n, (counts.get(n) ?? 0) + 1);
        }
      }
      if (!alone || counts.size === 0) continue;
      let best = c;
      let bestN = 0;
      counts.forEach((n, col) => { if (n > bestN) { bestN = n; best = col; } });
      cells[i] = best;
      changed++;
    }
  }
  return changed;
}

/**
 * Leaves the background unstitched: the colour most common along the edges is cleared
 * wherever it connects to an edge, so the same colour inside the subject is kept.
 */
export function clearBackground(cells: Uint16Array, width: number, height: number) {
  const edge = new Map<number, number>();
  const count = (i: number) => { if (cells[i] !== EMPTY) edge.set(cells[i], (edge.get(cells[i]) ?? 0) + 1); };
  for (let x = 0; x < width; x++) { count(x); count((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { count(y * width); count(y * width + width - 1); }
  if (!edge.size) return 0;
  const bg = [...edge.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const stack: number[] = [];
  let cleared = 0;
  const push = (i: number) => {
    if (cells[i] !== bg) return;
    cells[i] = EMPTY;
    stack.push(i);
    cleared++;
  };
  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (i >= width) push(i - width);
    if (i < width * (height - 1)) push(i + width);
  }
  return cleared;
}
