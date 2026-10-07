import { base58Decode, base58Encode, base64Decode, base64Encode } from './base58'
import { PROTOCOL_VERSION, type SignRequestEnvelope, type SignResponseEnvelope } from './envelope'
import { buildSystemMessage, randomBytes } from './messageBuilder'
import type { TransportHandlers, WatchTransport } from './transport'

export type StubRequestKind = 'transfer' | 'short-expiry' | 'oversize' | 'nonce' | 'replay'

export interface StubLogEntry {
  id: string
  at: number
  requestId: string
  kind: StubRequestKind
  status: SignResponseEnvelope['status'] | 'SENT'
  signature?: string
  verified?: boolean
}

/** A fixed devnet destination for the demo transfer. */
export const DEMO_DESTINATION = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
export const DEMO_LAMPORTS = 10_000_000n

/**
 * In-page stand-in for the companion app. It plays the companion's role
 * against the watch: builds a transfer, sends the envelope, verifies the
 * returned signature. It never broadcasts.
 */
export class StubTransport implements WatchTransport {
  readonly kind = 'stub' as const
  private handlers: TransportHandlers | null = null
  private pending = new Map<string, { kind: StubRequestKind; message: Uint8Array }>()
  private lastEnvelope: SignRequestEnvelope | null = null
  private listeners = new Set<() => void>()
  log: StubLogEntry[] = []

  start(handlers: TransportHandlers): void {
    this.handlers = handlers
  }

  stop(): void {
    this.handlers = null
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    this.log = [...this.log]
    for (const fn of this.listeners) fn()
  }

  sendResponse(response: SignResponseEnvelope): void {
    const sent = this.pending.get(response.requestId)
    this.pending.delete(response.requestId)
    const entry: StubLogEntry = {
      id: `${response.requestId}:${response.status}`,
      at: Date.now(),
      requestId: response.requestId,
      kind: sent?.kind ?? 'transfer',
      status: response.status,
      signature: response.signature,
    }
    this.log = [entry, ...this.log].slice(0, 12)
    this.emit()
    if (response.signature && sent) void this.verify(entry, sent.message)
  }

  private async verify(entry: StubLogEntry, message: Uint8Array): Promise<void> {
    const address = this.handlers?.getAddress()
    if (!address || !entry.signature) return
    try {
      const key = await crypto.subtle.importKey('raw', base58Decode(address) as BufferSource, { name: 'Ed25519' }, false, ['verify'])
      entry.verified = await crypto.subtle.verify(
        { name: 'Ed25519' },
        key,
        base58Decode(entry.signature) as BufferSource,
        message as BufferSource,
      )
    } catch {
      entry.verified = false
    }
    this.emit()
  }

  send(kind: StubRequestKind): void {
    if (!this.handlers) return
    if (kind === 'replay') {
      if (!this.lastEnvelope) return
      this.handlers.onSignRequest({ ...this.lastEnvelope })
      this.pending.set(this.lastEnvelope.requestId, {
        kind,
        message: base64Decode(this.lastEnvelope.message),
      })
      return
    }

    const address = this.handlers.getAddress()
    const from = address ? base58Decode(address) : randomBytes(32)
    const message = buildSystemMessage({
      from,
      to: base58Decode(DEMO_DESTINATION),
      blockhash: randomBytes(32),
      lamports: DEMO_LAMPORTS,
      ixType: kind === 'nonce' ? 4 : 2,
      padData: kind === 'oversize' ? 5000 : 0,
    })
    const envelope: SignRequestEnvelope = {
      version: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(),
      nonce: base58Encode(randomBytes(16)),
      type: 'SIGN_TRANSACTION',
      network: 'devnet',
      message: base64Encode(message),
      expiresInMs: kind === 'short-expiry' ? 12_000 : 52_000,
      lastValidBlockHeight: 0,
    }
    this.lastEnvelope = envelope
    this.pending.set(envelope.requestId, { kind, message })
    this.log = [
      { id: `${envelope.requestId}:SENT`, at: Date.now(), requestId: envelope.requestId, kind, status: 'SENT' as const },
      ...this.log,
    ].slice(0, 12)
    this.emit()
    this.handlers.onSignRequest(envelope)
  }
}
