// Renders public/favicon.svg, favicon.ico, apple-touch-icon.png and og-image.png.
// The OG image is the site name stitched in every craft's thread, from the bitmap alphabet
// in src/data/stitch-font.ts. Run with `npm run render:icons` after changing the name or colours.

import sharp from 'sharp';
import fs from 'node:fs';
import { layoutStitches, crossPath } from '../src/data/stitch-font.ts';
import { SITE_NAME } from '../src/data/site.ts';

const out = new URL('../public/', import.meta.url);
const SHEET = '#ece9e0', INK = '#1a201e', MAT = '#161c1a', BONE = '#e3e2da', CRANBERRY = '#9c2136';
const THREADS = ['#9c2136', '#7096e0', '#86b34e', '#f0c419', '#f4914a', '#e58fae', '#3aa39b', '#cdbf9f'];

// Mark: 3×3 cross stitches on Aida, the centre one in cranberry (matches src/components/Mark.astro).
const cells = [0, 1, 2].flatMap((y) => [0, 1, 2].map((x) => [x + 0.5, y + 0.5]));
const dark = cells.filter((_, i) => i !== 4).map(([x, y]) => crossPath(x, y)).join('');
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="${SHEET}"/><path d="${dark}" stroke="${INK}" stroke-width="0.26" stroke-linecap="round" fill="none"/><path d="${crossPath(1.5, 1.5)}" stroke="${CRANBERRY}" stroke-width="0.26" stroke-linecap="round" fill="none"/></svg>`;
fs.writeFileSync(new URL('favicon.svg', out), mark);

const png = (size) => sharp(Buffer.from(mark), { density: (72 * size) / 4 }).resize(size, size).png().toBuffer();
fs.writeFileSync(new URL('apple-touch-icon.png', out), await png(180));

// favicon.ico holding one 48×48 PNG.
const p48 = await png(48);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(48, 6); header.writeUInt8(48, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(p48.length, 14); header.writeUInt32LE(22, 18);
fs.writeFileSync(new URL('favicon.ico', out), Buffer.concat([header, p48]));

// OG image: the name stitched in every craft's thread, the promise stitched below in bone.
function stitched(text, colours, x, y, cell) {
  const { cells: s } = layoutStitches(text);
  const paths = colours.map((c, i) => `<path d="${s.filter((st) => st.letter % colours.length === i).map((st) => crossPath(st.x, st.y)).join('')}" stroke="${c}" stroke-width="0.24" stroke-linecap="round" fill="none"/>`);
  return `<g transform="translate(${x} ${y}) scale(${cell})">${paths.join('')}</g>`;
}
const W = 1200, H = 630, M = 80;
const nameCell = (W - M * 2) / layoutStitches(SITE_NAME).width;
const tag = 'Photo to pattern';
const tagCell = Math.min(12, ((W - M * 2) * 0.8) / layoutStitches(tag).width);
const block = 7 * nameCell + 60 + 7 * tagCell;
const top = (H - block) / 2;
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${MAT}"/>${stitched(SITE_NAME, THREADS, M, top, nameCell)}${stitched(tag, [BONE], M, top + 7 * nameCell + 60, tagCell)}</svg>`;
await sharp(Buffer.from(og)).png().toFile(new URL('og-image.png', out).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
console.log(`og-image.png: "${SITE_NAME}" at ${nameCell.toFixed(1)} px per stitch`);
