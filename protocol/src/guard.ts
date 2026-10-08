import { PROTOCOL_VERSION } from "./constants.ts";
import { fromBase64 } from "./encoding.ts";
import {
  decodeCompanionRequest,
  stampIdentity,
  type GetAddressRequest,
  type SignStatus,
  type SignTransactionRequest,
  type SignTransactionResult,
} from "./envelope.ts";
import type { PeerIdentity } from "./identity.ts";
import { parseTransferMessage, type ParsedTransfer } from "./parser.ts";

/** What the watch knows at the moment a frame arrives. */
export interface WatchContext {
  sessionOpen: boolean;
  hasKey: boolean;
  /** A review is already on screen. */
  busy: boolean;
  /** The watch's base58 address (fee payer). Required when `hasKey` is true. */
  address: string | null;
  maxMessageBytes: number;
  /** Expected companion room; frames for other rooms are dropped. */
  roomId: string;
}

/** A request that passed every check and may be shown on the review screen. */
export interface Review {
  request: SignTransactionRequest;
  /** The exact bytes to display and, on APPROVE, to sign. Keep this buffer unchanged. */
  messageBytes: Uint8Array;
  transfer: ParsedTransfer;
  receivedAt: number;
  /** Auto-reject at this time (watch clock). */
  deadline: number;
}

export type GuardOutcome =
  | { kind: "review"; review: Review }
  | { kind: "address"; request: GetAddressRequest }
  /** Companion cancelled the request currently under review. */
  | { kind: "cancel"; requestId: string }
  /** Answer immediately with this frame. */
  | { kind: "respond"; response: SignTransactionResult }
  /** Frame too broken to answer; drop it. */
  | { kind: "drop"; reason: string };

export interface RequestGuardOptions {
  now?: () => number;
  /** Watch identity stamped onto every response. */
  identity: PeerIdentity;
  /** Previously seen requestIds and nonces, if the watch persists them across reloads. */
  seen?: Iterable<string>;
  /** Called with each newly seen requestId and nonce, so the watch can persist them. */
  onSeen?: (value: string) => void;
  /** Bound on remembered ids; old entries are evicted first. */
  maxRemembered?: number;
}

export function signResult(
  identity: PeerIdentity,
  requestId: string,
  status: SignStatus,
  extra: { signature?: string; reason?: string } = {},
): SignTransactionResult {
  const result: SignTransactionResult = stampIdentity(
    { version: PROTOCOL_VERSION, type: "SIGN_TRANSACTION_RESULT" as const, requestId, status },
    identity,
  );
  if (status === "APPROVED") {
    if (!extra.signature) throw new Error("APPROVED needs a signature");
    result.signature = extra.signature;
  }
  if (extra.reason) result.reason = extra.reason;
  return result;
}

/**
 * Implements PROTOCOL.md section 5, steps 1–7. The watch state machine owns steps 8–9
 * (countdown, approve/reject, signing). One guard instance per watch.
 */
export class RequestGuard {
  private readonly now: () => number;
  private readonly identity: PeerIdentity;
  private readonly seen: Set<string>;
  private readonly onSeen: ((value: string) => void) | undefined;
  private readonly maxRemembered: number;

  constructor(options: RequestGuardOptions) {
    this.now = options.now ?? Date.now;
    this.identity = options.identity;
    this.seen = new Set(options.seen ?? []);
    this.onSeen = options.onSeen;
    this.maxRemembered = options.maxRemembered ?? 10_000;
  }

  getIdentity(): PeerIdentity {
    return this.identity;
  }

  private remember(value: string): void {
    this.seen.add(value);
    this.onSeen?.(value);
    while (this.seen.size > this.maxRemembered) {
      const oldest = this.seen.values().next().value as string;
      this.seen.delete(oldest);
    }
  }

  check(text: string, ctx: WatchContext): GuardOutcome {
    const receivedAt = this.now();
    const decoded = decodeCompanionRequest(text);
    if (!decoded.ok) {
      if (decoded.requestId === null) return { kind: "drop", reason: decoded.reason };
      const replayed = this.seen.has(`id:${decoded.requestId}`);
      if (!replayed) this.remember(`id:${decoded.requestId}`);
      return {
        kind: "respond",
        response: signResult(this.identity, decoded.requestId, replayed ? "REPLAYED" : "INVALID", { reason: decoded.reason }),
      };
    }

    const request = decoded.value;
    if (request.roomId !== ctx.roomId || request.roomId !== this.identity.roomId) {
      return { kind: "drop", reason: "room mismatch" };
    }

    if (request.type === "GET_ADDRESS") return { kind: "address", request };

    if (request.type === "CANCEL_REQUEST") {
      // Tombstone already recorded when the SIGN arrived; cancel only clears the UI.
      return { kind: "cancel", requestId: request.requestId };
    }

    const { requestId, nonce } = request;
    const respond = (status: SignStatus, reason: string): GuardOutcome => ({
      kind: "respond",
      response: signResult(this.identity, requestId, status, { reason }),
    });

    if (this.seen.has(`id:${requestId}`) || this.seen.has(`nonce:${nonce}`)) return respond("REPLAYED", "requestId or nonce already used");
    this.remember(`id:${requestId}`);
    this.remember(`nonce:${nonce}`);

    if (request.expiresInMs <= 0) return respond("EXPIRED", "request arrived already expired");
    if (!ctx.sessionOpen || !ctx.hasKey || !ctx.address) return respond("LOCKED", "unlock the watch first");
    if (ctx.busy) return respond("BUSY", "another request is under review");

    let messageBytes: Uint8Array;
    // Cheap pre-check on the base64 length so an oversize frame is never fully decoded.
    if (Math.floor((request.message.length * 3) / 4) - 2 > ctx.maxMessageBytes) {
      return respond("TOO_LARGE", `message exceeds ${ctx.maxMessageBytes} bytes`);
    }
    try {
      messageBytes = fromBase64(request.message);
    } catch {
      return respond("INVALID", "message is not base64");
    }
    if (messageBytes.length > ctx.maxMessageBytes) {
      return respond("TOO_LARGE", `message is ${messageBytes.length} bytes; limit ${ctx.maxMessageBytes}`);
    }

    const parsed = parseTransferMessage(messageBytes, ctx.address);
    if (!parsed.ok) return respond(parsed.status, parsed.reason);

    return {
      kind: "review",
      review: { request, messageBytes, transfer: parsed.transfer, receivedAt, deadline: receivedAt + request.expiresInMs },
    };
  }
}

/** Whole seconds left for the countdown display; 0 means expired. */
export function remainingSeconds(review: Review, now: number): number {
  return Math.max(0, Math.ceil((review.deadline - now) / 1000));
}

export function isExpired(review: Review, now: number): boolean {
  return now >= review.deadline;
}
