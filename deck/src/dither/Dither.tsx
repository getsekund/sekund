import { useEffect, useRef } from "react";
import { luma, on, threshold, tone, type Tone } from "./bayer";
import type { Field } from "./fields";
import { usePalette, type DitherPalette } from "./palette";

export interface DitherProps extends Tone {
  /** Size of the surface in stage pixels. */
  width: number;
  height: number;
  /** Stage pixels per dither cell. 4 reads on a projector; 3 is finer. */
  cell?: number;
  /** Image to dither. Takes precedence over `field`. */
  src?: string;
  /** How the image fills the surface. */
  fit?: "cover" | "contain";
  /** Procedural coverage when there is no image. */
  field?: Field;
  /** Colours for lit and unlit cells. Defaults to the live `DITHER_PALETTE` (or the one a `PaletteProvider` sets). */
  palette?: DitherPalette;
  /** Overrides for the palette's white and ground, for one-off surfaces. */
  ink?: string;
  ground?: string;
  /** Animate the field (fields only). Still under reduced motion. */
  animate?: boolean;
  /** Frames per second when animating. */
  fps?: number;
  /** Dissolve an image in over this many milliseconds. 0 draws it at once. */
  reveal?: number;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
}

function parseColor(css: string): [number, number, number] {
  const m = css.replace("#", "");
  const hex = m.length === 3 ? m.split("").map((ch) => ch + ch).join("") : m;
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Ordered dither on a canvas: every cell is ground, white or blue. The work happens at cell
 * resolution in a small offscreen canvas; the visible canvas scales it up with smoothing off,
 * so every cell stays a crisp square at any device pixel ratio.
 */
export function Dither(props: DitherProps) {
  const live = usePalette();
  const {
    width,
    height,
    cell = 4,
    src,
    fit = "contain",
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

    if (src) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (cancelled) return;
        // Fit the image into the cell grid, then read one luma per cell.
        const scale = fit === "cover" ? Math.max(cols / img.width, rows / img.height) : Math.min(cols / img.width, rows / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        sctx.fillStyle = invert ? "#fff" : "#000";
        sctx.fillRect(0, 0, cols, rows);
        sctx.drawImage(img, (cols - w) / 2, (rows - h) / 2, w, h);
        const pixels = sctx.getImageData(0, 0, cols, rows).data;
        const lum = new Float32Array(cols * rows);
        for (let i = 0; i < cols * rows; i++) {
          lum[i] = tone(luma(pixels[i * 4]!, pixels[i * 4 + 1]!, pixels[i * 4 + 2]!), toneOpts);
        }
        const still = () => paint((x, y) => lum[y * cols + x]!);
        if (reveal <= 0 || reduced) {
          still();
          return;
        }
        const started = performance.now();
        const frame = (now: number) => {
          if (cancelled) return;
          const p = Math.min(1, (now - started) / reveal);
          // Ease out so the last cells arrive gently.
          const e = 1 - (1 - p) * (1 - p);
          paint((x, y) => lum[y * cols + x]! * e);
          if (p < 1) raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      };
      img.src = src;
      return stop;
    }

    const f: Field = field ?? (() => 0);
    const started = performance.now();
    const drawField = (t: number) => paint((x, y) => tone(f((x + 0.5) / cols, (y + 0.5) / rows, t), toneOpts));
    drawField(0);
    if (!animate || reduced || fps <= 0) return stop;
    const interval = 1000 / fps;
    const tick = () => {
      if (cancelled) return;
      if (!document.hidden) drawField((performance.now() - started) / 1000);
      timer = window.setTimeout(() => {
        raf = requestAnimationFrame(tick);
      }, interval);
    };
    raf = requestAnimationFrame(tick);
    return stop;
  }, [width, height, cell, src, fit, field, ink, ground, palette.blue, palette.mix, animate, fps, reveal, contrast, gamma, invert]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width, height, imageRendering: "pixelated", display: "block", ...style }}
      aria-hidden={props["aria-hidden"] ?? true}
    />
  );
}
