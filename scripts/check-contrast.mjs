// Checks every text/ground pair in the design tokens against WCAG AA (4.5:1).
// Run with `npm run check:contrast`. Keep the values in step with src/styles/app.css.

const pairs = [
  // [label, text, ground]
  ['bone on mat (dark)', '#e3e2da', '#161c1a'],
  ['muted on mat (dark)', '#8e948d', '#161c1a'],
  ['bone on mat-raised (dark)', '#e3e2da', '#1f2725'],
  ['muted on mat-raised (dark)', '#8e948d', '#1f2725'],
  ['ink on mat (light)', '#1a201e', '#cfd8d1'],
  ['muted on mat (light)', '#48514c', '#cfd8d1'],
  ['ink on mat-raised (light)', '#1a201e', '#c2ccc5'],
  ['muted on mat-raised (light)', '#48514c', '#c2ccc5'],
  ['ink on sheet', '#1a201e', '#ece9e0'],
  ['sheet-muted on sheet', '#545a55', '#ece9e0'],
  ['mat on jade (action)', '#161c1a', '#9fc7b8'],
  ['jade-dark on light mat (action, light)', '#ece9e0', '#2f5e52'],
  // Thread colours: one per craft
  ['bone on cranberry (7:1 for running text)', '#f6f3ec', '#9c2136'],
  ['mat on cornflower', '#161c1a', '#7096e0'],
  ['mat on grass', '#161c1a', '#86b34e'],
  ['mat on brick yellow', '#161c1a', '#f0c419'],
  ['mat on tangerine', '#161c1a', '#f4914a'],
  ['mat on rose', '#161c1a', '#e58fae'],
  ['mat on teal', '#161c1a', '#3aa39b'],
  ['mat on linen', '#161c1a', '#cdbf9f'],
];

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

let failed = 0;
for (const [label, text, ground] of pairs) {
  const r = ratio(text, ground);
  const ok = r >= 4.5;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  ${label}`);
}
process.exit(failed ? 1 : 0);
