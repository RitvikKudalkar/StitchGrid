// Renders the example photos through the real engine, as pixel art and as Minecraft blocks,
// into src/assets/renders/. These are the "after" pictures on the tool pages and guides.
// Run with `npm run render:examples` after changing the engine, the palettes or the examples.

import { build } from 'esbuild';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'src/assets/renders');
fs.mkdirSync(out, { recursive: true });

// Bundle the engine so plain Node can run it.
const bundle = path.join(root, 'node_modules/.cache/patternsquare-engine.mjs');
await build({
  stdin: {
    contents: `
      export { makePattern, DEFAULT_OPTIONS } from './src/engine/pattern';
      export { preparePalette } from './src/engine/palette';
      export { EMPTY } from './src/engine/map-palette';
      import minecraft from './src/palettes/minecraft.json';
      import pico8 from './src/palettes/pico8.json';
      export const palettes = { minecraft, pico8 };
    `,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundle,
  logLevel: 'error',
});
const engine = await import(pathToFileURL(bundle).href);

const examples = ['cat', 'flower', 'house', 'portrait'];
const jobs = [
  { kind: 'pixel', palette: null, cellsWide: 48, maxColors: 16, cell: 16 },
  { kind: 'minecraft', palette: engine.preparePalette(engine.palettes.minecraft, { without: ['gravity', 'precious'] }), cellsWide: 64, maxColors: 24, cell: 12 },
];

for (const id of examples) {
  const { data, info } = await sharp(path.join(root, `src/assets/examples/${id}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const src = { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
  for (const job of jobs) {
    const p = engine.makePattern(src, job.palette, { ...engine.DEFAULT_OPTIONS, cellsWide: job.cellsWide, maxColors: job.maxColors });
    const w = p.width * job.cell;
    const h = p.height * job.cell;
    const rgb = Buffer.alloc(w * h * 3);
    const colours = p.colors.map((c) => [1, 3, 5].map((i) => parseInt(c.hex.slice(i, i + 2), 16)));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cx = Math.floor(x / job.cell);
        const cy = Math.floor(y / job.cell);
        const k = p.cells[cy * p.width + cx];
        let [r, g, b] = k === engine.EMPTY ? [236, 233, 224] : colours[k];
        if (job.kind === 'minecraft' && k !== engine.EMPTY) {
          // The same face-on block look as the chart view: a fixed grain and bevelled edges.
          const sx = Math.floor(((x % job.cell) / job.cell) * 4);
          const sy = Math.floor(((y % job.cell) / job.cell) * 4);
          const gr = grain(k, sy * 4 + sx);
          const lx = x % job.cell;
          const ly = y % job.cell;
          const edge = lx === 0 || ly === 0 ? 1 : lx === job.cell - 1 || ly === job.cell - 1 ? -1 : 0;
          const shade = (gr + edge) * 0.07;
          [r, g, b] = [r, g, b].map((v) => Math.round(shade > 0 ? v + (255 - v) * shade : v * (1 + shade)));
        }
        rgb.set([r, g, b], (y * w + x) * 3);
      }
    }
    const file = path.join(out, `${job.kind}-${id}.png`);
    await sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).png({ compressionLevel: 9, palette: job.kind === 'pixel' }).toFile(file);
    console.log(`${path.relative(root, file)}  ${p.width}×${p.height}, ${p.colors.length} colours`);
  }
}

function grain(color, g) {
  let h = (color * 374761393 + g * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  const v = ((h ^ (h >>> 16)) >>> 0) % 5;
  return v === 0 ? 1 : v === 1 ? -1 : 0;
}
