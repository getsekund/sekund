import { useId, useMemo } from 'react'
import type { Grid } from './matrix'

interface Props {
  grid: Grid
  x: number
  y: number
  pitch: number
  /** Dot size as a fraction of the pitch. */
  fill?: number
}

/** Renders a dot grid as one ghost pattern plus a single path for lit dots. */
export function DotMatrix({ grid, x, y, pitch, fill = 0.84 }: Props) {
  const id = useId().replace(/:/g, '')
  const dot = pitch * fill
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  const path = useMemo(() => {
    let d = ''
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r]?.[c]) d += `M${(c * pitch).toFixed(2)} ${(r * pitch).toFixed(2)}h${dot.toFixed(2)}v${dot.toFixed(2)}h${(-dot).toFixed(2)}z`
      }
    }
    return d
  }, [grid, rows, cols, pitch, dot])

  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <pattern id={`dots-${id}`} width={pitch} height={pitch} patternUnits="userSpaceOnUse">
          <rect className="sk-ghost" width={dot} height={dot} />
        </pattern>
      </defs>
      <rect width={cols * pitch} height={rows * pitch} fill={`url(#dots-${id})`} />
      <path className="sk-ink" d={path} />
    </g>
  )
}
