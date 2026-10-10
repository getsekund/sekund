import { asset } from "@/asset";
import type { IllustrationSpec } from "@/brand/illustrations";
import { useDitherClock } from "@/dither/clock";
import { Dither, type DitherBox } from "@/dither/Dither";
import type { Field } from "@/dither/fields";

/** The overlay's share of the reveal, as `hero-mark-in` in deck.css: out for the first 60%, then eased in. */
function markOpacity(progress: number): number {
  const k = Math.min(1, Math.max(0, (progress - 0.6) / 0.4));
  return 1 - (1 - k) * (1 - k);
}

/**
 * The watch illustration as the hero slides draw it: the composite photo through the one-bit
 * dither, with the wordmark laid over it crisp and in the same perspective. Specs with an LCD
 * layer also lay the panel over the dither, so the display reads as lit and the digits stay
 * sharp. Every layer fills the same box with `contain`, so they register exactly.
 *
 * With a `field`, the canvas is the whole `width × height` surface, the watch sits in `box`,
 * and the field fills everything outside its silhouette on the same cell grid, so the case
 * meets the field with no rectangular edge. `dither={false}` shows the photo itself.
 */
export function HeroWatch({
  spec,
  width,
  height,
  box,
  field,
  feather = 6,
  animate = false,
  fps = 16,
  cell = 4,
  variant = "clock",
  reveal = 0,
  dither = true,
}: {
  spec: IllustrationSpec;
  width: number;
  height: number;
  box?: DitherBox;
  field?: Field;
  /** Cells over which the case's silhouette blends into the field. */
  feather?: number;
  animate?: boolean;
  fps?: number;
  cell?: number;
  variant?: "clock" | "approve";
  reveal?: number;
  dither?: boolean;
}) {
  const clock = useDitherClock();
  const approve = variant === "approve";
  const src = asset(approve ? (spec.approveSrc ?? spec.src) : spec.src);
  const lcdPath = approve ? (spec.approveLcdSrc ?? spec.lcdSrc) : spec.lcdSrc;
  const lcd = lcdPath ? asset(lcdPath) : undefined;
  const mark = spec.markSrc ? asset(spec.markSrc) : undefined;
  const b = box ?? { x: 0, y: 0, width, height };
  const layer: React.CSSProperties = { position: "absolute", left: b.x, top: b.y, width: b.width, height: b.height, objectFit: "contain", display: "block" };
  const overlay =
    clock && reveal > 0
      ? { className: "hero__mark", style: { ...layer, opacity: markOpacity((clock.time * 1000) / reveal) } }
      : { className: reveal > 0 ? "hero__mark hero__mark--reveal" : "hero__mark", style: { ...layer, animationDuration: `${reveal}ms` } };
  return (
    <div style={{ position: "relative", width, height }} aria-hidden>
      {dither ? (
        <Dither width={width} height={height} cell={cell} src={src} fit="contain" box={box} field={field} feather={feather} animate={animate} fps={fps} contrast={spec.contrast} gamma={spec.gamma} reveal={reveal} />
      ) : (
        <img src={src} alt="" style={layer} />
      )}
      {dither && lcd && <img src={lcd} alt="" {...overlay} />}
      {mark && <img src={mark} alt="" {...overlay} />}
    </div>
  );
}
