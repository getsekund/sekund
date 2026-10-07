import { base58, base64 } from "@scure/base";

export function toBase64(bytes: Uint8Array): string {
  return base64.encode(bytes);
}

/** Strict RFC 4648 base64 with padding; throws on anything else. */
export function fromBase64(text: string): Uint8Array {
  return base64.decode(text);
}

export function toBase58(bytes: Uint8Array): string {
  return base58.encode(bytes);
}

export function fromBase58(text: string): Uint8Array {
  return base58.decode(text);
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}
