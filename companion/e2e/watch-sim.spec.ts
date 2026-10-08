import { expect, test, type Page } from "@playwright/test";
import { mockDevnet } from "./support/devnet-mock.ts";
import { verifyBroadcast } from "./support/verify.ts";

/*
 * Full demo path: companion + relay + watch simulator, driven through the watch buttons
 * (spec sections 6 and 7): combination, PIN (NEW PIN then REPEAT PIN on first use),
 * review pages, APPROVE / REJECT. Keys a/b/c/d press the pushers; chords are held together.
 */

// The 2D fallback by default; SEKUND_E2E_VIEW=3d runs the same path on the 3D watch.
const WATCH_URL = `http://localhost:4318/?room=sekund-demo&view=${process.env.SEKUND_E2E_VIEW ?? "2d"}`;
const PIN = process.env.SEKUND_E2E_PIN ?? "1234";
const COMBO = (process.env.SEKUND_E2E_COMBO ?? "a+d").split("+") as Key[];
type Key = "a" | "b" | "c" | "d";

test.describe("watch simulator buttons", () => {
  async function press(page: Page, ...keys: Key[]) {
    for (const key of keys) await page.keyboard.down(key);
    for (const key of [...keys].reverse()) await page.keyboard.up(key);
    await page.waitForTimeout(60);
  }

  async function enterPin(watchPage: Page, pin: string) {
    for (const digit of pin) {
      for (let i = 0; i < Number(digit); i++) await press(watchPage, "b");
      await press(watchPage, "c", "d");
    }
  }

  async function unlock(watchPage: Page) {
    await watchPage.goto(WATCH_URL);
    await watchPage.locator("body").click();
    const hint = watchPage.getByTestId("step-hint");
    await expect(hint).toHaveText("Hold upper left (A) and lower right (D) together to enter Secure.");
    await press(watchPage, ...COMBO);
    await watchPage.waitForTimeout(1100);
    await expect(hint).toHaveText(
      "Choose digit 1 of 4. It is 0. Upper left (A) lowers it. Lower left (B) raises it. Hold both right buttons (C and D) to lock it.",
    );
    await expect(watchPage.getByTestId("pin-readout")).toContainText("0  _  _  _");
    await enterPin(watchPage, PIN);
    // First use: REPEAT PIN
    await enterPin(watchPage, PIN);
    await watchPage.waitForTimeout(400);
  }

  async function reviewAll(watchPage: Page) {
    for (let i = 0; i < 6; i++) await press(watchPage, "b");
  }

  async function setup(page: Page, path = "/?room=sekund-demo") {
    const devnet = await mockDevnet(page);
    const watchPage = await page.context().newPage();
    await unlock(watchPage);
    await page.goto(path);
    const address = page.getByTestId("watch-address");
    await expect(address).toBeVisible({ timeout: 20_000 });
    return { devnet, watchPage, watchAddress: (await address.getAttribute("data-address"))! };
  }

  const card = (page: Page) => page.getByTestId("request-card").first();

  test("combination, PIN, review, approve: verified signature", async ({ page }) => {
    const { devnet, watchPage, watchAddress } = await setup(page);
    await page.getByRole("button", { name: "Send to watch" }).click();
    await expect(card(page)).toHaveAttribute("data-chip", "WAITING");
    await reviewAll(watchPage);
    await expect(watchPage.getByTestId("step-hint")).toHaveText("Upper right (C) rejects. Lower right (D) approves.");
    await press(watchPage, "d");
    await expect(card(page)).toHaveAttribute("data-chip", "CONFIRMED", { timeout: 20_000 });
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
    const { devnet } = await setup(page, "/?room=sekund-demo&reviewSeconds=3");
    await page.getByRole("button", { name: "Send to watch" }).click();
    await expect(card(page)).toHaveAttribute("data-chip", "WAITING");
    await expect(card(page)).toHaveAttribute("data-chip", "EXPIRED", { timeout: 10_000 });
    expect(devnet.sent).toHaveLength(0);
  });
});
