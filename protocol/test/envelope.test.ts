import { describe, expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  decodeCompanionRequest,
  decodeWatchFrame,
  demoIdentity,
  encodeFrame,
  toBase58,
  toBase64,
  type SignTransactionRequest,
} from "../src/index.ts";

const requestId = "3f2b8c1e-9a4d-4e7f-8b21-0c5d6e7f8a9b";
const companion = demoIdentity("companion");
const watch = demoIdentity("watch");

function signRequest(overrides: Record<string, unknown> = {}): string {
  const base: SignTransactionRequest = {
    version: PROTOCOL_VERSION,
    type: "SIGN_TRANSACTION",
    requestId,
    nonce: toBase64(new Uint8Array(16).fill(7)),
    network: "devnet",
    message: toBase64(new Uint8Array(150)),
    expiresInMs: 52_000,
    lastValidBlockHeight: 123,
    ...companion,
  };
  return JSON.stringify({ ...base, ...overrides });
}

describe("decodeCompanionRequest", () => {
  it("accepts a well-formed SIGN_TRANSACTION", () => {
    const result = decodeCompanionRequest(signRequest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe("SIGN_TRANSACTION");
      expect(result.value.roomId).toBe(companion.roomId);
      expect(result.value.deviceId).toBe(companion.deviceId);
    }
  });

  it("accepts GET_ADDRESS and CANCEL_REQUEST", () => {
    expect(decodeCompanionRequest(JSON.stringify({ version: PROTOCOL_VERSION, type: "GET_ADDRESS", requestId, ...companion }))).toEqual({
      ok: true,
      value: { version: PROTOCOL_VERSION, type: "GET_ADDRESS", requestId, ...companion },
    });
    expect(decodeCompanionRequest(JSON.stringify({ version: PROTOCOL_VERSION, type: "CANCEL_REQUEST", requestId, ...companion }))).toMatchObject({
      ok: true,
      value: { type: "CANCEL_REQUEST", requestId },
    });
  });

  it("drops frames without a usable requestId or identity", () => {
    expect(decodeCompanionRequest("not json")).toMatchObject({ ok: false, requestId: null });
    expect(decodeCompanionRequest(signRequest({ requestId: "abc" }))).toMatchObject({ ok: false, requestId: null });
    expect(decodeCompanionRequest(signRequest({ deviceId: "not-a-uuid" }))).toMatchObject({ ok: false, requestId });
  });

  it.each([
    ["version", { version: 1 }],
    ["type", { type: "SIGN_EVERYTHING" }],
    ["network", { network: "mainnet-beta" }],
    ["short nonce", { nonce: toBase64(new Uint8Array(8)) }],
    ["non-base64 nonce", { nonce: "***" }],
    ["fractional expiry", { expiresInMs: 1.5 }],
    ["expiry above 60 s", { expiresInMs: 60_001 }],
    ["negative block height", { lastValidBlockHeight: -1 }],
    ["missing message", { message: "" }],
  ])("refuses a bad %s with a requestId to answer", (_label, overrides) => {
    expect(decodeCompanionRequest(signRequest(overrides))).toMatchObject({ ok: false, requestId });
  });

  it("keeps a non-positive expiry for the guard to answer EXPIRED", () => {
    const result = decodeCompanionRequest(signRequest({ expiresInMs: 0 }));
    expect(result.ok).toBe(true);
  });
});

describe("decodeWatchFrame", () => {
  const signature = toBase58(new Uint8Array(64).fill(1));

  it("accepts APPROVED with a 64-byte signature", () => {
    const text = encodeFrame({
      version: PROTOCOL_VERSION,
      type: "SIGN_TRANSACTION_RESULT",
      requestId,
      status: "APPROVED",
      signature,
      ...watch,
    });
    expect(decodeWatchFrame(text)).toMatchObject({ ok: true, value: { status: "APPROVED", signature, deviceId: watch.deviceId } });
  });

  it("refuses APPROVED without a signature and a signature on REJECTED", () => {
    expect(
      decodeWatchFrame(JSON.stringify({ version: PROTOCOL_VERSION, type: "SIGN_TRANSACTION_RESULT", requestId, status: "APPROVED", ...watch })).ok,
    ).toBe(false);
    expect(
      decodeWatchFrame(
        JSON.stringify({ version: PROTOCOL_VERSION, type: "SIGN_TRANSACTION_RESULT", requestId, status: "REJECTED", signature, ...watch }),
      ).ok,
    ).toBe(false);
  });

  it("refuses a short signature", () => {
    const short = toBase58(new Uint8Array(63).fill(1));
    expect(
      decodeWatchFrame(
        JSON.stringify({ version: PROTOCOL_VERSION, type: "SIGN_TRANSACTION_RESULT", requestId, status: "APPROVED", signature: short, ...watch }),
      ).ok,
    ).toBe(false);
  });

  it("accepts an address result and WATCH_STATUS", () => {
    const address = toBase58(new Uint8Array(32).fill(9));
    expect(
      decodeWatchFrame(
        JSON.stringify({
          version: PROTOCOL_VERSION,
          type: "GET_ADDRESS_RESULT",
          requestId,
          status: "OK",
          address,
          profile: "TROPIC01",
          maxMessageBytes: 4096,
          ...watch,
        }),
      ),
    ).toMatchObject({ ok: true, value: { address, profile: "TROPIC01" } });
    expect(
      decodeWatchFrame(JSON.stringify({ version: PROTOCOL_VERSION, type: "WATCH_STATUS", wallet: true, session: "OPEN", reviewing: false, ...watch })).ok,
    ).toBe(true);
  });
});
