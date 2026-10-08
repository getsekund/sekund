import { Shape, type Path } from 'three'
import { CASE, LCD, PUSHER, PUSHERS, VIEW } from '@/face/Watch'
import type { Button } from '@/machine/gestures'

/* One world unit is 100 viewBox units of the 2D watch, centred on the case. */
export const vx = (x: number) => (x - VIEW.w / 2) / 100
export const vy = (y: number) => (VIEW.h / 2 - y) / 100
export const vs = (v: number) => v / 100

/* Same literals in light and dark: the case is black resin in both themes. */
export const COLOR = {
  resin: '#1c1d1f',
  resin2: '#2a2b2e',
  strap: '#19191b',
  groove: '#121314',
  glass: '#111214',
  lcd: '#b4bca6',
  steel: '#8e9092',
  steelEdge: '#5e6163',
  wordmark: '#e9eae4',
  shadow: '#141517',
} as const

export const CASE_DEPTH = 0.8
export const CASE_FRONT = CASE_DEPTH / 2
export const BEZEL = { w: vs(268), h: vs(338), r: vs(28), depth: 0.08 }
export const BEZEL_FRONT = CASE_FRONT + BEZEL.depth
export const GLASS = { w: vs(236), h: vs(252), r: vs(10), y: vy(108 + 252 / 2) }
export const LCD_3D = { w: vs(LCD.w), h: vs(LCD.h), y: vy(LCD.y + LCD.h / 2), z: CASE_FRONT + 0.004 }
export const PUSHER_TRAVEL = 0.04

export interface PusherSpot {
  id: Button
  side: 'left' | 'right'
  /** Centre of the cap at rest. */
  position: [number, number, number]
}

const capWidth = vs(PUSHER.w - 4)
export const PUSHER_CAP = { w: capWidth, h: vs(PUSHER.h), d: 0.3 }

export const PUSHER_SPOTS: PusherSpot[] = PUSHERS.map((p) => {
  const caseEdge = p.side === 'left' ? vx(CASE.x) : vx(CASE.x + CASE.w)
  const out = p.side === 'left' ? -1 : 1
  const x = caseEdge + out * (capWidth / 2 - 0.01)
  return { id: p.id, side: p.side, position: [x, vy(p.y + PUSHER.h / 2), 0] }
})

/** Rounded rectangle centred on (0, cy), counter-clockwise. */
export function roundedRect<T extends Shape | Path>(w: number, h: number, r: number, target: T, cy = 0): T {
  const x = -w / 2
  const y = cy - h / 2
  target.moveTo(x + r, y)
  target.lineTo(x + w - r, y)
  target.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  target.lineTo(x + w, y + h - r)
  target.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  target.lineTo(x + r, y + h)
  target.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  target.lineTo(x, y + r)
  target.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return target
}
