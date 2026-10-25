// Printable chart symbols, one per colour. Each is drawn from simple shapes in a unit square,
// so the screen (canvas) and the PDF draw exactly the same mark. The first 36 are shapes;
// after that, capital letters. Shapes come first because they read better at small sizes.

export type SymbolOp =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill: boolean }
  | { t: 'circle'; cx: number; cy: number; r: number; fill: boolean }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { t: 'poly'; pts: number[]; fill: boolean }
  | { t: 'text'; s: string };

const A = 0.2; // inset
const B = 0.8;
const M = 0.5;

const rect = (x: number, y: number, w: number, h: number, fill = true): SymbolOp => ({ t: 'rect', x, y, w, h, fill });
const circle = (cx: number, cy: number, r: number, fill = true): SymbolOp => ({ t: 'circle', cx, cy, r, fill });
const line = (x1: number, y1: number, x2: number, y2: number): SymbolOp => ({ t: 'line', x1, y1, x2, y2 });
const poly = (pts: number[], fill = true): SymbolOp => ({ t: 'poly', pts, fill });

const UP = [M, A, B, B, A, B];
const DOWN = [A, A, B, A, M, B];
const LEFT = [A, M, B, A, B, B];
const RIGHT = [A, A, B, M, A, B];
const DIAMOND = [M, A, B, M, M, B, A, M];

export const SHAPES: SymbolOp[][] = [
  [rect(A, A, 0.6, 0.6)],
  [rect(A, A, 0.6, 0.6, false)],
  [circle(M, M, 0.3)],
  [circle(M, M, 0.3, false)],
  [poly(UP)],
  [poly(UP, false)],
  [poly(DOWN)],
  [poly(DOWN, false)],
  [poly(DIAMOND)],
  [poly(DIAMOND, false)],
  [line(M, A, M, B), line(A, M, B, M)],
  [line(A, A, B, B), line(B, A, A, B)],
  [line(A, M, B, M)],
  [line(M, A, M, B)],
  [line(A, B, B, A)],
  [line(A, A, B, B)],
  [circle(M, M, 0.12)],
  [rect(A, A, 0.6, 0.6, false), circle(M, M, 0.08)],
  [circle(M, M, 0.3, false), circle(M, M, 0.08)],
  [rect(A, A, 0.3, 0.6), rect(A, A, 0.6, 0.6, false)],
  [rect(A, A, 0.6, 0.3), rect(A, A, 0.6, 0.6, false)],
  [poly(LEFT)],
  [poly(RIGHT)],
  [line(M, A, M, B), line(A, M, B, M), line(0.29, 0.29, 0.71, 0.71), line(0.71, 0.29, 0.29, 0.71)],
  [line(A, 0.38, B, 0.38), line(A, 0.62, B, 0.62)],
  [line(0.38, A, 0.38, B), line(0.62, A, 0.62, B)],
  [line(A, A, A, B), line(A, B, B, B)],
  [line(A, A, B, A), line(M, A, M, B)],
  [rect(A, A, 0.6, 0.6, false), line(A, A, B, B), line(B, A, A, B)],
  [circle(M, M, 0.3, false), line(M, A, M, B), line(A, M, B, M)],
  [poly([A, A, B, A, A, B, B, B])],
  [poly([A, A, A, B, B, A, B, B])],
  [rect(0.35, 0.35, 0.3, 0.3)],
  [circle(0.28, M, 0.07), circle(M, M, 0.07), circle(0.72, M, 0.07)],
  [poly([A, 0.66, M, 0.3, B, 0.66], false)],
  [poly([A, 0.34, M, 0.7, B, 0.34], false)],
];

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Symbol for the colour at position `i` in the key. */
export function symbolFor(i: number): SymbolOp[] {
  if (i < SHAPES.length) return SHAPES[i];
  return [{ t: 'text', s: LETTERS[(i - SHAPES.length) % LETTERS.length] }];
}

export const MAX_SYMBOLS = SHAPES.length + LETTERS.length;

/** A symbol as an SVG string (viewBox 0 0 1 1), for the key. */
export function symbolSvg(ops: SymbolOp[], ink: string, size = 24) {
  const sw = 'stroke-width="0.09" stroke-linecap="round" stroke-linejoin="round"';
  const paint = (fill: boolean) => (fill ? `fill="${ink}"` : `fill="none" stroke="${ink}" ${sw}`);
  const body = ops.map((op) => {
    switch (op.t) {
      case 'rect': return `<rect x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" ${paint(op.fill)}/>`;
      case 'circle': return `<circle cx="${op.cx}" cy="${op.cy}" r="${op.r}" ${paint(op.fill)}/>`;
      case 'line': return `<line x1="${op.x1}" y1="${op.y1}" x2="${op.x2}" y2="${op.y2}" stroke="${ink}" ${sw}/>`;
      case 'poly': return `<polygon points="${op.pts.join(' ')}" ${paint(op.fill)}/>`;
      case 'text': return `<text x="0.5" y="0.78" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="600" font-size="0.72" fill="${ink}">${op.s}</text>`;
    }
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 1 1" aria-hidden="true">${body}</svg>`;
}

/** Draws a symbol into the square cell at (x, y) of side `size` on a 2D canvas. */
export function drawSymbol(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, ops: SymbolOp[], x: number, y: number, size: number, ink: string) {
  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(0.75, size * 0.09);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const op of ops) {
    ctx.beginPath();
    switch (op.t) {
      case 'rect':
        ctx.rect(x + op.x * size, y + op.y * size, op.w * size, op.h * size);
        break;
      case 'circle':
        ctx.arc(x + op.cx * size, y + op.cy * size, op.r * size, 0, Math.PI * 2);
        break;
      case 'line':
        ctx.moveTo(x + op.x1 * size, y + op.y1 * size);
        ctx.lineTo(x + op.x2 * size, y + op.y2 * size);
        ctx.stroke();
        continue;
      case 'poly':
        ctx.moveTo(x + op.pts[0] * size, y + op.pts[1] * size);
        for (let p = 2; p < op.pts.length; p += 2) ctx.lineTo(x + op.pts[p] * size, y + op.pts[p + 1] * size);
        ctx.closePath();
        break;
      case 'text':
        ctx.font = `600 ${Math.round(size * 0.72)}px Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(op.s, x + size / 2, y + size * 0.54);
        continue;
    }
    if ('fill' in op && op.fill) ctx.fill();
    else ctx.stroke();
  }
  ctx.restore();
}
