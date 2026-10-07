import { WebSocketServer, type WebSocket } from "ws";
import { COMPANION_PORT, MAX_FRAME_BYTES, RELAY_HOST, RELAY_PORT, WATCH_SIM_PORT } from "../constants.ts";
import { oppositeRole, type RelayPeerEvent, type Role } from "../transport/types.ts";

export interface RelayOptions {
  host?: string;
  /** 0 picks a free port (tests). */
  port?: number;
  /** Browser origins allowed to connect. Clients without an Origin header (scripts, tests) are allowed. */
  allowedOrigins?: string[];
  log?: (line: string) => void;
}

export interface RelayServer {
  readonly port: number;
  close(): Promise<void>;
}

export const DEFAULT_ALLOWED_ORIGINS = [COMPANION_PORT, WATCH_SIM_PORT].flatMap((port) => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
]);

/**
 * The local stand-in for the BLE link. It forwards each text frame from one role to every
 * client of the other role, verbatim. It does not parse, store or log frame contents.
 */
export function startRelay(options: RelayOptions = {}): Promise<RelayServer> {
  const host = options.host ?? RELAY_HOST;
  const allowed = new Set(options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS);
  const log = options.log ?? (() => {});
  const clients: Record<Role, Set<WebSocket>> = { companion: new Set(), watch: new Set() };

  const wss = new WebSocketServer({
    host,
    port: options.port ?? RELAY_PORT,
    maxPayload: MAX_FRAME_BYTES,
    verifyClient: (info: { origin?: string }) => !info.origin || allowed.has(info.origin),
  });

  const announce = (role: Role, connected: boolean) => {
    const event: RelayPeerEvent = { relay: 1, event: "peer", role, connected, count: clients[role].size };
    const text = JSON.stringify(event);
    for (const peer of clients[oppositeRole(role)]) peer.send(text);
  };

  wss.on("connection", (ws, req) => {
    const role = new URL(req.url ?? "/", "http://relay").searchParams.get("role");
    if (role !== "companion" && role !== "watch") {
      ws.close(1008, "role must be companion or watch");
      return;
    }
    clients[role].add(ws);
    log(`${role} connected (${clients[role].size})`);

    const other = oppositeRole(role);
    const initial: RelayPeerEvent = { relay: 1, event: "peer", role: other, connected: clients[other].size > 0, count: clients[other].size };
    ws.send(JSON.stringify(initial));
    announce(role, true);

    ws.on("message", (data, isBinary) => {
      if (isBinary) return;
      const text = data.toString();
      for (const peer of clients[other]) peer.send(text);
    });
    ws.on("close", () => {
      clients[role].delete(ws);
      log(`${role} disconnected (${clients[role].size})`);
      announce(role, false);
    });
  });

  return new Promise((resolve, reject) => {
    wss.once("error", reject);
    wss.once("listening", () => {
      const address = wss.address();
      const port = typeof address === "object" && address ? address.port : (options.port ?? RELAY_PORT);
      resolve({
        port,
        close: () =>
          new Promise<void>((done) => {
            for (const set of Object.values(clients)) for (const ws of set) ws.terminate();
            wss.close(() => done());
          }),
      });
    });
  });
}
