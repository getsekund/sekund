import type { SignResponseEnvelope } from './envelope'

export interface TransportHandlers {
  /** Raw envelope as received; the watch state machine validates it. */
  onSignRequest(envelope: unknown): void
  /** Base58 address, or null when no wallet key exists. */
  getAddress(): string | null
}

/**
 * Watch side of the companion link (BLE on hardware, local transport in the
 * PoC). Swapped for the `protocol/` transport once it lands on main.
 */
export interface WatchTransport {
  readonly kind: 'stub' | 'local'
  start(handlers: TransportHandlers): void
  sendResponse(response: SignResponseEnvelope): void
  stop(): void
}
