import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { SimulatedSeChip } from "../src/chip.ts";
import { createIndexedDbStore } from "../src/store.ts";

describe("atomic PIN failure counter (shared IndexedDB)", () => {
  it("exactly three concurrent wrong attempts wipe the key", async () => {
    const dbName = `sekund-pin-atomic-${crypto.randomUUID()}`;
    const storeA = await createIndexedDbStore(dbName);
    const storeB = await createIndexedDbStore(dbName);
    const a = new SimulatedSeChip({ profile: "TROPIC01", store: storeA });
    const b = new SimulatedSeChip({ profile: "TROPIC01", store: storeB });
    await a.setPin("1234");
    await a.generateKey(0);
    await a.endSession();

    const results = await Promise.all([b.verifyPin("0000"), a.verifyPin("1111"), b.verifyPin("2222")]);
    const wiped = results.filter((r) => r.status === "WIPED");
    const wrong = results.filter((r) => r.status === "WRONG_PIN");
    expect(wiped.length + wrong.length).toBe(3);
    expect(wiped.length).toBe(1);
    expect((await a.getState()).hasKey).toBe(false);
    expect((await b.getState()).hasKey).toBe(false);
    expect((await storeA.getFailedAttempts()) === 0 || (await storeA.getPin()) === undefined).toBe(true);
  });
});
