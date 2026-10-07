/**
 * MVP allowlist parser (spec v1.1 §5.3, §5.5): a legacy message holding exactly
 * one System Program transfer from the watch's own key. Everything else is
 * UNSUPPORTED. Local until `protocol/` ships the shared parser.
 */

export interface ParsedTransfer {
  feePayer: Uint8Array
  from: Uint8Array
  to: Uint8Array
  lamports: bigint
  recentBlockhash: Uint8Array
}

export type ParseResult =
  | { ok: true; transfer: ParsedTransfer }
  | { ok: false; reason: string }

const SYSTEM_PROGRAM = new Uint8Array(32)
const IX_TRANSFER = 2
const IX_ADVANCE_NONCE = 4

class Reader {
  private offset = 0
  private readonly bytes: Uint8Array
  constructor(bytes: Uint8Array) {
    this.bytes = bytes
  }

  get done(): boolean {
    return this.offset === this.bytes.length
  }

  u8(): number {
    if (this.offset >= this.bytes.length) throw new Error('truncated')
    return this.bytes[this.offset++]
  }

  take(n: number): Uint8Array {
    if (this.offset + n > this.bytes.length) throw new Error('truncated')
    const out = this.bytes.subarray(this.offset, this.offset + n)
    this.offset += n
    return out
  }

  compactU16(): number {
    let value = 0
    for (let i = 0; i < 3; i++) {
      const b = this.u8()
      value |= (b & 0x7f) << (7 * i)
      if ((b & 0x80) === 0) return value
    }
    throw new Error('bad compact-u16')
  }
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export function parseTransfer(message: Uint8Array, ownKey: Uint8Array | null): ParseResult {
  try {
    const r = new Reader(message)
    const numRequiredSignatures = r.u8()
    if (numRequiredSignatures & 0x80) return { ok: false, reason: 'versioned message' }
    const numReadonlySigned = r.u8()
    const numReadonlyUnsigned = r.u8()
    if (numRequiredSignatures !== 1) return { ok: false, reason: 'needs exactly one signer' }
    if (numReadonlySigned !== 0) return { ok: false, reason: 'fee payer must be writable' }

    const keyCount = r.compactU16()
    if (keyCount < 2 || keyCount > 3) return { ok: false, reason: 'unexpected account count' }
    const keys: Uint8Array[] = []
    for (let i = 0; i < keyCount; i++) keys.push(r.take(32))
    const recentBlockhash = r.take(32)

    const ixCount = r.compactU16()
    if (ixCount !== 1) return { ok: false, reason: 'needs exactly one instruction' }
    const programIndex = r.u8()
    const accountCount = r.compactU16()
    const accounts: number[] = []
    for (let i = 0; i < accountCount; i++) accounts.push(r.u8())
    const data = r.take(r.compactU16())
    if (!r.done) return { ok: false, reason: 'trailing bytes' }

    if (programIndex >= keyCount || !equal(keys[programIndex], SYSTEM_PROGRAM)) {
      return { ok: false, reason: 'not the System Program' }
    }
    if (data.length < 4) return { ok: false, reason: 'bad instruction data' }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const ixType = view.getUint32(0, true)
    if (ixType === IX_ADVANCE_NONCE) return { ok: false, reason: 'durable nonce' }
    if (ixType !== IX_TRANSFER || data.length !== 12) return { ok: false, reason: 'not a transfer' }
    if (accounts.length !== 2) return { ok: false, reason: 'bad transfer accounts' }

    const [fromIndex, toIndex] = accounts
    if (fromIndex !== 0) return { ok: false, reason: 'sender must be the fee payer' }
    const writableUnsignedEnd = keyCount - numReadonlyUnsigned
    if (toIndex < 1 || toIndex >= writableUnsignedEnd) {
      return { ok: false, reason: 'destination must be writable' }
    }

    const feePayer = keys[0]
    if (ownKey && !equal(feePayer, ownKey)) return { ok: false, reason: 'not this wallet' }

    return {
      ok: true,
      transfer: {
        feePayer,
        from: keys[fromIndex],
        to: keys[toIndex],
        lamports: view.getBigUint64(4, true),
        recentBlockhash,
      },
    }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'malformed' }
  }
}

const LAMPORTS_PER_SOL = 1_000_000_000n

export function formatSol(lamports: bigint): string {
  const whole = lamports / LAMPORTS_PER_SOL
  const frac = (lamports % LAMPORTS_PER_SOL).toString().padStart(9, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : whole.toString()
}
