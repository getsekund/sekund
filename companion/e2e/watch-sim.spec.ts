import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { mockDevnet } from "./support/devnet-mock.ts";
import { verifyBroadcast } from "./support/verify.ts";

/*
 * Full demo path: companion page + relay + watch simulator page, driven through the watch's
 * four buttons (spec sections 6 and 7; DESIGN.md section 5):
 *   A previous / decrease, B next / increase, C back / reject, D select / approve,
 *   C+D confirm a PIN digit, the Secure Mode combination (default A+D, configurable).
 * Keys a/b/c/d press the pushers; chords are held together.
 *
 * Pending until watch-sim/ is on main and talks to the relay and se-sim instead of its stubs.
 */

const WATCH_URL = "http://localhost:4318";
const PIN = process.env.SEKUND_E2E_PIN ?? "1234";
const COMBO = (process.env.SEKUND_E2E_COMBO ?? "a+d").split("+") as Key[];
type Key = "a" | "b" | "c" | "d";

const watchSimDir = join(import.meta.dirname, "../../watch-sim");

function sources(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) ? [readFileSync(path, "utf8")] : [];
  });
}

function watchSimIsWired(): boolean {
  if (!existsSync(join(watchSimDir, "package.json"))) return false;
  const code = sources(join(watchSimDir, "src"));
  return code.some((s) => s.includes("createRelayTransport")) && code.some((s) => s.includes("@sekund/se-sim"));
}

const ready = watchSimIsWired();
test.describe("watch simulator buttons", () => {
  test.fixme(!ready, "watch-sim is not on main yet, or still uses its stub transport and SE instead of the relay and se-sim");

  async function press(page: Page, ...keys: Key[]) {
    for (const key of keys) await page.keyboard.down(key);
    for (const key of [...keys].reverse()) await page.keyboard.up(key);
    await page.waitForTimeout(60);
  }

  async function unlock(watchPage: Page) {
    await watchPage.goto(WATCH_URL);
    await watchPage.locator("body").click();
    await press(watchPage, ...COMBO);
    for (const digit of PIN) {
      for (let i = 0; i < Number(digit); i++) await press(watchPage, "b");
      await press(watchPage, "c", "d");
    }
  }

  async function reviewAll(watchPage: Page) {
    // AMOUNT, TO 1/2, TO 2/2, NETWORK, FEE, then APPROVE? on the last page.
    for (let i = 0; i < 6; i++) await press(watchPage, "b");
  }

  async function setup(page: Page, path = "/") {
    const devnet = await mockDevnet(page);
    const watchPage = await page.context().newPage();
    await unlock(watchPage);
    await page.goto(path);
    const address = page.getByTestId("watch-address");
    await expect(address).toBeVisible({ timeout: 15_000 });
    return { devnet, watchPage, watchAddress: (await address.getAttribute("data-address"))! };
  }

  const card = (page: Page) => page.getByTestId("request-card").first();

  test("combination, PIN, review, approve: verified signature", async ({ page }) => {
    const { devnet, watchPage, watchAddress } = await setup(page);
    await page.getByRole("button", { name: "Send to watch" }).click();
    await expect(card(page)).toHaveAttribute("data-chip", "WAITING");
    await reviewAll(watchPage);
    await press(watchPage, "d");
    await expect(card(page)).toHaveAttribute("data-chip", "CONFIRMED");
    const verified = await verifyBroadcast(devnet.sent[0]!, watchAddress);
    await expect(card(page).getByTestId("signature-row")).toHaveAttribute("data-signature", verified.signature);
  });

  test("reject on the watch: REJECTED, nothing broadcast", async ({ page }) => {
    const { devnet, watchPage } = await setup(page);
    await page.getByRole("button", { name: "Send to watch" }).click();
    await expect(card(page)).toHaveAttribute("data-chip", "WAITING");
    await press(watchPage, "c");
    await expect(card(page)).toHaveAttribute("data-chip", "REJECTED");
    expect(devnet.sent).toHaveLength(0);
  });

  test("countdown runs out: EXPIRED, nothing broadcast", async ({ page }) => {
    const { devnet } = await setup(page, "/?reviewSeconds=3");
    await page.getByRole("button", { name: "Send to watch" }).click();
    await expect(card(page)).toHaveAttribute("data-chip", "WAITING");
    await expect(card(page)).toHaveAttribute("data-chip", "EXPIRED", { timeout: 10_000 });
    expect(devnet.sent).toHaveLength(0);
  });
});
