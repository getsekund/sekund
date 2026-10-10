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

Keys: arrows, Space, PageUp/PageDown, Home/End, `1`–`9`, `0`. Click right to advance, the left edge to go back.

## PDF

Cmd+P in the browser prints one 16:9 page per slide with backgrounds. Or, with the dev server running:

```bash
pnpm deck:export      # deck/out/: 01-claim.png … 10-close.png, contact-sheet.png, sekund-pitch-deck.pdf
```

## Where things are

| Path | What |
|---|---|
| `src/deck/slides.tsx` | Slide copy, layout and notes |
| `src/deck/facts.ts` | The devnet transaction shown on the proof slide, read back from the chain |
| `src/dither/` | Bayer 8×8 threshold, coverage fields, the `Dither` canvas |
| `src/ui/` | Wordmark, 5×7 dot-matrix labels (Adafruit glcdfont, BSD), screenshot frames |
| `src/styles/` | Tokens (same fonts as the product, ink on black) and the screen, presenter and print stylesheets |
| `public/assets/` | Screenshots from the running companion and 3D watch, and the Solana Explorer summary of the proof |
| `scripts/export.ts` | Playwright export of PNGs, contact sheet and PDF |

The dither is written here; it is not the dither-kit package. That kit declares MIT in `package.json` but ships no `LICENSE` file, and its stack (Tailwind, shadcn, motion, d3 charts) does not fit a deck, so the look is reproduced, not imported.

## Checks

```bash
pnpm --filter @sekund/deck test
pnpm --filter @sekund/deck typecheck
pnpm --filter @sekund/deck lint
```
