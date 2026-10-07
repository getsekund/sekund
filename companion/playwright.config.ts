import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const hasWatchSim = existsSync(new URL("../watch-sim/package.json", import.meta.url));
const reuse = !process.env.CI;

export default defineConfig({
  testDir: "e2e",
  // One relay, one watch role: specs must not overlap.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://127.0.0.1:4317",
    trace: "retain-on-failure",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "pnpm relay", cwd: root, port: 4319, reuseExistingServer: reuse, timeout: 30_000 },
    { command: "pnpm dev:companion", cwd: root, url: "http://127.0.0.1:4317", reuseExistingServer: reuse, timeout: 60_000 },
    ...(hasWatchSim ? [{ command: "pnpm dev:watch", cwd: root, url: "http://127.0.0.1:4318", reuseExistingServer: reuse, timeout: 60_000 }] : []),
  ],
});
