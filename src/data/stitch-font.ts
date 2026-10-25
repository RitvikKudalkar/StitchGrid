// A 7-row bitmap alphabet, one string per row, '#' = a stitch. Used for the stitched wordmark
// (footer, OG image) and the seed of the Phase 5 text tool. Add letters as they are needed.

export const STITCH_FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.###.', '#...#', '#....', '.###.', '....#', '#...#', '.###.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  ' ': ['..', '..', '..', '..', '..', '..', '..'],
};

export interface StitchCell {
  x: number;
  y: number;
  /** Index of the letter the cell belongs to, for colouring letter by letter. */
  letter: number;
}

/** Lays text out as stitch cells, one empty column between letters. */
export function layoutStitches(text: string) {
  const cells: StitchCell[] = [];
  let x = 0;
  let letter = 0;
  for (const ch of text.toUpperCase()) {
    const glyph = STITCH_FONT[ch];
    if (!glyph) throw new Error(`No stitch glyph for "${ch}"`);
    glyph.forEach((row, y) => {
      [...row].forEach((c, dx) => {
        if (c === '#') cells.push({ x: x + dx, y, letter });
      });
    });
    x += glyph[0].length + 1;
    if (ch !== ' ') letter++;
  }
  return { cells, width: x - 1, height: 7 };
}

/** SVG path for one cross stitch filling the unit cell at (x, y). */
export const crossPath = (x: number, y: number) =>
  `M${x + 0.2} ${y + 0.2}L${x + 0.8} ${y + 0.8}M${x + 0.8} ${y + 0.2}L${x + 0.2} ${y + 0.8}`;
