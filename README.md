# SEKUND

Verify and sign Solana on-wrist. SEKUND is a simple resin digital watch that parses the Solana message it is asked to sign, shows the amount and destination from those exact bytes, and signs only after an approve on the watch. The key never reaches the companion; the hardware target keeps it inside the secure element.

This repository is the software proof of concept for the Colosseum Crypto World's Fair hackathon, on **Solana devnet only**: a watch simulator in the browser, a simulated secure element and a companion app. The simulator's signature was accepted on devnet (see [Devnet proof](#devnet-proof)). The case, the buttons, Bluetooth LE and the TROPIC01 are the roadmap, not in this build.

> **The secure element in this proof of concept is simulated in software.** It runs in a Web Worker and holds a non-extractable WebCrypto Ed25519 key in IndexedDB. Real hardware (nRF52840 with a TROPIC01 or SE050E secure element) is the post-hackathon roadmap. Nothing here claims hardware security or mainnet readiness, and nothing here claims to be the first wearable or Solana-native signer: wearable signers exist. What this build shows is the exact-byte review, the approve-gated signing and the devnet acceptance.

## What works

- A companion app builds a devnet SOL transfer right after fetching the blockhash and sends the exact message bytes to the watch over a local link that stands in for Bluetooth.
- The watch side refuses replays, expired requests, oversize messages (before display), durable-nonce messages, lookup-table (v0) messages and anything other than one System Program transfer from its own address.
- The simulated secure element signs pure Ed25519 over the unhashed bytes, only inside a PIN session and only with a one-time approve token bound to those bytes. Three wrong PINs wipe the key.
- Two secure-element profiles mirror the hardware candidates: TROPIC01 (4,096-byte limit, little-endian) and SE050E (919-byte limit, big-endian on the wire, converted by one `seDriver` wrapper).
- The companion verifies every signature against the message and the address, assembles the transaction, broadcasts it to devnet and links to the explorer. `EXPIRED` leads to a new request with a new blockhash.

## Layout

| Path | What it is |
|---|---|
| `protocol/` | Request envelope, `SecureElement` interface, message parser and allowlist, request guard, local relay transport |
| `se-sim/` | Simulated secure element: Web Worker, IndexedDB key store, TROPIC01/SE050E profiles, `seDriver` |
| `companion/` | Devnet companion app (Vite, React, TypeScript, Tailwind, shadcn/ui), port 4317. Styles come from one tokens file, `companion/src/styles/tokens.css` (SEKUND design system) |
| `watch-sim/` | Watch simulator, port 4318 (built in parallel) |
| `deck/` | Pitch deck for the Colosseum Crypto World's Fair as a web app, port 4320. One-bit Bayer-dithered look, presenter notes, PDF export. See [Pitch deck](#pitch-deck) |
| `video/` | The 2:00 pitch video, rendered with Remotion from the deck's own slides and real simulator captures. See [Pitch video](#pitch-video) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Components, trust boundary and request lifecycle as built |
| [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) | Threats, where each is handled, and what the PoC does not protect |
| `docs/PROTOCOL.md` | Wire contract and transport |
| `docs/SOLANA_SIGNING.md` | Signing path and the four signing fixes |

## Requirements

- Node.js 22.12 or newer, pnpm 10 (`corepack enable`)
- A browser with WebCrypto Ed25519: Chrome or Edge 137+, Firefox, or Safari

## Run

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts three processes in parallel with prefixed output; Ctrl+C stops all of them:

| Process | URL |
|---|---|
| Local link (relay standing in for BLE) | `ws://127.0.0.1:4319` |
| Companion | http://localhost:4317 |
| Watch simulator | http://localhost:4318 |

Open both apps in separate windows (same `?room=` value; default `sekund-demo`). Unlock the watch with its PIN, then send a transfer from the companion and approve it on the watch. A second watch tab shows WATCH ALREADY OPEN and does not connect.

To run them separately: `pnpm relay`, `pnpm dev:companion`, `pnpm dev:watch`.

Without the watch simulator, a terminal stand-in can answer the companion over the same link (ephemeral key, for development only):

```bash
pnpm --filter @sekund/companion watch:headless
```

### Devnet SOL

The companion's **Airdrop devnet SOL** button asks the public faucet for 1 SOL, then 0.1 SOL. The faucet is often rate-limited; the app then tells you to copy the address, request SOL at [faucet.solana.com](https://faucet.solana.com) (choose Devnet), and press **Refresh**.

## Tests

```bash
pnpm test        # Vitest across all packages
pnpm typecheck
```

The suite covers every item in spec section 11.1:

| Requirement | Test file |
|---|---|
| Signature verifies against the message and address | `companion/test/signing-path.test.ts`, `se-sim/test/secure-element.test.ts` |
| Reject produces no signature | `companion/test/signing-path.test.ts` |
| Replayed request refused | `companion/test/signing-path.test.ts`, `protocol/test/guard.test.ts` |
| Payload altered after display refused | `se-sim/test/secure-element.test.ts`, `companion/test/signing-path.test.ts` |
| Three wrong PINs wipe the key | `se-sim/test/secure-element.test.ts`, `companion/test/signing-path.test.ts` |
| Oversize message refused before display | `protocol/test/guard.test.ts`, `companion/test/signing-path.test.ts` |
| Expired request produces no signature; retry is a new request | `companion/test/signing-path.test.ts` |
| RFC 8032 §7.1 vectors byte-exact on both profiles | `se-sim/test/rfc8032.test.ts` |
| Nonce and lookup-table messages refused | `protocol/test/parser.test.ts`, `companion/test/signing-path.test.ts` |

### End-to-end (Playwright)

```bash
pnpm --filter @sekund/companion e2e:install   # once: Chromium for Playwright
pnpm e2e
```

`pnpm e2e` starts the relay, the companion and (when present) the watch simulator, or reuses them if they are already running. Stop any `watch:headless` first: the relay forwards to every watch. Devnet RPC is mocked inside the page, and each test checks the broadcast transaction itself: one signer (the watch address), and pure Ed25519 over the exact message bytes, verified with WebCrypto.

| Spec | What drives the watch | Covers | Status |
|---|---|---|---|
| `companion/e2e/companion.spec.ts` | Headless watch over the real relay (same `RequestGuard` and simulated SE, buttons scripted) | Not connected, waiting with countdown, approve with verified signature and explorer link, reject, expire and send again, devnet error | Passing |
| `companion/e2e/watch-sim.spec.ts` | The watch simulator page: Secure Mode combination, NEW/REPEAT PIN, review pages, APPROVE / REJECT with keys `a` `b` `c` `d` | Approve with verified signature, reject, expire | Passing |
| `companion/e2e/watch-3d.spec.ts` | The 3D watch (`?view=3d`): mouse clicks on the model's pushers | The WebGL canvas and LCD mount; 3D pushers change the PIN digit | Passing |

`watch-sim.spec.ts` runs on the 2D fallback (`?view=2d`); `SEKUND_E2E_VIEW=3d` runs the same path on the 3D watch. `?reviewSeconds=N` on the companion URL caps the review window at N seconds for the expiry tests. It can only shorten the window. `SEKUND_E2E_PIN` (default `1234`) and `SEKUND_E2E_COMBO` (default `a+d`) configure the watch-simulator spec.

## Devnet proof

```bash
pnpm devnet:proof
```

The script creates a simulated SE (TROPIC01 profile), generates the key inside it, funds the address, builds a transfer, runs the full protocol path (guard, review, scripted APPROVE, approve token, pure Ed25519), verifies the signature, broadcasts to devnet and prints the explorer link. In the demo, a person presses APPROVE on the watch simulator instead.

If the public faucet refuses, the script falls back to a devnet-only funder wallet at `companion/.devnet/funder.json` (gitignored, created on first run), or to a Solana CLI keypair given in `SEKUND_FUNDER_KEYPAIR`. Fund that address once at [faucet.solana.com](https://faucet.solana.com). The funder only pays for the test; it never signs the SEKUND transaction.

Recorded run, 7 October 2026, 23:11:10 UTC (devnet slot 508616269):

| Item | Value |
|---|---|
| Simulated SE address (fee payer, TROPIC01 profile) | `EB3hDgSXN5oEyiE2xErRSKsGk5egkpyq1HQ3N2KaQRkU` |
| Transfer | 0.01 SOL to `5awdRY3zVWWNZXmHH955bDxdUoZ7aFqjKKaCeCeBuAbg`, 150-byte legacy message |
| Transaction signature | `2G7xpmPKfpXRuhdXXbgNq22NHgHc7bEKsNJ7MaDFNANj8RshowqaKusAx8ACTmEwVMYj1CAuftaSePn9T5bSbwnU` |
| Explorer | https://explorer.solana.com/tx/2G7xpmPKfpXRuhdXXbgNq22NHgHc7bEKsNJ7MaDFNANj8RshowqaKusAx8ACTmEwVMYj1CAuftaSePn9T5bSbwnU?cluster=devnet |

The companion verified the signature before broadcast. Re-checked afterwards from the chain: the transaction succeeded, its only signer is the simulated SE address, and the Ed25519 signature verifies over the on-chain message bytes. The SE address was funded beforehand by the funder wallet (transaction `446Ko2zsMkjjcP8yGbpgSXoXdYdvbmZ9FK6bE5yELgLqQpBe1fSqqiz18qzJaMraL3x7Ue8PYRdKK5rnHQs1FSnU`), which did not sign the SEKUND transfer.

## Pitch deck

The deck in `deck/` is a Vite + React app, not a slide file, so it can show the real product: captures from the 3D watch simulator, the confirmed devnet transaction, diagrams drawn in SVG, and the brand's ordered-dither look drawn live on canvas (own Bayer 8×8 code, no third-party kit).

```bash
pnpm dev:deck     # http://127.0.0.1:4320
```

| URL | View |
|---|---|
| `/#claim`, `/#proof`, … or `/#3` | The show. One slide per screen, scaled to the window, letterboxed. The hash is the slide. |
| `/?notes` | Presenter view: current slide, next slide, Serbian speaker notes, clock and elapsed time. Open it in a second window; both windows follow the same slide over a `BroadcastChannel`. |
| `/?print` | Every slide at full size, one under the other. |
| `/?sheet` | Contact sheet of the whole deck. |
| `/?logos`, `/?illustrations`, `/?hero`, `/?palette` | Brand option sheets: the wordmark directions with the chosen Inter SemiBold, the four watch illustrations, the live illustration fully dithered next to the crisp-LCD treatment, and the three white-and-blue dither palettes, with the live one marked on each. |

Keys: `→` `←` `Space` `PageDown` `PageUp` `Home` `End`, `1`–`9` and `0` jump to a slide; click the right part of the screen for next, the left edge for back. Each slide's pieces rise in over half a second when it becomes current; motion stops under `prefers-reduced-motion` and in print.

### PDF

Cmd+P (Ctrl+P) from any view prints the whole deck, one 16:9 page per slide, backgrounds included; pick "Save as PDF", no margins, and keep "Background graphics" on. The page size comes from the stylesheet (`@page { size: 1920px 1080px }`).

The same result without a dialog, plus a PNG of every slide, the contact sheet and the option sheets:

```bash
pnpm dev:deck                                  # leave running
pnpm deck:export                               # writes deck/out/
OUT=/somewhere pnpm deck:export                # elsewhere
```

The export uses the Playwright Chromium when it is installed (`pnpm --filter @sekund/companion e2e:install`), otherwise a system Google Chrome.

```bash
pnpm --filter @sekund/deck test       # hash routing, Bayer matrix
pnpm --filter @sekund/deck typecheck
pnpm --filter @sekund/deck lint       # oxlint
```

Slide copy lives in `deck/src/deck/slides.tsx`; the on-chain facts shown on the proof slide are in `deck/src/deck/facts.ts`. The captures under `deck/public/assets/` were taken from the running watch simulator (`?view=3d`, dark theme) and the Solana Explorer page of the proof transaction; `watch-target-render.png` is a generated render of the target design with the real simulator LCD composited in, and the slide says so. The wordmark and the hero watch illustration are picked in `deck/src/brand/` (`WORDMARK`, `ILLUSTRATION`), the dither colours in `deck/src/dither/palette.ts` (`DITHER_PALETTE`); the alternatives stay next to each, so swapping is one assignment. See `deck/README.md`.

## Pitch video

`video/` renders the pitch video (1:59.5) with [Remotion](https://www.remotion.dev), drawing every frame with the deck's own components, so the video matches the deck. The timed voice-over script is `video/src/script.ts`. The captions cut is silent with the script burned in; Goran reads along with it, and `pnpm video:vo` lines his take up with the script and renders the voiced cut.

```bash
pnpm dev:video                  # Remotion Studio, http://localhost:4321
pnpm video:render               # video/out/*.mp4 and the poster frame
pnpm video:vo --dir <folder>    # <folder>/vo.<any audio> -> <folder>/sekund-pitch-2min-vo.mp4
pnpm video:capture              # with pnpm dev running: re-take the captures on devnet
```

See `video/README.md`.

## Solana SDK

| Package | Version |
|---|---|
| `@solana/kit` | 8.4.0 |
| `@solana-program/system` | 0.15.0 |

Pinned exactly in `companion/package.json`. Network: Solana devnet (`https://api.devnet.solana.com`) only.

## Security rules

1. Private keys never leave the simulated secure element on the honest path. The PoC SE cannot stop same-origin page code from using the stored non-extractable `CryptoKey` handle: non-extractable prevents export, not use.
2. No wallet private key is stored in plaintext; the simulated SE stores a non-extractable `CryptoKey` handle in IndexedDB.
3. No private keys or sensitive cryptographic material are logged.
4. On the honest watch path, nothing is signed without the approve action on the watch (a button in the simulator, a physical button on hardware) inside a PIN session, before expiry. A compromised watch UI or same-origin script can still call the simulated SE while a session is open.
5. Pure Ed25519 over the exact, unhashed message bytes that were displayed.
6. Messages longer than `maxMessageBytes` are rejected before display.
7. All secure-element byte-order conversion happens in the `seDriver` wrapper only.
8. Requests are single-use and replay-protected, including across reloads via IndexedDB tombstones.
9. No hand-written cryptographic primitives: WebCrypto only.
10. Approval and display logic is security-critical; changes need review and tests.
11. The local relay is untrusted and uses exclusive rooms (`?room=`, default `sekund-demo`): one companion and one watch per room.

## Disclosure

- All work in this repository started on or after 5 October 2026, inside the hackathon window. There is no prior work.
- Team: Goran (product and engineering) and Srki; each member's role is stated in the Colosseum submission. The code was written with AI coding agents (Cursor) working under the team's direction.
- Third-party code is used only as declared dependencies (`@solana/kit`, `@solana-program/system`, `@scure/base`, `ws`, React, Vite, Tailwind CSS, shadcn/ui components, Phosphor Icons, Playwright; Remotion for the pitch video only). The Ed25519 test vectors are copied from RFC 8032 §7.1.
- Fonts: Archivo (Omnibus-Type) and IBM Plex Mono (IBM), SIL Open Font License 1.1, self-hosted in `companion/public/fonts/` with their license files.

## License

The code in this repository is licensed under the Apache License, Version 2.0 ([`LICENSE`](LICENSE)). Every workspace package declares `"license": "Apache-2.0"`.

Third-party assets keep their own licences and are not relicensed:

| Asset | Licence | Where |
|---|---|---|
| Archivo (Omnibus-Type), IBM Plex Mono (IBM) | SIL Open Font License 1.1 | `*/public/fonts/*-OFL.txt` |
| DSEG7 and DSEG14 (keshikan) | SIL Open Font License 1.1 | `deck/public/fonts/DSEG-LICENSE.txt`, `watch-sim/public/fonts/DSEG-LICENSE.txt` |
| Inter (`@fontsource/inter`) | SIL Open Font License 1.1 | npm package, used by the deck |
| Adafruit GFX `glcdfont` 5×7 glyphs | BSD | `deck/src/ui/glcdfont-LICENSE.txt`, `watch-sim/src/face/glcdfont-LICENSE.txt` |
| Remotion (pitch video only) | Remotion License: free for individuals and companies of up to three people | `node_modules/remotion/LICENSE.md` |
| Dependencies (`@solana/kit`, React, Vite, Playwright, …) | Their own | `node_modules/*/LICENSE` |

The watch illustrations and the target render under `deck/public/assets/` are generated pictures of a watch that does not exist yet; the captures there were taken from the running simulator and from the Solana Explorer page of the proof transaction.
