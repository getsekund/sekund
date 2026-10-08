import { RoundedBox } from '@react-three/drei'
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { type Group, MathUtils } from 'three'
import type { Button } from '@/machine/gestures'
import { COLOR, PUSHER_CAP, PUSHER_SPOTS, PUSHER_TRAVEL } from './geometry'

/** Native pointerdowns a pusher took, so the tilt drag on the same event stands aside. */
export const claimedPointers = new WeakSet<Event>()

export interface PusherHandlers {
  onPress(button: Button, latch: boolean): void
  onRelease(button: Button): void
}

interface Props {
  pressed: ReadonlySet<Button>
  handlers: { current: PusherHandlers }
  onHover(on: boolean): void
}

/** Hit volume around each cap: about 50 px on a 360 px watch, over the 44 px minimum. */
const HIT = { w: 0.5, h: 0.52, d: 0.7 }

export function Pushers({ pressed, handlers, onHover }: Props) {
  const caps = useRef<Partial<Record<Button, Group | null>>>({})
  const held = useRef(new Map<number, Button>())
  const invalidate = useThree((s) => s.invalidate)

  // The recognizer mutates one Set, so key the effect on its contents.
  const pressedKey = [...pressed].sort().join('')
  useEffect(() => invalidate(), [pressedKey, invalidate])

  // Release on the window, so a press that slides off the cap still lets go.
  useEffect(() => {
    const up = (e: PointerEvent) => {
      const b = held.current.get(e.pointerId)
      if (!b) return
      held.current.delete(e.pointerId)
      handlers.current.onRelease(b)
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [handlers])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    let moving = false
    for (const spot of PUSHER_SPOTS) {
      const cap = caps.current[spot.id]
      if (!cap) continue
      const inward = spot.side === 'left' ? 1 : -1
      const target = pressed.has(spot.id) ? inward * PUSHER_TRAVEL : 0
      cap.position.x = MathUtils.damp(cap.position.x, target, 40, dt)
      if (Math.abs(cap.position.x - target) > 1e-4) moving = true
      else cap.position.x = target
    }
    if (moving) invalidate()
  })

  const down = (id: Button) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    claimedPointers.add(e.nativeEvent)
    if (e.nativeEvent.pointerType === 'mouse' && e.nativeEvent.button !== 0) return
    e.nativeEvent.preventDefault()
    held.current.set(e.pointerId, id)
    handlers.current.onPress(id, e.nativeEvent.shiftKey)
  }

  return (
    <group>
      {PUSHER_SPOTS.map((spot) => {
        const out = spot.side === 'left' ? -1 : 1
        return (
          <group key={spot.id} position={spot.position}>
            <group
              ref={(g) => {
                caps.current[spot.id] = g
              }}
            >
              <RoundedBox args={[PUSHER_CAP.w, PUSHER_CAP.h, PUSHER_CAP.d]} radius={0.035} smoothness={3}>
                <meshStandardMaterial color={COLOR.steel} roughness={0.55} metalness={0.15} />
              </RoundedBox>
              <mesh position={[out * (PUSHER_CAP.w / 2 + 0.002), -PUSHER_CAP.h / 2 + 0.03, 0]}>
                <boxGeometry args={[0.004, 0.06, PUSHER_CAP.d - 0.07]} />
                <meshStandardMaterial color={COLOR.steelEdge} roughness={0.7} metalness={0} />
              </mesh>
            </group>
            <mesh
              name={`pusher-${spot.id}`}
              position={[out * 0.08, 0, 0]}
              onPointerDown={down(spot.id)}
              onPointerOver={(e) => {
                e.stopPropagation()
                onHover(true)
              }}
              onPointerOut={() => onHover(false)}
            >
              <boxGeometry args={[HIT.w, HIT.h, HIT.d]} />
              <meshBasicMaterial colorWrite={false} depthWrite={false} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
