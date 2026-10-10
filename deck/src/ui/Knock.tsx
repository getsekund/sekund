import type { ElementType, ReactNode } from "react";

/**
 * Type that sits on the dither without a plate: the same text is drawn twice, first in the
 * ground colour with a thick stroke, then in ink on top. The stroke knocks the dots out in a
 * tight per-letter shape, a few pixels around every glyph, never a rectangle. The stroke width
 * comes from `--knock` on the element (set per type size in the stylesheet).
 */
export function Knock({ as, className, children }: { as?: ElementType; className?: string; children: ReactNode }) {
  const Tag: ElementType = as ?? "span";
  return (
    <Tag className={className ? `knock ${className}` : "knock"}>
      <span className="knock__halo" aria-hidden="true">
        {children}
      </span>
      <span className="knock__ink">{children}</span>
    </Tag>
  );
}
