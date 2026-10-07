import { base58Encode, base64Decode } from '@/adapters/base58'
import {
  PROTOCOL_VERSION,
  type ResponseStatus,
  type SignResponseEnvelope,
} from '@/adapters/envelope'
import { MAX_PIN_ATTEMPTS, type PinResult } from '@/adapters/secureElement'
import { parseTransfer, type ParsedTransfer } from '@/adapters/transferParser'
import { type Gesture, gesture, sameGesture } from './gestures'

/*
 * Watch state machine (spec v1.1 §6, §7, §9, §11.1). Pure: every transition
 * returns the next state plus effects for the controller to run. Approval and
 * display rules live here and are security-critical.
 */

export interface MachineConfig {
  pinLength: number
  /** The hidden Secure Mode combination, pressed together in Normal mode. */
  hiddenCombo: Gesture
  maxMessageBytes: number
  /** Upper bound on the review window, whatever the companion asks for. */
  maxExpiresInMs: number
  lightMs: number
}

export const DEFAULT_CONFIG: MachineConfig = {
  pinLength: 4,
  hiddenCombo: gesture('A', 'D'),
  maxMessageBytes: 4096,
  maxExpiresInMs: 90_000,
  lightMs: 2500,
}

export const CONFIRM = gesture('C', 'D')
export const MENU_ITEMS = ['ADDRESS', 'SIGN REQUEST', 'LOCK'] as const
export const REVIEW_PAGES = ['AMOUNT', 'TO', 'NETWORK', 'FROM', 'APPROVE'] as const

export interface PendingRequest {
  requestId: string
  nonce: string
  /** The watch's own decoded buffer: the exact bytes parsed, displayed and signed. */
  message: Uint8Array
  transfer: ParsedTransfer
  receivedAt: number
  deadline: number
}

export type ResultStatus = ResponseStatus | 'FAILED'

export type Screen =
  | { kind: 'normal' }
  | { kind: 'pin'; digits: number[]; current: number; wrong: boolean }
  | { kind: 'verifying' }
  | { kind: 'menu'; index: number; notice: 'no-request' | null }
  | { kind: 'address' }
  | { kind: 'review'; page: number }
  | { kind: 'signing' }
  | { kind: 'result'; status: ResultStatus; signature?: string }
  | { kind: 'wiped' }

export interface WatchState {
  config: MachineConfig
  now: number
  screen: Screen
  onWrist: boolean
  session: boolean
  attemptsLeft: number
  wiped: boolean
  /** Wallet public key (32 bytes) or null when no key exists. */
  address: Uint8Array | null
  request: PendingRequest | null
  signing: { requestId: string; token: string } | null
  seenRequestIds: readonly string[]
  seenNonces: readonly string[]
  lightUntil: number
  hour12: boolean
}

export type WatchEvent =
  | { type: 'GESTURE'; buttons: Gesture; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'WRIST'; on: boolean; now: number }
  | { type: 'KEY_READY'; address: Uint8Array }
  | { type: 'REQUEST'; envelope: unknown; now: number }
  | { type: 'PIN_RESULT'; result: PinResult; now: number }
  | { type: 'SIGNED'; requestId: string; signature: Uint8Array }
  | { type: 'SIGN_FAILED'; requestId: string }

export type Effect =
  | { type: 'verifyPin'; pin: string }
  | { type: 'sign'; requestId: string; message: Uint8Array; token: string }
  | { type: 'respond'; response: SignResponseEnvelope }
  | { type: 'endSession' }

export interface Deps {
  newToken(): string
}

export interface Transition {
  state: WatchState
  effects: Effect[]
}

const SEEN_LIMIT = 512

export function initialState(config: Partial<MachineConfig> = {}, now = 0): WatchState {
  return {
    config: { ...DEFAULT_CONFIG, ...config },
    now,
    screen: { kind: 'normal' },
    onWrist: true,
    session: false,
    attemptsLeft: MAX_PIN_ATTEMPTS,
    wiped: false,
    address: null,
    request: null,
    signing: null,
    seenRequestIds: [],
    seenNonces: [],
    lightUntil: 0,
    hour12: false,
  }
}

const freshPin = (wrong = false): Screen => ({ kind: 'pin', digits: [], current: 0, wrong })

function respond(requestId: string, status: ResponseStatus, signature?: string): Effect {
  const response: SignResponseEnvelope = { version: PROTOCOL_VERSION, requestId, status }
  if (signature) response.signature = signature
  return { type: 'respond', response }
}

/** Seconds left on the pending request, rounded up; 0 once expired. */
export function secondsLeft(state: WatchState): number {
  if (!state.request) return 0
  return Math.max(0, Math.ceil((state.request.deadline - state.now) / 1000))
}

export function transition(state: WatchState, event: WatchEvent, deps: Deps): Transition {
  switch (event.type) {
    case 'TICK':
      return expireIfDue({ ...state, now: event.now })
    case 'GESTURE':
      return onGesture(expireIfDue({ ...state, now: event.now }), event.buttons, deps)
    case 'WRIST':
      return onWrist({ ...state, now: event.now }, event.on)
    case 'KEY_READY':
      return {
        state: {
          ...state,
          address: event.address,
          wiped: false,
          attemptsLeft: MAX_PIN_ATTEMPTS,
          session: false,
          screen: state.screen.kind === 'wiped' ? { kind: 'normal' } : state.screen,
        },
        effects: [],
      }
    case 'REQUEST':
      return onRequest(expireIfDue({ ...state, now: event.now }), event.envelope)
    case 'PIN_RESULT':
      return onPinResult({ ...state, now: event.now }, event.result)
    case 'SIGNED': {
      if (state.signing?.requestId !== event.requestId) return { state, effects: [] }
      const signature = base58Encode(event.signature)
      return {
        state: {
          ...state,
          signing: null,
          screen: state.session ? { kind: 'result', status: 'APPROVED', signature } : { kind: 'normal' },
        },
        effects: [respond(event.requestId, 'APPROVED', signature)],
      }
    }
    case 'SIGN_FAILED': {
      if (state.signing?.requestId !== event.requestId) return { state, effects: [] }
      return {
        state: {
          ...state,
          signing: null,
          screen: state.session ? { kind: 'result', status: 'FAILED' } : { kind: 'normal' },
        },
        effects: [respond(event.requestId, 'REJECTED')],
      }
    }
  }
}

function expireIfDue(state: WatchState): Transition {
  const req = state.request
  if (!req || state.now < req.deadline) return { state, effects: [] }
  return {
    state: {
      ...state,
      request: null,
      screen: state.screen.kind === 'review' ? { kind: 'result', status: 'EXPIRED' } : state.screen,
    },
    effects: [respond(req.requestId, 'EXPIRED')],
  }
}

function endSession(state: WatchState, effects: Effect[]): Transition {
  return {
    state: { ...state, session: false, screen: { kind: 'normal' } },
    effects: state.session ? [...effects, { type: 'endSession' }] : effects,
  }
}

function onWrist(state: WatchState, on: boolean): Transition {
  if (on) return { state: { ...state, onWrist: true }, effects: [] }
  return endSession({ ...state, onWrist: false }, [])
}

function onGesture(t: Transition, buttons: Gesture, deps: Deps): Transition {
  const { state, effects } = t
  const s = state.screen
  const is = (...b: Parameters<typeof gesture>) => sameGesture(buttons, gesture(...b))
  const next = (patch: Partial<WatchState>, extra: Effect[] = []): Transition => ({
    state: { ...state, ...patch },
    effects: [...effects, ...extra],
  })

  switch (s.kind) {
    case 'normal': {
      if (sameGesture(buttons, state.config.hiddenCombo)) {
        if (!state.onWrist) return t
        if (state.wiped) return next({ screen: { kind: 'wiped' } })
        if (!state.address) return t
        return next({ screen: freshPin() })
      }
      if (is('A')) return next({ lightUntil: state.now + state.config.lightMs })
      if (is('B')) return next({ hour12: !state.hour12 })
      return t
    }

    case 'pin': {
      if (is('A')) return next({ screen: { ...s, current: (s.current + 9) % 10 } })
      if (is('B')) return next({ screen: { ...s, current: (s.current + 1) % 10 } })
      if (sameGesture(buttons, CONFIRM)) {
        const digits = [...s.digits, s.current]
        if (digits.length < state.config.pinLength) {
          return next({ screen: { kind: 'pin', digits, current: 0, wrong: false } })
        }
        return next({ screen: { kind: 'verifying' } }, [{ type: 'verifyPin', pin: digits.join('') }])
      }
      if (is('C')) {
        if (s.digits.length === 0) return next({ screen: { kind: 'normal' } })
        const digits = s.digits.slice(0, -1)
        return next({ screen: { kind: 'pin', digits, current: s.digits[s.digits.length - 1], wrong: false } })
      }
      return t
    }

    case 'menu': {
      const n = MENU_ITEMS.length
      if (is('A')) return next({ screen: { kind: 'menu', index: (s.index + n - 1) % n, notice: null } })
      if (is('B')) return next({ screen: { kind: 'menu', index: (s.index + 1) % n, notice: null } })
      if (is('C')) return endSession(state, effects)
      if (is('D')) {
        const item = MENU_ITEMS[s.index]
        if (item === 'ADDRESS') return next({ screen: { kind: 'address' } })
        if (item === 'SIGN REQUEST') {
          return state.request
            ? next({ screen: { kind: 'review', page: 0 } })
            : next({ screen: { kind: 'menu', index: s.index, notice: 'no-request' } })
        }
        return endSession(state, effects)
      }
      return t
    }

    case 'address':
      if (is('C') || is('D')) return next({ screen: { kind: 'menu', index: 0, notice: null } })
      return t

    case 'review': {
      const req = state.request
      if (!req) return next({ screen: { kind: 'menu', index: 1, notice: null } })
      const last = REVIEW_PAGES.length - 1
      if (is('A')) return next({ screen: { kind: 'review', page: Math.max(0, s.page - 1) } })
      if (is('B')) return next({ screen: { kind: 'review', page: Math.min(last, s.page + 1) } })
      if (is('C')) {
        return next({ request: null, screen: { kind: 'result', status: 'REJECTED' } }, [
          respond(req.requestId, 'REJECTED'),
        ])
      }
      if (is('D') && s.page === last) {
        if (!state.session || state.now >= req.deadline) return t
        const token = deps.newToken()
        return next(
          {
            request: null,
            signing: { requestId: req.requestId, token },
            screen: { kind: 'signing' },
          },
          [{ type: 'sign', requestId: req.requestId, message: req.message, token }],
        )
      }
      return t
    }

    case 'result':
      if (state.request) return next({ screen: { kind: 'review', page: 0 } })
      return next({ screen: { kind: 'menu', index: 0, notice: null } })

    case 'wiped':
      if (is('C') || is('D')) return next({ screen: { kind: 'normal' } })
      return t

    case 'verifying':
    case 'signing':
      return t
  }
}

function onPinResult(state: WatchState, result: PinResult): Transition {
  const stillWaiting = state.screen.kind === 'verifying' && state.onWrist
  if (result.ok) {
    if (!stillWaiting) return { state, effects: [{ type: 'endSession' }] }
    return {
      state: {
        ...state,
        session: true,
        attemptsLeft: MAX_PIN_ATTEMPTS,
        screen: state.request ? { kind: 'review', page: 0 } : { kind: 'menu', index: 0, notice: null },
      },
      effects: [],
    }
  }
  if (result.wiped) {
    const effects: Effect[] = state.request ? [respond(state.request.requestId, 'LOCKED')] : []
    return {
      state: {
        ...state,
        wiped: true,
        address: null,
        session: false,
        attemptsLeft: 0,
        request: null,
        screen: stillWaiting ? { kind: 'wiped' } : state.screen,
      },
      effects,
    }
  }
  return {
    state: {
      ...state,
      attemptsLeft: result.attemptsLeft,
      screen: stillWaiting ? freshPin(true) : state.screen,
    },
    effects: [],
  }
}

function remember(list: readonly string[], value: string): readonly string[] {
  return [...list, value].slice(-SEEN_LIMIT)
}

function onRequest(t: Transition, envelope: unknown): Transition {
  const { state, effects } = t
  if (typeof envelope !== 'object' || envelope === null) return t
  const env = envelope as Record<string, unknown>
  const requestId = env.requestId
  if (typeof requestId !== 'string' || requestId.length === 0) return t

  const refuse = (status: ResponseStatus, patch: Partial<WatchState> = {}): Transition => ({
    state: { ...state, ...patch },
    effects: [...effects, respond(requestId, status)],
  })

  const nonce = typeof env.nonce === 'string' ? env.nonce : ''
  if (state.seenRequestIds.includes(requestId) || (nonce && state.seenNonces.includes(nonce))) {
    return refuse('REJECTED')
  }
  const seen: Partial<WatchState> = {
    seenRequestIds: remember(state.seenRequestIds, requestId),
    seenNonces: nonce ? remember(state.seenNonces, nonce) : state.seenNonces,
  }

  if (state.wiped || !state.address) return refuse('LOCKED', seen)
  if (
    env.version !== PROTOCOL_VERSION ||
    env.type !== 'SIGN_TRANSACTION' ||
    env.network !== 'devnet' ||
    !nonce ||
    typeof env.message !== 'string'
  ) {
    return refuse('UNSUPPORTED', seen)
  }
  const expiresInMs = env.expiresInMs
  if (typeof expiresInMs !== 'number' || !Number.isFinite(expiresInMs) || expiresInMs <= 0) {
    return refuse('EXPIRED', seen)
  }

  let message: Uint8Array
  try {
    message = base64Decode(env.message)
  } catch {
    return refuse('UNSUPPORTED', seen)
  }
  if (message.length > state.config.maxMessageBytes) return refuse('TOO_LARGE', seen)

  const parsed = parseTransfer(message, state.address)
  if (!parsed.ok) return refuse('UNSUPPORTED', seen)
  if (state.request || state.signing) return refuse('REJECTED', seen)

  const request: PendingRequest = {
    requestId,
    nonce,
    message,
    transfer: parsed.transfer,
    receivedAt: state.now,
    deadline: state.now + Math.min(expiresInMs, state.config.maxExpiresInMs),
  }
  const showNow =
    state.session && (state.screen.kind === 'menu' || state.screen.kind === 'address' || state.screen.kind === 'result')
  return {
    state: {
      ...state,
      ...seen,
      request,
      screen: showNow ? { kind: 'review', page: 0 } : state.screen,
    },
    effects,
  }
}
