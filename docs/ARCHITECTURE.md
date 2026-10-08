# SEKUND architecture (proof of concept)

This describes what is built for the hackathon, mapped to spec v1.1 sections 3 and 11. **The secure element is simulated in software.** The hardware design (nRF52840 plus TROPIC01 or SE050E) is the roadmap; see the spec.

## Components

```
 Companion (localhost:4317)          Relay (127.0.0.1:4319)          Watch simulator (localhost:4318)
 ┌──────────────────────────┐        ┌──────────────────┐        ┌─────────────────────────────────┐
 │ build legacy transfer     │  JSON  │ forwards frames  │  JSON  │ watch state machine + UI        │
 │ verify signature          │◀──────▶│ verbatim between │◀──────▶│ RequestGuard (protocol/)        │
 │ assemble, broadcast       │  text  │ the two roles    │  text  │   │ issueApproveToken / eddsaSign│
 └────────────┬─────────────┘        └──────────────────┘        │   ▼                             │
              │ HTTPS JSON-RPC                                     │ seDriver ─▶ Web Worker (se-sim) │
              ▼                                                    │            non-extractable key  │
        Solana devnet                                              │            in IndexedDB         │
                                                                   └─────────────────────────────────┘
```

| Spec role (section 3) | Hardware (roadmap) | Proof of concept | Code |
|---|---|---|---|
| Companion | Chromium + Web Bluetooth, or Electron | Web app, React | `companion/` |
| BLE link | GATT, LE Secure Connections, Numeric Comparison | Local WebSocket relay | `protocol/src/relay/`, `protocol/src/transport/` |
| MCU firmware: UI, state machine, parser | nRF52840, Zephyr | Watch simulator page | `watch-sim/`, with `protocol/src/guard.ts` and `parser.ts` |
| SE driver wrapper | `se_driver` in firmware | `seDriver` | `se-sim/src/driver.ts` |
| Secure element | TROPIC01 (recommended) or SE050E | Web Worker with a WebCrypto Ed25519 key | `se-sim/src/chip.ts`, `worker.ts` |

The local relay uses exclusive rooms (default `sekund-demo`): one companion and one watch per room. A second peer of the same role is rejected. Replay tombstones persist in watch-origin IndexedDB across reloads.

## Trust boundary (spec 3.1, as built)

- **The SE protects the key.** In the PoC the key is a non-extractable `CryptoKey` created inside the Worker and stored in IndexedDB as an opaque handle. The page talks to the Worker only through the `SecureElement` command set. This is a code boundary, not a hardware one: anything running in the same browser profile could in principle reach the same IndexedDB and Worker.
- **The watch enforces approval and display.** The SE signs whatever bytes it gets with a valid approve token. Showing the user the right fields, and asking for a token only after a physical APPROVE, is the watch state machine's job. It is security-critical code.
- **The SE adds two checks the firmware cannot skip:** signing needs an open PIN session, and the approve token is single-use, valid for 5 seconds and bound to the exact bytes.
- **The companion is not trusted** with keys or approval. It is trusted only to build what the user asked for, and the watch shows the user what it actually built.

## Request lifecycle

1. The companion fetches the blockhash (`confirmed`), builds a 150-byte legacy transfer with `@solana/kit` 8.4.0 and sends `SIGN_TRANSACTION` immediately.
2. The watch runs `RequestGuard`: version, replay (`requestId` and `nonce`), expiry, PIN session, busy, size against `maxMessageBytes`, then the allowlist parser. Only then is anything displayed.
3. The watch shows amount, destination, network and the countdown, decoded from the bytes it holds.
4. APPROVE asks the SE for a token bound to those bytes, then `eddsaSign`. REJECT, the countdown reaching zero, or wrist-off answer with no signature.
5. The companion verifies the signature against the bytes it sent and the fee-payer address, assembles, broadcasts and polls until confirmed or past `lastValidBlockHeight`.

Details: [PROTOCOL.md](PROTOCOL.md) (wire format), [SOLANA_SIGNING.md](SOLANA_SIGNING.md) (signing fixes), [THREAT_MODEL.md](THREAT_MODEL.md).

## Profiles

| Profile | Max message | Wire byte order | Use |
|---|---|---|---|
| TROPIC01 | 4,096 bytes | RFC 8032 little-endian | Default in the PoC |
| SE050E | 919 bytes (PIN session) | Big-endian public key, R and S reversed separately | Tests, fallback hardware |

## Not built (spec 15)

Firmware, BLE, hardware, durable nonces, v0/v1 parsing, lookup tables, multiple accounts, recovery, mainnet.
