import type { SeProfile } from "@sekund/protocol";
import { seDriver, type SimulatedSecureElement } from "./driver.ts";
import { connectSecureElement, type RpcPort } from "./rpc.ts";

export interface BrowserSeOptions {
  /** Defaults to TROPIC01, the recommended part (spec 5.3). */
  profile?: SeProfile;
}

/**
 * Starts the simulated SE in a dedicated Web Worker and returns it behind `seDriver`.
 * Resolves once the Worker has opened its IndexedDB store.
 */
export async function createBrowserSecureElement(options: BrowserSeOptions = {}): Promise<SimulatedSecureElement> {
  const profile = options.profile ?? "TROPIC01";
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: `sekund-se-${profile}` });

  await new Promise<void>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { ready?: boolean })?.ready) {
        worker.removeEventListener("message", onMessage);
        resolve();
      }
    };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", (event) => reject(new Error(`SE worker failed: ${event.message}`)), { once: true });
  });

  return seDriver(connectSecureElement(worker as unknown as RpcPort, profile));
}
