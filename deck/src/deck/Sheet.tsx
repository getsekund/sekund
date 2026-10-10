import { Wordmark } from "@/ui/Wordmark";
import { SlideFrame } from "./SlideFrame";
import { SLIDES } from "./slides";

/** `?sheet`: a 1920 × 1080 contact sheet of every slide, five across, two rows, centred on the board. */
export function Sheet() {
  const columns = 5;
  const gap = 24;
  const thumbWidth = (1920 - 112 - gap * (columns - 1)) / columns;
  return (
    <main className="sheet">
      <header className="sheet__head">
        <h1 className="sheet__title" style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Wordmark width={150} /> pitch deck v3
        </h1>
        <span className="sheet__label">
          Colosseum Crypto World&rsquo;s Fair &middot; {SLIDES.length} slides
        </span>
      </header>
      <div className="sheet__grid">
        {SLIDES.map((slide, i) => (
          <figure className="sheet__item" key={slide.id} style={{ margin: 0 }}>
            <div className="thumb">
              <div className="thumb__stage" style={{ ["--thumb-scale" as string]: thumbWidth / 1920 }}>
                <SlideFrame slide={slide} index={i} count={SLIDES.length} active={false}>
                  {slide.render({ active: false })}
                </SlideFrame>
              </div>
            </div>
            <figcaption className="sheet__label">
              <b>{String(i + 1).padStart(2, "0")}</b> {slide.title}
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
