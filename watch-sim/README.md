# SEKUND watch simulator

The SEKUND face in the browser: a resin digital watch with four side buttons, a segment clock and a dot-matrix review strip, plus the watch state machine from spec v1.1 §6, §7 and §11.1. Solana devnet only. The secure element is simulated in software; the hardware is the roadmap.

## Run

```bash
cd watch-sim
npm install
npm run dev      # http://127.0.0.1:4318
npm test         # state machine, gestures, parser, controller
npm run build    # typecheck + production build
```

WebCrypto Ed25519 is required (Chrome 137+, Firefox, Safari).

## Controls

Buttons sit A (upper left), B (upper right), C (lower left), D (lower right). Click them, or press the keys `A` `B` `C` `D`; hold two keys together for a combination. Shift-click latches a button so a mouse can make combinations; on touch screens, press two buttons with two fingers. `W` toggles the wrist.

| Screen | Buttons |
|---|---|
| Normal | A light, B 12/24 h, **A+D (hidden) enters Secure Mode** |
| PIN | A/B digit down/up, C+D confirm digit, C previous digit or leave |
| Menu | A/B move, D select, C lock and leave |
| Review | A/B previous/next field, D approve (last field only), C reject |
| Result | any button continues |

The stub secure element's demo PIN is `1234`. Three wrong PINs wipe the key; the panel can create a new one.

## States

Normal → hidden combination → PIN → Menu (Address, Sign request, Lock) → Review (amount, destination, network, sender, approve; countdown on the segment display) → Approve or Reject → result. Expired, Locked (key wiped) and off-wrist are handled from any state:

- A request expires at zero: the watch answers `EXPIRED` and never signs.
- Off-wrist ends the session at once; the PIN is required again.
- Oversize (`TOO_LARGE`), non-transfer, durable-nonce, versioned, foreign-wallet and replayed requests are refused before display.

## Layout

| Path | What |
|---|---|
| `src/machine/machine.ts` | Pure state machine: `transition(state, event) → { state, effects }`. Security-critical. |
| `src/machine/controller.ts` | Runs effects against the secure element and transport. |
| `src/machine/gestures.ts` | Press/release → button combinations. |
| `src/adapters/` | Local stand-ins for `protocol/` and `se-sim/`: the `SecureElement` interface (spec §5.6), envelope (§8.1), transfer parser, stub SE, stub transport. |
| `src/face/` | SVG watch, 5×8 dot-matrix font, 7-segment digits, screen renderer. |
| `src/styles/tokens.css` | Every color, font, spacing, radius and motion value. Re-skin here. |

## Status

The adapters are a stub until `protocol/` and `se-sim/` land on main: the stub secure element runs in-page (not in a Worker), keeps the key in memory only, and the stub companion in the side panel builds the request and verifies the signature but does not broadcast.
