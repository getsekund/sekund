import { describe, expect, it } from "vitest";
import { clampIndex, hashFor, indexFromHash, modeFrom } from "@/deck/route";

const ids = ["claim", "problem", "proof"];

describe("slide hash", () => {
  it("opens the first slide for an empty or unknown hash", () => {
    expect(indexFromHash("", ids)).toBe(0);
    expect(indexFromHash("#", ids)).toBe(0);
    expect(indexFromHash("#nope", ids)).toBe(0);
    expect(indexFromHash("#99", ids)).toBe(0);
    expect(indexFromHash("#0", ids)).toBe(0);
  });

  it("resolves ids and one-based numbers, with or without a leading slash", () => {
    expect(indexFromHash("#proof", ids)).toBe(2);
    expect(indexFromHash("#/problem", ids)).toBe(1);
    expect(indexFromHash("#PROOF", ids)).toBe(2);
    expect(indexFromHash("#2", ids)).toBe(1);
    expect(indexFromHash("#3", ids)).toBe(2);
  });

  it("writes the id, clamped to the deck", () => {
    expect(hashFor(1, ids)).toBe("#problem");
    expect(hashFor(-4, ids)).toBe("#claim");
    expect(hashFor(40, ids)).toBe("#proof");
  });

  it("clamps indexes", () => {
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(3, 3)).toBe(2);
    expect(clampIndex(1, 0)).toBe(0);
  });
});

describe("mode", () => {
  it("picks the view from the query string", () => {
    expect(modeFrom("")).toBe("show");
    expect(modeFrom("?notes")).toBe("notes");
    expect(modeFrom("?print")).toBe("print");
    expect(modeFrom("?sheet=1")).toBe("sheet");
    expect(modeFrom("?logos")).toBe("logos");
    expect(modeFrom("?illustrations")).toBe("illustrations");
    expect(modeFrom("?other")).toBe("show");
  });
});
