// Draws a pattern on the sheet: cells, a fine line per cell and a bold line every 10 (the chart
// convention), column and row numbers, and centre arrows. Three views: colour, symbols, and
// "as made" (cross stitches on Aida). Plays the stitch-out once per new image and dims every
// other colour while one key row is highlighted (execution-plan.md §7.6).

import { EMPTY } from '../engine/map-palette';
import { drawSymbol, symbolFor } from '../engine/symbols';
import { hexToRgb, luminance } from '../engine/color';

export interface ChartData {
  width: number;
  height: number;
  /** Per cell, an index into `colors`, or EMPTY. */
  cells: Uint16Array;
  colors: { hex: string; code: string; name: string }[];
}

export type ChartMode = 'colour' | 'symbols' | 'made';

const INK = '#1a201e';
const SHEET = '#ece9e0';
const AIDA_HOLE = 'rgba(26, 32, 30, 0.16)';
const STITCH_OUT_MS = 700;
const HIGHLIGHT_MS = 200;
const DIMMED = 0.15;
const MARGIN = 26; // room for the numbers and arrows
/** Symbols are drawn on coloured cells once cells are at least this many pixels wide. */
const SYMBOLS_IN_COLOUR_FROM = 14;
/** Below this cell size, symbols can't be read. */
export const MIN_SYMBOL_CELL = 7;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export class ChartView {
  private ctx: CanvasRenderingContext2D;
  private chart: ChartData | null = null;
  private source: CanvasImageSource | null = null;
  /** Position of each cell in the centre-out stitch-out. */
  private rank: Uint32Array = new Uint32Array(0);
  private revealed = Infinity;
  /** The source photo, blurred once per image, shown through cells not yet stitched. */
  private blurred: HTMLCanvasElement | null = null;
  private highlight: number | null = null;
  private dim = 0;
  private frame = 0;
  private highlightFrame = 0;
  private inks: string[] = [];
  mode: ChartMode = 'colour';
  /** Cell size in CSS pixels after the last draw. */
  cell = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.draw()).observe(canvas);
  }

  get data() {
    return this.chart;
  }

  /**
   * Shows a chart.
   * - `now`: fully stitched straight away (option changes, reduced motion).
   * - `hold`: only the blurred photo, waiting for `play()` once the chart is in view.
   * - `play`: the centre-out stitch-out over the blurred photo.
   */
  show(chart: ChartData, source: CanvasImageSource | null, how: 'now' | 'hold' | 'play') {
    const sameSize = this.chart?.width === chart.width && this.chart?.height === chart.height;
    this.chart = chart;
    if (source !== this.source || !this.blurred) this.blurred = source ? blurOnce(source) : null;
    this.source = source;
    this.inks = chart.colors.map((c) => (luminance(hexToRgb(c.hex)) > 0.3 ? INK : SHEET));
    if (this.highlight !== null && this.highlight >= chart.colors.length) this.highlight = null;
    if (!sameSize || how !== 'now') this.rank = centreOutRank(chart.width, chart.height);
    cancelAnimationFrame(this.frame);

    if (how === 'now' || reducedMotion() || !this.blurred) {
      this.revealed = Infinity;
      this.draw();
    } else if (how === 'hold') {
      this.revealed = 0;
      this.draw();
    } else {
      this.play();
    }
  }

  /** True while the chart waits, blurred, for its stitch-out. */
  get held() {
    return this.revealed === 0;
  }

  /** Plays the centre-out stitch-out from the blurred photo to the finished chart. */
  play() {
    const chart = this.chart;
    if (!chart) return;
    cancelAnimationFrame(this.frame);
    if (reducedMotion()) {
      this.revealed = Infinity;
      this.draw();
      return;
    }
    const start = performance.now();
    const total = chart.width * chart.height;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / STITCH_OUT_MS);
      this.revealed = t < 1 ? Math.max(1, Math.floor((1 - (1 - t) ** 3) * total)) : Infinity;
      this.draw();
      if (t < 1) this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  setMode(mode: ChartMode) {
    this.mode = mode;
    this.draw();
  }

  /** Keeps one colour lit and dims the rest; null lights everything again. */
  setHighlight(index: number | null) {
    // Only one fade at a time: a finishing fade-out must not clear a newer highlight.
    cancelAnimationFrame(this.highlightFrame);
    if (index !== null) this.highlight = index;
    const from = this.dim;
    const to = index === null ? 0 : 1;
    if (reducedMotion()) {
      this.dim = to;
      if (index === null) this.highlight = null;
      this.draw();
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / HIGHLIGHT_MS);
      this.dim = from + (to - from) * t;
      if (t === 1 && index === null) this.highlight = null;
      this.draw();
      if (t < 1) this.highlightFrame = requestAnimationFrame(tick);
    };
    this.highlightFrame = requestAnimationFrame(tick);
  }

  /** The cell under a point in CSS pixels relative to the canvas, or null. */
  cellAt(x: number, y: number) {
    if (!this.chart || !this.cell) return null;
    const cx = Math.floor((x - MARGIN) / this.cell);
    const cy = Math.floor((y - MARGIN) / this.cell);
    if (cx < 0 || cy < 0 || cx >= this.chart.width || cy >= this.chart.height) return null;
    return { x: cx, y: cy, color: this.chart.cells[cy * this.chart.width + cx] };
  }

  draw() {
    const { canvas, ctx, chart } = this;
    if (!chart) return;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cell = Math.max(2, (cssWidth - MARGIN * 2) / chart.width);
    this.cell = cell;
    const cssHeight = Math.round(cell * chart.height + MARGIN * 2);
    if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      canvas.style.height = `${cssHeight}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = SHEET;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const x0 = MARGIN;
    const y0 = MARGIN;
    const w = cell * chart.width;
    const h = cell * chart.height;

    // Until a cell is stitched, the blurred photo shows through.
    if (this.revealed !== Infinity && this.blurred) ctx.drawImage(this.blurred, x0, y0, w, h);

    if (this.mode === 'made') this.drawMade(x0, y0, cell);
    else this.drawCells(x0, y0, cell);

    if (this.mode !== 'made') this.drawGrid(x0, y0, w, h, cell);
    this.drawNumbers(x0, y0, w, h, cell);
  }

  private alphaFor(color: number) {
    return this.highlight === null || color === this.highlight ? 1 : 1 - this.dim * (1 - DIMMED);
  }

  /** Cells grouped by colour, so each colour is one path. */
  private groups() {
    const chart = this.chart!;
    const groups: number[][] = chart.colors.map(() => []);
    const limit = this.revealed;
    for (let i = 0; i < chart.cells.length; i++) {
      const c = chart.cells[i];
      if (c === EMPTY || this.rank[i] >= limit) continue;
      groups[c].push(i);
    }
    return groups;
  }

  private drawCells(x0: number, y0: number, cell: number) {
    const chart = this.chart!;
    const groups = this.groups();
    const readable = cell >= MIN_SYMBOL_CELL;
    const symbols = readable && (this.mode === 'symbols' || cell >= SYMBOLS_IN_COLOUR_FROM);
    // Symbols too small to read would leave a blank sheet, so colour stands in until zoomed.
    const fill = this.mode === 'colour' || !readable;
    const size = Math.ceil(cell);
    groups.forEach((cells, c) => {
      ctx_alpha(this.ctx, this.alphaFor(c));
      if (fill) {
        this.ctx.fillStyle = chart.colors[c].hex;
        this.ctx.beginPath();
        for (const i of cells) this.ctx.rect(x0 + (i % chart.width) * cell, y0 + Math.floor(i / chart.width) * cell, size, size);
        this.ctx.fill();
      }
      if (symbols) {
        const ink = fill ? this.inks[c] : INK;
        const ops = symbolFor(c);
        for (const i of cells) drawSymbol(this.ctx, ops, x0 + (i % chart.width) * cell, y0 + Math.floor(i / chart.width) * cell, cell, ink);
      }
    });
    ctx_alpha(this.ctx, 1);
  }

  /** Cross stitches on Aida: a hole at every corner, two thread strokes per cell. */
  private drawMade(x0: number, y0: number, cell: number) {
    const chart = this.chart!;
    const { ctx } = this;
    if (cell >= 4) {
      ctx.fillStyle = AIDA_HOLE;
      const r = Math.max(0.6, cell * 0.08);
      ctx.beginPath();
      for (let y = 0; y <= chart.height; y++) {
        for (let x = 0; x <= chart.width; x++) {
          ctx.moveTo(x0 + x * cell + r, y0 + y * cell);
          ctx.arc(x0 + x * cell, y0 + y * cell, r, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    }
    const inset = cell * 0.12;
    ctx.lineCap = 'round';
    this.groups().forEach((cells, c) => {
      ctx_alpha(ctx, this.alphaFor(c));
      ctx.beginPath();
      for (const i of cells) {
        const x = x0 + (i % chart.width) * cell;
        const y = y0 + Math.floor(i / chart.width) * cell;
        ctx.moveTo(x + inset, y + inset);
        ctx.lineTo(x + cell - inset, y + cell - inset);
        ctx.moveTo(x + cell - inset, y + inset);
        ctx.lineTo(x + inset, y + cell - inset);
      }
      ctx.strokeStyle = chart.colors[c].hex;
      ctx.lineWidth = cell * 0.3;
      ctx.stroke();
      // A thin lighter line along the top stroke reads as the sheen of stranded cotton.
      if (cell >= 8) {
        ctx.beginPath();
        for (const i of cells) {
          const x = x0 + (i % chart.width) * cell;
          const y = y0 + Math.floor(i / chart.width) * cell;
          ctx.moveTo(x + cell - inset * 1.4, y + inset * 1.4);
          ctx.lineTo(x + inset * 1.4, y + cell - inset * 1.4);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = cell * 0.08;
        ctx.stroke();
      }
    });
    ctx_alpha(ctx, 1);
  }

  private drawGrid(x0: number, y0: number, w: number, h: number, cell: number) {
    const chart = this.chart!;
    const { ctx } = this;
    ctx.strokeStyle = INK;
    for (let c = 0; c <= chart.width; c++) {
      const bold = c % 10 === 0 || c === chart.width;
      if (!bold && cell < 6) continue;
      ctx.globalAlpha = bold ? 0.7 : 0.14;
      ctx.lineWidth = bold ? 1.25 : 0.75;
      line(ctx, x0 + c * cell, y0, x0 + c * cell, y0 + h);
    }
    for (let r = 0; r <= chart.height; r++) {
      const bold = r % 10 === 0 || r === chart.height;
      if (!bold && cell < 6) continue;
      ctx.globalAlpha = bold ? 0.7 : 0.14;
      ctx.lineWidth = bold ? 1.25 : 0.75;
      line(ctx, x0, y0 + r * cell, x0 + w, y0 + r * cell);
    }
    ctx.globalAlpha = 1;
  }

  private drawNumbers(x0: number, y0: number, w: number, h: number, cell: number) {
    const chart = this.chart!;
    const { ctx } = this;
    ctx.fillStyle = INK;
    ctx.font = '500 12px "EB Garamond", Georgia, serif';
    // Every 10, unless cells are so small the numbers would collide.
    const every = cell * 10 >= 22 ? 10 : 20;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (let c = every; c < chart.width; c += every) ctx.fillText(String(c), x0 + c * cell, y0 - 8);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let r = every; r < chart.height; r += every) ctx.fillText(String(r), x0 - 6, y0 + r * cell);

    // Centre arrows: stitchers start from the middle of the chart.
    const cx = x0 + w / 2;
    const cy = y0 + h / 2;
    triangle(ctx, cx - 5, y0 + h + 4, cx + 5, y0 + h + 4, cx, y0 + h + 12);
    triangle(ctx, x0 + w + 4, cy - 5, x0 + w + 4, cy + 5, x0 + w + 12, cy);
  }
}

function ctx_alpha(ctx: CanvasRenderingContext2D, a: number) {
  ctx.globalAlpha = a;
}

/**
 * A small blurred copy of the photo, made once per image. Blurring the full-size photo on
 * every frame of the stitch-out was slow enough to stutter.
 */
function blurOnce(source: CanvasImageSource) {
  const s = source as CanvasImageSource & { width: number; height: number };
  const scale = 240 / Math.max(s.width, s.height);
  const w = Math.max(1, Math.round(s.width * scale));
  const h = Math.max(1, Math.round(s.height * scale));
  const pad = 8; // drawn past the edges so the blur doesn't fade to transparent at the borders
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.filter = 'blur(3px)';
  ctx.drawImage(source, -pad, -pad, w + pad * 2, h + pad * 2);
  return canvas;
}

function centreOutRank(width: number, height: number) {
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const n = width * height;
  const dist = new Float32Array(n);
  for (let i = 0; i < n; i++) dist[i] = Math.max(Math.abs((i % width) - cx), Math.abs(Math.floor(i / width) - cy));
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => dist[a] - dist[b]);
  const rank = new Uint32Array(n);
  order.forEach((i, r) => (rank[i] = r));
  return rank;
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
  ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
  ctx.stroke();
}

function triangle(ctx: CanvasRenderingContext2D, ...p: number[]) {
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(p[2], p[3]);
  ctx.lineTo(p[4], p[5]);
  ctx.closePath();
  ctx.fill();
}
