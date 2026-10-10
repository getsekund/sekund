/**
 * Real captures for the pitch video: the watch simulator and the companion, driven through the
 * actual approve flow over the local relay, written to video/public/captures/.
 *
 *   pnpm dev                                  # relay 4319, companion 4317, watch simulator 4318
 *   pnpm --filter @sekund/video capture
 *
 * The companion builds a real devnet transfer (a fresh devnet blockhash, 0.01 SOL to the proof
 * destination) and the watch simulator reviews and signs it; the companion verifies the
 * signature. Two RPC calls are held back, and nothing else is touched:
 * - getBalance answers "unknown", so the form does not stop on an unfunded simulator address
 *   (the devnet faucet is rate-limited). The balance is not in any capture.
 * - sendTransaction is held and then dropped, so this run is never broadcast. The on-chain proof
 *   in the video is the 8 Oct 2026 transaction on the deck's proof slide, not this run.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Locator, type Page, type Route } from "@playwright/test";

const OUT = resolve(import.meta.dirname, "../public/captures");
const ROOM = `sekund-video-${Date.now().toString(36)}`;
const WATCH_URL = `http://127.0.0.1:4318/?room=${ROOM}&view=${process.env.SEKUND_VIEW ?? "3d"}`;
const COMPANION_URL = `http://127.0.0.1:4317/?room=${ROOM}`;
const PIN = "1234";
const DESTINATION = "5awdRY3zVWWNZXmHH955bDxdUoZ7aFqjKKaCeCeBuAbg";
const AMOUNT = "0.01";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

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

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
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
  let release: (() => void) | null = null;
  await companion.route("https://api.devnet.solana.com/**", async (route: Route) => {
    const body = route.request().postDataJSON() as { id: string | number; method: string };
    if (body.method === "getBalance") {
      return route.fulfill({ json: { jsonrpc: "2.0", id: body.id, error: { code: -32000, message: "balance not read in this capture" } } });
    }
    if (body.method === "sendTransaction") {
      await new Promise<void>((done) => (release = done));
      return route.abort();
    }
    return route.continue();
  });
  await openCompanion(companion);
  await companion.waitForTimeout(800);
  await shot("companion-ready", companion, "Companion connected to the simulator");

  const to = companion.locator("#to");
  await to.fill(DESTINATION);
  const amount = companion.locator("#amount");
  await amount.fill(AMOUNT);
  await companion.getByRole("button", { name: "Send to watch" }).click();
  const card = companion.getByTestId("request-card").first();
  await card.waitFor();
  await companion.waitForFunction(() => document.querySelector('[data-testid="request-card"]')?.getAttribute("data-chip") === "WAITING");
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
  await companion.waitForFunction(() => document.querySelector('[data-testid="request-card"]')?.getAttribute("data-chip") === "SIGNED", undefined, { timeout: 15_000 });
  await companion.waitForTimeout(300);
  await shot("companion-signed", card, "Companion: signature back from the watch, verified");
  await shot("companion-signed-page", companion, "Companion page after the signature");

  release?.();
  writeFileSync(resolve(OUT, "captures.json"), `${JSON.stringify({ capturedAt: new Date().toISOString(), room: ROOM, watch: WATCH_URL, companion: COMPANION_URL, shots }, null, 2)}\n`);
  await browser.close();
}

await main();
