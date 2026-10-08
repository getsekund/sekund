import { RoundedBox } from '@react-three/drei'
import { type Ref, useMemo } from 'react'
import { DoubleSide, ExtrudeGeometry, type Mesh, Path, Shape, ShapeGeometry } from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { CASE } from '@/face/Watch'
import { WORDMARK_PATH, WORDMARK_VIEWBOX } from '@/face/wordmark'
import { BEZEL, BEZEL_FRONT, CASE_DEPTH, CASE_FRONT, COLOR, GLASS, LCD_3D, roundedRect, vs, vx, vy } from './geometry'

/** Matte black resin: no gloss, no environment, no clearcoat. */
function Resin({ color = COLOR.resin }: { color?: string }) {
  return <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
}

function caseGeometry() {
  const bevel = 0.07
  const shape = roundedRect(vs(CASE.w) - 2 * bevel, vs(CASE.h) - 2 * bevel, vs(CASE.r) - bevel, new Shape())
  const g = new ExtrudeGeometry(shape, {
    depth: CASE_DEPTH - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 24,
  })
  g.translate(0, 0, -CASE_DEPTH / 2 + bevel)
  return g
}

/** The raised bezel plate with the glass window cut through it, so the LCD sits recessed. */
function bezelGeometry() {
  const bevel = 0.018
  const shape = roundedRect(BEZEL.w - 2 * bevel, BEZEL.h - 2 * bevel, BEZEL.r - bevel, new Shape())
  shape.holes.push(roundedRect(GLASS.w + 2 * bevel, GLASS.h + 2 * bevel, GLASS.r + bevel, new Path(), GLASS.y))
  const g = new ExtrudeGeometry(shape, {
    depth: BEZEL.depth - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 20,
  })
  g.translate(0, 0, bevel)
  return g
}

/** Lug from the 2D path M80 58 L104 34 H256 L280 58, mirrored for the bottom. */
function lugGeometry(flip: 1 | -1) {
  const shape = new Shape()
  const pts: [number, number][] = [
    [80, 58],
    [104, 34],
    [256, 34],
    [280, 58],
  ]
  pts.forEach(([x, y], i) => {
    const wy = flip * vy(y)
    if (i === 0) shape.moveTo(vx(x), wy)
    else shape.lineTo(vx(x), wy)
  })
  shape.closePath()
  const bevel = 0.03
  const g = new ExtrudeGeometry(shape, {
    depth: 0.5 - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
  })
  g.translate(0, 0, -0.36 + bevel)
  return g
}

function wordmarkGeometry() {
  const [, , vbW = 1, vbH = 1] = WORDMARK_VIEWBOX.split(' ').map(Number)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${WORDMARK_VIEWBOX}"><path d="${WORDMARK_PATH}"/></svg>`
  const shapes = new SVGLoader().parse(svg).paths.flatMap((p) => p.toShapes())
  const g = new ShapeGeometry(shapes, 6)
  const box = { x: 132, y: 77, w: 96, h: 22 }
  const s = Math.min(vs(box.w) / vbW, vs(box.h) / vbH)
  g.scale(s, -s, 1)
  g.translate(vx(box.x + box.w / 2) - (vbW * s) / 2, vy(box.y + box.h / 2) + (vbH * s) / 2, 0)
  return g
}

/** Strap groove offsets from the 2D watch, in viewBox units from the strap end. */
const GROOVES = [10, 24, 38]

function Strap({ end }: { end: 'top' | 'bottom' }) {
  const dir = end === 'top' ? 1 : -1
  const root = vy(60) * dir
  const length = 1.5
  const width = vs(168)
  const thick = 0.14
  return (
    <group position={[0, root, -0.14]} rotation={[-dir * 0.16, 0, 0]}>
      <RoundedBox args={[width, length, thick]} radius={0.03} smoothness={3} position={[0, (dir * length) / 2, 0]}>
        <Resin color={COLOR.strap} />
      </RoundedBox>
      {GROOVES.map((g) => (
        <mesh key={g} position={[0, dir * vs(60 - g), 0]}>
          <boxGeometry args={[width - 0.02, vs(2), thick + 0.006]} />
          <meshStandardMaterial color={COLOR.groove} roughness={1} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}

export function WatchModel({ caseRef, bezelRef }: { caseRef: Ref<Mesh>; bezelRef: Ref<Mesh> }) {
  const geo = useMemo(
    () => ({
      case: caseGeometry(),
      bezel: bezelGeometry(),
      lugTop: lugGeometry(1),
      lugBottom: lugGeometry(-1),
      wordmark: wordmarkGeometry(),
      glass: new ShapeGeometry(roundedRect(GLASS.w, GLASS.h, GLASS.r, new Shape(), GLASS.y), 12),
      lcd: new ShapeGeometry(roundedRect(LCD_3D.w, LCD_3D.h, vs(6), new Shape(), LCD_3D.y), 8),
    }),
    [],
  )
  return (
    <group>
      <Strap end="top" />
      <Strap end="bottom" />
      <mesh geometry={geo.lugTop}>
        <Resin />
      </mesh>
      <mesh geometry={geo.lugBottom}>
        <Resin />
      </mesh>
      <mesh ref={caseRef} geometry={geo.case}>
        <Resin />
      </mesh>
      <mesh ref={bezelRef} geometry={geo.bezel} position={[0, 0, CASE_FRONT - 0.004]}>
        <Resin color={COLOR.resin2} />
      </mesh>
      <mesh geometry={geo.wordmark} position={[0, 0, BEZEL_FRONT + 0.002]}>
        <meshBasicMaterial color={COLOR.wordmark} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh geometry={geo.glass} position={[0, 0, CASE_FRONT + 0.002]}>
        <meshStandardMaterial color={COLOR.glass} roughness={0.7} metalness={0} />
      </mesh>
      {/* Under the live LCD, so the window never shows empty while the DOM face catches up. */}
      <mesh geometry={geo.lcd} position={[0, 0, LCD_3D.z - 0.001]}>
        <meshBasicMaterial color={COLOR.lcd} toneMapped={false} />
      </mesh>
    </group>
  )
}
