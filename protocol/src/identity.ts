import { randomBytes } from "./encoding.ts";

/** Default room for local demo when neither URL nor storage sets one. */
export const DEFAULT_ROOM_ID = "sekund-demo";

/** Room ids: short, shareable, no spaces. */
const ROOM_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface PeerIdentity {
  roomId: string;
  /** Stable per browser origin (persisted). */
  deviceId: string;
  /** Fresh per relay connection (and watch unlock epoch when reissued). */
  sessionId: string;
}

export function isRoomId(value: unknown): value is string {
  return typeof value === "string" && ROOM_ID.test(value);
}

export function isIdentityId(value: unknown): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}

export function isPeerIdentity(value: unknown): value is PeerIdentity {
  if (!value || typeof value !== "object") return false;
  const v = value as PeerIdentity;
  return isRoomId(v.roomId) && isIdentityId(v.deviceId) && isIdentityId(v.sessionId);
}

/** Prefer `?room=` / `?roomId=`, then stored preference, then the demo default. */
export function resolveRoomId(search = "", stored: string | null | undefined = null): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const fromUrl = params.get("room") ?? params.get("roomId");
  if (fromUrl && isRoomId(fromUrl)) return fromUrl;
  if (stored && isRoomId(stored)) return stored;
  return DEFAULT_ROOM_ID;
}

export function newDeviceId(): string {
  return crypto.randomUUID();
}

export function newSessionId(): string {
  return crypto.randomUUID();
}

/** Deterministic-looking but random device id for Node tests without crypto.randomUUID polyfill issues. */
export function newOpaqueId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function identitiesEqual(a: PeerIdentity, b: PeerIdentity): boolean {
  return a.roomId === b.roomId && a.deviceId === b.deviceId && a.sessionId === b.sessionId;
}

/** Short label for UI (not a secret; rooms are isolation, not auth). */
export function roomLabel(roomId: string): string {
  return roomId;
}

/** Storage keys shared by the two apps (each origin has its own localStorage). */
export const STORAGE_DEVICE_ID = "sekund-device-id";
export const STORAGE_ROOM_ID = "sekund-room-id";

export function loadOrCreateDeviceId(storage: Pick<Storage, "getItem" | "setItem">): string {
  const existing = storage.getItem(STORAGE_DEVICE_ID);
  if (existing && isIdentityId(existing)) return existing;
  const id = newDeviceId();
  storage.setItem(STORAGE_DEVICE_ID, id);
  return id;
}

export function loadStoredRoomId(storage: Pick<Storage, "getItem">): string | null {
  return storage.getItem(STORAGE_ROOM_ID);
}

export function storeRoomId(storage: Pick<Storage, "setItem">, roomId: string): void {
  if (isRoomId(roomId)) storage.setItem(STORAGE_ROOM_ID, roomId);
}

/** Build a PeerIdentity for this process. */
export function createPeerIdentity(roomId: string, deviceId?: string, sessionId?: string): PeerIdentity {
  if (!isRoomId(roomId)) throw new Error(`invalid roomId: ${roomId}`);
  return {
    roomId,
    deviceId: deviceId && isIdentityId(deviceId) ? deviceId : newOpaqueId(),
    sessionId: sessionId && isIdentityId(sessionId) ? sessionId : newOpaqueId(),
  };
}

/** Test helper: stable demo identity (not for production). */
export function demoIdentity(role: "companion" | "watch", roomId = DEFAULT_ROOM_ID): PeerIdentity {
  // Fixed UUIDs so unit tests stay readable; still valid v4 shape.
  const device =
    role === "watch" ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" : "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const session =
    role === "watch" ? "cccccccc-cccc-4ccc-8ccc-cccccccccccc" : "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  return { roomId, deviceId: device, sessionId: session };
}
