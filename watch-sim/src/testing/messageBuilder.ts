/**
 * Builds legacy Solana message bytes for the tests.
 * The real companion builds messages with the pinned Solana SDK.
 */

function compactU16(n: number): number[] {
  const out: number[] = []
  let rest = n
  for (;;) {
    let byte = rest & 0x7f
    rest >>= 7
    if (rest === 0) {
      out.push(byte)
      return out
    }
    byte |= 0x80
    out.push(byte)
  }
}

function u32le(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]
}

function u64le(n: bigint): number[] {
  const out: number[] = []
  let rest = n
  for (let i = 0; i < 8; i++) {
    out.push(Number(rest & 0xffn))
    rest >>= 8n
  }
  return out
}

export interface SystemIxSpec {
  from: Uint8Array
  to: Uint8Array
  blockhash: Uint8Array
  lamports?: bigint
  /** Instruction type; 2 = Transfer, 4 = AdvanceNonceAccount. */
  ixType?: number
  /** Extra bytes appended to the instruction data (oversize tests). */
  padData?: number
}

/** Legacy message: [from (signer, writable), to (writable), System Program (readonly)]. */
export function buildSystemMessage(spec: SystemIxSpec): Uint8Array {
  const ixType = spec.ixType ?? 2
  const data = [...u32le(ixType), ...u64le(spec.lamports ?? 0n), ...new Array(spec.padData ?? 0).fill(0)]
  const bytes = [
    1, 0, 1,
    ...compactU16(3),
    ...spec.from,
    ...spec.to,
    ...new Uint8Array(32),
    ...spec.blockhash,
    ...compactU16(1),
    2,
    ...compactU16(2),
    0,
    1,
    ...compactU16(data.length),
    ...data,
  ]
  return new Uint8Array(bytes)
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n)
  crypto.getRandomValues(out)
  return out
}
