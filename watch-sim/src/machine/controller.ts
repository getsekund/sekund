import { base58Encode } from '@/adapters/base58'
import { type SecureElement, WALLET_SLOT } from '@/adapters/secureElement'
import type { WatchTransport } from '@/adapters/transport'
import type { Gesture } from './gestures'
import {
  type Deps,
  type Effect,
  initialState,
  type MachineConfig,
  transition,
  type WatchEvent,
  type WatchState,
} from './machine'

export interface ControllerOptions {
  se: SecureElement
  transport: WatchTransport
  config?: Partial<MachineConfig>
  clock?: () => number
  deps?: Deps
}

/** Binds the pure state machine to the secure element and the transport. */
export class WatchController {
  private stateValue: WatchState
  private readonly listeners = new Set<() => void>()
  private readonly inflight = new Set<Promise<unknown>>()
  private readonly se: SecureElement
  private readonly transport: WatchTransport
  private readonly clock: () => number
  private readonly deps: Deps
  private addressText: string | null = null

  constructor(opts: ControllerOptions) {
    this.se = opts.se
    this.transport = opts.transport
    this.clock = opts.clock ?? Date.now
    this.deps = opts.deps ?? { newToken: () => crypto.randomUUID() }
    this.stateValue = initialState(
      { maxMessageBytes: opts.se.maxMessageBytes, ...opts.config },
      this.clock(),
    )
  }

  get state(): WatchState {
    return this.stateValue
  }

  get address(): string | null {
    return this.addressText
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = (): WatchState => this.stateValue

  async boot(): Promise<void> {
    this.transport.start({
      onSignRequest: (envelope) => this.dispatch({ type: 'REQUEST', envelope, now: this.clock() }),
      getAddress: () => this.addressText,
    })
    if (!(await this.se.hasKey(WALLET_SLOT))) await this.se.generateKey(WALLET_SLOT)
    await this.loadKey()
  }

  async resetWallet(): Promise<void> {
    await this.se.generateKey(WALLET_SLOT)
    await this.loadKey()
  }

  private async loadKey(): Promise<void> {
    const address = await this.se.getPublicKey(WALLET_SLOT)
    this.addressText = base58Encode(address)
    this.dispatch({ type: 'KEY_READY', address })
  }

  press(buttons: Gesture): void {
    this.dispatch({ type: 'GESTURE', buttons, now: this.clock() })
  }

  tick(): void {
    this.dispatch({ type: 'TICK', now: this.clock() })
  }

  setWrist(on: boolean): void {
    this.dispatch({ type: 'WRIST', on, now: this.clock() })
  }

  dispatch(event: WatchEvent): void {
    const { state, effects } = transition(this.stateValue, event, this.deps)
    if (!state.address) this.addressText = null
    const changed = state !== this.stateValue
    this.stateValue = state
    if (changed) for (const fn of this.listeners) fn()
    for (const effect of effects) this.run(effect)
  }

  /** Resolves once every effect started so far (and any it triggered) is done. */
  async settle(): Promise<void> {
    while (this.inflight.size > 0) await Promise.all([...this.inflight])
  }

  private track(p: Promise<unknown>): void {
    this.inflight.add(p)
    void p.finally(() => this.inflight.delete(p))
  }

  private run(effect: Effect): void {
    switch (effect.type) {
      case 'verifyPin':
        this.track(
          this.se
            .verifyPin(effect.pin)
            .then((result) => this.dispatch({ type: 'PIN_RESULT', result, now: this.clock() })),
        )
        return
      case 'sign':
        this.track(
          this.se
            .eddsaSign(WALLET_SLOT, effect.message, effect.token)
            .then(
              (signature) => this.dispatch({ type: 'SIGNED', requestId: effect.requestId, signature }),
              () => this.dispatch({ type: 'SIGN_FAILED', requestId: effect.requestId }),
            ),
        )
        return
      case 'respond':
        this.transport.sendResponse(effect.response)
        return
      case 'endSession':
        this.track(this.se.endSession())
        return
    }
  }
}
