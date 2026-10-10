import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { appCards, confirmed, RUN } from "../src/capture-run";

const DIR = resolve(import.meta.dirname, "../public/captures");
const TIMES = { signed: 11.3, confirmed: 12.6 };

describe("captures", () => {
  it("lists exactly the shots on disk, so nothing from an earlier run stays behind", () => {
    const files = readdirSync(DIR)
      .filter((name) => name.endsWith(".png"))
      .map((name) => name.slice(0, -4))
      .sort();
    expect(files).toEqual(Object.keys(RUN.shots).sort());
  });

  it("has the phone app past WAITING only from a run devnet confirmed", () => {
    const pastWaiting = Object.keys(RUN.shots).filter((name) => /^companion-(signed|confirmed)/.test(name));
    if (pastWaiting.length === 0) return;
    expect(confirmed(RUN)).toBe(true);
    expect(RUN.transaction?.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]{64,88}$/);
    expect(RUN.transaction?.explorer).toContain(RUN.transaction?.signature);
  });

  it("puts on screen only the cards the run reached", () => {
    const unsent = { shots: { "companion-waiting": "", "companion-signed": "" } };
    expect(appCards(unsent, TIMES)).toEqual([[0, "companion-waiting"]]);
    const sent = {
      transaction: { signature: "s", signer: "a", explorer: "e" },
      shots: { "companion-waiting": "", "companion-confirmed": "", "explorer-rows": "" },
    };
    expect(appCards(sent, TIMES)).toEqual([
      [0, "companion-waiting"],
      [12.6, "companion-confirmed"],
    ]);
    expect(appCards({ ...sent, shots: { ...sent.shots, "companion-signed": "" } }, TIMES).map(([, name]) => name)).toEqual(["companion-waiting", "companion-signed", "companion-confirmed"]);
  });
});
