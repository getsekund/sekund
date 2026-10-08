import { expect, test, type Page } from "@playwright/test";
import { DEMO_RECIPIENT } from "../src/components/transfer-form.tsx";
import { connectHeadlessWatch, type E2eWatch } from "./support/headless-watch.ts";
import { mockDevnet } from "./support/devnet-mock.ts";
import { verifyBroadcast } from "./support/verify.ts";

/*
 * Companion page + real relay + headless watch (same RequestGuard and simulated SE as the
 * product path, buttons scripted). Devnet RPC is mocked in the page; the broadcast transaction
 * is verified here independently. The same flows with the simulator's real buttons are in
 * watch-sim.spec.ts.
 */

let watch: E2eWatch | null = null;
test.afterEach(() => {
  watch?.close();
  watch = null;
});

const latestCard = (page: Page) => page.getByTestId("request-card").first();

async function openWithWatch(page: Page, path = "/?room=sekund-demo") {
  const devnet = await mockDevnet(page);
  watch = await connectHeadlessWatch();
  const url = path.includes("room=") ? path : `${path}${path.includes("?") ? "&" : "?"}room=sekund-demo`;
  await page.goto(url);
  await expect(page.getByTestId("watch-address")).toHaveAttribute("data-address", watch.address);
  return devnet;
}

test("watch not connected: NO WATCH, send disabled with a reason, empty request list", async ({ page }) => {
  await mockDevnet(page);
  await page.goto("/?room=sekund-demo");
  await expect(page.getByTestId("no-watch")).toBeVisible();
  await expect(page.locator('header [data-chip="NO WATCH"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Send to watch" })).toBeDisabled();
  await expect(page.getByTestId("send-reason")).toHaveText("No watch connected. Open the watch simulator.");
  await expect(page.getByTestId("requests-empty")).toBeVisible();

  watch = await connectHeadlessWatch();
  await expect(page.locator('header [data-chip="CONNECTED"]')).toBeVisible();
  await expect(page.getByTestId("watch-address")).toHaveAttribute("data-address", watch.address);
  await expect(page.getByLabel("To")).toHaveValue(DEMO_RECIPIENT);
  await expect(page.getByLabel("Amount (SOL)")).toHaveValue("0.01");
  await expect(page.getByRole("button", { name: "Send to watch" })).toBeEnabled();
});

test("approve: WAITING with countdown, then CONFIRMED with a verified signature and explorer link", async ({ page }) => {
  const devnet = await openWithWatch(page);
  watch!.decide("hold");

  await page.getByRole("button", { name: "Send to watch" }).click();
  await expect(latestCard(page)).toHaveAttribute("data-chip", "WAITING");
  await expect(page.getByTestId("countdown")).toHaveText(/^0:[0-5]\d$/);
  await expect(page.getByRole("button", { name: "Send to watch" })).toBeDisabled();
  expect(watch!.reviews).toHaveLength(1);
  expect(watch!.reviews[0]!.transfer).toMatchObject({ to: DEMO_RECIPIENT, lamports: 10_000_000n });

  watch!.press("approve");
  await expect(latestCard(page)).toHaveAttribute("data-chip", "CONFIRMED");
  await expect(latestCard(page)).toContainText("Confirmed on devnet.");

  expect(devnet.sent).toHaveLength(1);
  const verified = await verifyBroadcast(devnet.sent[0]!, watch!.address);
  expect(verified).toMatchObject({ to: DEMO_RECIPIENT, lamports: 10_000_000n });
  await expect(latestCard(page).getByTestId("signature-row")).toHaveAttribute("data-signature", verified.signature);
  await expect(latestCard(page).getByTestId("explorer-link")).toHaveAttribute("href", `https://explorer.solana.com/tx/${verified.signature}?cluster=devnet`);
});

test("reject: REJECTED, nothing broadcast, Send again makes a new request", async ({ page }) => {
  const devnet = await openWithWatch(page);
  watch!.decide("reject", "approve");
  await page.getByLabel("Demo amounts").getByRole("button", { name: "0.05" }).click();
  await page.getByRole("button", { name: "Send to watch" }).click();

  await expect(latestCard(page)).toHaveAttribute("data-chip", "REJECTED");
  await expect(latestCard(page)).toContainText("Rejected on the watch. Nothing was signed.");
  await expect(latestCard(page).getByTestId("signature-row")).toHaveCount(0);
  expect(devnet.sent).toHaveLength(0);

  await latestCard(page).getByRole("button", { name: "Send again" }).click();
  await expect(latestCard(page)).toHaveAttribute("data-chip", "CONFIRMED");
  expect(watch!.reviews).toHaveLength(2);
  expect(watch!.reviews[1]!.request.requestId).not.toBe(watch!.reviews[0]!.request.requestId);
  expect(watch!.reviews[1]!.transfer.lamports).toBe(50_000_000n);
  await verifyBroadcast(devnet.sent[0]!, watch!.address);
});

test("expire: countdown runs out, EXPIRED with no signature, Send again uses a new blockhash", async ({ page }) => {
  const devnet = await openWithWatch(page, "/?reviewSeconds=3");
  watch!.decide("hold");
  await page.getByRole("button", { name: "Send to watch" }).click();
  await expect(latestCard(page)).toHaveAttribute("data-chip", "WAITING");
  await expect(page.getByTestId("countdown")).toHaveText(/^0:0[0-3]$/);

  await expect(latestCard(page)).toHaveAttribute("data-chip", "EXPIRED", { timeout: 10_000 });
  await expect(latestCard(page).getByTestId("signature-row")).toHaveCount(0);
  expect(devnet.sent).toHaveLength(0);
  watch!.press("approve");

  watch!.decide("approve");
  await latestCard(page).getByRole("button", { name: "Send again" }).click();
  await expect(latestCard(page)).toHaveAttribute("data-chip", "CONFIRMED");
  expect(watch!.reviews).toHaveLength(2);
  expect(watch!.reviews[1]!.transfer.recentBlockhash).not.toBe(watch!.reviews[0]!.transfer.recentBlockhash);
  await verifyBroadcast(devnet.sent[0]!, watch!.address);
  await expect(page.getByTestId("request-card")).toHaveCount(2);
});

test("error: devnet down shows FAILED with cause, fix and Retry", async ({ page }) => {
  watch = await connectHeadlessWatch();
  await page.route("https://api.devnet.solana.com/**", (route) => route.abort("connectionrefused"));
  await page.goto("/?room=sekund-demo");
  await expect(page.getByTestId("watch-address")).toHaveAttribute("data-address", watch.address);
  await page.getByRole("button", { name: "Send to watch" }).click();
  await expect(latestCard(page)).toHaveAttribute("data-chip", "FAILED");
  await expect(latestCard(page).getByRole("alert")).toContainText("Check the connection and press Retry.");
  await expect(latestCard(page).getByRole("button", { name: "Retry" })).toBeVisible();
  expect(watch.reviews).toHaveLength(0);
});
