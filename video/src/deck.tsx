import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { setAssetBase } from "@/asset";
import { DitherClockProvider, type DitherClock } from "@/dither/clock";
import "@/styles/deck.css";
import { deckSlide, riseAll, RISE_PX, RISE_S, riseEase, swapImages, type Build, type ImageSwap } from "./slides";

// The deck serves public/ at the root; Remotion serves it under its own static prefix.
setAssetBase(staticFile("x").slice(0, -2));

/** Every face the slides set, at the weights they use. */
const FACES = ['600 84px "Archivo"', '400 44px "Archivo"', '400 30px "IBM Plex Mono"', '500 30px "IBM Plex Mono"', '36px "DSEG7 Classic"', '21px "DSEG14 Classic"'];

/** Holds the first frame until the deck's fonts are in, so no frame is set in a fallback face. */
export function FontsReady({ children }: { children: ReactNode }) {
  const [handle] = useState(() => delayRender("deck fonts"));
  useLayoutEffect(() => {
    void Promise.all(FACES.map((face) => document.fonts.load(face)))
      .then(() => document.fonts.ready)
      .finally(() => continueRender(handle));
  }, [handle]);
  return <>{children}</>;
}

/** Drives every Dither below it from the current frame: `time` is seconds since the enclosing Sequence began. */
export function FrameClock({ children }: { children: ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clock = useMemo<DitherClock>(
    () => ({
      time: frame / fps,
      hold: () => {
        const handle = delayRender("dither image");
        return () => continueRender(handle);
      },
    }),
    [frame, fps],
  );
  return <DitherClockProvider value={clock}>{children}</DitherClockProvider>;
}

/** Holds the frame until every <img> inside has loaded and decoded: the deck's own images are plain tags. */
export function ImagesReady({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const imgs = Array.from(ref.current?.querySelectorAll("img") ?? []);
    if (imgs.length === 0) return;
    const handle = delayRender(`images: ${imgs.map((img) => img.getAttribute("src")).join(", ")}`);
    void Promise.all(imgs.map((img) => img.decode().catch(() => console.warn(`image failed: ${img.src}`)))).finally(() => continueRender(handle));
  }, []);
  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  );
}

/**
 * The show's reveal, played from the frame instead of a CSS animation: each piece is hidden until
 * its time, then rises in. Pieces with no build are on screen from the start.
 */
export function Builds({ scene, builds }: { scene: string; builds: readonly Build[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const css = builds
    .map(({ selector, at }) => {
      const p = Math.min(1, Math.max(0, (t - at) / RISE_S));
      if (p >= 1) return "";
      const e = riseEase(p);
      return `[data-scene="${scene}"] ${selector} { opacity: ${e.toFixed(4)}; transform: translateY(${(RISE_PX * (1 - e)).toFixed(2)}px); }`;
    })
    .join("\n");
  return <style>{css}</style>;
}

/** One deck slide, exactly as the show draws it, on the video's clock. */
export function DeckSlide({ id, builds = riseAll(), images, children }: { id: string; builds?: readonly Build[]; images?: ImageSwap; children?: ReactNode }) {
  const slide = deckSlide(id);
  const body = slide.render({ active: true });
  return (
    <FrameClock>
      <ImagesReady>
        <section className="slide" data-slide={slide.id} data-scene={slide.id} data-active="true">
          {images ? swapImages(body, images) : body}
          {children}
        </section>
      </ImagesReady>
      <Builds scene={slide.id} builds={builds} />
    </FrameClock>
  );
}
