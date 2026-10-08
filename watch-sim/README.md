# SEKUND watch simulator

The SEKUND face in the browser: a soft-rectangle resin watch with four plain pushers, a grey-green LCD with DSEG7/DSEG14 segments, and a 5×7 dot-matrix review strip. Under it runs the watch state machine from spec v1.1 §6, §7 and §11.1. Solana devnet only. The secure element in this simulator is software. The signatures are real.

It speaks the real protocol (`docs/PROTOCOL.md`). Frames arrive over the local relay and pass the shared `RequestGuard` from `@sekund/protocol`. The simulated SE from `@sekund/se-sim` signs them, running in a Web Worker with IndexedDB.

The visuals follow the brand system in DESIGN.md: tokens, the watch face, Secure Mode screens, and the page around them (paper bench, Archivo titles, status chips in the watch's own words). The watch face is the one dot surface on this page. The boot screen uses the section 10 paper loader beside "Starting the watch." and does not add a second field behind the bench. The page is light only, Spot appears only where a person must stop, and there are no gradients, glow or backlight.

## Run

From the repo root:

```bash
pnpm install
pnpm relay        # ws://127.0.0.1:4319, stands in for Bluetooth
pnpm dev:watch    # http://127.0.0.1:4318
pnpm dev:companion  # http://127.0.0.1:4317, sends sign requests
```

```bash
pnpm --filter @sekund/watch-sim test       # state machine, face strings, gestures, controller against the in-process SE
pnpm --filter @sekund/watch-sim typecheck
pnpm --filter @sekund/watch-sim build
```

WebCrypto Ed25519 is required (Chrome 137+, Firefox, Safari).

## First run

The SE starts in factory state. Press A+D and choose a 4-digit PIN (`NEW PIN`). A press during the one-second `SECURE` screen already counts on the PIN screen. The SE sets the PIN and creates the devnet key inside the chip. The address appears under Menu → Address and in the side panel. The key persists in this browser's IndexedDB. After that, A+D asks for the PIN.

## Controls

The pushers sit at A (upper left), B (lower left), C (upper right) and D (lower right). They carry no labels. An annunciator triangle on the LCD lights next to each pusher that does something on the current screen, and the side panel lists what each one does.

| Pusher | Key |
|---|---|
| A | `←` |
| B | `→` |
| C | `Esc` |
| D | `Enter` |
| C+D | `Space` |

You can click the pushers too. Shift-click latches a pusher, so a mouse can make combinations. On touch screens, press two pushers with two fingers, or use the C+D and A+D buttons under the watch. `W` toggles the wrist.

| Screen | Pushers |
|---|---|
| Normal | Shows the time and does nothing else. **A+D (hidden) enters Secure Mode.** |
| PIN | A/B change the digit down/up. C+D confirms the digit. C goes to the previous digit, or leaves. |
| Menu | A/B move between Address, Sign request and Settings. D selects. C locks and returns to the time. |
| Address | A/B change the page. C goes back. |
| Review | A/B move to the previous/next field. C rejects. D approves on `APPROVE?` only. |
| Result | D continues. Every result except `EXPIRED` also moves on by itself after 3 s. |

## States

Normal → A+D → `SECURE` → PIN → Menu → Review → Approve or Reject → result.

The review pages are parsed from the exact message bytes:

- `AMOUNT`
- `TO 1/2` and `TO 2/2` (the full destination in groups of four)
- `NETWORK`
- `FEE`
- `APPROVE?`

The large digits count down to expiry.

- Requests are answered `LOCKED` unless a PIN session is open.
- At zero the watch answers `EXPIRED`, never signs, and waits on `ASK APP AGAIN` until D.
- Off-wrist ends the SE session at once and answers anything under review `LOCKED`.
- Three wrong PINs erase the key. The watch shows `LOCKED` / `KEY ERASED` until you press Reset in the side panel. The next A+D then starts first-run setup again.
- The guard refuses oversize requests (`TOO_LARGE`, against the SE's `maxMessageBytes`) before display. It also refuses non-transfer, durable-nonce, versioned, foreign-wallet and replayed requests.
- Approve issues an SE approve token bound to the exact message bytes. The SE then signs those bytes with Ed25519 (no pre-hash).

The side panel shows the wrist toggle, the companion link, the SE state and an event log, newest first.

## Layout

| Path | What |
|---|---|
| `src/machine/machine.ts` | Pure state machine: `transition(state, event) → { state, effects }`. Security-critical. |
| `src/machine/controller.ts` | Runs the guard on incoming frames, and runs the effects against the SE and transport. Keeps the event log. |
| `src/machine/log.ts` | Event log lines. |
| `src/machine/gestures.ts` | Turns presses and releases into button combinations. |
| `src/hints.ts` | What each pusher does per state (annunciators and the legend). |
| `src/services.ts` | Relay transport (role `watch`) and the browser SE. |
| `src/face/Watch.tsx` | SVG case, strap, pushers and LCD, following the DESIGN.md face geometry (360×470). |
| `src/face/screens.ts` | State → LCD strings: DSEG14 top line, DSEG7 main digits, two-line dot-matrix strip. |
| `src/face/strip.ts`, `DotMatrix.tsx`, `glcdfont.ts` | 16×2 strip with the Adafruit 5×7 glcdfont (BSD, `glcdfont-LICENSE.txt`). |
| `src/face/wordmark.ts` | SEKUND wordmark path. |
| `src/styles/tokens.css` | DESIGN.md tokens and watch tokens: every color, font, spacing, radius and motion value. |
| `public/fonts/` | Self-hosted Archivo, IBM Plex Mono and DSEG7/DSEG14 Classic, each with its license file. |
| `src/testing/` | Message builder and request fixtures for tests. |
