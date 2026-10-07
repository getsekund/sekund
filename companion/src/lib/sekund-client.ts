import {
  PROTOCOL_VERSION,
  decodeWatchFrame,
  encodeFrame,
  randomBytes,
  toBase64,
  NONCE_BYTES,
  type GetAddressResult,
  type SignTransactionRequest,
  type SignTransactionResult,
  type Transport,
  type WatchStatus,
} from "@sekund/protocol";

export type SignOutcome = SignTransactionResult | { status: "TIMEOUT"; requestId: string };

export interface SignRequestHandle {
  requestId: string;
  expiresInMs: number;
  result: Promise<SignOutcome>;
}

interface Pending {
  resolve: (frame: GetAddressResult | SignTransactionResult) => void;
  kind: "GET_ADDRESS_RESULT" | "SIGN_TRANSACTION_RESULT";
}

/**
 * Companion side of PROTOCOL.md. Accepts each result once, only for a pending requestId of
 * the matching type; everything else from the transport is ignored.
 */
export class SekundClient {
  private readonly pending = new Map<string, Pending>();
  private readonly statusListeners = new Set<(status: WatchStatus) => void>();
  private readonly unsubscribe: () => void;

  constructor(
    readonly transport: Transport,
    private readonly options: { graceMs?: number; addressTimeoutMs?: number } = {},
  ) {
    this.unsubscribe = transport.onFrame((text) => this.onFrame(text));
  }

  private onFrame(text: string): void {
    const decoded = decodeWatchFrame(text);
    if (!decoded.ok) return;
    const frame = decoded.value;
    if (frame.type === "WATCH_STATUS") {
      for (const listener of this.statusListeners) listener(frame);
      return;
    }
    const entry = this.pending.get(frame.requestId);
    if (!entry || entry.kind !== frame.type) return;
    this.pending.delete(frame.requestId);
    entry.resolve(frame);
  }

  onWatchStatus(listener: (status: WatchStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  getAddress(): Promise<GetAddressResult | null> {
    const requestId = crypto.randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve(null);
      }, this.options.addressTimeoutMs ?? 3_000);
      this.pending.set(requestId, {
        kind: "GET_ADDRESS_RESULT",
        resolve: (frame) => {
          clearTimeout(timer);
          resolve(frame as GetAddressResult);
        },
      });
      this.transport.send(encodeFrame({ version: PROTOCOL_VERSION, type: "GET_ADDRESS", requestId }));
    });
  }

  /** Sends a fresh request (new requestId and nonce). The result promise settles exactly once. */
  requestSignature(params: { messageBytes: Uint8Array; expiresInMs: number; lastValidBlockHeight: bigint }): SignRequestHandle {
    const requestId = crypto.randomUUID();
    const request: SignTransactionRequest = {
      version: PROTOCOL_VERSION,
      type: "SIGN_TRANSACTION",
      requestId,
      nonce: toBase64(randomBytes(NONCE_BYTES)),
      network: "devnet",
      message: toBase64(params.messageBytes),
      expiresInMs: params.expiresInMs,
      lastValidBlockHeight: Number(params.lastValidBlockHeight),
    };
    const result = new Promise<SignOutcome>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve({ status: "TIMEOUT", requestId });
      }, Math.max(0, params.expiresInMs) + (this.options.graceMs ?? 5_000));
      this.pending.set(requestId, {
        kind: "SIGN_TRANSACTION_RESULT",
        resolve: (frame) => {
          clearTimeout(timer);
          resolve(frame as SignTransactionResult);
        },
      });
    });
    this.transport.send(encodeFrame(request));
    return { requestId, expiresInMs: params.expiresInMs, result };
  }

  dispose(): void {
    this.unsubscribe();
    this.pending.clear();
  }
}
