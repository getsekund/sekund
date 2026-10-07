import { getTransferSolInstruction } from "@solana-program/system";
import {
  address,
  appendTransactionMessageInstruction,
  compileTransaction,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  devnet,
  getBase64EncodedWireTransaction,
  getPublicKeyFromAddress,
  isAddress,
  lamports,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signatureBytes,
  verifySignature,
  type Address,
  type Base64EncodedWireTransaction,
  type Blockhash,
  type Signature,
  type Transaction,
} from "@solana/kit";
import { BLOCKHASH_WINDOW_MS, DEFAULT_BROADCAST_MARGIN_MS } from "@sekund/protocol";

/** Devnet only. There is deliberately no way to point this app at mainnet. */
export const DEVNET_RPC_URL = "https://api.devnet.solana.com";

export function createDevnetRpc() {
  return createSolanaRpc(devnet(DEVNET_RPC_URL));
}

export type DevnetRpc = ReturnType<typeof createDevnetRpc>;

export const explorerTxUrl = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddressUrl = (addr: string) => `https://explorer.solana.com/address/${addr}?cluster=devnet`;

export interface Lifetime {
  blockhash: Blockhash;
  lastValidBlockHeight: bigint;
  /** Local clock when getLatestBlockhash returned. */
  fetchedAt: number;
}

/** Spec 5.5 step 1: `confirmed` commitment, called immediately before building. */
export async function fetchLifetime(rpc: DevnetRpc, now: () => number = Date.now): Promise<Lifetime> {
  const { value } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  return { blockhash: value.blockhash, lastValidBlockHeight: value.lastValidBlockHeight, fetchedAt: now() };
}

/** Spec 5.5 step 2: 60 s minus time since the fetch minus the broadcast margin. */
export function computeExpiresInMs(fetchedAt: number, now: number, marginMs = DEFAULT_BROADCAST_MARGIN_MS): number {
  return Math.floor(BLOCKHASH_WINDOW_MS - (now - fetchedAt) - marginMs);
}

export function parseAddress(text: string): Address | null {
  const trimmed = text.trim();
  return isAddress(trimmed) ? address(trimmed) : null;
}

/** Parses a decimal SOL amount into lamports without floating point. */
export function parseSol(text: string): bigint | null {
  const match = /^(\d{1,9})(?:\.(\d{1,9}))?$/.exec(text.trim());
  if (!match) return null;
  const value = BigInt(match[1]!) * 1_000_000_000n + BigInt((match[2] ?? "").padEnd(9, "0"));
  return value > 0n ? value : null;
}

export interface BuiltTransfer {
  transaction: Transaction;
  /** The exact bytes sent to the watch and signed. */
  messageBytes: Uint8Array;
  feePayer: Address;
}

/** A legacy message with one System Program transfer: the only shape the watch accepts. */
export function buildTransfer(params: { from: Address; to: Address; lamports: bigint; lifetime: Lifetime }): BuiltTransfer {
  const message = pipe(
    createTransactionMessage({ version: "legacy" }),
    (m) => setTransactionMessageFeePayer(params.from, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash: params.lifetime.blockhash, lastValidBlockHeight: params.lifetime.lastValidBlockHeight },
        m,
      ),
    (m) =>
      appendTransactionMessageInstruction(
        getTransferSolInstruction({ source: createNoopSigner(params.from), destination: params.to, amount: lamports(params.lamports) }),
        m,
      ),
  );
  const transaction = compileTransaction(message);
  return { transaction, messageBytes: new Uint8Array(transaction.messageBytes), feePayer: params.from };
}

export class SignatureVerificationError extends Error {
  constructor() {
    super("The returned signature does not verify against the message bytes and the watch address. Not broadcasting.");
    this.name = "SignatureVerificationError";
  }
}

/** Verifies the watch's signature over the exact message bytes, then places it in signatures[0]. */
export async function verifyAndAssemble(built: BuiltTransfer, signature: Uint8Array): Promise<Base64EncodedWireTransaction> {
  if (signature.length !== 64) throw new SignatureVerificationError();
  const key = await getPublicKeyFromAddress(built.feePayer);
  const sig = signatureBytes(signature);
  if (!(await verifySignature(key, sig, built.transaction.messageBytes))) throw new SignatureVerificationError();
  const signed: Transaction = { ...built.transaction, signatures: { ...built.transaction.signatures, [built.feePayer]: sig } };
  return getBase64EncodedWireTransaction(signed);
}

export type ConfirmOutcome = { status: "confirmed"; signature: Signature } | { status: "failed"; signature: Signature; error: string } | { status: "expired"; signature: Signature };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Spec 5.5 step 6: same commitment for preflight; poll until confirmed or past lastValidBlockHeight. */
export async function broadcastAndConfirm(
  rpc: DevnetRpc,
  wire: Base64EncodedWireTransaction,
  lastValidBlockHeight: bigint,
  options: { pollMs?: number; onSent?: (sig: Signature) => void } = {},
): Promise<ConfirmOutcome> {
  const signature = await rpc.sendTransaction(wire, { encoding: "base64", preflightCommitment: "confirmed" }).send();
  options.onSent?.(signature);
  for (;;) {
    const { value } = await rpc.getSignatureStatuses([signature]).send();
    const status = value[0];
    if (status?.err) return { status: "failed", signature, error: JSON.stringify(status.err, (_k, v) => (typeof v === "bigint" ? v.toString() : v)) };
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return { status: "confirmed", signature };
    const height = await rpc.getBlockHeight({ commitment: "confirmed" }).send();
    if (height > lastValidBlockHeight) return { status: "expired", signature };
    await sleep(options.pollMs ?? 1_000);
  }
}

export async function getBalance(rpc: DevnetRpc, owner: Address): Promise<bigint> {
  const { value } = await rpc.getBalance(owner, { commitment: "confirmed" }).send();
  return value;
}

export type AirdropOutcome = { ok: true; signature: Signature } | { ok: false; rateLimited: boolean; message: string };

export const DEVNET_FAUCET_URL = "https://faucet.solana.com";

/** The public devnet faucet is often rate-limited; callers show the web faucet as a fallback. */
export async function requestAirdrop(rpc: DevnetRpc, owner: Address, amount = 1_000_000_000n, timeoutMs = 30_000): Promise<AirdropOutcome> {
  try {
    const signature = await rpc.requestAirdrop(owner, lamports(amount), { commitment: "confirmed" }).send();
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const { value } = await rpc.getSignatureStatuses([signature]).send();
      const s = value[0];
      if (s?.err) return { ok: false, rateLimited: false, message: "Airdrop transaction failed." };
      if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") return { ok: true, signature };
      await sleep(1_000);
    }
    return { ok: false, rateLimited: false, message: "Airdrop not confirmed in time. Check the balance again shortly." };
  } catch (error) {
    const context = (error as { context?: unknown }).context;
    const text = error instanceof Error ? `${error.message} ${context ? JSON.stringify(context, (_k, v) => (typeof v === "bigint" ? v.toString() : v)) : ""}` : String(error);
    // The public faucet answers 429 when limited, and often a bare "Internal error" for large amounts.
    const rateLimited = /429|rate|limit|too many|faucet|dry|internal error/i.test(text);
    return {
      ok: false,
      rateLimited,
      message: rateLimited ? "The devnet faucet is rate-limited right now." : `Airdrop failed: ${text.slice(0, 160)}`,
    };
  }
}
