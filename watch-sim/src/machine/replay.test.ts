import { createMemoryTransportPair, createMemoryReplayJournal, demoIdentity, encodeFrame, REPLAY_TTL_MS } from "@sekund/protocol";
import { createInProcessSecureElement } from "@sekund/se-sim";
import { describe, expect, it } from "vitest";
import { signRequest, transferBytes } from "@/testing/fixtures";
import { WatchController } from "./controller";
import { fromBase58 } from "@sekund/protocol";
import { DEFAULT_CONFIG } from "./machine";
import { gesture } from "./gestures";

describe("persistent replay across controller reload", () => {
  it("reload locks the session but refuses the same requestId/nonce as REPLAYED", async () => {
    let now = 1_000_000;
    const journal = createMemoryReplayJournal();
    const se = createInProcessSecureElement({ profile: "TROPIC01", now: () => now });
    await se.setPin("1234");
    await se.generateKey(0);
    await se.endSession();

    const pair1 = createMemoryTransportPair();
    const watch1 = new WatchController({ transport: pair1.watch, clock: () => now, replay: journal });
    await watch1.boot(se);
    watch1.press(gesture("A", "D"));
    now += DEFAULT_CONFIG.entryMs;
    watch1.tick();
    for (const ch of "1234") {
      for (let i = 0; i < Number(ch); i++) watch1.press(gesture("B"));
      watch1.press(gesture("C", "D"));
    }
    await watch1.settle();

    const frames: string[] = [];
    pair1.companion.onFrame((t) => frames.push(t));
    const req = signRequest(transferBytes(fromBase58(watch1.state.address!)));
    pair1.companion.send(encodeFrame(req));
    await watch1.settle();
    expect(watch1.state.request).not.toBeNull();

    // Reload: new controller, same journal + SE (session closed by Worker restart in product;
    // here we endSession and rebuild the controller).
    await se.endSession();
    const pair2 = createMemoryTransportPair({
      companion: demoIdentity("companion"),
      watch: demoIdentity("watch"),
    });
    const watch2 = new WatchController({ transport: pair2.watch, clock: () => now, replay: journal });
    await watch2.boot(se);
    expect(watch2.state.session).toBe(false);

    const replies: string[] = [];
    pair2.companion.onFrame((t) => replies.push(t));
    pair2.companion.send(encodeFrame(req));
    await watch2.settle();
    await new Promise((r) => setTimeout(r, 10));
    expect(watch2.state.request).toBeNull();
    expect(replies.some((t) => t.includes('"REPLAYED"'))).toBe(true);
    expect(REPLAY_TTL_MS).toBeGreaterThan(60_000);
  });
});
