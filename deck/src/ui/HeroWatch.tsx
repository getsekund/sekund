import type { IllustrationSpec } from "@/brand/illustrations";
import { Dither } from "@/dither/Dither";

/**
 * The watch illustration as the hero slides draw it: the composite photo through the one-bit
 * dither, with the wordmark laid over it crisp and in the same perspective. Both layers fill the
 * same box with `contain`, so they register exactly. `dither={false}` shows the photo itself.
 */
export function HeroWatch({
  spec,
  width,
  height,
  cell = 4,
  variant = "clock",
  reveal = 0,
  dither = true,
}: {
  spec: IllustrationSpec;
  width: number;
  height: number;
  cell?: number;
  variant?: "clock" | "approve";
  reveal?: number;
  dither?: boolean;
}) {
  const src = variant === "approve" ? (spec.approveSrc ?? spec.src) : spec.src;
  const layer: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", display: "block" };
  return (
    <div style={{ position: "relative", width, height }} aria-hidden>
      {dither ? (
        <Dither width={width} height={height} cell={cell} src={src} fit="contain" contrast={spec.contrast} gamma={spec.gamma} reveal={reveal} />
      ) : (
        <img src={src} alt="" style={layer} />
      )}
      {spec.markSrc && <img src={spec.markSrc} alt="" className={reveal > 0 ? "hero__mark hero__mark--reveal" : "hero__mark"} style={{ ...layer, animationDuration: `${reveal}ms` }} />}
    </div>
  );
}
