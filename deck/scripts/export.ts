/**
 * Export the deck: one PNG per slide, a contact sheet, the two brand option sheets, and a 16:9 PDF.
 *
 *   pnpm --filter @sekund/deck export                # against http://127.0.0.1:4320
 *   SEKUND_DECK_URL=http://127.0.0.1:4320 OUT=./out pnpm --filter @sekund/deck export
 *
 * Needs a Chromium. Uses the Playwright-managed one when installed
 * (`pnpm --filter @sekund/companion e2e:install`), otherwise the system Google Chrome.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import { SLIDE_IDS } from "../src/deck/slides";

const BASE = (process.env.SEKUND_DECK_URL ?? "http://127.0.0.1:4320").replace(/\/$/, "");
const OUT = resolve(process.env.OUT ?? "out");
const WIDTH = 1920;
const HEIGHT = 1080;

async function launch(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch {
    return await chromium.launch({ channel: "chrome" });
  }
}

/** Fonts, images and the dither canvases must have drawn before a capture. */
async function settle(page: Page, ms = 1600): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const images = Array.from(document.images);
    await Promise.all(images.map((img) => (img.complete ? Promise.resolve() : new Promise((done) => img.addEventListener("load", done, { once: true })))));
  });
  await page.waitForTimeout(ms);
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await context.newPage();

  const written: string[] = [];

  for (const [i, id] of SLIDE_IDS.entries()) {
    const file = resolve(OUT, `${String(i + 1).padStart(2, "0")}-${id}.png`);
    await page.goto(`${BASE}/#${id}`);
    await page.waitForSelector(`[data-slide="${id}"][data-active="true"]`);
    await settle(page);
    await page.screenshot({ path: file, fullPage: false });
    written.push(file);
    console.log("slide", i + 1, id);
  }

  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  for (const [mode, name] of [
    ["sheet", "contact-sheet.png"],
    ["logos", "logo-options.png"],
    ["illustrations", "illustration-options.png"],
  ] as const) {
    await page.goto(`${BASE}/?${mode}`);
    await settle(page);
    const file = resolve(OUT, name);
    await page.screenshot({ path: file, fullPage: true });
    written.push(file);
    console.log(name.replace(".png", ""));
  }

  await page.goto(`${BASE}/?print`);
  await settle(page, 2200);
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({
    width: `${WIDTH}px`,
    height: `${HEIGHT}px`,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  const pdfFile = resolve(OUT, "sekund-pitch-deck.pdf");
  writeFileSync(pdfFile, pdf);
  written.push(pdfFile);
  console.log("pdf", pdf.byteLength, "bytes");

  await browser.close();
  console.log(`\n${written.length} files in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
