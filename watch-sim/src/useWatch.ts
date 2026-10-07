import { useEffect, useMemo, useReducer, useSyncExternalStore } from 'react'
import type { WatchController } from '@/machine/controller'
import { type Button, GestureRecognizer } from '@/machine/gestures'

export const KEY_FOR: Record<Button, string> = { A: 'A', B: 'B', C: 'C', D: 'D' }
const BUTTON_FOR_KEY: Record<string, Button> = { a: 'A', b: 'B', c: 'C', d: 'D' }
const TICK_MS = 125

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
    const typing = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || typing(e)) return
      const key = e.key.toLowerCase()
      if (key === 'w') {
        controller.setWrist(!controller.state.onWrist)
        return
      }
      const b = BUTTON_FOR_KEY[key]
      if (b) {
        e.preventDefault()
        recognizer.press(b)
      }
    }
    const up = (e: KeyboardEvent) => {
      const b = BUTTON_FOR_KEY[e.key.toLowerCase()]
      if (b) recognizer.release(b)
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
