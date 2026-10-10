import captures from "../public/captures/captures.json";

/** What scripts/capture.ts recorded: the shots it took and, for a run that reached devnet, the transfer. */
export interface CaptureRun {
  transaction?: { signature: string; signer: string; explorer: string };
  shots: Record<string, string>;
}

export const RUN: CaptureRun = captures;

/** A run that was broadcast, confirmed, read back from devnet and shot in Explorer. */
export function confirmed(run: CaptureRun): boolean {
  return run.transaction !== undefined && "companion-confirmed" in run.shots && "explorer-rows" in run.shots;
}

/**
 * The phone app's card through the approve flow, as [seconds since the flow shot began, shot]:
 * only states the run really reached. A run that was not sent stops at WAITING.
 */
export function appCards(run: CaptureRun, at: { signed: number; confirmed: number }): (readonly [number, string])[] {
  if (!confirmed(run)) return [[0, "companion-waiting"]];
  return [[0, "companion-waiting"], ...("companion-signed" in run.shots ? [[at.signed, "companion-signed"] as const] : []), [at.confirmed, "companion-confirmed"]];
}
