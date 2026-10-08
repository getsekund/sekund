import { MAX_FRAME_BYTES, RELAY_URL } from "../constants.ts";
import { DEFAULT_ROOM_ID, isPeerIdentity, type PeerIdentity } from "../identity.ts";
import { Emitter } from "./emitter.ts";
import { oppositeRole, type RelayControlEvent, type Role, type Transport, type TransportState } from "./types.ts";

export interface RelayTransportOptions {
  role: Role;
  identity: PeerIdentity;
  /** Defaults to ws://127.0.0.1:4319. */
  url?: string;
  /** Reconnect delay after the socket closes. Set to 0 to disable reconnecting. */
  reconnectMs?: number;
  /** Injected for tests; defaults to the global WebSocket (browsers, Node 22+). */
  WebSocketImpl?: typeof WebSocket;
}

function isControlEvent(value: unknown): value is RelayControlEvent {
  return typeof value === "object" && value !== null && (value as RelayControlEvent).relay === 1;
}

/**
 * Connects to the local relay (`pnpm relay`) in an exclusive room. Frames reach only the
 * opposite seat in the same room. Reconnects with a fresh sessionId are the caller's job
 * (pass a new identity); this client keeps the given identity for the socket lifetime.
 */
export function createRelayTransport(options: RelayTransportOptions): Transport {
  const { role, identity } = options;
  if (identity.roomId.length === 0) throw new Error("identity.roomId required");
  const base = options.url ?? RELAY_URL;
  const params = new URLSearchParams({
    role,
    room: identity.roomId,
    deviceId: identity.deviceId,
    sessionId: identity.sessionId,
  });
  const url = `${base}?${params}`;
  const reconnectMs = options.reconnectMs ?? 1_000;
  const WS = options.WebSocketImpl ?? globalThis.WebSocket;

  const frames = new Emitter<string>();
  const peers = new Emitter<{ connected: boolean; peer: PeerIdentity | null }>();
  const states = new Emitter<TransportState>();

  let socket: WebSocket | null = null;
  let state: TransportState = "connecting";
  let peerConnected = false;
  let peerIdentity: PeerIdentity | null = null;
  let closedByUser = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const setState = (next: TransportState) => {
    if (state === next) return;
    state = next;
    states.emit(next);
  };
  const setPeer = (connected: boolean, peer: PeerIdentity | null) => {
    if (peerConnected === connected && peerIdentity?.sessionId === peer?.sessionId) return;
    peerConnected = connected;
    peerIdentity = peer;
    peers.emit({ connected, peer });
  };

  const connect = () => {
    setState("connecting");
    const ws = new WS(url);
    socket = ws;
    ws.onopen = () => setState("open");
    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data !== "string" || event.data.length > MAX_FRAME_BYTES) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      if (isControlEvent(parsed)) {
        if (parsed.event === "rejected") {
          setState("rejected");
          closedByUser = true;
          ws.close();
          return;
        }
        if (parsed.event === "peer" && parsed.role === oppositeRole(role) && parsed.roomId === identity.roomId) {
          const peer = parsed.connected && parsed.peer && isPeerIdentity(parsed.peer) ? parsed.peer : null;
          setPeer(!!peer, peer);
        }
        return;
      }
      frames.emit(event.data);
    };
    ws.onclose = () => {
      socket = null;
      setPeer(false, null);
      if (state !== "rejected") setState("closed");
      if (!closedByUser && reconnectMs > 0) timer = setTimeout(connect, reconnectMs);
    };
    ws.onerror = () => {
      // onclose follows and handles reconnecting.
    };
  };

  connect();

  return {
    role,
    identity,
    get state() {
      return state;
    },
    get peerConnected() {
      return peerConnected;
    },
    get peerIdentity() {
      return peerIdentity;
    },
    send(text: string) {
      if (text.length > MAX_FRAME_BYTES) throw new Error("frame too large");
      if (socket && socket.readyState === WS.OPEN) socket.send(text);
    },
    onFrame: (listener) => frames.on(listener),
    onPeer: (listener) => peers.on(({ connected, peer }) => listener(connected, peer)),
    onState: (listener) => states.on(listener),
    close() {
      closedByUser = true;
      if (timer) clearTimeout(timer);
      socket?.close();
    },
  };
}

export { DEFAULT_ROOM_ID };
