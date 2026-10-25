// How the shared workbench behaves for each craft: palettes, sizes, what a cell is called,
// how "as made" is drawn, what the materials column shows and which files can be downloaded.
// Passed to the browser as JSON, so keep it plain data.

import type { PaletteFilter } from '../engine/palette';

export type CraftId = 'cross-stitch' | 'pixel-art' | 'minecraft';

export interface PaletteChoice {
  /** Palette file id, or "free" for the image's own colours. */
  id: string;
  label: string;
  filter?: PaletteFilter;
}

export interface CraftConfig {
  id: CraftId;
  /** Short name for switches. */
  label: string;
  /** What one cell is called, plural. */
  unit: string;
  /** Shown before codes in the key and the files: "DMC", "", "Block". */
  brand: string;
  palettes: PaletteChoice[];
  width: { min: number; max: number; value: number };
  colours: { min: number; max: number; value: number };
  /** How "as made" is drawn: thread crosses, flat pixels or blocks. */
  made: 'stitch' | 'pixel' | 'block';
  /** View buttons, in order; the first is the default. */
  views: { id: 'colour' | 'symbols' | 'made'; label: string }[];
  materials: 'skeins' | 'stacks' | 'none';
  exports: ('pdf' | 'png' | 'csv' | 'png-scaled' | 'png-1x')[];
  /** Fabric count and strands (cross stitch only). */
  fabric: boolean;
  /** Minecraft block filters. */
  blockFilters: boolean;
  /** Row-by-row building view. */
  layers: boolean;
  pdfTitle?: string;
  /** File name stem for downloads. */
  fileStem: string;
}

export const crafts: Record<CraftId, CraftConfig> = {
  'cross-stitch': {
    id: 'cross-stitch',
    label: 'Cross stitch',
    unit: 'stitches',
    brand: 'DMC',
    palettes: [{ id: 'dmc', label: 'DMC stranded cotton' }],
    width: { min: 30, max: 300, value: 100 },
    colours: { min: 2, max: 60, value: 20 },
    made: 'stitch',
    views: [{ id: 'colour', label: 'Colour' }, { id: 'symbols', label: 'Symbols' }, { id: 'made', label: 'As made' }],
    materials: 'skeins',
    exports: ['pdf', 'png', 'csv'],
    fabric: true,
    blockFilters: false,
    layers: false,
    pdfTitle: 'Cross stitch pattern',
    fileStem: 'cross-stitch',
  },
  'pixel-art': {
    id: 'pixel-art',
    label: 'Pixel art',
    unit: 'pixels',
    brand: '',
    palettes: [
      { id: 'free', label: 'Free colours' },
      { id: 'pico8', label: 'PICO-8 (16 colours)' },
      { id: 'nes', label: '8-bit console (55 colours)' },
      { id: 'gameboy', label: 'Handheld green (4 colours)' },
    ],
    width: { min: 8, max: 256, value: 64 },
    colours: { min: 2, max: 64, value: 16 },
    made: 'pixel',
    views: [{ id: 'made', label: 'Pixels' }, { id: 'colour', label: 'With grid' }],
    materials: 'none',
    exports: ['png-scaled', 'png-1x'],
    fabric: false,
    blockFilters: false,
    layers: false,
    fileStem: 'pixel-art',
  },
  minecraft: {
    id: 'minecraft',
    label: 'Minecraft',
    unit: 'blocks',
    brand: 'Block',
    palettes: [
      { id: 'minecraft', label: 'All solid blocks' },
      { id: 'minecraft', label: 'Wool only', filter: { only: ['wool'] } },
      { id: 'minecraft', label: 'Concrete only', filter: { only: ['concrete'] } },
      { id: 'minecraft', label: 'Wool and concrete', filter: { only: ['wool', 'concrete'] } },
      { id: 'minecraft', label: 'Terracotta only', filter: { only: ['terracotta'] } },
    ],
    width: { min: 16, max: 256, value: 64 },
    colours: { min: 2, max: 60, value: 24 },
    made: 'block',
    views: [{ id: 'made', label: 'Blocks' }, { id: 'colour', label: 'Chart' }],
    materials: 'stacks',
    exports: ['csv', 'png'],
    fabric: false,
    blockFilters: true,
    layers: true,
    fileStem: 'minecraft-pixel-art',
  },
};
