import type { Page } from "@playwright/test";
import { getBase58Decoder, getBase64Encoder, getTransactionDecoder } from "@solana/kit";
import { randomBytes, toBase58 } from "@sekund/protocol";

export interface DevnetMock {
  /** Base64 wire transactions the page broadcast with sendTransaction. */
  readonly sent: string[];
}

/**
 * Answers the companion's devnet JSON-RPC calls inside the browser, so the e2e run does not
 * depend on the public faucet or network. Signature checks happen in the test, not here.
 */
export async function mockDevnet(page: Page, options: { balanceLamports?: bigint } = {}): Promise<DevnetMock> {
  const sent: string[] = [];
  const balance = Number(options.balanceLamports ?? 2_000_000_000n);
  await page.route("https://api.devnet.solana.com/**", async (route) => {
    const body = route.request().postDataJSON() as { id: string | number; method: string; params?: unknown[] };
    const context = { slot: 1_000 };
    let result: unknown;
    switch (body.method) {
      case "getLatestBlockhash":
        result = { context, value: { blockhash: toBase58(randomBytes(32)), lastValidBlockHeight: 1_150 } };
        break;
      case "getBalance":
        result = { context, value: balance };
        break;
      case "getBlockHeight":
        result = 1_000;
        break;
      case "sendTransaction": {
        const wire = (body.params as [string])[0];
        sent.push(wire);
        const tx = getTransactionDecoder().decode(getBase64Encoder().encode(wire));
        const first = Object.values(tx.signatures)[0]!;
        result = getBase58Decoder().decode(first!);
        break;
      }
      case "getSignatureStatuses":
        result = { context, value: (body.params as [string[]])[0].map(() => ({ slot: 1_001, confirmations: null, err: null, confirmationStatus: "confirmed" })) };
        break;
      default:
        return route.fulfill({ json: { jsonrpc: "2.0", id: body.id, error: { code: -32601, message: `not mocked: ${body.method}` } } });
    }
    await route.fulfill({ json: { jsonrpc: "2.0", id: body.id, result } });
  });
  return { sent };
}
