/**
 * Coverage fields for the dithered backgrounds. Each returns wanted ink coverage in 0..1
 * for a point (u, v) in 0..1 and a time t in seconds. They are cheap on purpose: every
 * field runs once per cell per frame.
 */

export type Field = (u: number, v: number, t: number) => number;

/** Nothing on the left, growing to a dense (never solid) field at the right edge. A slow breath moves the start. */
export const fade: Field = (u, _v, t) => {
  const start = 0.3 + 0.05 * Math.sin(t * 0.35);
  const x = (u - start) / (1 - start);
  return x <= 0 ? 0 : Math.min(0.62, x * x * 0.7);
};

/** Rings that expand from a point on the right and reset, like a signal pulse. */
export const pulse: Field = (u, v, t) => {
  const dx = (u - 0.74) * 1.78;
  const dy = v - 0.5;
  const r = Math.sqrt(dx * dx + dy * dy);
  const phase = ((t + 3.4) * 0.11) % 1;
  const d = Math.abs(r - phase * 1.2);
  const ring = Math.max(0, 1 - d * 10);
  const base = Math.max(0, 0.14 - r * 0.16);
  return Math.min(0.75, base + ring * 0.5);
};

/** Diagonal bands drifting slowly; reads as motion without pulling the eye. */
export const bands: Field = (u, v, t) => {
  const s = Math.sin((u * 1.7 + v * 0.9) * 6.28 - t * 0.25);
  return 0.1 + 0.09 * s;
};

/** Horizon: dark top, dense at the bottom edge, a faint wave on the horizon line. */
export const horizon: Field = (u, v, t) => {
  const line = 0.3 + 0.04 * Math.sin(u * 9 + t * 0.4);
  const below = (v - line) / (1 - line);
  return below <= 0 ? 0.015 : Math.min(0.55, below * below * 0.6 + 0.015);
};

/** A still radial vignette: bright at the centre, quickly nothing. */
export const spot: Field = (u, v) => {
  const dx = (u - 0.5) * 1.78;
  const dy = v - 0.5;
  const r = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, 0.5 - r * 0.9);
};
