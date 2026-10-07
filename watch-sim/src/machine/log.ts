import type { SignStatus } from "@sekund/protocol";
import type { Effect, WatchEvent, WatchState } from "./machine";

export interface LogEntry {
  id: number;
  at: number;
  text: string;
  /** Events about one request are grouped in the panel. */
  requestId?: string;
}

export type LogLine = Omit<LogEntry, "id" | "at">;

const ANSWER: Record<SignStatus, string> = {
  APPROVED: "Approved on watch",
  REJECTED: "Rejected on watch",
  EXPIRED: "Expired, not signed",
  LOCKED: "Refused, watch locked",
  BUSY: "Refused, another request on screen",
  TOO_LARGE: "Refused, message too large",
  UNSUPPORTED: "Refused, not a plain transfer",
  REPLAYED: "Refused, request already seen",
  INVALID: "Refused, malformed request",
};

export function answerLine(requestId: string, status: SignStatus): LogLine {
  return { text: ANSWER[status], requestId };
}

/** What a person watching the simulator would want written down for one transition. */
export function describe(prev: WatchState, event: WatchEvent, next: WatchState, effects: readonly Effect[]): LogLine[] {
  const out: LogLine[] = [];
  if (event.type === "WRIST" && prev.onWrist !== next.onWrist) out.push({ text: next.onWrist ? "Put on wrist" : "Taken off wrist" });
  if (event.type === "REVIEW" && next.request === event.review) {
    out.push({ text: `Request received, ${event.review.transfer.sol} SOL`, requestId: event.review.request.requestId });
  }
  if (event.type === "WALLET_CREATED") out.push({ text: "Key created in the secure element" });
  if (event.type === "PIN_RESULT" && event.result.status === "WRONG_PIN") {
    out.push({ text: `Wrong PIN, ${event.result.attemptsRemaining} tries left` });
  }
  if (event.type === "PIN_RESULT" && event.result.status === "WIPED") out.push({ text: "Third wrong PIN, key erased" });
  if (event.type === "RESET") out.push({ text: "Simulator reset" });
  if (!prev.session && next.session && event.type === "PIN_RESULT") out.push({ text: "PIN accepted, session open" });
  for (const e of effects) {
    if (e.type === "respond") out.push(answerLine(e.response.requestId, e.response.status));
  }
  if (prev.session && !next.session) out.push({ text: "Session closed" });
  return out;
}
