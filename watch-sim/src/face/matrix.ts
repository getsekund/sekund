import { GLYPH_H, GLYPH_W, glyph } from './font5x8'

/** The review strip: 16 characters × 4 lines of 5×8 glyphs with 1-dot gaps. */
export const MATRIX_COLS = 96
export const LINE_SLOTS = 4
const SLOT_ROWS = 10
export const MATRIX_ROWS = LINE_SLOTS * SLOT_ROWS - 2
export const CHARS_PER_LINE = 16

export interface MatrixLine {
  text: string
  /** Optional text aligned to the right edge on the same line. */
  right?: string
  align?: 'left' | 'center' | 'right'
  /** 2 = double size, spanning this slot and the next. */
  size?: 1 | 2
  /** Draws a one-dot rule under the line (headers). */
  rule?: boolean
}

export type Grid = boolean[][]

export function emptyGrid(rows = MATRIX_ROWS, cols = MATRIX_COLS): Grid {
  return Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false))
}

function textWidth(text: string, scale: number): number {
  const n = [...text].length
  return n === 0 ? 0 : (n * (GLYPH_W + 1) - 1) * scale
}

export function drawText(grid: Grid, text: string, x: number, y: number, scale = 1, value = true): void {
  let cx = x
  for (const ch of text) {
    const g = glyph(ch)
    for (let r = 0; r < GLYPH_H; r++) {
      for (let c = 0; c < GLYPH_W; c++) {
        if (!g[r]?.[c]) continue
        for (let dy = 0; dy < scale; dy++) {
          const row = grid[y + r * scale + dy]
          if (!row) continue
          for (let dx = 0; dx < scale; dx++) {
            const col = cx + c * scale + dx
            if (col >= 0 && col < row.length) row[col] = value
          }
        }
      }
    }
    cx += (GLYPH_W + 1) * scale
  }
}

/** Lays out up to four lines (a size-2 line uses two slots) onto the strip. */
export function composeLines(lines: (MatrixLine | null)[]): Grid {
  const grid = emptyGrid()
  let slot = 0
  for (const line of lines) {
    if (slot >= LINE_SLOTS) break
    if (!line) {
      slot++
      continue
    }
    const scale = line.size === 2 ? 2 : 1
    const top = slot * SLOT_ROWS
    const width = textWidth(line.text, scale)
    const align = line.align ?? 'left'
    const x =
      align === 'center' ? Math.floor((MATRIX_COLS - width) / 2) : align === 'right' ? MATRIX_COLS - width : 0
    drawText(grid, line.text, x, scale === 2 ? top + 1 : top, scale)
    if (line.right) drawText(grid, line.right, MATRIX_COLS - textWidth(line.right, 1), top, 1)
    if (line.rule) grid[top + GLYPH_H]?.fill(true)
    slot += scale
  }
  return grid
}

/** Splits text into strip-width lines (used for base58 addresses). */
export function chunk(text: string, size = CHARS_PER_LINE): string[] {
  const out: string[] = []
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
  return out
}
