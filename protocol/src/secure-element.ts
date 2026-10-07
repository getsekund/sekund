/**
 * The secure element interface from spec section 5.6. The simulated SE (se-sim/) and the
 * future hardware driver implement the same contract, so the hardware swap replaces only
 * the driver. Methods are async because the PoC SE lives in a Web Worker and the hardware
 * SE sits behind SPI/I2C.
 *
 * Everything returned here is in RFC 8032 little-endian byte order: the `seDriver` wrapper
 * is the only place that converts from a profile's wire byte order.
 */

export type SeProfile = "TROPIC01" | "SE050E";

export const MAX_MESSAGE_BYTES: Readonly<Record<SeProfile, number>> = {
  TROPIC01: 4096,
  SE050E: 919,
};

/** Wallet key slot. The PoC uses one slot. */
export const WALLET_SLOT = 0;

export const PIN_LENGTH = 4;
export const MAX_PIN_ATTEMPTS = 3;

export type PinResult =
  | { status: "OK" }
  | { status: "WRONG_PIN"; attemptsRemaining: number }
  /** The third wrong PIN: the key and PIN were erased. The SE is back in factory state. */
  | { status: "WIPED" }
  /** No PIN has been set (factory state). */
  | { status: "NO_PIN" };

export interface SeState {
  profile: SeProfile;
  maxMessageBytes: number;
  hasPin: boolean;
  hasKey: boolean;
  sessionOpen: boolean;
  attemptsRemaining: number;
}

/**
 * One-time approval capability. Opaque to the caller. Issued by the SE only inside a PIN
 * session, bound to one slot and to the exact message bytes, valid for one `eddsaSign`
 * call within `APPROVE_TOKEN_TTL_MS`.
 */
export type ApproveToken = string;

export const APPROVE_TOKEN_TTL_MS = 5_000;

export type SeErrorCode =
  | "NO_SESSION"
  | "NO_PIN"
  | "PIN_ALREADY_SET"
  | "NO_KEY"
  | "KEY_EXISTS"
  | "TOO_LARGE"
  | "BAD_TOKEN"
  | "INVALID_ARGUMENT"
  | "NOT_ALLOWED"
  | "INTERNAL";

export class SeError extends Error {
  readonly code: SeErrorCode;
  constructor(code: SeErrorCode, message?: string) {
    super(message ?? code);
    this.name = "SeError";
    this.code = code;
  }
}

export interface SecureElement {
  readonly profile: SeProfile;
  /** 4096 (TROPIC01) or 919 (SE050E in a PIN session). */
  readonly maxMessageBytes: number;

  getState(): Promise<SeState>;

  /** Factory state only. Sets the 4-digit PIN and opens a session. */
  setPin(pin: string): Promise<void>;

  /** Generates the Ed25519 key inside the SE. Requires an open session and an empty slot. */
  generateKey(slot: number): Promise<void>;

  /** 32 bytes, RFC 8032 order (after the driver wrapper). */
  getPublicKey(slot: number): Promise<Uint8Array>;

  /** Opens a session on success; counts failures; wipes the key and PIN on the third failure. */
  verifyPin(pin: string): Promise<PinResult>;

  /** Closes the PIN session (wrist-off, lock, timeout). Outstanding approve tokens are revoked. */
  endSession(): Promise<void>;

  /**
   * Called by the watch state machine only when the user physically presses APPROVE on a
   * request that is on screen and not expired. Binds the token to these exact bytes.
   */
  issueApproveToken(slot: number, message: Uint8Array): Promise<ApproveToken>;

  /**
   * Pure Ed25519 (RFC 8032 section 5.1) over the exact, unhashed message bytes.
   * Requires an open session and a fresh token bound to the same slot and bytes.
   * Returns 64 bytes R||S in RFC 8032 order.
   */
  eddsaSign(slot: number, message: Uint8Array, approveToken: ApproveToken): Promise<Uint8Array>;
}
