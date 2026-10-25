// Talks to the pattern worker. Decodes the photo in this tab, shrinks it to a working size,
// and asks for patterns; when options change quickly, only the newest answer is used.

import type { Pattern, PatternOptions } from '../engine/pattern';
import type { WorkerRequest } from '../workers/pattern.worker';

/** Longest side of the working copy. Charts are at most a few hundred cells across. */
const WORKING_SIDE = 1200;
/** Anything bigger is scaled down while decoding (execution-plan.md §3). */
const MAX_SIDE = 4000;

export interface LoadedImage {
  /** A small copy for the blurred stitch-out backdrop. */
  preview: HTMLCanvasElement;
  width: number;
  height: number;
}

export class PatternClient {
  private worker = new Worker(new URL('../workers/pattern.worker.ts', import.meta.url), { type: 'module' });
  private nextId = 0;
  private waiting = new Map<number, (p: Pattern) => void>();
  private latest = 0;

  constructor() {
    this.worker.onmessage = (e: MessageEvent<{ type: 'pattern'; id: number; pattern: Pattern }>) => {
      const resolve = this.waiting.get(e.data.id);
      this.waiting.delete(e.data.id);
      // Drop answers that a newer request has overtaken.
      if (resolve && e.data.id === this.latest) resolve(e.data.pattern);
    };
  }

  /** Sends an image to the worker. Accepts anything a canvas can draw. */
  load(image: CanvasImageSource & { width: number; height: number }): LoadedImage {
    const scale = Math.min(1, WORKING_SIDE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    const msg: WorkerRequest = { type: 'load', width, height, data };
    this.worker.postMessage(msg, [data.buffer]);
    return { preview: canvas, width, height };
  }

  render(options: PatternOptions, palette = 'dmc'): Promise<Pattern> {
    const id = ++this.nextId;
    this.latest = id;
    const msg: WorkerRequest = { type: 'render', id, palette, options };
    this.worker.postMessage(msg);
    return new Promise((resolve) => this.waiting.set(id, resolve));
  }
}

/** Opens a photo file in this tab. HEIC works where the browser can decode it (Safari). */
export async function decodeFile(file: File): Promise<ImageBitmap> {
  let bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale < 1) {
    const smaller = await createImageBitmap(bitmap, {
      resizeWidth: Math.round(bitmap.width * scale),
      resizeHeight: Math.round(bitmap.height * scale),
      resizeQuality: 'high',
    });
    bitmap.close();
    bitmap = smaller;
  }
  return bitmap;
}
