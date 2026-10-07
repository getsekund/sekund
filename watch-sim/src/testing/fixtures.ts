import {
  encodeFrame,
  PROTOCOL_VERSION,
  randomBytes,
  RequestGuard,
  type Review,
  type SignTransactionRequest,
  toBase58,
  toBase64,
} from "@sekund/protocol";
import { buildSystemMessage } from "./messageBuilder";

export const OWN_KEY = new Uint8Array(32).fill(7);
export const OWN_ADDRESS = toBase58(OWN_KEY);
export const DEST_KEY = new Uint8Array(32).fill(9);
export const BLOCKHASH = new Uint8Array(32).fill(3);

export function transferBytes(from: Uint8Array = OWN_KEY, lamports = 10_000_000n, extra: Partial<Parameters<typeof buildSystemMessage>[0]> = {}): Uint8Array {
  return buildSystemMessage({ from, to: DEST_KEY, blockhash: BLOCKHASH, lamports, ...extra });
}

export function signRequest(bytes: Uint8Array, overrides: Partial<SignTransactionRequest> = {}): SignTransactionRequest {
  return {
    version: PROTOCOL_VERSION,
    type: "SIGN_TRANSACTION",
    requestId: crypto.randomUUID(),
    nonce: toBase64(randomBytes(16)),
    network: "devnet",
    message: toBase64(bytes),
    expiresInMs: 52_000,
    lastValidBlockHeight: 1,
    ...overrides,
  };
}

/** A Review exactly as the shared guard would hand it to the state machine. */
export function makeReview(now: number, opts: { expiresInMs?: number; bytes?: Uint8Array } = {}): Review {
  const guard = new RequestGuard({ now: () => now });
  const req = signRequest(opts.bytes ?? transferBytes(), opts.expiresInMs ? { expiresInMs: opts.expiresInMs } : {});
  const outcome = guard.check(encodeFrame(req), {
    sessionOpen: true,
    hasKey: true,
    busy: false,
    address: OWN_ADDRESS,
    maxMessageBytes: 4096,
  });
  if (outcome.kind !== "review") throw new Error(`fixture refused: ${JSON.stringify(outcome)}`);
  return outcome.review;
}
