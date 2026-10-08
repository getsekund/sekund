import type { Button } from '@/machine/gestures'
import { ADDRESS_PAGES, REVIEW_PAGES, type WatchState } from '@/machine/machine'

export type Control = Button | 'C+D'
export type Controls = Record<Control, string | null>

const NONE: Controls = { A: null, B: null, C: null, D: null, 'C+D': null }

/** Where the pusher sits on the case. Letters alone are easy to miss. */
export const POSITION: Record<Control, string> = {
  A: 'Upper left',
  B: 'Lower left',
  C: 'Upper right',
  D: 'Lower right',
  'C+D': 'Both right',
}

const PIN_BUTTONS = 'Upper left (A) lowers it. Lower left (B) raises it. Hold both right buttons (C and D) to lock it.'

/**
 * One sentence for the step on screen, naming the physical button.
 * The secure menu stays quiet: the legend already lists those buttons.
 */
export function stepHint(state: WatchState): string | null {
  const s = state.screen
  switch (s.kind) {
    case 'normal':
      if (!state.onWrist) return 'Turn the wrist on. Then hold upper left (A) and lower right (D) together to enter Secure.'
      return 'Hold upper left (A) and lower right (D) together to enter Secure.'
    case 'entry':
      return 'The PIN is next. Upper left (A) lowers the digit. Lower left (B) raises it. Hold both right buttons (C and D) to lock it.'
    case 'pin':
      return pinHint(state)
    case 'verifying':
      return 'Checking the PIN.'
    case 'creating':
      return 'Creating the devnet key on the watch.'
    case 'review':
      return s.page === REVIEW_PAGES.length - 1
        ? 'Upper right (C) rejects. Lower right (D) approves.'
        : 'Lower left (B) shows the next field. Upper right (C) rejects. Lower right (D) approves on the last page.'
    case 'result':
      if (s.status === 'EXPIRED') return 'Nothing was signed. Press lower right (D), then send the transfer again from the companion.'
      if (s.status === 'APPROVED') return 'Signed. Press lower right (D) to return to Secure.'
      return 'Nothing was signed. Press lower right (D) to return to Secure.'
    case 'wiped':
      return 'The key is erased. Reset the simulator to set a new PIN.'
    default:
      return null
  }
}

function pinHint(state: WatchState): string {
  const s = state.screen
  if (s.kind !== 'pin') return PIN_BUTTONS
  const place = s.digits.length + 1
  const total = state.config.pinLength
  const verb = s.mode === 'unlock' ? 'Enter' : s.mode === 'confirm' ? 'Repeat' : 'Choose'
  const wrong = s.notice === 'wrong' ? (s.mode === 'unlock' ? 'Wrong PIN. ' : 'Those digits did not match. ') : ''
  return `${wrong}${verb} digit ${place} of ${total}. It is ${s.current}. ${PIN_BUTTONS}`
}

export interface PinProgress {
  /** Steady pattern. Locked digits are dashes. The current digit stays visible. */
  pattern: string
  line: string
}

/** Off the LCD, so the current digit stays readable while the face blinks. */
export function pinProgress(state: WatchState): PinProgress | null {
  const s = state.screen
  if (s.kind !== 'pin') return null
  const n = state.config.pinLength
  const chars = Array.from({ length: n }, (_, i) => {
    if (i < s.digits.length) return '-'
    if (i > s.digits.length) return '_'
    return String(s.current)
  })
  const place = s.digits.length + 1
  return {
    pattern: chars.join('  '),
    line: `Digit ${place} of ${n} is ${s.current}. Dashes are digits you locked.`,
  }
}

export interface StepAction {
  label: string
  buttons: Button[]
  tone: 'primary' | 'secondary'
}

/** One primary press for this step, for a narrow screen where two pushers are hard to hold. */
export function stepActions(state: WatchState): StepAction[] {
  const s = state.screen
  switch (s.kind) {
    case 'normal':
      return [{ label: 'Enter Secure', buttons: ['A', 'D'], tone: 'primary' }]
    case 'entry':
    case 'pin':
      return [{ label: 'Lock digit', buttons: ['C', 'D'], tone: 'primary' }]
    case 'review':
      return s.page === REVIEW_PAGES.length - 1
        ? [
            { label: 'Reject', buttons: ['C'], tone: 'secondary' },
            { label: 'Approve', buttons: ['D'], tone: 'primary' },
          ]
        : [
            { label: 'Reject', buttons: ['C'], tone: 'secondary' },
            { label: 'Next field', buttons: ['B'], tone: 'primary' },
          ]
    case 'result':
      return [{ label: 'OK', buttons: ['D'], tone: 'primary' }]
    default:
      return []
  }
}

/**
 * What each pusher does in the current state; null when it does nothing. Drives the
 * legend beside the watch and the LCD annunciators (lit only while a pusher acts).
 */
export function controlsFor(state: WatchState): Controls {
  const s = state.screen
  switch (s.kind) {
    case 'pin': {
      const lastDigit = s.digits.length === state.config.pinLength - 1
      const finish = s.mode === 'unlock' ? 'Check PIN' : 'Set PIN'
      return {
        A: 'Decrease digit',
        B: 'Increase digit',
        C: s.digits.length === 0 ? 'Leave' : 'Previous digit',
        D: 'Hold with C',
        'C+D': lastDigit ? finish : 'Confirm digit',
      }
    }
    case 'menu':
      return { ...NONE, A: 'Move up', B: 'Move down', C: 'Lock, back to time', D: 'Select' }
    case 'address':
      return {
        ...NONE,
        A: s.page > 0 ? 'Previous page' : null,
        B: s.page < ADDRESS_PAGES - 1 ? 'Next page' : null,
        C: 'Back',
      }
    case 'settings':
      return { ...NONE, C: 'Back' }
    case 'review': {
      const last = s.page === REVIEW_PAGES.length - 1
      return {
        ...NONE,
        A: s.page > 0 ? 'Previous field' : null,
        B: last ? null : 'Next field',
        C: 'Reject',
        D: last ? 'Approve' : null,
      }
    }
    case 'result':
      return { ...NONE, D: 'OK' }
    case 'normal':
    case 'entry':
    case 'verifying':
    case 'creating':
    case 'signing':
    case 'wiped':
      return NONE
  }
}
