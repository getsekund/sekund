import { describe, expect, it } from "vitest";
import { formatLamports, parseTransferMessage, toBase58 } from "../src/index.ts";
import { key, legacyMessage, nonceMessage, SYSTEM, transferData, transferMessage, u32le, v0LookupMessage } from "./message-builder.ts";

const from = key(0x11);
const to = key(0x22);
const fromAddress = toBase58(from);

describe("parseTransferMessage", () => {
  it("parses a 150-byte legacy System transfer (spec 5.3 layout)", () => {
    const bytes = transferMessage(from, to, 123_456_789n);
    expect(bytes).toHaveLength(150);
    const result = parseTransferMessage(bytes, fromAddress);
    expect(result).toEqual({
      ok: true,
      transfer: {
        kind: "SYSTEM_TRANSFER",
        from: fromAddress,
        to: toBase58(to),
        lamports: 123_456_789n,
        sol: "0.123456789",
        recentBlockhash: toBase58(key(0xbb)),
        messageLength: 150,
      },
    });
  });

  it("refuses durable-nonce messages", () => {
    expect(parseTransferMessage(nonceMessage(from, to), fromAddress)).toMatchObject({ ok: false, status: "UNSUPPORTED", reason: expect.stringMatching(/nonce/i) });
  });

  it("refuses v0 messages with lookup tables and other versions", () => {
    expect(parseTransferMessage(v0LookupMessage(from), fromAddress)).toMatchObject({ ok: false, status: "UNSUPPORTED", reason: expect.stringMatching(/lookup/i) });
    const v1 = transferMessage(from, to);
    const versioned = Uint8Array.from([0x81, ...v1]);
    expect(parseTransferMessage(versioned, fromAddress)).toMatchObject({ ok: false, status: "UNSUPPORTED" });
  });

  it("refuses a transfer whose fee payer is not the watch", () => {
    expect(parseTransferMessage(transferMessage(key(0x99), to), fromAddress)).toMatchObject({ ok: false, status: "UNSUPPORTED" });
  });

  it("refuses other programs and other System instructions", () => {
    const other = legacyMessage({ keys: [from, to, key(0x77)], instructions: [{ program: 2, accounts: [0, 1], data: transferData(1n) }] });
    expect(parseTransferMessage(other, fromAddress)).toMatchObject({ ok: false, status: "UNSUPPORTED" });
    const assign = legacyMessage({ keys: [from, to, SYSTEM], instructions: [{ program: 2, accounts: [0], data: [...u32le(1), ...new Array(32).fill(0)] }] });
    expect(parseTransferMessage(assign, fromAddress)).toMatchObject({ ok: false, status: "UNSUPPORTED" });
  });

  it("refuses two instructions, even two transfers", () => {
    const two = legacyMessage({
      keys: [from, to, SYSTEM],
      instructions: [
        { program: 2, accounts: [0, 1], data: transferData(1n) },
        { program: 2, accounts: [0, 1], data: transferData(1n) },
      ],
    });
    expect(parseTransferMessage(two, fromAddress)).toMatchObject({ ok: false, status: "UNSUPPORTED" });
  });

  it("refuses extra signers and zero lamports", () => {
    const twoSigners = legacyMessage({ header: [2, 0, 1], keys: [from, to, SYSTEM], instructions: [{ program: 2, accounts: [0, 1], data: transferData(1n) }] });
    expect(parseTransferMessage(twoSigners, fromAddress)).toMatchObject({ ok: false, status: "UNSUPPORTED" });
    expect(parseTransferMessage(transferMessage(from, to, 0n), fromAddress)).toMatchObject({ ok: false, status: "UNSUPPORTED" });
  });

  it("refuses malformed bytes", () => {
    const good = transferMessage(from, to);
    expect(parseTransferMessage(new Uint8Array(0))).toMatchObject({ status: "INVALID" });
    expect(parseTransferMessage(good.subarray(0, 100))).toMatchObject({ status: "INVALID" });
    expect(parseTransferMessage(Uint8Array.from([...good, 0]))).toMatchObject({ status: "INVALID", reason: expect.stringMatching(/trailing/) });
    const outOfRange = legacyMessage({ keys: [from, to, SYSTEM], instructions: [{ program: 2, accounts: [0, 9], data: transferData(1n) }] });
    expect(parseTransferMessage(outOfRange)).toMatchObject({ status: "INVALID" });
    const readonlyDestination = legacyMessage({ header: [1, 0, 2], keys: [from, to, SYSTEM], instructions: [{ program: 2, accounts: [0, 1], data: transferData(1n) }] });
    expect(parseTransferMessage(readonlyDestination)).toMatchObject({ status: "INVALID" });
  });
});

describe("formatLamports", () => {
  it.each([
    [1_000_000_000n, "1"],
    [1n, "0.000000001"],
    [2_500_000_000n, "2.5"],
    [10_000_000n, "0.01"],
  ])("%s lamports is %s SOL", (lamports, sol) => {
    expect(formatLamports(lamports)).toBe(sol);
  });
});
