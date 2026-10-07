/** Independent byte-level builders for test messages (no SDK). */

export function compactU16(n: number): number[] {
  const out: number[] = [];
  let v = n;
  for (;;) {
    let byte = v & 0x7f;
    v >>= 7;
    if (v) byte |= 0x80;
    out.push(byte);
    if (!v) return out;
  }
}

export function u32le(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
}

export function u64le(n: bigint): number[] {
  return Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
}

export const key = (fill: number): Uint8Array => new Uint8Array(32).fill(fill);
export const SYSTEM = new Uint8Array(32);

export interface Ix {
  program: number;
  accounts: number[];
  data: number[];
}

export function legacyMessage(opts: {
  header?: [number, number, number];
  keys: Uint8Array[];
  blockhash?: Uint8Array;
  instructions: Ix[];
  trailing?: number[];
}): Uint8Array {
  const bytes: number[] = [...(opts.header ?? [1, 0, 1])];
  bytes.push(...compactU16(opts.keys.length));
  for (const k of opts.keys) bytes.push(...k);
  bytes.push(...(opts.blockhash ?? key(0xbb)));
  bytes.push(...compactU16(opts.instructions.length));
  for (const ix of opts.instructions) {
    bytes.push(ix.program, ...compactU16(ix.accounts.length), ...ix.accounts, ...compactU16(ix.data.length), ...ix.data);
  }
  bytes.push(...(opts.trailing ?? []));
  return Uint8Array.from(bytes);
}

export const transferData = (lamports: bigint) => [...u32le(2), ...u64le(lamports)];

export function transferMessage(from = key(0x11), to = key(0x22), lamports = 1_000_000n): Uint8Array {
  return legacyMessage({
    keys: [from, to, SYSTEM],
    instructions: [{ program: 2, accounts: [0, 1], data: transferData(lamports) }],
  });
}

/** Durable-nonce transfer: AdvanceNonceAccount first, then the transfer. */
export function nonceMessage(from = key(0x11), to = key(0x22)): Uint8Array {
  const nonceAccount = key(0x33);
  const recentBlockhashesSysvar = key(0x44);
  return legacyMessage({
    header: [1, 0, 2],
    keys: [from, nonceAccount, to, recentBlockhashesSysvar, SYSTEM],
    instructions: [
      { program: 4, accounts: [1, 3, 0], data: u32le(4) },
      { program: 4, accounts: [0, 2], data: transferData(1_000n) },
    ],
  });
}

/** v0 message whose destination comes from an address lookup table. */
export function v0LookupMessage(from = key(0x11)): Uint8Array {
  const inner = legacyMessage({
    keys: [from, SYSTEM],
    instructions: [{ program: 1, accounts: [0, 2], data: transferData(1_000n) }],
  });
  const tableAddress = key(0x55);
  return Uint8Array.from([0x80, ...inner, ...compactU16(1), ...tableAddress, ...compactU16(1), 0, ...compactU16(0)]);
}
