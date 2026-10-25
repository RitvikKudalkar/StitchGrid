// A stand-in for the Phase 1 engine: area-averages the image into cells and reduces it to
// N colours with a few rounds of k-means in RGB. Phase 1 replaces this with Lab colour,
// CIEDE2000 and a thread palette (src/engine/), running in a worker. ChartView stays.

import type { Chart, RGB } from './chart-view';

export function previewChart(source: CanvasImageSource & { width: number; height: number }, cellsWide: number, colours: number): Chart {
  const width = cellsWide;
  const height = Math.max(1, Math.round((source.height / source.width) * cellsWide));

  // Drawing into a canvas the size of the grid averages each cell's area.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;

  const n = width * height;
  const px: RGB[] = Array.from({ length: n }, (_, i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);

  // Seed centres spread evenly through the pixels sorted by brightness, so dark and light both get colours.
  const byLuma = [...px].sort((a, b) => luma(a) - luma(b));
  let centres: RGB[] = Array.from({ length: colours }, (_, k) => [...byLuma[Math.floor(((k + 0.5) / colours) * n)]] as RGB);
  const cells = new Uint8Array(n);

  for (let round = 0; round < 8; round++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      const k = nearest(px[i], centres);
      cells[i] = k;
      const s = sums[k];
      s[0] += px[i][0]; s[1] += px[i][1]; s[2] += px[i][2]; s[3]++;
    }
    centres = centres.map((c, k) => (sums[k][3] ? [sums[k][0] / sums[k][3], sums[k][1] / sums[k][3], sums[k][2] / sums[k][3]] : c));
  }

  // Drop colours nobody uses and order the key from most to fewest cells.
  const counts = centres.map(() => 0);
  cells.forEach((k) => counts[k]++);
  const keep = counts.map((c, k) => ({ c, k })).filter((e) => e.c > 0).sort((a, b) => b.c - a.c);
  const remap = new Uint8Array(colours);
  keep.forEach((e, j) => (remap[e.k] = j));
  for (let i = 0; i < n; i++) cells[i] = remap[cells[i]];

  return {
    width,
    height,
    cells,
    palette: keep.map((e) => centres[e.k].map(Math.round) as RGB),
    counts: keep.map((e) => e.c),
  };
}

const luma = ([r, g, b]: RGB) => 0.299 * r + 0.587 * g + 0.114 * b;

function nearest(p: RGB, centres: RGB[]) {
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < centres.length; k++) {
    const c = centres[k];
    const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}
