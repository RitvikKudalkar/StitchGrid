import type { Pattern } from '../pattern';
import { skeinsNeeded } from '../stats';

/** The materials list as CSV: one row per thread, most stitches first. */
export function patternToCsv(pattern: Pattern, brand: string, fabricCount: number, strands: number) {
  const rows = [[`${brand} code`, 'Name', 'Hex', 'Symbol number', 'Stitches', 'Skeins (estimate)']];
  pattern.colors.forEach((c, i) => {
    rows.push([c.code, c.name, c.hex, String(i + 1), String(c.count), String(skeinsNeeded(c.count, fabricCount, strands))]);
  });
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
