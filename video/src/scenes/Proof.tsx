import { Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { appCards, confirmed, RUN } from "../capture-run";
import { Builds, DeckSlide, FrameClock, ImagesReady } from "../deck";
import { deckSlide, riseAll, type Build, type ImageSwap } from "../slides";
import { beat, cueAt } from "../script";

/**
 * Proof, in three shots, all real:
 * 1. What is simulated and what is real, over the deck's 3D simulator capture.
 * 2. The approve flow from scripts/capture.ts: the phone app's request card and the watch
 *    simulator paging through the review to APPROVE?, D pressed, SIGNED.
 * 3. The deck's proof slide: a confirmed devnet transfer in Solana Explorer.
 *
 * What the phone app shows after the watch signs, and whose transfer Explorer shows, come from
 * the capture run. A run that was broadcast and confirmed records its transaction: the card goes
 * on to SIGNED and CONFIRMED, and Explorer shows that same signature. A run that was not sent
 * never shows the card past WAITING; it leaves when the watch signs, and Explorer keeps the deck's.
 */
const CONFIRMED_RUN = confirmed(RUN);
const EXPLORER_SWAP: ImageSwap | undefined = CONFIRMED_RUN ? { "/assets/explorer-rows.png": "/captures/explorer-rows.png" } : undefined;

const PROOF = beat("proof");
/** Shot boundaries, in seconds from the start of the beat. */
const FLOW_AT = 9;
const EXPLORER_AT = 23;

export function ProofScene() {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  const length = PROOF.end - PROOF.start;
  return (
    <>
      <Sequence durationInFrames={f(FLOW_AT)} name="What is real">
        <HonestyShot />
      </Sequence>
      <Sequence from={f(FLOW_AT)} durationInFrames={f(EXPLORER_AT - FLOW_AT)} name="Approve flow">
        <FlowShot />
      </Sequence>
      <Sequence from={f(EXPLORER_AT)} durationInFrames={f(length) - f(EXPLORER_AT)} name="Devnet">
        <DeckSlide id="proof" builds={riseAll(0.15, 2)} images={EXPLORER_SWAP} />
      </Sequence>
    </>
  );
}

function HonestyShot() {
  const builds: Build[] = [
    { selector: ".slide__body > :nth-child(1)", at: cueAt("proof", 0) },
    // Timed to "a browser simulator", "software" and "real" in the second line.
    { selector: ".list > li:nth-child(1)", at: cueAt("proof", 1, 1.6) },
    { selector: ".list > li:nth-child(2)", at: cueAt("proof", 1, 3.4) },
    { selector: ".list > li:nth-child(3)", at: cueAt("proof", 1, 5.0) },
  ];
  return (
    <FrameClock>
      <ImagesReady>
        <section className="slide" data-scene="honesty">
          <div className="proof__bg">{deckSlide("shipped").render({ active: true })}</div>
          <div className="slide__body slide__body--quiet">
            <h2 className="title">Proof of concept</h2>
            <ul className="list" style={{ gap: 36, maxWidth: 920 }}>
              <li>The watch: a simulator in the browser</li>
              <li>The secure element: software</li>
              <li>The signatures: real, on Solana devnet</li>
            </ul>
          </div>
        </section>
      </ImagesReady>
      <Builds scene="honesty" builds={builds} />
      <style>{`[data-scene="honesty"] .proof__bg .slide__body { display: none; }`}</style>
    </FrameClock>
  );
}

/** The watch capture's box on the stage: 1324 × 1606 at 2x, scaled to 880 tall, on the right margin. */
const WATCH = { height: 880, width: (880 * 1324) / 1606, top: 100, right: 112 };
/** Where the D label sits in the capture, as a share of its width and height. */
const D_LABEL = { x: 0.956, y: 0.636 };
const CARD_W = 860;

/** What the watch shows, from seconds since the shot began; absolute times are in the comments. */
const WATCH_PAGES: readonly (readonly [number, string])[] = [
  [0, "watch-menu"], // 43.0: Secure Mode, PIN entered, waiting for a request
  [2.8, "watch-review-amount"], // 45.8: the request arrives
  [6.4, "watch-review-to-1"], // 49.4: "the destination"
  [7.1, "watch-review-to-2"],
  [7.6, "watch-review-network"],
  [7.85, "watch-review-fee"],
  [8.1, "watch-review-approve"], // 51.1: "approve?"
  [9.1, "watch-press-d"], // 52.1: "I press approve"
  [10.6, "watch-signed"], // 53.6: "The signature comes back"
];
const PRESS = { from: 9.1, to: 10.6 };
/** The watch shows SIGNED. */
const WATCH_SIGNED_AT = 10.6;

/** The phone app's card: SIGNED at 54.3, CONFIRMED at 55.6, before "Devnet confirmed" lands on Explorer. */
const APP_CARDS = appCards(RUN, { signed: 11.3, confirmed: 12.6 });
/** A run that was not sent has no card after WAITING, so the card leaves as the watch signs. */
const APP_LEAVES_AT = CONFIRMED_RUN ? Infinity : WATCH_SIGNED_AT;

function current<T>(t: number, schedule: readonly (readonly [number, T])[]): T {
  let out = schedule[0]![1];
  for (const [at, value] of schedule) if (t >= at) out = value;
  return out;
}

function FlowShot() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const page = current(t, WATCH_PAGES);
  const appCard = current(t, APP_CARDS);
  const appOut = Math.min(1, Math.max(0, (t - APP_LEAVES_AT) / 0.4));
  const pressed = t >= PRESS.from && t < PRESS.to;
  const ring = Math.min(1, Math.max(0, (t - PRESS.from) / 0.2));
  const builds: Build[] = [
    { selector: ".flow__watch", at: 0 },
    { selector: ".flow__app", at: cueAt("proof", 2) - FLOW_AT },
  ];
  const layer = (visible: boolean): React.CSSProperties => ({ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: visible ? 1 : 0 });
  return (
    <section className="slide" data-scene="flow">
      <div className="slide__body flow__app" style={{ justifyContent: "center", paddingRight: 1920 - 112 - CARD_W }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--d-gap)", opacity: 1 - appOut }}>
          <p className="caption">Phone app, devnet</p>
          <div style={{ position: "relative", width: CARD_W }}>
            {APP_CARDS.map(([, name], i) => (
              <Img
                key={name}
                src={staticFile(`captures/${name}.png`)}
                style={{ ...(i === 0 ? {} : { position: "absolute", left: 0, top: 0 }), width: CARD_W, display: "block", visibility: name === appCard ? "visible" : "hidden" }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flow__watch" style={{ position: "absolute", right: WATCH.right, top: WATCH.top, width: WATCH.width, height: WATCH.height }}>
        {WATCH_PAGES.map(([, name]) => (
          <Img key={name} src={staticFile(`captures/${name}.png`)} style={layer(name === page)} />
        ))}
        {pressed && (
          <div
            style={{
              position: "absolute",
              left: D_LABEL.x * WATCH.width - 36,
              top: D_LABEL.y * WATCH.height - 36,
              width: 72,
              height: 72,
              borderRadius: "50%",
              border: "3px solid var(--d-ink)",
              opacity: ring,
              transform: `scale(${0.8 + 0.2 * ring})`,
            }}
          />
        )}
      </div>
      <p className="caption" style={{ position: "absolute", right: 112, top: 56 }}>
        Watch simulator, in the browser
      </p>
      <Builds scene="flow" builds={builds} />
    </section>
  );
}
