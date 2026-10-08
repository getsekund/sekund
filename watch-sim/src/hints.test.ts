import { describe, expect, it } from "vitest";
import { initialState, REVIEW_PAGES, transition, type WatchState } from "@/machine/machine";
import { pinProgress, stepActions, stepHint } from "./hints";

function ready(patch: Partial<WatchState> = {}): WatchState {
  return { ...initialState(), ready: true, onWrist: true, ...patch };
}

describe("step hints", () => {
  it("names the physical buttons that open Secure", () => {
    expect(stepHint(ready())).toBe("Hold upper left (A) and lower right (D) together to enter Secure.");
    expect(stepHint(ready({ onWrist: false }))).toBe(
      "Turn the wrist on. Then hold upper left (A) and lower right (D) together to enter Secure.",
    );
  });

  it("names the digit and the buttons while the PIN is the current step", () => {
    expect(stepHint(ready({ screen: { kind: "entry", mode: "unlock", until: 1 } }))).toContain("Hold both right buttons (C and D)");
    expect(
      stepHint(ready({ screen: { kind: "pin", mode: "create", digits: [1], current: 2, notice: null } })),
    ).toBe(
      "Choose digit 2 of 4. It is 2. Upper left (A) lowers it. Lower left (B) raises it. Hold both right buttons (C and D) to lock it.",
    );
    expect(
      stepHint(ready({ screen: { kind: "pin", mode: "unlock", digits: [], current: 0, notice: "wrong" } })),
    ).toContain("Wrong PIN.");
  });

  it("says which side rejects and which side approves", () => {
    const state = ready({ screen: { kind: "review", page: 0 } });
    expect(stepHint(state)).toBe(
      "Lower left (B) shows the next field. Upper right (C) rejects. Lower right (D) approves on the last page.",
    );
    expect(stepHint({ ...state, screen: { kind: "review", page: REVIEW_PAGES.length - 1 } })).toBe(
      "Upper right (C) rejects. Lower right (D) approves.",
    );
  });

  it("gives expired and locked a next step, and stays quiet on the secure menu", () => {
    const opened = transition(ready({ hasPin: true }), { type: "GESTURE", buttons: ["A", "D"], now: 0 });
    const pin = transition(opened.state, { type: "TICK", now: 1_000 });
    expect(stepHint(pin.state)).toContain("Hold both right buttons (C and D)");
    expect(stepHint(ready({ session: true, screen: { kind: "menu", index: 0, notice: null } }))).toBeNull();
    expect(stepHint(ready({ screen: { kind: "result", status: "EXPIRED", until: null } }))).toContain("send the transfer again");
    expect(stepHint(ready({ screen: { kind: "wiped" } }))).toContain("Reset the simulator");
  });
});

describe("PIN progress", () => {
  it("keeps the current digit visible and masks digits already locked", () => {
    const progress = pinProgress(
      ready({ screen: { kind: "pin", mode: "unlock", digits: [1, 2], current: 4, notice: null } }),
    );
    expect(progress).toEqual({
      pattern: "-  -  4  _",
      line: "Digit 3 of 4 is 4. Dashes are digits you locked.",
    });
    expect(pinProgress(ready())).toBeNull();
  });
});

describe("step actions", () => {
  it("offers one primary press for the step", () => {
    expect(stepActions(ready()).map((a) => a.label)).toEqual(["Enter Secure"]);
    expect(stepActions(ready({ screen: { kind: "pin", mode: "unlock", digits: [], current: 0, notice: null } }))[0]).toMatchObject({
      label: "Lock digit",
      buttons: ["C", "D"],
      tone: "primary",
    });
    const last = stepActions(ready({ screen: { kind: "review", page: REVIEW_PAGES.length - 1 } }));
    expect(last.map((a) => a.label)).toEqual(["Reject", "Approve"]);
    expect(last.filter((a) => a.tone === "primary")).toHaveLength(1);
  });
});
