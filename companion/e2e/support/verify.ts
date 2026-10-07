import { getBase58Decoder, getBase64Encoder, getTransactionDecoder } from "@solana/kit";
import { fromBase58, parseTransferMessage } from "@sekund/protocol";

export interface VerifiedTransfer {
  signature: string;
  feePayer: string;
  to: string;
  lamports: bigint;
}

/**
 * Independent check of what the page broadcast: one signer, the watch address; pure Ed25519
 * over the exact message bytes (WebCrypto, no hashing); a single System transfer.
 */
export async function verifyBroadcast(wireBase64: string, watchAddress: string): Promise<VerifiedTransfer> {
  const tx = getTransactionDecoder().decode(getBase64Encoder().encode(wireBase64));
  const signers = Object.keys(tx.signatures);
  if (signers.length !== 1 || signers[0] !== watchAddress) throw new Error(`unexpected signers ${signers.join(",")}`);
  const sig = tx.signatures[watchAddress as keyof typeof tx.signatures];
  if (!sig) throw new Error("missing signature");
  const message = new Uint8Array(tx.messageBytes);
  const key = await crypto.subtle.importKey("raw", new Uint8Array(fromBase58(watchAddress)), { name: "Ed25519" }, false, ["verify"]);
  if (!(await crypto.subtle.verify({ name: "Ed25519" }, key, new Uint8Array(sig), message))) throw new Error("Ed25519 signature does not verify");
  const parsed = parseTransferMessage(message, watchAddress);
  if (!parsed.ok) throw new Error(`not a plain transfer: ${parsed.reason}`);
  return { signature: getBase58Decoder().decode(sig), feePayer: watchAddress, to: parsed.transfer.to, lamports: parsed.transfer.lamports };
}
