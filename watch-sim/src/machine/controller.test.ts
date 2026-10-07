import { describe, expect, it } from 'vitest'
import { base58Decode, base58Encode, base64Encode } from '@/adapters/base58'
import { PROTOCOL_VERSION, type SignResponseEnvelope } from '@/adapters/envelope'
import { buildSystemMessage } from '@/adapters/messageBuilder'
import { STUB_DEMO_PIN, StubSecureElement } from '@/adapters/stubSecureElement'
import type { TransportHandlers, WatchTransport } from '@/adapters/transport'
import { WatchController } from './controller'
import { type Button, gesture } from './gestures'
import { REVIEW_PAGES } from './machine'
import { BLOCKHASH, DEST_KEY } from './testUtils'

class MemoryTransport implements WatchTransport {
  readonly kind = 'local' as const
  handlers: TransportHandlers | null = null
  responses: SignResponseEnvelope[] = []
  start(h: TransportHandlers) {
    this.handlers = h
  }
  sendResponse(r: SignResponseEnvelope) {
    this.responses.push(r)
  }
  stop() {}
}

async function setup() {
  let now = 5_000_000
  const se = new StubSecureElement()
  const transport = new MemoryTransport()
  const watch = new WatchController({ se, transport, clock: () => now })
  await watch.boot()
  const press = (...b: Button[]) => watch.press(gesture(...b))
  const enterPin = async (pin: string) => {
    press('A', 'D')
    for (const ch of pin) {
      for (let i = 0; i < Number(ch); i++) press('B')
      press('C', 'D')
    }
    await watch.settle()
  }
  const send = (requestId: string, expiresInMs = 52_000) => {
    const message = buildSystemMessage({
      from: base58Decode(watch.address!),
      to: DEST_KEY,
      blockhash: BLOCKHASH,
      lamports: 25_000_000n,
    })
    transport.handlers!.onSignRequest({
      version: PROTOCOL_VERSION,
      requestId,
      nonce: `n-${requestId}`,
      type: 'SIGN_TRANSACTION',
      network: 'devnet',
      message: base64Encode(message),
      expiresInMs,
      lastValidBlockHeight: 0,
    })
    return message
  }
  return { se, transport, watch, press, enterPin, send, advance: (ms: number) => (now += ms) }
}

describe('WatchController with the stub secure element', () => {
  it('approve inside a PIN session returns a signature that verifies against message and address', async () => {
    const { watch, transport, press, enterPin, send } = await setup()
    await enterPin(STUB_DEMO_PIN)
    expect(watch.state.session).toBe(true)
    const message = send('r1')
    for (let i = 0; i < REVIEW_PAGES.length; i++) press('B')
    press('D')
    await watch.settle()

    const res = transport.responses.at(-1)!
    expect(res.status).toBe('APPROVED')
    const key = await crypto.subtle.importKey('raw', base58Decode(watch.address!) as BufferSource, 'Ed25519', false, ['verify'])
    const ok = await crypto.subtle.verify('Ed25519', key, base58Decode(res.signature!) as BufferSource, message as BufferSource)
    expect(ok).toBe(true)
  })

  it('reject produces no signature', async () => {
    const { watch, transport, press, enterPin, send } = await setup()
    await enterPin(STUB_DEMO_PIN)
    send('r2')
    press('C')
    await watch.settle()
    expect(transport.responses).toEqual([{ version: 1, requestId: 'r2', status: 'REJECTED' }])
  })

  it('three wrong PINs wipe the simulated key', async () => {
    const { watch, se, enterPin } = await setup()
    for (let i = 0; i < 3; i++) await enterPin('0000')
    expect(watch.state.wiped).toBe(true)
    expect(watch.address).toBeNull()
    expect(await se.hasKey(0)).toBe(false)
    await watch.resetWallet()
    expect(watch.state.wiped).toBe(false)
    expect(watch.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
  })

  it('wrist-off closes the SE session', async () => {
    const { watch, se, enterPin } = await setup()
    await enterPin(STUB_DEMO_PIN)
    expect(se.sessionIsOpen).toBe(true)
    watch.setWrist(false)
    await watch.settle()
    expect(se.sessionIsOpen).toBe(false)
    expect(watch.state.screen.kind).toBe('normal')
  })

  it('expiry auto-rejects without signing', async () => {
    const { watch, transport, enterPin, send, advance } = await setup()
    await enterPin(STUB_DEMO_PIN)
    send('r3', 4_000)
    advance(4_000)
    watch.tick()
    await watch.settle()
    expect(transport.responses).toEqual([{ version: 1, requestId: 'r3', status: 'EXPIRED' }])
  })

  it('the stub SE refuses to sign without a session or with a reused token', async () => {
    const se = new StubSecureElement()
    await se.generateKey(0)
    const msg = new Uint8Array([1, 2, 3])
    await expect(se.eddsaSign(0, msg, 't1')).rejects.toThrow('NO_SESSION')
    await se.verifyPin(STUB_DEMO_PIN)
    await se.eddsaSign(0, msg, 't1')
    await expect(se.eddsaSign(0, msg, 't1')).rejects.toThrow('BAD_APPROVE_TOKEN')
  })
})

describe('base58', () => {
  it('round-trips, including leading zeros', () => {
    const bytes = new Uint8Array([0, 0, 1, 2, 255, 128])
    expect(base58Decode(base58Encode(bytes))).toEqual(bytes)
    expect(base58Encode(new Uint8Array(32))).toBe('11111111111111111111111111111111')
  })
})
