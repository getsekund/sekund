/**
 * Ordered Bayer fill for the dark primary action.
 * Recreated for SEKUND. Not the dither-kit package and not its assets.
 * Square cells, black ground, blue to magenta, no blur and no bloom.
 */

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const BLACK: readonly [number, number, number] = [0, 0, 0];
const BLUE: readonly [number, number, number] = [61, 126, 255];
const MAGENTA: readonly [number, number, number] = [255, 78, 196];

function threshold(x: number, y: number): number {
  const level = BAYER4[(y & 3) * 4 + (x & 3)] ?? 0;
  return (level + 0.5) / 16;
}

function mix(t: number): [number, number, number] {
  const f = Math.min(1, Math.max(0, t));
  return [
    BLUE[0] + (MAGENTA[0] - BLUE[0]) * f,
    BLUE[1] + (MAGENTA[1] - BLUE[1]) * f,
    BLUE[2] + (MAGENTA[2] - BLUE[2]) * f,
  ];
}

/** Installs a still pixel tile on --sk-cta-dither. Light mode clears it. */
export function installCtaDither(root: HTMLElement, on: boolean): void {
  if (!on) {
    root.style.removeProperty("--sk-cta-dither");
    return;
  }
  const cell = 3;
  const cols = 64;
  const rows = 24;
  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const image = ctx.createImageData(cols, rows);
  const data = image.data;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const nx = cols <= 1 ? 0 : x / (cols - 1);
      const rgb = 0.78 > threshold(x, y) ? mix(nx) : BLACK;
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
  root.style.setProperty("--sk-cta-dither", `url("${canvas.toDataURL("image/png")}")`);
}
