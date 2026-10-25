// Maps every cell to one of the chosen colours by CIEDE2000, with optional Floyd–Steinberg
// dithering. Dithering is off by default: it scatters single stitches, which are slow to sew.

import { deltaE2000, rgbToLab, type Lab } from './color';
import type { Palette } from './palette';

export const EMPTY = 0xffff;

/**
 * @param rgb    sRGB per cell, 3 values per cell
 * @param empty  cells to leave unstitched
 * @param chosen indices into `palette.colors`
 * @returns per cell, an index into `chosen`, or EMPTY
 */
export function mapToPalette(
  width: number,
  height: number,
  rgb: Float32Array,
  empty: Uint8Array,
  palette: Palette,
  chosen: number[],
  dither: boolean,
): Uint16Array {
  const out = new Uint16Array(width * height).fill(EMPTY);
  const targets = chosen.map((p) => palette.colors[p]);
  if (!targets.length) return out;

  if (!dither) {
    // Many cells share a colour; remembering answers keeps large grids fast.
    const memo = new Map<number, number>();
    const labs = targets.map((t) => t.lab);
    for (let i = 0; i < width * height; i++) {
      if (empty[i]) continue;
      const r = Math.round(rgb[i * 3]);
      const g = Math.round(rgb[i * 3 + 1]);
      const b = Math.round(rgb[i * 3 + 2]);
      const key = (r << 16) | (g << 8) | b;
      let best = memo.get(key);
      if (best === undefined) {
        best = nearest(rgbToLab([r, g, b]), labs);
        memo.set(key, best);
      }
      out[i] = best;
    }
    return out;
  }

  const work = Float32Array.from(rgb);
  const labs = targets.map((t) => t.lab);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (empty[i]) continue;
      const r = clamp(work[i * 3]);
      const g = clamp(work[i * 3 + 1]);
      const b = clamp(work[i * 3 + 2]);
      const best = nearest(rgbToLab([r, g, b]), labs);
      out[i] = best;
      const [tr, tg, tb] = targets[best].rgb;
      spread(work, empty, width, height, x + 1, y, r - tr, g - tg, b - tb, 7 / 16);
      spread(work, empty, width, height, x - 1, y + 1, r - tr, g - tg, b - tb, 3 / 16);
      spread(work, empty, width, height, x, y + 1, r - tr, g - tg, b - tb, 5 / 16);
      spread(work, empty, width, height, x + 1, y + 1, r - tr, g - tg, b - tb, 1 / 16);
    }
  }
  return out;
}

const SHORTLIST = 4;
const short = new Int32Array(SHORTLIST);
const shortD = new Float64Array(SHORTLIST);

/**
 * Nearest colour by CIEDE2000. A cheap Lab distance first shortlists the closest few, since
 * the two measures only disagree between colours that are already close.
 */
function nearest(lab: Lab, labs: Lab[]) {
  if (labs.length <= SHORTLIST) return nearestOf(lab, labs, labs.length, (t) => t);
  shortD.fill(Infinity);
  for (let t = 0; t < labs.length; t++) {
    const c = labs[t];
    const d = (lab[0] - c[0]) ** 2 + (lab[1] - c[1]) ** 2 + (lab[2] - c[2]) ** 2;
    if (d >= shortD[SHORTLIST - 1]) continue;
    let j = SHORTLIST - 1;
    while (j > 0 && shortD[j - 1] > d) { shortD[j] = shortD[j - 1]; short[j] = short[j - 1]; j--; }
    shortD[j] = d;
    short[j] = t;
  }
  return nearestOf(lab, labs, SHORTLIST, (j) => short[j]);
}

function nearestOf(lab: Lab, labs: Lab[], count: number, at: (j: number) => number) {
  let best = at(0);
  let bestD = Infinity;
  for (let j = 0; j < count; j++) {
    const t = at(j);
    const d = deltaE2000(lab, labs[t]);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

function spread(work: Float32Array, empty: Uint8Array, w: number, h: number, x: number, y: number, er: number, eg: number, eb: number, f: number) {
  if (x < 0 || x >= w || y >= h) return;
  const i = y * w + x;
  if (empty[i]) return;
  work[i * 3] += er * f;
  work[i * 3 + 1] += eg * f;
  work[i * 3 + 2] += eb * f;
}

const clamp = (v: number) => Math.max(0, Math.min(255, v));
