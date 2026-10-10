import { BLOCK } from "./wordmark-block";
import { CHAMFER } from "./wordmark-chamfer";
import { DOTS } from "./wordmark-dots";
import { ROUND } from "./wordmark-round";
import { SEGMENT } from "./wordmark-segment";

export type { WordmarkSpec } from "./types";
export { BLOCK, CHAMFER, DOTS, ROUND, SEGMENT };

/** The wordmark the deck draws everywhere. Swap the import to change it. */
export const WORDMARK = CHAMFER;

/** The four directions on the option sheet, in sheet order. */
export const WORDMARK_OPTIONS = [BLOCK, CHAMFER, ROUND, DOTS] as const;
