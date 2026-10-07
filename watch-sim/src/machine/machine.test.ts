import { describe, expect, it } from 'vitest'
import { buildSystemMessage } from '@/adapters/messageBuilder'
import { gesture, type Button } from './gestures'
import {
  type Effect,
  initialState,
  REVIEW_PAGES,
  secondsLeft,
  transition,
  type WatchEvent,
  type WatchState,
} from './machine'
import { BLOCKHASH, DEST_KEY, envelope, OWN_KEY } from './testUtils'

let tokenCounter = 0
const deps = { newToken: () => `token-${++tokenCounter}` }

/** Small driver: feeds events and collects effects. */
class Harness {
  state: WatchState
  effects: Effect[] = []
  now = 1_000_000

  constructor() {
    this.state = initialState({}, this.now)
    this.send({ type: 'KEY_READY', address: OWN_KEY })
  }

  send(event: WatchEvent): Effect[] {
    const t = transition(this.state, event, deps)
    this.state = t.state
    this.effects.push(...t.effects)
    return t.effects
  }

  press(...buttons: Button[]): Effect[] {
    return this.send({ type: 'GESTURE', buttons: gesture(...buttons), now: this.now })
  }

  advance(ms: number): Effect[] {
    this.now += ms
    return this.send({ type: 'TICK', now: this.now })
  }

  enterPin(pin: string): Effect[] {
    const out: Effect[] = []
    for (const ch of pin) {
      for (let i = 0; i < Number(ch); i++) out.push(...this.press('B'))
      out.push(...this.press('C', 'D'))
    }
    return out
  }

  unlock(): void {
    this.press('A', 'D')
    this.enterPin('1234')
    this.send({ type: 'PIN_RESULT', result: { ok: true }, now: this.now })
  }

  request(overrides: Parameters<typeof envelope>[0] = {}): Effect[] {
    return this.send({ type: 'REQUEST', envelope: envelope(overrides), now: this.now })
  }

  responses() {
    return this.effects.flatMap((e) => (e.type === 'respond' ? [e.response] : []))
  }

  toApprovePage(): void {
    for (let i = 0; i < REVIEW_PAGES.length; i++) this.press('B')
  }
}

describe('hidden combination', () => {
  it('enters Secure Mode (PIN) only with the configured combination', () => {
    const h = new Harness()
    h.press('A')
    h.press('B')
    h.press('C', 'D')
    h.press('A', 'B')
    expect(h.state.screen.kind).toBe('normal')
    h.press('A', 'D')
    expect(h.state.screen).toEqual({ kind: 'pin', digits: [], current: 0, wrong: false })
  })

  it('single buttons keep normal watch behaviour', () => {
    const h = new Harness()
    h.press('A')
    expect(h.state.lightUntil).toBeGreaterThan(h.now)
    h.press('B')
    expect(h.state.hour12).toBe(true)
  })

  it('is ignored while the watch is off the wrist', () => {
    const h = new Harness()
    h.send({ type: 'WRIST', on: false, now: h.now })
    h.press('A', 'D')
    expect(h.state.screen.kind).toBe('normal')
  })
})

describe('PIN entry', () => {
  it('A/B change the digit with wrap-around, C+D confirms, C steps back', () => {
    const h = new Harness()
    h.press('A', 'D')
    h.press('A')
    expect(h.state.screen).toMatchObject({ current: 9 })
    h.press('B')
    h.press('B')
    expect(h.state.screen).toMatchObject({ current: 1 })
    h.press('C', 'D')
    expect(h.state.screen).toMatchObject({ digits: [1], current: 0 })
    h.press('C')
    expect(h.state.screen).toMatchObject({ digits: [], current: 1 })
    h.press('C')
    expect(h.state.screen.kind).toBe('normal')
  })

  it('submits the PIN to the SE after the last digit and opens the menu on success', () => {
    const h = new Harness()
    h.press('A', 'D')
    const effects = h.enterPin('1234')
    expect(effects).toContainEqual({ type: 'verifyPin', pin: '1234' })
    expect(h.state.screen.kind).toBe('verifying')
    h.press('A')
    expect(h.state.screen.kind).toBe('verifying')
    h.send({ type: 'PIN_RESULT', result: { ok: true }, now: h.now })
    expect(h.state.session).toBe(true)
    expect(h.state.screen).toMatchObject({ kind: 'menu', index: 0 })
  })

  it('counts wrong PINs and wipes the key on the third', () => {
    const h = new Harness()
    h.press('A', 'D')
    h.enterPin('0000')
    h.send({ type: 'PIN_RESULT', result: { ok: false, attemptsLeft: 2, wiped: false }, now: h.now })
    expect(h.state.screen).toMatchObject({ kind: 'pin', wrong: true, digits: [] })
    expect(h.state.attemptsLeft).toBe(2)
    h.enterPin('0000')
    h.send({ type: 'PIN_RESULT', result: { ok: false, attemptsLeft: 1, wiped: false }, now: h.now })
    h.request()
    h.enterPin('0000')
    h.send({ type: 'PIN_RESULT', result: { ok: false, attemptsLeft: 0, wiped: true }, now: h.now })
    expect(h.state.screen.kind).toBe('wiped')
    expect(h.state.wiped).toBe(true)
    expect(h.state.address).toBeNull()
    expect(h.state.session).toBe(false)
    expect(h.responses().at(-1)?.status).toBe('LOCKED')
  })

  it('stays locked after a wipe: no PIN screen, requests answered LOCKED', () => {
    const h = new Harness()
    h.press('A', 'D')
    h.enterPin('0000')
    h.send({ type: 'PIN_RESULT', result: { ok: false, attemptsLeft: 0, wiped: true }, now: h.now })
    h.press('C')
    expect(h.state.screen.kind).toBe('normal')
    h.press('A', 'D')
    expect(h.state.screen.kind).toBe('wiped')
    h.request()
    expect(h.responses().at(-1)?.status).toBe('LOCKED')
    expect(h.state.request).toBeNull()
  })
})

describe('review, approve and reject', () => {
  it('switches to review when a request arrives in a live session', () => {
    const h = new Harness()
    h.unlock()
    h.request()
    expect(h.state.screen).toEqual({ kind: 'review', page: 0 })
    expect(h.state.request?.transfer.lamports).toBe(10_000_000n)
    expect([...h.state.request!.transfer.to]).toEqual([...DEST_KEY])
    expect(secondsLeft(h.state)).toBe(52)
  })

  it('approve is only possible from the last page and signs the exact bytes', () => {
    const h = new Harness()
    h.unlock()
    const env = envelope()
    h.send({ type: 'REQUEST', envelope: env, now: h.now })
    const message = h.state.request!.message
    h.press('D')
    expect(h.state.screen.kind).toBe('review')
    h.toApprovePage()
    const effects = h.press('D')
    const sign = effects.find((e) => e.type === 'sign')
    expect(sign).toBeDefined()
    expect(sign).toMatchObject({ requestId: env.requestId })
    expect(sign!.type === 'sign' && sign!.message).toBe(message)
    expect(Buffer.from(message).toString('base64')).toBe(env.message)
    expect(h.state.screen.kind).toBe('signing')
    expect(h.state.request).toBeNull()

    h.send({ type: 'SIGNED', requestId: env.requestId, signature: new Uint8Array(64).fill(1) })
    const res = h.responses().at(-1)!
    expect(res.status).toBe('APPROVED')
    expect(res.signature).toBeTypeOf('string')
    expect(h.state.screen).toMatchObject({ kind: 'result', status: 'APPROVED' })
  })

  it('issues a fresh approve token for every approval', () => {
    const h = new Harness()
    h.unlock()
    const tokens: string[] = []
    for (let i = 0; i < 2; i++) {
      const env = envelope()
      h.send({ type: 'REQUEST', envelope: env, now: h.now })
      h.toApprovePage()
      const sign = h.press('D').find((e) => e.type === 'sign')
      if (sign?.type === 'sign') tokens.push(sign.token)
      h.send({ type: 'SIGNED', requestId: env.requestId, signature: new Uint8Array(64) })
      h.press('D')
    }
    expect(tokens).toHaveLength(2)
    expect(new Set(tokens).size).toBe(2)
  })

  it('reject returns REJECTED with no signature and never asks the SE to sign', () => {
    const h = new Harness()
    h.unlock()
    h.request()
    h.press('B')
    h.press('C')
    const res = h.responses().at(-1)!
    expect(res.status).toBe('REJECTED')
    expect(res.signature).toBeUndefined()
    expect(h.effects.some((e) => e.type === 'sign')).toBe(false)
    expect(h.state.screen).toMatchObject({ kind: 'result', status: 'REJECTED' })
    h.press('D')
    expect(h.state.screen.kind).toBe('menu')
  })

  it('a late signature for another request is ignored', () => {
    const h = new Harness()
    h.unlock()
    h.request()
    h.send({ type: 'SIGNED', requestId: 'someone-else', signature: new Uint8Array(64) })
    expect(h.responses()).toHaveLength(0)
  })
})

describe('expiry', () => {
  it('auto-rejects at zero with EXPIRED and no signature', () => {
    const h = new Harness()
    h.unlock()
    h.request({ expiresInMs: 10_000 })
    h.advance(9_000)
    expect(secondsLeft(h.state)).toBe(1)
    expect(h.state.screen.kind).toBe('review')
    h.advance(1_000)
    const res = h.responses().at(-1)!
    expect(res.status).toBe('EXPIRED')
    expect(res.signature).toBeUndefined()
    expect(h.state.request).toBeNull()
    expect(h.state.screen).toMatchObject({ kind: 'result', status: 'EXPIRED' })
  })

  it('approve after the deadline does not sign, even without a tick in between', () => {
    const h = new Harness()
    h.unlock()
    h.request({ expiresInMs: 5_000 })
    h.toApprovePage()
    h.now += 5_000
    const effects = h.press('D')
    expect(effects.some((e) => e.type === 'sign')).toBe(false)
    expect(h.responses().at(-1)?.status).toBe('EXPIRED')
  })

  it('a request expires while the watch is locked too', () => {
    const h = new Harness()
    h.request({ expiresInMs: 3_000 })
    expect(h.state.screen.kind).toBe('normal')
    h.advance(3_000)
    expect(h.responses().at(-1)?.status).toBe('EXPIRED')
  })

  it('caps the review window and refuses non-positive expiry', () => {
    const h = new Harness()
    h.unlock()
    h.request({ expiresInMs: 10 * 60_000 })
    expect(secondsLeft(h.state)).toBe(90)
    h.press('C')
    h.press('D')
    h.request({ expiresInMs: 0 })
    expect(h.responses().at(-1)?.status).toBe('EXPIRED')
  })
})

describe('wrist toggle', () => {
  it('off-wrist ends the session immediately, from any secure screen', () => {
    const h = new Harness()
    h.unlock()
    h.request()
    expect(h.state.screen.kind).toBe('review')
    const effects = h.send({ type: 'WRIST', on: false, now: h.now })
    expect(effects).toContainEqual({ type: 'endSession' })
    expect(h.state.session).toBe(false)
    expect(h.state.screen.kind).toBe('normal')
  })

  it('requires the PIN again before a pending request can be approved', () => {
    const h = new Harness()
    h.unlock()
    h.request()
    h.send({ type: 'WRIST', on: false, now: h.now })
    h.press('D')
    expect(h.effects.some((e) => e.type === 'sign')).toBe(false)
    h.send({ type: 'WRIST', on: true, now: h.now })
    h.press('A', 'D')
    expect(h.state.screen.kind).toBe('pin')
    h.enterPin('1234')
    h.send({ type: 'PIN_RESULT', result: { ok: true }, now: h.now })
    expect(h.state.screen).toEqual({ kind: 'review', page: 0 })
  })

  it('a PIN result that lands after wrist-off does not open the session', () => {
    const h = new Harness()
    h.press('A', 'D')
    h.enterPin('1234')
    h.send({ type: 'WRIST', on: false, now: h.now })
    const effects = h.send({ type: 'PIN_RESULT', result: { ok: true }, now: h.now })
    expect(h.state.session).toBe(false)
    expect(effects).toContainEqual({ type: 'endSession' })
  })

  it('off-wrist during PIN entry discards the digits', () => {
    const h = new Harness()
    h.press('A', 'D')
    h.press('B')
    h.press('C', 'D')
    h.send({ type: 'WRIST', on: false, now: h.now })
    h.send({ type: 'WRIST', on: true, now: h.now })
    h.press('A', 'D')
    expect(h.state.screen).toEqual({ kind: 'pin', digits: [], current: 0, wrong: false })
  })
})

describe('request validation', () => {
  it('refuses a replayed requestId or nonce', () => {
    const h = new Harness()
    h.unlock()
    const env = envelope()
    h.send({ type: 'REQUEST', envelope: env, now: h.now })
    h.press('C')
    h.press('D')
    h.send({ type: 'REQUEST', envelope: { ...env }, now: h.now })
    expect(h.state.request).toBeNull()
    expect(h.responses().at(-1)).toMatchObject({ requestId: env.requestId, status: 'REJECTED' })
    h.send({ type: 'REQUEST', envelope: { ...envelope(), nonce: env.nonce }, now: h.now })
    expect(h.state.request).toBeNull()
  })

  it('refuses oversize messages before display', () => {
    const h = new Harness()
    h.unlock()
    const bytes = buildSystemMessage({ from: OWN_KEY, to: DEST_KEY, blockhash: BLOCKHASH, padData: 5000 })
    h.request({ bytes })
    expect(h.responses().at(-1)?.status).toBe('TOO_LARGE')
    expect(h.state.request).toBeNull()
    expect(h.state.screen.kind).toBe('menu')
  })

  it('applies the SE050E cap when configured', () => {
    const h = new Harness()
    h.state = { ...h.state, config: { ...h.state.config, maxMessageBytes: 919 } }
    const bytes = buildSystemMessage({ from: OWN_KEY, to: DEST_KEY, blockhash: BLOCKHASH, padData: 800 })
    expect(bytes.length).toBeGreaterThan(919)
    h.request({ bytes })
    expect(h.responses().at(-1)?.status).toBe('TOO_LARGE')
  })

  it('refuses durable-nonce, foreign-wallet and wrong-network requests', () => {
    const h = new Harness()
    h.unlock()
    h.request({ bytes: buildSystemMessage({ from: OWN_KEY, to: DEST_KEY, blockhash: BLOCKHASH, ixType: 4 }) })
    h.request({ bytes: buildSystemMessage({ from: DEST_KEY, to: OWN_KEY, blockhash: BLOCKHASH }) })
    h.send({ type: 'REQUEST', envelope: { ...envelope(), network: 'mainnet-beta' }, now: h.now })
    h.send({ type: 'REQUEST', envelope: { ...envelope(), version: 2 }, now: h.now })
    expect(h.responses().map((r) => r.status)).toEqual(['UNSUPPORTED', 'UNSUPPORTED', 'UNSUPPORTED', 'UNSUPPORTED'])
    expect(h.state.request).toBeNull()
  })

  it('refuses a second request while one is under review', () => {
    const h = new Harness()
    h.unlock()
    h.request()
    const first = h.state.request!.requestId
    h.request()
    expect(h.state.request!.requestId).toBe(first)
    expect(h.responses().at(-1)?.status).toBe('REJECTED')
  })
})
