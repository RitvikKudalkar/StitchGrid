import { EMPTY } from '../map-palette';
import type { Pattern } from '../pattern';

/**
 * The pattern as an image: `cell` pixels per cell, with a fine grid and a bold line every 10
 * when `grid` is on. Empty cells are left transparent.
 */
export async function patternToPng(pattern: Pattern, cell: number, grid: boolean): Promise<Blob> {
  const { width, height } = pattern;
  const line = grid ? 1 : 0;
  const canvas = new OffscreenCanvas(width * cell + line, height * cell + line);
  const ctx = canvas.getContext('2d')!;
  pattern.colors.forEach((c, k) => {
    ctx.fillStyle = c.hex;
    ctx.beginPath();
    for (let i = 0; i < pattern.cells.length; i++) {
      if (pattern.cells[i] === k) ctx.rect((i % width) * cell, Math.floor(i / width) * cell, cell, cell);
    }
    ctx.fill();
  });
  if (grid) {
    for (let x = 0; x <= width; x++) {
      ctx.fillStyle = x % 10 === 0 || x === width ? 'rgba(26,32,30,0.75)' : 'rgba(26,32,30,0.18)';
      ctx.fillRect(x * cell, 0, 1, height * cell + 1);
    }
    for (let y = 0; y <= height; y++) {
      ctx.fillStyle = y % 10 === 0 || y === height ? 'rgba(26,32,30,0.75)' : 'rgba(26,32,30,0.18)';
      ctx.fillRect(0, y * cell, width * cell + 1, 1);
    }
  }
  return canvas.convertToBlob({ type: 'image/png' });
}

/** A small flat preview with no grid, for the PDF cover. */
export function patternPreview(pattern: Pattern, maxSide: number) {
  const cell = Math.max(1, Math.floor(maxSide / Math.max(pattern.width, pattern.height)));
  const canvas = document.createElement('canvas');
  canvas.width = pattern.width * cell;
  canvas.height = pattern.height * cell;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pattern.cells.length; i++) {
    const c = pattern.cells[i];
    if (c === EMPTY) continue;
    ctx.fillStyle = pattern.colors[c].hex;
    ctx.fillRect((i % pattern.width) * cell, Math.floor(i / pattern.width) * cell, cell, cell);
  }
  return canvas;
}
