# SEKUND protocol v1

This is the wire contract between the companion app and the SEKUND watch (spec v1.1 sections 5.6, 8.1 and 9). In the proof of concept the watch is the watch simulator, the secure element (SE) is simulated in a Web Worker, and a local relay stands in for BLE. The same frames would travel over the BLE GATT characteristics on hardware.

Code: [`protocol/src/envelope.ts`](../protocol/src/envelope.ts) (types and decoders), [`protocol/src/secure-element.ts`](../protocol/src/secure-element.ts) (SE interface), [`protocol/src/transport/`](../protocol/src/transport/) (transport clients), [`protocol/src/relay/server.ts`](../protocol/src/relay/server.ts) (relay).

## 1. Transport

**Decision: a tiny local WebSocket relay.** The companion runs on `http://localhost:4317` and the watch simulator on `http://localhost:4318`. Different ports are different origins, so `BroadcastChannel` cannot connect them. A relay keeps the two apps independent, the way two BLE devices are, and survives page reloads.

| Item | Value |
|---|---|
| Relay | `pnpm relay` (Node, package `ws`), listens on `ws://127.0.0.1:4319` only |
| Connect | `ws://127.0.0.1:4319/?role=companion` or `?role=watch`; any other role is closed with code 1008 |
| Origins | Browser clients must come from `http://localhost:4317`, `http://127.0.0.1:4317`, `http://localhost:4318` or `http://127.0.0.1:4318`. Clients that send no `Origin` header (scripts, tests) are accepted. |
| Frames | UTF-8 JSON text, one protocol frame per WebSocket message, at most 16 KiB. Binary frames are ignored. |
| Routing | Every frame from a client goes, verbatim, to every connected client of the other role. The relay does not parse, store or log frame contents. |
| Presence | The relay itself sends `{"relay":1,"event":"peer","role":"watch","connected":true,"count":1}` to each client: once right after it connects (about the other role), then whenever a client of the other role connects or disconnects. Clients tell relay frames from protocol frames by the `relay` key. |
| Delivery | Best effort. A frame sent while the peer is absent is lost, like a BLE write without a connection. The companion times out and sends a new request. |

The relay is **untrusted**, exactly like the BLE link. Nothing in the security model depends on it: the watch validates every frame, the SE signs only after physical approval, and the companion verifies every signature before broadcast.

Client helper (browser and Node 22+):

```ts
import { createRelayTransport } from "@sekund/protocol";
const transport = createRelayTransport({ role: "watch" }); // reconnects every 1 s
transport.onFrame((text) => { /* decodeCompanionRequest(text) */ });
transport.onPeer((connected) => { /* companion present? */ });
transport.send(encodeFrame(result));
```

Tests use `createMemoryTransportPair()`.

## 2. Common rules

- Every frame has `"version": 1`. Any other version is refused with `INVALID`.
- `requestId` is a lowercase UUID v4 (`crypto.randomUUID()`). A frame whose `requestId` is missing or malformed is dropped without an answer.
- Bytes are encoded as standard base64 with padding (RFC 4648 §4) for the message and nonce, and base58 (Bitcoin alphabet) for addresses and signatures.
- Unknown fields are ignored. Field order is not significant.
- No frame ever carries a private key, a PIN or an approve token.

## 3. Companion → watch

### 3.1 `GET_ADDRESS`

```json
{ "version": 1, "type": "GET_ADDRESS", "requestId": "0b6f6a52-0d3e-4b0c-9f5e-2a1c7d8e9f01" }
```

### 3.2 `SIGN_TRANSACTION`

```json
{
  "version": 1,
  "type": "SIGN_TRANSACTION",
  "requestId": "3f2b8c1e-9a4d-4e7f-8b21-0c5d6e7f8a9b",
  "nonce": "q83vEjRWeJCrze8SNFZ4kA==",
  "network": "devnet",
  "message": "AQABA…",
  "expiresInMs": 52000,
  "lastValidBlockHeight": 312456789
}
```

| Field | Rule |
|---|---|
| `nonce` | base64 of exactly 16 random bytes, fresh per request |
| `network` | the string `devnet`; anything else is `INVALID` |
| `message` | base64 of the **serialized Solana message bytes**, not the transaction and not a hash |
| `expiresInMs` | integer, at most 60000. ≤ 0 is answered `EXPIRED`; > 60000 is `INVALID`. Computed by the companion as `60000 − (now − blockhashFetchedAt) − broadcastMarginMs` (default margin 8000), spec 5.5 |
| `lastValidBlockHeight` | non-negative integer from `getLatestBlockhash`; the watch passes it through and does not act on it |

## 4. Watch → companion

### 4.1 `GET_ADDRESS_RESULT`

```json
{ "version": 1, "type": "GET_ADDRESS_RESULT", "requestId": "0b6f…", "status": "OK",
  "address": "7xKX…base58…", "profile": "TROPIC01", "maxMessageBytes": 4096 }
```

`status` is `OK`, `LOCKED` (no open PIN session) or `NO_WALLET` (no key yet). `address`, `profile` and `maxMessageBytes` are present only with `OK`. The address is the base58 32-byte public key in RFC 8032 byte order.

### 4.2 `SIGN_TRANSACTION_RESULT`

```json
{ "version": 1, "type": "SIGN_TRANSACTION_RESULT", "requestId": "3f2b…", "status": "APPROVED",
  "signature": "5VER…base58 of 64 bytes…" }
```

`signature` is present **if and only if** `status` is `APPROVED`. `reason` (optional, ≤ 200 characters) explains other statuses for the UI.

| `status` | Meaning | Signature |
|---|---|---|
| `APPROVED` | The user pressed APPROVE in a live session before expiry; the SE signed the exact bytes | yes |
| `REJECTED` | The user pressed REJECT | no |
| `EXPIRED` | The countdown reached zero (or `expiresInMs` ≤ 0 on arrival) | no |
| `TOO_LARGE` | Decoded message longer than the SE's `maxMessageBytes`; refused before display, never truncated | no |
| `UNSUPPORTED` | Message outside the allowlist (section 6), for example versioned, nonce or other programs | no |
| `LOCKED` | No open PIN session or no wallet, or the session ended during review (wrist-off) | no |
| `REPLAYED` | `requestId` or `nonce` seen before | no |
| `BUSY` | Another request is already on the review screen | no |
| `INVALID` | Structurally bad frame (version, network, nonce, encoding, malformed message) | no |

### 4.3 `WATCH_STATUS` (optional, unsolicited)

```json
{ "version": 1, "type": "WATCH_STATUS", "wallet": true, "session": "OPEN", "reviewing": false }
```

The watch sends this when it connects, when its session opens or closes, and when a review starts or ends, so the companion can show "unlock the watch". It is a UI hint only.

## 5. Watch processing order

The watch state machine processes each `SIGN_TRANSACTION` in this order and stops at the first failure. `validateSignRequest()` in `protocol/` (added with the parser) implements steps 1–7 so the simulator and the tests share one implementation.

1. Decode the frame (`decodeCompanionRequest`). No usable `requestId` → drop. Otherwise structural errors → `INVALID`.
2. `requestId` or `nonce` already seen → `REPLAYED`. Then record both as seen, so even a refused request cannot be replayed.
3. `expiresInMs` ≤ 0 → `EXPIRED`.
4. No open PIN session or no key → `LOCKED`.
5. A review is already on screen → `BUSY`.
6. Base64-decode the message. Longer than `maxMessageBytes` (TROPIC01 4096, SE050E 919) → `TOO_LARGE`.
7. Parse the bytes against the allowlist (section 6) and check that the fee payer equals the watch address → `UNSUPPORTED` or `INVALID`.
8. Start the countdown at `receivedAt + expiresInMs` and show destination, amount (SOL), network and remaining seconds, all taken from the parsed bytes. Keep the same byte buffer unchanged.
9. Outcome:
   - **APPROVE** (physical button, session open, countdown > 0): `token = se.issueApproveToken(slot, bytes)`, then `sig = se.eddsaSign(slot, bytes, token)` on the same buffer, then answer `APPROVED` with `base58(sig)`.
   - **REJECT**: answer `REJECTED`.
   - **Countdown reaches 0**: leave the review screen, disable APPROVE, answer `EXPIRED`.
   - **Session ends** (wrist-off or lock): answer `LOCKED`.

A request is answered exactly once. Retrying after `EXPIRED` means a new blockhash, new message bytes, a new `requestId` and a new review; the watch never accepts "same request, new blockhash".

## 6. Message allowlist (MVP)

Only a **legacy** Solana message (first byte has the high bit clear) with exactly one System Program `Transfer`:

| Part | Required value |
|---|---|
| Header | `numRequiredSignatures = 1`, `numReadonlySignedAccounts = 0`, `numReadonlyUnsignedAccounts ≥ 1` |
| Account keys | 3 keys: `[fee payer = from, to, System Program 11111111111111111111111111111111]`, all distinct |
| Fee payer | account 0, equals the watch address |
| Instructions | exactly 1: program = System Program, accounts `[0 (from, signer, writable), to (writable)]`, data = 12 bytes: `u32 LE 2` (Transfer) then `u64 LE lamports`, lamports > 0 |
| Trailing bytes | none |

Refused with `UNSUPPORTED`: any versioned message (v0 with or without lookup tables, v1), a first instruction that is System `AdvanceNonceAccount` (durable nonce), any other program or instruction, more than one instruction. A typical transfer message is 150 bytes.

## 7. Secure element interface and approve tokens

`SecureElement` in `protocol/src/secure-element.ts` is spec 5.6 made async (the PoC SE is a Worker). All bytes it returns are RFC 8032 little-endian; the `seDriver` wrapper in `se-sim/` is the only place that converts profile wire order.

| Method | Rule |
|---|---|
| `setPin(pin)` | Factory state only; 4 digits; opens a session |
| `generateKey(slot)` | Session required; key generated inside the SE, non-extractable |
| `getPublicKey(slot)` | 32 bytes RFC 8032 |
| `verifyPin(pin)` | `OK` opens a session; `WRONG_PIN` with `attemptsRemaining`; the third failure returns `WIPED` and erases key and PIN. The counter persists across reloads. |
| `endSession()` | Closes the session and revokes outstanding approve tokens |
| `issueApproveToken(slot, message)` | Session required. Called only on a physical APPROVE. Returns a one-time token bound to the slot and the exact bytes, valid 5 s |
| `eddsaSign(slot, message, token)` | Session required, token fresh, unused and bound to these bytes, length ≤ `maxMessageBytes`. Pure Ed25519 over the unhashed bytes. Returns 64 bytes R‖S |

Errors are thrown as `SeError` with a `code` (`NO_SESSION`, `NO_KEY`, `TOO_LARGE`, `BAD_TOKEN`, …).

## 8. Companion obligations

1. Fetch `getLatestBlockhash` (`confirmed`) immediately before building the message, then send at once.
2. Accept a `SIGN_TRANSACTION_RESULT` only for the pending `requestId`, once.
3. On `APPROVED`, verify the signature against the exact message bytes that were sent and the fee-payer address. Refuse to broadcast if it does not verify.
4. Assemble the transaction with the signature in `signatures[0]`, broadcast with `preflightCommitment: "confirmed"`, and poll until confirmed or the block height passes `lastValidBlockHeight`.
5. On `EXPIRED`, build a new request (new blockhash, new `requestId`, new `nonce`).

## 9. Versioning

Breaking changes bump `version`. The watch refuses versions it does not know, so an old watch never misreads a new format.
