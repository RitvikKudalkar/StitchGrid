// Draws a chart on the sheet: cells, a fine line per cell and a bold line every 10 (the chart
// convention), column and row numbers, and centre arrows. Plays the stitch-out once per new image
// and dims every other colour while one key row is highlighted (execution-plan.md §7.6).

export type RGB = [number, number, number];

export interface Chart {
  width: number;
  height: number;
  /** Palette index per cell, row by row. */
  cells: Uint8Array;
  palette: RGB[];
  /** Cells per palette colour. */
  counts: number[];
}

const INK = '#1a201e';
const SHEET = '#ece9e0';
const STITCH_OUT_MS = 700;
const HIGHLIGHT_MS = 200;
const DIMMED = 0.15;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export class ChartView {
  private ctx: CanvasRenderingContext2D;
  private chart: Chart | null = null;
  private source: CanvasImageSource | null = null;
  /** Cell indices sorted from the centre outwards, for the stitch-out. */
  private order: Uint32Array = new Uint32Array(0);
  private revealed = Infinity;
  private highlight: number | null = null;
  private dim = 0;
  private frame = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.draw()).observe(canvas);
  }

  /** Shows a chart. `stitchOut` plays the centre-out reveal over the blurred source image. */
  show(chart: Chart, source: CanvasImageSource, stitchOut: boolean) {
    this.chart = chart;
    this.source = source;
    this.highlight = null;
    this.dim = 0;
    this.order = centreOutOrder(chart.width, chart.height);
    cancelAnimationFrame(this.frame);

    if (!stitchOut || reducedMotion()) {
      this.revealed = Infinity;
      this.draw();
      return;
    }
    const start = performance.now();
    const total = this.order.length;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / STITCH_OUT_MS);
      this.revealed = Math.floor(easeOut(t) * total);
      this.draw();
      if (t < 1) this.frame = requestAnimationFrame(tick);
      else this.revealed = Infinity;
    };
    this.frame = requestAnimationFrame(tick);
  }

  /** Keeps one colour lit and dims the rest; null lights everything again. */
  setHighlight(index: number | null) {
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
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private draw() {
    const { canvas, ctx, chart } = this;
    if (!chart) return;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const margin = 26; // room for the numbers and arrows
    const cell = Math.max(2, (cssWidth - margin * 2) / chart.width);
    const cssHeight = Math.round(cell * chart.height + margin * 2);
    if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      canvas.style.height = `${cssHeight}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = SHEET;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const x0 = margin;
    const y0 = margin;
    const w = cell * chart.width;
    const h = cell * chart.height;

    // Until a cell is stitched, the blurred photo shows through.
    if (this.revealed !== Infinity && this.source) {
      ctx.save();
      ctx.filter = 'blur(8px)';
      ctx.beginPath();
      ctx.rect(x0, y0, w, h);
      ctx.clip();
      ctx.drawImage(this.source, x0, y0, w, h);
      ctx.restore();
    }

    const total = this.revealed === Infinity ? this.order.length : this.revealed;
    for (let n = 0; n < total; n++) {
      const i = this.order[n];
      const p = chart.cells[i];
      const [r, g, b] = chart.palette[p];
      const lit = this.highlight === null || p === this.highlight;
      ctx.globalAlpha = lit ? 1 : 1 - this.dim * (1 - DIMMED);
      ctx.fillStyle = `rgb(${r} ${g} ${b})`;
      ctx.fillRect(x0 + (i % chart.width) * cell, y0 + Math.floor(i / chart.width) * cell, Math.ceil(cell), Math.ceil(cell));
    }
    ctx.globalAlpha = 1;

    // Grid: a fine line per cell when cells are big enough to read, a bold line every 10.
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

    // Numbers every 10 along the top and left.
    ctx.fillStyle = INK;
    ctx.font = '500 12px "EB Garamond", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (let c = 10; c < chart.width; c += 10) ctx.fillText(String(c), x0 + c * cell, y0 - 8);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let r = 10; r < chart.height; r += 10) ctx.fillText(String(r), x0 - 6, y0 + r * cell);

    // Centre arrows: stitchers start from the middle of the chart.
    const cx = x0 + w / 2;
    const cy = y0 + h / 2;
    triangle(ctx, cx - 5, y0 + h + 4, cx + 5, y0 + h + 4, cx, y0 + h + 12);
    triangle(ctx, x0 + w + 4, cy - 5, x0 + w + 4, cy + 5, x0 + w + 12, cy);
  }
}

function centreOutOrder(width: number, height: number) {
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const idx = Array.from({ length: width * height }, (_, i) => i);
  const dist = (i: number) => Math.max(Math.abs((i % width) - cx), Math.abs(Math.floor(i / width) - cy));
  idx.sort((a, b) => dist(a) - dist(b));
  return Uint32Array.from(idx);
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

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
