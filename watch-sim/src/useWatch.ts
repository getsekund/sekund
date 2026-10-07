import { useEffect, useMemo, useReducer, useSyncExternalStore } from 'react'
import type { WatchController } from '@/machine/controller'
import { type Button, GestureRecognizer } from '@/machine/gestures'

/** DESIGN.md §5 keyboard map. Space is C + D. */
export const KEYS: Record<Button, string> = { A: '←', B: '→', C: 'Esc', D: 'Enter' }
const BUTTON_FOR_KEY: Record<string, Button> = {
  a: 'A',
  arrowleft: 'A',
  b: 'B',
  arrowright: 'B',
  c: 'C',
  escape: 'C',
  d: 'D',
  enter: 'D',
}
const TICK_MS = 125

function buttonsFor(e: KeyboardEvent): Button[] {
  const key = e.key.toLowerCase()
  const target = e.target instanceof HTMLElement ? e.target : null
  const focusedPusher = target?.dataset.button as Button | undefined
  if (focusedPusher && (key === 'enter' || key === ' ')) return [focusedPusher]
  if (key === ' ') return ['C', 'D']
  const b = BUTTON_FOR_KEY[key]
  return b ? [b] : []
}

/** Enter, Space and arrows belong to whatever other control has focus. */
function ownedByFocus(e: KeyboardEvent): boolean {
  const t = e.target
  if (!(t instanceof HTMLElement) || t.dataset.button) return false
  if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return true
  const interactive = /^(BUTTON|A|SUMMARY)$/.test(t.tagName) || t.getAttribute('role') === 'switch'
  return interactive && /^(enter| |arrowleft|arrowright)$/.test(e.key.toLowerCase())
}

export function useWatch(controller: WatchController) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  const recognizer = useMemo(
    () => new GestureRecognizer((g) => controller.press(g), rerender),
    [controller],
  )

  useEffect(() => {
    const id = window.setInterval(() => controller.tick(), TICK_MS)
    return () => window.clearInterval(id)
  }, [controller])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || ownedByFocus(e)) return
      if (e.key.toLowerCase() === 'w') {
        if (!e.repeat) controller.setWrist(!controller.state.onWrist)
        return
      }
      const buttons = buttonsFor(e)
      if (buttons.length === 0) return
      e.preventDefault()
      if (!e.repeat) for (const b of buttons) recognizer.press(b)
    }
    const up = (e: KeyboardEvent) => {
      for (const b of buttonsFor(e)) recognizer.release(b)
    }
    const blur = () => recognizer.cancel()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [controller, recognizer])

  return {
    state,
    pressed: recognizer.pressed,
    onPress: (b: Button, latch: boolean) => (latch ? recognizer.latch(b) : recognizer.press(b)),
    onRelease: (b: Button) => recognizer.release(b),
    chord: (...b: Button[]) => controller.press([...b].sort()),
  }
}
