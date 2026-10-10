/**
 * Ordered (Bayer) dithering, written for SEKUND. One bit per cell: ink or ground.
 * Not the dither-kit package and not its assets; the look is reproduced, not imported.
 */

/** Classic 8×8 Bayer matrix, values 0..63. Row-major. */
export const BAYER8: readonly number[] = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
];

/** Threshold in (0, 1) for the cell at integer grid position x, y. */
export function threshold(x: number, y: number): number {
  const level = BAYER8[(y & 7) * 8 + (x & 7)] ?? 0;
  return (level + 0.5) / 64;
}

/** A cell is ink when its wanted coverage beats the matrix at that position. */
export function on(coverage: number, x: number, y: number): boolean {
  return coverage > threshold(x, y);
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Rec. 601 luma from 0..255 channels, returned in 0..1. */
export function luma(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export interface Tone {
  /** 1 keeps the source; above 1 pushes mid-tones apart. */
  contrast?: number;
  /** Gamma applied after contrast; below 1 lightens. */
  gamma?: number;
  /** Swap ink and ground. */
  invert?: boolean;
}

export function tone(v: number, t: Tone): number {
  const c = t.contrast ?? 1;
  let out = clamp01((v - 0.5) * c + 0.5);
  const g = t.gamma ?? 1;
  if (g !== 1) out = Math.pow(out, g);
  return t.invert ? 1 - out : out;
}
