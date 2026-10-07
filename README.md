# SEKUND

A Solana hardware wallet inside a retro digital watch. This repository is the software proof of concept for the Colosseum Crypto World's Fair hackathon, on **Solana devnet only**.

The secure element in this proof of concept is **simulated in software**. Real hardware (nRF52840 plus a TROPIC01 or SE050E secure element) is the post-hackathon roadmap.

## Layout

| Path | What it is |
|---|---|
| `protocol/` | Request envelope, `SecureElement` interface, local transport (relay) |
| `se-sim/` | Simulated secure element (Web Worker) |
| `companion/` | Devnet companion app, port 4317 |
| `watch-sim/` | Watch simulator, port 4318 |
| `docs/PROTOCOL.md` | Wire contract between companion and watch |

## Run

```bash
pnpm install
pnpm relay      # local transport on ws://127.0.0.1:4319
pnpm test
```

## Disclosure

All work in this repository started on or after 5 October 2026, during the hackathon window.
