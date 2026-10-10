# SEKUND pitch deck

The Colosseum Crypto World's Fair deck as a web app: eleven 1920 × 1080 slides, one per screen, drawn in the brand's ordered-dither look, white and steel blue on black. English on the slides, Serbian in the speaker notes.

```bash
pnpm install
pnpm dev:deck         # http://127.0.0.1:4320
```

| URL | View |
|---|---|
| `/#claim` … `/#close`, or `/#1` … `/#10` | The show. The hash is the slide. |
| `/?notes` | Presenter view: current and next slide, slide index, Serbian notes, clock, elapsed time. Both windows stay in sync. |
| `/?print` | All slides, full size, stacked. |
| `/?sheet` | Contact sheet, 1920 × 1080. |
| `/?logos` | Wordmark options A–D and the chosen E (Inter SemiBold): large, inverse, small, dithered, on the watch face, next to the same text set live in the font. |
| `/?illustrations` | Watch illustration options A–D: composite and dithered. |
| `/?hero` | The live illustration fully dithered next to the crisp-LCD treatment, at slide-1 size. |
| `/?palette` | Dither colour options A–C: slide 1, four flat swatches and a mini contact sheet each. |

Keys: arrows, Space, PageUp/PageDown, Home/End, `1`–`9`, `0`. Click right to advance, the left edge to go back. The keyboard hint shows while the pointer moves and hides when it rests.

## PDF

Cmd+P in the browser prints one 16:9 page per slide with backgrounds. Or, with the dev server running:

```bash
pnpm deck:export      # deck/out/: 01-claim.png … 11-close.png, contact-sheet.png, logo-options.png, illustration-options.png, hero-lcd-variants.png, dither-colour-options.png, sekund-pitch-deck.pdf
```

## Brand

Three constants, one assignment each:

| Export | Where | What |
|---|---|---|
| `WORDMARK` | `src/brand/index.ts` | The live wordmark: `INTER`, "SEKUND" in Inter SemiBold (600) with +4% tracking, converted to outlines from the self-hosted `@fontsource/inter` files (`src/brand/wordmark-inter.ts`). `BLOCK`, `CHAMFER`, `ROUND`, `DOTS` are the four drawn directions, `SEGMENT` the v2 mark; all stay on `/?logos`. The same outline is in `watch-sim/src/face/wordmark.ts` and `companion/public/sekund-logo.svg`. |
| `ILLUSTRATION` | `src/brand/illustrations.ts` | The live watch illustration for slides 1 and 11: `BROW_LIT`, the Brow photo with only the resin dithered and the LCD panel and wordmark laid over crisp. `BROW` is the fully dithered one; `FACETED`, `FRONTAL`, `TURNED` the other candidates; `CAPTURE` the plain watch-sim render. |
| `DITHER_PALETTE` | `src/dither/palette.ts` | The dither colours: `STEEL` (`#7a9bd0`, 60% of lit cells blue). `ELECTRIC` and `SOLANA` are the other two options on `/?palette`; `MONO` is white on black. Of the lit cells, the earliest in the Bayer order take the blue, so the pattern stays ordered at any density. Text, plates and the LCD never take the colour. |

Each drawn wordmark is one SVG path of polygons on a 100-unit cap height; the Inter one is the font's outlines with overlaps removed, on the same box, so every surface (raster composites, SVG face, 3D geometry, companion image) draws the identical shape with no runtime font. The illustrations are generated photos of a resin watch with a clean screen; the LCD is the real watch-sim capture warped into the screen in perspective, and the wordmark is kept as a separate transparent layer (`watch-*-mark.png`) that `HeroWatch` lays over the dithered photo so the letters stay crisp. A spec with `lcdSrc` (`watch-d-lcd.png`, `watch-d-approve-lcd.png`) gets the same treatment for the panel. Nothing in them is a photograph of real SEKUND hardware.

## Layout

No slide chrome: the wordmark appears only where it is content (the bezel, the LCD captures) and the slide index lives in the presenter view. One margin (`--d-margin`, 112 px) on all four sides. One headline weight (600) at two sizes: `.claim` (120 px) on the first and last slide, `.title` (84 px) on the rest; `.lead` 44, `.body` and `.sub` 36, `.mono` 30, `.small` 24, `.caption` 21 (`src/styles/tokens.css`). `.slide__body--quiet` centres a slide's group; `.slide__body--dense` runs from the top margin down, with `.foot` anchoring the closing line at the bottom margin. No plates on the dither: text that sits on a field is set with `Knock` (`src/ui/Knock.tsx`), which draws the text twice, a ground-coloured stroke under the ink, so the dither is knocked out in a tight per-letter shape (`--knock`, 9 px on `.claim`, 6 px on `.small`) and never a rectangle. The only accent allowed on a field is the paper chip (`.plate--inverse`). On slides 1 and 11 the watch is drawn by the same canvas as the field: `Dither` with `src`, `box` and `field` places the photo inside the full-bleed field on one cell grid, takes the object's silhouette from the photo and feathers it (`feather`, in cells) so the field is out in a band around the case and thins back in from there, with no rectangular edge. In the show, the pieces of the current slide rise in over 520 ms with a 90 ms stagger; the animation is scoped to `.show`, so print, the sheet and the presenter thumbnails are still, and it is off under `prefers-reduced-motion` (which the export sets).

## Where things are

| Path | What |
|---|---|
| `src/deck/slides.tsx` | Slide copy, layout and notes |
| `src/deck/facts.ts` | The devnet transaction shown on the proof slide, read back from the chain |
| `src/dither/` | Bayer 8×8 threshold, coverage fields, the palette, the `Dither` canvas |
| `src/brand/` | Wordmark directions and watch illustrations; the live pick for each |
| `src/ui/` | Wordmark, hero watch, 5×7 dot-matrix labels (Adafruit glcdfont, BSD), the how-it-works diagrams, capture frames and steps |
| `src/styles/` | Tokens (same fonts as the product, ink on black) and the screen, presenter, print and option-sheet stylesheets |
| `public/assets/` | Captures from the running 3D watch simulator (`watch-sim-3d.png`, `lcd-approve.png`), the Solana Explorer summary of the proof, the target-design render (`watch-target-render.png`) and the watch illustrations |
| `scripts/export.ts` | Playwright export of PNGs, contact sheet, option sheets and PDF |

The dither is written here; it is not the dither-kit package. That kit declares MIT in `package.json` but ships no `LICENSE` file, and its stack (Tailwind, shadcn, motion, d3 charts) does not fit a deck, so the look is reproduced, not imported.

## Checks

```bash
pnpm --filter @sekund/deck test
pnpm --filter @sekund/deck typecheck
pnpm --filter @sekund/deck lint
```
