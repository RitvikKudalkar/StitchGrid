# Implementation Plan: Photo-to-Craft Pattern Site

Source: `craft-pattern-keywords.xlsx` (Ahrefs free keyword generator, 25 Oct 2026).
Stack: the same as touchscreentester.com, so everything carries over.
- Astro + Tailwind v4
- Static build behind a Cloudflare Worker
- Auto-deploys from GitHub on push to `main`
- `DESIGN.md` design tokens

Domain: **not chosen yet.** See section 10.

## Goal

A set of free, private, in-browser tools that turn a photo into a printable craft pattern. The site is built to survive AI Overviews: **the output is a custom file from the visitor's own image**, which a search answer can't produce.

**Core idea:** one shared **image-to-grid engine** powers every page. Each craft is mostly:
- a palette (threads, beads, bricks, blocks or yarn)
- an output format (chart, parts list or written instructions)
- a page of content

---

## 1. Keyword → page map

| # | Page (URL) | Primary keyword | KD | Volume | Secondary (cover on-page) | Phase |
|---|---|---|---|---|---|---|
| 1 | `/cross-stitch-pattern-maker` | cross stitch pattern maker | Easy | >1,000 | free / best cross stitch pattern maker (Easy, >100), software, photo to cross stitch pattern cluster (Medium, <100) | 1 |
| 2 | `/pixel-art-converter` | pixel art converter | Easy | >1,000 | photo to pixel art converter, minecraft pixel art converter, with grid | 2 |
| 3 | `/minecraft-pixel-art-generator` | minecraft pixel art generator | Medium | >1,000 | with block count, material list, schematic, bedrock, from image, with grid | 2 |
| 4 | `/lego-mosaic-maker` | lego mosaic maker | Medium | >1,000 | — | 3 |
| 5 | `/perler-bead-pattern-maker` | perler bead pattern maker | Easy | >100 | free, online, custom (Hama/Artkal as palette options) | 3 |
| 6 | `/crochet-graph-maker` | crochet graph maker | Easy | >100 | free crochet graph maker, C2C / corner to corner, mosaic crochet | 4 |
| 7 | `/knitting-chart-maker` | knitting chart maker | Easy | >100 | free, from picture, free download, colorwork | 4 |
| 8 | `/text-to-cross-stitch` | cross stitch pattern maker text | Easy | <100 | cross stitch alphabet generator (**not yet checked**) | 5 |
| 9 | `/alpha-pattern-maker` | alpha pattern maker | Easy | <100 | from image, crochet | 5 |

**Skip:**
- Hama bead and diamond painting as separate pages: you checked them and found nothing special. Hama becomes a palette option on #5.
- All Hard variants: "cross stitch pattern maker free", "image to pixel art converter", "crochet alpha pattern maker" and others.

**Priority logic:** cross stitch is the **money page**: adult US/UK crafters, better ad rates, thread affiliates. Pixel art and Minecraft are **traffic pages**. Their audience skews young, so ad value is lower, but they build authority.

---

## 2. Architecture

```text
src/
├── engine/                     # Shared, framework-free TypeScript
│   ├── load-image.ts           # File/drag/paste → ImageBitmap, EXIF orientation, size cap
│   ├── crop.ts                 # Crop rectangle + aspect lock
│   ├── resize.ts               # Image → W×H grid (area-average, with cell aspect ratio)
│   ├── color.ts                # sRGB ↔ Lab, ΔE (CIEDE2000)
│   ├── quantize.ts             # Reduce to N colours (k-means in Lab, palette-constrained)
│   ├── map-palette.ts          # Grid → nearest palette colour, optional dithering
│   ├── cleanup.ts              # Remove isolated single cells ("confetti")
│   ├── symbols.ts              # Assign printable symbols per colour
│   ├── stats.ts                # Counts per colour, materials estimate
│   └── export/
│       ├── png.ts              # Grid image (with/without grid lines)
│       ├── pdf.ts              # Multi-page printable chart + legend
│       └── csv.ts              # Parts/material list
├── workers/pattern.worker.ts   # Runs the engine off the main thread
├── palettes/                   # One JSON file per palette (see section 4)
├── components/
│   ├── PatternTool.astro       # Shared tool shell: upload → options → preview → export
│   ├── tool/                   # Uploader, OptionsPanel, Preview (canvas), Legend, ExportBar
│   └── ...                     # Header, Footer, MoreToolsGrid, Faq
├── layouts/Layout.astro        # SEO tags, theme, analytics, consent (copy from touchscreentester)
├── data/tools.ts               # Single source of truth: page metadata, palette, defaults
└── pages/                      # One file per tool + guides + legal pages
```

**Rules**
- **The engine is pure TypeScript with no UI**, so it's easy to test and reuse.
- Each page passes a **config** to `PatternTool`: palette, cell aspect ratio, default size, output formats and craft-specific labels ("stitches", "beads", "studs", "blocks").
- **All heavy work runs in a Web Worker**, so the UI never freezes on big images.
- **Nothing is uploaded:** no server, no image storage. Say so on every page (privacy is a selling point).
- No framework is needed. Plain Astro components plus a client script, like touchscreentester. If the options panel gets complex, Preact is a small addition.

---

## 3. Engine spec (Phase 1 builds all of this)

**Input**
- JPG, PNG, WebP or HEIC (if the browser supports it), via file picker, drag-and-drop or paste.
- Downscale anything larger than ~4000 px before processing.

**Options shared by every craft**
| Option | Default | Notes |
|---|---|---|
| Width in cells | depends on craft (e.g. 100 stitches) | Height follows from the aspect ratio and cell shape |
| Max colours | 20 | 2–60 |
| Palette | craft default | e.g. DMC for cross stitch |
| Dithering | off | Floyd–Steinberg toggle; off gives cleaner charts |
| Cleanup | on | Merge isolated single cells into neighbours |
| Background | keep | "Treat as empty": leave unstitched or unbeaded |
| Brightness / contrast | 0 | Simple sliders before quantising |

**Pipeline**
1. Load, crop and adjust.
2. Resize to the grid, using **area averaging** (not nearest-neighbour) so colours aren't noisy.
3. Convert to **Lab** colour space.
4. Pick the best *N* palette colours. Use k-means in Lab to find *N* centres, then snap each to the nearest palette colour by **CIEDE2000**, de-duplicating as it goes.
5. Map every cell to its colour (optional dithering), then run cleanup.
6. Compute stats: counts per colour and a materials estimate.

**Performance target:** a 200×200 grid with 40 colours in under 1 second on a mid-range laptop. Re-render live when an option changes, debounced.

**Preview:** a canvas showing colour cells or symbols, zoomable, with grid lines every 10 cells (standard for charts). Hovering a cell shows its colour name and code.

**Editing (Phase 2+, optional):**
- Click a cell to change its colour, or swap all uses of one colour for another.
- "Remove colour" merges one colour into its nearest neighbour.

**Export**
- **PDF:** a cover page with a preview, the legend (symbol, code, name, count, skeins or bags needed) and the chart split across A4/Letter pages with page-overlap markers and row/column numbers. Both colour and black-and-white symbol versions.
- **PNG:** preview image.
- **CSV:** materials list.

**PDF library:** `pdf-lib` or `jsPDF`. Both run in the browser, and both should be loaded only when the visitor clicks Export, not on page load.

---

## 4. Palettes and data

Each palette is one JSON file: `{ id, name, brand, colors: [{ code, name, hex }] }`.

| Palette | Used by | Source / notes |
|---|---|---|
| DMC stranded cotton (~500 colours) | Cross stitch, text, alpha | Code/name/hex tables are widely published. **Hex values are approximations of real thread**, so say so |
| Anchor (optional, later) | Cross stitch | Adds a "DMC ↔ Anchor" angle later |
| Perler, Hama, Artkal | Perler page | Brand colour charts; Hama and Artkal as options on the same page |
| LEGO-compatible brick colours | LEGO mosaic | Public colour lists (e.g. Rebrickable's colour table); check its licence/attribution terms before use |
| Minecraft blocks | Minecraft page | **Average colour per block plus block name only.** Don't ship Mojang textures. Include a "survival-friendly blocks only" filter |
| Yarn (generic colours) | Crochet, knitting | Small generic set plus a "custom colours" option; yarn brands vary too much |

**Colour-accuracy disclaimer on every page:** screen colours and real materials differ. Recommend checking against a physical colour card.

---

## 5. Per-page specifics

### Phase 1: engine + cross stitch

**1. `/cross-stitch-pattern-maker`**
- Defaults: 100 stitches wide, 20 colours, DMC.
- **Fabric count setting** (11/14/16/18-count Aida) shows the finished size in inches and cm.
- **Skein estimate** per colour, based on stitches, fabric count and strands. Label it as an estimate.
- Symbol chart PDF with standard 10×10 grid lines and a centre marker.
- **Content sections:**
  - How to turn a photo into a cross stitch pattern
  - Choosing the right size and number of colours (table)
  - Fabric count explained (table)
  - Tips for photos that make good patterns
  - Printing and reading your chart
  - Comparison of pattern makers, which answers "best cross stitch pattern maker" honestly (include a table)
- **FAQ ideas:**
  - Is it free?
  - Are my photos uploaded?
  - How many colours should I use?
  - What size will my finished piece be?
  - Can I use Anchor threads?

### Phase 2: pixel art + Minecraft

**2. `/pixel-art-converter`**
- No palette restriction by default: free colours, or retro presets (Game Boy, NES, PICO-8 style limited palettes).
- Pixel size slider and a grid toggle (covers "pixel art converter with grid").
- Export as a crisp scaled-up PNG (nearest-neighbour upscale) and as a 1× PNG.

**3. `/minecraft-pixel-art-generator`**
- Minecraft block palette with filters: survival-friendly only, no gravity blocks, a wool-only or concrete-only option.
- **Block count and material list**, in stacks of 64 and shulker boxes (covers the "with block count" and "material list" variants).
- Layer-by-layer view for building.
- **Schematic export (`.litematic` / `.schem`) is a later stretch goal.** It's covered on-page by the "schematic" variant, but only build it if the page ranks.
- **Branding:** use "Minecraft" in text only. No logo and no Mojang textures. Add an "unofficial, not affiliated" note.

### Phase 3: LEGO + Perler

**4. `/lego-mosaic-maker`**
- Square 1×1 plate/tile grid, with common baseplate sizes: 16×16, 32×32, 48×48 and 2×2 or 3×3 of those.
- Parts list by colour, with an optional estimate of how many 1×1 pieces are needed.
- Show the finished size in cm.
- Say "LEGO-compatible" in text only, with no logo. Add a trademark note in the footer.

**5. `/perler-bead-pattern-maker`**
- Bead palette selector: Perler, Hama midi, Artkal.
- Pegboard sizes: 29×29 standard and 14×14 small, with patterns spanning multiple boards.
- Bead counts per colour; finished size from the 5 mm bead pitch.
- Section on ironing tips.

### Phase 4: crochet + knitting

**6. `/crochet-graph-maker`**
- Modes:
  - **Single crochet graph** (square-ish cells)
  - **C2C**: generates **written row-by-row diagonal instructions** (e.g. "Row 12: 3 blue, 2 white, 7 blue"), a strong differentiator
  - **Mosaic crochet**: 2 colours only, with a note on the technique
- Yarn colour list with custom hex input.

**7. `/knitting-chart-maker`**
- **Stitch aspect ratio** setting (default ≈ 0.8 width : 1 height) so knitted results don't look stretched. Allow custom gauge input (stitches and rows per 10 cm).
- Colourwork mode with a max-colours-per-row warning (stranded/Fair Isle).
- Row numbers alternate right/left, matching knitting convention.

### Phase 5: text-based

**8. `/text-to-cross-stitch`**
- Type a name or phrase, pick a bitmap font (several sizes, block and script styles), pick a thread colour, and add an optional border.
- Outputs the same chart PDF as page 1.
- If "cross stitch alphabet generator" checks out, add a printable full-alphabet chart per font.
- **Font licensing:** use pixel fonts with open licences (e.g. OFL), or design simple ones.

**9. `/alpha-pattern-maker`**
- For friendship bracelets: grid by strings × rows, with a small colour set.
- Photo or text input.
- Show the knot colour sequence per row.

---

## 6. Page template (every tool page)

- **Above the fold:** H1 with the primary keyword, a one-line promise ("Turn any photo into a printable cross stitch pattern: free, private, no sign-up"), and the **upload box**. The tool comes first.
- **Below the tool:**
  - `MoreToolsGrid` linking to other crafts
  - 1,000–1,500 words of genuinely useful content: how-to, tables, tips, limitations
  - 5–7 FAQs, shown visibly **and** as FAQPage JSON-LD
- **Example gallery:** 3–4 before/after examples (photo → pattern) using your own photos or properly licensed images. This makes the page stronger and helps image search.
- **Title:** ≤60 characters. **Meta description:** ≤155 characters. Canonical URLs with no trailing slash.
- **Schema:** `WebApplication` (free price, browser-based) plus `FAQPage` plus `BreadcrumbList`.
- **Design:** follow section 7. Its tokens go into `DESIGN.md` in Phase 0. Use light and dark themes, check every page at phone width, and make upload and export work on mobile.

---

## 7. Design direction

The direction was dealt with the `design-taste-frontend` skill: **"The page is the object"**, seed `305097112`. The full sheet is saved in `.taste-skill/direction.json`; reprint it with `node <skill>/scripts/draw.mjs --show`. Commit that file so later phases build from the same direction.

### 7.1 The idea

> **On this site, the pattern chart that crafters print and pin beside their hoop becomes the interface.** Every tool is a chart sheet lying on a cutting mat. Every other page is another piece of the same stationery: the key, the thread band, the folder the charts live in.

**Competitor test:** Pic2Pat, Stitch Fiddle and the others show a chart as an *output* inside a generic app frame. None of them makes the page itself the chart. The idea holds.

**What belongs to this subject** (the inventory every design decision is drawn from):
- The chart sheet: a bold line every 10 cells, centre arrows, row and column numbers.
- The key: symbol, swatch, code, name and count.
- The paper band around a thread skein, printed with its colour number.
- Aida cloth: bone-coloured, with a visible grid of holes.
- The dark green self-healing cutting mat, which every craft table has.
- Pegboards (29×29), beads with holes, beads fused after ironing.
- Brick studs and baseplates; stacks of 64 blocks; knitted V stitches; C2C diagonal tiles.
- Stitchers start from the **centre** of a chart, not the corner.
- Berlin woolwork charts: 1800s patterns hand-painted square by square on graph paper. They were the original "photo to pattern", and public-domain scans exist (see 7.7).
- The constraint that makes this site different: **the photo never leaves the device**.

### 7.2 Colour: cutting mat, Aida and thread

Keep the dealt proportions (one dark ground, one paper, one action colour). Take the colours from the craft table itself.

| Token | Hex | Role |
|---|---|---|
| `--mat` | `#161c1a` | Page ground in dark theme: the cutting mat |
| `--mat-raised` | `#1f2725` | Panels on the mat, separated by tone, never by a line or shadow |
| `--bone` | `#e3e2da` | Text on the mat |
| `--muted` | `#8e948d` | Secondary notes only, never running text |
| `--sheet` | `#ece9e0` | **The chart paper. Identical in both themes:** the chart is always paper, because it's what gets printed |
| `--ink` | `#1a201e` | Text and symbols on the sheet |
| `--jade` | `#9fc7b8` | The one action colour: "Choose a photo" and "Download PDF" only |

**Light theme:** `--mat` becomes a pale mat green `#cfd8d1`, `--mat-raised` becomes `#c2ccc5` and text on the mat becomes `--ink`. The sheet doesn't change.

**Thread colours, one per craft.** Each tool owns one flat thread colour. It's that tool's folder tab on the homepage, and on the tool page it fills the band behind the key and the section grounds. Same system, a different thread per craft.

| Craft | Thread | Text on it |
|---|---|---|
| Cross stitch | Cranberry `#9c2136` | `--bone` |
| Pixel art | Cornflower `#7096e0` | `--mat` |
| Minecraft | Grass `#86b34e` | `--mat` |
| Brick mosaic | Brick yellow `#f0c419` | `--mat` |
| Beads | Tangerine `#f4914a` | `--mat` |
| Crochet | Rose `#e58fae` | `--mat` |
| Knitting | Teal `#3aa39b` | `--mat` |
| Text and alpha | Linen `#cdbf9f` | `--mat` |

Check every pair for 4.5:1 contrast in Phase 0 and adjust the lightness if one fails. Don't add violet, gradients or a cream-and-terracotta pairing.

### 7.3 Type

- **Display: Bebas Neue** (one cut). Headlines and folder tab names only. Uppercase comes from CSS `text-transform`, so the HTML keeps sentence-case keywords for SEO ("Cross stitch pattern maker"). Tracking −0.02em, leading 0.85.
- **Text: EB Garamond** 400/500 plus italic. Body, controls, the key and tables. Body at 17–19px, because crafters skew older. Set numbers with `font-variant-numeric: lining-nums tabular-nums` so counts and codes line up in the key. Use no monospace anywhere, not even for thread codes.
- **Chart symbols aren't a font.** Draw a set of about 60 symbols as vector paths, shared by the canvas and the PDF, so screen and print match exactly.
- **Self-host both fonts** (`@fontsource`). A call to Google Fonts would break the "nothing calls the network" promise in section 11. Preload Bebas and subset both.
- Use five sizes at most: `--step-small`, `--step-body`, `--step-lead`, `--step-head` from the sheet, plus one display size.

### 7.4 The homepage: a folder of patterns

The dealt hero, the **tabbed folder stack**, fits this site exactly: crafters really do keep charts in folders.

```text
┌──────────────────────────────────────────────────────────────┐
│                          stitchgrid                   About  │
│                                                              │
│                     PHOTO TO PATTERN                         │  ← Bebas, ~70% width
│        Turn a photo into a chart you can print and stitch,   │
│        bead or build. It never leaves your device.           │
│                                                              │
│      ┌─CROSS STITCH─┐     ┌─BEADS─┐        ┌─BRICKS─┐        │  ← trapezoid tabs,
│   ┌──┴──────────────┴─────┴───────┴────────┴────────┴──┐     │    one thread colour each
│   │  ┌─PIXEL ART─┐               ┌─MINECRAFT─┐         │     │
│   ├──┴───────────┴───────────────┴───────────┴─────────┤     │
│   │ [Choose a photo]                                   │     │  ← front folder is open
│   │   drop zone ── the photo appears here, already     │     │    and runs off the screen
│   │   charted, in the craft of the active tab          │     │
└───┴────────────────────────────────────────────────────┴─────┘
```

- **Only live tools get a tab.** In Phase 1 the stack is the cross stitch tool plus the guides (Aida counts, skeins, how-to, About), and it grows as phases ship. Never show a "coming soon" tab.
- **The one live thing: one photo, every craft.** Drop a photo in the open front folder and it renders as a chart. Click another tab and the *same photo* re-renders as beads, bricks, blocks or knitting in that craft's palette. "Open in the cross stitch maker" carries the photo across in IndexedDB, still on the device. Without JavaScript, every tab is a plain link to its tool page.
- The front folder's tab shape returns as the top corners of the primary button. That's the site's only shaped corner; everything else is square.

### 7.5 The tool page: a chart on the mat

The tool comes first (section 6). The first screen is a **workbench**:

```text
┌──────────────────────────────────────────────────────────────┐
│ stitchgrid                         Tools  Guides  About      │
│ CROSS STITCH PATTERN MAKER                                   │  ← H1, Bebas, one line
│ Free, private, no sign-up. Your photo stays on this device.  │
│ ┌────────────────────────────────────┐ ┌──────────────────┐  │
│ │ THE SHEET (--sheet paper)          │ │ Size  Colours    │  │  ← 3 main controls,
│ │  col numbers 10 20 30 …            │ │ Fabric  [More]   │  │    the rest under "More"
│ │  ▸ centre arrows                   │ ├──────────────────┤  │
│ │   live chart: cells / symbols /    │ │ THE KEY (slip,   │  │  ← cranberry band,
│ │   as made                          │ │ zigzag bottom)   │  │    zigzag via clip-path
│ │                                    │ │ ▣ 310  Black 1,204│ │
│ │  [Chart | Symbols | As made]       │ │ ▣ 3865 Winter… 980│ │
│ └────────────────────────────────────┘ │ 7.1 × 5.7 in, 14ct│ │
│                                        │ [Download PDF]   │  │
│                                        └──────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

- **The empty state is a finished chart, not a grey box.** Before any upload, the sheet shows one of your own example photos already charted, with "Choose a photo, or drop one here" over it and two or three sample thumbnails to try. Google and first-time visitors see a working tool, never an empty frame.
- The sheet sits on the mat with **no shadow**: only the tone step from mat to paper. Grid lines appear only inside the chart, because there they're the product (mark the chart root `data-ui`).
- **Phone:** the sheet goes full width with pinch zoom. Size, Colours and Fabric live in a bottom bar, and "More" opens a sheet with the rest. The key goes below the chart. The file input offers the camera (`accept="image/*"`).
- `Ctrl+P` prints only the sheet and the key (print stylesheet).

### 7.6 The wow, spent in three places

Spend the boldness on these three and keep everything around them quiet.

1. **The stitch-out (the signature move).** The first time a photo is charted, the cells don't just appear: they resolve out of the blurred photo **from the centre outwards, ring by ring**, the way a stitcher works a chart, in about 700 ms. It plays once per new photo. Option changes after that swap instantly (debounced). With `prefers-reduced-motion`, the chart appears at once. Build it on canvas, with cells sorted by distance from the centre and drawn in batches per frame.
2. **Point at a thread, see where it goes.** Hovering or tapping a row in the key dims every other colour on the chart to about 15%, so only that thread's cells stay lit. Crafters do this today with a highlighter pen. It's the sheet's "index with preview" motion recipe, turned into a real feature. Use a fast 200 ms fade. On touch screens, a tap toggles it. Each key row is a real `<button>`.
3. **"As made" view.** A third preview mode renders the pattern in its material, procedurally on canvas with no textures:
   - **Cross stitch:** two crossed thread strokes per cell with a slight sheen, on Aida with visible holes.
   - **Beads:** rings with holes, plus an "ironed" switch that shrinks the holes.
   - **Bricks:** studs with one highlight.
   - **Minecraft:** flat blocks with slight per-block noise.
   - **Knitting:** V stitches at the 0.8 aspect.
   - **C2C crochet:** diagonal tiles.

   One renderer interface serves every craft: `renderCell(ctx, x, y, size, colour, craft)`. Each page also gets "Download as-made PNG": a mockup people share on Pinterest and in Facebook craft groups, carrying the site name small in one corner.

The key also gets one detail from the inventory: each swatch is drawn as a small wound skein with a paper band carrying the code. It's generic, with no brand marks.

### 7.7 Below the tool: sections from the dealt blueprints

Every section takes its geometry from a dealt blueprint and its content from the craft. Neighbouring sections never share a layout, and none of them is a card grid.

| Section | Blueprint | On the cross stitch page | Carries across to |
|---|---|---|---|
| Examples | Square plate, spare text | A square plate of the original photo, which flips to the chart. Three text tabs above it (Pet, Garden, Portrait). Two filled action cells: "Try this photo" and "Use your own" | Same on every tool, with that craft's examples |
| How it works | Itinerary on a slip | The process as a receipt grouped under time headings rather than step numbers: *Tonight* (choose photo, set size, print), *This weekend* (buy thread, find the centre), *This month* (stitch). The inverted last row gives the result: "You hold: a 9-page chart for a 7.1 × 5.7 in piece" | Beads: *This afternoon*; Minecraft: *This session* |
| Gallery | Photo tiles with label strips | Four columns of your own finished examples. Each strip reads like a swing tag: "100 × 80 · 18 colours · 14-count · 7.1 in". Strip colours rotate through the thread colours | All tools |
| Sizes | Giant word, filled bar rows | The word **FABRIC** fills the column. Each bar is a fabric count (11, 14, 16, 18) and opens to a finished-size table for common widths. This is the "Fabric count explained" content | **BOARDS** (beads), **PLATES** (bricks), **STACKS** (Minecraft), **GAUGE** (knitting) |
| FAQ | Answers as reading text | Two columns of run-in questions with answers on the same line, with no accordion. FAQPage JSON-LD is unchanged | All tools |
| Footer | The mark, built large | The wordmark built as a cross stitch alphabet chart: letters knocked out of thread-coloured blocks. It's a quiet advert for the text tool in Phase 5 | Site-wide |

The long-form content from section 5 (how-to, photo tips, comparison table) sits between Sizes and the FAQ as a reading column of about 68 characters. The comparison table is a real `<table>`, so it may have lines.

### 7.8 Imagery

The skill's floor is at least four real pictures per page. SVG drawings don't count.
- **Your own photos, converted and stitched** (the most important): 3–4 per tool, for the examples and the gallery. Photograph a printed chart lying on the mat, a real hoop with a 10×10 block stitched, and a real ironed bead piece. Nothing else proves the tool works this well.
- **One moving picture:** film a 6-second muted loop of a needle working through the chart you printed from the site. Use it with a poster frame in the How it works section.
- **History, from the open collections** (CC0, credited anyway):
  - Te Papa's hand-painted *Needlework pattern (1800–1900)*: [rawpixel page](https://www.rawpixel.com/image/9957675/needlework-pattern-1800-1900-nicolai). Use it on About and in the how-to guide under "Charts are 200 years old".
  - Elzy J. Bird, *Embroidery Sampler* (c. 1937), National Gallery of Art: [Commons page](https://commons.wikimedia.org/w/index.php?curid=82052617).

  Download them with `assets.mjs --get` so the credits are recorded, and put a credit line in the footer.
- **OG images:** per tool, the folder tab in its thread colour plus an as-made render.
- Use no stock photos of smiling crafters and no Mojang, LEGO or DMC imagery.

### 7.9 The PDF matches the site

The PDF is what people keep and pass around, so it carries the design too:
- The cover is the front of the folder: the tool name in Bebas, the preview, and the key as the slip.
- Chart pages use the same symbol paths as the screen.
- Every page footer carries a small "Made free at stitchgrid.com" (or whichever domain you pick). Charts get shared in craft groups for years, so this is free brand reach.

### 7.10 House rules (checked automatically)

- No eyebrow labels, no pill badges and no `01 / 02 / 03`. Order comes from time headings or position.
- No hairlines outside the chart and real tables. No gradients and no shadows at rest. Only the menu and dialogs float.
- Square corners everywhere. The only exception is the folder-tab shape on tabs and the primary button.
- Headlines are two lines or fewer at every width.
- Motion uses transform and opacity only, and every move has a reduced-motion fallback.
- Gate every PR with `node <skill>/scripts/lint.mjs src` and `node <skill>/scripts/inspect.mjs <preview URL>`. Look at the screenshots at 1440, 768 and 390 px before merging (see section 11).

---

## 8. Supporting guides

Each guide links to its tool. Write genuinely helpful, original guides; templated filler hurts you.

| Phase | Guide | Links to |
|---|---|---|
| 1 | How to turn a photo into a cross stitch pattern (step by step) | #1 |
| 1 | Aida fabric count explained: 11 vs 14 vs 16 vs 18 | #1 |
| 1 | How many DMC skeins do I need? | #1 |
| 1 | How to convert a photo to a cross stitch pattern in Photoshop (Easy, <100) and the faster free way | #1 |
| 2 | How to build pixel art in Minecraft (survival tips) | #3 |
| 3 | How to iron Perler beads | #5 |
| 4 | C2C crochet for beginners: reading a graph | #6 |
| 4 | Knitting gauge and why charts look stretched | #7 |

---

## 9. Site foundation, set up before launch

These lessons come from touchscreentester's AdSense rejection, so build them in from the start:
- About (who runs it and why), Contact, Privacy Policy (explicitly: images are processed on your device and never uploaded), and Terms.
- Copy `Layout.astro` patterns from touchscreentester: canonical URLs, OG image, consent banner with Consent Mode v2, and GA4.
- `ads.txt`, `robots.txt` and a sitemap (`@astrojs/sitemap`).
- 404 page, favicon and OG image.
- **Apply for AdSense only after** at least Phase 1 and Phase 2 are live with their guides, a few weeks of traffic, and enough real content.

---

## 10. Phases and timeline

| Phase | Scope | Rough effort |
|---|---|---|
| 0 | Domain, repo, Astro scaffold, layout, legal pages, deploy pipeline. Design system from section 7: tokens in `DESIGN.md`, self-hosted fonts, folder-stack homepage shell, sheet/key/slip components, contrast check of the thread colours | 2 days |
| 1 | Engine + Web Worker + PDF export (cover styled as the folder front) + **cross stitch page** with the stitch-out, key highlighting and the as-made view for stitches + 4 guides. Shoot your own example photos and the needle loop | 6–8 days |
| 2 | Pixel art + Minecraft pages (as-made blocks), cell editing | 2–3 days |
| 3 | LEGO mosaic + Perler pages | 2 days |
| 4 | Crochet (incl. C2C instructions) + knitting pages | 3 days |
| 5 | Text to cross stitch + alpha pattern pages | 2 days |

Effort assumes building with Claude Code. One branch and pull request per phase; never push straight to `main`.

**Domain:** pick something broad enough for every craft, not cross-stitch-only. Examples of the style: `stitchgrid`, `patternfromphoto`, `pixelpattern`. Check availability, and avoid brand names (LEGO, Minecraft, DMC, Perler) in the domain.

---

## 11. Quality checks (every PR)

- `npm run build` passes, every page is in the sitemap, and titles and descriptions are unique.
- Engine tests (Vitest) cover:
  - Lab conversion against known values
  - ΔE against reference pairs
  - Quantising a known image gives the expected colour count
  - Stats add up to width × height
- Manual checks:
  - A large photo (12 MP)
  - A tiny image
  - A transparent PNG
  - A HEIC photo on iPhone Safari
  - A dark-mode screenshot
  - Printing the PDF on Letter and A4
- Check that nothing calls the network during processing (DevTools Network tab).
- FAQ JSON-LD validates (Rich Results Test).
- Lighthouse: performance and accessibility ≥90 on tool pages.
- Design gate (section 7.10):
  - `lint.mjs` and `inspect.mjs` from `design-taste-frontend` show no FAIL.
  - Screenshots at 1440, 768 and 390 px have been looked at.
  - The stitch-out plays only once per photo and is off under reduced motion.
  - The key highlight works with keyboard and touch.
  - The sheet colour is the same in both themes.

---

## 12. Measuring and deciding

- Submit the sitemap in Search Console on launch day.
- **4–6 weeks after Phase 1:**
  - Is the cross stitch page indexed?
  - Does it get impressions for "cross stitch pattern maker"?
  - Is the average position under 20?
- **Decision gate:** keep going with Phases 3–5 only if Phases 1–2 show impressions and an improving position. Otherwise revisit before building more.
- Add "Live URL" and "GSC position" columns to `craft-pattern-keywords.xlsx` and update them monthly.

---

## 13. Monetization (after traffic)

- **AdSense:** below the tool and between content sections only, **never inside the tool area or next to the export button.** Keep the tool fast.
- **Affiliates:**
  - Cross stitch: embroidery thread, Aida fabric and hoop kits
  - Perler: bead kits and pegboards
  - LEGO mosaic: brick suppliers
  - Crochet and knitting: yarn
  - Put them in the materials list ("Buy these colours"), which is where the intent is.
- **Later, optional:** a paid "premium" PDF (larger sizes, more colours, no ads) with a simple one-time payment. Only consider this once free usage is proven.