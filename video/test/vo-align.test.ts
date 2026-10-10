import { describe, expect, it } from "vitest";
import { BEATS } from "../src/script";
import { align, frameLevels, speechSegments } from "../scripts/vo-align";

const cueStarts = BEATS.flatMap((b) => b.cues.map((c) => c.at));

/** Deterministic jitter, so a failure reproduces. */
function jitter(i: number, amount: number): number {
  return Math.sin(i * 12.9898) * amount;
}

describe("aligning a take to the script", () => {
  it("finds the lead-in of a take read along with the captions, with late, missing and extra onsets", () => {
    const lead = 3.27;
    const onsets = cueStarts
      .map((at, i) => at + lead + jitter(i, 0.2))
      .filter((_, i) => i % 7 !== 3)
      .concat([1.1, 20.4, 47.9, 88.2].map((t) => t + lead));
    const result = align(onsets, cueStarts, { min: -1, max: 60 });
    expect(result.offset).toBeCloseTo(lead, 1);
    expect(result.matched).toBeGreaterThanOrEqual(cueStarts.length - 5);
  });

  it("handles a take that started after the video did", () => {
    const onsets = cueStarts.slice(1).map((at) => at - 0.4);
    const result = align(onsets, cueStarts, { min: -1, max: 30 });
    expect(result.offset).toBeCloseTo(-0.4, 2);
  });

  it("reports how far each line lands from its cue", () => {
    const onsets = cueStarts.map((at, i) => (i === 5 ? at + 2 + 0.5 : at + 2));
    const result = align(onsets, cueStarts, { min: -1, max: 30 });
    expect(result.offset).toBeCloseTo(2, 2);
    expect(result.drift[5]).toBeCloseTo(0.5, 2);
    expect(result.drift.filter((d) => d === 0)).toHaveLength(cueStarts.length - 1);
  });
});

describe("finding speech in a take", () => {
  it("finds the start of each burst over a room's noise floor", () => {
    const rate = 16_000;
    const samples = new Float32Array(rate * 10);
    for (let i = 0; i < samples.length; i++) samples[i] = jitter(i, 0.003);
    const bursts = [
      [1.0, 2.4],
      [2.9, 3.5],
      [6.2, 8.0],
    ] as const;
    for (const [from, to] of bursts) {
      for (let i = Math.round(from * rate); i < Math.round(to * rate); i++) samples[i] = 0.3 * Math.sin((2 * Math.PI * 180 * i) / rate);
    }
    const { segments, range } = speechSegments(frameLevels(samples, rate));
    expect(range).toBeGreaterThan(30);
    expect(segments.map((s) => s.start)).toEqual(bursts.map(([from]) => expect.closeTo(from, 1)));
  });
});
