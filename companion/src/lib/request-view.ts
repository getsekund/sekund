import type { FlowOutcome, FlowStage } from "./transfer-flow.ts";

export type Chip = "SENDING" | "WAITING" | "SIGNED" | "CONFIRMED" | "REJECTED" | "EXPIRED" | "LOCKED" | "FAILED";

export interface RequestEntry {
  id: number;
  to: string;
  lamports: bigint;
  createdAt: number;
  /** When the watch got the request (start of the review). */
  sentAt?: number;
  /** When the watch answered. */
  answeredAt?: number;
  stage?: FlowStage;
  outcome?: FlowOutcome;
}

export interface RequestView {
  chip: Chip;
  /** One-line status under the card title. */
  summary: string;
  /** Step text while work is in progress; never shown without words. */
  step?: string;
  /** Inline error: cause (bold), then what happened and what to do. */
  error?: { cause: string; fix: string };
  signature?: string;
  /** "again" = a new request with a new blockhash; "retry" = same, after an error. */
  action?: "again" | "retry" | "new";
  /** Full sentence for the polite live region. */
  announce: string;
}

const seconds = (from?: number, to?: number) => (from !== undefined && to !== undefined ? Math.max(0, Math.round((to - from) / 1000)) : null);

const REFUSAL: Record<string, { cause: string; fix: string }> = {
  TOO_LARGE: { cause: "The message is larger than the secure element accepts.", fix: "The watch refused it before display. Nothing was signed." },
  UNSUPPORTED: { cause: "The watch signs only one devnet SOL transfer from its own address.", fix: "Nothing was signed. Send a plain transfer." },
  REPLAYED: { cause: "The watch had already seen this request.", fix: "Nothing was signed. Press Retry to send a new one." },
  BUSY: { cause: "The watch is reviewing another request.", fix: "Finish that one on the watch, then press Retry." },
  INVALID: { cause: "The watch could not read the request.", fix: "Nothing was signed. Press Retry." },
};

export function describeRequest(entry: RequestEntry, sol: string): RequestView {
  const what = `Transfer of ${sol} SOL`;
  const { outcome, stage } = entry;

  if (!outcome) {
    switch (stage?.stage) {
      case undefined:
      case "fetching-blockhash":
        return { chip: "SENDING", summary: "Preparing the request.", step: "Fetching a recent blockhash.", announce: `${what}: fetching a recent blockhash.` };
      case "awaiting-approval":
        return {
          chip: "WAITING",
          summary: "Waiting for the watch. Approve or reject it there; this page cannot do it for you.",
          announce: `${what} is waiting for approval on the watch.`,
        };
      case "verifying":
        return { chip: "SIGNED", summary: signedSummary(entry), step: "Verifying the signature against the message and the watch address.", announce: `${what} signed by the watch simulator.` };
      case "broadcasting":
        return { chip: "SIGNED", summary: signedSummary(entry), step: "Broadcasting to devnet.", announce: `${what} signed. Broadcasting to devnet.` };
      case "confirming":
        return { chip: "SIGNED", summary: signedSummary(entry), step: "Waiting for devnet to confirm.", signature: stage.signature, announce: `${what} sent to devnet.` };
    }
  }

  switch (outcome.kind) {
    case "confirmed": {
      const approved = signedSummary(entry);
      const summary = approved.startsWith("Approved") ? `Confirmed on devnet. ${approved}` : "Confirmed on devnet.";
      return { chip: "CONFIRMED", summary, signature: outcome.signature, action: "new", announce: `${what} confirmed on devnet.` };
    }
    case "timeout":
      return {
        chip: "EXPIRED",
        summary: "The watch did not answer before the blockhash expired. Nothing was signed. Send it again.",
        action: "again",
        announce: `${what} expired. Nothing was signed.`,
      };
    case "watch-refused":
      if (outcome.status === "REJECTED") return { chip: "REJECTED", summary: "Rejected on the watch. Nothing was signed.", action: "again", announce: `${what} rejected on the watch.` };
      if (outcome.status === "EXPIRED")
        return {
          chip: "EXPIRED",
          summary: "The review ran out before approval. Nothing was signed. Send it again for a new blockhash.",
          action: "again",
          announce: `${what} expired on the watch. Nothing was signed.`,
        };
      if (outcome.status === "LOCKED")
        return {
          chip: "LOCKED",
          summary: "Nothing was signed.",
          error: { cause: "The watch is locked.", fix: "Enter the PIN on the watch, then press Retry." },
          action: "retry",
          announce: `${what} refused: the watch is locked.`,
        };
      return {
        chip: "FAILED",
        summary: "Nothing was signed.",
        error: REFUSAL[outcome.status] ?? { cause: "The watch refused the request.", fix: outcome.reason ?? "Press Retry." },
        action: "retry",
        announce: `${what} refused by the watch.`,
      };
    case "verification-failed":
      return {
        chip: "FAILED",
        summary: "Nothing was broadcast.",
        error: { cause: "The signature does not match the message and the watch address.", fix: "The companion refused to broadcast it. Press Retry." },
        action: "retry",
        announce: `${what} failed: signature did not verify.`,
      };
    case "chain-expired":
      return {
        chip: "FAILED",
        summary: signedSummary(entry),
        error: { cause: "Devnet did not confirm before the blockhash expired.", fix: "Press Retry to sign a new request." },
        signature: outcome.signature,
        action: "retry",
        announce: `${what} was not confirmed in time.`,
      };
    case "chain-failed":
      return {
        chip: "FAILED",
        summary: signedSummary(entry),
        error: { cause: "Devnet rejected the transaction.", fix: `${outcome.error} Check the balance, then press Retry.` },
        signature: outcome.signature,
        action: "retry",
        announce: `${what} failed on devnet.`,
      };
    case "error":
      return {
        chip: "FAILED",
        summary: "Nothing was signed.",
        error: { cause: outcome.message.endsWith(".") ? outcome.message : `${outcome.message}.`, fix: "Check the connection and press Retry." },
        action: "retry",
        announce: `${what} failed: ${outcome.message}`,
      };
  }
}

/** The one sentence on the card. In-progress steps replace a second heading. */
export function statusLine(view: RequestView): string {
  if (view.chip === "SENDING" && view.step) return view.step;
  if (view.chip === "SIGNED" && view.step) return `${view.summary} ${view.step}`;
  return view.summary;
}

function signedSummary(entry: RequestEntry): string {
  const s = seconds(entry.sentAt, entry.answeredAt);
  return s === null ? "Approved on the watch." : `Approved on the watch after ${s} s.`;
}

/** Full address in groups of four (DESIGN.md section 4). */
export function groupAddress(address: string): string {
  return address.match(/.{1,4}/g)?.join(" ") ?? address;
}

export function truncateSignature(signature: string): string {
  return signature.length <= 18 ? signature : `${signature.slice(0, 8)}…${signature.slice(-7)}`;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** `?reviewSeconds=N` can only shorten the review window (used by the e2e expiry test). */
export function parseReviewCap(search: string): number | undefined {
  const raw = new URLSearchParams(search).get("reviewSeconds");
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const ms = Number(raw) * 1000;
  return ms > 0 ? ms : undefined;
}
