import { useEffect, useRef, useState } from "react";
import { SlideFrame } from "./SlideFrame";
import { SLIDES, SLIDE_IDS } from "./slides";
import { useDeck } from "./useDeck";

function Thumb({ index, label, current }: { index: number; label: string; current?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  const slide = SLIDES[index];
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setScale(el.clientWidth / 1920));
    observer.observe(el);
    setScale(el.clientWidth / 1920);
    return () => observer.disconnect();
  }, []);
  if (!slide) {
    return (
      <div className={`thumb${current ? " thumb--current" : ""}`} ref={ref}>
        <span className="thumb__label">{label}</span>
      </div>
    );
  }
  return (
    <div className={`thumb${current ? " thumb--current" : ""}`} ref={ref}>
      <span className="thumb__label">{label}</span>
      <div className="thumb__stage" style={{ ["--thumb-scale" as string]: scale }}>
        <SlideFrame slide={slide} index={index} count={SLIDES.length} active={!!current}>
          {slide.render({ active: !!current })}
        </SlideFrame>
      </div>
    </div>
  );
}

function useClock(): { time: string; elapsed: string; reset: () => void } {
  const [now, setNow] = useState(() => Date.now());
  const [started, setStarted] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const d = new Date(now);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const sec = Math.floor((now - started) / 1000);
  const elapsed = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  return { time, elapsed, reset: () => setStarted(Date.now()) };
}

/**
 * Presenter view (`?notes`): the current slide, the next one, the Serbian speaker notes,
 * wall clock and elapsed time. Arrow keys here move the show window too.
 */
export function Presenter() {
  const { index, count, next, prev } = useDeck(SLIDE_IDS);
  const { time, elapsed, reset } = useClock();
  const slide = SLIDES[index]!;
  const showHref = `${location.pathname}#${slide.id}`;

  return (
    <main className="presenter">
      <header className="presenter__bar">
        <span>
          <strong>SEKUND</strong> presenter &middot; slide <strong>{index + 1}</strong> of {count} &middot; <strong>{slide.title}</strong>
        </span>
        <span style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <span className="presenter__clock" title="Elapsed">
            {elapsed}
          </span>
          <span className="presenter__clock" title="Time">
            {time}
          </span>
          <span className="presenter__nav">
            <button type="button" onClick={reset}>
              Reset timer
            </button>
            <a className="presenter__link" href={showHref} target="sekund-show" rel="opener">
              Open show
            </a>
          </span>
        </span>
      </header>
      <section className="presenter__main">
        <Thumb index={index} label="Now" current />
        <div className="presenter__nav">
          <button type="button" onClick={prev} disabled={index === 0}>
            ← Back
          </button>
          <button type="button" onClick={next} disabled={index === count - 1}>
            Next →
          </button>
        </div>
      </section>
      <aside className="presenter__aside">
        <Thumb index={index + 1} label={index + 1 < count ? `Next: ${SLIDES[index + 1]!.title}` : "End"} />
        <div className="notes" lang="sr-Latn">
          {slide.notes.map((paragraph, i) =>
            paragraph.startsWith("!") ? (
              <span className="flag" key={i}>
                {paragraph.slice(1)}
              </span>
            ) : (
              <p key={i}>{paragraph}</p>
            ),
          )}
        </div>
      </aside>
    </main>
  );
}
