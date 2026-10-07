import {
  MAX_PIN_ATTEMPTS,
  PIN_LENGTH,
  type PinResult,
  type Review,
  type SeProfile,
  signResult,
  type SignStatus,
  type SignTransactionResult,
  toBase58,
} from "@sekund/protocol";
import { type Gesture, gesture, sameGesture } from "./gestures";

/*
 * Watch state machine (spec v1.1 §6, §7, §9, §11.1; PROTOCOL.md §5 steps 8–9; screens
 * from DESIGN.md §5). Pure: every transition returns the next state plus effects for the
 * controller to run. Approval and display rules live here and are security-critical.
 * Steps 1–7 (decode, replay, size, allowlist) run in the shared RequestGuard before a
 * Review reaches us.
 */

export interface MachineConfig {
  pinLength: number;
  /** The hidden Secure Mode combination, pressed together in Normal mode. */
  hiddenCombo: Gesture;
  /** How long SECURE shows before the PIN prompt. */
  entryMs: number;
  /** SIGNED and REJECTED return to Secure on D or after this long. */
  resultMs: number;
}

export const DEFAULT_CONFIG: MachineConfig = {
  pinLength: PIN_LENGTH,
  hiddenCombo: gesture("A", "D"),
  entryMs: 1_000,
  resultMs: 3_000,
};

export const CONFIRM = gesture("C", "D");
export const MENU_ITEMS = ["ADDRESS", "SIGN REQUEST", "SETTINGS"] as const;
export const REVIEW_PAGES = ["AMOUNT", "TO1", "TO2", "NETWORK", "FEE", "APPROVE"] as const;
export const ADDRESS_PAGES = 2;

/** unlock: verify the PIN. create: first-run PIN setup on a factory-state SE. */
export type PinMode = "unlock" | "create";

export type ResultStatus = "APPROVED" | "REJECTED" | "EXPIRED" | "FAILED" | "SETUP_FAILED";

export type Screen =
  | { kind: "normal" }
  | { kind: "entry"; mode: PinMode; until: number }
  | { kind: "pin"; mode: PinMode; digits: number[]; current: number; notice: "wrong" | null }
  | { kind: "verifying" }
  | { kind: "creating" }
  | { kind: "menu"; index: number; notice: "no-request" | null }
  | { kind: "address"; page: number }
  | { kind: "settings" }
  | { kind: "review"; page: number }
  | { kind: "signing" }
  | { kind: "result"; status: ResultStatus; signature?: string; until: number | null }
  | { kind: "wiped" };

export interface WatchState {
  config: MachineConfig;
  now: number;
  screen: Screen;
  /** The SE state has been read; Secure Mode is unavailable until then. */
  ready: boolean;
  profile: SeProfile | null;
  maxMessageBytes: number;
  onWrist: boolean;
  session: boolean;
  hasPin: boolean;
  attemptsLeft: number;
  /** Wallet address (base58), or null when the SE holds no key. */
  address: string | null;
  /** The request on the review screen: the exact bytes parsed, displayed and, on APPROVE, signed. */
  request: Review | null;
  signing: { requestId: string } | null;
}

export type WatchEvent =
  | { type: "GESTURE"; buttons: Gesture; now: number }
  | { type: "TICK"; now: number }
  | { type: "WRIST"; on: boolean; now: number }
  | { type: "SE_READY"; hasPin: boolean; address: string | null; attemptsLeft: number; profile: SeProfile; maxMessageBytes: number }
  | { type: "REVIEW"; review: Review; now: number }
  | { type: "PIN_RESULT"; result: PinResult; now: number }
  | { type: "WALLET_CREATED"; address: string; now: number }
  | { type: "WALLET_FAILED"; now: number }
  | { type: "SIGNED"; requestId: string; signature: Uint8Array; now: number }
  | { type: "SIGN_FAILED"; requestId: string; now: number }
  /** Simulator reset: the only way out of Locked (the SE is already back in factory state). */
  | { type: "RESET"; now: number };

export type Effect =
  | { type: "verifyPin"; pin: string }
  | { type: "createWallet"; pin: string }
  /** Physical APPROVE: issue an approve token for these bytes, then sign the same bytes. */
  | { type: "approve"; requestId: string; message: Uint8Array }
  | { type: "respond"; response: SignTransactionResult }
  | { type: "endSession" };

export interface Transition {
  state: WatchState;
  effects: Effect[];
}

export function initialState(config: Partial<MachineConfig> = {}, now = 0): WatchState {
  return {
    config: { ...DEFAULT_CONFIG, ...config },
    now,
    screen: { kind: "normal" },
    ready: false,
    profile: null,
    maxMessageBytes: 0,
    onWrist: true,
    session: false,
    hasPin: false,
    attemptsLeft: MAX_PIN_ATTEMPTS,
    address: null,
    request: null,
    signing: null,
  };
}

const pinScreen = (mode: PinMode, notice: "wrong" | null = null): Screen => ({
  kind: "pin",
  mode,
  digits: [],
  current: 0,
  notice,
});

const MENU: Screen = { kind: "menu", index: 0, notice: null };

function respond(requestId: string, status: SignStatus, extra: { signature?: string; reason?: string } = {}): Effect {
  return { type: "respond", response: signResult(requestId, status, extra) };
}

/** Seconds left on the request under review, rounded up; 0 once expired. */
export function secondsLeft(state: WatchState): number {
  if (!state.request) return 0;
  return Math.max(0, Math.ceil((state.request.deadline - state.now) / 1000));
}

export function transition(state: WatchState, event: WatchEvent): Transition {
  switch (event.type) {
    case "TICK":
      return timers({ ...state, now: event.now });
    case "GESTURE": {
      const t = timers({ ...state, now: event.now });
      return merge(t, onGesture(t.state, event.buttons));
    }
    case "WRIST":
      return event.on ? { state: { ...state, now: event.now, onWrist: true }, effects: [] } : endSession({ ...state, now: event.now, onWrist: false }, "watch taken off the wrist");
    case "SE_READY":
      return {
        state: {
          ...state,
          ready: true,
          hasPin: event.hasPin,
          address: event.address,
          attemptsLeft: event.attemptsLeft,
          profile: event.profile,
          maxMessageBytes: event.maxMessageBytes,
        },
        effects: [],
      };
    case "REVIEW":
      return onReview({ ...state, now: event.now }, event.review);
    case "PIN_RESULT":
      return onPinResult({ ...state, now: event.now }, event.result);
    case "WALLET_CREATED":
      if (state.screen.kind !== "creating" || !state.onWrist) {
        return { state: { ...state, hasPin: true, address: event.address }, effects: [{ type: "endSession" }] };
      }
      return {
        state: { ...state, now: event.now, hasPin: true, address: event.address, session: true, attemptsLeft: MAX_PIN_ATTEMPTS, screen: MENU },
        effects: [],
      };
    case "WALLET_FAILED":
      return { state: { ...state, now: event.now, screen: result(state, "SETUP_FAILED", event.now) }, effects: [] };
    case "SIGNED": {
      if (state.signing?.requestId !== event.requestId) return { state, effects: [] };
      const signature = toBase58(event.signature);
      return {
        state: { ...state, now: event.now, signing: null, screen: result(state, "APPROVED", event.now, signature) },
        effects: [respond(event.requestId, "APPROVED", { signature })],
      };
    }
    case "SIGN_FAILED": {
      if (state.signing?.requestId !== event.requestId) return { state, effects: [] };
      return {
        state: { ...state, now: event.now, signing: null, screen: result(state, "FAILED", event.now) },
        effects: [respond(event.requestId, "REJECTED", { reason: "secure element refused to sign" })],
      };
    }
    case "RESET":
      if (state.screen.kind !== "wiped") return { state, effects: [] };
      return { state: { ...state, now: event.now, screen: { kind: "normal" } }, effects: [] };
  }
}

function result(state: WatchState, status: ResultStatus, now: number, signature?: string): Screen {
  const until = status === "EXPIRED" ? null : now + state.config.resultMs;
  return { kind: "result", status, until, ...(signature ? { signature } : {}) };
}

function merge(a: Transition, b: Transition): Transition {
  return { state: b.state, effects: [...a.effects, ...b.effects] };
}

/** Expiry first (it answers the companion), then the screen timers. */
function timers(state: WatchState): Transition {
  const t = expireIfDue(state);
  const s = t.state;
  const screen = s.screen;
  if (screen.kind === "entry" && s.now >= screen.until) {
    return { state: { ...s, screen: pinScreen(screen.mode) }, effects: t.effects };
  }
  if (screen.kind === "result" && screen.until !== null && s.now >= screen.until) {
    return { state: { ...s, screen: s.session ? MENU : { kind: "normal" } }, effects: t.effects };
  }
  return t;
}

function expireIfDue(state: WatchState): Transition {
  const req = state.request;
  if (!req || state.now < req.deadline) return { state, effects: [] };
  return {
    state: {
      ...state,
      request: null,
      screen: state.screen.kind === "review" ? result(state, "EXPIRED", state.now) : state.screen,
    },
    effects: [respond(req.request.requestId, "EXPIRED", { reason: "review countdown reached zero" })],
  };
}

/** Wrist-off or C from the menu. Anything under review or being signed is answered LOCKED. */
function endSession(state: WatchState, reason: string): Transition {
  const effects: Effect[] = [];
  if (state.request) effects.push(respond(state.request.request.requestId, "LOCKED", { reason }));
  if (state.signing) effects.push(respond(state.signing.requestId, "LOCKED", { reason }));
  if (state.session) effects.push({ type: "endSession" });
  const screen: Screen = state.screen.kind === "wiped" ? state.screen : { kind: "normal" };
  return { state: { ...state, session: false, request: null, signing: null, screen }, effects };
}

function onGesture(state: WatchState, buttons: Gesture): Transition {
  const s = state.screen;
  const is = (...b: Parameters<typeof gesture>) => sameGesture(buttons, gesture(...b));
  const go = (screen: Screen, patch: Partial<WatchState> = {}, effects: Effect[] = []): Transition => ({
    state: { ...state, ...patch, screen },
    effects,
  });
  const none: Transition = { state, effects: [] };

  switch (s.kind) {
    case "normal":
      if (!sameGesture(buttons, state.config.hiddenCombo) || !state.onWrist || !state.ready) return none;
      return go({ kind: "entry", mode: state.hasPin ? "unlock" : "create", until: state.now + state.config.entryMs });

    case "pin": {
      if (is("A")) return go({ ...s, current: (s.current + 9) % 10 });
      if (is("B")) return go({ ...s, current: (s.current + 1) % 10 });
      if (sameGesture(buttons, CONFIRM)) {
        const digits = [...s.digits, s.current];
        if (digits.length < state.config.pinLength) return go({ ...s, digits, current: 0, notice: null });
        const pin = digits.join("");
        if (s.mode === "unlock") return go({ kind: "verifying" }, {}, [{ type: "verifyPin", pin }]);
        return go({ kind: "creating" }, {}, [{ type: "createWallet", pin }]);
      }
      if (is("C")) {
        if (s.digits.length === 0) return go({ kind: "normal" });
        const last = s.digits[s.digits.length - 1] ?? 0;
        return go({ ...s, digits: s.digits.slice(0, -1), current: last, notice: null });
      }
      return none;
    }

    case "menu": {
      const n = MENU_ITEMS.length;
      if (is("A")) return go({ kind: "menu", index: (s.index + n - 1) % n, notice: null });
      if (is("B")) return go({ kind: "menu", index: (s.index + 1) % n, notice: null });
      if (is("C")) return endSession(state, "watch locked");
      if (is("D")) {
        const item = MENU_ITEMS[s.index];
        if (item === "ADDRESS") return go({ kind: "address", page: 0 });
        if (item === "SETTINGS") return go({ kind: "settings" });
        return state.request ? go({ kind: "review", page: 0 }) : go({ kind: "menu", index: s.index, notice: "no-request" });
      }
      return none;
    }

    case "address":
      if (is("A") && s.page > 0) return go({ kind: "address", page: s.page - 1 });
      if (is("B") && s.page < ADDRESS_PAGES - 1) return go({ kind: "address", page: s.page + 1 });
      if (is("C")) return go({ kind: "menu", index: 0, notice: null });
      return none;

    case "settings":
      if (is("C")) return go({ kind: "menu", index: 2, notice: null });
      return none;

    case "review": {
      const req = state.request;
      if (!req) return go({ kind: "menu", index: 1, notice: null });
      const last = REVIEW_PAGES.length - 1;
      if (is("A") && s.page > 0) return go({ kind: "review", page: s.page - 1 });
      // Pages advance one at a time, so the APPROVE page is reached only after every field was shown.
      if (is("B") && s.page < last) return go({ kind: "review", page: s.page + 1 });
      if (is("C")) {
        return go(result(state, "REJECTED", state.now), { request: null }, [
          respond(req.request.requestId, "REJECTED", { reason: "rejected on the watch" }),
        ]);
      }
      if (is("D") && s.page === last) {
        if (!state.session || state.now >= req.deadline) return none;
        return go({ kind: "signing" }, { request: null, signing: { requestId: req.request.requestId } }, [
          { type: "approve", requestId: req.request.requestId, message: req.messageBytes },
        ]);
      }
      return none;
    }

    case "result":
      if (!is("D")) return none;
      if (state.request) return go({ kind: "review", page: 0 });
      return go(state.session ? MENU : { kind: "normal" });

    case "entry":
      return onGesture({ ...state, screen: pinScreen(s.mode) }, buttons);

    case "verifying":
    case "creating":
    case "signing":
    case "wiped":
      return none;
  }
}

function onPinResult(state: WatchState, result: PinResult): Transition {
  const waiting = state.screen.kind === "verifying" && state.onWrist;
  switch (result.status) {
    case "OK":
      if (!waiting) return { state, effects: [{ type: "endSession" }] };
      return { state: { ...state, session: true, attemptsLeft: MAX_PIN_ATTEMPTS, screen: MENU }, effects: [] };
    case "WRONG_PIN":
      return {
        state: { ...state, attemptsLeft: result.attemptsRemaining, screen: waiting ? pinScreen("unlock", "wrong") : state.screen },
        effects: [],
      };
    case "WIPED":
      return {
        state: {
          ...state,
          hasPin: false,
          address: null,
          session: false,
          attemptsLeft: MAX_PIN_ATTEMPTS,
          screen: waiting ? { kind: "wiped" } : state.screen,
        },
        effects: [],
      };
    case "NO_PIN":
      return {
        state: { ...state, hasPin: false, address: null, screen: waiting ? pinScreen("create") : state.screen },
        effects: [],
      };
  }
}

function onReview(state: WatchState, review: Review): Transition {
  const id = review.request.requestId;
  if (!state.session || !state.address) {
    return { state, effects: [respond(id, "LOCKED", { reason: "unlock the watch first" })] };
  }
  if (state.request || state.signing) {
    return { state, effects: [respond(id, "BUSY", { reason: "another request is under review" })] };
  }
  return { state: { ...state, request: review, screen: { kind: "review", page: 0 } }, effects: [] };
}
