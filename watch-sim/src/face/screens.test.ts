import { describe, expect, it } from "vitest";
import { gesture, type Button } from "@/machine/gestures";
import { DEFAULT_CONFIG, initialState, REVIEW_PAGES, transition, type WatchEvent, type WatchState } from "@/machine/machine";
import { makeReview, OWN_ADDRESS } from "@/testing/fixtures";
import { GLCD } from "./glcdfont";
import { renderFace } from "./screens";

const NOW = new Date(2026, 9, 7, 10, 9, 36).getTime();

function drive(events: (s: WatchState) => WatchEvent[], start?: WatchState): WatchState {
  let s =
    start ??
    transition(initialState({}, NOW), { type: "SE_READY", hasPin: true, address: OWN_ADDRESS, attemptsLeft: 3, profile: "TROPIC01", maxMessageBytes: 4096 }).state;
  for (const e of events(s)) s = transition(s, e).state;
  return s;
}

const press = (now: number, ...b: Button[]): WatchEvent => ({ type: "GESTURE", buttons: gesture(...b), now });
const steady = (s: WatchState) => renderFace(s, { reducedMotion: true });

function unlocked(): WatchState {
  const at = NOW + DEFAULT_CONFIG.entryMs;
  return drive(() => [
    press(NOW, "A", "D"),
    { type: "TICK", now: at },
    ...Array.from({ length: DEFAULT_CONFIG.pinLength }, () => press(at, "C", "D")),
    { type: "PIN_RESULT", result: { status: "OK" }, now: at },
  ]);
}

function reviewing(): { state: WatchState; to: string } {
  const at = NOW + DEFAULT_CONFIG.entryMs;
  const review = makeReview(at);
  const state = transition({ ...unlocked(), screen: { kind: "menu", index: 0, notice: null } }, { type: "REVIEW", review, now: at }).state;
  return { state, to: review.transfer.to };
}

function expectDrawable(face: ReturnType<typeof renderFace>) {
  expect(face.top).toHaveLength(8);
  for (const line of face.strip) {
    expect(line.length).toBeLessThanOrEqual(16);
    for (const ch of line) expect(GLCD[ch], `glyph for ${JSON.stringify(ch)}`).toBeDefined();
  }
}

describe("face content (DESIGN.md §5)", () => {
  it("Normal shows day, date and time; the strip and annunciators stay unlit", () => {
    const face = steady(drive(() => []));
    expect(face).toMatchObject({ top: "WED!!!!7", main: "10:09", sec: "36", strip: ["", ""] });
    expect(Object.values(face.annunciators)).toEqual([false, false, false, false]);
  });

  it("Secure menu and PIN use the published words", () => {
    expect(steady(unlocked())).toMatchObject({ top: "SECURE!!", strip: ["> ADDRESS", "  SIGN REQUEST"] });
    const pin = drive(() => [press(NOW, "A", "D"), { type: "TICK", now: NOW + 1000 }, press(NOW + 1000, "C", "D"), press(NOW + 1000, "C", "D"), press(NOW + 1000, "B"), press(NOW + 1000, "B"), press(NOW + 1000, "B"), press(NOW + 1000, "B")]);
    expect(steady(pin)).toMatchObject({ top: "PIN!!!!!", main: "-- 4_", strip: ["ENTER PIN", "TRIES LEFT 3"] });
    expect(steady(pin).annunciators).toEqual({ A: true, B: true, C: true, D: true });
  });

  it("Review shows the destination in full across TO 1/2 and TO 2/2, then APPROVE? with only A, C and D live", () => {
    let { state, to } = reviewing();
    const faces = [steady(state)];
    for (let i = 1; i < REVIEW_PAGES.length; i++) {
      state = transition(state, press(state.now, "B")).state;
      faces.push(steady(state));
    }
    faces.forEach(expectDrawable);
    expect(faces.map((f) => f.top)).toEqual(["AMOUNT!!", "TO!!!1/2", "TO!!!2/2", "NETWORK!", "FEE!!!!!", "APPROVE?"]);
    expect(faces[0]).toMatchObject({ main: "!0:52", sec: "!!", strip: ["0.01 SOL", ""] });
    const shown = [...faces[1]!.strip, ...faces[2]!.strip].join(" ").split(" ").filter(Boolean);
    expect(shown.every((g) => g.length <= 4)).toBe(true);
    expect(shown.join("")).toBe(to);
    expect(faces[4]!.strip).toEqual(["0.000005 SOL", "1 SIGNATURE"]);
    expect(faces[5]!.strip).toEqual(["          REJECT", "         APPROVE"]);
    expect(faces[5]!.annunciators).toEqual({ A: true, B: false, C: true, D: true });
    expect(faces[0]!.annunciators).toEqual({ A: false, B: true, C: true, D: false });
  });

  it("results and Locked say what happened", () => {
    const { state } = reviewing();
    const rejected = transition(state, press(state.now, "C")).state;
    expect(steady(rejected)).toMatchObject({ top: "REJECTED", strip: ["NOT SIGNED", "              OK"] });
    const expired = transition(state, { type: "TICK", now: state.request!.deadline }).state;
    expect(steady(expired)).toMatchObject({ top: "EXPIRED!", main: "!0:00", strip: ["NOT SIGNED", "ASK APP AGAIN"] });
    const locked = { ...state, request: null, screen: { kind: "wiped" } as const };
    expect(steady(locked)).toMatchObject({ top: "LOCKED!!", main: "--:--", strip: ["KEY ERASED", "SET UP AGAIN"] });
    expect(Object.values(steady(locked).annunciators)).toEqual([false, false, false, false]);
  });

  it("the current PIN digit blinks at 1 Hz unless reduced motion is on", () => {
    const pin = drive(() => [press(NOW, "A", "D"), { type: "TICK", now: NOW + 1000 }]);
    expect(renderFace({ ...pin, now: NOW + 1000 }).main).toBe("0_ __");
    expect(renderFace({ ...pin, now: NOW + 1600 }).main).toBe("!_ __");
    expect(renderFace({ ...pin, now: NOW + 1600 }, { reducedMotion: true }).main).toBe("0_ __");
  });
});
