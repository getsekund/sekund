import { Composition } from "remotion";
import { Pitch, type PitchProps } from "./Pitch";
import { FPS, TOTAL_FRAMES } from "./script";

export const COMPOSITION_ID = "SekundPitch";

export function Root() {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={Pitch}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ captions: true } satisfies PitchProps}
    />
  );
}
