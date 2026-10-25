// Runs the engine off the main thread, so the page never freezes on a big photo.
// The photo arrives as pixels from this same tab and never leaves the device.

import dmc from '../palettes/dmc.json';
import minecraft from '../palettes/minecraft.json';
import pico8 from '../palettes/pico8.json';
import gameboy from '../palettes/gameboy.json';
import nes from '../palettes/nes.json';
import { preparePalette, type Palette, type PaletteFile, type PaletteFilter } from '../engine/palette';
import { makePattern, type PatternOptions } from '../engine/pattern';
import type { Pixels } from '../engine/resize';

const files: Record<string, PaletteFile> = { dmc, minecraft, pico8, gameboy, nes };
const palettes = new Map<string, Palette>();
let source: Pixels | null = null;

export type WorkerRequest =
  | { type: 'load'; width: number; height: number; data: Uint8ClampedArray }
  /** `palette` is a file id, or "free" for the image's own colours. */
  | { type: 'render'; id: number; palette: string; filter?: PaletteFilter; options: PatternOptions };

function paletteFor(id: string, filter?: PaletteFilter) {
  const key = `${id}|${filter?.only?.join() ?? ''}|${filter?.without?.join() ?? ''}`;
  let palette = palettes.get(key);
  if (!palette) {
    palette = preparePalette(files[id], filter);
    palettes.set(key, palette);
  }
  return palette;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'load') {
    source = { width: msg.width, height: msg.height, data: msg.data };
    return;
  }
  if (!source) return;
  const palette = msg.palette === 'free' ? null : paletteFor(msg.palette, msg.filter);
  const started = performance.now();
  const pattern = makePattern(source, palette, msg.options);
  const ms = performance.now() - started;
  (self as unknown as Worker).postMessage({ type: 'pattern', id: msg.id, pattern, ms }, [pattern.cells.buffer]);
};
