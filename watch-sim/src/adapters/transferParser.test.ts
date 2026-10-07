import { describe, expect, it } from 'vitest'
import { buildSystemMessage } from './messageBuilder'
import { formatSol, parseTransfer } from './transferParser'

const from = new Uint8Array(32).fill(1)
const to = new Uint8Array(32).fill(2)
const blockhash = new Uint8Array(32).fill(3)

describe('parseTransfer', () => {
  it('parses a 150-byte legacy System Program transfer', () => {
    const msg = buildSystemMessage({ from, to, blockhash, lamports: 1_500_000_000n })
    expect(msg.length).toBe(150)
    const r = parseTransfer(msg, from)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect([...r.transfer.to]).toEqual([...to])
    expect(r.transfer.lamports).toBe(1_500_000_000n)
  })

  it('rejects versioned messages, nonce advances, trailing bytes and foreign wallets', () => {
    const msg = buildSystemMessage({ from, to, blockhash })
    const v0 = new Uint8Array([0x80, ...msg])
    expect(parseTransfer(v0, from)).toMatchObject({ ok: false, reason: 'versioned message' })
    expect(parseTransfer(buildSystemMessage({ from, to, blockhash, ixType: 4 }), from)).toMatchObject({
      ok: false,
      reason: 'durable nonce',
    })
    expect(parseTransfer(new Uint8Array([...msg, 0]), from)).toMatchObject({ ok: false })
    expect(parseTransfer(msg, to)).toMatchObject({ ok: false, reason: 'not this wallet' })
    expect(parseTransfer(msg.subarray(0, 100), from)).toMatchObject({ ok: false })
  })
})

describe('formatSol', () => {
  it('formats lamports without trailing zeros', () => {
    expect(formatSol(10_000_000n)).toBe('0.01')
    expect(formatSol(2_000_000_000n)).toBe('2')
    expect(formatSol(1n)).toBe('0.000000001')
  })
})
