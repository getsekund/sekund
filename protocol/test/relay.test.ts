import { afterEach, describe, expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  createMemoryTransportPair,
  createPeerIdentity,
  createRelayTransport,
  demoIdentity,
  encodeFrame,
  type Transport,
} from "../src/index.ts";
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

describe("relay rooms (exclusive seats)", () => {
  let relay: RelayServer | null = null;
  const open: Transport[] = [];

  afterEach(async () => {
    for (const t of open.splice(0)) t.close();
    await relay?.close();
    relay = null;
  });

  it("forwards frames only to the opposite seat in the same room", async () => {
    relay = await startRelay({ port: 0 });
    const url = `ws://127.0.0.1:${relay.port}`;
    const roomA = "room-a";
    const companion = createRelayTransport({
      role: "companion",
      url,
      reconnectMs: 0,
      identity: createPeerIdentity(roomA),
    });
    const watch = createRelayTransport({
      role: "watch",
      url,
      reconnectMs: 0,
      identity: createPeerIdentity(roomA),
    });
    open.push(companion, watch);
    await waitFor(() => companion.peerConnected && watch.peerConnected);
    expect(companion.peerIdentity?.deviceId).toBe(watch.identity.deviceId);
    expect(watch.peerIdentity?.deviceId).toBe(companion.identity.deviceId);

    const atWatch: string[] = [];
    watch.onFrame((t) => atWatch.push(t));
    companion.send('{"hello":1}');
    await waitFor(() => atWatch.length === 1);
    expect(atWatch).toEqual(['{"hello":1}']);
  });

  it("rejects a second watch and a second companion in the same room", async () => {
    relay = await startRelay({ port: 0 });
    const url = `ws://127.0.0.1:${relay.port}`;
    const room = "exclusive";
    const companion = createRelayTransport({
      role: "companion",
      url,
      reconnectMs: 0,
      identity: createPeerIdentity(room),
    });
    const watch = createRelayTransport({
      role: "watch",
      url,
      reconnectMs: 0,
      identity: createPeerIdentity(room),
    });
    open.push(companion, watch);
    await waitFor(() => companion.peerConnected && watch.peerConnected);

    const secondWatch = createRelayTransport({
      role: "watch",
      url,
      reconnectMs: 0,
      identity: createPeerIdentity(room),
    });
    const secondCompanion = createRelayTransport({
      role: "companion",
      url,
      reconnectMs: 0,
      identity: createPeerIdentity(room),
    });
    open.push(secondWatch, secondCompanion);

    await waitFor(() => secondWatch.state === "rejected" && secondCompanion.state === "rejected");
    expect(secondWatch.peerConnected).toBe(false);
    expect(secondCompanion.peerConnected).toBe(false);

    const atWatch: string[] = [];
    const atSecond: string[] = [];
    watch.onFrame((t) => atWatch.push(t));
    secondWatch.onFrame((t) => atSecond.push(t));
    companion.send('{"only":"bound-watch"}');
    await waitFor(() => atWatch.length === 1);
    expect(atSecond).toEqual([]);
  });

  it("does not fan out across rooms; foreign correlated response cannot win", async () => {
    relay = await startRelay({ port: 0 });
    const url = `ws://127.0.0.1:${relay.port}`;
    const roomDemo = "sekund-demo";
    const roomEvil = "evil-room";

    const companion = createRelayTransport({
      role: "companion",
      url,
      reconnectMs: 0,
      identity: createPeerIdentity(roomDemo),
    });
    const watch = createRelayTransport({
      role: "watch",
      url,
      reconnectMs: 0,
      identity: createPeerIdentity(roomDemo),
    });
    const foreignWatch = createRelayTransport({
      role: "watch",
      url,
      reconnectMs: 0,
      identity: createPeerIdentity(roomEvil),
    });
    const foreignCompanion = createRelayTransport({
      role: "companion",
      url,
      reconnectMs: 0,
      identity: createPeerIdentity(roomEvil),
    });
    open.push(companion, watch, foreignWatch, foreignCompanion);
    await waitFor(() => companion.peerConnected && watch.peerConnected && foreignWatch.peerConnected);

    const atBound: string[] = [];
    const atForeign: string[] = [];
    watch.onFrame((t) => atBound.push(t));
    foreignWatch.onFrame((t) => atForeign.push(t));

    companion.send(
      encodeFrame({
        version: PROTOCOL_VERSION,
        type: "GET_ADDRESS",
        requestId: "3f2b8c1e-9a4d-4e7f-8b21-0c5d6e7f8a9b",
        ...companion.identity,
      }),
    );
    await waitFor(() => atBound.length === 1);
    expect(atForeign).toEqual([]);

    // Foreign watch answers with the same requestId into its own room — bound companion must not see it.
    const atCompanion: string[] = [];
    companion.onFrame((t) => atCompanion.push(t));
    foreignWatch.send(
      encodeFrame({
        version: PROTOCOL_VERSION,
        type: "SIGN_TRANSACTION_RESULT",
        requestId: "3f2b8c1e-9a4d-4e7f-8b21-0c5d6e7f8a9b",
        status: "REJECTED",
        reason: "foreign",
        ...foreignWatch.identity,
      }),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(atCompanion).toEqual([]);
  });

  it("refuses browser origins outside the allowlist", async () => {
    relay = await startRelay({ port: 0 });
    const { WebSocket } = await import("ws");
    const id = createPeerIdentity("sekund-demo");
    const ws = new WebSocket(
      `ws://127.0.0.1:${relay.port}/?role=watch&room=${id.roomId}&deviceId=${id.deviceId}&sessionId=${id.sessionId}`,
      { origin: "https://evil.example" },
    );
    const outcome = await new Promise<string>((resolve) => {
      ws.on("open", () => resolve("open"));
      ws.on("error", () => resolve("refused"));
    });
    expect(outcome).toBe("refused");
  });
});

describe("memory transport", () => {
  it("delivers frames to the other side with identities", async () => {
    const { companion, watch } = createMemoryTransportPair();
    expect(companion.identity.roomId).toBe(demoIdentity("companion").roomId);
    const got: string[] = [];
    watch.onFrame((t) => got.push(t));
    companion.send("x");
    await Promise.resolve();
    expect(got).toEqual(["x"]);
  });
});
