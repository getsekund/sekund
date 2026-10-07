/**
 * Request/response envelope from spec v1.1 §8.1. Local until `protocol/`
 * publishes the wire format in docs/PROTOCOL.md.
 */

export const PROTOCOL_VERSION = 1

export interface SignRequestEnvelope {
  version: number
  requestId: string
  nonce: string
  type: 'SIGN_TRANSACTION'
  network: 'devnet'
  /** base64 serialized message bytes */
  message: string
  expiresInMs: number
  lastValidBlockHeight: number
}

export type ResponseStatus =
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'TOO_LARGE'
  | 'UNSUPPORTED'
  | 'LOCKED'

export interface SignResponseEnvelope {
  version: number
  requestId: string
  status: ResponseStatus
  /** base58, 64 bytes; only when APPROVED */
  signature?: string
}
