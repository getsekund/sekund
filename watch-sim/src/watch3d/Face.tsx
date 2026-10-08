import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import type { Object3D, PerspectiveCamera } from 'three'
import { LcdPanel } from '@/face/Watch'
import type { FaceContent } from '@/face/screens'
import { LCD_3D } from './geometry'

/** drei maps one CSS pixel of transformed Html to distanceFactor / 400 world units. */
const HTML_UNITS_PER_PX = 1 / 400

/**
 * The existing LCD, laid out at the pixel size it will occupy on screen at rest,
 * so the browser rasterises the segments at about 1:1 instead of scaling a bitmap.
 */
export function Face({
  face,
  occlude,
  container,
}: {
  face: FaceContent
  occlude: RefObject<Object3D | null>[]
  /** A fixed host element. Without it drei re-creates its root when R3F connects events, and React 19 drops the content. */
  container: RefObject<HTMLElement | null>
}) {
  const height = useThree((s) => s.size.height)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const distance = Math.max(1, camera.position.length() - LCD_3D.z)
  const visible = 2 * distance * Math.tan((camera.fov * Math.PI) / 360)
  const pxPerUnit = height / visible
  const w = Math.max(1, Math.round(LCD_3D.w * pxPerUnit))
  const h = Math.max(1, Math.round(LCD_3D.h * pxPerUnit))
  return (
    <Html
      transform
      occlude={occlude as RefObject<Object3D>[]}
      position={[0, LCD_3D.y, LCD_3D.z]}
      distanceFactor={LCD_3D.w / (w * HTML_UNITS_PER_PX)}
      pointerEvents="none"
      zIndexRange={[1, 0]}
      wrapperClass="sk-face-3d"
      portal={container as RefObject<HTMLElement>}
    >
      <div data-testid="face-3d" style={{ width: w, height: h }}>
        <LcdPanel face={face} width={w} height={h} />
      </div>
    </Html>
  )
}
