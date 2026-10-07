/**
 * Real devnet proof: the simulated SE generates a key, signs a transfer through the full
 * protocol path, and the companion verifies and broadcasts it.
 *
 *   pnpm --filter @sekund/companion devnet:proof
 *
 * The approval is scripted here. In the demo a human presses APPROVE on the watch simulator.
 * If the devnet faucet is rate-limited, the script prints the address and waits for you to
 * fund it at https://faucet.solana.com (Devnet), up to SEKUND_FUND_WAIT_S seconds (default 300).
 */
import { address, signature, type Address } from "@solana/kit";
import { createMemoryTransportPair, randomBytes, toBase58 } from "@sekund/protocol";
import { createInProcessSecureElement } from "@sekund/se-sim";
import { SekundClient } from "../src/lib/sekund-client.ts";
import {
  DEVNET_FAUCET_URL,
  broadcastAndConfirm,
  createDevnetRpc,
  explorerAddressUrl,
  fetchLifetime,
  getBalance,
  requestAirdrop,
} from "../src/lib/solana.ts";
import { sendTransfer } from "../src/lib/transfer-flow.ts";
import { HeadlessWatch } from "../src/testing/headless-watch.ts";
import { fundFrom, loadFunder } from "./devnet-funder.ts";

const TRANSFER_LAMPORTS = 10_000_000n; // 0.01 SOL
const MIN_BALANCE = TRANSFER_LAMPORTS + 1_000_000n;
const FUNDING_LAMPORTS = 20_000_000n;

const log = (line: string) => console.log(`[devnet-proof] ${line}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const rpc = createDevnetRpc();

const se = createInProcessSecureElement({ profile: "TROPIC01" });
const pin = Array.from(randomBytes(4), (b) => (b % 10).toString()).join("");
await se.setPin(pin);
await se.generateKey(0);
const from: Address = address(toBase58(await se.getPublicKey(0)));
log(`SE profile TROPIC01 (simulated). Key generated inside the SE; private key is non-extractable.`);
log(`Watch address: ${from}`);
log(`Explorer: ${explorerAddressUrl(from)}`);

log("Requesting a 0.1 SOL devnet airdrop for the watch address...");
const airdrop = await requestAirdrop(rpc, from, 100_000_000n);
if (airdrop.ok) {
  log(`Airdrop confirmed: ${airdrop.signature}`);
} else {
  log(`${airdrop.message} Falling back to the local devnet funder wallet.`);
  const funder = await loadFunder();
  if (funder.created) log(`Created a devnet-only funder wallet at ${funder.path} (gitignored).`);
  const waitS = Number(process.env.SEKUND_FUND_WAIT_S ?? 300);
  const start = Date.now();
  let announced = false;
  while ((await getBalance(rpc, funder.signer.address)) < FUNDING_LAMPORTS + 1_000_000n) {
    if (!announced) {
      log(`Fund the funder wallet ${funder.signer.address} with devnet SOL at ${DEVNET_FAUCET_URL} (choose Devnet). Waiting up to ${waitS} s...`);
      announced = true;
    }
    if (Date.now() - start > waitS * 1000) {
      log("Funder wallet still empty. Exiting without a transfer.");
      process.exit(2);
    }
    await sleep(5_000);
  }
  log(`Funding transfer (signed by the funder wallet, not by SEKUND): ${await fundFrom(rpc, funder.signer, from, FUNDING_LAMPORTS)}`);
}
const balance = await getBalance(rpc, from);
if (balance < MIN_BALANCE) {
  log(`Watch balance ${balance} lamports is too low. Exiting.`);
  process.exit(2);
}
log(`Watch balance: ${balance} lamports`);

const pair = createMemoryTransportPair();
const watch = new HeadlessWatch({
  transport: pair.watch,
  se,
  decide: (review) => {
    log(`Watch review: send ${review.transfer.sol} SOL to ${review.transfer.to} on devnet, ${review.messageBytes.length}-byte message, expires in ${Math.round((review.deadline - Date.now()) / 1000)} s`);
    log("Scripted APPROVE (in the demo a human presses it on the watch).");
    return "approve";
  },
});
const client = new SekundClient(pair.companion);

const destination = address(toBase58(randomBytes(32)));
const outcome = await sendTransfer(
  {
    client,
    fetchLifetime: () => fetchLifetime(rpc),
    broadcast: (wire, lastValidBlockHeight) => broadcastAndConfirm(rpc, wire, lastValidBlockHeight, { onSent: (sig) => log(`Broadcast: ${sig}`) }),
    onStage: (stage) => {
      if (stage.stage === "verifying") log("Signature received; verifying against the exact message bytes and the watch address...");
      if (stage.stage === "broadcasting") log("Verified. Broadcasting to devnet.");
    },
  },
  { from, to: destination, lamports: TRANSFER_LAMPORTS },
);

watch.dispose();
client.dispose();

if (outcome.kind !== "confirmed") {
  log(`Failed: ${JSON.stringify(outcome)}`);
  process.exit(1);
}

const tx = await rpc
  .getTransaction(signature(outcome.signature), { commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0 })
  .send();
const signer = tx?.transaction.message.accountKeys[0];
log(`Confirmed on devnet. Fee payer on-chain: ${signer}`);
log(`Transaction signature: ${outcome.signature}`);
log(`Explorer: ${outcome.explorerUrl}`);
