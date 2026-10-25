// Hand edits to a finished pattern: paint single cells, replace every cell of one colour,
// or merge a colour away into its closest neighbour. Each returns a new pattern, so the
// previous one can be kept for undo. Colours nothing uses are dropped and the key re-sorted.

import { deltaE2000, hexToRgb, rgbToLab } from './color';
import { EMPTY } from './map-palette';
import type { Pattern, PatternColor } from './pattern';

/** Sets the given cells to `color` (an index into `pattern.colors`, or EMPTY). */
export function paintCells(pattern: Pattern, cells: Iterable<number>, color: number): Pattern {
  const next = pattern.cells.slice();
  for (const i of cells) next[i] = color;
  return tidy(pattern, next, pattern.colors);
}

/** Every cell of colour `from` becomes colour `to`. */
export function replaceColor(pattern: Pattern, from: number, to: number): Pattern {
  const next = pattern.cells.map((c) => (c === from ? to : c));
  return tidy(pattern, next, pattern.colors);
}

/** Removes colour `index`, giving its cells to the closest remaining colour by CIEDE2000. */
export function mergeColor(pattern: Pattern, index: number): Pattern {
  if (pattern.colors.length < 2) return pattern;
  const lab = rgbToLab(hexToRgb(pattern.colors[index].hex));
  let best = -1;
  let bestD = Infinity;
  pattern.colors.forEach((c, i) => {
    if (i === index) return;
    const d = deltaE2000(lab, rgbToLab(hexToRgb(c.hex)));
    if (d < bestD) { bestD = d; best = i; }
  });
  return replaceColor(pattern, index, best);
}

/** Adds a colour to the key (for painting with a palette colour not yet used). */
export function withColor(pattern: Pattern, color: Omit<PatternColor, 'count'>): { pattern: Pattern; index: number } {
  const existing = pattern.colors.findIndex((c) => c.code === color.code);
  if (existing >= 0) return { pattern, index: existing };
  return { pattern: { ...pattern, colors: [...pattern.colors, { ...color, count: 0 }] }, index: pattern.colors.length };
}

/** Recounts, drops unused colours and re-sorts the key from most to fewest cells. */
function tidy(pattern: Pattern, cells: Uint16Array, colors: PatternColor[]): Pattern {
  const counts = new Array<number>(colors.length).fill(0);
  let empty = 0;
  for (const c of cells) {
    if (c === EMPTY) empty++;
    else counts[c]++;
  }
  const order = colors.map((_, k) => k).filter((k) => counts[k] > 0).sort((a, b) => counts[b] - counts[a]);
  const remap = new Uint16Array(colors.length).fill(EMPTY);
  order.forEach((k, j) => (remap[k] = j));
  const out = cells.map((c) => (c === EMPTY ? EMPTY : remap[c]));
  return {
    ...pattern,
    cells: out,
    empty,
    colors: order.map((k) => ({ ...colors[k], count: counts[k] })),
  };
}
