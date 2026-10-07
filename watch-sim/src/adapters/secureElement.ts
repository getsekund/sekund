/**
 * Local copy of the SecureElement contract from spec v1.1 §5.6, made async
 * because the simulated SE runs behind a message boundary (Web Worker).
 * Replace with the interface exported from `protocol/` once it lands on main.
 */

export type SeProfile = 'TROPIC01' | 'SE050E'

export type PinResult =
  | { ok: true }
  | { ok: false; attemptsLeft: number; wiped: boolean }

export interface SecureElement {
  readonly profile: SeProfile
  readonly maxMessageBytes: number
  hasKey(slot: number): Promise<boolean>
  generateKey(slot: number): Promise<void>
  /** 32 bytes, RFC 8032 order (after the driver wrapper). */
  getPublicKey(slot: number): Promise<Uint8Array>
  /** Opens a PIN session; counts failures; wipes the key at 3. */
  verifyPin(pin: string): Promise<PinResult>
  /** Pure Ed25519 over the exact, unhashed message. 64 bytes R||S. */
  eddsaSign(slot: number, message: Uint8Array, approveToken: string): Promise<Uint8Array>
  /** Closes the PIN session (wrist-off, lock). */
  endSession(): Promise<void>
}

export const WALLET_SLOT = 0
export const MAX_PIN_ATTEMPTS = 3
