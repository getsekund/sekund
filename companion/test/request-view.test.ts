import { describe, expect, it } from "vitest";
import { address, blockhash, type Signature } from "@solana/kit";
import { createMemoryTransportPair, randomBytes, toBase58 } from "@sekund/protocol";
import { createInProcessSecureElement } from "@sekund/se-sim";
import { SekundClient } from "../src/lib/sekund-client.ts";
import { describeRequest, formatCountdown, groupAddress, parseReviewCap, truncateSignature, type RequestEntry } from "../src/lib/request-view.ts";
import { sendTransfer } from "../src/lib/transfer-flow.ts";
import { HeadlessWatch } from "../src/testing/headless-watch.ts";

const base: RequestEntry = { id: 1, to: toBase58(randomBytes(32)), lamports: 10_000_000n, createdAt: 0 };
const sig = "5".repeat(88);
const view = (patch: Partial<RequestEntry>) => describeRequest({ ...base, ...patch }, "0.01");

describe("request card states (DESIGN.md companion chips)", () => {
  it("maps every flow stage and outcome to the watch's words", () => {
    expect(view({}).chip).toBe("SENDING");
    expect(view({ stage: { stage: "fetching-blockhash" } }).step).toBe("Fetching a recent blockhash.");
    expect(view({ stage: { stage: "awaiting-approval", requestId: "r", deadline: 1, expiresInMs: 1, messageLength: 150 } }).chip).toBe("WAITING");
    expect(view({ stage: { stage: "broadcasting" }, sentAt: 0, answeredAt: 24_000 })).toMatchObject({ chip: "SIGNED", summary: "Approved on the watch after 24 s.", step: "Broadcasting to devnet." });
    expect(view({ stage: { stage: "confirming", signature: sig } })).toMatchObject({ chip: "SIGNED", signature: sig });
    expect(view({ outcome: { kind: "confirmed", signature: sig, explorerUrl: "x", requestId: "r" } })).toMatchObject({ chip: "CONFIRMED", signature: sig, action: "new" });
    expect(view({ outcome: { kind: "watch-refused", status: "REJECTED", requestId: "r" } })).toMatchObject({ chip: "REJECTED", action: "again" });
    expect(view({ outcome: { kind: "watch-refused", status: "EXPIRED", requestId: "r" } })).toMatchObject({ chip: "EXPIRED", action: "again" });
    expect(view({ outcome: { kind: "timeout", requestId: "r" } })).toMatchObject({ chip: "EXPIRED", action: "again" });
    expect(view({ outcome: { kind: "watch-refused", status: "LOCKED", requestId: "r" } })).toMatchObject({ chip: "LOCKED", action: "retry" });
    expect(view({ outcome: { kind: "verification-failed", requestId: "r" } })).toMatchObject({ chip: "FAILED", action: "retry" });
    expect(view({ outcome: { kind: "error", message: "fetch failed" } }).error?.cause).toBe("fetch failed.");
  });

  it("never shows a signature for refused requests", () => {
    for (const status of ["REJECTED", "EXPIRED", "LOCKED", "BUSY", "TOO_LARGE"] as const) {
      expect(view({ outcome: { kind: "watch-refused", status, requestId: "r" } }).signature).toBeUndefined();
    }
  });

  it("formats addresses in full groups of four, signatures middle-truncated, countdown as M:SS", () => {
    const addr = "5awdRY3zVWWNZXmHH955bDxdUoZ7aFqjKKaCeCeBuAbg";
    expect(groupAddress(addr).replaceAll(" ", "")).toBe(addr);
    expect(groupAddress(addr).split(" ").every((g) => g.length <= 4)).toBe(true);
    expect(truncateSignature(sig)).toBe(`${"5".repeat(8)}…${"5".repeat(7)}`);
    expect(formatCountdown(47_200)).toBe("0:48");
    expect(formatCountdown(60_000)).toBe("1:00");
    expect(formatCountdown(-5)).toBe("0:00");
  });

  it("copy has no em or en dashes", () => {
    const outcomes = [
      view({}),
      view({ stage: { stage: "awaiting-approval", requestId: "r", deadline: 1, expiresInMs: 1, messageLength: 150 } }),
      view({ outcome: { kind: "timeout", requestId: "r" } }),
      view({ outcome: { kind: "watch-refused", status: "REJECTED", requestId: "r" } }),
      view({ outcome: { kind: "chain-expired", signature: sig, requestId: "r" } }),
    ];
    for (const v of outcomes) expect(JSON.stringify(v)).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("review cap (?reviewSeconds)", () => {
  it("parses only positive whole seconds", () => {
    expect(parseReviewCap("?reviewSeconds=3")).toBe(3000);
    expect(parseReviewCap("?reviewSeconds=0")).toBeUndefined();
    expect(parseReviewCap("?reviewSeconds=-1")).toBeUndefined();
    expect(parseReviewCap("?reviewSeconds=1e9")).toBeUndefined();
    expect(parseReviewCap("")).toBeUndefined();
  });

  it("shortens the window so the watch expires the request with no signature, and never lengthens it", async () => {
    const se = createInProcessSecureElement({ profile: "TROPIC01" });
    await se.setPin("4821");
    await se.generateKey(0);
    const from = address(toBase58(await se.getPublicKey(0)));
    const pair = createMemoryTransportPair();
    let reviews = 0;
    const watch = new HeadlessWatch({ transport: pair.watch, se, decide: () => (reviews++ === 0 ? "wait" : "reject") });
    const client = new SekundClient(pair.companion, { graceMs: 200 });
    const fetchLifetime = async () => ({ blockhash: blockhash(toBase58(randomBytes(32))), lastValidBlockHeight: 1_000n, fetchedAt: Date.now() });
    const broadcast = async () => ({ status: "confirmed" as const, signature: sig as Signature });
    const to = address(toBase58(randomBytes(32)));

    const started = Date.now();
    const outcome = await sendTransfer({ client, fetchLifetime, broadcast, maxExpiresInMs: 300 }, { from, to, lamports: 1n });
    expect(outcome).toMatchObject({ kind: "watch-refused", status: "EXPIRED" });
    expect(watch.displayed[0]!.deadline - started).toBeLessThanOrEqual(400);
    expect(watch.sent.every((r) => r.signature === undefined)).toBe(true);

    let seen = 0;
    await sendTransfer(
      {
        client,
        fetchLifetime,
        broadcast,
        maxExpiresInMs: 10 * 60_000,
        onStage: (s) => {
          if (s.stage === "awaiting-approval") seen = s.expiresInMs;
        },
      },
      { from, to, lamports: 1n },
    );
    expect(seen).toBeLessThanOrEqual(52_000);
  });
});
