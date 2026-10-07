import type { Button } from '@/machine/gestures'
import { ADDRESS_PAGES, REVIEW_PAGES, type WatchState } from '@/machine/machine'

export type Control = Button | 'C+D'
export type Controls = Record<Control, string | null>

const NONE: Controls = { A: null, B: null, C: null, D: null, 'C+D': null }

/**
 * What each pusher does in the current state; null when it does nothing. Drives the
 * legend beside the watch and the LCD annunciators (lit only while a pusher acts).
 */
export function controlsFor(state: WatchState): Controls {
  const s = state.screen
  switch (s.kind) {
    case 'pin': {
      const lastDigit = s.digits.length === state.config.pinLength - 1
      const finish = s.mode === 'unlock' ? 'Check PIN' : s.mode === 'create' ? 'Set PIN' : 'Confirm PIN'
      return {
        A: 'Decrease digit',
        B: 'Increase digit',
        C: s.digits.length === 0 ? 'Leave' : 'Previous digit',
        D: 'With C, confirm',
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
