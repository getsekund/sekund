import { WebSocketServer, type WebSocket } from "ws";
import { COMPANION_PORT, MAX_FRAME_BYTES, RELAY_HOST, RELAY_PORT, WATCH_SIM_PORT } from "../constants.ts";
import { isPeerIdentity, isRoomId, type PeerIdentity } from "../identity.ts";
import { oppositeRole, type RelayControlEvent, type Role } from "../transport/types.ts";

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

interface Seat {
  ws: WebSocket;
  identity: PeerIdentity;
}

interface Room {
  companion: Seat | null;
  watch: Seat | null;
}

/**
 * Local stand-in for BLE. Rooms isolate demos: exactly one companion and one watch per room.
 * A second peer of the same role is rejected. Frames are forwarded only to the bound opposite
 * seat. The relay remains untrusted for payload content.
 */
export function startRelay(options: RelayOptions = {}): Promise<RelayServer> {
  const host = options.host ?? RELAY_HOST;
  const allowed = new Set(options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS);
  const log = options.log ?? (() => {});
  const rooms = new Map<string, Room>();

  const wss = new WebSocketServer({
    host,
    port: options.port ?? RELAY_PORT,
    maxPayload: MAX_FRAME_BYTES,
    verifyClient: (info: { origin?: string }) => !info.origin || allowed.has(info.origin),
  });

  const getRoom = (roomId: string): Room => {
    let room = rooms.get(roomId);
    if (!room) {
      room = { companion: null, watch: null };
      rooms.set(roomId, room);
    }
    return room;
  };

  const sendControl = (ws: WebSocket, event: RelayControlEvent) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(event));
  };

  const announce = (room: Room, roomId: string, role: Role, connected: boolean, peer?: PeerIdentity) => {
    const event: RelayControlEvent = {
      relay: 1,
      event: "peer",
      role,
      connected,
      count: connected ? 1 : 0,
      roomId,
      ...(peer ? { peer } : {}),
    };
    const other = room[oppositeRole(role)];
    if (other) sendControl(other.ws, event);
  };

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "/", "http://relay");
    const role = url.searchParams.get("role");
    const roomId = url.searchParams.get("room") ?? url.searchParams.get("roomId");
    const deviceId = url.searchParams.get("deviceId");
    const sessionId = url.searchParams.get("sessionId");
    const identityCandidate = { roomId, deviceId, sessionId };

    if (role !== "companion" && role !== "watch") {
      ws.close(1008, "role must be companion or watch");
      return;
    }
    if (!isRoomId(roomId) || !isPeerIdentity(identityCandidate)) {
      ws.close(1008, "room, deviceId and sessionId required");
      return;
    }
    const identity = identityCandidate as PeerIdentity;
    if (identity.roomId !== roomId) {
      ws.close(1008, "room mismatch");
      return;
    }

    const room = getRoom(roomId);
    if (room[role]) {
      const rejected: RelayControlEvent = {
        relay: 1,
        event: "rejected",
        role,
        roomId,
        reason: `room already has a ${role}`,
      };
      sendControl(ws, rejected);
      ws.close(1008, `room already has a ${role}`);
      log(`${role} rejected from room ${roomId}`);
      return;
    }

    const seat: Seat = { ws, identity };
    room[role] = seat;
    log(`${role} joined room ${roomId}`);

    const otherRole = oppositeRole(role);
    const other = room[otherRole];
    sendControl(ws, {
      relay: 1,
      event: "peer",
      role: otherRole,
      connected: !!other,
      count: other ? 1 : 0,
      roomId,
      ...(other ? { peer: other.identity } : {}),
    });
    announce(room, roomId, role, true, identity);

    ws.on("message", (data, isBinary) => {
      if (isBinary) return;
      const text = data.toString();
      if (text.length > MAX_FRAME_BYTES) return;
      const peer = room[otherRole];
      if (peer && peer.ws.readyState === peer.ws.OPEN) peer.ws.send(text);
    });

    ws.on("close", () => {
      if (room[role]?.ws === ws) {
        room[role] = null;
        announce(room, roomId, role, false);
        log(`${role} left room ${roomId}`);
        if (!room.companion && !room.watch) rooms.delete(roomId);
      }
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
            for (const room of rooms.values()) {
              room.companion?.ws.terminate();
              room.watch?.ws.terminate();
            }
            rooms.clear();
            wss.close(() => done());
          }),
      });
    });
  });
}
