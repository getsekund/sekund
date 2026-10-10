import { describe, expect, it } from "vitest";
import { BAYER8, luma, on, threshold, tone } from "@/dither/bayer";

describe("Bayer 8×8", () => {
  it("is a permutation of 0..63", () => {
    expect([...BAYER8].sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i));
  });

  it("thresholds sit strictly inside (0, 1) and tile", () => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const t = threshold(x, y);
        expect(t).toBeGreaterThan(0);
        expect(t).toBeLessThan(1);
        expect(threshold(x + 8, y + 8)).toBe(t);
      }
    }
  });

  it("lights the share of cells the coverage asks for", () => {
    const count = (coverage: number) => {
      let lit = 0;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (on(coverage, x, y)) lit++;
      return lit;
    };
    expect(count(0)).toBe(0);
    expect(count(0.5)).toBe(32);
    expect(count(1)).toBe(64);
  });
});

describe("tone", () => {
  it("keeps values in range and inverts", () => {
    expect(tone(0.5, {})).toBeCloseTo(0.5);
    expect(tone(0.9, { contrast: 3 })).toBe(1);
    expect(tone(0.1, { contrast: 3 })).toBe(0);
    expect(tone(0.25, { invert: true })).toBeCloseTo(0.75);
  });

  it("reads luma from RGB", () => {
    expect(luma(255, 255, 255)).toBeCloseTo(1);
    expect(luma(0, 0, 0)).toBe(0);
    expect(luma(0, 255, 0)).toBeGreaterThan(luma(0, 0, 255));
  });
});
