/**
 * Devnet-only funding wallet for the proof script, used when the public faucet refuses
 * airdrops. It is an ordinary software key that only pays for the test. It is not the
 * SEKUND wallet and it never signs the proof transaction.
 *
 * Location: SEKUND_FUNDER_KEYPAIR (Solana CLI JSON format), else companion/.devnet/funder.json
 * (gitignored, created on first run with mode 0600).
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  appendTransactionMessageInstruction,
  createKeyPairSignerFromBytes,
  createTransactionMessage,
  getSignatureFromTransaction,
  lamports,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  type Address,
  type KeyPairSigner,
} from "@solana/kit";
import { broadcastAndConfirm, fetchLifetime, type DevnetRpc } from "../src/lib/solana.ts";

const DEFAULT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../.devnet/funder.json");

async function createFunderFile(path: string): Promise<void> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const bytes = [...pkcs8.slice(-32), ...publicKey];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(bytes), { mode: 0o600 });
  chmodSync(path, 0o600);
}

export async function loadFunder(): Promise<{ signer: KeyPairSigner; path: string; created: boolean }> {
  const path = process.env.SEKUND_FUNDER_KEYPAIR ?? DEFAULT_PATH;
  let created = false;
  if (!existsSync(path)) {
    if (process.env.SEKUND_FUNDER_KEYPAIR) throw new Error(`SEKUND_FUNDER_KEYPAIR not found: ${path}`);
    await createFunderFile(path);
    created = true;
  }
  const bytes = Uint8Array.from(JSON.parse(readFileSync(path, "utf8")) as number[]);
  return { signer: await createKeyPairSignerFromBytes(bytes), path, created };
}

export async function fundFrom(rpc: DevnetRpc, funder: KeyPairSigner, to: Address, amount: bigint): Promise<string> {
  const lifetime = await fetchLifetime(rpc);
  const message = pipe(
    createTransactionMessage({ version: "legacy" }),
    (m) => setTransactionMessageFeePayerSigner(funder, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(lifetime, m),
    (m) => appendTransactionMessageInstruction(getTransferSolInstruction({ source: funder, destination: to, amount: lamports(amount) }), m),
  );
  const signed = await signTransactionMessageWithSigners(message);
  const outcome = await broadcastAndConfirm(rpc, getBase64EncodedWireTransaction(signed), lifetime.lastValidBlockHeight);
  if (outcome.status !== "confirmed") throw new Error(`funding transfer ${outcome.status}`);
  return getSignatureFromTransaction(signed);
}
