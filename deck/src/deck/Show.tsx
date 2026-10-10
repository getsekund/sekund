import { SlideFrame } from "./SlideFrame";
import { SLIDES, SLIDE_IDS } from "./slides";
import { useDeck, useStageScale } from "./useDeck";

/**
 * The audience view. Every slide is in the DOM so Cmd+P prints the whole deck; on screen
 * only the current one is shown, scaled to the window.
 */
export function Show() {
  const { index, count, next, prev } = useDeck(SLIDE_IDS);
  const scale = useStageScale();

  return (
    <main className="show" style={{ ["--d-scale" as string]: scale }}>
      <div className="show__stage">
        {SLIDES.map((slide, i) => (
          <SlideFrame key={slide.id} slide={slide} index={i} count={count} active={i === index} hidden={i !== index}>
            {slide.render({ active: i === index })}
          </SlideFrame>
        ))}
      </div>
      <nav className="nav" aria-label="Slides">
        <button type="button" onClick={prev} aria-label="Previous slide" disabled={index === 0}>
          Previous
        </button>
        <button type="button" onClick={next} aria-label="Next slide" disabled={index === count - 1} style={{ width: "64%" }}>
          Next
        </button>
      </nav>
      <div className="help" aria-hidden="true">
        <kbd>→</kbd> next &nbsp; <kbd>←</kbd> back &nbsp; <kbd>1</kbd>–<kbd>0</kbd> jump &nbsp; <kbd>?notes</kbd> presenter &nbsp; <kbd>⌘P</kbd> PDF
      </div>
    </main>
  );
}
