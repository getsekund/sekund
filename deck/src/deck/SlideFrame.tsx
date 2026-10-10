import type { ReactNode } from "react";
import type { Slide } from "./types";

/**
 * One 1920 × 1080 slide. No chrome: the wordmark appears only where it is content (the
 * illustration bezel, the LCD captures), and the slide index lives in the presenter view.
 */
export function SlideFrame({
  slide,
  index,
  count,
  active,
  hidden,
  children,
}: {
  slide: Slide;
  index: number;
  count: number;
  active: boolean;
  hidden?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="slide"
      id={`slide-${slide.id}`}
      data-slide={slide.id}
      data-active={active ? "true" : undefined}
      hidden={hidden}
      aria-label={`${index + 1} of ${count}: ${slide.title}`}
    >
      {children}
    </section>
  );
}
