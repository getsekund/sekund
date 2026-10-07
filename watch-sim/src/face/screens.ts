import { formatLamports, type Review } from '@sekund/protocol'
import { controlsFor } from '@/hints'
import type { Button } from '@/machine/gestures'
import { MENU_ITEMS, REVIEW_PAGES, type WatchState } from '@/machine/machine'
import { addressPages, right, type StripText, wrap } from './strip'

/**
 * What the LCD shows (DESIGN.md §2 on-watch copy, §5 states). Strings are in DSEG terms:
 * `!` is a digit-width blank, a space in the colon position blanks the colon.
 */
export interface FaceContent {
  /** 14-segment top line, exactly 8 characters. */
  top: string
  /** 7-segment main digits, `88:88` positions. */
  main: string
  /** 7-segment seconds, 2 characters. */
  sec: string
  strip: StripText
  annunciators: Record<Button, boolean>
  /** Top line and strip as plain words, for the screen-reader live region. */
  spoken: string
}

export interface FaceOptions {
  reducedMotion?: boolean
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const BLANK_STRIP: StripText = ['', '']
/** Solana's base fee per signature; the signer count comes from the message header. */
const LAMPORTS_PER_SIGNATURE = 5_000n

const pad2 = (n: number) => n.toString().padStart(2, '0')
const blankOut = (s: string) => s.replace(/ /g, '!')

function top(label: string, tail = ''): string {
  return blankOut(label.padEnd(8 - tail.length, ' ') + tail).slice(0, 8)
}

const blinkOn = (now: number) => now % 1000 < 500

function time(now: number): { main: string; sec: string } {
  const d = new Date(now)
  return { main: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`, sec: pad2(d.getSeconds()) }
}

function countdown(seconds: number, now: number, steady: boolean): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '!')
  const colon = seconds <= 10 && !steady && !blinkOn(now) ? ' ' : ':'
  return `${m}${colon}${pad2(seconds % 60)}`
}

function signatureCount(review: Review): number {
  return review.messageBytes[0] ?? 1
}

function reviewPage(review: Review, page: (typeof REVIEW_PAGES)[number]): { top: string; strip: StripText } {
  const to = addressPages(review.transfer.to)
  switch (page) {
    case 'AMOUNT': {
      const lines = wrap(`${review.transfer.sol} SOL`)
      return { top: top('AMOUNT'), strip: [lines[0] ?? '', lines[1] ?? ''] }
    }
    case 'TO1':
      return { top: top('TO', '1/2'), strip: to[0] }
    case 'TO2':
      return { top: top('TO', '2/2'), strip: to[1] }
    case 'NETWORK':
      return { top: top('NETWORK'), strip: ['SOLANA', 'DEVNET'] }
    case 'FEE': {
      const n = signatureCount(review)
      const fee = formatLamports(LAMPORTS_PER_SIGNATURE * BigInt(n))
      return { top: top('FEE'), strip: [`${fee} SOL`, `${n} SIGNATURE${n === 1 ? '' : 'S'}`] }
    }
    case 'APPROVE':
      return { top: top('APPROVE?'), strip: [right('REJECT'), right('APPROVE')] }
  }
}

function menuStrip(state: WatchState, index: number, notice: 'no-request' | null): StripText {
  const first = Math.min(index, MENU_ITEMS.length - 2)
  const row = (i: number) => {
    const selected = i === index
    const label = selected && notice === 'no-request' ? 'NO REQUEST' : MENU_ITEMS[i] ?? ''
    const waiting = MENU_ITEMS[i] === 'SIGN REQUEST' && state.request ? ' 1' : ''
    return `${selected ? '>' : ' '} ${label}${selected && notice ? '' : waiting}`
  }
  return [row(first), row(first + 1)]
}

function pinMain(state: WatchState, digits: number[], current: number, steady: boolean): string {
  const n = state.config.pinLength
  const chars = Array.from({ length: n }, (_, i) => {
    if (i < digits.length) return '-'
    if (i > digits.length) return '_'
    return steady || blinkOn(state.now) ? String(current) : '!'
  })
  return `${chars.slice(0, 2).join('')} ${chars.slice(2).join('')}`
}

interface Layout {
  top: string
  main: string
  sec: string
  strip: StripText
}

function layout(state: WatchState, steady: boolean): Layout {
  const s = state.screen
  const clock = time(state.now)
  const secure = (strip: StripText, label = 'SECURE'): Layout => ({ top: top(label), ...clock, strip })

  switch (s.kind) {
    case 'normal': {
      const d = new Date(state.now)
      return { top: top(DAYS[d.getDay()] ?? '', String(d.getDate())), ...clock, strip: BLANK_STRIP }
    }
    case 'entry':
      return secure(BLANK_STRIP)
    case 'pin': {
      const main = pinMain(state, s.digits, s.current, steady)
      const tries = `TRIES LEFT ${state.attemptsLeft}`
      let strip: StripText
      if (s.mode === 'unlock') strip = [s.notice === 'wrong' ? 'WRONG PIN' : 'ENTER PIN', tries]
      else strip = ['NEW PIN', 'FOUR DIGITS']
      return { top: top('PIN'), main, sec: '!!', strip }
    }
    case 'verifying':
      return { top: top('PIN'), main: '-- --', sec: '!!', strip: ['CHECKING PIN', ''] }
    case 'creating':
      return { top: top('PIN'), main: '-- --', sec: '!!', strip: ['CREATING KEY', ''] }
    case 'menu':
      return secure(menuStrip(state, s.index, s.notice))
    case 'address': {
      const pages = state.address ? addressPages(state.address) : null
      return { top: top('ADDR', `${s.page + 1}/2`), ...clock, strip: pages?.[s.page] ?? ['NO KEY', ''] }
    }
    case 'settings':
      return secure([state.profile ?? '', `MAX ${state.maxMessageBytes} BYTES`], 'SETTINGS')
    case 'review': {
      const req = state.request
      if (!req) return secure(['NO REQUEST', ''])
      const seconds = Math.max(0, Math.ceil((req.deadline - state.now) / 1000))
      const page = reviewPage(req, REVIEW_PAGES[s.page] ?? 'AMOUNT')
      return { ...page, main: countdown(seconds, state.now, steady), sec: '!!' }
    }
    case 'signing':
      return secure(['SECURE ELEMENT', 'SIGNING'], 'SIGNING')
    case 'result':
      switch (s.status) {
        case 'APPROVED':
          return secure(['SENT TO APP', right('OK')], 'SIGNED')
        case 'REJECTED':
          return secure(['NOT SIGNED', right('OK')], 'REJECTED')
        case 'FAILED':
          return secure(['NOT SIGNED', right('OK')], 'FAILED')
        case 'SETUP_FAILED':
          return secure(['NO KEY MADE', right('OK')], 'FAILED')
        case 'EXPIRED':
          return { top: top('EXPIRED'), main: '!0:00', sec: '!!', strip: ['NOT SIGNED', 'ASK APP AGAIN'] }
      }
      break
    case 'wiped':
      return { top: top('LOCKED'), main: '--:--', sec: '!!', strip: ['KEY ERASED', 'SET UP AGAIN'] }
  }
  return secure(BLANK_STRIP)
}

const words = (s: string) => s.replace(/!/g, ' ').replace(/\s+/g, ' ').trim()

export function renderFace(state: WatchState, options: FaceOptions = {}): FaceContent {
  const l = layout(state, options.reducedMotion ?? false)
  const c = controlsFor(state)
  const annunciators = { A: c.A !== null, B: c.B !== null, C: c.C !== null, D: c.D !== null }
  const spoken = [l.top, ...l.strip].map(words).filter(Boolean).join('. ')
  return { ...l, annunciators, spoken }
}
