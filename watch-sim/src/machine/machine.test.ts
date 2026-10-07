import { describe, expect, it } from "vitest";
import { makeReview, OWN_ADDRESS } from "@/testing/fixtures";
import { type Button, gesture } from "./gestures";
import { type Effect, initialState, REVIEW_PAGES, secondsLeft, transition, type WatchEvent, type WatchState } from "./machine";

/** Small driver: feeds events and collects effects. */
class Harness {
  state: WatchState;
  effects: Effect[] = [];
  now = 1_000_000;

  constructor(opts: { hasPin?: boolean } = {}) {
    this.state = initialState({}, this.now);
    const hasPin = opts.hasPin ?? true;
    this.send({ type: "SE_READY", hasPin, address: hasPin ? OWN_ADDRESS : null, attemptsLeft: 3 });
  }

  send(event: WatchEvent): Effect[] {
    const t = transition(this.state, event);
    this.state = t.state;
    this.effects.push(...t.effects);
    return t.effects;
  }

  press(...buttons: Button[]): Effect[] {
    return this.send({ type: "GESTURE", buttons: gesture(...buttons), now: this.now });
  }

  advance(ms: number): Effect[] {
    this.now += ms;
    return this.send({ type: "TICK", now: this.now });
  }

  enterPin(pin: string): Effect[] {
    const out: Effect[] = [];
    for (const ch of pin) {
      for (let i = 0; i < Number(ch); i++) out.push(...this.press("B"));
      out.push(...this.press("C", "D"));
    }
    return out;
  }

  unlock(): void {
    this.press("A", "D");
    this.enterPin("1234");
    this.send({ type: "PIN_RESULT", result: { status: "OK" }, now: this.now });
  }

  review(opts: Parameters<typeof makeReview>[1] = {}) {
    const review = makeReview(this.now, opts);
    this.send({ type: "REVIEW", review, now: this.now });
    return review;
  }

  responses() {
    return this.effects.flatMap((e) => (e.type === "respond" ? [e.response] : []));
  }

  toApprovePage(): void {
    for (let i = 0; i < REVIEW_PAGES.length; i++) this.press("B");
  }
}

describe("hidden combination", () => {
  it("enters Secure Mode (PIN) only with the configured combination", () => {
    const h = new Harness();
    h.press("A");
    h.press("B");
    h.press("C", "D");
    h.press("A", "B");
    expect(h.state.screen.kind).toBe("normal");
    h.press("A", "D");
    expect(h.state.screen).toMatchObject({ kind: "pin", mode: "unlock", digits: [], current: 0 });
  });

  it("single buttons keep normal watch behaviour", () => {
    const h = new Harness();
    h.press("A");
    expect(h.state.lightUntil).toBeGreaterThan(h.now);
    h.press("B");
    expect(h.state.hour12).toBe(true);
  });

  it("is ignored off the wrist and before the secure element is ready", () => {
    const h = new Harness();
    h.send({ type: "WRIST", on: false, now: h.now });
    h.press("A", "D");
    expect(h.state.screen.kind).toBe("normal");

    const cold = initialState();
    expect(transition(cold, { type: "GESTURE", buttons: gesture("A", "D"), now: 0 }).state.screen.kind).toBe("normal");
  });
});

describe("PIN entry", () => {
  it("A/B change the digit with wrap-around, C+D confirms, C steps back", () => {
    const h = new Harness();
    h.press("A", "D");
    h.press("A");
    expect(h.state.screen).toMatchObject({ current: 9 });
    h.press("B");
    h.press("B");
    expect(h.state.screen).toMatchObject({ current: 1 });
    h.press("C", "D");
    expect(h.state.screen).toMatchObject({ digits: [1], current: 0 });
    h.press("C");
    expect(h.state.screen).toMatchObject({ digits: [], current: 1 });
    h.press("C");
    expect(h.state.screen.kind).toBe("normal");
  });

  it("submits the PIN to the SE after the last digit and opens the menu on success", () => {
    const h = new Harness();
    h.press("A", "D");
    const effects = h.enterPin("1234");
    expect(effects).toContainEqual({ type: "verifyPin", pin: "1234" });
    expect(h.state.screen.kind).toBe("verifying");
    h.press("A");
    expect(h.state.screen.kind).toBe("verifying");
    h.send({ type: "PIN_RESULT", result: { status: "OK" }, now: h.now });
    expect(h.state.session).toBe(true);
    expect(h.state.screen).toMatchObject({ kind: "menu", index: 0 });
  });

  it("shows the attempts left and wipes on the third wrong PIN", () => {
    const h = new Harness();
    h.press("A", "D");
    h.enterPin("0000");
    h.send({ type: "PIN_RESULT", result: { status: "WRONG_PIN", attemptsRemaining: 2 }, now: h.now });
    expect(h.state.screen).toMatchObject({ kind: "pin", mode: "unlock", notice: "wrong", digits: [] });
    expect(h.state.attemptsLeft).toBe(2);
    h.enterPin("0000");
    h.send({ type: "PIN_RESULT", result: { status: "WRONG_PIN", attemptsRemaining: 1 }, now: h.now });
    h.enterPin("0000");
    h.send({ type: "PIN_RESULT", result: { status: "WIPED" }, now: h.now });
    expect(h.state.screen.kind).toBe("wiped");
    expect(h.state.address).toBeNull();
    expect(h.state.hasPin).toBe(false);
    expect(h.state.session).toBe(false);
  });

  it("after a wipe, Secure Mode offers a fresh wallet setup", () => {
    const h = new Harness();
    h.press("A", "D");
    h.enterPin("0000");
    h.send({ type: "PIN_RESULT", result: { status: "WIPED" }, now: h.now });
    h.press("C");
    expect(h.state.screen.kind).toBe("normal");
    h.press("A", "D");
    expect(h.state.screen).toMatchObject({ kind: "pin", mode: "create" });
  });

  it("first run: choose a PIN, confirm it, then the SE sets it and generates the key", () => {
    const h = new Harness({ hasPin: false });
    h.press("A", "D");
    expect(h.state.screen).toMatchObject({ kind: "pin", mode: "create" });
    h.enterPin("2580");
    expect(h.state.screen).toMatchObject({ kind: "pin", mode: "confirm", first: [2, 5, 8, 0] });
    h.enterPin("2581");
    expect(h.state.screen).toMatchObject({ kind: "pin", mode: "create", notice: "mismatch" });
    h.enterPin("2580");
    const effects = h.enterPin("2580");
    expect(effects).toContainEqual({ type: "createWallet", pin: "2580" });
    expect(h.state.screen.kind).toBe("creating");
    h.send({ type: "WALLET_CREATED", address: OWN_ADDRESS });
    expect(h.state.session).toBe(true);
    expect(h.state.screen.kind).toBe("menu");
  });
});

describe("review, approve and reject", () => {
  it("shows the review screen when a request arrives in a live session", () => {
    const h = new Harness();
    h.unlock();
    h.review();
    expect(h.state.screen).toEqual({ kind: "review", page: 0 });
    expect(h.state.request?.transfer.sol).toBe("0.01");
    expect(secondsLeft(h.state)).toBe(52);
  });

  it("answers LOCKED without a session and BUSY while another request is on screen", () => {
    const h = new Harness();
    h.review();
    expect(h.responses().at(-1)?.status).toBe("LOCKED");
    expect(h.state.request).toBeNull();
    h.unlock();
    const first = h.review();
    h.review();
    expect(h.responses().at(-1)?.status).toBe("BUSY");
    expect(h.state.request).toBe(first);
  });

  it("approve is only possible from the last page and hands the exact bytes to the SE", () => {
    const h = new Harness();
    h.unlock();
    const review = h.review();
    h.press("D");
    expect(h.state.screen.kind).toBe("review");
    h.toApprovePage();
    const effects = h.press("D");
    const approve = effects.find((e) => e.type === "approve");
    expect(approve).toEqual({ type: "approve", requestId: review.request.requestId, message: review.messageBytes });
    expect(h.state.screen.kind).toBe("signing");
    expect(h.state.request).toBeNull();

    h.send({ type: "SIGNED", requestId: review.request.requestId, signature: new Uint8Array(64).fill(1) });
    const res = h.responses().at(-1)!;
    expect(res.status).toBe("APPROVED");
    expect(res.signature).toBeTypeOf("string");
    expect(h.state.screen).toMatchObject({ kind: "result", status: "APPROVED" });
  });

  it("reject answers REJECTED with no signature and never reaches the SE", () => {
    const h = new Harness();
    h.unlock();
    h.review();
    h.press("B");
    h.press("C");
    const res = h.responses().at(-1)!;
    expect(res.status).toBe("REJECTED");
    expect(res.signature).toBeUndefined();
    expect(h.effects.some((e) => e.type === "approve")).toBe(false);
    expect(h.state.screen).toMatchObject({ kind: "result", status: "REJECTED" });
    h.press("D");
    expect(h.state.screen.kind).toBe("menu");
  });

  it("ignores a signature for any other request", () => {
    const h = new Harness();
    h.unlock();
    h.review();
    h.send({ type: "SIGNED", requestId: crypto.randomUUID(), signature: new Uint8Array(64) });
    expect(h.responses()).toHaveLength(0);
  });
});

describe("expiry", () => {
  it("auto-rejects at zero with EXPIRED and no signature", () => {
    const h = new Harness();
    h.unlock();
    h.review({ expiresInMs: 10_000 });
    h.advance(9_000);
    expect(secondsLeft(h.state)).toBe(1);
    expect(h.state.screen.kind).toBe("review");
    h.advance(1_000);
    const res = h.responses().at(-1)!;
    expect(res.status).toBe("EXPIRED");
    expect(res.signature).toBeUndefined();
    expect(h.state.request).toBeNull();
    expect(h.state.screen).toMatchObject({ kind: "result", status: "EXPIRED" });
  });

  it("approve at the deadline does not sign, even without a tick in between", () => {
    const h = new Harness();
    h.unlock();
    h.review({ expiresInMs: 5_000 });
    h.toApprovePage();
    h.now += 5_000;
    const effects = h.press("D");
    expect(effects.some((e) => e.type === "approve")).toBe(false);
    expect(h.responses().at(-1)?.status).toBe("EXPIRED");
  });
});

describe("wrist toggle", () => {
  it("off-wrist ends the session immediately and answers the request on screen LOCKED", () => {
    const h = new Harness();
    h.unlock();
    h.review();
    const effects = h.send({ type: "WRIST", on: false, now: h.now });
    expect(effects).toContainEqual({ type: "endSession" });
    expect(h.responses().at(-1)?.status).toBe("LOCKED");
    expect(h.state.session).toBe(false);
    expect(h.state.request).toBeNull();
    expect(h.state.screen.kind).toBe("normal");
  });

  it("off-wrist while signing drops the signature if it still arrives", () => {
    const h = new Harness();
    h.unlock();
    const review = h.review();
    h.toApprovePage();
    h.press("D");
    h.send({ type: "WRIST", on: false, now: h.now });
    h.send({ type: "SIGNED", requestId: review.request.requestId, signature: new Uint8Array(64) });
    expect(h.responses().map((r) => r.status)).toEqual(["LOCKED"]);
  });

  it("a PIN result that lands after wrist-off does not open the session", () => {
    const h = new Harness();
    h.press("A", "D");
    h.enterPin("1234");
    h.send({ type: "WRIST", on: false, now: h.now });
    const effects = h.send({ type: "PIN_RESULT", result: { status: "OK" }, now: h.now });
    expect(h.state.session).toBe(false);
    expect(effects).toContainEqual({ type: "endSession" });
  });

  it("off-wrist during PIN entry discards the digits; the PIN is required again", () => {
    const h = new Harness();
    h.unlock();
    h.send({ type: "WRIST", on: false, now: h.now });
    h.send({ type: "WRIST", on: true, now: h.now });
    expect(h.state.screen.kind).toBe("normal");
    h.press("A", "D");
    expect(h.state.screen).toMatchObject({ kind: "pin", mode: "unlock", digits: [] });
  });
});
