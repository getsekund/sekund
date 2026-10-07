# Solana signing in SEKUND

How a devnet transfer gets from the companion to a signature and onto the chain, and where each of the four signing fixes from spec v1.1 section 5 lives in code. The wire format is in [PROTOCOL.md](PROTOCOL.md).

**The secure element in this proof of concept is simulated in software.** It runs in a Web Worker with a non-extractable WebCrypto Ed25519 key. No claim of hardware security is made.

## Path

| Step | Where | What happens |
|---|---|---|
| 1 | `companion/src/lib/solana.ts` `fetchLifetime` | `getLatestBlockhash` with `confirmed` commitment, immediately before building |
| 2 | `buildTransfer` | `@solana/kit` builds a **legacy** message with one System Program transfer from the watch address; `compileTransaction` gives the exact message bytes (150 bytes) |
| 3 | `companion/src/lib/sekund-client.ts` | `SIGN_TRANSACTION` with new `requestId`, 16-byte `nonce`, base64 message, `expiresInMs` |
| 4 | `protocol/src/guard.ts` `RequestGuard` | Watch side: replay, expiry, session, busy, size (`maxMessageBytes`) and allowlist checks, before anything is displayed |
| 5 | `protocol/src/parser.ts` | Destination, amount and fee payer decoded from those same bytes for the review screen |
| 6 | Watch state machine (`watch-sim/`) | Countdown; on physical APPROVE: `issueApproveToken(slot, bytes)` then `eddsaSign(slot, bytes, token)` |
| 7 | `se-sim/src/driver.ts` → `se-sim/src/chip.ts` | Driver checks length, chip checks session and token, signs **pure Ed25519 over the unhashed bytes**, driver converts byte order |
| 8 | `companion/src/lib/solana.ts` `verifyAndAssemble` | `verifySignature` against the exact bytes sent and the fee-payer address; refuses to broadcast if it fails; places the signature in `signatures[0]` |
| 9 | `broadcastAndConfirm` | `sendTransaction` with `preflightCommitment: "confirmed"`; polls `getSignatureStatuses` until confirmed or `getBlockHeight` passes `lastValidBlockHeight` |

Invariant: the bytes signed are the bytes parsed and displayed. The approve token is bound to those bytes inside the SE, so a substituted payload fails with `BAD_TOKEN`, and the companion independently verifies the signature against what it sent.

## The four fixes

### 1. Pure Ed25519, no pre-hash

`SecureElement.eddsaSign(slot, message, token)` has no hash parameter. The chip calls `crypto.subtle.sign({ name: "Ed25519" }, key, message)` on the raw bytes (RFC 8032 §5.1 hashes internally). A test checks that the signature does not verify over a SHA-512 pre-hash of the message.

### 2. Message size

| Profile | `maxMessageBytes` | Source |
|---|---|---|
| TROPIC01 (default) | 4,096 | `EDDSA_Sign`, datasheet §7.7.5 |
| SE050E | 919 | `EdDSASign` in a UserID session, AN12543 §4.10.1.2 |

The limit is enforced three times: by the watch's `RequestGuard` before parsing or display (`TOO_LARGE`), by `seDriver` before any command reaches the chip, and by the chip itself. Nothing is ever truncated. Lookup tables are not a size fix: v0 messages are refused because table entries hide destinations from review.

### 3. Byte order

All conversion lives in `seDriver` (`se-sim/src/driver.ts`). The simulated chip emits its profile's native order:

- **TROPIC01:** RFC 8032 little-endian, passed through unchanged.
- **SE050E:** big-endian. The driver reverses the 32-byte public key, and reverses R and S **separately** (not the 64 bytes as one block).

The RFC 8032 §7.1 vectors (TEST 1, 2, 3, 1024 and SHA(abc)), extracted verbatim from the RFC into `se-sim/test/fixtures/rfc8032-7.1.json`, must match byte for byte on both profiles. TEST 1024 (1,023 bytes) must be refused on SE050E. A wire-level test checks that the SE050E chip emits the TEST 3 public key as `25809048…8ecd51fc`, the order shown in NXP's AN12543 §7 example.

Assumption to verify on silicon (M1): for SE050E `WriteECKey` test-key import, the 32-byte private key is also passed big-endian, as NXP's Plug & Trust middleware does.

### 4. Blockhash expiry

- The companion fetches the blockhash last and sends `expiresInMs = 60000 − (now − fetchedAt) − 8000`.
- The watch starts its own countdown on arrival and answers `EXPIRED` with no signature at zero; APPROVE is disabled after that.
- A retry is a new request: new blockhash, new message bytes, new `requestId`, new review. The guard refuses any reused `requestId` or `nonce` with `REPLAYED`.
- Durable-nonce messages (first instruction `AdvanceNonceAccount`) are refused with `UNSUPPORTED`.

## Approve tokens and the PIN session

- `verifyPin` opens a session. The failure counter is written **before** each check and persists in IndexedDB, so reloading cannot reset it. The third wrong PIN erases the key and PIN.
- `endSession` (wrist-off) closes the session and revokes all outstanding tokens.
- `issueApproveToken` requires an open session and returns a random one-time token bound to the slot and a copy of the exact bytes, valid 5 seconds. Any signing attempt spends it.
- Test-vector key import exists only behind `allowTestKeyImport`, which the browser Worker never sets.

## Solana SDK

`@solana/kit` **8.4.0** and `@solana-program/system` **0.15.0**, pinned exactly in `companion/package.json`. The companion is hard-wired to `https://api.devnet.solana.com`; there is no mainnet option.

## Verification

```bash
pnpm test           # spec 11.1 tests, RFC 8032 vectors on both profiles
pnpm devnet:proof   # real devnet transfer signed by the simulated SE, verified and broadcast
```
