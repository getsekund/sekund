import { createContext, useContext } from "react";

/**
 * An outside clock for every Dither below the provider. Each surface paints exactly the frame
 * `time` names and runs no loop of its own; the field steps at the surface's own `fps` and the
 * reveal is read off the same clock. The Remotion video drives the deck's fields this way.
 */
export interface DitherClock {
  /** Seconds since the surface appeared. */
  time: number;
  /** Called when a surface starts loading its image; the returned function is called once that image has painted. */
  hold?: () => () => void;
}

const ClockContext = createContext<DitherClock | null>(null);

export const DitherClockProvider = ClockContext.Provider;

export function useDitherClock(): DitherClock | null {
  return useContext(ClockContext);
}
