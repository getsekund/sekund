import {
  PROTOCOL_VERSION,
  RequestGuard,
  WALLET_SLOT,
  encodeFrame,
  signResult,
  stampIdentity,
  toBase58,
  type GetAddressResult,
  type Review,
  type SecureElement,
  type SignTransactionResult,
  type Transport,
} from "@sekund/protocol";

export type Decision = "approve" | "reject" | "wait";

export interface HeadlessWatchOptions {
  transport: Transport;
  se: SecureElement;
  /** Stands in for the user looking at the review screen and pressing a button. */
  decide: (review: Review) => Decision | Promise<Decision>;
  now?: () => number;
}

/**
 * A headless stand-in for the watch, used by tests and the devnet proof script. It follows
 * PROTOCOL.md section 5 with the shared RequestGuard and the SE interface. The real watch
 * state machine and UI live in watch-sim/.
 */
export class HeadlessWatch {
  /** Every review that reached the "screen". */
  readonly displayed: Review[] = [];
  readonly sent: SignTransactionResult[] = [];
  private readonly guard: RequestGuard;
  private current: { review: Review; timer: ReturnType<typeof setTimeout> } | null = null;
  private address: string | null = null;
  private readonly unsubscribe: () => void;

  constructor(private readonly options: HeadlessWatchOptions) {
    this.guard = new RequestGuard({
      identity: options.transport.identity,
      ...(options.now ? { now: options.now } : {}),
    });
    this.unsubscribe = options.transport.onFrame((text) => void this.onFrame(text));
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private send(result: SignTransactionResult | GetAddressResult): void {
    if (result.type === "SIGN_TRANSACTION_RESULT") this.sent.push(result);
    this.options.transport.send(encodeFrame(result));
  }

  private async onFrame(text: string): Promise<void> {
    const state = await this.options.se.getState();
    if (state.hasKey && !this.address) this.address = toBase58(await this.options.se.getPublicKey(WALLET_SLOT));
    if (!state.hasKey) this.address = null;

    const outcome = this.guard.check(text, {
      sessionOpen: state.sessionOpen,
      hasKey: state.hasKey,
      busy: this.current !== null,
      address: this.address,
      maxMessageBytes: this.options.se.maxMessageBytes,
      roomId: this.options.transport.identity.roomId,
    });

    if (outcome.kind === "drop") return;
    if (outcome.kind === "cancel") {
      if (this.current?.review.request.requestId === outcome.requestId) {
        clearTimeout(this.current.timer);
        this.current = null;
      }
      return;
    }
    if (outcome.kind === "respond") return this.send(outcome.response);
    if (outcome.kind === "address") {
      const status = !state.hasKey ? "NO_WALLET" : state.sessionOpen ? "OK" : "LOCKED";
      const result = stampIdentity(
        {
          version: PROTOCOL_VERSION,
          type: "GET_ADDRESS_RESULT" as const,
          requestId: outcome.request.requestId,
          status,
        },
        this.options.transport.identity,
      ) as GetAddressResult;
      if (status === "OK") Object.assign(result, { address: this.address, profile: this.options.se.profile, maxMessageBytes: this.options.se.maxMessageBytes });
      return this.send(result);
    }

    const review = outcome.review;
    this.displayed.push(review);
    const timer = setTimeout(() => this.finish(review, "EXPIRED"), Math.max(0, review.deadline - this.now()));
    this.current = { review, timer };

    const decision = await this.options.decide(review);
    if (decision === "approve") await this.approve();
    else if (decision === "reject") this.reject();
  }

  private finish(review: Review, status: "EXPIRED" | "REJECTED" | "LOCKED", reason?: string): void {
    if (this.current?.review !== review) return;
    clearTimeout(this.current.timer);
    this.current = null;
    this.send(signResult(this.options.transport.identity, review.request.requestId, status, reason ? { reason } : {}));
  }

  /** Physical APPROVE. Disabled once the countdown has run out. */
  async approve(): Promise<void> {
    const current = this.current;
    if (!current || this.now() >= current.review.deadline) return;
    const { review } = current;
    const token = await this.options.se.issueApproveToken(WALLET_SLOT, review.messageBytes);
    const signature = await this.options.se.eddsaSign(WALLET_SLOT, review.messageBytes, token);
    if (this.current?.review !== review) return;
    clearTimeout(current.timer);
    this.current = null;
    this.send(signResult(this.options.transport.identity, review.request.requestId, "APPROVED", { signature: toBase58(signature) }));
  }

  reject(): void {
    if (this.current) this.finish(this.current.review, "REJECTED");
  }

  /** Wrist-off: the session ends and the request on screen is answered LOCKED. */
  async wristOff(): Promise<void> {
    await this.options.se.endSession();
    if (this.current) this.finish(this.current.review, "LOCKED", "session ended");
  }

  dispose(): void {
    if (this.current) clearTimeout(this.current.timer);
    this.unsubscribe();
  }
}
