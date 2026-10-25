// The example photos run through the real engine (scripts/render-examples.mjs): our own
// "after" pictures, made from the AI placeholder examples until they are replaced.
import type { ImageMetadata } from 'astro';
import { examples } from './examples';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/renders/*.png', { eager: true });
const image = (name: string) => files[`../assets/renders/${name}.png`].default;

export interface Render {
  id: string;
  label: string;
  photo: ImageMetadata;
  image: ImageMetadata;
  alt: string;
  /** Short facts for the label strip. */
  facts: string[];
}

const facts: Record<'pixel' | 'minecraft', Record<string, string[]>> = {
  pixel: {
    cat: ['48 × 48 pixels', '16 colours', 'Free colours'],
    flower: ['48 × 60 pixels', '16 colours', 'Free colours'],
    house: ['48 × 60 pixels', '16 colours', 'Free colours'],
    portrait: ['48 × 60 pixels', '16 colours', 'Free colours'],
  },
  minecraft: {
    cat: ['64 × 64 blocks', '24 kinds', '4,096 blocks'],
    flower: ['64 × 80 blocks', '22 kinds', '5,120 blocks'],
    house: ['64 × 80 blocks', '24 kinds', '5,120 blocks'],
    portrait: ['64 × 80 blocks', '22 kinds', '5,120 blocks'],
  },
};

export function renders(kind: 'pixel' | 'minecraft'): Render[] {
  return examples.map((e) => ({
    id: e.id,
    label: e.label,
    photo: e.image,
    image: image(`${kind}-${e.id}`),
    alt: kind === 'pixel'
      ? `The ${e.label.toLowerCase()} example turned into 16-colour pixel art`
      : `The ${e.label.toLowerCase()} example as Minecraft blocks, seen face on`,
    facts: facts[kind][e.id],
  }));
}
