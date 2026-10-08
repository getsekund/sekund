import { describe, expect, it, vi } from "vitest";
import {
  address,
  appendTransactionMessageInstruction,
  blockhash,
  compileTransaction,
  compressTransactionMessageUsingAddressLookupTables,
  createNoopSigner,
  createTransactionMessage,
  getBase64Encoder,
  getTransactionDecoder,
  lamports,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  setTransactionMessageLifetimeUsingDurableNonce,
  type Address,
  type Base64EncodedWireTransaction,
  type Signature,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  PROTOCOL_VERSION,
  createMemoryTransportPair,
  demoIdentity,
  fromBase58,
  parseTransferMessage,
  randomBytes,
  toBase58,
  type SeProfile,
  type Transport,
} from "@sekund/protocol";
import { createInProcessSecureElement } from "@sekund/se-sim";
import { SekundClient } from "../src/lib/sekund-client.ts";
import { buildTransfer, verifyAndAssemble, type ConfirmOutcome, type Lifetime } from "../src/lib/solana.ts";
import { sendTransfer } from "../src/lib/transfer-flow.ts";
import { HeadlessWatch, type Decision } from "../src/testing/headless-watch.ts";

const PIN = "4821";
const destination = address(toBase58(randomBytes(32)));

function fakeLifetime(fetchedAt = Date.now()): Lifetime {
  return { blockhash: blockhash(toBase58(randomBytes(32))), lastValidBlockHeight: 1_000n, fetchedAt };
}

async function setup(options: { profile?: SeProfile; decide?: (review: unknown) => Decision | Promise<Decision>; now?: () => number } = {}) {
  const se = createInProcessSecureElement({ profile: options.profile ?? "TROPIC01" });
  await se.setPin(PIN);
  await se.generateKey(0);
  const from = address(toBase58(await se.getPublicKey(0)));
  const pair = createMemoryTransportPair();
  const watch = new HeadlessWatch({ transport: pair.watch, se, decide: options.decide ?? (() => "approve"), ...(options.now ? { now: options.now } : {}) });
  const client = new SekundClient(pair.companion, { graceMs: 200 });
  const broadcasts: Base64EncodedWireTransaction[] = [];
  const broadcast = vi.fn(async (wire: Base64EncodedWireTransaction): Promise<ConfirmOutcome> => {
    broadcasts.push(wire);
    return { status: "confirmed", signature: "5".repeat(88) as Signature };
  });
  const fetchLifetime = vi.fn(async () => fakeLifetime());
  return { se, from, pair, watch, client, broadcast, broadcasts, fetchLifetime };
}

function decodeWire(wire: Base64EncodedWireTransaction) {
  return getTransactionDecoder().decode(getBase64Encoder().encode(wire));
}

describe("signing path (spec 11.1)", () => {
  it("the companion reads the address over the transport", async () => {
    const { client, from } = await setup();
    expect(await client.getAddress()).toMatchObject({ status: "OK", address: from, profile: "TROPIC01", maxMessageBytes: 4096 });
  });

  it("an approved signature verifies against the exact message and address, and is what gets broadcast", async () => {
    const { client, from, watch, broadcast, broadcasts, fetchLifetime } = await setup();
    const outcome = await sendTransfer({ client, fetchLifetime, broadcast }, { from, to: destination, lamports: 10_000_000n });
    expect(outcome.kind).toBe("confirmed");
    expect(fetchLifetime).toHaveBeenCalledTimes(1);

    const tx = decodeWire(broadcasts[0]!);
    const displayedBytes = watch.displayed[0]!.messageBytes;
    expect(new Uint8Array(tx.messageBytes)).toEqual(displayedBytes);
    const sig = tx.signatures[from]!;
    expect(toBase58(new Uint8Array(sig))).toBe(watch.sent[0]!.signature);

    const key = await crypto.subtle.importKey("raw", fromBase58(from) as BufferSource, "Ed25519", false, ["verify"]);
    expect(await crypto.subtle.verify("Ed25519", key, sig as BufferSource, displayedBytes as BufferSource)).toBe(true);
  });

  it("the SDK-built transfer is the 150-byte legacy message the watch parses", async () => {
    const { from } = await setup();
    const built = buildTransfer({ from, to: destination, lamports: 1_234_000n, lifetime: fakeLifetime() });
    expect(built.messageBytes).toHaveLength(150);
    expect(parseTransferMessage(built.messageBytes, from)).toMatchObject({ ok: true, transfer: { from, to: destination, lamports: 1_234_000n, sol: "0.001234" } });
  });

  it("reject produces no signature and nothing is broadcast", async () => {
    const { client, from, watch, broadcast, fetchLifetime } = await setup({ decide: () => "reject" });
    const outcome = await sendTransfer({ client, fetchLifetime, broadcast }, { from, to: destination, lamports: 1n });
    expect(outcome).toMatchObject({ kind: "watch-refused", status: "REJECTED" });
    expect(watch.sent.every((r) => r.signature === undefined)).toBe(true);
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("a replayed request is refused and yields no second signature", async () => {
    const { client, from, watch, pair, fetchLifetime, broadcast } = await setup();
    const frames: string[] = [];
    const originalSend = pair.companion.send.bind(pair.companion);
    pair.companion.send = (text: string) => {
      frames.push(text);
      originalSend(text);
    };
    await sendTransfer({ client, fetchLifetime, broadcast }, { from, to: destination, lamports: 1n });
    const signFrame = frames.find((f) => f.includes("SIGN_TRANSACTION"))!;

    pair.companion.send(signFrame);
    await vi.waitFor(() => expect(watch.sent).toHaveLength(2));
    expect(watch.sent[1]).toMatchObject({ status: "REPLAYED" });
    expect(watch.sent[1]!.signature).toBeUndefined();
    expect(watch.displayed).toHaveLength(1);
  });

  it("a payload altered after display cannot be signed", async () => {
    const { se, from } = await setup();
    const built = buildTransfer({ from, to: destination, lamports: 5n, lifetime: fakeLifetime() });
    const token = await se.issueApproveToken(0, built.messageBytes);
    const altered = buildTransfer({ from, to: address(toBase58(randomBytes(32))), lamports: 5n, lifetime: fakeLifetime() }).messageBytes;
    await expect(se.eddsaSign(0, altered, token)).rejects.toMatchObject({ code: "BAD_TOKEN" });
  });

  it("the companion refuses a signature over different bytes and does not broadcast", async () => {
    const { se, from, client, pair, fetchLifetime, broadcast } = await setup({ decide: () => "wait" });
    // A compromised watch that signs some other message after the user approved.
    pair.watch.onFrame(async (text) => {
      const req = JSON.parse(text);
      if (req.type !== "SIGN_TRANSACTION") return;
      const other = buildTransfer({ from, to: address(toBase58(randomBytes(32))), lamports: 999n, lifetime: fakeLifetime() }).messageBytes;
      const sig = await se.eddsaSign(0, other, await se.issueApproveToken(0, other));
      pair.watch.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "SIGN_TRANSACTION_RESULT", requestId: req.requestId, status: "APPROVED", signature: toBase58(sig) , ...demoIdentity("watch") }));
    });
    const outcome = await sendTransfer({ client, fetchLifetime, broadcast }, { from, to: destination, lamports: 1n });
    expect(outcome.kind).toBe("verification-failed");
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("verifyAndAssemble rejects a wrong-length or forged signature", async () => {
    const { from } = await setup();
    const built = buildTransfer({ from, to: destination, lamports: 5n, lifetime: fakeLifetime() });
    await expect(verifyAndAssemble(built, new Uint8Array(63))).rejects.toThrow(/does not verify/);
    await expect(verifyAndAssemble(built, randomBytes(64))).rejects.toThrow(/does not verify/);
  });

  it("an oversize message is refused before display on SE050E (919 bytes)", async () => {
    const { client, watch } = await setup({ profile: "SE050E" });
    const handle = client.requestSignature({ messageBytes: new Uint8Array(920), expiresInMs: 30_000, lastValidBlockHeight: 1n });
    expect(await handle.result).toMatchObject({ status: "TOO_LARGE" });
    expect(watch.displayed).toHaveLength(0);
  });

  it("an expired request produces no signature; the retry is a new request with a new blockhash", async () => {
    let clock = 1_000_000;
    const now = () => clock;
    let decisions = 0;
    const { client, from, watch, broadcast } = await setup({ now, decide: () => (decisions++ === 0 ? "wait" : "approve") });
    // Blockhash fetched 51.9 s ago: expiresInMs = 60000 - 51900 - 8000 = 100 ms.
    const fetchLifetime = vi.fn(async () => fakeLifetime(clock - 51_900));

    const first = await sendTransfer({ client, fetchLifetime, broadcast, now }, { from, to: destination, lamports: 1n });
    expect(first).toMatchObject({ kind: "watch-refused", status: "EXPIRED" });
    expect(watch.sent[0]).toMatchObject({ status: "EXPIRED" });
    expect(watch.sent[0]!.signature).toBeUndefined();

    // Pressing APPROVE after expiry does nothing.
    clock += 1_000;
    await watch.approve();
    expect(watch.sent).toHaveLength(1);

    fetchLifetime.mockImplementation(async () => fakeLifetime(clock));
    const retry = await sendTransfer({ client, fetchLifetime, broadcast, now }, { from, to: destination, lamports: 1n });
    expect(retry.kind).toBe("confirmed");
    if (first.kind !== "watch-refused" || retry.kind !== "confirmed") return;
    expect(retry.requestId).not.toBe(first.requestId);
    expect(fetchLifetime).toHaveBeenCalledTimes(2);
    expect(watch.displayed[1]!.transfer.recentBlockhash).not.toBe(watch.displayed[0]!.transfer.recentBlockhash);
  });

  it("durable-nonce and lookup-table messages are refused before display", async () => {
    const { client, from, watch } = await setup();
    const transferIx = getTransferSolInstruction({ source: createNoopSigner(from), destination, amount: lamports(1n) });

    const nonceMessage = pipe(
      createTransactionMessage({ version: "legacy" }),
      (m) => setTransactionMessageFeePayer(from, m),
      (m) =>
        setTransactionMessageLifetimeUsingDurableNonce(
          { nonce: blockhash(toBase58(randomBytes(32))) as never, nonceAccountAddress: address(toBase58(randomBytes(32))), nonceAuthorityAddress: from },
          m,
        ),
      (m) => appendTransactionMessageInstruction(transferIx, m),
    );
    const nonceBytes = new Uint8Array(compileTransaction(nonceMessage).messageBytes);

    const table = address(toBase58(randomBytes(32)));
    const v0 = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayer(from, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: blockhash(toBase58(randomBytes(32))), lastValidBlockHeight: 1n }, m),
      (m) => appendTransactionMessageInstruction(transferIx, m),
    );
    const compressed = compressTransactionMessageUsingAddressLookupTables(v0, { [table]: [destination as Address] });
    const lookupBytes = new Uint8Array(compileTransaction(compressed).messageBytes);

    for (const messageBytes of [nonceBytes, lookupBytes]) {
      const handle = client.requestSignature({ messageBytes, expiresInMs: 30_000, lastValidBlockHeight: 1n });
      expect(await handle.result).toMatchObject({ status: "UNSUPPORTED" });
    }
    expect(watch.displayed).toHaveLength(0);
  });

  it("signing needs an open PIN session; wrist-off during review answers LOCKED", async () => {
    let reviewSeen = () => {};
    const seen = new Promise<void>((r) => (reviewSeen = r));
    let reviews = 0;
    const { se, client, from, watch, fetchLifetime, broadcast } = await setup({
      decide: () => {
        reviewSeen();
        return reviews++ === 0 ? "wait" : "approve";
      },
    });
    const pending = sendTransfer({ client, fetchLifetime, broadcast }, { from, to: destination, lamports: 1n });
    await seen;
    await watch.wristOff();
    expect(await pending).toMatchObject({ kind: "watch-refused", status: "LOCKED" });

    const locked = await sendTransfer({ client, fetchLifetime, broadcast }, { from, to: destination, lamports: 1n });
    expect(locked).toMatchObject({ kind: "watch-refused", status: "LOCKED" });
    expect(await client.getAddress()).toMatchObject({ status: "LOCKED" });
    expect(await se.verifyPin(PIN)).toEqual({ status: "OK" });
    expect((await sendTransfer({ client, fetchLifetime, broadcast }, { from, to: destination, lamports: 1n })).kind).toBe("confirmed");
  });

  it("three wrong PINs wipe the key; the companion then sees no wallet", async () => {
    const { se, client } = await setup();
    await se.endSession();
    for (const pin of ["0000", "1111", "2222"]) await se.verifyPin(pin);
    expect(await client.getAddress()).toMatchObject({ status: "NO_WALLET" });
  });

  it("a second request while one is on screen is answered BUSY", async () => {
    const { client, watch } = await setup({ decide: () => "wait" });
    const from = address((await client.getAddress())!.address!);
    const first = buildTransfer({ from, to: destination, lamports: 1n, lifetime: fakeLifetime() });
    const next = buildTransfer({ from, to: destination, lamports: 2n, lifetime: fakeLifetime() });
    client.requestSignature({ messageBytes: first.messageBytes, expiresInMs: 30_000, lastValidBlockHeight: 1n });
    await vi.waitFor(() => expect(watch.displayed).toHaveLength(1));
    const second = client.requestSignature({ messageBytes: next.messageBytes, expiresInMs: 30_000, lastValidBlockHeight: 1n });
    expect(await second.result).toMatchObject({ status: "BUSY" });
    watch.dispose();
  });
});

describe("SekundClient", () => {
  it("ignores results for unknown requestIds and settles each request once", async () => {
    const { companion, watch }: { companion: Transport; watch: Transport } = createMemoryTransportPair();
    const client = new SekundClient(companion, { graceMs: 50 });
    const handle = client.requestSignature({ messageBytes: new Uint8Array(10), expiresInMs: 100, lastValidBlockHeight: 1n });
    watch.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "SIGN_TRANSACTION_RESULT", requestId: crypto.randomUUID(), status: "REJECTED", ...demoIdentity("watch") }));
    watch.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "SIGN_TRANSACTION_RESULT", requestId: handle.requestId, status: "REJECTED", ...demoIdentity("watch") }));
    watch.send(JSON.stringify({ version: PROTOCOL_VERSION, type: "SIGN_TRANSACTION_RESULT", requestId: handle.requestId, status: "EXPIRED", ...demoIdentity("watch") }));
    expect(await handle.result).toMatchObject({ status: "REJECTED" });
  });

  it("times out when the watch never answers", async () => {
    const { companion } = createMemoryTransportPair();
    const client = new SekundClient(companion, { graceMs: 10 });
    const handle = client.requestSignature({ messageBytes: new Uint8Array(10), expiresInMs: 10, lastValidBlockHeight: 1n });
    expect(await handle.result).toMatchObject({ status: "TIMEOUT" });
  });
});
