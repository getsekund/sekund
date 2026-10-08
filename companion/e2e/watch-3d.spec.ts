import { expect, test } from "@playwright/test";

/*
 * The 3D watch: the WebGL canvas mounts with the live LCD on its face, and a mouse click
 * on a pusher of the model (a raycast on the canvas, not a DOM button) drives the watch.
 */

const WATCH_URL = "http://localhost:4318/?room=sekund-3d&view=3d";

test("3D canvas mounts and clicking a 3D pusher changes the PIN digit", async ({ page }) => {
  await page.goto(WATCH_URL);
  const watch = page.getByTestId("watch-3d");
  await expect(watch).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  await expect(watch.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("face-3d")).toBeVisible();

  const hint = page.getByTestId("step-hint");
  await expect(hint).toHaveText("Hold upper left (A) and lower right (D) together to enter Secure.");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.down("a");
  await page.keyboard.down("d");
  await page.keyboard.up("d");
  await page.keyboard.up("a");
  const readout = page.getByTestId("pin-readout");
  await expect(readout).toContainText("0  _  _  _");

  async function clickPusher(id: "A" | "B" | "C" | "D") {
    const spot = await page.locator(`[data-button="${id}"]`).boundingBox();
    if (!spot) throw new Error(`pusher ${id} has no box`);
    const x = spot.x + spot.width / 2;
    const y = spot.y + spot.height / 2;
    // The point must land on the WebGL canvas, so the press comes from the 3D model.
    expect(await page.evaluate(([px, py]) => document.elementFromPoint(px!, py!)?.tagName, [x, y])).toBe("CANVAS");
    await page.mouse.click(x, y);
  }

  await clickPusher("B");
  await expect(readout).toContainText("1  _  _  _");
  await clickPusher("B");
  await expect(readout).toContainText("2  _  _  _");
  await clickPusher("A");
  await expect(readout).toContainText("1  _  _  _");
});
