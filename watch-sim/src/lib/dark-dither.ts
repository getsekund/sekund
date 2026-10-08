/**
 * Colored ordered dither for the dark page ground.
 * Recreated for SEKUND. Not the dither-kit package and not its assets.
 * Bayer 4×4, square cells, dark ground, no blur and no bloom.
 */

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const GROUND: readonly [number, number, number] = [7, 8, 13];
const STOPS: readonly (readonly [number, number, number])[] = [
  [61, 126, 255],
  [138, 72, 255],
  [255, 78, 196],
  [255, 146, 64],
];

function threshold(x: number, y: number): number {
  const level = BAYER4[(y & 3) * 4 + (x & 3)] ?? 0;
  return (level + 0.5) / 16;
}

function stop(index: number): readonly [number, number, number] {
  return STOPS[index] ?? STOPS[0] ?? [61, 126, 255];
}

function mix(t: number): [number, number, number] {
  const scaled = Math.min(STOPS.length - 1, Math.max(0, t * (STOPS.length - 1)));
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = stop(i);
  const b = stop(Math.min(STOPS.length - 1, i + 1));
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Density of a still two-lobe field. Same input, same pixels. */
function tone(nx: number, ny: number): number {
  const a = Math.exp(-((nx - 0.22) ** 2 + (ny - 0.28) ** 2) / 0.09);
  const b = Math.exp(-((nx - 0.78) ** 2 + (ny - 0.72) ** 2) / 0.11);
  return Math.min(0.92, a * 0.85 + b * 0.75);
}

export function paintDarkDither(canvas: HTMLCanvasElement): void {
  const scale = Math.max(1, Math.round(window.devicePixelRatio || 1));
  const cell = 3 * scale;
  const width = Math.max(1, Math.ceil(window.innerWidth * scale));
  const height = Math.max(1, Math.ceil(window.innerHeight * scale));
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  canvas.style.width = `${canvas.width / scale}px`;
  canvas.style.height = `${canvas.height / scale}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const image = ctx.createImageData(cols, rows);
  const data = image.data;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const nx = cols <= 1 ? 0 : x / (cols - 1);
      const ny = rows <= 1 ? 0 : y / (rows - 1);
      const on = tone(nx, ny) > threshold(x, y);
      const rgb = on ? mix(nx * 0.7 + ny * 0.3) : GROUND;
      const i = (y * cols + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }

  const stamp = document.createElement("canvas");
  stamp.width = cols;
  stamp.height = rows;
  const stampCtx = stamp.getContext("2d");
  if (!stampCtx) return;
  stampCtx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(stamp, 0, 0, cols * cell, rows * cell);
}
