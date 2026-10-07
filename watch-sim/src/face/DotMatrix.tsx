import { useMemo } from 'react'
import { type Dot, STRIP_CELLS, stripDots, type StripText } from './strip'

interface Props {
  lines: StripText
  x: number
  y: number
  pitch: number
  dot: number
}

function path(dots: readonly Dot[], pitch: number, dot: number): string {
  const s = dot.toFixed(2)
  return dots.map((d) => `M${(d.col * pitch).toFixed(2)} ${(d.row * pitch).toFixed(2)}h${s}v${s}h-${s}z`).join('')
}

/** The 5×7 review strip: every cell faintly visible, lit dots in segment ink. */
export function DotMatrix({ lines, x, y, pitch, dot }: Props) {
  const ghost = useMemo(() => path(STRIP_CELLS, pitch, dot), [pitch, dot])
  const lit = useMemo(() => path(stripDots(lines), pitch, dot), [lines, pitch, dot])
  return (
    <g transform={`translate(${x} ${y})`}>
      <path className="sk-ghost" d={ghost} />
      <path className="sk-seg" d={lit} />
    </g>
  )
}
