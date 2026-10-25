// The image-to-grid pipeline every tool shares (execution-plan.md §3):
// resize → adjust → Lab → choose N palette colours → map (± dither) → cleanup → stats.

import { rgbToLab } from './color';
import { clearBackground, removeConfetti } from './cleanup';
import { EMPTY, mapToPalette } from './map-palette';
import type { Palette } from './palette';
import { choosePaletteColors, freePalette } from './quantize';
import { adjustCells, resizeToGrid, type Crop, type Pixels } from './resize';
import { countCells } from './stats';

export interface PatternOptions {
  cellsWide: number;
  /** Cell width ÷ height. 1 for stitches, beads and bricks. */
  cellAspect: number;
  maxColors: number;
  dither: boolean;
  cleanup: boolean;
  /** "empty" leaves the background unstitched. */
  background: 'keep' | 'empty';
  brightness: number;
  contrast: number;
  crop?: Crop;
}

export const DEFAULT_OPTIONS: PatternOptions = {
  cellsWide: 100,
  cellAspect: 1,
  maxColors: 20,
  dither: false,
  cleanup: true,
  background: 'keep',
  brightness: 0,
  contrast: 0,
};

export interface PatternColor {
  /** Index into the palette's colours. */
  palette: number;
  code: string;
  name: string;
  hex: string;
  count: number;
}

export interface Pattern {
  width: number;
  height: number;
  /** Per cell, an index into `colors`, or EMPTY (unstitched). */
  cells: Uint16Array;
  /** Most-used first. */
  colors: PatternColor[];
  empty: number;
}

export { EMPTY };

/** With a null palette, colours are free: the image's own best colours, not a material's. */
export function makePattern(src: Pixels, paletteOrFree: Palette | null, options: PatternOptions): Pattern {
  const grid = resizeToGrid(src, options.cellsWide, options.cellAspect, options.crop);
  adjustCells(grid, options.brightness, options.contrast);
  const { width, height } = grid;
  const n = width * height;

  const empty = new Uint8Array(n);
  const labs = new Float32Array(n * 3);
  const active: number[] = [];
  for (let i = 0; i < n; i++) {
    if (grid.alpha[i] < 0.5) { empty[i] = 1; continue; }
    labs.set(rgbToLab([grid.rgb[i * 3], grid.rgb[i * 3 + 1], grid.rgb[i * 3 + 2]]), i * 3);
    active.push(i);
  }

  const activeCells = Uint32Array.from(active);
  const palette = paletteOrFree ?? freePalette(labs, activeCells, options.maxColors);
  const chosen = paletteOrFree ? choosePaletteColors(labs, activeCells, palette, options.maxColors) : palette.colors.map((_, i) => i);
  const cells = mapToPalette(width, height, grid.rgb, empty, palette, chosen, options.dither);
  if (options.background === 'empty') clearBackground(cells, width, height);
  if (options.cleanup) removeConfetti(cells, width, height);

  // Order the key from most to fewest stitches and drop colours nothing uses.
  const { counts, empty: emptyCount } = countCells(cells, chosen.length);
  const order = chosen.map((_, k) => k).filter((k) => counts[k] > 0).sort((a, b) => counts[b] - counts[a]);
  const remap = new Uint16Array(chosen.length).fill(EMPTY);
  order.forEach((k, j) => (remap[k] = j));
  for (let i = 0; i < n; i++) if (cells[i] !== EMPTY) cells[i] = remap[cells[i]];

  return {
    width,
    height,
    cells,
    empty: emptyCount,
    colors: order.map((k) => {
      const c = palette.colors[chosen[k]];
      return { palette: chosen[k], code: c.code, name: c.name, hex: c.hex, count: counts[k] };
    }),
  };
}
