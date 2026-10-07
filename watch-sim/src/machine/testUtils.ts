import { base64Encode } from '@/adapters/base58'
import { PROTOCOL_VERSION, type SignRequestEnvelope } from '@/adapters/envelope'
import { buildSystemMessage } from '@/adapters/messageBuilder'

export const OWN_KEY = new Uint8Array(32).fill(7)
export const DEST_KEY = new Uint8Array(32).fill(9)
export const BLOCKHASH = new Uint8Array(32).fill(3)

let counter = 0

export function envelope(overrides: Partial<SignRequestEnvelope> & { bytes?: Uint8Array } = {}): SignRequestEnvelope {
  counter++
  const { bytes, ...rest } = overrides
  const message =
    bytes ?? buildSystemMessage({ from: OWN_KEY, to: DEST_KEY, blockhash: BLOCKHASH, lamports: 10_000_000n })
  return {
    version: PROTOCOL_VERSION,
    requestId: `req-${counter}`,
    nonce: `nonce-${counter}`,
    type: 'SIGN_TRANSACTION',
    network: 'devnet',
    message: base64Encode(message),
    expiresInMs: 52_000,
    lastValidBlockHeight: 0,
    ...rest,
  }
}
