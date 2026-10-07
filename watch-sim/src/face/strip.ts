import { GLCD } from './glcdfont'

/** The review strip: 2 lines × 16 characters of 5×7 glyphs, 1 dot between characters, 2 between lines. */
export const STRIP_CHARS = 16
export const STRIP_LINES = 2
const GLYPH_W = 5
const GLYPH_H = 7
const CELL_W = GLYPH_W + 1
const CELL_H = GLYPH_H + 2

export type StripText = readonly [string, string]

export interface Dot {
  col: number
  row: number
}

/** Every dot position the strip has: the faint, always-visible cells. */
export const STRIP_CELLS: readonly Dot[] = (() => {
  const out: Dot[] = []
  for (let line = 0; line < STRIP_LINES; line++)
    for (let ch = 0; ch < STRIP_CHARS; ch++)
      for (let c = 0; c < GLYPH_W; c++)
        for (let r = 0; r < GLYPH_H; r++) out.push({ col: ch * CELL_W + c, row: line * CELL_H + r })
  return out
})()

/** Lit dots for two lines of text. Lines longer than 16 characters are a bug in the caller. */
export function stripDots(lines: StripText): Dot[] {
  const out: Dot[] = []
  lines.forEach((line, li) => {
    const text = line.padEnd(STRIP_CHARS, ' ')
    for (let ch = 0; ch < STRIP_CHARS; ch++) {
      const g = GLCD[text[ch] ?? ' '] ?? GLCD['?'] ?? []
      for (let c = 0; c < GLYPH_W; c++) {
        const bits = g[c] ?? 0
        for (let r = 0; r < GLYPH_H; r++) {
          if ((bits >> r) & 1) out.push({ col: ch * CELL_W + c, row: li * CELL_H + r })
        }
      }
    }
  })
  return out
}

export const right = (text: string) => text.padStart(STRIP_CHARS, ' ')

/** Splits text into strip lines of at most 16 characters. */
export function wrap(text: string): string[] {
  const out: string[] = []
  for (let i = 0; i < text.length; i += STRIP_CHARS) out.push(text.slice(i, i + STRIP_CHARS))
  return out
}

/** An address in full, in groups of four, three groups per line: two strip pages of two lines. */
export function addressPages(address: string): [StripText, StripText] {
  const groups = address.match(/.{1,4}/g) ?? []
  const lines: string[] = []
  for (let i = 0; i < groups.length; i += 3) lines.push(groups.slice(i, i + 3).join(' '))
  return [
    [lines[0] ?? '', lines[1] ?? ''],
    [lines[2] ?? '', lines[3] ?? ''],
  ]
}
