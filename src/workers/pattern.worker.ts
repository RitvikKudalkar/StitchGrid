// Runs the engine off the main thread, so the page never freezes on a big photo.
// The photo arrives as pixels from this same tab and never leaves the device.

import dmc from '../palettes/dmc.json';
import { preparePalette, type Palette, type PaletteFile } from '../engine/palette';
import { makePattern, type PatternOptions } from '../engine/pattern';
import type { Pixels } from '../engine/resize';

const files: Record<string, PaletteFile> = { dmc };
const palettes = new Map<string, Palette>();
let source: Pixels | null = null;

export type WorkerRequest =
  | { type: 'load'; width: number; height: number; data: Uint8ClampedArray }
  | { type: 'render'; id: number; palette: string; options: PatternOptions };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'load') {
    source = { width: msg.width, height: msg.height, data: msg.data };
    return;
  }
  if (!source) return;
  let palette = palettes.get(msg.palette);
  if (!palette) {
    palette = preparePalette(files[msg.palette]);
    palettes.set(msg.palette, palette);
  }
  const started = performance.now();
  const pattern = makePattern(source, palette, msg.options);
  const ms = performance.now() - started;
  (self as unknown as Worker).postMessage({ type: 'pattern', id: msg.id, pattern, ms }, [pattern.cells.buffer]);
};
