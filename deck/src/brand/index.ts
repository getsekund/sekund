import { BLOCK } from "./wordmark-block";
import { CHAMFER } from "./wordmark-chamfer";
import { DOTS } from "./wordmark-dots";
import { INTER } from "./wordmark-inter";
import { ROUND } from "./wordmark-round";
import { SEGMENT } from "./wordmark-segment";

export type { WordmarkSpec } from "./types";
export { BLOCK, CHAMFER, DOTS, INTER, ROUND, SEGMENT };

/** The wordmark the deck draws everywhere. Swap the import to change it. Goran's pick: Inter SemiBold. */
export const WORDMARK = INTER;

/** The directions on the option sheet, in sheet order: the four drawn proposals and the chosen typeset mark. */
export const WORDMARK_OPTIONS = [BLOCK, CHAMFER, ROUND, DOTS, INTER] as const;
