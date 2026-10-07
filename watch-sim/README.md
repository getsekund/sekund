# SEKUND watch simulator

The SEKUND face in the browser: a resin digital watch with four side buttons, a segment clock and a dot-matrix review strip, plus the watch state machine from spec v1.1 §6, §7 and §11.1. Solana devnet only. The secure element is simulated in software; the hardware is the roadmap.

It speaks the real protocol (`docs/PROTOCOL.md`): frames arrive over the local relay, pass the shared `RequestGuard` from `@sekund/protocol`, and are signed by the simulated SE from `@sekund/se-sim` running in a Web Worker with IndexedDB.

## Run

From the repo root:

```bash
pnpm install
pnpm relay        # ws://127.0.0.1:4319, stands in for Bluetooth
pnpm dev:watch    # http://127.0.0.1:4318
pnpm dev:companion  # http://127.0.0.1:4317, sends sign requests
```

```bash
pnpm --filter @sekund/watch-sim test       # state machine, gestures, controller against the in-process SE
pnpm --filter @sekund/watch-sim typecheck
pnpm --filter @sekund/watch-sim build
```

WebCrypto Ed25519 is required (Chrome 137+, Firefox, Safari).

## First run

The SE starts in factory state. Press A+D on the watch, choose a 4-digit PIN, then enter it again to confirm. The SE sets the PIN and generates the devnet key inside the chip; the address appears under Menu → Address and in the side panel. The key persists in this browser's IndexedDB. After that, A+D asks for the PIN.

## Controls

Buttons sit A (upper left), B (upper right), C (lower left), D (lower right). Click them, or press the keys `A` `B` `C` `D`; hold two keys together for a combination. Shift-click latches a button so a mouse can make combinations; on touch screens, press two buttons with two fingers. `W` toggles the wrist.

| Screen | Buttons |
|---|---|
| Normal | A light, B 12/24 h, **A+D (hidden) enters Secure Mode** |
| PIN | A/B digit down/up, C+D confirm digit, C previous digit or leave |
| Menu | A/B move, D select, C lock and leave |
| Review | A/B previous/next field, D approve (last field only), C reject |
| Result | any button continues |

## States

Normal → hidden combination → PIN → Menu (Address, Sign request, Lock) → Review (amount, destination, network, sender, approve; countdown on the segment display) → Approve or Reject → result. Expired, Locked (key wiped) and off-wrist are handled from any state:

- Requests are answered `LOCKED` unless a PIN session is open.
- A request expires at zero: the watch answers `EXPIRED` and never signs.
- Off-wrist ends the SE session at once and answers anything under review `LOCKED`.
- Three wrong PINs wipe the key; the next A+D starts first-run setup again.
- Oversize (`TOO_LARGE`), non-transfer, durable-nonce, versioned, foreign-wallet and replayed requests are refused by the guard before display.
- Approve issues an SE approve token bound to the exact message bytes, then signs those bytes with Ed25519 (no pre-hash).

## Layout

| Path | What |
|---|---|
| `src/machine/machine.ts` | Pure state machine: `transition(state, event) → { state, effects }`. Security-critical. |
| `src/machine/controller.ts` | Runs the guard on incoming frames and the effects against the SE and transport. |
| `src/machine/gestures.ts` | Press/release → button combinations. |
| `src/services.ts` | Relay transport (role `watch`) and the browser SE. |
| `src/face/` | SVG watch, 5×8 dot-matrix font, 7-segment digits, screen renderer. |
| `src/styles/tokens.css` | Every color, font, spacing, radius and motion value. Re-skin here. |
| `src/testing/` | Message builder and request fixtures for tests. |
