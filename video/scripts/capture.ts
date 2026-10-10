/**
 * Real captures for the pitch video: the watch simulator and the phone app (the companion), driven
 * through the actual approve flow over the local relay, broadcast to devnet, confirmed, and read
 * back from Solana Explorer. Everything lands in video/public/captures/.
 *
 *   pnpm dev                                  # relay 4319, companion 4317, watch simulator 4318
 *   pnpm --filter @sekund/video capture
 *   pnpm --filter @sekund/video capture --explorer <signature>   # only Explorer, again
 *
 * The simulator generates a fresh key in its simulated secure element. Its address is funded from
 * the devnet-only funder wallet the proof script uses (companion/scripts/devnet-funder.ts: a plain
 * software key that pays for tests and never signs the SEKUND transfer). The companion then builds
 * 0.01 SOL to the proof destination, the simulator reviews and signs it, and the companion
 * verifies, broadcasts and confirms it. Nothing is mocked. The transfer is read back with
 * getTransaction before anything is written, and Explorer is captured once it says Finalized.
 *
 * Explorer sits behind Vercel's bot check, which turns headless Chrome away; it is opened in a
 * headed window, so this needs a display (DISPLAY).
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Locator, type Page } from "@playwright/test";
import { address, signature as toSignature } from "@solana/kit";
import { fundFrom, loadFunder } from "../../companion/scripts/devnet-funder.ts";
import { createDevnetRpc, explorerTxUrl, getBalance } from "../../companion/src/lib/solana.ts";

const { values } = parseArgs({ options: { explorer: { type: "string" }, out: { type: "string" } } });
const OUT = resolve(values.out ?? resolve(import.meta.dirname, "../public/captures"));
const ROOM = `sekund-video-${Date.now().toString(36)}`;
const WATCH_URL = `http://127.0.0.1:4318/?room=${ROOM}&view=${process.env.SEKUND_VIEW ?? "3d"}`;
const COMPANION_URL = `http://127.0.0.1:4317/?room=${ROOM}`;
const PIN = "1234";
const DESTINATION = "5awdRY3zVWWNZXmHH955bDxdUoZ7aFqjKKaCeCeBuAbg";
const AMOUNT = "0.01";
const LAMPORTS = 10_000_000n;
/** The transfer, the fee, and enough left over that the simulator's account stays rent-exempt. */
const FUNDING = 20_000_000n;
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
/** The rows the deck's proof slide shows, in Explorer's own words. */
const EXPLORER_ROWS = ["Status", "Confirmation", "Signature", "Fee payer", "Slot", "Timestamp (UTC)"];
/** The deck's Explorer frame on the proof slide, 1267 × 454; the capture keeps its shape. */
const EXPLORER_ASPECT = 1267 / 454;

type Key = "a" | "b" | "c" | "d";

async function press(page: Page, ...keys: Key[]): Promise<void> {
  for (const key of keys) await page.keyboard.down(key);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
  await page.waitForTimeout(80);
}

async function enterPin(watch: Page): Promise<void> {
  for (const digit of PIN) {
    for (let i = 0; i < Number(digit); i++) await press(watch, "b");
    await press(watch, "c", "d");
  }
}

/**
 * The dev companion mounts twice under StrictMode. When the first socket is still being seated
 * by the relay as the second arrives, the second is refused as a duplicate companion and stays
 * off. A reload gets a fresh session and usually wins the race.
 */
async function openCompanion(companion: Page): Promise<void> {
  for (let attempt = 1; attempt <= 6; attempt++) {
    await (attempt === 1 ? companion.goto(COMPANION_URL) : companion.reload());
    try {
      await companion.getByTestId("watch-address").waitFor({ timeout: 8_000 });
      return;
    } catch {
      console.log(`companion not seated, reload ${attempt}`);
    }
  }
  throw new Error("companion never connected to the watch through the relay");
}

const shots: Record<string, string> = {};

async function shot(name: string, target: Locator | Page, note: string): Promise<void> {
  const file = resolve(OUT, `${name}.png`);
  await target.screenshot({ path: file, animations: "disabled" });
  shots[name] = note;
  console.log("capture", name);
}

async function chip(companion: Page, word: string, timeout = 15_000): Promise<void> {
  await companion.waitForFunction((w) => document.querySelector('[data-testid="request-card"]')?.getAttribute("data-chip") === w, word, { timeout });
}

/** Explorer's summary for the transfer, cut to the deck's rows and the deck's frame. */
async function captureExplorer(signature: string): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: !process.env.DISPLAY,
    args: ["--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  });
  const page = await browser.newPage({ viewport: { width: 1180, height: 1000 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await page.goto(explorerTxUrl(signature), { waitUntil: "domcontentloaded" });
  // The summary is a section headed "Summary" whose card holds one label/value row per field.
  const summary = (hide: readonly string[] | null) =>
    page.evaluate((keep) => {
      const section = [...document.querySelectorAll("section")].find((s) => s.querySelector("h2")?.textContent?.trim() === "Summary");
      const rows: Record<string, string> = {};
      for (const row of section?.children[1]?.children ?? []) {
        const label = row.children[0]?.textContent?.trim() ?? "";
        rows[label] = row.children[1]?.textContent?.replace(/\s+/g, "") ?? "";
        if (keep && !keep.includes(label)) (row as HTMLElement).style.display = "none";
      }
      return rows;
    }, hide);
  for (let i = 0; ; i++) {
    await page.getByText("Confirmation", { exact: true }).first().waitFor({ timeout: 45_000 });
    if ((await summary(null))["Confirmation"]?.startsWith("Finalized")) break;
    if (i >= 12) throw new Error("Explorer never showed the transfer as finalized");
    await page.waitForTimeout(5_000);
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  const rows = await summary(EXPLORER_ROWS);
  if (rows["Status"] !== "Success" || rows["Signature"] !== signature) throw new Error(`Explorer shows ${JSON.stringify(rows)}`);
  const box = await page.locator("section", { has: page.locator("h2", { hasText: /^Summary$/ }) }).first().boundingBox();
  if (!box) throw new Error("Explorer summary not on the page");
  const pad = 14;
  const width = box.width + 2 * pad;
  await page.screenshot({ path: resolve(OUT, "explorer-rows.png"), clip: { x: box.x - pad, y: box.y - pad, width, height: width / EXPLORER_ASPECT } });
  shots["explorer-rows"] = "Solana Explorer, devnet: the summary of this run's transfer, finalized";
  console.log("capture explorer-rows");
  await browser.close();
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const rpc = createDevnetRpc();
  const { signer: funder } = await loadFunder();
  const funds = await getBalance(rpc, funder.address);
  if (funds < FUNDING + 10_000n) {
    throw new Error(`the funder ${funder.address} has ${funds} lamports; fund it on devnet (faucet.solana.com) and run again`);
  }
  // A shot this run cannot take must not survive from an earlier one.
  for (const name of readdirSync(OUT)) if (name.endsWith(".png")) rmSync(resolve(OUT, name));

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: "dark" });

  const watch = await context.newPage();
  await watch.goto(WATCH_URL);
  await watch.locator("body").click({ position: { x: 5, y: 5 } });
  const hint = watch.getByTestId("step-hint");
  await hint.waitFor();
  await watch.waitForTimeout(4000);
  const bench = watch.locator(".sk-bench").first();
  await shot("watch-clock", bench, "Normal mode: the clock");

  await press(watch, "a", "d");
  await watch.waitForTimeout(1100);
  await shot("watch-pin", bench, "Secure Mode: NEW PIN entry");
  await enterPin(watch);
  await enterPin(watch);
  await watch.waitForTimeout(600);
  await shot("watch-menu", bench, "Secure Mode menu after the PIN");

  const companion = await context.newPage();
  await openCompanion(companion);
  const watchAddress = address((await companion.getByTestId("watch-address").getAttribute("data-address"))!);
  const funding = await fundFrom(rpc, funder, watchAddress, FUNDING);
  console.log("funded", watchAddress, "from", funder.address, funding);
  await companion.getByRole("button", { name: "Refresh" }).click();
  await companion.getByText(/^0\.02 SOL$/).waitFor({ timeout: 20_000 });
  await companion.waitForTimeout(500);
  await shot("companion-ready", companion, "Companion connected to the simulator, its address funded");

  await watch.bringToFront();
  await shot("watch-address", watch.getByText("Address", { exact: true }).first().locator(".."), "The simulator's own address, from its secure element");

  await companion.bringToFront();
  await companion.locator("#to").fill(DESTINATION);
  await companion.locator("#amount").fill(AMOUNT);
  await companion.getByRole("button", { name: "Send to watch" }).click();
  const card = companion.getByTestId("request-card").first();
  await card.waitFor();
  await chip(companion, "WAITING");
  await companion.waitForTimeout(500);
  await shot("companion-waiting", card, "Companion: request sent, waiting for the watch");
  await shot("companion-waiting-page", companion, "Companion page while waiting");

  await watch.bringToFront();
  await watch.waitForTimeout(700);
  const pages = ["amount", "to-1", "to-2", "network", "fee", "approve"];
  for (const [i, name] of pages.entries()) {
    if (i > 0) await press(watch, "b");
    await watch.waitForTimeout(450);
    await shot(`watch-review-${name}`, bench, `Review page ${i + 1}: ${name}`);
  }
  await watch.waitForTimeout(1000);
  await shot("watch-review-approve-2", bench, "APPROVE? one second later, the countdown running");

  await watch.keyboard.down("d");
  await watch.waitForTimeout(120);
  await shot("watch-press-d", bench, "D held down on APPROVE?");
  await watch.keyboard.up("d");
  await watch.waitForTimeout(500);
  await shot("watch-signed", bench, "Result after approve");

  await companion.bringToFront();
  // Broadcasting and confirming take a second or two on devnet; the shot is taken if it is caught.
  try {
    await chip(companion, "SIGNED", 5_000);
    await shot("companion-signed", card, "Companion: signature back from the watch, verified, going to devnet");
  } catch {
    console.log("SIGNED passed before it could be captured");
  }
  await chip(companion, "CONFIRMED", 90_000);
  await companion.waitForTimeout(300);
  await shot("companion-confirmed", card, "Companion: verified, broadcast and confirmed on devnet");
  await shot("companion-confirmed-page", companion, "Companion page after confirmation");
  const sig = (await companion.getByTestId("signature-row").first().getAttribute("data-signature"))!;
  await browser.close();

  const tx = await rpc.getTransaction(toSignature(sig), { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }).send();
  if (!tx || tx.meta?.err) throw new Error(`devnet does not show ${sig} as a successful transaction`);
  const keys = tx.transaction.message.accountKeys;
  const transfer = tx.transaction.message.instructions[0] as { parsed?: { type: string; info: { source: string; destination: string; lamports: number | bigint } } };
  const info = transfer.parsed?.info;
  if (keys[0]?.pubkey !== watchAddress || !keys[0]?.signer || keys.filter((k) => k.signer).length !== 1) throw new Error("the transfer's only signer is not the simulator");
  if (transfer.parsed?.type !== "transfer" || info?.source !== watchAddress || info.destination !== DESTINATION || BigInt(info.lamports) !== LAMPORTS) {
    throw new Error(`unexpected instruction ${JSON.stringify(transfer, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`);
  }
  const transaction = {
    signature: sig,
    signer: watchAddress,
    destination: DESTINATION,
    amountSol: AMOUNT,
    slot: Number(tx.slot),
    blockTimeUtc: tx.blockTime ? new Date(Number(tx.blockTime) * 1000).toISOString() : null,
    cluster: "devnet",
    explorer: explorerTxUrl(sig),
    fundedBy: { funder: funder.address, signature: funding },
  };
  console.log("confirmed", transaction);

  await captureExplorer(sig);
  writeFileSync(
    resolve(OUT, "captures.json"),
    `${JSON.stringify({ capturedAt: new Date().toISOString(), room: ROOM, watch: WATCH_URL, companion: COMPANION_URL, transaction, shots }, null, 2)}\n`,
  );
}

if (values.explorer) await captureExplorer(values.explorer);
else await main();
