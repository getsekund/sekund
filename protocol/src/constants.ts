/** Wire version 2 adds roomId, deviceId and sessionId on every application frame. */
export const PROTOCOL_VERSION = 2 as const;

export const NETWORK = "devnet" as const;

/** Low end of the documented ~60–90 s blockhash validity window (spec 5.5). */
export const BLOCKHASH_WINDOW_MS = 60_000;

/** Default time the companion keeps back for broadcast and confirmation (spec 5.5 step 2). */
export const DEFAULT_BROADCAST_MARGIN_MS = 8_000;

/** Largest `expiresInMs` the watch accepts. */
export const MAX_EXPIRES_IN_MS = BLOCKHASH_WINDOW_MS;

export const NONCE_BYTES = 16;

export const SIGNATURE_BYTES = 64;

export const PUBLIC_KEY_BYTES = 32;

export const RELAY_HOST = "127.0.0.1";
export const RELAY_PORT = 4319;
export const RELAY_URL = `ws://${RELAY_HOST}:${RELAY_PORT}`;

/** Any frame larger than this is dropped by the relay and refused by the clients. */
export const MAX_FRAME_BYTES = 16 * 1024;

export const COMPANION_PORT = 4317;
export const WATCH_SIM_PORT = 4318;
