import { WORDMARK, WORDMARK_OPTIONS, SEGMENT, type WordmarkSpec } from "@/brand";
import { HERO_LCD_VARIANTS, ILLUSTRATION, ILLUSTRATION_OPTIONS, type IllustrationSpec } from "@/brand/illustrations";
import { Dither } from "@/dither/Dither";
import { DITHER_PALETTE, PALETTE_OPTIONS, PaletteProvider, type DitherPalette } from "@/dither/palette";
import { HeroWatch } from "@/ui/HeroWatch";
import { Wordmark } from "@/ui/Wordmark";
import { SlideFrame } from "./SlideFrame";
import { SLIDES } from "./slides";

/** A black-on-white SVG of the mark as a data URL, so the dither canvas can sample it like any image. */
function markDataUrl(spec: WordmarkSpec): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${spec.viewBox}" width="${spec.width}" height="${spec.height}"><rect width="100%" height="100%" fill="#000"/><path d="${spec.path}" fill="#fff" fill-rule="evenodd"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Height for a given cap height: every spec has a 100-unit cap inside its viewBox. */
function heightForCap(spec: WordmarkSpec, cap: number): number {
  return (cap * spec.height) / 100;
}

/* The bezel crop is 910 × 520 out of the 1132 × 1478 watch capture; the old mark sat centred at (446, 168). */
const FACE = { w: 910, h: 520, cx: 446, cy: 168, cap: 46 };

function OnFace({ spec, scale }: { spec: WordmarkSpec; scale: number }) {
  const h = heightForCap(spec, FACE.cap);
  const w = (h * spec.width) / spec.height;
  return (
    <div className="opt__face" style={{ width: FACE.w * scale, height: FACE.h * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0", width: FACE.w, height: FACE.h, position: "relative" }}>
        <img src="/assets/watch-face-blank.png" alt="" width={FACE.w} height={FACE.h} />
        <div style={{ position: "absolute", left: FACE.cx - w / 2, top: FACE.cy - h / 2, color: "#e9eae4" }}>
          <Wordmark spec={spec} width={w} />
        </div>
      </div>
    </div>
  );
}

function Head({ title, sub, note }: { title: string; sub: string; note: string }) {
  return (
    <header className="opt__head">
      <div>
        <h1 className="opt__title">{title}</h1>
        <p className="small dim" style={{ marginTop: 6 }}>
          {sub}
        </p>
      </div>
      <p className="small dim" style={{ maxWidth: 620, textAlign: "right" }}>
        {note}
      </p>
    </header>
  );
}

/** `?logos`: the four wordmark directions, each large, inverse, small, dithered and on the watch face. */
export function LogoOptions() {
  return (
    <main className="opt">
      <Head
        title="SEKUND wordmark options"
        sub="Monochrome, drawn as polygons. Same cap height in every cell; width follows the letterforms."
        note="Brand rule: SEKUND is the only word on the watch face. Every option must survive one-bit dither, read at LCD-face size and carry a deck header."
      />
      <div className="opt__ref">
        <span className="caption">Current v2 for reference</span>
        <span style={{ color: "var(--d-ink)" }}>
          <Wordmark spec={SEGMENT} width={170} />
        </span>
        <span className="caption">{SEGMENT.note}</span>
      </div>
      {WORDMARK_OPTIONS.map((spec) => (
        <section className="opt__row" key={spec.id}>
          <div className="opt__meta">
            <span className="opt__letter">{spec.label}</span>
            <h2 className="opt__name">{spec.name}</h2>
            <p className="caption">{spec.note}</p>
            {spec.id === WORDMARK.id && <span className="opt__tag">Chosen · live on the deck</span>}
          </div>
          <div className="opt__cell opt__cell--ink">
            <Wordmark spec={spec} width={480} />
            {spec.id === "inter" && (
              <span className="opt__live" aria-hidden>
                SEKUND
                <span className="caption">Set live in Inter 600, +0.04em, as the outlines were made</span>
              </span>
            )}
          </div>
          <div className="opt__cell opt__cell--stack">
            <div className="opt__paper">
              <Wordmark spec={spec} width={236} />
            </div>
            <div className="opt__smalls">
              <Wordmark spec={spec} width={168} />
              <Wordmark spec={spec} width={104} />
              <Wordmark spec={spec} width={64} />
            </div>
          </div>
          <div className="opt__cell opt__cell--stack">
            <Dither width={280} height={64} cell={4} src={markDataUrl(spec)} fit="contain" />
            <Dither width={140} height={32} cell={4} src={markDataUrl(spec)} fit="contain" />
            <span className="caption">One-bit, cell 4, as on a dithered slide</span>
          </div>
          <div className="opt__cell">
            <OnFace spec={spec} scale={0.44} />
            <span className="caption">On the watch face, bezel above the LCD</span>
          </div>
        </section>
      ))}
    </main>
  );
}

function Candidate({ spec, live }: { spec: IllustrationSpec; live: boolean }) {
  return (
    <section className="opt__cand">
      <div className="opt__meta" style={{ minHeight: 0 }}>
        <span className="opt__letter">{spec.label}</span>
        <h2 className="opt__name">{spec.name}</h2>
        <p className="caption">{spec.note}</p>
        {live && <span className="opt__tag">Recommended · live on the deck</span>}
      </div>
      <div className="opt__pair">
        <figure className="opt__fig">
          <HeroWatch spec={spec} width={300} height={Math.round((300 * spec.height) / spec.width)} dither={false} />
          <figcaption className="caption">Composite: generated case, real LCD capture, wordmark</figcaption>
        </figure>
        <figure className="opt__fig">
          <HeroWatch spec={spec} width={300} height={Math.round((300 * spec.height) / spec.width)} cell={2} />
          <figcaption className="caption">Bayer 8×8 at the deck&rsquo;s slide-1 cell size, mark laid over</figcaption>
        </figure>
      </div>
    </section>
  );
}

/** `?illustrations`: the generated watch candidates, raw composite and through the dither pipeline. */
export function IllustrationOptions() {
  return (
    <main className="opt">
      <Head
        title="Watch illustration options"
        sub="Generated resin watch, three-quarter view, black ground. LCD is the real watch-sim capture, composited in perspective; the wordmark is the live brand option."
        note="The dithered column is what the first and last slide show. Cell size here is 2 stage pixels at 300 px wide, which matches cell 4 at the 760 px the slide uses."
      />
      <div className="opt__grid">
        {ILLUSTRATION_OPTIONS.map((spec) => (
          <Candidate spec={spec} live={spec.id === ILLUSTRATION.id} key={spec.id} />
        ))}
      </div>
    </main>
  );
}

/* Slide 1 draws the hero at this size; the zoom centres on the time row of the Brow composite (photo pixels). */
const HERO = { w: 760, h: 960 };
const TIME_ROW = { x: 422, y: 475 };

/** A 2× window onto the hero, centred on the LCD's time row, so the digits can be judged up close. */
function Zoom({ spec, zoom = 2, w = 760, h = 480 }: { spec: IllustrationSpec; zoom?: number; w?: number; h?: number }) {
  const scale = Math.min(HERO.w / spec.width, HERO.h / spec.height);
  const cx = (HERO.w - spec.width * scale) / 2 + TIME_ROW.x * scale;
  const cy = (HERO.h - spec.height * scale) / 2 + TIME_ROW.y * scale;
  return (
    <div className="opt__zoom" style={{ width: w, height: h }}>
      <div style={{ transform: `translate(${w / 2 - cx * zoom}px, ${h / 2 - cy * zoom}px) scale(${zoom})`, transformOrigin: "0 0" }}>
        <HeroWatch spec={spec} width={HERO.w} height={HERO.h} />
      </div>
    </div>
  );
}

/** A slide drawn at thumbnail scale, with the option sheet's palette. */
function Thumb({ index, width, palette }: { index: number; width: number; palette: DitherPalette }) {
  const slide = SLIDES[index]!;
  return (
    <div className="thumb" style={{ width }}>
      <div className="thumb__stage" style={{ ["--thumb-scale" as string]: width / 1920 }}>
        <PaletteProvider value={palette}>
          <SlideFrame slide={slide} index={index} count={SLIDES.length} active={false}>
            {slide.render({ active: false })}
          </SlideFrame>
        </PaletteProvider>
      </div>
    </div>
  );
}

/** `?palette`: three white-and-blue dither palettes on slide 1, each with a mini contact sheet of the whole deck. */
export function PaletteOptions() {
  const flat = (coverage: number) => () => coverage;
  return (
    <main className="opt">
      <Head
        title="Dither colour options"
        sub="Every dithered surface (the watch case, the field backgrounds, the shipped-this-week crops) draws its lit cells in white and blue on the black ground. Text, plates and the lit LCD stay ink and paper."
        note="Mix is the share of lit cells drawn blue; they are the first cells in the Bayer order, so the blue sits evenly in the white at every density. Live palette: deck/src/dither/palette.ts, DITHER_PALETTE."
      />
      <div className="opt__grid opt__grid--3">
        {PALETTE_OPTIONS.map((palette) => (
          <section className="opt__hero" key={palette.id}>
            <div className="opt__meta opt__meta--palette">
              <span className="opt__letter">{palette.label}</span>
              <h2 className="opt__name">{palette.name}</h2>
              <p className="caption">{palette.note}</p>
              <p className="caption">
                <span className="opt__swatch" style={{ background: palette.blue }} /> {palette.blue} · {Math.round(palette.mix * 100)}% blue, {Math.round((1 - palette.mix) * 100)}% white
              </p>
              {palette.id === DITHER_PALETTE.id && <span className="opt__tag">Recommended · live on the deck</span>}
            </div>
            <figure className="opt__fig opt__fig--hero">
              <Thumb index={0} width={570} palette={palette} />
              <figcaption className="caption">Slide 1</figcaption>
            </figure>
            <figure className="opt__fig opt__fig--hero">
              <div className="opt__swatches">
                {[0.15, 0.35, 0.6, 0.85].map((coverage) => (
                  <Dither key={coverage} width={132} height={88} cell={4} field={flat(coverage)} palette={palette} />
                ))}
              </div>
              <figcaption className="caption">The field at 15, 35, 60 and 85% coverage, cell 4, 1:1</figcaption>
            </figure>
            <figure className="opt__fig opt__fig--hero">
              <div className="opt__mini">
                {SLIDES.map((slide, i) => (
                  <Thumb key={slide.id} index={i} width={106} palette={palette} />
                ))}
              </div>
              <figcaption className="caption">All {SLIDES.length} slides</figcaption>
            </figure>
          </section>
        ))}
      </div>
    </main>
  );
}

/** `?hero`: the live illustration fully dithered next to the same photo with the LCD laid over undithered. */
export function HeroLcdVariants() {
  return (
    <main className="opt">
      <Head
        title="Hero LCD treatments"
        sub="The live Brow illustration at the exact size and cell slide 1 draws it. Left: everything through the dither. Right: the resin dithered, the LCD panel and wordmark laid over crisp, as a lit display."
        note="One-line switch in deck/src/brand/illustrations.ts: ILLUSTRATION = BROW keeps the fully dithered hero; ILLUSTRATION = BROW_LIT lights the panel on the first and last slide."
      />
      <div className="opt__grid">
        {HERO_LCD_VARIANTS.map((spec) => (
          <section className="opt__hero" key={spec.id}>
            <div className="opt__meta opt__meta--hero">
              <h2 className="opt__name">{spec.lcdSrc ? "Crisp LCD" : "Fully dithered"}</h2>
              <p className="caption">{spec.note}</p>
              {spec.id === ILLUSTRATION.id && <span className="opt__tag">Current · live on the deck</span>}
            </div>
            <figure className="opt__fig opt__fig--hero">
              <HeroWatch spec={spec} width={HERO.w} height={HERO.h} />
              <figcaption className="caption">Slide 1 at 1:1 · 760 px wide, Bayer 8×8, cell 4</figcaption>
            </figure>
            <figure className="opt__fig opt__fig--hero">
              <Zoom spec={spec} />
              <figcaption className="caption">The time row at 2×</figcaption>
            </figure>
            <figure className="opt__fig opt__fig--hero">
              <HeroWatch spec={spec} width={410} height={500} cell={2} variant="approve" />
              <figcaption className="caption">The last slide, APPROVE? page, at half size (cell 2 for the same density)</figcaption>
            </figure>
          </section>
        ))}
      </div>
    </main>
  );
}
