// Picks the best N palette colours for an image: k-means in Lab finds N centres, then each
// centre snaps to its nearest palette colour by CIEDE2000, skipping colours already taken.

import { deltaE2000, distLab2, type Lab } from './color';
import type { Palette } from './palette';

/** Cells used to train k-means. Larger grids are sampled evenly; the result barely changes. */
const MAX_SAMPLES = 12000;
const ROUNDS = 12;

/**
 * @param labs   Lab per cell, 3 values per cell
 * @param active Cells to consider (empty cells excluded)
 * @returns indices into `palette.colors`, most-used first is not guaranteed
 */
export function choosePaletteColors(labs: Float32Array, active: Uint32Array, palette: Palette, maxColors: number): number[] {
  const n = active.length;
  if (n === 0) return [];
  const k = Math.min(maxColors, n, palette.colors.length);

  const step = Math.max(1, n / MAX_SAMPLES);
  const sample: number[] = [];
  for (let s = 0; s < n; s += step) sample.push(active[Math.floor(s)]);

  const centres = seedCentres(labs, sample, k);
  const assign = new Int32Array(sample.length);
  for (let round = 0; round < ROUNDS; round++) {
    const sums = new Float64Array(k * 4);
    let moved = false;
    for (let s = 0; s < sample.length; s++) {
      const i = sample[s] * 3;
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = distLab2(labs, i, centres, c * 3);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (assign[s] !== best) { assign[s] = best; moved = true; }
      sums[best * 4] += labs[i];
      sums[best * 4 + 1] += labs[i + 1];
      sums[best * 4 + 2] += labs[i + 2];
      sums[best * 4 + 3]++;
    }
    for (let c = 0; c < k; c++) {
      const w = sums[c * 4 + 3];
      if (w) {
        centres[c * 3] = sums[c * 4] / w;
        centres[c * 3 + 1] = sums[c * 4 + 1] / w;
        centres[c * 3 + 2] = sums[c * 4 + 2] / w;
      }
    }
    if (!moved && round > 0) break;
  }

  // Snap centres to real colours, biggest clusters first so they get their best match.
  const sizes = new Array(k).fill(0);
  for (let s = 0; s < sample.length; s++) sizes[assign[s]]++;
  const order = [...Array(k).keys()].filter((c) => sizes[c] > 0).sort((a, b) => sizes[b] - sizes[a]);
  const taken = new Set<number>();
  for (const c of order) {
    const centre: Lab = [centres[c * 3], centres[c * 3 + 1], centres[c * 3 + 2]];
    let best = -1;
    let bestD = Infinity;
    for (let p = 0; p < palette.colors.length; p++) {
      if (taken.has(p)) continue;
      const d = deltaE2000(centre, palette.colors[p].lab);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best >= 0) taken.add(best);
  }
  return [...taken];
}

/** k-means++ seeding with a fixed sequence, so the same photo always gives the same chart. */
function seedCentres(labs: Float32Array, sample: number[], k: number) {
  const centres = new Float64Array(k * 3);
  const rand = mulberry32(0x5717c4);
  const first = sample[Math.floor(rand() * sample.length)] * 3;
  centres.set([labs[first], labs[first + 1], labs[first + 2]], 0);
  const nearest = new Float64Array(sample.length).fill(Infinity);
  for (let c = 1; c < k; c++) {
    let total = 0;
    for (let s = 0; s < sample.length; s++) {
      const d = distLab2(labs, sample[s] * 3, centres, (c - 1) * 3);
      if (d < nearest[s]) nearest[s] = d;
      total += nearest[s];
    }
    let target = rand() * total;
    let pick = sample.length - 1;
    for (let s = 0; s < sample.length; s++) {
      target -= nearest[s];
      if (target <= 0) { pick = s; break; }
    }
    const i = sample[pick] * 3;
    centres.set([labs[i], labs[i + 1], labs[i + 2]], c * 3);
  }
  return centres;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
