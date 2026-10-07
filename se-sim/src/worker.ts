/// <reference lib="webworker" />
import type { SeProfile } from "@sekund/protocol";
import { SimulatedSeChip } from "./chip.ts";
import { serveSecureElement, type RpcPort } from "./rpc.ts";
import { createIndexedDbStore } from "./store.ts";

/**
 * Simulated SE Worker. The worker name (`sekund-se-TROPIC01` or `sekund-se-SE050E`, set in
 * browser.ts) selects the profile. The key lives only here, as a non-extractable CryptoKey
 * in IndexedDB.
 */
const profile: SeProfile = self.name === "sekund-se-SE050E" ? "SE050E" : "TROPIC01";

const store = await createIndexedDbStore(`sekund-se-${profile}`);
serveSecureElement(self as unknown as RpcPort, new SimulatedSeChip({ profile, store }));
self.postMessage({ ready: true });
