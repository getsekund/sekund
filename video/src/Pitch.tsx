import { AbsoluteFill, Html5Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { Captions } from "./Captions";
import { FontsReady } from "./deck";
import { BEATS, beat, FOUNDER_FILE, VO_FILE, type BeatId } from "./script";
import { hasStatic } from "./static-files";
import { CloseScene, HowScene, PlanScene, ProblemScene, TitleScene } from "./scenes/deck-beats";
import { ProductScene } from "./scenes/Product";
import { ProofScene } from "./scenes/Proof";
import { TeamScene } from "./scenes/Team";

export interface PitchProps extends Record<string, unknown> {
  /** Burn the voice-over in as captions. */
  captions: boolean;
}

function scene(id: BeatId, founderClip: boolean) {
  switch (id) {
    case "title":
      return <TitleScene />;
    case "problem":
      return <ProblemScene />;
    case "product":
      return <ProductScene />;
    case "proof":
      return <ProofScene />;
    case "how":
      return <HowScene />;
    case "team":
      return <TeamScene founderClip={founderClip} />;
    case "plan":
      return <PlanScene />;
    case "close":
      return <CloseScene />;
  }
}

export function Pitch({ captions }: PitchProps) {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  const vo = hasStatic(VO_FILE);
  const founderClip = hasStatic(FOUNDER_FILE);
  const team = beat("team");
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <FontsReady>
        {BEATS.map((b) => (
          <Sequence key={b.id} from={f(b.start)} durationInFrames={f(b.end) - f(b.start)} name={b.label}>
            {scene(b.id, founderClip)}
          </Sequence>
        ))}
        {captions && <Captions />}
      </FontsReady>
      {vo && <Html5Audio src={staticFile(VO_FILE)} volume={(frame) => (founderClip && frame >= f(team.start) && frame < f(team.end) ? 0 : 1)} />}
    </AbsoluteFill>
  );
}
