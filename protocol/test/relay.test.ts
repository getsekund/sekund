import { afterEach, describe, expect, it } from "vitest";
import { createMemoryTransportPair, createRelayTransport, type Transport } from "../src/index.ts";
import { startRelay, type RelayServer } from "../src/relay/server.ts";

function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("timeout"));
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe("relay transport", () => {
  let relay: RelayServer | null = null;
  const open: Transport[] = [];

  afterEach(async () => {
    for (const t of open.splice(0)) t.close();
    await relay?.close();
    relay = null;
  });

  it("forwards frames only to the opposite role and reports peers", async () => {
    relay = await startRelay({ port: 0 });
    const url = `ws://127.0.0.1:${relay.port}`;
    const companion = createRelayTransport({ role: "companion", url, reconnectMs: 0 });
    const watch = createRelayTransport({ role: "watch", url, reconnectMs: 0 });
    const secondCompanion = createRelayTransport({ role: "companion", url, reconnectMs: 0 });
    open.push(companion, watch, secondCompanion);

    await waitFor(() => companion.peerConnected && watch.peerConnected && secondCompanion.peerConnected);

    const atWatch: string[] = [];
    const atSecondCompanion: string[] = [];
    watch.onFrame((t) => atWatch.push(t));
    secondCompanion.onFrame((t) => atSecondCompanion.push(t));

    companion.send('{"hello":1}');
    await waitFor(() => atWatch.length === 1);
    expect(atWatch).toEqual(['{"hello":1}']);
    expect(atSecondCompanion).toEqual([]);

    watch.close();
    await waitFor(() => !companion.peerConnected);
  });

  it("refuses browser origins outside the allowlist", async () => {
    relay = await startRelay({ port: 0 });
    const { WebSocket } = await import("ws");
    const ws = new WebSocket(`ws://127.0.0.1:${relay.port}/?role=watch`, { origin: "https://evil.example" });
    const outcome = await new Promise<string>((resolve) => {
      ws.on("open", () => resolve("open"));
      ws.on("error", () => resolve("refused"));
    });
    expect(outcome).toBe("refused");
  });
});

describe("memory transport", () => {
  it("delivers frames to the other side", async () => {
    const { companion, watch } = createMemoryTransportPair();
    const got: string[] = [];
    watch.onFrame((t) => got.push(t));
    companion.send("x");
    await Promise.resolve();
    expect(got).toEqual(["x"]);
  });
});
