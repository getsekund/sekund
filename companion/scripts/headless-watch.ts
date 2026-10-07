/**
 * Development stand-in for the watch over the real relay, for testing the companion UI
 * before or without the watch simulator. Not the product: the watch UI is watch-sim/.
 *
 *   pnpm relay
 *   pnpm --filter @sekund/companion watch:headless      # asks approve/reject in the terminal
 *   SEKUND_HEADLESS_DECISION=reject pnpm --filter @sekund/companion watch:headless
 */
import { createInterface } from "node:readline/promises";
import { PROTOCOL_VERSION, createRelayTransport, encodeFrame, randomBytes, toBase58 } from "@sekund/protocol";
import { createInProcessSecureElement } from "@sekund/se-sim";
import { HeadlessWatch, type Decision } from "../src/testing/headless-watch.ts";

const fixed = process.env.SEKUND_HEADLESS_DECISION as Decision | undefined;
const se = createInProcessSecureElement({ profile: "TROPIC01" });
await se.setPin(Array.from(randomBytes(4), (b) => (b % 10).toString()).join(""));
await se.generateKey(0);
console.log(`[headless-watch] simulated SE address ${toBase58(await se.getPublicKey(0))} (ephemeral; fund it to broadcast)`);

const transport = createRelayTransport({ role: "watch" });
const rl = fixed ? null : createInterface({ input: process.stdin, output: process.stdout });
const status = () => transport.send(encodeFrame({ version: PROTOCOL_VERSION, type: "WATCH_STATUS", wallet: true, session: "OPEN", reviewing: false }));
transport.onPeer((connected) => connected && status());
transport.onState((state) => console.log(`[headless-watch] link ${state}`));

new HeadlessWatch({
  transport,
  se,
  decide: async (review) => {
    const left = Math.round((review.deadline - Date.now()) / 1000);
    console.log(`[headless-watch] REVIEW: ${review.transfer.sol} SOL -> ${review.transfer.to} (devnet), ${left} s left`);
    if (fixed) return fixed;
    const answer = (await rl!.question("[headless-watch] approve? [y/N/w=wait] ")).trim().toLowerCase();
    return answer === "y" ? "approve" : answer === "w" ? "wait" : "reject";
  },
});
