# StitchGrid design system

A chart sheet lying on a cutting mat. Every tool is the chart crafters print and pin beside their hoop; every other page is another piece of the same stationery: the folder, the key, the slip. The full reasoning is in `execution-plan.md` §7; the dealt direction is `.taste-skill/direction.json` ("The page is the object", seed 305097112). Tokens and component classes live in `src/styles/app.css`.

## The idea

- **The mat changes, the sheet never does.** The page ground is a cutting mat: dark green-black in dark theme, pale mat green in light. The chart paper (`--color-sheet`) is the same in both themes, because it is what gets printed.
- **One thread colour per craft** (`src/data/tools.ts`). It is the craft's folder tab on the homepage and the band behind the workbench on its page. Pass it to `Layout` as `thread`; it sets `--color-thread` / `--color-thread-ink`.
- **One shaped corner: the folder tab.** Tabs are trapezoids; buttons (`.btn-primary`, `.btn-secondary`) carry the same cut on their top corners (`--tab-cut`). Everything else is square.
- **Slips tear.** The key and the itinerary are `.slip`: paper with a zigzag bottom edge, made with a mask.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `mat` | `#cfd8d1` | `#161c1a` | Page ground |
| `mat-raised` | `#c2ccc5` | `#1f2725` | One tone step: footer, fabric bars |
| `text` | `#1a201e` | `#e3e2da` | All running text on the mat |
| `muted` | `#48514c` | `#8e948d` | Secondary notes only |
| `action` / `action-ink` | `#2f5e52` / `#ece9e0` | `#9fc7b8` / `#161c1a` | The primary button only |
| `sheet` / `sheet-ink` / `sheet-muted` | `#ece9e0` / `#1a201e` / `#545a55` | same | The chart paper, the key, slips |

Thread colours: cross stitch cranberry `#9c2136` (bone text), pixel art cornflower `#7096e0`, Minecraft grass `#86b34e`, bricks yellow `#f0c419`, beads tangerine `#f4914a`, crochet rose `#e58fae`, knitting teal `#3aa39b`, text tools linen `#cdbf9f` (all with mat text). Fields that carry running text are 7:1 or better. Run `npm run check:contrast` after changing any colour.

Surfaces are separated by a step in tone, never by a line or a shadow. Lines appear only inside the chart (where they are the product, marked `data-ui`), real tables and form fields.

## Type

- **Bebas Neue** (display, one cut): headlines, folder tabs, the giant section word. Uppercase comes from CSS; the HTML keeps sentence-case keywords.
- **EB Garamond** 400/500/italic (text): everything else, including controls and the key. Numbers that line up use `.tabular`.
- Both are self-hosted in `public/fonts/` (OFL, licences alongside). No Google Fonts request: "nothing calls the network" is a promise.
- No monospace anywhere. Chart symbols (Phase 1) are drawn paths, not a font.

| Step | Use |
|---|---|
| `--step-display` | Page H1 (`.display-xl`) |
| `--step-head` | Section headings (`.display-lg`) |
| `--step-lead` | Intros, tab names on desktop (`.lead`, `.title`) |
| `--step-body` | Running text, 17–19px |
| `--step-small` | Captions, credits (`.small`) |

Sentence case. No eyebrow labels, no all-caps tracked labels, no 01/02/03, no "→" on links. Headlines two lines or fewer at every width.

## Components

- `Workbench.astro`: the chart sheet (`ChartView`, `src/scripts/chart-view.ts`) and the key slip. Shows an example already charted; with `upload`, takes a file or a drop. Phase 1 swaps `preview-chart.ts` for the engine.
- `FolderStack.astro`: the homepage hero. Back folders link to sections and lend them their colour; the front folder is open.
- `StitchedWord.astro`: text as real cross stitches from `src/data/stitch-font.ts`. The footer mark and the OG image use it.
- `Mark.astro`: the logo, a 3×3 block of stitches with the centre one in the page's thread. Kept in step with `public/favicon.svg`.

## Imagery

- `src/assets/examples/`: example images for samples and the gallery. **Currently AI-generated test images**; replace with real photos before launch, keeping file names and crops. Always captioned "Example image".
- `src/assets/archive/`: public-domain needlework history, with credits in `credits.json` and `src/data/archive.ts`. Always credited on the page, never presented as StitchGrid's work.

## Motion

- **Signature: the stitch-out.** The first time an image is charted, cells resolve out of the blurred photo from the centre outwards in 700ms. Option changes swap instantly.
- **Key highlight:** pointing at (or tapping) a key row dims every other colour to 15% in 200ms.
- **Entrances:** `.reveal-children` and `.article` children rise 24px and fade in once, staggered (`Layout.astro`). Folder tabs settle in on load. Content is visible without script.
- **Feedback:** buttons press to 0.97, back folders lift on hover, the fabric plus turns into a cross.
- Transform and opacity only. Everything respects `prefers-reduced-motion`.

## Checks

`node <taste-skill>/scripts/lint.mjs src` and `node <taste-skill>/scripts/inspect.mjs <preview URL>` with no FAIL, then look at the screenshots. Run the inspector against `astro preview`, not `dist/index.html`, because asset paths are root-relative.
