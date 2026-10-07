import { describe, expect, it } from "vitest";
import { APPROVE_TOKEN_TTL_MS, SeError, type SeProfile } from "@sekund/protocol";
import {
  connectSecureElement,
  createInProcessSecureElement,
  createIndexedDbStore,
  createMemoryStore,
  seDriver,
  serveSecureElement,
  SimulatedSeChip,
  type RpcPort,
} from "../src/index.ts";
import { approveAndSign, verifyEd25519 } from "./helpers.ts";

const message = new TextEncoder().encode("SEKUND devnet transfer message bytes");
let dbCounter = 0;
const freshDb = () => `sekund-test-${Date.now()}-${dbCounter++}`;

async function provisioned(profile: SeProfile = "TROPIC01", now?: () => number) {
  const se = createInProcessSecureElement({ profile, ...(now ? { now } : {}) });
  await se.setPin("2580");
  await se.generateKey(0);
  return se;
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(error instanceof SeError)) throw new Error(`expected SeError, got ${String(error)}`);
  return error.code;
}

describe("key generation and storage", () => {
  it.each<SeProfile>(["TROPIC01", "SE050E"])("%s: on-chip key signs the raw message and verifies against the address", async (profile) => {
    const se = await provisioned(profile);
    const publicKey = await se.getPublicKey(0);
    const signature = await approveAndSign(se, message);
    expect(publicKey).toHaveLength(32);
    expect(signature).toHaveLength(64);
    expect(await verifyEd25519(publicKey, signature, message)).toBe(true);
    // Pure Ed25519: a signature over a pre-hash of the message would be a different signature.
    const prehash = new Uint8Array(await crypto.subtle.digest("SHA-512", message));
    expect(await verifyEd25519(publicKey, signature, prehash)).toBe(false);
  });

  it("stores a non-extractable key in IndexedDB that survives a restart", async () => {
    const dbName = freshDb();
    const store = await createIndexedDbStore(dbName);
    const se = seDriver(new SimulatedSeChip({ profile: "TROPIC01", store }));
    await se.setPin("2580");
    await se.generateKey(0);
    const publicKey = await se.getPublicKey(0);

    const record = await store.getKey(0);
    expect(record?.privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("pkcs8", record!.privateKey)).rejects.toThrow();
    await expect(crypto.subtle.exportKey("jwk", record!.privateKey)).rejects.toThrow();

    const restarted = seDriver(new SimulatedSeChip({ profile: "TROPIC01", store: await createIndexedDbStore(dbName) }));
    expect(await restarted.getPublicKey(0)).toEqual(publicKey);
    expect((await restarted.getState()).sessionOpen).toBe(false);
    expect(await restarted.verifyPin("2580")).toEqual({ status: "OK" });
    expect(await verifyEd25519(publicKey, await approveAndSign(restarted, message), message)).toBe(true);
  });

  it("refuses a second key in an occupied slot", async () => {
    const se = await provisioned();
    expect(await codeOf(se.generateKey(0))).toBe("KEY_EXISTS");
  });
});

describe("PIN session", () => {
  it("three wrong PINs wipe the key and the PIN", async () => {
    const se = await provisioned();
    await se.endSession();
    expect(await se.verifyPin("0000")).toEqual({ status: "WRONG_PIN", attemptsRemaining: 2 });
    expect(await se.verifyPin("1111")).toEqual({ status: "WRONG_PIN", attemptsRemaining: 1 });
    expect(await se.verifyPin("2222")).toEqual({ status: "WIPED" });

    const state = await se.getState();
    expect(state).toMatchObject({ hasKey: false, hasPin: false, sessionOpen: false });
    expect(await codeOf(se.getPublicKey(0))).toBe("NO_KEY");
    expect(await se.verifyPin("2580")).toEqual({ status: "NO_PIN" });
  });

  it("the failure counter persists across restarts", async () => {
    const dbName = freshDb();
    const first = seDriver(new SimulatedSeChip({ profile: "TROPIC01", store: await createIndexedDbStore(dbName) }));
    await first.setPin("2580");
    await first.generateKey(0);
    await first.endSession();
    await first.verifyPin("0000");
    await first.verifyPin("0001");

    const second = seDriver(new SimulatedSeChip({ profile: "TROPIC01", store: await createIndexedDbStore(dbName) }));
    expect((await second.getState()).attemptsRemaining).toBe(1);
    expect(await second.verifyPin("0002")).toEqual({ status: "WIPED" });
  });

  it("a correct PIN resets the counter", async () => {
    const se = await provisioned();
    await se.endSession();
    await se.verifyPin("0000");
    await se.verifyPin("0001");
    expect(await se.verifyPin("2580")).toEqual({ status: "OK" });
    expect((await se.getState()).attemptsRemaining).toBe(3);
  });

  it("rejects malformed PINs without counting them", async () => {
    const se = await provisioned();
    expect(await codeOf(se.verifyPin("12a4"))).toBe("INVALID_ARGUMENT");
    expect((await se.getState()).attemptsRemaining).toBe(3);
  });

  it("signing and token issue need an open session", async () => {
    const se = await provisioned();
    const token = await se.issueApproveToken(0, message);
    await se.endSession();
    expect(await codeOf(se.eddsaSign(0, message, token))).toBe("NO_SESSION");
    expect(await codeOf(se.issueApproveToken(0, message))).toBe("NO_SESSION");
  });

  it("ending the session (wrist-off) revokes outstanding tokens", async () => {
    const se = await provisioned();
    const token = await se.issueApproveToken(0, message);
    await se.endSession();
    await se.verifyPin("2580");
    expect(await codeOf(se.eddsaSign(0, message, token))).toBe("BAD_TOKEN");
  });
});

describe("approve tokens", () => {
  it("are single use", async () => {
    const se = await provisioned();
    const token = await se.issueApproveToken(0, message);
    await se.eddsaSign(0, message, token);
    expect(await codeOf(se.eddsaSign(0, message, token))).toBe("BAD_TOKEN");
  });

  it("are bound to the exact reviewed bytes", async () => {
    const se = await provisioned();
    const token = await se.issueApproveToken(0, message);
    const altered = message.slice();
    altered[altered.length - 1]! ^= 0x01;
    expect(await codeOf(se.eddsaSign(0, altered, token))).toBe("BAD_TOKEN");
    // The failed attempt spent the token.
    expect(await codeOf(se.eddsaSign(0, message, token))).toBe("BAD_TOKEN");
  });

  it("are required and expire", async () => {
    let clock = 1_000;
    const se = await provisioned("TROPIC01", () => clock);
    expect(await codeOf(se.eddsaSign(0, message, "not-a-token"))).toBe("BAD_TOKEN");
    const token = await se.issueApproveToken(0, message);
    clock += APPROVE_TOKEN_TTL_MS + 1;
    expect(await codeOf(se.eddsaSign(0, message, token))).toBe("BAD_TOKEN");
  });
});

describe("Worker RPC boundary", () => {
  it("serves the chip over a message port and carries error codes", async () => {
    const { port1, port2 } = new MessageChannel();
    serveSecureElement(port1 as unknown as RpcPort, new SimulatedSeChip({ profile: "SE050E", store: createMemoryStore() }));
    const se = seDriver(connectSecureElement(port2 as unknown as RpcPort, "SE050E"));

    await se.setPin("2580");
    await se.generateKey(0);
    const publicKey = await se.getPublicKey(0);
    expect(await verifyEd25519(publicKey, await approveAndSign(se, message), message)).toBe(true);
    expect(await codeOf(se.eddsaSign(0, message, "nope"))).toBe("BAD_TOKEN");
    port1.close();
  });
});
