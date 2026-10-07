import { describe, expect, it } from "vitest";
import { makeReview, OWN_ADDRESS } from "@/testing/fixtures";
import { type Button, gesture } from "./gestures";
import { DEFAULT_CONFIG, type Effect, initialState, REVIEW_PAGES, secondsLeft, transition, type WatchEvent, type WatchState } from "./machine";

/** Small driver: feeds events and collects effects. */
class Harness {
  state: WatchState;
  effects: Effect[] = [];
  now = 1_000_000;

  constructor(opts: { hasPin?: boolean } = {}) {
    this.state = initialState({}, this.now);
    const hasPin = opts.hasPin ?? true;
    this.send({ type: "SE_READY", hasPin, address: hasPin ? OWN_ADDRESS : null, attemptsLeft: 3, profile: "TROPIC01", maxMessageBytes: 4096 });
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

  /** Hidden combination, then the one-second SECURE screen. */
  openSecure(): void {
    this.press("A", "D");
    this.advance(DEFAULT_CONFIG.entryMs);
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
    this.openSecure();
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
  it("only the configured combination leaves Normal; single buttons do nothing there", () => {
    const h = new Harness();
    const before = h.state;
    for (const g of [["A"], ["B"], ["C"], ["D"], ["C", "D"], ["A", "B"]] as Button[][]) h.press(...g);
    expect(h.state.screen).toEqual({ kind: "normal" });
    expect(h.effects).toEqual([]);
    expect({ ...h.state, now: 0 }).toEqual({ ...before, now: 0 });
    h.press("A", "D");
    expect(h.state.screen).toMatchObject({ kind: "entry", mode: "unlock" });
  });

  it("shows SECURE for one second, then asks for the PIN", () => {
    const h = new Harness();
    h.press("A", "D");
    h.advance(DEFAULT_CONFIG.entryMs - 1);
    expect(h.state.screen.kind).toBe("entry");
    h.advance(1);
    expect(h.state.screen).toMatchObject({ kind: "pin", mode: "unlock", digits: [], current: 0 });
  });

  it("a press during SECURE goes to the PIN screen and counts there", () => {
    const h = new Harness();
    h.press("A", "D");
    h.press("B");
    expect(h.state.screen).toMatchObject({ kind: "pin", mode: "unlock", digits: [], current: 1 });
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
  it("A decreases and B increases with wrap-around, C+D confirms, C steps back", () => {
    const h = new Harness();
    h.openSecure();
    h.press("A");
    expect(h.state.screen).toMatchObject({ current: 9 });
    h.press("B");
    h.press("B");
    expect(h.state.screen).toMatchObject({ current: 1 });
    h.press("C", "D");
    expect(h.state.screen).toMatchObject({ digits: [1], current: 0 });
    h.press("D");
    expect(h.state.screen).toMatchObject({ digits: [1], current: 0 });
    h.press("C");
    expect(h.state.screen).toMatchObject({ digits: [], current: 1 });
    h.press("C");
    expect(h.state.screen.kind).toBe("normal");
  });

  it("submits the PIN to the SE after the last digit and opens Secure on success", () => {
    const h = new Harness();
    h.openSecure();
    const effects = h.enterPin("1234");
    expect(effects).toContainEqual({ type: "verifyPin", pin: "1234" });
    expect(h.state.screen.kind).toBe("verifying");
    h.press("A");
    expect(h.state.screen.kind).toBe("verifying");
    h.send({ type: "PIN_RESULT", result: { status: "OK" }, now: h.now });
    expect(h.state.session).toBe(true);
    expect(h.state.screen).toMatchObject({ kind: "menu", index: 0 });
  });

  it("shows the tries left and goes to Locked on the third wrong PIN", () => {
    const h = new Harness();
    h.openSecure();
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

  it("Locked stays put through buttons and wrist changes; only a simulator reset leaves it", () => {
    const h = new Harness();
    h.openSecure();
    h.enterPin("0000");
    h.send({ type: "PIN_RESULT", result: { status: "WIPED" }, now: h.now });
    for (const g of [["A"], ["B"], ["C"], ["D"], ["C", "D"], ["A", "D"]] as Button[][]) h.press(...g);
    h.send({ type: "WRIST", on: false, now: h.now });
    h.send({ type: "WRIST", on: true, now: h.now });
    expect(h.state.screen.kind).toBe("wiped");
    h.send({ type: "RESET", now: h.now });
    expect(h.state.screen.kind).toBe("normal");
    h.openSecure();
    expect(h.state.screen).toMatchObject({ kind: "pin", mode: "create" });
  });

  it("first use: choose a PIN, then the SE sets it and generates the key", () => {
    const h = new Harness({ hasPin: false });
    h.openSecure();
    expect(h.state.screen).toMatchObject({ kind: "pin", mode: "create" });
    const effects = h.enterPin("2580");
    expect(effects).toContainEqual({ type: "createWallet", pin: "2580" });
    expect(h.state.screen.kind).toBe("creating");
    h.send({ type: "WALLET_CREATED", address: OWN_ADDRESS, now: h.now });
    expect(h.state.session).toBe(true);
    expect(h.state.screen.kind).toBe("menu");
  });
});

describe("Secure menu", () => {
  it("D opens Address, Sign request and Settings; C locks and returns to Normal", () => {
    const h = new Harness();
    h.unlock();
    h.press("D");
    expect(h.state.screen).toEqual({ kind: "address", page: 0 });
    h.press("B");
    expect(h.state.screen).toEqual({ kind: "address", page: 1 });
    h.press("C");
    h.press("B");
    h.press("D");
    expect(h.state.screen).toMatchObject({ kind: "menu", index: 1, notice: "no-request" });
    h.press("B");
    h.press("D");
    expect(h.state.screen).toEqual({ kind: "settings" });
    h.press("C");
    const effects = h.press("C");
    expect(effects).toContainEqual({ type: "endSession" });
    expect(h.state.screen.kind).toBe("normal");
    expect(h.state.session).toBe(false);
  });
});

describe("review, approve and reject", () => {
  it("opens Review when a request arrives in a live session", () => {
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

  it("pages forward one at a time; APPROVE is reachable only after every field, and D signs the exact bytes", () => {
    const h = new Harness();
    h.unlock();
    const review = h.review();
    for (let page = 0; page < REVIEW_PAGES.length - 1; page++) {
      expect(h.state.screen).toEqual({ kind: "review", page });
      expect(h.press("D").some((e) => e.type === "approve")).toBe(false);
      h.press("B");
    }
    expect(h.state.screen).toEqual({ kind: "review", page: REVIEW_PAGES.length - 1 });
    const effects = h.press("D");
    expect(effects).toContainEqual({ type: "approve", requestId: review.request.requestId, message: review.messageBytes });
    expect(h.state.screen.kind).toBe("signing");
    expect(h.state.request).toBeNull();

    h.send({ type: "SIGNED", requestId: review.request.requestId, signature: new Uint8Array(64).fill(1), now: h.now });
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
  });

  it("SIGNED and REJECTED return to Secure on D or after 3 s; other buttons do nothing", () => {
    const h = new Harness();
    h.unlock();
    h.review();
    h.press("C");
    h.press("A");
    h.press("C");
    expect(h.state.screen).toMatchObject({ kind: "result", status: "REJECTED" });
    h.press("D");
    expect(h.state.screen.kind).toBe("menu");

    h.review();
    h.press("C");
    h.advance(DEFAULT_CONFIG.resultMs - 1);
    expect(h.state.screen.kind).toBe("result");
    h.advance(1);
    expect(h.state.screen.kind).toBe("menu");
  });

  it("ignores a signature for any other request", () => {
    const h = new Harness();
    h.unlock();
    h.review();
    h.send({ type: "SIGNED", requestId: crypto.randomUUID(), signature: new Uint8Array(64), now: h.now });
    expect(h.responses()).toHaveLength(0);
  });
});

describe("expiry", () => {
  it("auto-rejects at zero with EXPIRED and no signature, and waits for D", () => {
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
    h.advance(60_000);
    expect(h.state.screen).toMatchObject({ kind: "result", status: "EXPIRED" });
    h.press("D");
    expect(h.state.screen.kind).toBe("menu");
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
    h.send({ type: "SIGNED", requestId: review.request.requestId, signature: new Uint8Array(64), now: h.now });
    expect(h.responses().map((r) => r.status)).toEqual(["LOCKED"]);
  });

  it("a PIN result that lands after wrist-off does not open the session", () => {
    const h = new Harness();
    h.openSecure();
    h.enterPin("1234");
    h.send({ type: "WRIST", on: false, now: h.now });
    const effects = h.send({ type: "PIN_RESULT", result: { status: "OK" }, now: h.now });
    expect(h.state.session).toBe(false);
    expect(effects).toContainEqual({ type: "endSession" });
  });

  it("off-wrist during entry or PIN discards everything; the PIN is required again", () => {
    const h = new Harness();
    h.press("A", "D");
    h.send({ type: "WRIST", on: false, now: h.now });
    expect(h.state.screen.kind).toBe("normal");
    h.send({ type: "WRIST", on: true, now: h.now });
    h.unlock();
    h.send({ type: "WRIST", on: false, now: h.now });
    h.send({ type: "WRIST", on: true, now: h.now });
    expect(h.state.screen.kind).toBe("normal");
    h.openSecure();
    expect(h.state.screen).toMatchObject({ kind: "pin", mode: "unlock", digits: [] });
  });
});
