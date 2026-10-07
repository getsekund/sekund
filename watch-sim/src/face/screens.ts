import { MAX_PIN_ATTEMPTS } from '@sekund/protocol'
import { MENU_ITEMS, REVIEW_PAGES, secondsLeft, type WatchState } from '@/machine/machine'
import { chunk, type MatrixLine } from './matrix'
import type { SegmentContent } from './SegmentDisplay'

export interface Indicators {
  session: boolean
  request: boolean
  wrist: boolean
}

export interface FaceContent {
  lines: (MatrixLine | null)[]
  segment: SegmentContent
  /** Two-character tag above the seconds (AM/PM). */
  tag: string
  indicators: Indicators
  lit: boolean
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const pad2 = (n: number) => n.toString().padStart(2, '0')

function header(text: string, right?: string): MatrixLine {
  return { text, right, rule: true }
}

function center(text: string, size: 1 | 2 = 1): MatrixLine {
  return { text, align: 'center', size }
}

function addressLines(address: string | null): MatrixLine[] {
  if (!address) return [center('NO KEY')]
  return chunk(address).map((text) => ({ text }))
}

const PIN_HEADERS = { unlock: 'ENTER PIN', create: 'NEW PIN', confirm: 'CONFIRM PIN' } as const

function clock(state: WatchState): { segment: SegmentContent; tag: string } {
  const d = new Date(state.now)
  let h = d.getHours()
  let tag = ''
  if (state.hour12) {
    tag = h < 12 ? 'AM' : 'PM'
    h = h % 12 || 12
  }
  const hh = state.hour12 ? h.toString().padStart(2, ' ') : pad2(h)
  return {
    segment: { big: `${hh}${pad2(d.getMinutes())}`, colon: d.getMilliseconds() < 500, small: pad2(d.getSeconds()) },
    tag,
  }
}

function countdown(state: WatchState): SegmentContent {
  const s = secondsLeft(state)
  const blinkOff = s <= 10 && new Date(state.now).getMilliseconds() >= 500
  if (blinkOff) return { big: '    ', colon: false, small: '  ' }
  const m = Math.floor(s / 60)
  return { big: ` ${m}${pad2(s % 60)}`, colon: true, small: '  ' }
}

export function renderFace(state: WatchState): FaceContent {
  const { screen } = state
  const indicators: Indicators = {
    session: state.session,
    request: state.request !== null,
    wrist: state.onWrist,
  }
  const lit = state.now < state.lightUntil
  const time = clock(state)
  const base = { indicators, lit, tag: '', segment: time.segment }

  switch (screen.kind) {
    case 'normal': {
      const d = new Date(state.now)
      return {
        ...base,
        tag: time.tag,
        lines: [
          null,
          center(`${DAYS[d.getDay()]} ${pad2(d.getDate())}`, 2),
          center(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`),
        ],
      }
    }

    case 'pin': {
      const n = state.config.pinLength
      const big = Array.from({ length: n }, (_, i) =>
        i < screen.digits.length ? '-' : i === screen.digits.length ? String(screen.current) : '_',
      ).join('')
      let status = ''
      if (screen.notice === 'wrong') status = `WRONG PIN ${state.attemptsLeft} LEFT`
      else if (screen.notice === 'mismatch') status = 'PINS DIFFER'
      else if (screen.mode === 'unlock' && state.attemptsLeft < MAX_PIN_ATTEMPTS) status = `${state.attemptsLeft} TRIES LEFT`
      else if (screen.mode === 'create') status = 'FIRST USE'
      else if (screen.mode === 'confirm') status = 'ONCE MORE'
      return {
        ...base,
        segment: { big, colon: false, small: '  ' },
        lines: [header(PIN_HEADERS[screen.mode], `${screen.digits.length + 1}/${n}`), null, center(status)],
      }
    }

    case 'verifying':
      return {
        ...base,
        segment: { big: '----', colon: false, small: '  ' },
        lines: [header('ENTER PIN'), null, center('CHECKING…')],
      }

    case 'creating':
      return {
        ...base,
        segment: { big: '----', colon: false, small: '  ' },
        lines: [header('NEW WALLET'), null, center('CREATING KEY…')],
      }

    case 'menu':
      return {
        ...base,
        lines: [
          header('WALLET', `${screen.index + 1}/${MENU_ITEMS.length}`),
          ...MENU_ITEMS.map((item, i): MatrixLine => {
            const selected = i === screen.index
            let label: string = item
            if (item === 'SIGN REQUEST' && state.request) label = 'SIGN REQUEST 1'
            if (selected && screen.notice === 'no-request') label = 'NONE PENDING'
            return { text: `${selected ? '▸' : ' '}${label}` }
          }),
        ],
      }

    case 'address':
      return { ...base, lines: [header('ADDRESS'), ...addressLines(state.address)] }

    case 'review': {
      const req = state.request
      if (!req) return { ...base, lines: [header('REVIEW'), null, center('NO REQUEST')] }
      const page = REVIEW_PAGES[screen.page] ?? 'AMOUNT'
      const amount = req.transfer.sol
      const pageTag = `${screen.page + 1}/${REVIEW_PAGES.length}`
      const seg = countdown(state)
      const body = (): (MatrixLine | null)[] => {
        switch (page) {
          case 'AMOUNT': {
            const text = `${amount} SOL`
            return text.length <= 8 ? [center('SEND'), center(text, 2)] : [center('SEND'), center(amount), center('SOL')]
          }
          case 'TO':
            return addressLines(req.transfer.to)
          case 'NETWORK':
            return [center('SOLANA'), center('DEVNET', 2)]
          case 'FROM':
            return addressLines(req.transfer.from)
          case 'APPROVE':
            return [center('SIGN TRANSFER'), center(`${amount} SOL?`), { text: '◂REJECT APPROVE▸' }]
        }
      }
      return { ...base, segment: seg, lines: [header(page, pageTag), ...body()] }
    }

    case 'signing':
      return { ...base, lines: [header('SIGNING'), null, center('SECURE ELEMENT'), center('SIGNING…')] }

    case 'result': {
      switch (screen.status) {
        case 'APPROVED': {
          const sig = screen.signature ?? ''
          return {
            ...base,
            lines: [header('SIGNED ✓'), center('SIGNATURE SENT'), center(`${sig.slice(0, 6)}…${sig.slice(-6)}`)],
          }
        }
        case 'EXPIRED':
          return { ...base, lines: [header('EXPIRED'), center('TIME RAN OUT'), center('NOTHING SIGNED')] }
        case 'FAILED':
          return { ...base, lines: [header('FAILED'), center('SECURE ELEMENT'), center('NOTHING SIGNED')] }
        default:
          return { ...base, lines: [header('REJECTED'), center('NOTHING SIGNED')] }
      }
    }

    case 'wiped':
      return { ...base, lines: [header('LOCKED'), center('3 WRONG PINS'), center('KEY WIPED')] }
  }
}
