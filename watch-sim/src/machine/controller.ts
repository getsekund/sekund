import {
  encodeFrame,
  type GetAddressResult,
  PROTOCOL_VERSION,
  RequestGuard,
  type SecureElement,
  toBase58,
  type Transport,
  WALLET_SLOT,
  type WatchStatus,
} from "@sekund/protocol";
import type { Gesture } from "./gestures";
import { type Effect, initialState, type MachineConfig, transition, type WatchEvent, type WatchState } from "./machine";

export interface ControllerOptions {
  transport: Transport;
  config?: Partial<MachineConfig>;
  clock?: () => number;
}

/**
 * Binds the pure state machine to the secure element and the companion link. Incoming
 * frames go through the shared RequestGuard (PROTOCOL.md §5 steps 1–7) before the state
 * machine sees them.
 */
export class WatchController {
  private stateValue: WatchState;
  private se: SecureElement | null = null;
  private booting: Promise<void> | null = null;
  private lastStatus = "";
  private readonly listeners = new Set<() => void>();
  private readonly inflight = new Set<Promise<unknown>>();
  private readonly transport: Transport;
  private readonly clock: () => number;
  private readonly guard: RequestGuard;

  constructor(opts: ControllerOptions) {
    this.transport = opts.transport;
    this.clock = opts.clock ?? Date.now;
    this.guard = new RequestGuard({ now: this.clock });
    this.stateValue = initialState(opts.config, this.clock());
    this.transport.onFrame((text) => this.onFrame(text));
    this.transport.onPeer((connected) => {
      if (connected) this.sendStatus(true);
    });
  }

  get state(): WatchState {
    return this.stateValue;
  }

  get secureElement(): SecureElement | null {
    return this.se;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): WatchState => this.stateValue;

  boot(se: SecureElement): Promise<void> {
    this.booting ??= (async () => {
      this.se = se;
      const s = await se.getState();
      const address = s.hasKey ? toBase58(await se.getPublicKey(WALLET_SLOT)) : null;
      this.dispatch({ type: "SE_READY", hasPin: s.hasPin, address, attemptsLeft: s.attemptsRemaining });
    })();
    return this.booting;
  }

  press(buttons: Gesture): void {
    this.dispatch({ type: "GESTURE", buttons, now: this.clock() });
  }

  tick(): void {
    this.dispatch({ type: "TICK", now: this.clock() });
  }

  setWrist(on: boolean): void {
    this.dispatch({ type: "WRIST", on, now: this.clock() });
  }

  dispatch(event: WatchEvent): void {
    const { state, effects } = transition(this.stateValue, event);
    const changed = state !== this.stateValue;
    this.stateValue = state;
    if (changed) for (const fn of this.listeners) fn();
    for (const effect of effects) this.run(effect);
    this.sendStatus(false);
  }

  /** Resolves once every effect started so far (and any it triggered) has finished. */
  async settle(): Promise<void> {
    while (this.inflight.size > 0) await Promise.allSettled([...this.inflight]);
  }

  private onFrame(text: string): void {
    const s = this.stateValue;
    const outcome = this.guard.check(text, {
      sessionOpen: s.session,
      hasKey: s.address !== null,
      busy: s.request !== null || s.signing !== null,
      address: s.address,
      maxMessageBytes: this.se?.maxMessageBytes ?? 0,
    });
    switch (outcome.kind) {
      case "drop":
        return;
      case "respond":
        this.transport.send(encodeFrame(outcome.response));
        return;
      case "address": {
        const status = !s.address ? "NO_WALLET" : s.session ? "OK" : "LOCKED";
        const result: GetAddressResult = {
          version: PROTOCOL_VERSION,
          type: "GET_ADDRESS_RESULT",
          requestId: outcome.request.requestId,
          status,
        };
        if (status === "OK" && this.se && s.address) {
          Object.assign(result, { address: s.address, profile: this.se.profile, maxMessageBytes: this.se.maxMessageBytes });
        }
        this.transport.send(encodeFrame(result));
        return;
      }
      case "review":
        this.dispatch({ type: "REVIEW", review: outcome.review, now: this.clock() });
        return;
    }
  }

  private sendStatus(force: boolean): void {
    const s = this.stateValue;
    const status: WatchStatus = {
      version: PROTOCOL_VERSION,
      type: "WATCH_STATUS",
      wallet: s.address !== null,
      session: s.session ? "OPEN" : "CLOSED",
      reviewing: s.request !== null,
    };
    const key = `${status.wallet}|${status.session}|${status.reviewing}`;
    if (!force && key === this.lastStatus) return;
    this.lastStatus = key;
    this.transport.send(encodeFrame(status));
  }

  private track(p: Promise<unknown>): void {
    this.inflight.add(p);
    void p.finally(() => this.inflight.delete(p));
  }

  private run(effect: Effect): void {
    const se = this.se;
    switch (effect.type) {
      case "respond":
        this.transport.send(encodeFrame(effect.response));
        return;
      case "verifyPin":
        if (!se) return;
        this.track(
          se.verifyPin(effect.pin).then(
            (result) => this.dispatch({ type: "PIN_RESULT", result, now: this.clock() }),
            () => this.dispatch({ type: "PIN_RESULT", result: { status: "WRONG_PIN", attemptsRemaining: this.stateValue.attemptsLeft }, now: this.clock() }),
          ),
        );
        return;
      case "createWallet":
        if (!se) return;
        this.track(
          (async () => {
            await se.setPin(effect.pin);
            await se.generateKey(WALLET_SLOT);
            return toBase58(await se.getPublicKey(WALLET_SLOT));
          })().then(
            (address) => this.dispatch({ type: "WALLET_CREATED", address }),
            () => this.dispatch({ type: "WALLET_FAILED" }),
          ),
        );
        return;
      case "approve":
        if (!se) return;
        this.track(
          (async () => {
            const token = await se.issueApproveToken(WALLET_SLOT, effect.message);
            return se.eddsaSign(WALLET_SLOT, effect.message, token);
          })().then(
            (signature) => this.dispatch({ type: "SIGNED", requestId: effect.requestId, signature }),
            () => this.dispatch({ type: "SIGN_FAILED", requestId: effect.requestId }),
          ),
        );
        return;
      case "endSession":
        if (se) this.track(se.endSession());
        return;
    }
  }
}
