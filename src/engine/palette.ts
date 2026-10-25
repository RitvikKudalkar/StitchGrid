import { hexToRgb, rgbToLab, type Lab, type RGB } from './color';

/** A palette file in src/palettes/: one brand of thread, bead, brick, block or yarn. */
export interface PaletteFile {
  id: string;
  name: string;
  brand: string;
  note?: string;
  colors: { code: string; name: string; hex: string; tags?: string[] }[];
}

export interface PaletteColor {
  code: string;
  name: string;
  hex: string;
  rgb: RGB;
  lab: Lab;
  tags?: string[];
}

export interface Palette {
  id: string;
  name: string;
  brand: string;
  colors: PaletteColor[];
  /** Lab values packed as [L, a, b, L, a, b, …] for fast loops. */
  labs: Float64Array;
}

/** Which colours of a palette may be used, by tag. */
export interface PaletteFilter {
  /** Keep only colours with at least one of these tags. */
  only?: string[];
  /** Drop colours with any of these tags. */
  without?: string[];
}

export function preparePalette(file: PaletteFile, filter?: PaletteFilter): Palette {
  const only = filter?.only?.length ? new Set(filter.only) : null;
  const without = new Set(filter?.without ?? []);
  const colors = file.colors
    .filter((c) => !only || c.tags?.some((t) => only.has(t)))
    .filter((c) => !c.tags?.some((t) => without.has(t)))
    .map((c) => {
      const rgb = hexToRgb(c.hex);
      return { ...c, rgb, lab: rgbToLab(rgb) };
    });
  return fromColors(file.id, file.name, file.brand, colors);
}

export function fromColors(id: string, name: string, brand: string, colors: PaletteColor[]): Palette {
  const labs = new Float64Array(colors.length * 3);
  colors.forEach((c, i) => labs.set(c.lab, i * 3));
  return { id, name, brand, colors, labs };
}
