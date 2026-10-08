# SEKUND threat model (proof of concept)

Scope: the hackathon software proof of concept on Solana devnet. Based on spec v1.1 section 10, stating what the PoC actually does. Architecture: [ARCHITECTURE.md](ARCHITECTURE.md).

## Ground truth

- **The secure element is simulated.** It is a Web Worker holding a non-extractable WebCrypto Ed25519 key in IndexedDB. It shows the interface, limits and rules of the hardware SE. It does not resist an attacker who controls the browser, the OS or the machine. The PoC makes no hardware-security claim and is not for real funds.
- **The relay is untrusted.** It stands in for BLE and is treated like a hostile radio link: it can drop, delay, replay, reorder or inject frames. Rooms isolate demos (one companion and one watch each) but are not authentication. It binds to `127.0.0.1` and accepts only the two app origins, but security does not depend on that.
- **Approval is enforced in the watch state machine** (`watch-sim/`), helped by two SE checks: an open PIN session and a single-use approve token bound to the exact message bytes. The companion cannot approve. The SE does not know what was displayed, which is why the display path is security-critical code. Until `watch-sim/` is merged and wired to `se-sim`, the same enforcement runs in the headless test watch (`companion/src/testing/headless-watch.ts`), where APPROVE is scripted.

## Threats

| Threat | Protection in the PoC | Where | Status |
|---|---|---|---|
| Relay or companion injects a request | Watch shows every request and signs only after a physical APPROVE inside a PIN session | watch-sim, `se-sim/src/chip.ts` | Built |
| Replay of an old request | `requestId` and `nonce` single-use, remembered even for refused requests | `protocol/src/guard.ts` | Built, tested |
| Same request, new bytes | Refused as `REPLAYED`; a retry needs a new `requestId` and a new review | `guard.ts` | Built, tested |
| Bytes changed after review | Approve token bound to a copy of the reviewed bytes; any other bytes give `BAD_TOKEN` | `chip.ts` | Built, tested |
| Watch returns a signature over other bytes | Companion verifies against the bytes it sent and the fee payer, and refuses to broadcast | `companion/src/lib/solana.ts` | Built, tested |
| Approval reused | Token spent by any signing attempt; revoked on session end | `chip.ts` | Built, tested |
| Hidden destinations via lookup tables | All versioned messages refused (`UNSUPPORTED`) | `protocol/src/parser.ts` | Built, tested |
| Anything but a plain transfer | Allowlist: legacy, one System transfer from the watch address, three accounts | `parser.ts` | Built, tested |
| Oversize message | Refused above `maxMessageBytes` before display, in the SE driver and in the chip; never truncated | `guard.ts`, `driver.ts`, `chip.ts` | Built, tested |
| Blockhash expires during review | Blockhash fetched last; countdown; auto `EXPIRED`; nonce messages refused | companion, watch-sim, `parser.ts` | Built, tested |
| PIN brute force | Counter written before each check and persisted; third failure wipes key and PIN | `chip.ts` | Built, tested |
| Unlocked watch left unattended | Wrist-off ends the session and revokes tokens (a toggle in the PoC) | watch-sim, `chip.ts` | Built (toggle) |
| Key extraction through the SE interface | No export command; key created non-extractable; test-key import disabled in the Worker | `chip.ts`, `worker.ts` | Built, tested |
| Key extraction from the browser | **Not protected.** Same-profile scripts, extensions or a compromised machine can use the key | None | Accepted for the PoC |
| Malicious watch code (fake display, auto-approve) | **Not protected.** Hardware needs signed firmware and secure boot | None | Roadmap |
| Eavesdropping on the link | Frames contain no secrets (no key, PIN or token); devnet only | `protocol/` | Accepted |
| BLE MITM | Not applicable to the relay. Hardware: LE Secure Connections with Numeric Comparison | None | Roadmap |
| PIN or commands sniffed on the MCU-to-SE bus | Not applicable in the PoC. Hardware: SCP03 (SE050E) or the TROPIC01 secure channel | None | Roadmap |
| Debug-port attack | Not applicable in the PoC. Hardware: debug lock | None | Roadmap |
| Lost or broken watch | No recovery: the key cannot be exported. Recovery design (spec 5.1) is needed before mainnet | None | Open decision |

## Residual risks to state in the demo

1. The secure element is simulated in software.
2. The PoC protects against a hostile companion and a hostile link, not against a hostile browser or machine.
3. Devnet only, no recovery, no mainnet claims.
