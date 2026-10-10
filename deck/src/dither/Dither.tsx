import { useEffect, useRef } from "react";
import { luma, on, threshold, tone, type Tone } from "./bayer";
import type { Field } from "./fields";
import { usePalette, type DitherPalette } from "./palette";

/** Where an image sits inside the canvas, in stage pixels. */
export interface DitherBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DitherProps extends Tone {
  /** Size of the surface in stage pixels. */
  width: number;
  height: number;
  /** Stage pixels per dither cell. 4 reads on a projector; 3 is finer. */
  cell?: number;
  /** Image to dither. With a `field` as well, the image sits in `box` and its silhouette feathers into the field. */
  src?: string;
  /** How the image fills its box. */
  fit?: "cover" | "contain";
  /** The image's box inside the canvas. Defaults to the whole canvas. */
  box?: DitherBox;
  /** Cells over which the field thins out around the image's silhouette (composite mode only). */
  feather?: number;
  /** Procedural coverage. Alone it is the whole surface; with `src` it fills everything outside the image's silhouette. */
  field?: Field;
  /** Colours for lit and unlit cells. Defaults to the live `DITHER_PALETTE` (or the one a `PaletteProvider` sets). */
  palette?: DitherPalette;
  /** Overrides for the palette's white and ground, for one-off surfaces. */
  ink?: string;
  ground?: string;
  /** Animate the field. Still under reduced motion. */
  animate?: boolean;
  /** Frames per second when animating. */
  fps?: number;
  /** Dissolve an image in over this many milliseconds. 0 draws it at once. */
  reveal?: number;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
}

/** Raw luma above which a cell belongs to the object rather than the photo's black surround. */
const SILHOUETTE = 0.02;
/** Where the shade ramp starts and ends, on the blurred silhouette's 0..1. */
const SHADE_IN = 0.15;
const SHADE_OUT = 0.8;

function smoothstep(a: number, b: number, v: number): number {
  const k = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

function parseColor(css: string): [number, number, number] {
  const m = css.replace("#", "");
  const hex = m.length === 3 ? m.split("").map((ch) => ch + ch).join("") : m;
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Soft silhouette from a hard one: grow it by `grow` cells (round, so corners stay round), then
 * box-blur it twice over `radius` cells. 1 inside and just around the shape, 0 well outside, a
 * smooth ramp between.
 */
function feathered(hard: Float32Array, cols: number, rows: number, grow: number, radius: number): Float32Array {
  const grown = new Float32Array(cols * rows);
  const g = Math.max(0, Math.round(grow));
  const g2 = g * g + g; // a touch over g² so the disc is not starved at its axes
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let v = 0;
      for (let dy = -g; dy <= g && v < 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= rows) continue;
        for (let dx = -g; dx <= g; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < cols && dx * dx + dy * dy <= g2 && hard[yy * cols + xx]! > 0) {
            v = 1;
            break;
          }
        }
      }
      grown[y * cols + x] = v;
    }
  }
  if (radius <= 0) return grown;
  const blur = (src: Float32Array): Float32Array => {
    const tmp = new Float32Array(cols * rows);
    const out = new Float32Array(cols * rows);
    const n = radius * 2 + 1;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let sum = 0;
        for (let d = -radius; d <= radius; d++) {
          const xx = Math.min(cols - 1, Math.max(0, x + d));
          sum += src[y * cols + xx]!;
        }
        tmp[y * cols + x] = sum / n;
      }
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let sum = 0;
        for (let d = -radius; d <= radius; d++) {
          const yy = Math.min(rows - 1, Math.max(0, y + d));
          sum += tmp[yy * cols + x]!;
        }
        out[y * cols + x] = sum / n;
      }
    }
    return out;
  };
  return blur(blur(grown));
}

/**
 * Ordered dither on a canvas: every cell is ground, white or blue. The work happens at cell
 * resolution in a small offscreen canvas; the visible canvas scales it up with smoothing off,
 * so every cell stays a crisp square at any device pixel ratio.
 *
 * With both `src` and `field`, the image is placed in `box` and everything outside its
 * silhouette is the field, so a photo on black sits in a continuous full-bleed field with no
 * rectangular edge. The field thins out over `feather` cells as it nears the silhouette, so the
 * object keeps its outline against a busy field, and the reveal grows the image out of the field.
 */
export function Dither(props: DitherProps) {
  const live = usePalette();
  const {
    width,
    height,
    cell = 4,
    src,
    fit = "contain",
    box,
    feather = 3,
    field,
    palette = live,
    ink = palette.white,
    ground = palette.ground,
    animate = false,
    fps = 18,
    reveal = 0,
    contrast = 1,
    gamma = 1,
    invert = false,
    className,
    style,
  } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bx = box?.x ?? 0;
  const by = box?.y ?? 0;
  const bw = box?.width ?? width;
  const bh = box?.height ?? height;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cols = Math.max(1, Math.round(width / cell));
    const rows = Math.max(1, Math.round(height / cell));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const small = document.createElement("canvas");
    small.width = cols;
    small.height = rows;
    const sctx = small.getContext("2d", { willReadFrequently: true });
    if (!sctx) return;

    const inkRgb = parseColor(ink);
    const groundRgb = parseColor(ground);
    const blueRgb = parseColor(palette.blue);
    const mix = palette.mix;
    const out = sctx.createImageData(cols, rows);
    const data = out.data;
    const toneOpts: Tone = { contrast, gamma, invert };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const blit = () => {
      sctx.putImageData(out, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
    };

    const paint = (coverage: (x: number, y: number) => number) => {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const c = coverage(x, y);
          const lit = on(c, x, y);
          // Of the lit cells, the earliest in the Bayer order take the blue: a fixed share at any density.
          const rgb = lit ? (mix > 0 && threshold(x, y) < c * mix ? blueRgb : inkRgb) : groundRgb;
          const i = (y * cols + x) * 4;
          data[i] = rgb[0];
          data[i + 1] = rgb[1];
          data[i + 2] = rgb[2];
          data[i + 3] = 255;
        }
      }
      blit();
    };

    let raf = 0;
    let timer = 0;
    let cancelled = false;
    const stop = () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (timer) window.clearTimeout(timer);
    };

    // Image luma per cell (toned); a tight silhouette that places the image; a wide one that shades the field around it.
    let lum: Float32Array | null = null;
    let shape: Float32Array | null = null;
    let shade: Float32Array | null = null;
    // The field is used as it comes when it only fills around an image; alone, it takes the tone like an image would.
    const fieldTone: Tone = src ? {} : toneOpts;
    const fieldAt = field ? (x: number, y: number, t: number) => tone(field((x + 0.5) / cols, (y + 0.5) / rows, t), fieldTone) : () => 0;

    const coverageAt = (x: number, y: number, t: number, e: number): number => {
      const f = fieldAt(x, y, t);
      if (!lum) return f;
      const i = y * cols + x;
      const s = (shape ? shape[i]! : 1) * e;
      // The blurred silhouette ramps shallowly; steepen it so the field is fully out in a band
      // around the object and only then thins back in, which is what lets the case read as a thing.
      const d = (shade ? smoothstep(SHADE_IN, SHADE_OUT, shade[i]!) : 1) * e;
      // The image where its silhouette is; the field everywhere else, thinning out as it nears the silhouette.
      return lum[i]! * s + f * (1 - d);
    };

    const run = () => {
      const started = performance.now();
      const loop = (now: number) => {
        if (cancelled) return;
        const t = (now - started) / 1000;
        const p = lum && reveal > 0 && !reduced ? Math.min(1, (now - started) / reveal) : 1;
        // Ease out so the last cells arrive gently.
        const e = 1 - (1 - p) * (1 - p);
        if (!document.hidden || p < 1) paint((x, y) => coverageAt(x, y, t, e));
        if (p < 1) {
          raf = requestAnimationFrame(loop);
          return;
        }
        if (!field || !animate || reduced || fps <= 0) return;
        timer = window.setTimeout(() => {
          raf = requestAnimationFrame(loop);
        }, 1000 / fps);
      };
      raf = requestAnimationFrame(loop);
    };

    if (!src) {
      // Draw the first frame synchronously so a still field never flashes empty.
      paint((x, y) => coverageAt(x, y, 0, 1));
      if (field && animate && !reduced && fps > 0) run();
      return stop;
    }

    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (cancelled) return;
      // Fit the image into its box on the cell grid, then read one luma per cell.
      const bcols = Math.max(1, Math.round(bw / cell));
      const brows = Math.max(1, Math.round(bh / cell));
      const ox = Math.round(bx / cell);
      const oy = Math.round(by / cell);
      const scale = fit === "cover" ? Math.max(bcols / img.width, brows / img.height) : Math.min(bcols / img.width, brows / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      sctx.fillStyle = invert ? "#fff" : "#000";
      sctx.fillRect(0, 0, cols, rows);
      sctx.save();
      sctx.beginPath();
      sctx.rect(ox, oy, bcols, brows);
      sctx.clip();
      sctx.drawImage(img, ox + (bcols - w) / 2, oy + (brows - h) / 2, w, h);
      sctx.restore();
      const pixels = sctx.getImageData(0, 0, cols, rows).data;
      const l = new Float32Array(cols * rows);
      const hard = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) {
        const raw = luma(pixels[i * 4]!, pixels[i * 4 + 1]!, pixels[i * 4 + 2]!);
        l[i] = tone(raw, toneOpts);
        // The silhouette is the object itself, dark parts included: anything the photo's black
        // surround does not cover. Raw luma, so the tone curve cannot push a dark strap out of it.
        hard[i] = raw > SILHOUETTE ? 1 : 0;
      }
      lum = l;
      if (field) {
        shape = feathered(hard, cols, rows, 1, 1);
        shade = feathered(hard, cols, rows, Math.round(feather * 0.75), feather);
      }
      if (reveal <= 0 || reduced) {
        paint((x, y) => coverageAt(x, y, 0, 1));
        if (field && animate && !reduced && fps > 0) run();
        return;
      }
      run();
    };
    img.src = src;
    return stop;
  }, [width, height, cell, src, fit, bx, by, bw, bh, feather, field, ink, ground, palette.blue, palette.mix, animate, fps, reveal, contrast, gamma, invert]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width, height, imageRendering: "pixelated", display: "block", ...style }}
      aria-hidden={props["aria-hidden"] ?? true}
    />
  );
}
