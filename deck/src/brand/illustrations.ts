/**
 * A watch illustration for the dithered hero slides. Each is a generated resin-watch photo with
 * the real watch-sim LCD capture composited into the screen in perspective and the live wordmark
 * drawn on the bezel; nothing on the case is a photo of real SEKUND hardware.
 */
export interface IllustrationSpec {
  id: string;
  /** Letter used on the option sheet (A, B, C, D). */
  label: string;
  name: string;
  /** One line on the candidate: angle, light, what to watch for. */
  note: string;
  /** Composite with the clock face (slide 1). */
  src: string;
  /** Composite with the APPROVE? page (slide 10). Falls back to `src`. */
  approveSrc?: string;
  /** The wordmark alone, warped into the same frame, as a transparent PNG at 2x. Laid over the dither so it stays crisp. */
  markSrc?: string;
  /** The LCD alone, toned as a lit display, as a transparent PNG at 2x. When set, the panel is laid over the dither undithered. */
  lcdSrc?: string;
  /** Same for the APPROVE? page. Falls back to `lcdSrc`. */
  approveLcdSrc?: string;
  width: number;
  height: number;
  /** Tone the Dither applies before thresholding. */
  contrast: number;
  gamma: number;
}

/** The watch-sim 3D capture the deck opened with. Kept for reference and as a fallback; the shipped slide shows it undithered. */
export const CAPTURE: IllustrationSpec = {
  id: "capture",
  label: "0",
  name: "Watch-sim capture",
  note: "Straight-on 3D render from watch-sim, dark theme. Honest but flat; the strap and case merge into the ground.",
  src: "/assets/watch-sim-3d.png",
  width: 1132,
  height: 1478,
  contrast: 1.35,
  gamma: 0.9,
};

export const FACETED: IllustrationSpec = {
  id: "faceted",
  label: "A",
  name: "Faceted",
  note: "Three-quarter view, octagonal bezel, knurled pushers, strap and buckle in frame. Handsome, small in frame, and the silhouette is a well-known Casio.",
  src: "/assets/watch-a-clock.jpg",
  markSrc: "/assets/watch-a-mark.png",
  width: 864,
  height: 1152,
  contrast: 1.15,
  gamma: 0.72,
};

export const FRONTAL: IllustrationSpec = {
  id: "frontal",
  label: "B",
  name: "Frontal",
  note: "The watch-sim case rebuilt as a photo, barely turned. Biggest LCD of the set, so the digits dither best; the least depth.",
  src: "/assets/watch-b-clock.jpg",
  markSrc: "/assets/watch-b-mark.png",
  width: 864,
  height: 1152,
  contrast: 1.15,
  gamma: 0.72,
};

export const TURNED: IllustrationSpec = {
  id: "turned",
  label: "C",
  name: "Turned",
  note: "Same case at a stronger three-quarter angle with the strap curving away. Most product-photo of the four; the narrow bezel leaves the mark small.",
  src: "/assets/watch-c-clock.jpg",
  markSrc: "/assets/watch-c-mark.png",
  approveSrc: "/assets/watch-c-approve.jpg",
  width: 864,
  height: 1152,
  contrast: 1.15,
  gamma: 0.72,
};

export const BROW: IllustrationSpec = {
  id: "brow",
  label: "D",
  name: "Brow",
  note: "Slight three-quarter view with a wide bezel above the LCD, so SEKUND sits on resin at a size that survives the dither. Rim light on the right edge.",
  src: "/assets/watch-d-clock.jpg",
  markSrc: "/assets/watch-d-mark.png",
  approveSrc: "/assets/watch-d-approve.jpg",
  width: 864,
  height: 1152,
  contrast: 1.15,
  gamma: 0.72,
};

/**
 * Brow with the LCD lit: the case and strap go through the dither, the panel and the wordmark are
 * laid over it crisp, so the digits read at slide size.
 */
export const BROW_LIT: IllustrationSpec = {
  ...BROW,
  id: "brow-lit",
  name: "Brow, lit LCD",
  note: "Same photo. Only the resin is dithered; the LCD panel is a separate undithered layer toned as a lit display, with the wordmark over it.",
  lcdSrc: "/assets/watch-d-lcd.png",
  approveLcdSrc: "/assets/watch-d-approve-lcd.png",
};

/** The illustration slides 1 and 10 draw. Swap the constant to change it (`BROW` for the fully dithered one). Goran's pick: the lit LCD. */
export const ILLUSTRATION = BROW_LIT;

/** The candidates on the option sheet, in sheet order. */
export const ILLUSTRATION_OPTIONS: readonly IllustrationSpec[] = [FACETED, FRONTAL, TURNED, BROW];

/** The two treatments of the live illustration compared on `?hero`: fully dithered, and with the LCD lit. */
export const HERO_LCD_VARIANTS: readonly IllustrationSpec[] = [BROW, BROW_LIT];
