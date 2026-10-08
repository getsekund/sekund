import {
  createMemoryTransportPair,
  decodeWatchFrame,
  demoIdentity,
  encodeFrame,
  fromBase58,
  PROTOCOL_VERSION,
  stampIdentity,
  type SeProfile,
  type Transport,
  type WatchFrame,
} from "@sekund/protocol";
import { createInProcessSecureElement } from "@sekund/se-sim";
import { describe, expect, it } from "vitest";
import { signRequest, transferBytes } from "@/testing/fixtures";
import { WatchController } from "./controller";
import { type Button, gesture } from "./gestures";
import { DEFAULT_CONFIG, REVIEW_PAGES } from "./machine";

const PIN = "2580";
const flush = () => new Promise((r) => setTimeout(r, 0));

async function setup(profile: SeProfile = "TROPIC01") {
  let now = 5_000_000;
  const se = createInProcessSecureElement({ profile, now: () => now });
  const { companion, watch: watchLink } = createMemoryTransportPair();
  const frames: WatchFrame[] = [];
  companion.onFrame((text) => {
    const d = decodeWatchFrame(text);
    if (d.ok) frames.push(d.value);
  });
  const watch = new WatchController({ transport: watchLink, clock: () => now });
  await watch.boot(se);

  const press = (...b: Button[]) => watch.press(gesture(...b));
  const openSecure = () => {
    press("A", "D");
    now += DEFAULT_CONFIG.entryMs;
    watch.tick();
  };
  const enterPin = async (pin: string) => {
    for (const ch of pin) {
      for (let i = 0; i < Number(ch); i++) press("B");
      press("C", "D");
    }
    await watch.settle();
  };
  const createWallet = async () => {
    openSecure();
    await enterPin(PIN);
    await enterPin(PIN);
  };
  const unlock = async (pin = PIN) => {
    openSecure();
    await enterPin(pin);
  };
  const ask = async (frame: object, link: Transport = companion) => {
    link.send(encodeFrame(frame as never));
    await flush();
    await watch.settle();
    await flush();
  };
  const sendTransfer = async (overrides = {}, bytes?: Uint8Array) => {
    const message = bytes ?? transferBytes(fromBase58(watch.state.address!), 25_000_000n);
    const req = signRequest(message, overrides);
    await ask(req);
    return { req, message };
  };
  const results = () => frames.filter((f) => f.type === "SIGN_TRANSACTION_RESULT");
  return { se, watch, frames, results, press, enterPin, createWallet, unlock, ask, sendTransfer, advance: (ms: number) => (now += ms) };
}

describe("WatchController with the simulated secure element", () => {
  it("first run sets the PIN and generates the key inside the SE", async () => {
    const t = await setup();
    expect(t.watch.state.hasPin).toBe(false);
    await t.createWallet();
    expect(t.watch.state.session).toBe(true);
    expect(t.watch.state.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect((await t.se.getState()).hasKey).toBe(true);
  });

  it("approve inside a PIN session returns a signature that verifies against the message and address", async () => {
    const t = await setup();
    await t.createWallet();
    const { req, message } = await t.sendTransfer();
    expect(t.watch.state.screen).toEqual({ kind: "review", page: 0 });
    for (let i = 0; i < REVIEW_PAGES.length; i++) t.press("B");
    t.press("D");
    await t.watch.settle();
    await flush();

    const res = t.results().at(-1)!;
    expect(res).toMatchObject({ requestId: req.requestId, status: "APPROVED" });
    const key = await crypto.subtle.importKey("raw", fromBase58(t.watch.state.address!) as BufferSource, "Ed25519", false, ["verify"]);
    const sig = fromBase58((res as { signature: string }).signature);
    expect(await crypto.subtle.verify("Ed25519", key, sig as BufferSource, message as BufferSource)).toBe(true);
    const events = t.watch.log.filter((e) => e.requestId === req.requestId).map((e) => e.text);
    expect(events).toEqual(["Approved on watch", "Request received, 0.025 SOL"]);
  });

  it("reject produces no signature", async () => {
    const t = await setup();
    await t.createWallet();
    const { req } = await t.sendTransfer();
    t.press("C");
    await flush();
    expect(t.results()).toMatchObject([
      {
        version: PROTOCOL_VERSION,
        type: "SIGN_TRANSACTION_RESULT",
        requestId: req.requestId,
        status: "REJECTED",
        reason: "rejected on the watch",
        ...demoIdentity("watch"),
      },
    ]);
  });

  it("refuses while locked, then refuses the same request again as a replay", async () => {
    const t = await setup();
    await t.createWallet();
    t.press("C");
    await t.watch.settle();
    const { req } = await t.sendTransfer();
    expect(t.results().at(-1)?.status).toBe("LOCKED");
    await t.unlock();
    await t.ask(req);
    expect(t.results().at(-1)?.status).toBe("REPLAYED");
    expect(t.watch.state.request).toBeNull();
  });

  it("refuses an oversize message before display on the SE050E profile", async () => {
    const t = await setup("SE050E");
    await t.createWallet();
    const big = transferBytes(fromBase58(t.watch.state.address!), 1n, { padData: 800 });
    await t.sendTransfer({}, big);
    expect(t.results().at(-1)?.status).toBe("TOO_LARGE");
    expect(t.watch.state.screen.kind).toBe("menu");
  });

  it("expiry auto-rejects without signing", async () => {
    const t = await setup();
    await t.createWallet();
    const { req } = await t.sendTransfer({ expiresInMs: 4_000 });
    t.advance(4_000);
    t.watch.tick();
    await flush();
    expect(t.results().at(-1)).toMatchObject({ requestId: req.requestId, status: "EXPIRED" });
    expect(t.results().at(-1)).not.toHaveProperty("signature");
  });

  it("three wrong PINs wipe the key", async () => {
    const t = await setup();
    await t.createWallet();
    t.press("C");
    await t.watch.settle();
    for (let i = 0; i < 3; i++) {
      if (i > 0) t.press("C");
      await t.unlock("0000");
    }
    expect(t.watch.state.screen.kind).toBe("wiped");
    expect(t.watch.state.address).toBeNull();
    expect(await t.se.getState()).toMatchObject({ hasKey: false, hasPin: false });
  });

  it("wrist-off closes the SE session and answers the request on screen LOCKED", async () => {
    const t = await setup();
    await t.createWallet();
    await t.sendTransfer();
    t.watch.setWrist(false);
    await t.watch.settle();
    await flush();
    expect((await t.se.getState()).sessionOpen).toBe(false);
    expect(t.results().at(-1)?.status).toBe("LOCKED");
    expect(t.watch.state.screen.kind).toBe("normal");
  });

  it("answers GET_ADDRESS by session state and reports WATCH_STATUS changes", async () => {
    const t = await setup();
    const ask = () =>
      t.ask(
        stampIdentity(
          { version: PROTOCOL_VERSION, type: "GET_ADDRESS", requestId: crypto.randomUUID() },
          demoIdentity("companion"),
        ),
      );
    await ask();
    expect(t.frames.at(-1)).toMatchObject({ type: "GET_ADDRESS_RESULT", status: "NO_WALLET" });
    await t.createWallet();
    await ask();
    expect(t.frames.at(-1)).toMatchObject({ status: "OK", address: t.watch.state.address, profile: "TROPIC01", maxMessageBytes: 4096 });
    t.press("C");
    await t.watch.settle();
    await ask();
    expect(t.frames.at(-1)).toMatchObject({ status: "LOCKED" });
    expect(t.frames.at(-1)).not.toHaveProperty("address");
    const statuses = t.frames.filter((f) => f.type === "WATCH_STATUS").map((f) => f.type === "WATCH_STATUS" && f.session);
    expect(statuses).toContain("OPEN");
    expect(statuses.at(-1)).toBe("CLOSED");
  });
});
