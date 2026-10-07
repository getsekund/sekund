import { describe, expect, it } from "vitest";
import { SeError, type SeProfile } from "@sekund/protocol";
import vectors from "./fixtures/rfc8032-7.1.json" with { type: "json" };
import { createInProcessSecureElement, createMemoryStore, seDriver, SimulatedSeChip } from "../src/index.ts";
import { approveAndSign, hex, toHex } from "./helpers.ts";

const PROFILES: SeProfile[] = ["TROPIC01", "SE050E"];

async function testSe(profile: SeProfile, secretKey: string) {
  const se = createInProcessSecureElement({ profile, allowTestKeyImport: true });
  await se.setPin("1234");
  await se.importTestKey(0, hex(secretKey));
  return se;
}

describe.each(PROFILES)("RFC 8032 section 7.1 vectors, %s profile", (profile) => {
  it.each(vectors.vectors.map((v) => [v.name, v] as const))("%s: public key and signature are byte-exact", async (_name, v) => {
    const se = await testSe(profile, v.secretKey);
    expect(toHex(await se.getPublicKey(0))).toBe(v.publicKey);

    const message = hex(v.message);
    if (message.length > se.maxMessageBytes) {
      await expect(se.issueApproveToken(0, message)).rejects.toMatchObject({ code: "TOO_LARGE" });
      return;
    }
    expect(toHex(await approveAndSign(se, message))).toBe(v.signature);
  });
});

describe("profile limits", () => {
  it("TROPIC01 signs 4096 bytes and SE050E caps at 919", async () => {
    const v = vectors.vectors[0]!;
    const tropic = await testSe("TROPIC01", v.secretKey);
    const se050 = await testSe("SE050E", v.secretKey);
    expect(tropic.maxMessageBytes).toBe(4096);
    expect(se050.maxMessageBytes).toBe(919);

    await expect(approveAndSign(tropic, new Uint8Array(4096))).resolves.toHaveLength(64);
    await expect(approveAndSign(se050, new Uint8Array(919))).resolves.toHaveLength(64);
    await expect(tropic.issueApproveToken(0, new Uint8Array(4097))).rejects.toMatchObject({ code: "TOO_LARGE" });
    await expect(se050.issueApproveToken(0, new Uint8Array(920))).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("the TEST 1024 message (1023 bytes) is refused on SE050E, never truncated", async () => {
    const v = vectors.vectors.find((x) => x.name === "TEST 1024")!;
    const se = await testSe("SE050E", v.secretKey);
    const token = await se.issueApproveToken(0, hex(v.message).subarray(0, 919));
    const error = await se.eddsaSign(0, hex(v.message), token).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SeError);
    expect((error as SeError).code).toBe("TOO_LARGE");
  });
});

describe("wire byte order (spec 5.4)", () => {
  const test3 = vectors.vectors.find((v) => v.name === "TEST 3")!;

  it("SE050E chip emits big-endian; the NXP AN12543 TEST 3 example matches", async () => {
    const chip = new SimulatedSeChip({ profile: "SE050E", store: createMemoryStore(), allowTestKeyImport: true });
    const se = seDriver(chip);
    await se.setPin("1234");
    await se.importTestKey(0, hex(test3.secretKey));

    const wirePk = toHex(await chip.getPublicKeyWire(0));
    expect(wirePk.startsWith("25809048")).toBe(true);
    expect(wirePk.endsWith("8ecd51fc")).toBe(true);

    const message = hex(test3.message);
    const wireSig = await chip.eddsaSignWire(0, message, await chip.issueApproveToken(0, message));
    const rfcSig = hex(test3.signature);
    expect(toHex(wireSig.subarray(0, 32))).toBe(toHex(rfcSig.slice(0, 32).reverse()));
    expect(toHex(wireSig.subarray(32))).toBe(toHex(rfcSig.slice(32).reverse()));
    // Reversing the whole 64-byte block is the documented mistake; it must not match.
    expect(toHex(wireSig.slice().reverse())).not.toBe(test3.signature);
  });

  it("TROPIC01 chip emits RFC 8032 order unchanged", async () => {
    const chip = new SimulatedSeChip({ profile: "TROPIC01", store: createMemoryStore(), allowTestKeyImport: true });
    const se = seDriver(chip);
    await se.setPin("1234");
    await se.importTestKey(0, hex(test3.secretKey));
    expect(toHex(await chip.getPublicKeyWire(0))).toBe(test3.publicKey);
  });

  it("test key import is refused unless explicitly enabled", async () => {
    const se = createInProcessSecureElement({ profile: "TROPIC01" });
    await se.setPin("1234");
    await expect(se.importTestKey(0, new Uint8Array(32))).rejects.toMatchObject({ code: "NOT_ALLOWED" });
  });
});
