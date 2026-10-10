import { GLCD } from "./glcdfont";

/**
 * Text set in the watch's own 5×7 dot-matrix glyphs, drawn as SVG squares. Crisp at any
 * size and in print. Used for small labels only; sentences stay in Archivo and Plex Mono.
 */
export function DotText({
  text,
  dot = 4,
  gap = 1,
  className,
  title,
}: {
  text: string;
  /** Stage pixels per dot. */
  dot?: number;
  /** Empty dots between glyphs. */
  gap?: number;
  className?: string;
  title?: string;
}) {
  const chars = [...text.toUpperCase()];
  const advance = 5 + gap;
  const width = Math.max(0, chars.length * advance - gap) * dot;
  // Glyphs are 5×7 plus a descender row (bit 7, used by the comma).
  const height = 8 * dot;
  const rects: string[] = [];
  chars.forEach((ch, index) => {
    const glyph = GLCD[ch] ?? GLCD["?"] ?? [0, 0, 0, 0, 0];
    glyph.forEach((column, cx) => {
      for (let row = 0; row < 8; row++) {
        if (column & (1 << row)) {
          rects.push(`M${(index * advance + cx) * dot},${row * dot}h${dot}v${dot}h-${dot}z`);
        }
      }
    });
  });
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title ?? text}
      shapeRendering="crispEdges"
    >
      <path d={rects.join("")} fill="currentColor" />
    </svg>
  );
}
