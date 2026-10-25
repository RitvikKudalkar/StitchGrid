import { describe, expect, it } from 'vitest';
import dmc from '../palettes/dmc.json';
import { clearBackground, removeConfetti } from './cleanup';
import { deltaE2000, rgbToLab, type Lab } from './color';
import { EMPTY } from './map-palette';
import { preparePalette } from './palette';
import { DEFAULT_OPTIONS, makePattern } from './pattern';
import { gridHeight, resizeToGrid, type Pixels } from './resize';
import { skeinsNeeded } from './stats';

const palette = preparePalette(dmc);

function image(width: number, height: number, paint: (x: number, y: number) => [number, number, number, number?]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = paint(x, y);
      data.set([r, g, b, a], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

describe('Lab conversion', () => {
  const cases: [[number, number, number], Lab][] = [
    [[255, 255, 255], [100, 0, 0]],
    [[0, 0, 0], [0, 0, 0]],
    [[255, 0, 0], [53.2408, 80.0925, 67.2032]],
    [[0, 255, 0], [87.7347, -86.1827, 83.1793]],
    [[0, 0, 255], [32.2970, 79.1875, -107.8602]],
    [[128, 128, 128], [53.5850, 0, 0]],
  ];
  it.each(cases)('%j → %j', (rgb, lab) => {
    const out = rgbToLab(rgb);
    out.forEach((v, i) => expect(v).toBeCloseTo(lab[i], 2));
  });
});

describe('CIEDE2000', () => {
  // Reference pairs from Sharma, Wu and Dalal (2005), Table 1.
  const pairs: [Lab, Lab, number][] = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
    [[50, 2.5, 0], [56, -27, -3], 31.903],
    [[50, 2.5, 0], [58, 24, 15], 19.4535],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
    [[90.8027, -2.0831, 1.441], [91.1528, -1.6435, 0.0447], 1.4441],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ];
  it.each(pairs)('%j vs %j = %d', (a, b, expected) => {
    expect(deltaE2000(a, b)).toBeCloseTo(expected, 3);
    expect(deltaE2000(b, a)).toBeCloseTo(expected, 3);
  });
});

describe('resize', () => {
  it('area-averages each cell', () => {
    // Left half black, right half white: 2 cells across, each the pure colour of its half.
    const grid = resizeToGrid(image(10, 4, (x) => (x < 5 ? [0, 0, 0] : [255, 255, 255])), 2);
    expect(grid.width).toBe(2);
    expect(grid.height).toBe(1);
    expect([...grid.rgb]).toEqual([0, 0, 0, 255, 255, 255]);
  });

  it('follows the cell aspect ratio', () => {
    expect(gridHeight(100, 100, 50)).toBe(50);
    expect(gridHeight(100, 100, 50, 0.8)).toBe(40);
  });

  it('marks transparent cells as empty', () => {
    const grid = resizeToGrid(image(4, 4, (x) => [255, 0, 0, x < 2 ? 0 : 255]), 2);
    expect(grid.alpha[0]).toBe(0);
    expect(grid.alpha[1]).toBe(1);
  });
});

describe('pattern', () => {
  // Four flat quadrants: red, green, blue, yellow.
  const quadrants = image(80, 80, (x, y) => (x < 40 ? (y < 40 ? [200, 30, 40] : [40, 160, 60]) : y < 40 ? [40, 60, 200] : [240, 210, 40]));

  it('finds the expected number of colours', () => {
    const p = makePattern(quadrants, palette, { ...DEFAULT_OPTIONS, cellsWide: 40, maxColors: 4 });
    expect(p.colors).toHaveLength(4);
    expect(new Set(p.colors.map((c) => c.code)).size).toBe(4);
  });

  it('never uses more colours than asked for', () => {
    const noisy = image(60, 60, (x, y) => [(x * 37) % 256, (y * 53) % 256, ((x + y) * 29) % 256]);
    const p = makePattern(noisy, palette, { ...DEFAULT_OPTIONS, cellsWide: 60, maxColors: 12 });
    expect(p.colors.length).toBeLessThanOrEqual(12);
  });

  it('counts add up to width × height', () => {
    const p = makePattern(quadrants, palette, { ...DEFAULT_OPTIONS, cellsWide: 33, maxColors: 6, dither: true });
    const total = p.colors.reduce((s, c) => s + c.count, 0) + p.empty;
    expect(total).toBe(p.width * p.height);
    expect(p.cells.length).toBe(p.width * p.height);
  });

  it('orders the key from most to fewest stitches', () => {
    const p = makePattern(quadrants, palette, { ...DEFAULT_OPTIONS, cellsWide: 40, maxColors: 4 });
    const counts = p.colors.map((c) => c.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('matches pure black to DMC 310', () => {
    const p = makePattern(image(10, 10, () => [0, 0, 0]), palette, { ...DEFAULT_OPTIONS, cellsWide: 10, maxColors: 1 });
    expect(p.colors[0].code).toBe('310');
  });

  it('gives the same chart for the same photo', () => {
    const a = makePattern(quadrants, palette, { ...DEFAULT_OPTIONS, cellsWide: 40, maxColors: 4 });
    const b = makePattern(quadrants, palette, { ...DEFAULT_OPTIONS, cellsWide: 40, maxColors: 4 });
    expect([...a.cells]).toEqual([...b.cells]);
  });
});

describe('cleanup', () => {
  it('merges a lone stitch into its neighbours', () => {
    const cells = new Uint16Array([0, 0, 0, 0, 1, 0, 0, 0, 0]);
    expect(removeConfetti(cells, 3, 3)).toBe(1);
    expect([...cells]).toEqual(new Array(9).fill(0));
  });

  it('keeps stitches that touch their own colour', () => {
    const cells = new Uint16Array([0, 0, 0, 0, 1, 1, 0, 0, 0]);
    removeConfetti(cells, 3, 3);
    expect(cells[4]).toBe(1);
  });

  it('clears the background only where it touches the edge', () => {
    // A ring of 1 inside a field of 0, with a 0 in the very middle.
    const w = 5;
    const cells = new Uint16Array([
      0, 0, 0, 0, 0,
      0, 1, 1, 1, 0,
      0, 1, 0, 1, 0,
      0, 1, 1, 1, 0,
      0, 0, 0, 0, 0,
    ]);
    expect(clearBackground(cells, w, w)).toBe(16);
    expect(cells[12]).toBe(0);
    expect(cells[0]).toBe(EMPTY);
  });
});

describe('skeins', () => {
  it('estimates about 1,950 stitches per skein on 14-count with 2 strands', () => {
    expect(skeinsNeeded(1900, 14, 2)).toBe(1);
    expect(skeinsNeeded(2000, 14, 2)).toBe(2);
  });
  it('needs at least one skein for any stitches, none for none', () => {
    expect(skeinsNeeded(1, 18, 1)).toBe(1);
    expect(skeinsNeeded(0, 14, 2)).toBe(0);
  });
});
