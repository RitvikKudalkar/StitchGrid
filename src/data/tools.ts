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
  { slug: 'cross-stitch-pattern-maker', pitch: "Turn your photo into a chart with a DMC thread list. Free, and your photo stays on your device.", name: 'Cross stitch pattern maker', tab: 'Cross stitch', unit: 'stitches', thread: '#9c2136', threadInk: '#f6f3ec', phase: 1, live: true },
  { slug: 'pixel-art-converter', pitch: "Turn your photo into pixel art with free or retro colours, and download a crisp PNG. Free and private.", name: 'Pixel art converter', tab: 'Pixel art', unit: 'pixels', thread: '#7096e0', threadInk: '#161c1a', phase: 2, live: true },
  { slug: 'minecraft-pixel-art-generator', pitch: "Turn your image into Minecraft pixel art with a block count in stacks and a row-by-row guide. Free and unofficial.", name: 'Minecraft pixel art generator', tab: 'Minecraft', unit: 'blocks', thread: '#86b34e', threadInk: '#161c1a', phase: 2, live: true },
  { slug: 'lego-mosaic-maker', pitch: "Turn your photo into a brick mosaic with a parts list by colour.", name: 'Lego mosaic maker', tab: 'Bricks', unit: 'studs', thread: '#f0c419', threadInk: '#161c1a', phase: 3, live: false },
  { slug: 'perler-bead-pattern-maker', pitch: "Turn your photo into a bead pattern with bead counts and pegboards.", name: 'Perler bead pattern maker', tab: 'Beads', unit: 'beads', thread: '#f4914a', threadInk: '#161c1a', phase: 3, live: false },
  { slug: 'crochet-graph-maker', pitch: "Turn your photo into a crochet graph, with C2C row-by-row instructions.", name: 'Crochet graph maker', tab: 'Crochet', unit: 'stitches', thread: '#e58fae', threadInk: '#161c1a', phase: 4, live: false },
  { slug: 'knitting-chart-maker', pitch: "Turn your photo into a colourwork knitting chart that isn't stretched.", name: 'Knitting chart maker', tab: 'Knitting', unit: 'stitches', thread: '#3aa39b', threadInk: '#161c1a', phase: 4, live: false },
  { slug: 'text-to-cross-stitch', pitch: "Turn a name or phrase into a cross stitch chart.", name: 'Text to cross stitch', tab: 'Text', unit: 'stitches', thread: '#cdbf9f', threadInk: '#161c1a', phase: 5, live: false },
  { slug: 'alpha-pattern-maker', pitch: "Turn a photo or text into a friendship bracelet alpha pattern.", name: 'Alpha pattern maker', tab: 'Alpha', unit: 'knots', thread: '#cdbf9f', threadInk: '#161c1a', phase: 5, live: false },
];

export const liveTools = tools.filter((t) => t.live);

/** A tool name for use mid-sentence: lower case, except names that start with a proper noun. */
export const inSentence = (name: string) => (/^(Minecraft|Lego|Perler)/.test(name) ? name : name[0].toLowerCase() + name.slice(1));

export const toolBySlug = (slug: string) => tools.find((t) => t.slug === slug)!;
