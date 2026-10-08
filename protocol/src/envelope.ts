import {
  MAX_EXPIRES_IN_MS,
  MAX_FRAME_BYTES,
  NETWORK,
  NONCE_BYTES,
  PROTOCOL_VERSION,
  SIGNATURE_BYTES,
} from "./constants.ts";
import { fromBase58, fromBase64 } from "./encoding.ts";
import { isIdentityId, isPeerIdentity, isRoomId, type PeerIdentity } from "./identity.ts";
import type { SeProfile } from "./secure-element.ts";

// ---------------------------------------------------------------------------
// Companion -> watch
// ---------------------------------------------------------------------------

export interface FrameIdentity extends PeerIdentity {}

export interface GetAddressRequest extends FrameIdentity {
  version: typeof PROTOCOL_VERSION;
  type: "GET_ADDRESS";
  requestId: string;
}

export interface SignTransactionRequest extends FrameIdentity {
  version: typeof PROTOCOL_VERSION;
  type: "SIGN_TRANSACTION";
  requestId: string;
  /** base64 of 16 random bytes. */
  nonce: string;
  network: typeof NETWORK;
  /** base64 of the serialized Solana message bytes (not the transaction). */
  message: string;
  /** Integer, 1..60000. Relative to the moment the watch receives the frame. */
  expiresInMs: number;
  /** Companion-side bookkeeping; the watch does not act on it. */
  lastValidBlockHeight: number;
}

/** Companion abandons a pending request (tombstone already recorded on first receipt). */
export interface CancelRequest extends FrameIdentity {
  version: typeof PROTOCOL_VERSION;
  type: "CANCEL_REQUEST";
  requestId: string;
}

export type CompanionRequest = GetAddressRequest | SignTransactionRequest | CancelRequest;

// ---------------------------------------------------------------------------
// Watch -> companion
// ---------------------------------------------------------------------------

export type AddressStatus = "OK" | "LOCKED" | "NO_WALLET";

export interface GetAddressResult extends FrameIdentity {
  version: typeof PROTOCOL_VERSION;
  type: "GET_ADDRESS_RESULT";
  requestId: string;
  status: AddressStatus;
  /** base58 Ed25519 public key, RFC 8032 byte order. Only when status is OK. */
  address?: string;
  profile?: SeProfile;
  maxMessageBytes?: number;
}

export const SIGN_STATUSES = [
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "TOO_LARGE",
  "UNSUPPORTED",
  "LOCKED",
  "REPLAYED",
  "BUSY",
  "INVALID",
] as const;

export type SignStatus = (typeof SIGN_STATUSES)[number];

export interface SignTransactionResult extends FrameIdentity {
  version: typeof PROTOCOL_VERSION;
  type: "SIGN_TRANSACTION_RESULT";
  requestId: string;
  status: SignStatus;
  /** base58 of the 64-byte Ed25519 signature R||S. Present if and only if status is APPROVED. */
  signature?: string;
  /** Short human-readable reason for non-APPROVED statuses. Never contains key material. */
  reason?: string;
}

export interface WatchStatus extends FrameIdentity {
  version: typeof PROTOCOL_VERSION;
  type: "WATCH_STATUS";
  wallet: boolean;
  session: "OPEN" | "CLOSED";
  reviewing: boolean;
}

export type WatchFrame = GetAddressResult | SignTransactionResult | WatchStatus;

export type SekundFrame = CompanionRequest | WatchFrame;

export function stampIdentity<T extends object>(frame: T, identity: PeerIdentity): T & PeerIdentity {
  return { ...frame, roomId: identity.roomId, deviceId: identity.deviceId, sessionId: identity.sessionId };
}

// ---------------------------------------------------------------------------
// Decoding. Every frame from the transport is untrusted input.
// ---------------------------------------------------------------------------

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isRequestId(value: unknown): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}

export type Decoded<T> =
  | { ok: true; value: T }
  | { ok: false; requestId: string | null; reason: string };

function fail<T>(requestId: string | null, reason: string): Decoded<T> {
  return { ok: false, requestId, reason };
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  if (typeof text !== "string" || text.length > MAX_FRAME_BYTES) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function readIdentity(obj: Record<string, unknown>): PeerIdentity | null {
  const identity = { roomId: obj.roomId, deviceId: obj.deviceId, sessionId: obj.sessionId };
  return isPeerIdentity(identity) ? identity : null;
}

/**
 * Decodes a frame received by the watch. The result is structurally valid; the watch
 * still applies replay, session, size and allowlist checks (see `guard.ts`).
 * `requestId` is null when the frame is too broken to answer, in which case it is dropped.
 */
export function decodeCompanionRequest(text: string): Decoded<CompanionRequest> {
  const obj = parseJsonObject(text);
  if (!obj) return fail(null, "frame is not a JSON object");
  const requestId = isRequestId(obj.requestId) ? obj.requestId : null;
  if (!requestId) return fail(null, "requestId must be a lowercase UUID v4");
  if (obj.version !== PROTOCOL_VERSION) return fail(requestId, "unsupported protocol version");
  const identity = readIdentity(obj);
  if (!identity) return fail(requestId, "roomId, deviceId and sessionId required");

  if (obj.type === "GET_ADDRESS") {
    return { ok: true, value: { version: PROTOCOL_VERSION, type: "GET_ADDRESS", requestId, ...identity } };
  }
  if (obj.type === "CANCEL_REQUEST") {
    return { ok: true, value: { version: PROTOCOL_VERSION, type: "CANCEL_REQUEST", requestId, ...identity } };
  }
  if (obj.type !== "SIGN_TRANSACTION") return fail(requestId, "unknown request type");

  if (typeof obj.nonce !== "string") return fail(requestId, "nonce missing");
  let nonceBytes: Uint8Array;
  try {
    nonceBytes = fromBase64(obj.nonce);
  } catch {
    return fail(requestId, "nonce is not base64");
  }
  if (nonceBytes.length !== NONCE_BYTES) return fail(requestId, `nonce must be ${NONCE_BYTES} bytes`);
  if (obj.network !== NETWORK) return fail(requestId, "network must be devnet");
  if (typeof obj.message !== "string" || obj.message.length === 0) return fail(requestId, "message missing");
  if (typeof obj.expiresInMs !== "number" || !Number.isSafeInteger(obj.expiresInMs)) {
    return fail(requestId, "expiresInMs must be an integer");
  }
  if (obj.expiresInMs > MAX_EXPIRES_IN_MS) return fail(requestId, `expiresInMs above ${MAX_EXPIRES_IN_MS}`);
  if (!isNonNegativeSafeInteger(obj.lastValidBlockHeight)) {
    return fail(requestId, "lastValidBlockHeight must be a non-negative integer");
  }

  return {
    ok: true,
    value: {
      version: PROTOCOL_VERSION,
      type: "SIGN_TRANSACTION",
      requestId,
      nonce: obj.nonce,
      network: NETWORK,
      message: obj.message,
      expiresInMs: obj.expiresInMs,
      lastValidBlockHeight: obj.lastValidBlockHeight,
      ...identity,
    },
  };
}

/** Decodes a frame received by the companion. */
export function decodeWatchFrame(text: string): Decoded<WatchFrame> {
  const obj = parseJsonObject(text);
  if (!obj) return fail(null, "frame is not a JSON object");
  if (obj.version !== PROTOCOL_VERSION) return fail(null, "unsupported protocol version");
  const identity = readIdentity(obj);
  if (!identity) return fail(null, "roomId, deviceId and sessionId required");

  if (obj.type === "WATCH_STATUS") {
    if (typeof obj.wallet !== "boolean" || (obj.session !== "OPEN" && obj.session !== "CLOSED") || typeof obj.reviewing !== "boolean") {
      return fail(null, "malformed WATCH_STATUS");
    }
    return {
      ok: true,
      value: {
        version: PROTOCOL_VERSION,
        type: "WATCH_STATUS",
        wallet: obj.wallet,
        session: obj.session,
        reviewing: obj.reviewing,
        ...identity,
      },
    };
  }

  const requestId = isRequestId(obj.requestId) ? obj.requestId : null;
  if (!requestId) return fail(null, "requestId must be a lowercase UUID v4");

  if (obj.type === "GET_ADDRESS_RESULT") {
    if (obj.status !== "OK" && obj.status !== "LOCKED" && obj.status !== "NO_WALLET") return fail(requestId, "bad status");
    const result: GetAddressResult = {
      version: PROTOCOL_VERSION,
      type: "GET_ADDRESS_RESULT",
      requestId,
      status: obj.status,
      ...identity,
    };
    if (obj.status === "OK") {
      if (typeof obj.address !== "string") return fail(requestId, "address missing");
      try {
        if (fromBase58(obj.address).length !== 32) return fail(requestId, "address must be 32 bytes");
      } catch {
        return fail(requestId, "address is not base58");
      }
      result.address = obj.address;
      if (obj.profile === "TROPIC01" || obj.profile === "SE050E") result.profile = obj.profile;
      if (isNonNegativeSafeInteger(obj.maxMessageBytes)) result.maxMessageBytes = obj.maxMessageBytes;
    }
    return { ok: true, value: result };
  }

  if (obj.type === "SIGN_TRANSACTION_RESULT") {
    if (!SIGN_STATUSES.includes(obj.status as SignStatus)) return fail(requestId, "bad status");
    const status = obj.status as SignStatus;
    const result: SignTransactionResult = {
      version: PROTOCOL_VERSION,
      type: "SIGN_TRANSACTION_RESULT",
      requestId,
      status,
      ...identity,
    };
    if (status === "APPROVED") {
      if (typeof obj.signature !== "string") return fail(requestId, "APPROVED without signature");
      try {
        if (fromBase58(obj.signature).length !== SIGNATURE_BYTES) return fail(requestId, "signature must be 64 bytes");
      } catch {
        return fail(requestId, "signature is not base58");
      }
      result.signature = obj.signature;
    } else if (obj.signature !== undefined) {
      return fail(requestId, "signature present on non-APPROVED result");
    }
    if (typeof obj.reason === "string") result.reason = obj.reason.slice(0, 200);
    return { ok: true, value: result };
  }

  return fail(requestId, "unknown frame type");
}

export function encodeFrame(frame: SekundFrame): string {
  if (!isRoomId(frame.roomId) || !isIdentityId(frame.deviceId) || !isIdentityId(frame.sessionId)) {
    throw new Error("frame missing roomId, deviceId or sessionId");
  }
  return JSON.stringify(frame);
}
