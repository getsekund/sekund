import { OffthreadVideo, staticFile } from "remotion";
import { Builds, FrameClock, ImagesReady } from "../deck";
import type { Build } from "../slides";
import { beat, FOUNDER_FILE } from "../script";
import { markFounders, teamSlide } from "../team";

/** The deck's team slide; each founder's block rises in when the voice-over says the name. */
export function TeamScene({ founderClip }: { founderClip: boolean }) {
  const team = beat("team");
  const { node, founders } = markFounders(teamSlide().render({ active: true }));
  const builds: Build[] = [
    { selector: ".slide__body > :nth-child(1)", at: 0.15 },
    ...founders.map((f, i) => ({
      selector: `[data-founder="${i}"]`,
      at: (team.cues.find((c) => c.text.includes(f.name))?.at ?? team.cues[0]!.at) - team.start,
    })),
  ];
  return (
    <FrameClock>
      <ImagesReady>
        <section className="slide" data-slide="team" data-scene="team" data-active="true">
          {node}
          {founderClip && (
            <div className="frame__img" style={{ position: "absolute", right: 112, top: 190, width: 560, height: 700, zIndex: 2 }}>
              <OffthreadVideo src={staticFile(FOUNDER_FILE)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}
        </section>
      </ImagesReady>
      <Builds scene="team" builds={builds} />
    </FrameClock>
  );
}
