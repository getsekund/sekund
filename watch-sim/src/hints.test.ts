import { describe, expect, it } from "vitest";
import { initialState, REVIEW_PAGES, transition, type WatchState } from "@/machine/machine";
import { stepHint } from "./hints";

function ready(patch: Partial<WatchState> = {}): WatchState {
  return { ...initialState(), ready: true, onWrist: true, ...patch };
}

describe("step hints", () => {
  it("tells you to hold A and D only while the face shows the time", () => {
    expect(stepHint(ready())).toBe("Hold A and D together to enter Secure.");
    expect(stepHint(ready({ onWrist: false }))).toBe("Turn the wrist on. Then hold A and D together to enter Secure.");
  });

  it("explains the digit and confirm while the PIN is the current step", () => {
    const pin = "A lowers the digit. B raises it. Hold C and D together to confirm.";
    expect(stepHint(ready({ screen: { kind: "entry", mode: "unlock", until: 1 } }))).toBe(pin);
    expect(
      stepHint(ready({ screen: { kind: "pin", mode: "create", digits: [1], current: 2, notice: null } })),
    ).toBe(pin);
  });

  it("says reject and approve only in the words for this review page", () => {
    const state = ready({ screen: { kind: "review", page: 0 } });
    expect(stepHint(state)).toBe("B shows the next field. C rejects. D approves on the last page.");
    expect(stepHint({ ...state, screen: { kind: "review", page: REVIEW_PAGES.length - 1 } })).toBe("C rejects. D approves.");
  });

  it("stays quiet once the PIN is done and no transfer is on screen", () => {
    const opened = transition(ready({ hasPin: true }), { type: "GESTURE", buttons: ["A", "D"], now: 0 });
    const pin = transition(opened.state, { type: "TICK", now: 1_000 });
    expect(stepHint(pin.state)).toContain("Hold C and D");
    expect(stepHint(ready({ session: true, screen: { kind: "menu", index: 0, notice: null } }))).toBeNull();
  });
});
