// Every guide, with the tool it supports (execution-plan.md §7 Supporting guides).
// The page itself lives in src/pages/guides/<slug>.astro.
import type { ImageMetadata } from 'astro';
import { archive } from './archive';
import { examples } from './examples';
import { renders } from './renders';

export interface GuidePicture {
  image: ImageMetadata;
  alt: string;
  /** Credit line for found pictures; examples are captioned "Example image". */
  credit?: string;
  source?: string;
}

export interface Guide {
  slug: string;
  title: string;
  /** Meta description, ≤155 characters. Also shown in guide lists. */
  description: string;
  tool: string;
  /** Lead picture under the title, and the thumbnail in guide lists. */
  picture: GuidePicture;
  published: string;
  modified?: string;
}

const cat = examples.find((e) => e.id === 'cat')!;
const minecraftHouse = renders('minecraft').find((r) => r.id === 'house')!;

export const guides: Guide[] = [
  {
    slug: 'how-to-turn-a-photo-into-a-cross-stitch-pattern',
    title: 'How to turn a photo into a cross stitch pattern',
    description: 'A step-by-step guide: choosing the photo, cropping, setting size and colours, matching DMC threads and printing a chart you can follow.',
    tool: 'cross-stitch-pattern-maker',
    picture: { image: cat.image, alt: cat.alt },
    published: '2026-10-25',
  },
  {
    slug: 'aida-fabric-count-explained',
    title: 'Aida fabric count explained: 11 vs 14 vs 16 vs 18',
    description: 'What Aida count means, how it changes the size of your finished piece, and which count, strands and needle to use for each.',
    tool: 'cross-stitch-pattern-maker',
    picture: archive.sampler,
    published: '2026-10-25',
  },
  {
    slug: 'how-many-dmc-skeins-do-i-need',
    title: 'How many DMC skeins do I need?',
    description: 'How far one skein of DMC goes on each fabric count, a quick way to estimate thread for any chart, and when to buy extra.',
    tool: 'cross-stitch-pattern-maker',
    picture: archive.skeins,
    published: '2026-10-25',
  },
  {
    slug: 'photo-to-cross-stitch-pattern-in-photoshop',
    title: 'How to make a cross stitch pattern in Photoshop',
    description: 'Turn a photo into a cross stitch chart in Photoshop with Image Size, Indexed Color and a grid, plus the faster free way with DMC matching.',
    tool: 'cross-stitch-pattern-maker',
    picture: archive.berlinChart,
    published: '2026-10-25',
  },
  {
    slug: 'how-to-build-pixel-art-in-minecraft',
    title: 'How to build pixel art in Minecraft',
    description: 'Plan, gather and build Minecraft pixel art in survival: picking blocks, counting stacks, building a wall row by row and fixing mistakes.',
    tool: 'minecraft-pixel-art-generator',
    picture: { image: minecraftHouse.image, alt: minecraftHouse.alt },
    published: '2026-10-26',
  },
];

export const guideBySlug = (slug: string) => guides.find((g) => g.slug === slug)!;
