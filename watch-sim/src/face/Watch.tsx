import type { CSSProperties, PointerEvent } from 'react'
import type { Button } from '@/machine/gestures'
import { DotMatrix } from './DotMatrix'
import type { FaceContent } from './screens'
import { WORDMARK_PATH, WORDMARK_VIEWBOX } from './wordmark'

interface Props {
  face: FaceContent
  pressed: ReadonlySet<Button>
  /** Accessible names, e.g. "Button A, previous". */
  labels: Record<Button, string>
  onPress(button: Button, latch: boolean): void
  onRelease(button: Button): void
}

/* Geometry from DESIGN.md §5, in viewBox units. */
const VIEW = { w: 360, h: 470 }
const CASE = { x: 32, y: 52, w: 296, h: 366, r: 40 }
const LCD = { x: 70, y: 116, w: 220, h: 236 }
const PUSHER = { w: 20, h: 36 }
const PUSHERS: { id: Button; side: 'left' | 'right'; y: number }[] = [
  { id: 'A', side: 'left', y: 147 },
  { id: 'B', side: 'left', y: 287 },
  { id: 'C', side: 'right', y: 147 },
  { id: 'D', side: 'right', y: 287 },
]
const pusherX = (side: 'left' | 'right') => (side === 'left' ? 16 : 324)

const pct = (v: number, of: number) => `${(v / of) * 100}%`

function Annunciator({ x, y, dir, on }: { x: number; y: number; dir: 'r' | 'l'; on: boolean }) {
  const s = 4
  const points = dir === 'r' ? `${x},${y - s} ${x + s},${y} ${x},${y + s}` : `${x},${y - s} ${x - s},${y} ${x},${y + s}`
  return <polygon className={on ? 'sk-seg sk-ann' : 'sk-ghost sk-ann'} points={points} />
}

function Lcd({ face }: { face: FaceContent }) {
  const { x, y, w, h } = LCD
  const a = face.annunciators
  return (
    <g>
      <rect className="sk-lcd" x={x} y={y} width={w} height={h} rx={6} />
      <text className="sk-lcd14 sk-ghost" x={x + 18} y={y + 44} fontSize={21}>
        ~~~~~~~~
      </text>
      <text className="sk-lcd14 sk-seg" x={x + 18} y={y + 44} fontSize={21}>
        {face.top}
      </text>
      <text className="sk-lcd7 sk-ghost" x={x + 166} y={y + 128} fontSize={46} textAnchor="end">
        88:88
      </text>
      <text className="sk-lcd7 sk-seg" x={x + 166} y={y + 128} fontSize={46} textAnchor="end">
        {face.main}
      </text>
      <text className="sk-lcd7 sk-ghost" x={x + 208} y={y + 128} fontSize={22} textAnchor="end">
        88
      </text>
      <text className="sk-lcd7 sk-seg" x={x + 208} y={y + 128} fontSize={22} textAnchor="end">
        {face.sec}
      </text>
      <DotMatrix lines={face.strip} x={x + 15} y={y + 168} pitch={2} dot={1.6} />
      <Annunciator x={x + 5} y={y + 53} dir="r" on={a.A} />
      <Annunciator x={x + 5} y={y + 193} dir="r" on={a.B} />
      <Annunciator x={x + w - 5} y={y + 53} dir="l" on={a.C} />
      <Annunciator x={x + w - 5} y={y + 193} dir="l" on={a.D} />
    </g>
  )
}

export function Watch({ face, pressed, labels, onPress, onRelease }: Props) {
  const down = (id: Button) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    onPress(id, e.shiftKey)
  }
  const up = (id: Button) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    onRelease(id)
  }

  const shadow: CSSProperties = {
    left: pct(CASE.x, VIEW.w),
    top: pct(CASE.y, VIEW.h),
    width: pct(CASE.w, VIEW.w),
    height: pct(CASE.h, VIEW.h),
    borderRadius: `${pct(CASE.r, CASE.w)} / ${pct(CASE.r, CASE.h)}`,
  }

  return (
    <div className="sk-watch">
      <div className="sk-watch-shadow" style={shadow} aria-hidden="true" />
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden="true">
        <rect className="sk-strap" x={96} y={0} width={168} height={70} />
        <rect className="sk-strap" x={96} y={400} width={168} height={70} />
        {[10, 24, 38].map((gy) => (
          <g key={gy}>
            <rect className="sk-strap-groove" x={96} y={gy} width={168} height={2} />
            <rect className="sk-strap-groove" x={96} y={468 - gy} width={168} height={2} />
          </g>
        ))}

        {PUSHERS.map((p) => (
          <g
            key={p.id}
            className="sk-pusher"
            data-side={p.side}
            data-pressed={pressed.has(p.id)}
          >
            <rect className="sk-steel" x={pusherX(p.side)} y={p.y} width={PUSHER.w} height={PUSHER.h} rx={3} />
            <rect className="sk-steel-edge" x={pusherX(p.side)} y={p.y + 30} width={PUSHER.w} height={6} rx={2} />
          </g>
        ))}

        <path className="sk-resin" d="M80 58 L104 34 H256 L280 58 Z" />
        <path className="sk-resin" d="M80 412 L104 436 H256 L280 412 Z" />
        <rect className="sk-resin" x={CASE.x} y={CASE.y} width={CASE.w} height={CASE.h} rx={CASE.r} />
        <rect className="sk-bezel" x={46} y={66} width={268} height={338} rx={28} />
        <svg x={132} y={77} width={96} height={22} viewBox={WORDMARK_VIEWBOX}>
          <path className="sk-wordmark" d={WORDMARK_PATH} />
        </svg>
        <rect className="sk-glass" x={62} y={108} width={236} height={252} rx={10} />
        <Lcd face={face} />
      </svg>

      {PUSHERS.map((p) => (
        <button
          key={p.id}
          type="button"
          className="sk-pusher-hit"
          data-button={p.id}
          aria-label={labels[p.id]}
          aria-pressed={pressed.has(p.id)}
          style={{
            left: pct(pusherX(p.side) + PUSHER.w / 2, VIEW.w),
            top: pct(p.y + PUSHER.h / 2, VIEW.h),
          }}
          onPointerDown={down(p.id)}
          onPointerUp={up(p.id)}
          onPointerCancel={up(p.id)}
          onContextMenu={(e) => e.preventDefault()}
        />
      ))}

      {PUSHERS.map((p) => (
        <span
          key={p.id}
          className="sk-keyhint"
          data-side={p.side}
          data-pressed={pressed.has(p.id)}
          style={{ top: pct(p.y + PUSHER.h / 2, VIEW.h) }}
          aria-hidden="true"
        >
          {p.id}
        </span>
      ))}
    </div>
  )
}
