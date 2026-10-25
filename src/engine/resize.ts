// Image → grid of cells by area averaging (not nearest-neighbour), so each cell is the true
// average colour of the photo under it and the chart isn't noisy.

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, like ImageData.data. */
  data: Uint8ClampedArray;
}

export interface CellGrid {
  width: number;
  height: number;
  /** Average sRGB per cell, 3 values per cell. */
  rgb: Float32Array;
  /** Average opacity per cell, 0–1. Cells under half opaque count as empty. */
  alpha: Float32Array;
}

export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Number of rows for a chart `cellsWide` across. `cellAspect` is cell width ÷ height:
 * 1 for square stitches and beads, about 0.8 for knitting, where stitches are wider than tall.
 */
export function gridHeight(imageWidth: number, imageHeight: number, cellsWide: number, cellAspect = 1) {
  return Math.max(1, Math.round((imageHeight / imageWidth) * cellsWide * cellAspect));
}

export function resizeToGrid(src: Pixels, cellsWide: number, cellAspect = 1, crop?: Crop): CellGrid {
  const cx = crop?.x ?? 0;
  const cy = crop?.y ?? 0;
  const cw = crop?.width ?? src.width;
  const ch = crop?.height ?? src.height;
  const width = Math.max(1, Math.min(cellsWide, cw));
  const height = Math.max(1, Math.min(gridHeight(cw, ch, width, cellAspect), ch));

  const sums = new Float64Array(width * height * 4);
  const weights = new Float64Array(width * height);
  const sx = width / cw;
  const sy = height / ch;
  const { data } = src;

  for (let y = 0; y < ch; y++) {
    const gy = Math.min(height - 1, Math.floor(y * sy));
    const row = (cy + y) * src.width;
    for (let x = 0; x < cw; x++) {
      const gx = Math.min(width - 1, Math.floor(x * sx));
      const p = (row + cx + x) * 4;
      const a = data[p + 3] / 255;
      const g = gy * width + gx;
      // Colours are weighted by opacity, so transparent edges don't darken the average.
      sums[g * 4] += data[p] * a;
      sums[g * 4 + 1] += data[p + 1] * a;
      sums[g * 4 + 2] += data[p + 2] * a;
      sums[g * 4 + 3] += a;
      weights[g]++;
    }
  }

  const rgb = new Float32Array(width * height * 3);
  const alpha = new Float32Array(width * height);
  for (let g = 0; g < width * height; g++) {
    const a = sums[g * 4 + 3];
    alpha[g] = weights[g] ? a / weights[g] : 0;
    if (a > 0) {
      rgb[g * 3] = sums[g * 4] / a;
      rgb[g * 3 + 1] = sums[g * 4 + 1] / a;
      rgb[g * 3 + 2] = sums[g * 4 + 2] / a;
    }
  }
  return { width, height, rgb, alpha };
}

/** Brightness and contrast from −100 to 100, applied to the cells before matching colours. */
export function adjustCells(grid: CellGrid, brightness: number, contrast: number) {
  if (!brightness && !contrast) return;
  const b = brightness * 1.28;
  const k = (259 * (contrast * 1.28 + 255)) / (255 * (259 - contrast * 1.28));
  for (let i = 0; i < grid.rgb.length; i++) {
    grid.rgb[i] = Math.max(0, Math.min(255, k * (grid.rgb[i] + b - 128) + 128));
  }
}
