import { describe, expect, it } from 'vitest';
import minecraft from '../palettes/minecraft.json';
import gameboy from '../palettes/gameboy.json';
import { labToRgb, rgbToLab, type RGB } from './color';
import { mergeColor, paintCells, replaceColor, withColor } from './edit';
import { EMPTY } from './map-palette';
import { preparePalette, type PaletteFile } from './palette';
import { DEFAULT_OPTIONS, makePattern, type Pattern } from './pattern';
import type { Pixels } from './resize';
import { blockStacks, formatStacks } from './stats';

function image(width: number, height: number, paint: (x: number, y: number) => [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set([...paint(x, y), 255], (y * width + x) * 4);
  }
  return { width, height, data };
}

const quadrants = image(40, 40, (x, y) => (x < 20 ? (y < 20 ? [200, 30, 40] : [40, 160, 60]) : y < 20 ? [40, 60, 200] : [240, 210, 40]));

describe('Lab to RGB', () => {
  it.each([[0, 0, 0], [255, 255, 255], [200, 30, 40], [12, 120, 230], [128, 128, 128]] as RGB[])('round-trips %j', (...rgb) => {
    expect(labToRgb(rgbToLab(rgb as RGB))).toEqual(rgb);
  });
});

describe('free colours', () => {
  it('uses the image\'s own colours, not a palette', () => {
    const p = makePattern(quadrants, null, { ...DEFAULT_OPTIONS, cellsWide: 20, maxColors: 4, cleanup: false });
    expect(p.colors).toHaveLength(4);
    // The four flat quadrant colours come back exactly.
    expect(p.colors.map((c) => c.hex).sort()).toEqual(['#283cc8', '#28a03c', '#c81e28', '#f0d228']);
  });

  it('never uses more colours than asked for', () => {
    const noisy = image(50, 50, (x, y) => [(x * 37) % 256, (y * 53) % 256, ((x + y) * 29) % 256]);
    const p = makePattern(noisy, null, { ...DEFAULT_OPTIONS, cellsWide: 50, maxColors: 8 });
    expect(p.colors.length).toBeLessThanOrEqual(8);
  });
});

describe('palette filters', () => {
  const file = minecraft as PaletteFile;

  it('keeps only the tagged blocks', () => {
    const wool = preparePalette(file, { only: ['wool'] });
    expect(wool.colors).toHaveLength(16);
    expect(wool.colors.every((c) => c.code.endsWith('_wool'))).toBe(true);
  });

  it('drops blocks that fall and precious blocks', () => {
    const safe = preparePalette(file, { without: ['gravity', 'precious'] });
    expect(safe.colors.some((c) => c.code === 'sand' || c.code.endsWith('_concrete_powder'))).toBe(false);
    expect(safe.colors.some((c) => c.code === 'diamond_block')).toBe(false);
    expect(safe.colors.length).toBeGreaterThan(100);
  });

  it('uses every colour of a small retro palette when allowed', () => {
    const gb = preparePalette(gameboy as PaletteFile);
    const ramp = image(40, 10, (x) => [x * 6, x * 6, x * 6]);
    const p = makePattern(ramp, gb, { ...DEFAULT_OPTIONS, cellsWide: 40, maxColors: 20, cleanup: false });
    expect(p.colors).toHaveLength(4);
  });
});

describe('editing', () => {
  const base = (): Pattern => makePattern(quadrants, null, { ...DEFAULT_OPTIONS, cellsWide: 20, maxColors: 4, cleanup: false });

  it('paints cells and recounts', () => {
    const p = base();
    const before = p.colors[0].count;
    const target = p.cells.indexOf(1);
    const q = paintCells(p, [target], p.cells[0]);
    expect(q.colors.reduce((s, c) => s + c.count, 0) + q.empty).toBe(q.width * q.height);
    expect(q.colors.find((c) => c.code === p.colors[p.cells[0]].code)!.count).toBe(p.colors[p.cells[0]].count + 1);
    expect(p.colors[0].count).toBe(before);
  });

  it('replaces every cell of one colour and drops it from the key', () => {
    const p = base();
    const q = replaceColor(p, 3, 0);
    expect(q.colors).toHaveLength(3);
    expect(q.colors.reduce((s, c) => s + c.count, 0)).toBe(400);
  });

  it('merges a colour into its closest neighbour', () => {
    const p = base();
    const q = mergeColor(p, 1);
    expect(q.colors).toHaveLength(3);
    expect(q.colors.some((c) => c.code === p.colors[1].code)).toBe(false);
  });

  it('can clear cells and add a new colour to paint with', () => {
    const p = base();
    const cleared = paintCells(p, [0, 1, 2], EMPTY);
    expect(cleared.empty).toBe(3);
    const { pattern, index } = withColor(p, { palette: -1, code: '#000000', name: '#000000', hex: '#000000' });
    expect(index).toBe(p.colors.length);
    const painted = paintCells(pattern, [5], index);
    expect(painted.colors.some((c) => c.code === '#000000' && c.count === 1)).toBe(true);
  });
});

describe('stacks', () => {
  it('counts stacks of 64 and shulker boxes', () => {
    expect(blockStacks(130)).toEqual({ stacks: 2, rest: 2, shulkers: 130 / 1728 });
    expect(formatStacks(40)).toBe('40');
    expect(formatStacks(64)).toBe('1 stack');
    expect(formatStacks(140)).toBe('2 stacks + 12');
  });
});
