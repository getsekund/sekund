import { BEATS } from "./script";

/** Longest caption line, in characters: one line at the caption size, inside the frame margins. */
export const CAPTION_MAX = 58;
/** How long a caption may stay up after its line ends, if the next line has not started. */
const LINGER = 0.35;

export interface CaptionChunk {
  start: number;
  end: number;
  text: string;
}

/**
 * Splits a line into caption-sized pieces at word boundaries, preferring to break after
 * punctuation, so every caption is one line.
 */
export function splitLine(text: string, max = CAPTION_MAX): string[] {
  if (text.length <= max) return [text];
  const words = text.split(" ");
  const out: string[] = [];
  let rest = words;
  while (rest.join(" ").length > max) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 1; i < rest.length; i++) {
      const head = rest.slice(0, i).join(" ");
      if (head.length > max) break;
      const tail = rest.slice(i).join(" ");
      const punct = /[,;:.?]$/.test(head) ? 40 : 0;
      // As few pieces as possible; then even halves; a break after punctuation reads better still.
      const score = (tail.length > max ? -1000 : 0) + punct - Math.abs(head.length - tail.length) / 2;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) best = 1;
    out.push(rest.slice(0, best).join(" "));
    rest = rest.slice(best);
  }
  out.push(rest.join(" "));
  return out;
}

/** Every caption in the video, timed: a line's pieces share its time in proportion to their length. */
export function captionChunks(): CaptionChunk[] {
  const cues = BEATS.flatMap((b) => b.cues);
  const out: CaptionChunk[] = [];
  cues.forEach((cue, i) => {
    const next = cues[i + 1];
    const hardEnd = Math.min(cue.end + LINGER, next ? next.at : cue.end + LINGER);
    const pieces = splitLine(cue.text);
    const total = pieces.reduce((n, p) => n + p.length, 0);
    let t = cue.at;
    pieces.forEach((text, k) => {
      const last = k === pieces.length - 1;
      const end = last ? hardEnd : t + ((cue.end - cue.at) * text.length) / total;
      out.push({ start: t, end, text });
      t = end;
    });
  });
  return out;
}

export function captionAt(seconds: number, chunks: readonly CaptionChunk[]): CaptionChunk | null {
  return chunks.find((c) => seconds >= c.start && seconds < c.end) ?? null;
}
