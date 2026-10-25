import type { Pattern } from '../pattern';
import { blockStacks, skeinsNeeded } from '../stats';

/** The materials list as CSV: one row per thread, most stitches first. */
export function patternToCsv(pattern: Pattern, brand: string, fabricCount: number, strands: number) {
  const rows = [[`${brand} code`, 'Name', 'Hex', 'Symbol number', 'Stitches', 'Skeins (estimate)']];
  pattern.colors.forEach((c, i) => {
    rows.push([c.code, c.name, c.hex, String(i + 1), String(c.count), String(skeinsNeeded(c.count, fabricCount, strands))]);
  });
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** The Minecraft material list as CSV: one row per block, with stacks of 64 and shulker boxes. */
export function blocksToCsv(pattern: Pattern) {
  const rows = [['Block', 'ID', 'Count', 'Stacks of 64', 'Plus', 'Shulker boxes']];
  pattern.colors.forEach((c) => {
    const { stacks, rest, shulkers } = blockStacks(c.count);
    rows.push([c.name, `minecraft:${c.code}`, String(c.count), String(stacks), String(rest), shulkers.toFixed(2)]);
  });
  const total = pattern.colors.reduce((s, c) => s + c.count, 0);
  const t = blockStacks(total);
  rows.push(['Total', '', String(total), String(t.stacks), String(t.rest), t.shulkers.toFixed(2)]);
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const csvCell =(v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
