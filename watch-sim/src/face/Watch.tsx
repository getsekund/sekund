import { useMemo, type PointerEvent } from 'react'
import type { Button } from '@/machine/gestures'
import { DotMatrix } from './DotMatrix'
import { composeLines, drawText, emptyGrid } from './matrix'
import type { FaceContent } from './screens'
import { SegmentDisplay } from './SegmentDisplay'

interface Props {
  face: FaceContent
  pressed: ReadonlySet<Button>
  keyFor: Record<Button, string>
  onPress(button: Button, latch: boolean): void
  onRelease(button: Button): void
}

const OFFSET_X = 40
const LCD = { x: 80, y: 182, w: 280, h: 252, r: 16 }

const PUSHERS: { id: Button; side: 'left' | 'right'; y: number; label: string }[] = [
  { id: 'A', side: 'left', y: 184, label: 'Button A (upper left)' },
  { id: 'C', side: 'left', y: 376, label: 'Button C (lower left)' },
  { id: 'B', side: 'right', y: 184, label: 'Button B (upper right)' },
  { id: 'D', side: 'right', y: 376, label: 'Button D (lower right)' },
]

function Pusher({
  id,
  side,
  y,
  label,
  pressed,
  onPress,
  onRelease,
}: (typeof PUSHERS)[number] & { pressed: boolean } & Pick<Props, 'onPress' | 'onRelease'>) {
  const x = side === 'left' ? 28 : 396
  const hitX = side === 'left' ? 0 : 384
  const down = (e: PointerEvent<SVGGElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    onPress(id, e.shiftKey)
  }
  const up = (e: PointerEvent<SVGGElement>) => {
    e.preventDefault()
    onRelease(id)
  }
  return (
    <g
      className="sk-pusher"
      data-side={side}
      data-pressed={pressed}
      role="button"
      aria-label={label}
      aria-pressed={pressed}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      <rect className="sk-pusher-hit" x={hitX} y={y - 14} width={56} height={68} />
      <g className="sk-pusher-move">
        <rect className="sk-pusher-body" x={x} y={y} width={16} height={40} rx={5} />
        {[12, 18, 24].map((dy) => (
          <rect key={dy} className="sk-pusher-ridge" x={x + 3} y={y + dy} width={10} height={2} rx={1} />
        ))}
      </g>
    </g>
  )
}

function KeyHint({ x, y, k, pressed }: { x: number; y: number; k: string; pressed: boolean }) {
  return (
    <g className="sk-keyhint" data-pressed={pressed} aria-hidden="true">
      <rect className="sk-keycap" x={x} y={y} width={18} height={18} rx={4} />
      <text className="sk-keycap-text" x={x + 9} y={y + 12.5} textAnchor="middle">
        {k}
      </text>
    </g>
  )
}

function Indicators({ face }: { face: FaceContent }) {
  const cls = (on: boolean) => (on ? 'sk-ink' : 'sk-ghost')
  const stroke = (on: boolean) => (on ? 'sk-ink-stroke' : 'sk-ghost-stroke')
  const { session, request, wrist } = face.indicators
  return (
    <g>
      <g aria-label={session ? 'Secure session open' : undefined}>
        <path className={stroke(session)} strokeWidth={1.6} d="M15 19v-3a3.5 3.5 0 0 1 7 0v3" />
        <rect className={cls(session)} x={13} y={19} width={11} height={8} rx={1.5} />
      </g>
      <g aria-label={request ? 'Sign request pending' : undefined}>
        <rect className={stroke(request)} strokeWidth={1.4} x={31} y={16.5} width={13} height={10} rx={1.2} />
        <path className={stroke(request)} strokeWidth={1.4} d="M31.5 17.5l6 4.6 6-4.6" />
      </g>
      <g aria-label={wrist ? 'On wrist' : undefined}>
        <rect className={cls(wrist)} x={239} y={14} width={6} height={4} />
        <rect className={stroke(wrist)} strokeWidth={1.4} x={236.5} y={18.5} width={11} height={7} rx={1.5} />
        <rect className={cls(wrist)} x={239} y={26} width={6} height={4} />
      </g>
      <g>
        <rect className="sk-ink-stroke" strokeWidth={1.4} x={253.5} y={17.5} width={16} height={9} rx={1.2} />
        <rect className="sk-ink" x={270} y={20} width={2} height={4} />
        {[0, 1, 2].map((i) => (
          <rect key={i} className="sk-ink" x={255.5 + i * 4.3} y={19.5} width={3.4} height={5} />
        ))}
      </g>
    </g>
  )
}

export function Watch({ face, pressed, keyFor, onPress, onRelease }: Props) {
  const grid = useMemo(() => composeLines(face.lines), [face.lines])
  const tagGrid = useMemo(() => {
    const g = emptyGrid(8, 11)
    if (face.tag) drawText(g, face.tag, 0, 0)
    return g
  }, [face.tag])

  return (
    <svg
      className={`sk-watch${face.lit ? ' sk-lit' : ''}`}
      viewBox="0 0 520 600"
      role="img"
      aria-label="SEKUND watch"
    >
      <g transform={`translate(${OFFSET_X} 0)`}>
        {/* Strap */}
        <rect className="sk-strap" x={124} y={0} width={192} height={140} />
        <rect className="sk-strap" x={124} y={460} width={192} height={140} />
        {Array.from({ length: 6 }, (_, i) => (
          <g key={i}>
            <rect className="sk-strap-rib" x={124} y={8 + i * 15} width={192} height={5} />
            <rect className="sk-strap-rib" x={124} y={500 + i * 15} width={192} height={5} />
          </g>
        ))}

        {/* Case */}
        <rect className="sk-lug" x={104} y={94} width={232} height={50} rx={14} />
        <rect className="sk-lug" x={104} y={456} width={232} height={50} rx={14} />
        <rect className="sk-case" x={44} y={116} width={352} height={368} rx={62} />
        <rect className="sk-bezel" x={60} y={132} width={320} height={336} rx={48} />
        <text className="sk-brand" x={220 + 2} y={161} textAnchor="middle">
          SEKUND
        </text>
        <rect className="sk-accent-tick" x={370} y={392} width={6} height={8} rx={1} />

        {/* LCD */}
        <rect className="sk-lcd-frame" x={LCD.x - 6} y={LCD.y - 6} width={LCD.w + 12} height={LCD.h + 12} rx={LCD.r + 5} />
        <g transform={`translate(${LCD.x} ${LCD.y})`}>
          <rect className="sk-lcd" width={LCD.w} height={LCD.h} rx={LCD.r} />
          <Indicators face={face} />
          <DotMatrix grid={grid} x={8} y={36} pitch={2.75} />
          <rect className="sk-ghost" x={10} y={148} width={LCD.w - 20} height={1.5} />
          {face.tag && <DotMatrix grid={tagGrid} x={229} y={160} pitch={2} />}
          <SegmentDisplay {...face.segment} x={7} y={160} />
        </g>

        {PUSHERS.map((p) => (
          <Pusher key={p.id} {...p} pressed={pressed.has(p.id)} onPress={onPress} onRelease={onRelease} />
        ))}
      </g>

      {PUSHERS.map((p) => (
        <KeyHint
          key={p.id}
          x={p.side === 'left' ? 10 : 492}
          y={p.y + 11}
          k={keyFor[p.id]}
          pressed={pressed.has(p.id)}
        />
      ))}
    </svg>
  )
}
