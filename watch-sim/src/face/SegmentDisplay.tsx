const SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  _: 'd',
  ' ': '',
  A: 'abcefg',
  P: 'abefg',
  E: 'adefg',
  r: 'eg',
  n: 'ceg',
  o: 'cdeg',
  L: 'def',
  H: 'bcefg',
  S: 'acdfg',
  d: 'bcdeg',
  b: 'cdefg',
  C: 'adef',
  U: 'bcdef',
  t: 'defg',
}

function hex(x1: number, y1: number, x2: number, y2: number, t: number): string {
  const h = t / 2
  if (y1 === y2) {
    return `${x1},${y1} ${x1 + h},${y1 - h} ${x2 - h},${y1 - h} ${x2},${y1} ${x2 - h},${y1 + h} ${x1 + h},${y1 + h}`
  }
  return `${x1},${y1} ${x1 + h},${y1 + h} ${x1 + h},${y2 - h} ${x1},${y2} ${x1 - h},${y2 - h} ${x1 - h},${y1 + h}`
}

function segmentPolys(w: number, h: number, t: number): Record<string, string> {
  const g = t * 0.22
  const x0 = t / 2
  const x1 = w - t / 2
  const y0 = t / 2
  const ym = h / 2
  const y1 = h - t / 2
  return {
    a: hex(x0 + g, y0, x1 - g, y0, t),
    b: hex(x1, y0 + g, x1, ym - g, t),
    c: hex(x1, ym + g, x1, y1 - g, t),
    d: hex(x0 + g, y1, x1 - g, y1, t),
    e: hex(x0, ym + g, x0, y1 - g, t),
    f: hex(x0, y0 + g, x0, ym - g, t),
    g: hex(x0 + g, ym, x1 - g, ym, t),
  }
}

interface DigitProps {
  ch: string
  x: number
  y: number
  w: number
  h: number
  t: number
}

export function SegmentDigit({ ch, x, y, w, h, t }: DigitProps) {
  const lit = SEGMENTS[ch] ?? ''
  const polys = segmentPolys(w, h, t)
  return (
    <g transform={`translate(${x} ${y}) skewX(-6) translate(${h * 0.1} 0)`}>
      {Object.entries(polys).map(([seg, points]) => (
        <polygon key={seg} points={points} className={lit.includes(seg) ? 'sk-ink' : 'sk-ghost'} />
      ))}
    </g>
  )
}

export interface SegmentContent {
  /** Four large characters, HH MM positions. */
  big: string
  colon: boolean
  /** Two small characters (seconds). */
  small: string
}

interface Props extends SegmentContent {
  x: number
  y: number
}

const BIG = { w: 42, h: 72, t: 8.5, step: 50 }
const SMALL = { w: 22, h: 38, t: 5.5, step: 26 }

export function SegmentDisplay({ big, colon, small, x, y }: Props) {
  const chars = big.padEnd(4, ' ').slice(0, 4).split('')
  const smallChars = small.padEnd(2, ' ').slice(0, 2).split('')
  const lastX = BIG.step * 3 + 16
  const xs = [0, BIG.step, BIG.step * 2 + 16, lastX]
  const colonX = BIG.step * 2 + 4
  const smallX = lastX + BIG.w + 10
  return (
    <g transform={`translate(${x} ${y})`}>
      {chars.map((ch, i) => (
        <SegmentDigit key={i} ch={ch} x={xs[i] ?? 0} y={0} w={BIG.w} h={BIG.h} t={BIG.t} />
      ))}
      <g transform={`skewX(-6) translate(${BIG.h * 0.1} 0)`}>
        <rect x={colonX} y={BIG.h * 0.28} width={7} height={7} className={colon ? 'sk-ink' : 'sk-ghost'} />
        <rect x={colonX - 2} y={BIG.h * 0.64} width={7} height={7} className={colon ? 'sk-ink' : 'sk-ghost'} />
      </g>
      {smallChars.map((ch, i) => (
        <SegmentDigit
          key={`s${i}`}
          ch={ch}
          x={smallX + i * SMALL.step}
          y={BIG.h - SMALL.h}
          w={SMALL.w}
          h={SMALL.h}
          t={SMALL.t}
        />
      ))}
    </g>
  )
}

export const SEGMENT_WIDTH = BIG.step * 3 + 16 + BIG.w + 10 + SMALL.step + SMALL.w
export const SEGMENT_HEIGHT = BIG.h
