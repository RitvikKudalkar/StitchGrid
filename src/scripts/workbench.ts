// Drives a [data-workbench]: loads an example or the visitor's photo, asks the worker for a
// pattern whenever an option changes, and fills the chart, the key and the summary.
// Everything stays in this tab; the photo is never uploaded.

import { hexToRgb, luminance } from '../engine/color';
import { DEFAULT_OPTIONS, type Pattern, type PatternOptions } from '../engine/pattern';
import { finishedSize, skeinsNeeded } from '../engine/stats';
import { symbolFor, symbolSvg } from '../engine/symbols';
import { ChartView, MIN_SYMBOL_CELL, type ChartMode } from './chart-view';
import { decodeFile, PatternClient } from './pattern-client';

const DEBOUNCE_MS = 120;
const ZOOMS = [1, 1.5, 2, 3, 4];

interface Sample { id: string; label: string; src: string }

export function initWorkbench(root: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const $$ = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)];

  const canvas = $<HTMLCanvasElement>('[data-chart]')!;
  const scroller = $('[data-scroller]')!;
  const list = $<HTMLUListElement>('[data-key-list]')!;
  const summary = $('[data-summary]')!;
  const status = $('[data-status]');
  const tip = $('[data-tip]');
  const view = new ChartView(canvas);
  const client = new PatternClient();
  const samples: Sample[] = JSON.parse(root.dataset.samples!);
  const unit = root.dataset.unit ?? 'stitches';
  const brand = root.dataset.brand ?? 'DMC';
  const nf = new Intl.NumberFormat('en');

  const options: PatternOptions = {
    ...DEFAULT_OPTIONS,
    cellsWide: Number(root.dataset.cells ?? DEFAULT_OPTIONS.cellsWide),
    maxColors: Number(root.dataset.colours ?? DEFAULT_OPTIONS.maxColors),
  };
  let fabric = Number(root.dataset.fabric ?? 14);
  let strands = 2;
  let pattern: Pattern | null = null;
  let preview: HTMLCanvasElement | null = null;
  let label = '';
  let pinned: number | null = null;
  let freshImage = false;
  let visible = false;
  let zoom = 0;
  let timer = 0;
  let slow = 0;

  // ---------- Rendering ----------
  function request() {
    clearTimeout(timer);
    timer = window.setTimeout(async () => {
      slow = window.setTimeout(() => status && (status.textContent = 'Matching colours…'), 200);
      const result = await client.render({ ...options });
      clearTimeout(slow);
      if (status) status.textContent = '';
      pattern = result;
      // Play the stitch-out once per new image. Off screen, hold the blurred photo and play
      // when the chart scrolls into view, so a finished chart never resets in front of you.
      view.show(result, preview, freshImage ? (visible ? 'play' : 'hold') : 'now');
      freshImage = false;
      updateHint();
      canvas.setAttribute('aria-label', `Chart of ${label}: ${result.width} by ${result.height} ${unit} in ${result.colors.length} ${brand} colours`);
      renderKey(result);
    }, DEBOUNCE_MS);
  }

  function loadImage(image: CanvasImageSource & { width: number; height: number }, name: string) {
    preview = client.load(image).preview;
    label = name;
    freshImage = true;
    pinned = null;
    request();
  }

  async function loadSample(id: string) {
    const s = samples.find((x) => x.id === id)!;
    const img = new Image();
    img.src = s.src;
    await img.decode();
    loadImage(img, `the example image (${s.label.toLowerCase()})`);
    $$<HTMLButtonElement>('[data-sample]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sample === id)));
  }

  async function loadFile(file: File) {
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
      if (status) status.textContent = 'That file isn\'t a photo. Choose a JPG, PNG, WebP or HEIC image.';
      return;
    }
    try {
      const bitmap = await decodeFile(file);
      loadImage(bitmap, 'your photo');
      bitmap.close();
      $$<HTMLButtonElement>('[data-sample]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      $('[data-chart-sheet]')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    } catch {
      if (status) {
        status.textContent = /\.(heic|heif)$/i.test(file.name)
          ? 'This browser can\'t open HEIC photos. Open this page in Safari, or save the photo as a JPG first.'
          : 'This photo couldn\'t be opened. Try saving it as a JPG or PNG.';
      }
    }
  }

  // ---------- Key and summary ----------
  function renderKey(p: Pattern) {
    const showSkeins = root.hasAttribute('data-skeins');
    let skeinTotal = 0;
    list.replaceChildren(
      ...p.colors.map((c, i) => {
        const rgb = hexToRgb(c.hex);
        const skeins = skeinsNeeded(c.count, fabric, strands);
        skeinTotal += skeins;
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'key-row';
        btn.setAttribute('aria-pressed', String(pinned === i));
        btn.title = `Show where ${brand} ${c.code} goes`;
        btn.innerHTML =
          `<span class="key-sym" style="background:${c.hex}">${symbolSvg(symbolFor(i), luminance(rgb) > 0.3 ? '#1a201e' : '#ece9e0', 20)}</span>` +
          `<span class="key-code">${c.code}</span><span class="key-name">${c.name}</span>` +
          `<span class="key-count">${nf.format(c.count)}</span>` +
          (showSkeins ? `<span class="key-skeins">${skeins}</span>` : '');
        btn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && pinned === null) view.setHighlight(i); });
        btn.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && pinned === null) view.setHighlight(null); });
        btn.addEventListener('click', () => {
          pinned = pinned === i ? null : i;
          list.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(j === pinned)));
          view.setHighlight(pinned);
        });
        li.append(btn);
        return li;
      }),
    );
    const size = finishedSize(p.width, p.height, fabric);
    const skeinText = showSkeins ? `, about ${skeinTotal} skeins` : '';
    summary.textContent =
      `${p.width} × ${p.height} ${unit}, ${p.colors.length} colours${skeinText}. ` +
      `${size.inches[0].toFixed(1)} × ${size.inches[1].toFixed(1)} in (${size.cm[0].toFixed(1)} × ${size.cm[1].toFixed(1)} cm) on ${fabric}-count.`;
  }

  // ---------- Controls ----------
  $$<HTMLButtonElement>('[data-sample]').forEach((b) => b.addEventListener('click', () => loadSample(b.dataset.sample!)));

  $<HTMLInputElement>('[data-file]')?.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) loadFile(file);
    input.value = '';
  });

  const drop = $('[data-drop]');
  const hint = $('[data-drop-hint]');
  if (drop && hint) {
    drop.addEventListener('dragover', (e) => { e.preventDefault(); hint.hidden = false; });
    drop.addEventListener('dragleave', (e) => { if (!drop.contains(e.relatedTarget as Node)) hint.hidden = true; });
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      hint.hidden = true;
      const file = e.dataTransfer?.files[0];
      if (file) loadFile(file);
    });
  }
  if (root.hasAttribute('data-paste')) {
    document.addEventListener('paste', (e) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) loadFile(file);
    });
  }

  // Number and range inputs: name="cellsWide" etc. map straight onto the options.
  $$<HTMLInputElement | HTMLSelectElement>('[data-option]').forEach((el) => {
    const key = el.dataset.option!;
    const output = root.querySelector(`[data-output="${key}"]`);
    const apply = () => {
      const value = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
      if (key === 'fabric') fabric = Number(value);
      else if (key === 'strands') strands = Number(value);
      else if (key === 'background') (options as PatternOptions).background = value ? 'empty' : 'keep';
      else if (typeof value === 'boolean') (options as unknown as Record<string, boolean>)[key] = value;
      else (options as unknown as Record<string, number>)[key] = Number(value);
      if (output) output.textContent = el instanceof HTMLInputElement && el.type === 'range' ? signed(key, Number(value)) : '';
      // Fabric and strands only change the arithmetic, not the chart.
      if ((key === 'fabric' || key === 'strands') && pattern) renderKey(pattern);
      else request();
    };
    el.addEventListener('input', apply);
    el.addEventListener('change', apply);
  });

  // Symbols need room: say so when the chart is too small to show them.
  const zoomHint = $('[data-zoom-hint]');
  const updateHint = () => {
    if (zoomHint) zoomHint.hidden = !(view.mode === 'symbols' && view.cell > 0 && view.cell < MIN_SYMBOL_CELL);
  };
  new ResizeObserver(() => requestAnimationFrame(updateHint)).observe(canvas);

  $$<HTMLButtonElement>('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      view.setMode(b.dataset.mode as ChartMode);
      $$('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      updateHint();
    }),
  );

  // At "Fit", the whole chart fits the box, so it never needs a scrollbar.
  // Matches the box's max-height in Workbench.astro: min(78svh, 900px).
  const fitHeight = () => (zoom === 0 ? Math.floor(Math.min(innerHeight * 0.78, 900)) : null);
  view.maxHeight = fitHeight();
  addEventListener('resize', () => {
    const h = fitHeight();
    if (h === view.maxHeight) return;
    view.maxHeight = h;
    view.draw();
  });

  const setZoom = (z: number) => {
    zoom = Math.max(0, Math.min(ZOOMS.length - 1, z));
    canvas.style.width = `${ZOOMS[zoom] * 100}%`;
    $('[data-zoom-label]')!.textContent = zoom === 0 ? 'Fit' : `${ZOOMS[zoom]}×`;
    view.maxHeight = fitHeight();
    view.draw();
    updateHint();
  };
  $('[data-zoom="in"]')?.addEventListener('click', () => setZoom(zoom + 1));
  $('[data-zoom="out"]')?.addEventListener('click', () => setZoom(zoom - 1));

  // Hover (or touch) a cell to read its thread.
  if (tip) {
    const showTip = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const hit = view.cellAt(e.clientX - rect.left, e.clientY - rect.top);
      if (!hit || !pattern || hit.color >= pattern.colors.length) { tip.hidden = true; return; }
      const c = pattern.colors[hit.color];
      tip.textContent = `${brand} ${c.code} ${c.name}, column ${hit.x + 1}, row ${hit.y + 1}`;
      const host = scroller.getBoundingClientRect();
      tip.style.left = `${Math.min(e.clientX - host.left + 14, host.width - 220)}px`;
      tip.style.top = `${e.clientY - host.top + scroller.scrollTop + 18}px`;
      tip.hidden = false;
    };
    canvas.addEventListener('pointermove', showTip);
    canvas.addEventListener('pointerdown', showTip);
    canvas.addEventListener('pointerleave', () => (tip.hidden = true));
  }

  // ---------- Export ----------
  const site = root.dataset.site ?? '';
  const download = (blob: Blob, name: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const fileBase = () => `stitchgrid-${pattern!.width}x${pattern!.height}-${pattern!.colors.length}-colours`;

  $('[data-export="pdf"]')?.addEventListener('click', async (e) => {
    if (!pattern) return;
    const btn = e.currentTarget as HTMLButtonElement;
    const text = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Making the PDF…';
    try {
      // Loaded on demand: the PDF library isn't part of the page until it's needed.
      const { patternToPdf } = await import('../engine/export/pdf');
      const paper = ($<HTMLSelectElement>('[data-paper]')?.value ?? 'a4') as 'a4' | 'letter';
      const colour = !$<HTMLInputElement>('[data-bw]')?.checked;
      const blob = patternToPdf(pattern, { title: root.dataset.pdfTitle ?? 'Cross stitch pattern', paper, colour, brand, fabricCount: fabric, strands, site });
      download(blob, `${fileBase()}.pdf`);
    } finally {
      btn.disabled = false;
      btn.textContent = text;
    }
  });
  $('[data-export="png"]')?.addEventListener('click', async () => {
    if (!pattern) return;
    const { patternToPng } = await import('../engine/export/png');
    download(await patternToPng(pattern, 12, true), `${fileBase()}.png`);
  });
  $('[data-export="csv"]')?.addEventListener('click', async () => {
    if (!pattern) return;
    const { patternToCsv } = await import('../engine/export/csv');
    download(new Blob([patternToCsv(pattern, brand, fabric, strands)], { type: 'text/csv' }), `${fileBase()}-threads.csv`);
  });
  const paper = $<HTMLSelectElement>('[data-paper]');
  if (paper && /^en-(US|CA)$|^es-(MX|US)$/.test(navigator.language)) paper.value = 'letter';

  // ---------- Start ----------
  loadSample(samples[0].id);
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible && view.held) view.play();
  }, { threshold: 0.35 }).observe(canvas);
}

function signed(key: string, v: number) {
  if (key === 'cellsWide' || key === 'maxColors') return String(v);
  return v > 0 ? `+${v}` : String(v);
}
