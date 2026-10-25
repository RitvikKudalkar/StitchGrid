// Drives a [data-workbench]: loads an example or the visitor's photo, asks the worker for a
// pattern whenever an option changes, and fills the chart, the key and the summary. Also the
// hand edits (paint, fill, erase, merge, undo) and Minecraft's row-by-row building view.
// Everything stays in this tab; the photo is never uploaded.

import { hexToRgb, luminance } from '../engine/color';
import { mergeColor, paintCells, replaceColor, withColor } from '../engine/edit';
import { EMPTY } from '../engine/map-palette';
import type { PaletteFilter } from '../engine/palette';
import { DEFAULT_OPTIONS, type Pattern, type PatternColor, type PatternOptions } from '../engine/pattern';
import { blockStacks, finishedSize, formatStacks, skeinsNeeded } from '../engine/stats';
import { symbolFor, symbolSvg } from '../engine/symbols';
import type { CraftConfig } from '../data/crafts';
import { ChartView, MIN_SYMBOL_CELL, type ChartMode } from './chart-view';
import { decodeFile, PatternClient } from './pattern-client';

const DEBOUNCE_MS = 120;
const ZOOMS = [1, 1.5, 2, 3, 4];
const MAX_UNDO = 50;

interface Sample { id: string; label: string; src: string }
type Tool = 'paint' | 'fill' | 'erase';

export function initWorkbench(root: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const $$ = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)];

  const canvas = $<HTMLCanvasElement>('[data-chart]')!;
  const scroller = $('[data-scroller]')!;
  const list = $<HTMLUListElement>('[data-key-list]')!;
  const keyHead = $('[data-key-head]');
  const summary = $('[data-summary]')!;
  const status = $('[data-status]');
  const tip = $('[data-tip]');
  const view = new ChartView(canvas);
  const client = new PatternClient();
  const samples: Sample[] = JSON.parse(root.dataset.samples!);
  const crafts: CraftConfig[] = JSON.parse(root.dataset.crafts!);
  const nf = new Intl.NumberFormat('en');

  let craft = crafts[0];
  let paletteIndex = 0;
  const options: PatternOptions = { ...DEFAULT_OPTIONS };
  let fabric = 14;
  let strands = 2;
  let filterSurvival = true;
  let filterGravity = true;
  let pattern: Pattern | null = null;
  let preview: HTMLCanvasElement | null = null;
  let label = '';
  let pinned: number | null = null;
  let freshImage = false;
  let visible = false;
  let zoom = 0;
  let timer = 0;
  let slow = 0;
  // Editing
  let editing = false;
  let tool: Tool = 'paint';
  let brush: Omit<PatternColor, 'count'> | null = null;
  const history: Pattern[] = [];
  // Building row by row (Minecraft); counted from the bottom row up.
  let layer: number | null = null;

  const fixedSize = root.hasAttribute('data-fixed-size');
  function applyCraft(next: CraftConfig) {
    craft = next;
    paletteIndex = 0;
    if (!fixedSize) {
      options.cellsWide = craft.width.value;
      options.maxColors = craft.colours.value;
    }
    view.craft = craft.made;
    view.symbols = craft.id === 'cross-stitch';
    view.mode = craft.views[0].id;
    root.dataset.activeCraft = craft.id;
  }
  if (fixedSize) {
    options.cellsWide = Number(root.dataset.cells);
    options.maxColors = Number(root.dataset.colours);
  }
  applyCraft(craft);

  // ---------- Rendering ----------
  function paletteRequest(): [string, PaletteFilter | undefined] {
    const choice = craft.palettes[paletteIndex];
    if (!craft.blockFilters) return [choice.id, choice.filter];
    const without = [...(filterSurvival ? ['precious'] : []), ...(filterGravity ? ['gravity'] : [])];
    return [choice.id, { ...choice.filter, without }];
  }

  function request() {
    clearTimeout(timer);
    timer = window.setTimeout(async () => {
      slow = window.setTimeout(() => status && (status.textContent = craft.id === 'cross-stitch' ? 'Matching threads…' : 'Matching colours…'), 200);
      const [palette, filter] = paletteRequest();
      const result = await client.render({ ...options }, palette, filter);
      clearTimeout(slow);
      if (status) status.textContent = '';
      // A new chart replaces any hand edits; keep the edited one so undo can bring it back.
      if (pattern && history.length) pushHistory(pattern);
      // Play the stitch-out once per new image. Off screen, hold the blurred photo and play
      // when the chart scrolls into view, so a finished chart never resets in front of you.
      setPattern(result, freshImage ? (visible ? 'play' : 'hold') : 'now');
      freshImage = false;
    }, DEBOUNCE_MS);
  }

  function setPattern(p: Pattern, how: 'now' | 'hold' | 'play' = 'now') {
    pattern = p;
    if (pinned !== null && pinned >= p.colors.length) pinned = null;
    if (layer !== null && layer >= p.height) layer = p.height - 1;
    view.layer = layer === null ? null : p.height - 1 - layer;
    view.show(p, preview, how);
    canvas.setAttribute('aria-label', `Chart of ${label}: ${p.width} by ${p.height} ${craft.unit} in ${p.colors.length} colours`);
    renderKey(p);
    renderLayer();
    updateHint();
    const undo = $<HTMLButtonElement>('[data-undo]');
    if (undo) undo.disabled = history.length === 0;
  }

  function loadImage(image: CanvasImageSource & { width: number; height: number }, name: string) {
    preview = client.load(image).preview;
    label = name;
    freshImage = true;
    pinned = null;
    history.length = 0;
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
  const materialsFor = (count: number) =>
    craft.materials === 'skeins' ? String(skeinsNeeded(count, fabric, strands))
      : craft.materials === 'stacks' ? formatStacks(count)
        : '';

  function renderKey(p: Pattern) {
    const cols = keyColumns();
    root.style.setProperty('--key-cols', cols.template);
    if (keyHead) keyHead.innerHTML = cols.head.map((h, i) => `<span${i >= cols.rightFrom ? ' class="r"' : ''}>${h}</span>`).join('');
    list.replaceChildren(
      ...p.colors.map((c, i) => {
        const rgb = hexToRgb(c.hex);
        const li = document.createElement('li');
        li.className = 'key-item';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'key-row';
        const isBrush = editing && brush?.code === c.code;
        btn.setAttribute('aria-pressed', String(editing ? isBrush : pinned === i));
        btn.title = editing ? `Paint with ${c.name}` : `Show where ${c.name} goes`;
        const sym = craft.id === 'cross-stitch' ? symbolSvg(symbolFor(i), luminance(rgb) > 0.3 ? '#1a201e' : '#ece9e0', 20) : '';
        const cells = [`<span class="key-sym" style="background:${c.hex}">${sym}</span>`];
        if (craft.id === 'cross-stitch') cells.push(`<span>${c.code}</span>`, `<span class="key-name">${c.name}</span>`);
        else if (craft.id === 'pixel-art') cells.push(`<span class="key-name">${c.hex.toUpperCase()}</span>`);
        else cells.push(`<span class="key-name">${c.name}</span>`);
        cells.push(`<span class="r">${nf.format(c.count)}</span>`);
        if (craft.materials !== 'none') cells.push(`<span class="r">${materialsFor(c.count)}</span>`);
        btn.innerHTML = cells.join('');
        btn.addEventListener('pointerenter', (e) => { if (!editing && e.pointerType === 'mouse' && pinned === null) view.setHighlight(i); });
        btn.addEventListener('pointerleave', (e) => { if (!editing && e.pointerType === 'mouse' && pinned === null) view.setHighlight(null); });
        btn.addEventListener('click', () => {
          if (editing) {
            brush = { palette: c.palette, code: c.code, name: c.name, hex: c.hex };
            renderKey(pattern!);
            return;
          }
          pinned = pinned === i ? null : i;
          list.querySelectorAll('.key-row').forEach((b, j) => b.setAttribute('aria-pressed', String(j === pinned)));
          view.setHighlight(pinned);
        });
        li.append(btn);
        if (editing && p.colors.length > 1) {
          const merge = document.createElement('button');
          merge.type = 'button';
          merge.className = 'key-merge';
          merge.textContent = 'Merge';
          merge.setAttribute('aria-label', `Merge ${c.name} into the closest colour`);
          merge.addEventListener('click', () => {
            pushHistory(pattern!);
            setPattern(mergeColor(pattern!, i));
          });
          li.append(merge);
        }
        return li;
      }),
    );

    const total = p.colors.reduce((s, c) => s + c.count, 0);
    if (craft.id === 'cross-stitch') {
      const size = finishedSize(p.width, p.height, fabric);
      const skeins = p.colors.reduce((s, c) => s + skeinsNeeded(c.count, fabric, strands), 0);
      summary.textContent = `${p.width} × ${p.height} stitches, ${p.colors.length} colours, about ${skeins} skeins. ` +
        `${size.inches[0].toFixed(1)} × ${size.inches[1].toFixed(1)} in (${size.cm[0].toFixed(1)} × ${size.cm[1].toFixed(1)} cm) on ${fabric}-count.`;
    } else if (craft.id === 'minecraft') {
      const { stacks, shulkers } = blockStacks(total);
      summary.textContent = `${p.width} × ${p.height} blocks, ${p.colors.length} kinds, ${nf.format(total)} blocks in all: ` +
        `${nf.format(stacks)} stacks, or ${shulkers.toFixed(1)} shulker boxes.`;
    } else {
      const scale = Number($<HTMLInputElement>('[data-scale]')?.value ?? 8);
      summary.textContent = `${p.width} × ${p.height} pixels, ${p.colors.length} colours. The scaled image is ${p.width * scale} × ${p.height * scale} px.`;
    }
  }

  function keyColumns() {
    if (craft.id === 'cross-stitch') return { template: '26px 44px minmax(0, 1fr) auto 36px', head: ['', craft.brand, 'Name', 'Stitches', 'Skeins'], rightFrom: 3 };
    if (craft.id === 'pixel-art') return { template: '26px minmax(0, 1fr) auto', head: ['', 'Colour', 'Pixels'], rightFrom: 2 };
    return { template: '26px minmax(0, 1fr) auto auto', head: ['', 'Block', 'Count', 'Stacks'], rightFrom: 2 };
  }

  // ---------- Building row by row ----------
  function renderLayer() {
    const panel = $('[data-layer-panel]');
    if (!panel || !pattern) return;
    panel.hidden = layer === null;
    if (layer === null) return;
    const row = pattern.height - 1 - layer;
    const runs: [number, number][] = [];
    for (let x = 0; x < pattern.width; x++) {
      const c = pattern.cells[row * pattern.width + x];
      if (runs.length && runs[runs.length - 1][0] === c) runs[runs.length - 1][1]++;
      else runs.push([c, 1]);
    }
    $('[data-layer-label]')!.textContent = `Row ${layer + 1} of ${pattern.height}, counted from the bottom`;
    $('[data-layer-runs]')!.innerHTML = runs
      .map(([c, n]) => c === EMPTY
        ? `<li><span class="run-swatch run-empty"></span>${n} × leave empty</li>`
        : `<li><span class="run-swatch" style="background:${pattern!.colors[c].hex}"></span>${n} × ${pattern!.colors[c].name}</li>`)
      .join('');
  }
  const setLayer = (l: number | null) => {
    layer = l === null || !pattern ? l : Math.max(0, Math.min(pattern.height - 1, l));
    view.layer = layer === null || !pattern ? null : pattern.height - 1 - layer;
    view.draw();
    renderLayer();
  };
  $<HTMLInputElement>('[data-layers]')?.addEventListener('change', (e) => setLayer((e.target as HTMLInputElement).checked ? 0 : null));
  $('[data-layer="down"]')?.addEventListener('click', () => layer !== null && setLayer(layer - 1));
  $('[data-layer="up"]')?.addEventListener('click', () => layer !== null && setLayer(layer + 1));

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

  // Inputs with data-option map onto the options; a few only change the arithmetic.
  $$<HTMLInputElement | HTMLSelectElement>('[data-option]').forEach((el) => {
    const key = el.dataset.option!;
    const output = root.querySelector(`[data-output="${key}"]`);
    const apply = () => {
      const value = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
      if (output) output.textContent = el instanceof HTMLInputElement && el.type === 'range' ? signed(key, Number(value)) : '';
      if (key === 'fabric' || key === 'strands') {
        if (key === 'fabric') fabric = Number(value);
        else strands = Number(value);
        if (pattern) renderKey(pattern);
        return;
      }
      if (key === 'palette') paletteIndex = Number(value);
      else if (key === 'survival') filterSurvival = Boolean(value);
      else if (key === 'gravity') filterGravity = Boolean(value);
      else if (key === 'background') options.background = value ? 'empty' : 'keep';
      else if (typeof value === 'boolean') (options as unknown as Record<string, boolean>)[key] = value;
      else (options as unknown as Record<string, number>)[key] = Number(value);
      request();
    };
    el.addEventListener('input', apply);
    el.addEventListener('change', apply);
  });

  // The homepage switch: the same photo, charted for another craft.
  $$<HTMLButtonElement>('[data-craft]').forEach((b) =>
    b.addEventListener('click', () => {
      const next = crafts.find((c) => c.id === b.dataset.craft);
      if (!next || next.id === craft.id) return;
      applyCraft(next);
      $$('[data-craft]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const link = $<HTMLAnchorElement>('[data-craft-link]');
      if (link) {
        link.href = b.dataset.href!;
        link.textContent = b.dataset.linkLabel!;
      }
      pinned = null;
      freshImage = true;
      request();
    }),
  );

  // Symbols need room: say so when the chart is too small to show them.
  const zoomHint = $('[data-zoom-hint]');
  function updateHint() {
    if (zoomHint) zoomHint.hidden = !(view.mode === 'symbols' && view.cell > 0 && view.cell < MIN_SYMBOL_CELL);
  }

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

  // ---------- Editing ----------
  function pushHistory(p: Pattern) {
    history.push(p);
    if (history.length > MAX_UNDO) history.shift();
  }
  function undo() {
    const prev = history.pop();
    if (prev) setPattern(prev);
  }
  $('[data-undo]')?.addEventListener('click', undo);
  root.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && history.length) {
      e.preventDefault();
      undo();
    }
  });

  const editToggle = $<HTMLButtonElement>('[data-edit]');
  editToggle?.addEventListener('click', () => {
    editing = !editing;
    editToggle.setAttribute('aria-pressed', String(editing));
    $('[data-edit-bar]')!.hidden = !editing;
    root.classList.toggle('is-editing', editing);
    if (editing) {
      pinned = null;
      view.setHighlight(null);
      if (pattern && !brush) brush = { ...pattern.colors[0] };
    }
    if (pattern) renderKey(pattern);
  });
  $$<HTMLButtonElement>('[data-tool]').forEach((b) =>
    b.addEventListener('click', () => {
      tool = b.dataset.tool as Tool;
      $$('[data-tool]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }),
  );

  // A stroke paints straight onto the chart, then becomes one undoable edit on release.
  let stroke: { base: Pattern; cells: Set<number>; color: number } | null = null;
  const hitAt = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return view.cellAt(e.clientX - rect.left, e.clientY - rect.top);
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (!editing || !pattern || !brush) return;
    const hit = hitAt(e);
    if (!hit) return;
    e.preventDefault();
    if (tool === 'fill') {
      if (hit.color === EMPTY) return;
      const { pattern: withBrush, index } = withColor(pattern, brush);
      if (index === hit.color) return;
      pushHistory(pattern);
      setPattern(replaceColor(withBrush, hit.color, index));
      return;
    }
    const { pattern: base, index } = tool === 'erase' ? { pattern, index: EMPTY } : withColor(pattern, brush);
    stroke = { base, cells: new Set(), color: index };
    canvas.setPointerCapture(e.pointerId);
    paintAt(hit.y * pattern.width + hit.x);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!stroke || !pattern) return;
    const hit = hitAt(e);
    if (hit) paintAt(hit.y * pattern.width + hit.x);
  });
  const endStroke = () => {
    if (!stroke || !pattern) return;
    const done = stroke;
    stroke = null;
    if (!done.cells.size) return;
    pushHistory(pattern);
    setPattern(paintCells(done.base, done.cells, done.color));
  };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);
  function paintAt(i: number) {
    if (!stroke || stroke.cells.has(i)) return;
    stroke.cells.add(i);
    // Show the stroke at once on a working copy; the real recount happens on release.
    const live = view.data!;
    const cells = live.cells === stroke.base.cells ? stroke.base.cells.slice() : live.cells;
    cells[i] = stroke.color;
    view.show({ ...stroke.base, cells }, preview, 'now');
  }

  // Hover (or touch) a cell to read its colour.
  if (tip) {
    const showTip = (e: PointerEvent) => {
      if (editing && e.buttons) { tip.hidden = true; return; }
      const hit = hitAt(e);
      if (!hit || !pattern || hit.color >= pattern.colors.length) { tip.hidden = true; return; }
      const c = pattern.colors[hit.color];
      const name = craft.id === 'cross-stitch' ? `${craft.brand} ${c.code} ${c.name}` : craft.id === 'pixel-art' ? c.hex.toUpperCase() : c.name;
      tip.textContent = `${name}, column ${hit.x + 1}, row ${hit.y + 1}`;
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
  const fileBase = () => `patternsquare-${craft.fileStem}-${pattern!.width}x${pattern!.height}`;

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
      const blob = patternToPdf(pattern, { title: craft.pdfTitle ?? 'Pattern', paper, colour, brand: craft.brand, fabricCount: fabric, strands, site });
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
  $('[data-export="png-scaled"]')?.addEventListener('click', async () => {
    if (!pattern) return;
    const { patternToPng } = await import('../engine/export/png');
    const scale = Number($<HTMLInputElement>('[data-scale]')?.value ?? 8);
    const grid = Boolean($<HTMLInputElement>('[data-png-grid]')?.checked);
    download(await patternToPng(pattern, scale, grid && scale >= 4), `${fileBase()}-${scale}x.png`);
  });
  $('[data-export="png-1x"]')?.addEventListener('click', async () => {
    if (!pattern) return;
    const { patternToPng } = await import('../engine/export/png');
    download(await patternToPng(pattern, 1, false), `${fileBase()}-1x.png`);
  });
  $('[data-export="csv"]')?.addEventListener('click', async () => {
    if (!pattern) return;
    const { patternToCsv, blocksToCsv } = await import('../engine/export/csv');
    const text = craft.id === 'minecraft' ? blocksToCsv(pattern) : patternToCsv(pattern, craft.brand, fabric, strands);
    download(new Blob([text], { type: 'text/csv' }), `${fileBase()}-${craft.id === 'minecraft' ? 'blocks' : 'threads'}.csv`);
  });
  $<HTMLInputElement>('[data-scale]')?.addEventListener('input', (e) => {
    const out = $('[data-scale-out]');
    if (out) out.textContent = (e.target as HTMLInputElement).value;
    if (pattern) renderKey(pattern);
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
