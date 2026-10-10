import { WORDMARK, WORDMARK_OPTIONS, SEGMENT, type WordmarkSpec } from "@/brand";
import { ILLUSTRATION, ILLUSTRATION_OPTIONS, type IllustrationSpec } from "@/brand/illustrations";
import { Dither } from "@/dither/Dither";
import { HeroWatch } from "@/ui/HeroWatch";
import { Wordmark } from "@/ui/Wordmark";

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
            {spec.id === WORDMARK.id && <span className="opt__tag">Recommended · live on the deck</span>}
          </div>
          <div className="opt__cell opt__cell--ink">
            <Wordmark spec={spec} width={480} />
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
        note="The dithered column is what slides 1 and 10 show. Cell size here is 2 stage pixels at 300 px wide, which matches cell 4 at the 760 px the slide uses."
      />
      <div className="opt__grid">
        {ILLUSTRATION_OPTIONS.map((spec) => (
          <Candidate spec={spec} live={spec.id === ILLUSTRATION.id} key={spec.id} />
        ))}
      </div>
    </main>
  );
}
