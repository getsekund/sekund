import { Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Builds, DeckSlide, FrameClock, ImagesReady } from "../deck";
import { deckSlide, riseAll, type Build } from "../slides";
import { beat, cueAt } from "../script";

/**
 * Proof, in three shots, all real:
 * 1. What is simulated and what is real, over the deck's 3D simulator capture.
 * 2. The approve flow from scripts/capture.ts: the phone app's request card and the watch
 *    simulator paging through the review to APPROVE?, D pressed, SIGNED.
 * 3. The deck's proof slide: the confirmed devnet transfer in Solana Explorer.
 */
const PROOF = beat("proof");
/** Shot boundaries, in seconds from the start of the beat. */
const FLOW_AT = 8;
const EXPLORER_AT = 22.5;

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
        <DeckSlide id="proof" builds={riseAll(0.15, 2)} />
      </Sequence>
    </>
  );
}

function HonestyShot() {
  const builds: Build[] = [
    { selector: ".slide__body > :nth-child(1)", at: cueAt("proof", 0) },
    // Timed to "a browser simulator" and "software" in the second line.
    { selector: ".list > li:nth-child(1)", at: cueAt("proof", 1, 1.4) },
    { selector: ".list > li:nth-child(2)", at: cueAt("proof", 1, 3.4) },
    { selector: ".list > li:nth-child(3)", at: cueAt("proof", 1, 4.6) },
  ];
  return (
    <FrameClock>
      <ImagesReady>
        <section className="slide" data-scene="honesty">
          <div className="proof__bg">{deckSlide("shipped").render({ active: true })}</div>
          <div className="slide__body slide__body--quiet">
            <h2 className="title">Proof of concept.</h2>
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
  [0, "watch-menu"], // 42.0: Secure Mode, PIN entered, waiting for a request
  [2.6, "watch-review-amount"], // 44.6: the request arrives
  [6.6, "watch-review-to-1"], // 48.6: "the destination"
  [7.3, "watch-review-to-2"],
  [7.8, "watch-review-network"],
  [8.05, "watch-review-fee"],
  [8.3, "watch-review-approve"], // 50.3: "approve?"
  [9.4, "watch-press-d"], // 51.4: "I press approve"
  [10.9, "watch-signed"], // 52.9: "The signature comes back"
];
const PRESS = { from: 9.4, to: 10.9 };
const APP_SIGNED_AT = 11.6;

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
  const appSigned = t >= APP_SIGNED_AT;
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
        <p className="caption">Phone app, devnet</p>
        <div style={{ position: "relative", width: CARD_W }}>
          <Img src={staticFile("captures/companion-waiting.png")} style={{ width: CARD_W, display: "block", visibility: appSigned ? "hidden" : "visible" }} />
          <Img src={staticFile("captures/companion-signed.png")} style={{ position: "absolute", left: 0, top: 0, width: CARD_W, display: "block", visibility: appSigned ? "visible" : "hidden" }} />
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
