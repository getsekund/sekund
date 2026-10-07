import type { SecureElement } from "@sekund/protocol";

export const hex = (text: string): Uint8Array => Uint8Array.from(text.match(/../g) ?? [], (b) => parseInt(b, 16));
export const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export async function approveAndSign(se: SecureElement, message: Uint8Array, slot = 0): Promise<Uint8Array> {
  const token = await se.issueApproveToken(slot, message);
  return se.eddsaSign(slot, message, token);
}

export async function verifyEd25519(publicKey: Uint8Array, signature: Uint8Array, message: Uint8Array): Promise<boolean> {
  const key = await crypto.subtle.importKey("raw", publicKey as BufferSource, { name: "Ed25519" }, false, ["verify"]);
  return crypto.subtle.verify({ name: "Ed25519" }, key, signature as BufferSource, message as BufferSource);
}
