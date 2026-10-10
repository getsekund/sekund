/**
 * Lines a voice-over take up with the script. Goran records on his own device while the captions
 * cut plays, so the take starts at an arbitrary point before the video does. The offset is found by
 * matching where speech starts after a pause against the cue starts in src/script.ts.
 */

export interface Segment {
  start: number;
  end: number;
}

export interface Alignment {
  /** Seconds of the take that come before 0:00 of the video. Negative when the take starts late. */
  offset: number;
  /** For each cue, where the nearest speech onset falls relative to the cue's start, in seconds. */
  drift: number[];
  /** Cues with an onset within MATCH_S of their start. */
  matched: number;
}

/** 20 ms frames: short enough for word onsets, long enough to ignore single clicks. */
export const FRAME_S = 0.02;
/** A gap this long between voiced frames counts as a pause, so the next voiced frame is an onset. */
const PAUSE_S = 0.15;
/** Voiced runs shorter than this are clicks or breaths. */
const MIN_SEGMENT_S = 0.06;
/** An onset this close to a cue start counts as that cue. */
export const MATCH_S = 0.6;

/** Mean-square level per frame in dB, from mono samples. */
export function frameLevels(samples: Float32Array, sampleRate: number): Float64Array {
  const size = Math.round(sampleRate * FRAME_S);
  const count = Math.floor(samples.length / size);
  const out = new Float64Array(count);
  for (let f = 0; f < count; f++) {
    let sum = 0;
    for (let i = f * size; i < (f + 1) * size; i++) sum += samples[i]! * samples[i]!;
    out[f] = 10 * Math.log10(sum / size + 1e-12);
  }
  return out;
}

function percentile(values: Float64Array, p: number): number {
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? -120;
}

/**
 * Speech runs, with the threshold set from the take itself (a phone in a room and a clean studio
 * file have floors 60 dB apart). Returns the runs and the gap between speech and floor, in dB.
 */
export function speechSegments(levels: Float64Array): { segments: Segment[]; range: number } {
  const floor = percentile(levels, 0.1);
  const speech = percentile(levels, 0.95);
  const range = speech - floor;
  const threshold = speech - Math.min(30, 0.7 * range);
  const segments: Segment[] = [];
  let open: Segment | null = null;
  for (let f = 0; f < levels.length; f++) {
    const t = f * FRAME_S;
    if (levels[f]! < threshold) continue;
    if (open && t - open.end <= PAUSE_S) open.end = t + FRAME_S;
    else {
      if (open) segments.push(open);
      open = { start: t, end: t + FRAME_S };
    }
  }
  if (open) segments.push(open);
  return { segments: segments.filter((s) => s.end - s.start >= MIN_SEGMENT_S), range };
}

function nearest(sorted: readonly number[], t: number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < t) lo = mid + 1;
    else hi = mid;
  }
  const after = sorted[lo] ?? Infinity;
  const before = sorted[lo - 1] ?? -Infinity;
  return t - before < after - t ? before : after;
}

/**
 * The offset that puts the most cue starts on a speech onset. Each cue's miss is capped, so a line
 * read early, late or run into the next one costs the same and cannot drag the rest along.
 */
export function align(onsets: readonly number[], cueStarts: readonly number[], options: { min?: number; max: number }): Alignment {
  const sorted = [...onsets].sort((a, b) => a - b);
  const min = options.min ?? -1;
  let best = { offset: 0, cost: Infinity };
  for (let step = Math.round(min * 100); step <= Math.round(options.max * 100); step++) {
    const offset = step / 100;
    let cost = 0;
    for (const cue of cueStarts) cost += Math.min(MATCH_S, Math.abs(nearest(sorted, cue + offset) - (cue + offset)));
    if (cost < best.cost - 1e-9) best = { offset, cost };
  }
  const drift = cueStarts.map((cue) => {
    const at = cue + best.offset;
    return Math.round((nearest(sorted, at) - at) * 100) / 100;
  });
  return { offset: best.offset, drift, matched: drift.filter((d) => Math.abs(d) <= MATCH_S).length };
}
