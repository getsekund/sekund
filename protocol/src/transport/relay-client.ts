import { MAX_FRAME_BYTES, RELAY_URL } from "../constants.ts";
import { Emitter } from "./emitter.ts";
import { oppositeRole, type RelayPeerEvent, type Role, type Transport, type TransportState } from "./types.ts";

export interface RelayTransportOptions {
  role: Role;
  /** Defaults to ws://127.0.0.1:4319. */
  url?: string;
  /** Reconnect delay after the socket closes. Set to 0 to disable reconnecting. */
  reconnectMs?: number;
  /** Injected for tests; defaults to the global WebSocket (browsers, Node 22+). */
  WebSocketImpl?: typeof WebSocket;
}

function isPeerEvent(value: unknown): value is RelayPeerEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as RelayPeerEvent).relay === 1 &&
    (value as RelayPeerEvent).event === "peer"
  );
}

/**
 * Connects to the local relay (`pnpm relay`). Frames sent here reach every client of the
 * opposite role. Reconnects automatically. Frames sent while disconnected are dropped,
 * like a BLE write without a connection; callers time out and retry with a new request.
 */
export function createRelayTransport(options: RelayTransportOptions): Transport {
  const { role } = options;
  const url = `${options.url ?? RELAY_URL}/?role=${role}`;
  const reconnectMs = options.reconnectMs ?? 1_000;
  const WS = options.WebSocketImpl ?? globalThis.WebSocket;

  const frames = new Emitter<string>();
  const peers = new Emitter<boolean>();
  const states = new Emitter<TransportState>();

  let socket: WebSocket | null = null;
  let state: TransportState = "connecting";
  let peerConnected = false;
  let closedByUser = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const setState = (next: TransportState) => {
    if (state === next) return;
    state = next;
    states.emit(next);
  };
  const setPeer = (next: boolean) => {
    if (peerConnected === next) return;
    peerConnected = next;
    peers.emit(next);
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
      if (isPeerEvent(parsed)) {
        if (parsed.role === oppositeRole(role)) setPeer(parsed.count > 0);
        return;
      }
      frames.emit(event.data);
    };
    ws.onclose = () => {
      socket = null;
      setPeer(false);
      setState("closed");
      if (!closedByUser && reconnectMs > 0) timer = setTimeout(connect, reconnectMs);
    };
    ws.onerror = () => {
      // onclose follows and handles reconnecting.
    };
  };

  connect();

  return {
    role,
    get state() {
      return state;
    },
    get peerConnected() {
      return peerConnected;
    },
    send(text: string) {
      if (text.length > MAX_FRAME_BYTES) throw new Error("frame too large");
      if (socket && socket.readyState === WS.OPEN) socket.send(text);
    },
    onFrame: (listener) => frames.on(listener),
    onPeer: (listener) => peers.on(listener),
    onState: (listener) => states.on(listener),
    close() {
      closedByUser = true;
      if (timer) clearTimeout(timer);
      socket?.close();
    },
  };
}
