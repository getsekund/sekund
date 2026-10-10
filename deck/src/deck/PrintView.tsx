import { SlideFrame } from "./SlideFrame";
import { SLIDES } from "./slides";

/** `?print`: every slide at full size, one under the other, for `page.pdf()` and for checking pages. */
export function PrintView() {
  return (
    <main className="print-view">
      {SLIDES.map((slide, i) => (
        <SlideFrame key={slide.id} slide={slide} index={i} count={SLIDES.length} active={false}>
          {slide.render({ active: false })}
        </SlideFrame>
      ))}
    </main>
  );
}
