import { Easing } from "remotion";
import { SLIDES } from "@/deck/slides";

/** The deck's `rise`: 520 ms, 16 px up, on cubic-bezier(0.2, 0.7, 0.2, 1). */
export const RISE_S = 0.52;
export const RISE_PX = 16;
export const riseEase = Easing.bezier(0.2, 0.7, 0.2, 1);

export interface Build {
  /** Selector inside the scene. */
  selector: string;
  /** Seconds from the start of the scene. */
  at: number;
}

/** The deck show's reveal: every child of the slide body rises in, 90 ms apart. */
export function riseAll(start = 0.15, count = 5): Build[] {
  return Array.from({ length: count }, (_, i) => ({ selector: `.slide__body > :nth-child(${i + 1})`, at: start + Math.min(i, 4) * 0.09 }));
}

export function deckSlide(id: string) {
  const slide = SLIDES.find((s) => s.id === id);
  if (!slide) throw new Error(`the deck has no slide "${id}"`);
  return slide;
}
