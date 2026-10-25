import { hexToRgb, rgbToLab, type Lab, type RGB } from './color';

/** A palette file in src/palettes/: one brand of thread, bead, brick, block or yarn. */
export interface PaletteFile {
  id: string;
  name: string;
  brand: string;
  note?: string;
  colors: { code: string; name: string; hex: string }[];
}

export interface PaletteColor {
  code: string;
  name: string;
  hex: string;
  rgb: RGB;
  lab: Lab;
}

export interface Palette {
  id: string;
  name: string;
  brand: string;
  colors: PaletteColor[];
  /** Lab values packed as [L, a, b, L, a, b, …] for fast loops. */
  labs: Float64Array;
}

export function preparePalette(file: PaletteFile): Palette {
  const colors = file.colors.map((c) => {
    const rgb = hexToRgb(c.hex);
    return { ...c, rgb, lab: rgbToLab(rgb) };
  });
  const labs = new Float64Array(colors.length * 3);
  colors.forEach((c, i) => labs.set(c.lab, i * 3));
  return { id: file.id, name: file.name, brand: file.brand, colors, labs };
}
