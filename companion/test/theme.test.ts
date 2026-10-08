import { describe, expect, it } from "vitest";
import { parseThemeChoice, resolveTheme } from "../src/lib/theme.ts";

describe("theme choice", () => {
  it("follows the system unless the person picked light or dark", () => {
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("treats a missing or unknown stored value as system", () => {
    expect(parseThemeChoice(null)).toBe("system");
    expect(parseThemeChoice("")).toBe("system");
    expect(parseThemeChoice("neon")).toBe("system");
    expect(parseThemeChoice("dark")).toBe("dark");
  });
});
