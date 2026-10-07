import { toBase58 } from "./encoding.ts";

export const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111";
export const LAMPORTS_PER_SOL = 1_000_000_000n;

const SYSTEM_INSTRUCTION_TRANSFER = 2;
const SYSTEM_INSTRUCTION_ADVANCE_NONCE = 4;

/** Fields shown on the watch, all decoded from the exact message bytes. */
export interface ParsedTransfer {
  kind: "SYSTEM_TRANSFER";
  from: string;
  to: string;
  lamports: bigint;
  /** Decimal SOL, no trailing zeros, for display. */
  sol: string;
  recentBlockhash: string;
  messageLength: number;
}

export type ParseResult =
  | { ok: true; transfer: ParsedTransfer }
  | { ok: false; status: "UNSUPPORTED" | "INVALID"; reason: string };

interface RawInstruction {
  programIdIndex: number;
  accounts: number[];
  data: Uint8Array;
}

class Reader {
  offset = 0;
  constructor(private readonly bytes: Uint8Array) {}

  get remaining(): number {
    return this.bytes.length - this.offset;
  }

  u8(): number {
    if (this.remaining < 1) throw new ParseError("message truncated");
    return this.bytes[this.offset++]!;
  }

  take(length: number): Uint8Array {
    if (this.remaining < length) throw new ParseError("message truncated");
    const out = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return out;
  }

  /** Solana compact-u16 (shortvec): 1–3 bytes, canonical encoding only. */
  compactU16(): number {
    let value = 0;
    for (let i = 0; i < 3; i++) {
      const byte = this.u8();
      value |= (byte & 0x7f) << (7 * i);
      if ((byte & 0x80) === 0) {
        if (i > 0 && byte === 0) throw new ParseError("non-canonical compact-u16");
        if (value > 0xffff) throw new ParseError("compact-u16 overflow");
        return value;
      }
    }
    throw new ParseError("compact-u16 too long");
  }
}

class ParseError extends Error {}

function u32le(data: Uint8Array): number {
  return (data[0]! | (data[1]! << 8) | (data[2]! << 16) | (data[3]! << 24)) >>> 0;
}

function u64le(data: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(data[offset + i]!);
  return value;
}

export function formatLamports(lamports: bigint): string {
  const whole = lamports / LAMPORTS_PER_SOL;
  const frac = (lamports % LAMPORTS_PER_SOL).toString().padStart(9, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

const unsupported = (reason: string): ParseResult => ({ ok: false, status: "UNSUPPORTED", reason });
const invalid = (reason: string): ParseResult => ({ ok: false, status: "INVALID", reason });

/**
 * MVP allowlist (spec 5.3, PROTOCOL.md section 6): a legacy message with exactly one
 * System Program Transfer from the fee payer. Everything else is refused. The caller has
 * already checked the length against the SE's `maxMessageBytes`.
 *
 * `expectedFeePayer` is the watch's own base58 address.
 */
export function parseTransferMessage(bytes: Uint8Array, expectedFeePayer?: string): ParseResult {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return invalid("empty message");
  if ((bytes[0]! & 0x80) !== 0) {
    const version = bytes[0]! & 0x7f;
    return unsupported(
      version === 0
        ? "v0 message refused: address lookup tables hide destinations from review"
        : `versioned message (v${version}) is not supported`,
    );
  }

  const reader = new Reader(bytes);
  let numRequiredSignatures: number;
  let numReadonlySigned: number;
  let numReadonlyUnsigned: number;
  let keys: Uint8Array[];
  let recentBlockhash: Uint8Array;
  const instructions: RawInstruction[] = [];

  try {
    numRequiredSignatures = reader.u8();
    numReadonlySigned = reader.u8();
    numReadonlyUnsigned = reader.u8();
    const keyCount = reader.compactU16();
    keys = Array.from({ length: keyCount }, () => reader.take(32));
    recentBlockhash = reader.take(32);
    const instructionCount = reader.compactU16();
    for (let i = 0; i < instructionCount; i++) {
      const programIdIndex = reader.u8();
      const accountCount = reader.compactU16();
      const accounts = Array.from(reader.take(accountCount));
      const dataLength = reader.compactU16();
      const data = reader.take(dataLength);
      instructions.push({ programIdIndex, accounts, data });
    }
    if (reader.remaining !== 0) return invalid("trailing bytes after instructions");
  } catch (error) {
    if (error instanceof ParseError) return invalid(error.message);
    throw error;
  }

  const keyCount = keys.length;
  if (numRequiredSignatures === 0 || numRequiredSignatures + numReadonlyUnsigned > keyCount || numReadonlySigned >= numRequiredSignatures) {
    return invalid("inconsistent message header");
  }
  for (const ix of instructions) {
    if (ix.programIdIndex >= keyCount || ix.accounts.some((a) => a >= keyCount)) return invalid("account index out of range");
  }

  const address = (i: number) => toBase58(keys[i]!);
  const isSystemProgram = (i: number) => address(i) === SYSTEM_PROGRAM_ADDRESS;
  const isSigner = (i: number) => i < numRequiredSignatures;
  const isWritable = (i: number) =>
    i < numRequiredSignatures ? i < numRequiredSignatures - numReadonlySigned : i < keyCount - numReadonlyUnsigned;

  if (instructions.length === 0) return unsupported("message has no instructions");
  const first = instructions[0]!;
  if (isSystemProgram(first.programIdIndex) && first.data.length >= 4 && u32le(first.data) === SYSTEM_INSTRUCTION_ADVANCE_NONCE) {
    return unsupported("durable-nonce message refused (AdvanceNonceAccount)");
  }
  if (instructions.length !== 1) return unsupported("exactly one instruction is allowed");
  if (numRequiredSignatures !== 1 || numReadonlySigned !== 0) return unsupported("exactly one writable signer is allowed");
  if (keyCount !== 3) return unsupported("a transfer uses exactly three accounts");
  if (new Set(keys.map((k) => toBase58(k))).size !== keyCount) return invalid("duplicate account keys");

  if (!isSystemProgram(first.programIdIndex)) return unsupported("only the System Program is allowed");
  if (isWritable(first.programIdIndex) || isSigner(first.programIdIndex)) return invalid("program account must be read-only");
  if (first.data.length < 4 || u32le(first.data) !== SYSTEM_INSTRUCTION_TRANSFER) return unsupported("only System Program Transfer is allowed");
  if (first.data.length !== 12) return invalid("transfer data must be 12 bytes");
  if (first.accounts.length !== 2) return invalid("transfer takes two accounts");

  const [fromIndex, toIndex] = first.accounts as [number, number];
  if (fromIndex !== 0) return unsupported("transfer source must be the fee payer");
  if (toIndex === 0 || toIndex === first.programIdIndex) return invalid("bad transfer destination");
  if (!isWritable(toIndex) || isSigner(toIndex)) return invalid("destination must be writable and not a signer");

  const lamports = u64le(first.data, 4);
  if (lamports === 0n) return unsupported("zero-lamport transfer");

  const from = address(0);
  if (expectedFeePayer !== undefined && from !== expectedFeePayer) return unsupported("fee payer is not this watch's address");

  return {
    ok: true,
    transfer: {
      kind: "SYSTEM_TRANSFER",
      from,
      to: address(toIndex),
      lamports,
      sol: formatLamports(lamports),
      recentBlockhash: toBase58(recentBlockhash),
      messageLength: bytes.length,
    },
  };
}
