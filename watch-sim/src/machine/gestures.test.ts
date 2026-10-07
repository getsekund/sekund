import { describe, expect, it } from 'vitest'
import { type Gesture, GestureRecognizer } from './gestures'

function recorder() {
  const out: Gesture[] = []
  const r = new GestureRecognizer((g) => out.push(g))
  return { r, out }
}

describe('GestureRecognizer', () => {
  it('emits a single button on release', () => {
    const { r, out } = recorder()
    r.press('A')
    expect(out).toEqual([])
    r.release('A')
    expect(out).toEqual([['A']])
  })

  it('emits a chord when two buttons overlap, in either release order', () => {
    const { r, out } = recorder()
    r.press('D')
    r.press('C')
    r.release('D')
    expect(out).toEqual([])
    r.release('C')
    r.press('A')
    r.press('D')
    r.release('A')
    r.release('D')
    expect(out).toEqual([
      ['C', 'D'],
      ['A', 'D'],
    ])
  })

  it('latch (shift-click) holds a button until the next gesture fires', () => {
    const { r, out } = recorder()
    r.latch('C')
    expect(r.pressed.has('C')).toBe(true)
    r.press('D')
    r.release('D')
    expect(out).toEqual([['C', 'D']])
    expect(r.pressed.size).toBe(0)
  })

  it('latching twice un-latches without emitting', () => {
    const { r, out } = recorder()
    r.latch('A')
    r.latch('A')
    r.press('B')
    r.release('B')
    expect(out).toEqual([['B']])
  })

  it('ignores key repeat and stray releases', () => {
    const { r, out } = recorder()
    r.release('B')
    r.press('B')
    r.press('B')
    r.release('B')
    expect(out).toEqual([['B']])
  })
})
