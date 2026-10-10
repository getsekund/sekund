# SEKUND pitch deck

The Colosseum Crypto World's Fair deck as a web app: ten 1920 × 1080 slides, one per screen, drawn in the brand's one-bit Bayer-dither look. English on the slides, Serbian in the speaker notes.

```bash
pnpm install
pnpm dev:deck         # http://127.0.0.1:4320
```

| URL | View |
|---|---|
| `/#claim` … `/#close`, or `/#1` … `/#10` | The show. The hash is the slide. |
| `/?notes` | Presenter view: current and next slide, Serbian notes, clock, elapsed time. Both windows stay in sync. |
| `/?print` | All slides, full size, stacked. |
| `/?sheet` | Contact sheet. |
| `/?logos` | Wordmark options A–D: large, inverse, small, dithered, on the watch face. |
| `/?illustrations` | Watch illustration options A–D: composite and dithered. |
| `/?hero` | The live illustration fully dithered next to the crisp-LCD treatment, at slide-1 size. |

Keys: arrows, Space, PageUp/PageDown, Home/End, `1`–`9`, `0`. Click right to advance, the left edge to go back.

## PDF

Cmd+P in the browser prints one 16:9 page per slide with backgrounds. Or, with the dev server running:

```bash
pnpm deck:export      # deck/out/: 01-claim.png … 10-close.png, contact-sheet.png, logo-options.png, illustration-options.png, hero-lcd-variants.png, sekund-pitch-deck.pdf
```

## Brand

`src/brand/` holds the wordmark and the hero illustration, each with its alternatives:

| Export | What |
|---|---|
| `WORDMARK` | The live wordmark. `BLOCK`, `CHAMFER`, `ROUND`, `DOTS` are the four directions; `SEGMENT` is the v2 mark the watch face still draws. Change the one assignment in `src/brand/index.ts` and every slide, the chrome and the sheets follow. |
| `ILLUSTRATION` | The live watch illustration for slides 1 and 10. `FACETED`, `FRONTAL`, `TURNED`, `BROW` are the generated candidates; `CAPTURE` is the plain watch-sim render. `BROW_LIT` is Brow with the LCD panel laid over the dither undithered, as a lit display. |

Each wordmark is one SVG path of polygons (fill-rule evenodd) on a 100-unit cap height, drawn from stroke skeletons rather than set in a font. The illustrations are generated photos of a resin watch with a clean screen; the LCD is the real watch-sim capture warped into the screen in perspective, and the wordmark is kept as a separate transparent layer (`watch-*-mark.png`) that `HeroWatch` lays over the dithered photo so the letters stay crisp. A spec with `lcdSrc` (`watch-d-lcd.png`, `watch-d-approve-lcd.png`) gets the same treatment for the panel, so only the resin is dithered. Nothing in them is a photograph of real SEKUND hardware.

## Where things are

| Path | What |
|---|---|
| `src/deck/slides.tsx` | Slide copy, layout and notes |
| `src/deck/facts.ts` | The devnet transaction shown on the proof slide, read back from the chain |
| `src/dither/` | Bayer 8×8 threshold, coverage fields, the `Dither` canvas |
| `src/brand/` | Wordmark directions and watch illustrations; the live pick for each |
| `src/ui/` | Wordmark, hero watch, 5×7 dot-matrix labels (Adafruit glcdfont, BSD), screenshot frames |
| `src/styles/` | Tokens (same fonts as the product, ink on black) and the screen, presenter, print and option-sheet stylesheets |
| `public/assets/` | Screenshots from the running companion and 3D watch, the Solana Explorer summary of the proof, and the watch illustrations |
| `scripts/export.ts` | Playwright export of PNGs, contact sheet, option sheets and PDF |

The dither is written here; it is not the dither-kit package. That kit declares MIT in `package.json` but ships no `LICENSE` file, and its stack (Tailwind, shadcn, motion, d3 charts) does not fit a deck, so the look is reproduced, not imported.

## Checks

```bash
pnpm --filter @sekund/deck test
pnpm --filter @sekund/deck typecheck
pnpm --filter @sekund/deck lint
```
