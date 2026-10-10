import type { ReactNode } from "react";
import { Wordmark } from "@/ui/Wordmark";
import type { Slide } from "./types";

/**
 * One 1920 × 1080 slide with its chrome: the wordmark top-left and the LCD counter
 * bottom-right. The body is whatever the slide renders.
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
  const n = String(index + 1).padStart(2, "0");
  const total = String(count).padStart(2, "0");
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
      <div className="chrome" aria-hidden="true">
        {!slide.bareMark && (
          <div className="chrome__mark">
            <Wordmark width={168} />
          </div>
        )}
        <div className="chrome__counter">
          <span className="chrome__lcd">
            <span className="ghost">88:88</span>
            <span className="lit">
              {n}:{total}
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
