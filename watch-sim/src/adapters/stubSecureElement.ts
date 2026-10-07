import { MAX_PIN_ATTEMPTS, type PinResult, type SecureElement, type SeProfile } from './secureElement'

const PROFILE_LIMITS: Record<SeProfile, number> = { TROPIC01: 4096, SE050E: 919 }

export const STUB_DEMO_PIN = '1234'

/**
 * In-page stand-in for `se-sim/`. Holds a non-extractable WebCrypto Ed25519
 * key, enforces the PIN session, the 3-strike wipe and single-use approve
 * tokens. It does not persist, run in a Worker or emit SE050E wire order.
 */
export class StubSecureElement implements SecureElement {
  readonly profile: SeProfile
  readonly maxMessageBytes: number
  private keys = new Map<number, CryptoKeyPair>()
  private pin: string
  private failures = 0
  private sessionOpen = false
  private usedTokens = new Set<string>()

  constructor(opts: { profile?: SeProfile; pin?: string } = {}) {
    this.profile = opts.profile ?? 'TROPIC01'
    this.maxMessageBytes = PROFILE_LIMITS[this.profile]
    this.pin = opts.pin ?? STUB_DEMO_PIN
  }

  async hasKey(slot: number): Promise<boolean> {
    return this.keys.has(slot)
  }

  async generateKey(slot: number): Promise<void> {
    const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, false, [
      'sign',
      'verify',
    ])) as CryptoKeyPair
    this.keys.set(slot, pair)
    this.failures = 0
    this.sessionOpen = false
  }

  async getPublicKey(slot: number): Promise<Uint8Array> {
    const pair = this.keys.get(slot)
    if (!pair) throw new Error('NO_KEY')
    return new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  }

  async verifyPin(pin: string): Promise<PinResult> {
    if (this.keys.size === 0) return { ok: false, attemptsLeft: 0, wiped: true }
    if (pin === this.pin) {
      this.failures = 0
      this.sessionOpen = true
      return { ok: true }
    }
    this.failures++
    this.sessionOpen = false
    const attemptsLeft = Math.max(0, MAX_PIN_ATTEMPTS - this.failures)
    if (attemptsLeft === 0) this.keys.clear()
    return { ok: false, attemptsLeft, wiped: attemptsLeft === 0 }
  }

  async eddsaSign(slot: number, message: Uint8Array, approveToken: string): Promise<Uint8Array> {
    const pair = this.keys.get(slot)
    if (!pair) throw new Error('NO_KEY')
    if (!this.sessionOpen) throw new Error('NO_SESSION')
    if (!approveToken || this.usedTokens.has(approveToken)) throw new Error('BAD_APPROVE_TOKEN')
    if (message.length > this.maxMessageBytes) throw new Error('TOO_LARGE')
    this.usedTokens.add(approveToken)
    const sig = await crypto.subtle.sign({ name: 'Ed25519' }, pair.privateKey, message as BufferSource)
    return new Uint8Array(sig)
  }

  async endSession(): Promise<void> {
    this.sessionOpen = false
  }

  /** Test helper: is a PIN session open? */
  get sessionIsOpen(): boolean {
    return this.sessionOpen
  }
}
