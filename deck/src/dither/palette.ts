import { createContext, useContext } from "react";

/**
 * What the dither is drawn with. Lit cells are white or blue on the black ground; `mix` is the
 * share of lit cells that are blue. The blue cells are the ones that light first in the Bayer
 * order, so at every density the blue sits evenly inside the white instead of reading as noise.
 * Text, plates and the lit LCD never go through the dither, so they stay ink and paper.
 *
 * Change `DITHER_PALETTE` to change every dithered surface in the deck.
 */
export interface DitherPalette {
  id: string;
  /** Letter on the option sheet (A, B, C). */
  label: string;
  name: string;
  /** One line on the tone and what to watch for. */
  note: string;
  ground: string;
  white: string;
  blue: string;
  /** Share of lit cells drawn blue, 0..1. 0 is the monochrome deck. */
  mix: number;
}

const GROUND = "#000000";
const WHITE = "#f3f1e8";

/** The deck as it was: one-bit, ink on black. Kept as the fallback and for comparison. */
export const MONO: DitherPalette = {
  id: "mono",
  label: "0",
  name: "Monochrome",
  note: "Ink on black, nothing else.",
  ground: GROUND,
  white: WHITE,
  blue: WHITE,
  mix: 0,
};

/** Option A: a vivid electric blue, half the lit cells. The loudest; the dither becomes a colour statement. */
export const ELECTRIC: DitherPalette = {
  id: "electric",
  label: "A",
  name: "Electric",
  note: "Vivid electric blue, half of the lit cells. The dither becomes a colour statement; the blue is darker than the white, so dense fields lose a little brightness.",
  ground: GROUND,
  white: WHITE,
  blue: "#3b6cff",
  mix: 0.5,
};

/** Option B: a cooler, lighter steel blue, six in ten lit cells. Reads as a cool tint, keeps the luminance of the fields. */
export const STEEL: DitherPalette = {
  id: "steel",
  label: "B",
  name: "Steel",
  note: "Cooler, lighter steel blue, six of ten lit cells. Reads as a cool-toned field rather than a blue one; brightest of the three on a projector and the safest in print.",
  ground: GROUND,
  white: WHITE,
  blue: "#7a9bd0",
  mix: 0.6,
};

/** Option C: a violet-blue next to the Solana purple, four in ten lit cells. */
export const SOLANA: DitherPalette = {
  id: "solana",
  label: "C",
  name: "Solana-adjacent",
  note: "Violet-blue beside the Solana purple, four of ten lit cells. Ties the deck to the chain's colour; the most 'crypto' of the three and the one most likely to clash with a venue's own branding.",
  ground: GROUND,
  white: WHITE,
  blue: "#7b61ff",
  mix: 0.4,
};

/** The palette every Dither draws with unless given another. Goran can override here. */
export const DITHER_PALETTE: DitherPalette = STEEL;

/** The candidates on the `?palette` sheet, in sheet order. */
export const PALETTE_OPTIONS: readonly DitherPalette[] = [ELECTRIC, STEEL, SOLANA];

const PaletteContext = createContext<DitherPalette | null>(null);

/** Lets a subtree (the option sheet) draw with a palette other than the live one. */
export const PaletteProvider = PaletteContext.Provider;

export function usePalette(): DitherPalette {
  return useContext(PaletteContext) ?? DITHER_PALETTE;
}
