import { REVIEW_PAGES, type WatchState } from '@/machine/machine'

export interface Hint {
  keys: string
  action: string
}

/** What each button does on the current screen, for the panel outside the watch. */
export function hintsFor(state: WatchState): Hint[] {
  const s = state.screen
  switch (s.kind) {
    case 'normal':
      return [
        { keys: 'A', action: 'Light' },
        { keys: 'B', action: '12 / 24 hour' },
        { keys: 'A + D', action: 'Secure Mode (hidden)' },
      ]
    case 'pin':
      return [
        { keys: 'A / B', action: 'Digit down / up' },
        { keys: 'C + D', action: s.digits.length === state.config.pinLength - 1 ? 'Confirm PIN' : 'Next digit' },
        { keys: 'C', action: s.digits.length === 0 ? 'Leave Secure Mode' : 'Previous digit' },
      ]
    case 'menu':
      return [
        { keys: 'A / B', action: 'Move' },
        { keys: 'D', action: 'Select' },
        { keys: 'C', action: 'Lock and leave' },
      ]
    case 'address':
      return [{ keys: 'C / D', action: 'Back to menu' }]
    case 'review':
      return [
        { keys: 'A / B', action: 'Previous / next field' },
        { keys: 'D', action: s.page === REVIEW_PAGES.length - 1 ? 'Approve' : 'Approve (on the last field)' },
        { keys: 'C', action: 'Reject' },
      ]
    case 'result':
      return [{ keys: 'Any', action: 'Continue' }]
    case 'wiped':
      return [{ keys: 'C', action: 'Back to the time' }]
    case 'verifying':
    case 'signing':
      return [{ keys: '—', action: 'Secure element working' }]
  }
}
