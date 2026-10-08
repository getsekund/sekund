import type { Address, Base64EncodedWireTransaction } from "@solana/kit";
import { fromBase58, parseTransferMessage, type SignStatus } from "@sekund/protocol";
import type { SekundClient } from "./sekund-client.ts";
import {
  SignatureVerificationError,
  buildTransfer,
  computeExpiresInMs,
  explorerTxUrl,
  verifyAndAssemble,
  type ConfirmOutcome,
  type Lifetime,
} from "./solana.ts";

export type FlowStage =
  | { stage: "fetching-blockhash" }
  | { stage: "awaiting-approval"; requestId: string; deadline: number; expiresInMs: number; messageLength: number }
  | { stage: "verifying" }
  | { stage: "broadcasting" }
  | { stage: "confirming"; signature: string };

export type FlowOutcome =
  | { kind: "confirmed"; signature: string; explorerUrl: string; requestId: string }
  | { kind: "watch-refused"; status: Exclude<SignStatus, "APPROVED">; reason?: string; requestId: string }
  | { kind: "timeout"; requestId: string }
  | { kind: "verification-failed"; requestId: string }
  | { kind: "chain-failed"; signature: string; error: string; requestId: string }
  | { kind: "chain-expired"; signature: string; requestId: string }
  | { kind: "error"; message: string };

export interface TransferDeps {
  client: SekundClient;
  /** Calls getLatestBlockhash. Invoked once per request, immediately before building. */
  fetchLifetime: () => Promise<Lifetime>;
  broadcast: (wire: Base64EncodedWireTransaction, lastValidBlockHeight: bigint) => Promise<ConfirmOutcome>;
  now?: () => number;
  /** Optional cap on the review window. It can only shorten what the blockhash allows. */
  maxExpiresInMs?: number;
  onStage?: (stage: FlowStage) => void;
  /** Parsed from the exact message bytes about to be sent (companion card source of truth). */
  onBuilt?: (info: { to: string; lamports: bigint; messageBytes: Uint8Array }) => void;
}

const MAX_REFETCH = 3;

/**
 * One request = one blockhash = one review on the watch. After EXPIRED the caller runs this
 * again, which fetches a new blockhash and sends a new requestId (spec 5.5 step 5).
 */
export async function sendTransfer(deps: TransferDeps, params: { from: Address; to: Address; lamports: bigint }): Promise<FlowOutcome> {
  const now = deps.now ?? Date.now;
  try {
    let lifetime: Lifetime | null = null;
    let expiresInMs = 0;
    for (let i = 0; i < MAX_REFETCH && expiresInMs <= 0; i++) {
      deps.onStage?.({ stage: "fetching-blockhash" });
      lifetime = await deps.fetchLifetime();
      expiresInMs = Math.min(computeExpiresInMs(lifetime.fetchedAt, now()), deps.maxExpiresInMs ?? Number.POSITIVE_INFINITY);
    }
    if (!lifetime || expiresInMs <= 0) return { kind: "error", message: "Could not get a fresh blockhash in time." };

    const built = buildTransfer({ ...params, lifetime });
    const parsed = parseTransferMessage(built.messageBytes, params.from);
    if (!parsed.ok) return { kind: "error", message: `Built message failed the allowlist: ${parsed.reason}` };
    deps.onBuilt?.({ to: parsed.transfer.to, lamports: parsed.transfer.lamports, messageBytes: built.messageBytes });
    const handle = deps.client.requestSignature({
      messageBytes: built.messageBytes,
      expiresInMs,
      lastValidBlockHeight: lifetime.lastValidBlockHeight,
    });
    deps.onStage?.({ stage: "awaiting-approval", requestId: handle.requestId, deadline: now() + expiresInMs, expiresInMs, messageLength: built.messageBytes.length });

    const result = await handle.result;
    const requestId = handle.requestId;
    if (result.status === "TIMEOUT") return { kind: "timeout", requestId };
    if (result.status !== "APPROVED") return { kind: "watch-refused", status: result.status, requestId, ...(result.reason ? { reason: result.reason } : {}) };

    deps.onStage?.({ stage: "verifying" });
    let wire: Base64EncodedWireTransaction;
    try {
      wire = await verifyAndAssemble(built, fromBase58(result.signature!));
    } catch (error) {
      if (error instanceof SignatureVerificationError) return { kind: "verification-failed", requestId };
      throw error;
    }

    deps.onStage?.({ stage: "broadcasting" });
    const confirm = await deps.broadcast(wire, lifetime.lastValidBlockHeight);
    if (confirm.status === "confirmed") return { kind: "confirmed", signature: confirm.signature, explorerUrl: explorerTxUrl(confirm.signature), requestId };
    if (confirm.status === "failed") return { kind: "chain-failed", signature: confirm.signature, error: confirm.error, requestId };
    return { kind: "chain-expired", signature: confirm.signature, requestId };
  } catch (error) {
    return { kind: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
