import { describe, expect, it } from "vitest";
import { RequestGuard, isExpired, remainingSeconds, toBase58, toBase64, type WatchContext } from "../src/index.ts";
import { key, nonceMessage, transferMessage, v0LookupMessage } from "./message-builder.ts";

const from = key(0x11);
const address = toBase58(from);
const ctx: WatchContext = { sessionOpen: true, hasKey: true, busy: false, address, maxMessageBytes: 4096 };

let counter = 0;
function frame(overrides: Record<string, unknown> = {}, message: Uint8Array = transferMessage(from)): string {
  counter++;
  const id = `3f2b8c1e-9a4d-4e7f-8b21-${counter.toString(16).padStart(12, "0")}`;
  const nonce = new Uint8Array(16);
  nonce[0] = counter & 0xff;
  nonce[1] = counter >> 8;
  return JSON.stringify({
    version: 1,
    type: "SIGN_TRANSACTION",
    requestId: id,
    nonce: toBase64(nonce),
    network: "devnet",
    message: toBase64(message),
    expiresInMs: 50_000,
    lastValidBlockHeight: 1,
    ...overrides,
  });
}

describe("RequestGuard", () => {
  it("passes a valid transfer to review with a deadline", () => {
    const guard = new RequestGuard({ now: () => 1_000 });
    const outcome = guard.check(frame(), ctx);
    expect(outcome.kind).toBe("review");
    if (outcome.kind !== "review") return;
    expect(outcome.review.deadline).toBe(51_000);
    expect(outcome.review.messageBytes).toEqual(transferMessage(from));
    expect(remainingSeconds(outcome.review, 1_000)).toBe(50);
    expect(remainingSeconds(outcome.review, 50_500)).toBe(1);
    expect(isExpired(outcome.review, 51_000)).toBe(true);
    expect(remainingSeconds(outcome.review, 60_000)).toBe(0);
  });

  it("refuses a replayed request, even with a new blockhash", () => {
    const guard = new RequestGuard();
    const text = frame();
    expect(guard.check(text, ctx).kind).toBe("review");
    expect(guard.check(text, ctx)).toMatchObject({ kind: "respond", response: { status: "REPLAYED" } });

    const sameIdNewBytes = JSON.parse(text);
    sameIdNewBytes.message = toBase64(transferMessage(from, key(0x22), 5n));
    sameIdNewBytes.nonce = toBase64(new Uint8Array(16).fill(0xee));
    expect(guard.check(JSON.stringify(sameIdNewBytes), ctx)).toMatchObject({ response: { status: "REPLAYED" } });
  });

  it("refuses a reused nonce under a new requestId", () => {
    const guard = new RequestGuard();
    const first = JSON.parse(frame());
    guard.check(JSON.stringify(first), ctx);
    const second = JSON.parse(frame());
    second.nonce = first.nonce;
    expect(guard.check(JSON.stringify(second), ctx)).toMatchObject({ response: { status: "REPLAYED" } });
  });

  it("remembers refused requests too, and restores persisted ids", () => {
    const persisted: string[] = [];
    const guard = new RequestGuard({ onSeen: (v) => persisted.push(v) });
    const text = frame({ expiresInMs: 0 });
    expect(guard.check(text, ctx)).toMatchObject({ response: { status: "EXPIRED" } });
    const reloaded = new RequestGuard({ seen: persisted });
    expect(reloaded.check(text, ctx)).toMatchObject({ response: { status: "REPLAYED" } });
  });

  it("answers EXPIRED for an already-expired request", () => {
    expect(new RequestGuard().check(frame({ expiresInMs: -5 }), ctx)).toMatchObject({ response: { status: "EXPIRED" } });
  });

  it("answers LOCKED without a session or key, BUSY during a review", () => {
    const guard = new RequestGuard();
    expect(guard.check(frame(), { ...ctx, sessionOpen: false })).toMatchObject({ response: { status: "LOCKED" } });
    expect(guard.check(frame(), { ...ctx, hasKey: false, address: null })).toMatchObject({ response: { status: "LOCKED" } });
    expect(guard.check(frame(), { ...ctx, busy: true })).toMatchObject({ response: { status: "BUSY" } });
  });

  it("refuses an oversize message before parsing or display, on both profiles", () => {
    const guard = new RequestGuard();
    expect(guard.check(frame({}, new Uint8Array(920)), { ...ctx, maxMessageBytes: 919 })).toMatchObject({ response: { status: "TOO_LARGE" } });
    expect(guard.check(frame({}, new Uint8Array(4097)), ctx)).toMatchObject({ response: { status: "TOO_LARGE" } });
    // 919 bytes of junk passes the size check and is then refused by the parser instead.
    expect(guard.check(frame({}, new Uint8Array(919)), { ...ctx, maxMessageBytes: 919 })).toMatchObject({ response: { status: "INVALID" } });
  });

  it("refuses nonce and lookup-table messages", () => {
    const guard = new RequestGuard();
    expect(guard.check(frame({}, nonceMessage(from)), ctx)).toMatchObject({ response: { status: "UNSUPPORTED" } });
    expect(guard.check(frame({}, v0LookupMessage(from)), ctx)).toMatchObject({ response: { status: "UNSUPPORTED" } });
  });

  it("answers INVALID for structural errors and drops unanswerable frames", () => {
    const guard = new RequestGuard();
    expect(guard.check(frame({ network: "mainnet-beta" }), ctx)).toMatchObject({ response: { status: "INVALID" } });
    expect(guard.check(frame({ version: 2 }), ctx)).toMatchObject({ response: { status: "INVALID" } });
    expect(guard.check(frame({ message: "%%%" }), ctx)).toMatchObject({ response: { status: "INVALID" } });
    expect(guard.check("{}", ctx).kind).toBe("drop");
  });

  it("passes GET_ADDRESS through", () => {
    const outcome = new RequestGuard().check(JSON.stringify({ version: 1, type: "GET_ADDRESS", requestId: "0b6f6a52-0d3e-4b0c-9f5e-2a1c7d8e9f01" }), ctx);
    expect(outcome.kind).toBe("address");
  });
});
