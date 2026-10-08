import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { type Group, MathUtils, type Mesh, Vector3 } from 'three'
import type { FaceContent } from '@/face/screens'
import type { Button } from '@/machine/gestures'
import { cn } from '@/lib/utils'
import { BenchShadow } from './BenchShadow'
import { Face } from './Face'
import { PUSHER_SPOTS } from './geometry'
import { claimedPointers, type PusherHandlers, Pushers } from './Pushers'
import { WatchModel } from './WatchModel'

export interface Watch3DProps extends PusherHandlers {
  face: FaceContent
  pressed: ReadonlySet<Button>
  labels: Record<Button, string>
  /** Until ready the scene lays out hidden over the 2D watch. */
  ready: boolean
  onReady(): void
  onLost(): void
}

/* Framed so the rest pose lines up with the 2D viewBox (4.7 units tall at the face). */
const FOV = 24
const ELEVATION = (7 * Math.PI) / 180
const DISTANCE = 11.5
const CAMERA: [number, number, number] = [0, DISTANCE * Math.sin(ELEVATION), DISTANCE * Math.cos(ELEVATION)]
const REST = { x: 0, y: -0.07 }
const LIMIT = { x: 0.17, y: 0.26 }

interface Tilt {
  target: { x: number; y: number }
  drag: { id: number; x: number; y: number } | null
  kick(): void
}

type Overlay = Partial<Record<Button, { focus: HTMLButtonElement | null; hint: HTMLSpanElement | null }>>

function useDarkTheme(): boolean {
  return useSyncExternalStore(
    (fn) => {
      const o = new MutationObserver(fn)
      o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      return () => o.disconnect()
    },
    () => document.documentElement.dataset.theme === 'dark',
  )
}

const scratch = new Vector3()

function Rig({
  tilt,
  overlay,
  children,
}: {
  tilt: RefObject<Tilt>
  overlay: RefObject<Overlay>
  children: React.ReactNode
}) {
  const group = useRef<Group>(null)
  const invalidate = useThree((s) => s.invalidate)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  useLayoutEffect(() => {
    camera.lookAt(0, 0, 0)
    tilt.current.kick = invalidate
  }, [camera, invalidate, tilt])

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 1 / 30)
    const tx = REST.x + tilt.current.target.x
    const ty = REST.y + tilt.current.target.y
    g.rotation.x = MathUtils.damp(g.rotation.x, tx, 9, dt)
    g.rotation.y = MathUtils.damp(g.rotation.y, ty, 9, dt)
    if (Math.abs(g.rotation.x - tx) + Math.abs(g.rotation.y - ty) > 1e-4) invalidate()
    g.updateMatrixWorld()
    // Keep the focus rings and keycap letters on the projected pushers.
    for (const spot of PUSHER_SPOTS) {
      const el = overlay.current[spot.id]
      if (!el) continue
      scratch.set(...spot.position).applyMatrix4(g.matrixWorld).project(camera)
      const left = `${((scratch.x + 1) / 2) * size.width}px`
      const top = `${((1 - scratch.y) / 2) * size.height}px`
      if (el.focus && el.focus.style.left !== left) el.focus.style.left = left
      if (el.focus && el.focus.style.top !== top) el.focus.style.top = top
      if (el.hint && el.hint.style.top !== top) el.hint.style.top = top
    }
  })

  return (
    <group ref={group} rotation={[REST.x, REST.y, 0]}>
      {children}
    </group>
  )
}

function FirstFrame({ onReady }: { onReady(): void }) {
  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(onReady)
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [onReady])
  return null
}

export default function Watch3D({ face, pressed, labels, ready, onReady, onLost, onPress, onRelease }: Watch3DProps) {
  const dark = useDarkTheme()
  const handlers = useRef<PusherHandlers>({ onPress, onRelease })
  handlers.current = { onPress, onRelease }
  const tilt = useRef<Tilt>({ target: { x: 0, y: 0 }, drag: null, kick: () => {} })
  const overlay = useRef<Overlay>({})
  const root = useRef<HTMLDivElement>(null)
  const caseRef = useRef<Mesh>(null)
  const bezelRef = useRef<Mesh>(null)
  const [hover, setHover] = useState(false)
  const [dragging, setDragging] = useState(false)

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (claimedPointers.has(e.nativeEvent) || tilt.current.drag) return
    if (e.target instanceof HTMLElement && e.target.closest('button')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    tilt.current.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = tilt.current.drag
    if (!drag || drag.id !== e.pointerId) return
    const box = e.currentTarget.getBoundingClientRect()
    tilt.current.target = {
      x: MathUtils.clamp(((e.clientY - drag.y) / box.height) * 0.9, -LIMIT.x, LIMIT.x),
      y: MathUtils.clamp(((e.clientX - drag.x) / box.width) * 1.1, -LIMIT.y, LIMIT.y),
    }
    tilt.current.kick()
  }
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (tilt.current.drag?.id !== e.pointerId) return
    tilt.current.drag = null
    tilt.current.target = { x: 0, y: 0 }
    tilt.current.kick()
    setDragging(false)
  }

  return (
    <div
      ref={root}
      className={cn('sk-watch sk-watch-3d', !ready && 'invisible absolute inset-0 mx-auto')}
      data-testid="watch-3d"
      data-ready={ready}
      data-dragging={dragging}
      data-hover={hover ? 'pusher' : undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        frameloop="demand"
        flat
        dpr={[1, 2]}
        camera={{ fov: FOV, position: CAMERA, near: 1, far: 30 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        aria-hidden="true"
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault()
            onLost()
          })
        }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[-2.5, 4.5, 6]} intensity={1.5} />
        <directionalLight position={[3, -2, 3]} intensity={0.35} />
        <Rig tilt={tilt} overlay={overlay}>
          <WatchModel caseRef={caseRef} bezelRef={bezelRef} />
          <Pushers pressed={pressed} handlers={handlers} onHover={setHover} />
          <Face face={face} occlude={[caseRef, bezelRef]} container={root} />
        </Rig>
        {/* The dark bench is solid #000, where any shadow would only lift the black. */}
        {!dark && <BenchShadow />}
        <FirstFrame onReady={onReady} />
      </Canvas>

      {PUSHER_SPOTS.map((p) => (
        <button
          key={p.id}
          ref={(el) => {
            overlay.current[p.id] = { ...overlay.current[p.id], focus: el, hint: overlay.current[p.id]?.hint ?? null }
          }}
          type="button"
          tabIndex={0}
          className="sk-pusher-hit sk-pusher-focus"
          data-button={p.id}
          aria-label={labels[p.id]}
          aria-pressed={pressed.has(p.id)}
        />
      ))}
      {PUSHER_SPOTS.map((p) => (
        <span
          key={p.id}
          ref={(el) => {
            overlay.current[p.id] = { focus: overlay.current[p.id]?.focus ?? null, hint: el }
          }}
          className="sk-keyhint"
          data-side={p.side}
          data-pressed={pressed.has(p.id)}
          aria-hidden="true"
        >
          {p.id}
        </span>
      ))}
    </div>
  )
}
