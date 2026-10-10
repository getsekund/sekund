import { describe, expect, it } from "vitest";
import { CAPTION_MAX, captionChunks, splitLine } from "../src/captions";
import { BEATS, FPS, pace, TOTAL_FRAMES, TOTAL_SECONDS, voiceOver, words } from "../src/script";
import { teamFounders } from "../src/team";

describe("timing", () => {
  it("runs under two minutes, in whole frames", () => {
    expect(TOTAL_SECONDS).toBeLessThanOrEqual(120);
    expect(TOTAL_FRAMES).toBe(TOTAL_SECONDS * FPS);
  });

  it("tells the story in the brief's order, beat after beat with no gaps", () => {
    expect(BEATS.map((b) => b.id)).toEqual(["title", "problem", "product", "proof", "how", "team", "plan", "close"]);
    expect(BEATS[0]!.start).toBe(0);
    expect(BEATS.at(-1)!.end).toBe(TOTAL_SECONDS);
    BEATS.forEach((b, i) => {
      expect(b.end).toBeGreaterThan(b.start);
      if (i > 0) expect(b.start).toBe(BEATS[i - 1]!.end);
    });
  });

  it("keeps every line inside its beat, in order, with air between lines", () => {
    for (const b of BEATS) {
      b.cues.forEach((c, i) => {
        expect(c.at).toBeGreaterThanOrEqual(b.start);
        expect(c.end).toBeLessThanOrEqual(b.end);
        expect(c.end).toBeGreaterThan(c.at);
        if (i > 0) expect(c.at - b.cues[i - 1]!.end).toBeGreaterThanOrEqual(0.15);
      });
    }
  });

  it("asks for a pace Goran can read: about 150 words a minute, never rushed", () => {
    for (const cue of BEATS.flatMap((b) => b.cues)) {
      expect(pace(cue), cue.text).toBeGreaterThanOrEqual(110);
      expect(pace(cue), cue.text).toBeLessThanOrEqual(170);
    }
    const total = (words(voiceOver()) / TOTAL_SECONDS) * 60;
    expect(total).toBeGreaterThan(110);
    expect(total).toBeLessThan(150);
  });
});

describe("claims", () => {
  const vo = voiceOver();

  it("ends on the one-liner", () => {
    expect(BEATS.at(-1)!.cues.at(-1)!.text).toMatch(/A hardware wallet you wear\.$/);
  });

  it("makes none of the claims we do not make", () => {
    for (const banned of [/\bfirst\b/i, /\bunique\b/i, /\bcheap/i, /new category/i, /on your wrist/i, /signed on the watch/i, /\bcompanion\b/i]) {
      expect(vo).not.toMatch(banned);
    }
  });

  it("says out loud what is simulated", () => {
    expect(vo).toMatch(/browser simulator/);
    expect(vo).toMatch(/secure element is software/);
  });

  it("uses no figures beyond the part names", () => {
    expect(vo.replace(/TROPIC01|nRF52840/g, "")).not.toMatch(/\d/);
  });
});

describe("team", () => {
  const team = BEATS.find((b) => b.id === "team")!;
  const said = team.cues.map((c) => c.text).join(" ");
  const founders = teamFounders();

  it("reads the founders off the deck's team slide", () => {
    expect(founders.length).toBeGreaterThanOrEqual(2);
    for (const f of founders) expect(f.line.length).toBeGreaterThan(0);
  });

  it("says every name, role and company the slide shows, so the voice-over matches the slide", () => {
    for (const f of founders) {
      expect(said, f.name).toContain(f.name);
      const role = f.line.split(/[;.(]/)[0]!.toLowerCase();
      for (const word of role.split(/\s+/).filter(Boolean)) expect(said.toLowerCase(), `${f.name}: ${word}`).toContain(word);
      const names = f.line
        .split(/[;.]\s*/)
        .flatMap((sentence) => sentence.split(/\s+/).slice(1))
        .map((w) => w.replace(/[^\p{L}\p{N}-]/gu, ""))
        .filter((w) => /^\p{Lu}/u.test(w));
      for (const name of names) expect(said, `${f.name}: ${name}`).toContain(name);
    }
  });
});

describe("captions", () => {
  it("keeps every caption to one line", () => {
    for (const c of captionChunks()) expect(c.text.length, c.text).toBeLessThanOrEqual(CAPTION_MAX);
  });

  it("splits a long line into as few pieces as fit, at a word boundary", () => {
    const line = "I run a product agency, and did product development for Motif, Twilight and BitDSM.";
    const pieces = splitLine(line);
    expect(pieces).toHaveLength(2);
    expect(pieces.join(" ")).toBe(line);
  });

  it("never shows two captions at once and carries every word", () => {
    const chunks = captionChunks();
    chunks.forEach((c, i) => {
      expect(c.end).toBeGreaterThan(c.start);
      if (i > 0) expect(c.start).toBeGreaterThanOrEqual(chunks[i - 1]!.end - 1e-9);
    });
    expect(chunks.map((c) => c.text).join(" ")).toBe(voiceOver());
  });
});
