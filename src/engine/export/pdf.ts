// The printable chart (execution-plan.md §3, §7.9): a cover with the preview and the key,
// then the chart split across pages with row and column numbers, a bold line every 10,
// centre arrows and a page map. Colour or black-and-white symbols. Loaded only on export.

import { jsPDF } from 'jspdf';
import { hexToRgb, luminance } from '../color';
import { EMPTY } from '../map-palette';
import type { Pattern } from '../pattern';
import { finishedSize, skeinsNeeded } from '../stats';
import { symbolFor, type SymbolOp } from '../symbols';
import { patternPreview } from './png';

export interface PdfOptions {
  title: string;
  paper: 'a4' | 'letter';
  colour: boolean;
  brand: string;
  fabricCount: number;
  strands: number;
  site: string;
}

const MARGIN = 12;
const CELL = 3; // mm per stitch on chart pages
const INK: [number, number, number] = [26, 32, 30];
const SHEET: [number, number, number] = [236, 233, 224];

export function patternToPdf(pattern: Pattern, o: PdfOptions): Blob {
  const doc = new jsPDF({ unit: 'mm', format: o.paper, orientation: 'portrait', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const innerW = pageW - MARGIN * 2;

  // Chart page layout: whole blocks of 10 cells per page.
  const top = MARGIN + 16;
  const left = MARGIN + 7;
  const colsPerPage = Math.floor((pageW - left - MARGIN) / CELL / 10) * 10;
  const rowsPerPage = Math.floor((pageH - top - MARGIN - 10) / CELL / 10) * 10;
  const pagesAcross = Math.ceil(pattern.width / colsPerPage);
  const pagesDown = Math.ceil(pattern.height / rowsPerPage);

  // ---------- Cover ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(o.title, MARGIN, MARGIN + 8);
  const size = finishedSize(pattern.width, pattern.height, o.fabricCount);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const summary = [
    `${pattern.width} x ${pattern.height} stitches, ${pattern.colors.length} ${o.brand} colours`,
    `Finished size on ${o.fabricCount}-count Aida: ${size.inches[0].toFixed(1)} x ${size.inches[1].toFixed(1)} in (${size.cm[0].toFixed(1)} x ${size.cm[1].toFixed(1)} cm)`,
    `Stitched with ${o.strands} strand${o.strands === 1 ? '' : 's'}. Chart on ${pagesAcross * pagesDown} page${pagesAcross * pagesDown === 1 ? '' : 's'}.`,
  ];
  doc.text(summary, MARGIN, MARGIN + 16, { lineHeightFactor: 1.45 });

  const preview = patternPreview(pattern, 900);
  const boxH = pageH * 0.42;
  const scale = Math.min(innerW / preview.width, boxH / preview.height);
  const pw = preview.width * scale;
  const ph = preview.height * scale;
  const py = MARGIN + 34;
  doc.addImage(preview, 'PNG', MARGIN, py, pw, ph, undefined, 'FAST');

  let y = py + ph + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Reading the chart', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const notes = doc.splitTextToSize(
    'Each square is one full cross stitch in the colour shown by its symbol in the key. Bold lines mark every 10 stitches, and the arrows mark the centre: fold your fabric in four to find its centre and start there. Numbers along the edges count stitches from the top left, and each page shows where it sits in the whole chart.',
    innerW,
  );
  doc.text(notes, MARGIN, y + 6, { lineHeightFactor: 1.4 });
  y += 8 + notes.length * 5;

  // ---------- Key ----------
  const rowH = 7;
  const cols = { sym: MARGIN, swatch: MARGIN + 9, code: MARGIN + 20, name: MARGIN + 38, count: pageW - MARGIN - 22, skeins: pageW - MARGIN };
  const keyHeader = (yy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Symbol', cols.sym, yy);
    doc.text(o.brand, cols.code, yy);
    doc.text('Name', cols.name, yy);
    doc.text('Stitches', cols.count, yy, { align: 'right' });
    doc.text('Skeins', cols.skeins, yy, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    return yy + 3;
  };
  if (y + 30 > pageH - MARGIN) { doc.addPage(); y = MARGIN + 6; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Key', MARGIN, y + 6);
  y = keyHeader(y + 13);
  let skeinTotal = 0;
  pattern.colors.forEach((c, i) => {
    if (y + rowH > pageH - MARGIN - 8) {
      doc.addPage();
      y = keyHeader(MARGIN + 6);
    }
    const rgb = hexToRgb(c.hex);
    const skeins = skeinsNeeded(c.count, o.fabricCount, o.strands);
    skeinTotal += skeins;
    if (o.colour) {
      doc.setFillColor(...rgb);
      doc.rect(cols.sym, y + 0.5, 6, 6, 'F');
      drawSymbol(doc, symbolFor(i), cols.sym, y + 0.5, 6, luminance(rgb) > 0.3 ? INK : SHEET);
    } else {
      drawSymbol(doc, symbolFor(i), cols.sym, y + 0.5, 6, INK);
    }
    doc.setFillColor(...rgb);
    doc.rect(cols.swatch, y + 1.5, 7, 4, 'F');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(c.code, cols.code, y + 4.8);
    doc.text(c.name, cols.name, y + 4.8);
    doc.text(c.count.toLocaleString('en'), cols.count, y + 4.8, { align: 'right' });
    doc.text(String(skeins), cols.skeins, y + 4.8, { align: 'right' });
    y += rowH;
  });
  doc.setFont('helvetica', 'bold');
  doc.text(`${skeinTotal} skeins in all`, cols.skeins, y + 5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    doc.splitTextToSize(`Skein counts are estimates for ${o.strands} strand${o.strands === 1 ? '' : 's'} on ${o.fabricCount}-count, with extra for starts and ends. Screen colours are close matches to real thread, not exact: check against a printed ${o.brand} colour card.`, innerW - 40),
    MARGIN,
    y + 5,
    { lineHeightFactor: 1.35 },
  );

  // ---------- Chart pages ----------
  const centreCol = pattern.width / 2;
  const centreRow = pattern.height / 2;
  for (let py2 = 0; py2 < pagesDown; py2++) {
    for (let px = 0; px < pagesAcross; px++) {
      doc.addPage();
      const c0 = px * colsPerPage;
      const r0 = py2 * rowsPerPage;
      const cw = Math.min(colsPerPage, pattern.width - c0);
      const rh = Math.min(rowsPerPage, pattern.height - r0);
      const n = py2 * pagesAcross + px + 1;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      doc.text(`Chart part ${n} of ${pagesAcross * pagesDown}`, MARGIN, MARGIN + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Columns ${c0 + 1}-${c0 + cw}, rows ${r0 + 1}-${r0 + rh}`, MARGIN, MARGIN + 9);
      drawPageMap(doc, pageW - MARGIN, MARGIN, pagesAcross, pagesDown, px, py2);

      // Cells
      for (let r = 0; r < rh; r++) {
        for (let c = 0; c < cw; c++) {
          const k = pattern.cells[(r0 + r) * pattern.width + c0 + c];
          if (k === EMPTY) continue;
          const x = left + c * CELL;
          const yy = top + r * CELL;
          const rgb = hexToRgb(pattern.colors[k].hex);
          if (o.colour) {
            doc.setFillColor(...rgb);
            doc.rect(x, yy, CELL, CELL, 'F');
          }
          drawSymbol(doc, symbolFor(k), x, yy, CELL, o.colour && luminance(rgb) <= 0.3 ? SHEET : INK);
        }
      }

      // Grid: fine per cell, bold every 10 (counted on the whole chart, not the page).
      for (let c = 0; c <= cw; c++) {
        const bold = (c0 + c) % 10 === 0 || c === cw;
        doc.setDrawColor(...INK);
        doc.setLineWidth(bold ? 0.35 : 0.08);
        doc.line(left + c * CELL, top, left + c * CELL, top + rh * CELL);
      }
      for (let r = 0; r <= rh; r++) {
        const bold = (r0 + r) % 10 === 0 || r === rh;
        doc.setLineWidth(bold ? 0.35 : 0.08);
        doc.line(left, top + r * CELL, left + cw * CELL, top + r * CELL);
      }

      // Numbers every 10 along the top and left.
      doc.setFontSize(6.5);
      for (let c = Math.ceil(c0 / 10) * 10; c <= c0 + cw; c += 10) {
        if (c === 0) continue;
        doc.text(String(c), left + (c - c0) * CELL, top - 1.5, { align: 'center' });
      }
      for (let r = Math.ceil(r0 / 10) * 10; r <= r0 + rh; r += 10) {
        if (r === 0) continue;
        doc.text(String(r), left - 1.5, top + (r - r0) * CELL + 0.8, { align: 'right' });
      }

      // Centre arrows, on the pages the centre lines cross.
      doc.setFillColor(...INK);
      if (centreCol >= c0 && centreCol <= c0 + cw) {
        const x = left + (centreCol - c0) * CELL;
        if (r0 + rh === pattern.height) doc.triangle(x - 1.6, top + rh * CELL + 1, x + 1.6, top + rh * CELL + 1, x, top + rh * CELL + 3.6, 'F');
      }
      if (centreRow >= r0 && centreRow <= r0 + rh) {
        const yy = top + (centreRow - r0) * CELL;
        if (c0 + cw === pattern.width) doc.triangle(left + cw * CELL + 1, yy - 1.6, left + cw * CELL + 1, yy + 1.6, left + cw * CELL + 3.6, yy, 'F');
      }

      // Where this page joins its neighbours.
      doc.setFontSize(7.5);
      if (px < pagesAcross - 1) doc.text(`continues on part ${n + 1}`, left + cw * CELL, top + rh * CELL + 5, { align: 'right' });
      if (py2 < pagesDown - 1) doc.text(`continues below on part ${n + pagesAcross}`, left, top + rh * CELL + 5);
    }
  }

  // ---------- Footer on every page ----------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(84, 90, 85);
    doc.text(`Made free at ${o.site}`, MARGIN, pageH - MARGIN / 2);
    doc.text(`Page ${p} of ${pages}`, pageW - MARGIN, pageH - MARGIN / 2, { align: 'right' });
  }
  return doc.output('blob');
}

/** A small grid of the chart's pages in the corner, with this page filled. */
function drawPageMap(doc: jsPDF, right: number, top: number, across: number, down: number, px: number, py: number) {
  const s = Math.min(4, 24 / Math.max(across, down));
  const x0 = right - across * s;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.2);
  for (let y = 0; y < down; y++) {
    for (let x = 0; x < across; x++) {
      if (x === px && y === py) {
        doc.setFillColor(...INK);
        doc.rect(x0 + x * s, top + y * s, s, s, 'FD');
      } else {
        doc.rect(x0 + x * s, top + y * s, s, s, 'S');
      }
    }
  }
}

function drawSymbol(doc: jsPDF, ops: SymbolOp[], x: number, y: number, size: number, ink: [number, number, number]) {
  doc.setDrawColor(...ink);
  doc.setFillColor(...ink);
  doc.setLineWidth(Math.max(0.12, size * 0.08));
  doc.setLineCap('round');
  for (const op of ops) {
    switch (op.t) {
      case 'rect':
        doc.rect(x + op.x * size, y + op.y * size, op.w * size, op.h * size, op.fill ? 'F' : 'S');
        break;
      case 'circle':
        doc.circle(x + op.cx * size, y + op.cy * size, op.r * size, op.fill ? 'F' : 'S');
        break;
      case 'line':
        doc.line(x + op.x1 * size, y + op.y1 * size, x + op.x2 * size, y + op.y2 * size);
        break;
      case 'poly': {
        const deltas: [number, number][] = [];
        for (let p = 2; p < op.pts.length; p += 2) deltas.push([(op.pts[p] - op.pts[p - 2]) * size, (op.pts[p + 1] - op.pts[p - 1]) * size]);
        doc.lines(deltas, x + op.pts[0] * size, y + op.pts[1] * size, [1, 1], op.fill ? 'F' : 'S', true);
        break;
      }
      case 'text':
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(size * 2.6);
        doc.setTextColor(...ink);
        doc.text(op.s, x + size / 2, y + size * 0.78, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...INK);
        break;
    }
  }
}
