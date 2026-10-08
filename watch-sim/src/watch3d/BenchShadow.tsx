import { useEffect, useMemo } from 'react'
import { CanvasTexture } from 'three'
import { CASE } from '@/face/Watch'
import { COLOR, vs } from './geometry'

/*
 * The 2D watch's --sk-shadow-object (0 28px 36px -24px, 45%), baked once into a texture
 * on a plane behind the case. It stays on the bench while the watch tilts.
 */
const SHADOW = { offsetY: 0.28, blur: 0.36, spread: 0.24, alpha: 0.45 }
const PLANE = { w: 4.4, h: 5.4 }

const PX_PER_UNIT = 100

/** Coverage of a rounded rectangle blurred like CSS box-shadow (sigma = blur / 2), from its signed distance. */
function bake(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(PLANE.w * PX_PER_UNIT)
  canvas.height = Math.round(PLANE.h * PX_PER_UNIT)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const hw = vs(CASE.w) / 2 - SHADOW.spread
    const hh = vs(CASE.h) / 2 - SHADOW.spread
    const r = Math.max(0, vs(CASE.r) - SHADOW.spread)
    const sigma = SHADOW.blur / 2
    const img = ctx.createImageData(canvas.width, canvas.height)
    for (let j = 0; j < canvas.height; j++) {
      const py = Math.abs((j + 0.5) / PX_PER_UNIT - PLANE.h / 2)
      for (let i = 0; i < canvas.width; i++) {
        const px = Math.abs((i + 0.5) / PX_PER_UNIT - PLANE.w / 2)
        const qx = px - (hw - r)
        const qy = py - (hh - r)
        const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
        // 0.5 * (1 - erf(d / (sigma * sqrt 2))), with erf(x) ≈ tanh(1.2025 x).
        const a = 0.5 * (1 - Math.tanh((1.2025 * d) / (sigma * Math.SQRT2)))
        const k = (j * canvas.width + i) * 4
        const v = Math.round(a * 255)
        img.data[k] = v
        img.data[k + 1] = v
        img.data[k + 2] = v
        img.data[k + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }
  return new CanvasTexture(canvas)
}

export function BenchShadow() {
  const texture = useMemo(bake, [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={[0, -SHADOW.offsetY, -0.5]}>
      <planeGeometry args={[PLANE.w, PLANE.h]} />
      <meshBasicMaterial
        color={COLOR.shadow}
        alphaMap={texture}
        transparent
        opacity={SHADOW.alpha}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}
