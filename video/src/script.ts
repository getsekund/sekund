/**
 * The pitch, as Goran reads it. Every scene, build and caption follows these times, and the
 * voice-over (public/vo.mp3) is laid from frame 0, so a recording that keeps to the script keeps
 * to the picture. Times are seconds from the start of the video.
 *
 * docs/submission/pitch-video-script.md in the Project store carries the same lines with the
 * recording guide; change both together.
 */

export const FPS = 30;
/** Under 2:00 by half a second, so audio padding in the encoder cannot push it over. */
export const TOTAL_SECONDS = 119.5;
export const TOTAL_FRAMES = Math.round(TOTAL_SECONDS * FPS);

/** Goran's voice-over in public/, laid from frame 0. Without it the cut is silent and the captions carry the script. */
export const VO_FILE = "vo.mp3";
/** Optional, in public/: Goran on camera for the team beat, with its own sound. The voice-over is muted under it. */
export const FOUNDER_FILE = "founder.mp4";

export type BeatId = "title" | "problem" | "product" | "proof" | "how" | "team" | "plan" | "close";

export interface Cue {
  /** When Goran starts the line. */
  at: number;
  /** When the line should be finished. */
  end: number;
  text: string;
}

export interface Beat {
  id: BeatId;
  /** What the beat is for, for the script doc and the Studio. */
  label: string;
  start: number;
  end: number;
  cues: readonly Cue[];
}

export const BEATS: readonly Beat[] = [
  {
    id: "title",
    label: "Title",
    start: 0,
    end: 5,
    cues: [{ at: 0.5, end: 3.9, text: "This is SEKUND: a hardware wallet you wear." }],
  },
  {
    id: "problem",
    label: "Problem",
    start: 5,
    end: 19,
    cues: [
      { at: 5.3, end: 9.5, text: "Hardware wallets keep keys safe, but they're a second object." },
      { at: 9.8, end: 11.6, text: "People don't carry them." },
      { at: 11.9, end: 16.0, text: "So they sign on the phone, beside every other app." },
      { at: 16.3, end: 18.5, text: "The watch is already on." },
    ],
  },
  {
    id: "product",
    label: "Product",
    start: 19,
    end: 34,
    cues: [
      { at: 19.3, end: 23.0, text: "SEKUND is a simple resin watch that signs Solana." },
      { at: 23.3, end: 26.8, text: "It reads the exact bytes it's asked to sign," },
      { at: 27.0, end: 30.0, text: "shows you the amount and where it goes," },
      { at: 30.2, end: 33.6, text: "and signs only when you approve on the watch." },
    ],
  },
  {
    id: "proof",
    label: "Proof",
    start: 34,
    end: 61,
    cues: [
      { at: 34.3, end: 36.2, text: "Here's the proof of concept." },
      { at: 36.5, end: 43.0, text: "The watch is a browser simulator, its secure element is software, and the signatures are real." },
      { at: 43.3, end: 47.0, text: "The phone app sends a devnet transfer to the watch." },
      { at: 47.3, end: 51.6, text: "The watch shows the amount and the destination, then asks: approve?" },
      { at: 51.9, end: 53.3, text: "I press approve." },
      { at: 53.6, end: 57.0, text: "The signature comes back, and the app checks it." },
      { at: 57.3, end: 60.6, text: "Devnet confirmed a transfer signed this way." },
    ],
  },
  {
    id: "how",
    label: "How it works",
    start: 61,
    end: 80,
    cues: [
      { at: 61.3, end: 65.6, text: "The phone app builds the transaction and sends its exact bytes." },
      { at: 65.9, end: 71.0, text: "The watch parses those bytes itself: what you see is what it signs." },
      { at: 71.3, end: 75.2, text: "A PIN opens a session. Approve is a separate button." },
      { at: 75.5, end: 79.6, text: "The signature comes back. The key never reaches the phone app." },
    ],
  },
  {
    id: "team",
    label: "Team",
    start: 80,
    end: 96,
    cues: [
      { at: 80.3, end: 83.5, text: "I'm Goran Petkovic, a product designer and developer." },
      { at: 83.8, end: 89.6, text: "Before SEKUND, I did product work for Motif Finance, Twilight and BitDSM." },
      { at: 89.9, end: 92.6, text: "Srdjan Solajic is our front-end developer." },
      { at: 92.8, end: 95.8, text: "We built all of this during the hackathon." },
    ],
  },
  {
    id: "plan",
    label: "90-day plan and the ask",
    start: 96,
    end: 114,
    cues: [
      { at: 96.3, end: 99.0, text: "In ninety days: one working prototype." },
      { at: 99.3, end: 104.9, text: "TROPIC01 holds the key; an nRF52840 runs the screen, buttons and Bluetooth." },
      { at: 105.2, end: 112.4, text: "We're asking for a place in the accelerator, a hardware partner, and an introduction to Solana Mobile." },
    ],
  },
  {
    id: "close",
    label: "Close",
    start: 114,
    end: TOTAL_SECONDS,
    cues: [{ at: 114.6, end: 117.6, text: "SEKUND. A hardware wallet you wear." }],
  },
];

export function beat(id: BeatId): Beat {
  const found = BEATS.find((b) => b.id === id);
  if (!found) throw new Error(`no beat ${id}`);
  return found;
}

/** A cue's start, in seconds from the start of its beat: what a scene's builds are timed against. */
export function cueAt(id: BeatId, index: number, offset = 0): number {
  const b = beat(id);
  const cue = b.cues[index];
  if (!cue) throw new Error(`beat ${id} has no cue ${index}`);
  return cue.at - b.start + offset;
}

export function words(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Words per minute the line asks for. */
export function pace(cue: Cue): number {
  return (words(cue.text) / (cue.end - cue.at)) * 60;
}

export function voiceOver(): string {
  return BEATS.flatMap((b) => b.cues.map((c) => c.text)).join(" ");
}

export function timecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
