import { useCurrentFrame, useVideoConfig } from "remotion";
import { Knock } from "@/ui/Knock";
import { Builds, FrameClock, ImagesReady } from "../deck";
import { deckSlide, type Build } from "../slides";
import { cueAt } from "../script";

/**
 * The product, on the deck's hero: the claim slide's dithered watch with the clock on its face,
 * then the close slide's, with the APPROVE? page, when the line reaches approval. The copy says
 * what the line says, knocked out of the field the way the hero copy is.
 */
export function ProductScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const approve = frame / fps >= cueAt("product", 3);
  const builds: Build[] = [
    { selector: ".product__copy > :nth-child(1)", at: cueAt("product", 0) },
    { selector: ".product__copy > :nth-child(2)", at: cueAt("product", 1) },
    { selector: ".product__copy > :nth-child(3)", at: cueAt("product", 2) },
    { selector: ".product__copy > :nth-child(4)", at: cueAt("product", 3) },
    { selector: ".product__caption", at: cueAt("product", 0, 0.4) },
  ];
  const layer = (visible: boolean): React.CSSProperties => ({ position: "absolute", inset: 0, visibility: visible ? "visible" : "hidden" });
  return (
    <FrameClock>
      <ImagesReady>
        <section className="slide" data-scene="product">
          <div className="product__bg" style={layer(!approve)}>
            {deckSlide("claim").render({ active: true })}
          </div>
          <div className="product__bg" style={layer(approve)}>
            {deckSlide("close").render({ active: true })}
          </div>
          <div className="slide__body">
            <div className="hero-copy hero-copy--solo product__copy">
              <Knock as="h2" className="title">
                A simple resin watch
                <br />
                that signs Solana.
              </Knock>
              <Knock as="p" className="lead">
                Reads the exact bytes it signs.
              </Knock>
              <Knock as="p" className="lead">
                Shows the amount and where it goes.
              </Knock>
              <Knock as="p" className="lead">
                Signs only when you approve.
              </Knock>
            </div>
          </div>
          <div className="product__caption" style={{ position: "absolute", left: 112, bottom: 112, zIndex: 1 }}>
            <Knock as="p" className="caption">
              Target design, render.
            </Knock>
          </div>
        </section>
      </ImagesReady>
      <Builds scene="product" builds={builds} />
      {/* The leads sit on the busiest part of the field, so they knock out as wide as the claim does. */}
      <style>{`[data-scene="product"] .product__bg .slide__body { display: none; } [data-scene="product"] .lead.knock { --knock: 9px; }`}</style>
    </FrameClock>
  );
}
