import { PROTOCOL_VERSION, createPeerIdentity, createRelayTransport, encodeFrame, randomBytes, stampIdentity, toBase58, type Review, type Transport } from "@sekund/protocol";
import { createInProcessSecureElement } from "@sekund/se-sim";
import { HeadlessWatch, type Decision } from "../../src/testing/headless-watch.ts";

/** "hold" keeps the review on screen until press() is called, like a person reading it. */
export type E2eDecision = Decision | "hold";

export interface E2eWatch {
  address: string;
  reviews: Review[];
  /** Decisions for the next reviews, in order; the last one repeats. */
  decide(...decisions: E2eDecision[]): void;
  /** Answers a held review. */
  press(decision: "approve" | "reject"): void;
  close(): void;
}

/**
 * The headless stand-in for the watch (same RequestGuard, seDriver and simulated SE as the
 * product path) connected to the real relay. APPROVE is scripted instead of pressed.
 */
export async function connectHeadlessWatch(): Promise<E2eWatch> {
  const se = createInProcessSecureElement({ profile: "TROPIC01" });
  await se.setPin(Array.from(randomBytes(4), (b) => (b % 10).toString()).join(""));
  await se.generateKey(0);
  const address = toBase58(await se.getPublicKey(0));
  const transport: Transport = createRelayTransport({ role: "watch", identity: createPeerIdentity("sekund-demo") });
  const status = () => transport.send(encodeFrame(stampIdentity({ version: PROTOCOL_VERSION, type: "WATCH_STATUS", wallet: true, session: "OPEN", reviewing: false }, transport.identity)));
  transport.onPeer((connected) => connected && status());

  let queue: E2eDecision[] = ["approve"];
  let held: ((decision: Decision) => void) | null = null;
  const reviews: Review[] = [];
  const watch = new HeadlessWatch({
    transport,
    se,
    decide: (review) => {
      reviews.push(review);
      const next = queue.length > 1 ? queue.shift()! : queue[0]!;
      if (next !== "hold") return next;
      return new Promise<Decision>((resolve) => (held = resolve));
    },
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("relay not reachable on ws://127.0.0.1:4319")), 10_000);
    transport.onState((state) => {
      if (state === "rejected") {
        clearTimeout(timer);
        reject(new Error("watch seat rejected: room already has a watch"));
        return;
      }
      if (state === "open") {
        // Seat rejection is sent after onopen; wait one macrotask before accepting.
        setTimeout(() => {
          if (transport.state === "rejected") {
            clearTimeout(timer);
            reject(new Error("watch seat rejected: room already has a watch"));
          } else if (transport.state === "open") {
            clearTimeout(timer);
            resolve();
          }
        }, 0);
      }
    });
  });

  return {
    address,
    reviews,
    decide: (...decisions) => {
      queue = decisions.length ? decisions : ["approve"];
    },
    press: (decision) => {
      if (!held) throw new Error("no review is held on the watch");
      const resolve = held;
      held = null;
      resolve(decision);
    },
    close: () => {
      watch.dispose();
      transport.close();
    },
  };
}
