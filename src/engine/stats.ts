// Counts per colour and the materials estimate.

import { EMPTY } from './map-palette';

export function countCells(cells: Uint16Array, colors: number) {
  const counts = new Array<number>(colors).fill(0);
  let empty = 0;
  for (const c of cells) {
    if (c === EMPTY) empty++;
    else counts[c]++;
  }
  return { counts, empty };
}

/**
 * Skeins of stranded cotton for `stitches` full cross stitches. An estimate: one cross uses
 * two diagonals on the front and about two cell-sides of travel on the back, plus 40% for
 * tails and starts. A skein is 8 m of six strands.
 */
export function skeinsNeeded(stitches: number, fabricCount: number, strands: number) {
  if (stitches === 0) return 0;
  return Math.max(1, Math.ceil(stitches / stitchesPerSkein(fabricCount, strands)));
}

/** Full cross stitches one skein covers, by the estimate above. */
export function stitchesPerSkein(fabricCount: number, strands: number) {
  const inchesPerStitch = ((2 * Math.SQRT2 + 2) / fabricCount) * 1.4;
  const strandInchesPerSkein = (8 / 0.0254) * 6;
  return strandInchesPerSkein / (inchesPerStitch * strands);
}

/** Finished size of a chart, in inches and centimetres, at `perInch` cells to the inch. */
export function finishedSize(width: number, height: number, perInch: number) {
  const w = width / perInch;
  const h = height / perInch;
  return { inches: [w, h] as const, cm: [w * 2.54, h * 2.54] as const };
}
