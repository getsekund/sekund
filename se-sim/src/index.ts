import type { SeProfile } from "@sekund/protocol";
import { SimulatedSeChip } from "./chip.ts";
import { seDriver, type SimulatedSecureElement } from "./driver.ts";
import { createMemoryStore, type SeStore } from "./store.ts";

export { SimulatedSeChip, type RawSecureElement, type ChipOptions } from "./chip.ts";
export { seDriver, type SimulatedSecureElement } from "./driver.ts";
export { serveSecureElement, connectSecureElement, type RpcPort } from "./rpc.ts";
export { createMemoryStore, createIndexedDbStore, type SeStore, type KeyRecord, type PinRecord } from "./store.ts";

/**
 * In-process SE for Node scripts and tests. Browsers use `createBrowserSecureElement`
 * from `@sekund/se-sim/browser`, which runs the chip in a Worker.
 */
export function createInProcessSecureElement(options: {
  profile: SeProfile;
  store?: SeStore;
  allowTestKeyImport?: boolean;
  now?: () => number;
}): SimulatedSecureElement {
  const chip = new SimulatedSeChip({
    profile: options.profile,
    store: options.store ?? createMemoryStore(),
    allowTestKeyImport: options.allowTestKeyImport ?? false,
    ...(options.now ? { now: options.now } : {}),
  });
  return seDriver(chip);
}
