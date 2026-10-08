import {
  encodeFrame,
  type GetAddressResult,
  PROTOCOL_VERSION,
  REPLAY_TTL_MS,
  RequestGuard,
  type ReplayJournal,
  type SecureElement,
  signResult,
  stampIdentity,
  toBase58,
  type Transport,
  WALLET_SLOT,
  type WatchStatus,
  createMemoryReplayJournal,
} from "@sekund/protocol";
import type { Gesture } from "./gestures";
import { answerLine, describe, type LogEntry, type LogLine } from "./log";
import { type Effect, initialState, type MachineConfig, transition, type WatchEvent, type WatchState } from "./machine";

const LOG_LIMIT = 60;

export interface ControllerOptions {
  transport: Transport;
  config?: Partial<MachineConfig>;
  clock?: () => number;
  /** Persisted requestId/nonce tombstones. Defaults to in-memory (tests). */
  replay?: ReplayJournal;
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
  private logValue: readonly LogEntry[] = [];
  private logSeq = 0;
  private readonly listeners = new Set<() => void>();
  private readonly inflight = new Set<Promise<unknown>>();
  private readonly transport: Transport;
  private readonly clock: () => number;
  private guard: RequestGuard;
  private readonly replay: ReplayJournal;
  private guardReady: Promise<void>;

  constructor(opts: ControllerOptions) {
    this.transport = opts.transport;
    this.clock = opts.clock ?? Date.now;
    this.replay = opts.replay ?? createMemoryReplayJournal();
    this.guard = new RequestGuard({
      now: this.clock,
      identity: this.transport.identity,
    });
    this.guardReady = this.seedGuard();
    this.stateValue = initialState(opts.config, this.clock());
    this.transport.onFrame((text) => void this.onFrame(text));
    this.transport.onPeer((connected) => {
      this.record([{ text: connected ? "App connected" : "App disconnected" }]);
      this.notify();
      if (connected) this.sendStatus(true);
    });
  }

  private async seedGuard(): Promise<void> {
    const seen = await this.replay.list();
    this.guard = new RequestGuard({
      now: this.clock,
      identity: this.transport.identity,
      seen,
      onSeen: (value) => {
        // Wall-clock TTL: journals prune with Date.now(), not the sim clock.
        this.track(this.replay.remember(value, Date.now() + REPLAY_TTL_MS));
      },
    });
  }

  /** Newest first. */
  get log(): readonly LogEntry[] {
    return this.logValue;
  }

  getLog = (): readonly LogEntry[] => this.logValue;

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
      await this.guardReady;
      this.se = se;
      const s = await se.getState();
      const address = s.hasKey ? toBase58(await se.getPublicKey(WALLET_SLOT)) : null;
      this.dispatch({
        type: "SE_READY",
        hasPin: s.hasPin,
        address,
        attemptsLeft: s.attemptsRemaining,
        profile: s.profile,
        maxMessageBytes: s.maxMessageBytes,
      });
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

  reset(): void {
    this.dispatch({ type: "RESET", now: this.clock() });
  }

  /** Test helper: wait for SE and in-flight effects. */
  async settle(): Promise<void> {
    await this.booting;
    await this.guardReady;
    while (this.inflight.size > 0) await Promise.all([...this.inflight]);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  private record(lines: LogLine[]): void {
    const at = this.clock();
    const entries = lines.map((line) => ({ id: ++this.logSeq, at, ...line }));
    this.logValue = [...entries, ...this.logValue].slice(0, LOG_LIMIT);
  }

  private dispatch(event: WatchEvent): void {
    const before = this.stateValue;
    const { state, effects } = transition(before, event);
    this.stateValue = state;
    const lines = describe(before, event, state, effects);
    if (lines.length) this.record(lines);
    for (const effect of effects) this.run(effect);
    this.sendStatus(false);
    this.notify();
  }

  private async onFrame(text: string): Promise<void> {
    await this.guardReady;
    const s = this.stateValue;
    const outcome = this.guard.check(text, {
      sessionOpen: s.session,
      hasKey: s.address !== null,
      busy: s.request !== null || s.signing !== null,
      address: s.address,
      maxMessageBytes: this.se?.maxMessageBytes ?? 0,
      roomId: this.transport.identity.roomId,
    });
    switch (outcome.kind) {
      case "drop":
        return;
      case "cancel":
        if (s.request?.request.requestId === outcome.requestId) {
          this.dispatch({ type: "CANCEL", requestId: outcome.requestId, now: this.clock() });
        }
        return;
      case "respond":
        this.transport.send(encodeFrame(outcome.response));
        this.record([answerLine(outcome.response.requestId, outcome.response.status)]);
        this.notify();
        return;
      case "address": {
        const status = !s.address ? "NO_WALLET" : s.session ? "OK" : "LOCKED";
        const result = stampIdentity(
          {
            version: PROTOCOL_VERSION,
            type: "GET_ADDRESS_RESULT" as const,
            requestId: outcome.request.requestId,
            status,
          },
          this.transport.identity,
        ) as GetAddressResult;
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
    const status = stampIdentity(
      {
        version: PROTOCOL_VERSION,
        type: "WATCH_STATUS" as const,
        wallet: s.address !== null,
        session: s.session ? ("OPEN" as const) : ("CLOSED" as const),
        reviewing: s.request !== null,
      },
      this.transport.identity,
    ) as WatchStatus;
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
      case "respond": {
        const response = signResult(this.transport.identity, effect.requestId, effect.status, {
          ...(effect.signature ? { signature: effect.signature } : {}),
          ...(effect.reason ? { reason: effect.reason } : {}),
        });
        this.transport.send(encodeFrame(response));
        return;
      }
      case "verifyPin":
        if (!se) return;
        this.track(
          se.verifyPin(effect.pin).then(
            (result) => this.dispatch({ type: "PIN_RESULT", result, now: this.clock() }),
            () =>
              this.dispatch({
                type: "PIN_RESULT",
                result: { status: "WRONG_PIN", attemptsRemaining: this.stateValue.attemptsLeft },
                now: this.clock(),
              }),
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
            (address) => this.dispatch({ type: "WALLET_CREATED", address, now: this.clock() }),
            () => this.dispatch({ type: "WALLET_FAILED", now: this.clock() }),
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
            (signature) => this.dispatch({ type: "SIGNED", requestId: effect.requestId, signature, now: this.clock() }),
            () => this.dispatch({ type: "SIGN_FAILED", requestId: effect.requestId, now: this.clock() }),
          ),
        );
        return;
      case "endSession":
        if (se) this.track(se.endSession());
        return;
    }
  }
}
