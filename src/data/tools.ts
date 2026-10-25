// One entry per craft tool (execution-plan.md §1). Each tool owns one thread colour (§7.2):
// its folder tab on the homepage, and the band behind the key on its own page.
// Only `live` tools appear in navigation and the folder stack. Never show a "coming soon" tab.

export interface Tool {
  slug: string;
  /** Primary keyword, sentence case. Becomes the H1. */
  name: string;
  /** Short name on folder tabs and in navigation. */
  tab: string;
  /** What one cell is called on this craft. */
  unit: string;
  thread: string;
  /** Text colour on the thread colour, checked by `npm run check:contrast`. */
  threadInk: string;
  phase: number;
  live: boolean;
}

export const tools: Tool[] = [
  { slug: 'cross-stitch-pattern-maker', name: 'Cross stitch pattern maker', tab: 'Cross stitch', unit: 'stitches', thread: '#9c2136', threadInk: '#f6f3ec', phase: 1, live: true },
  { slug: 'pixel-art-converter', name: 'Pixel art converter', tab: 'Pixel art', unit: 'pixels', thread: '#7096e0', threadInk: '#161c1a', phase: 2, live: false },
  { slug: 'minecraft-pixel-art-generator', name: 'Minecraft pixel art generator', tab: 'Minecraft', unit: 'blocks', thread: '#86b34e', threadInk: '#161c1a', phase: 2, live: false },
  { slug: 'lego-mosaic-maker', name: 'Lego mosaic maker', tab: 'Bricks', unit: 'studs', thread: '#f0c419', threadInk: '#161c1a', phase: 3, live: false },
  { slug: 'perler-bead-pattern-maker', name: 'Perler bead pattern maker', tab: 'Beads', unit: 'beads', thread: '#f4914a', threadInk: '#161c1a', phase: 3, live: false },
  { slug: 'crochet-graph-maker', name: 'Crochet graph maker', tab: 'Crochet', unit: 'stitches', thread: '#e58fae', threadInk: '#161c1a', phase: 4, live: false },
  { slug: 'knitting-chart-maker', name: 'Knitting chart maker', tab: 'Knitting', unit: 'stitches', thread: '#3aa39b', threadInk: '#161c1a', phase: 4, live: false },
  { slug: 'text-to-cross-stitch', name: 'Text to cross stitch', tab: 'Text', unit: 'stitches', thread: '#cdbf9f', threadInk: '#161c1a', phase: 5, live: false },
  { slug: 'alpha-pattern-maker', name: 'Alpha pattern maker', tab: 'Alpha', unit: 'knots', thread: '#cdbf9f', threadInk: '#161c1a', phase: 5, live: false },
];

export const liveTools = tools.filter((t) => t.live);

export const toolBySlug = (slug: string) => tools.find((t) => t.slug === slug)!;
