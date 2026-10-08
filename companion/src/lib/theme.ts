export const THEME_KEY = "sekund-theme";

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): ResolvedTheme {
  if (choice === "dark") return "dark";
  if (choice === "light") return "light";
  return systemDark ? "dark" : "light";
}

export function parseThemeChoice(value: string | null): ThemeChoice {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

export function readThemeChoice(storage: Pick<Storage, "getItem">): ThemeChoice {
  try {
    return parseThemeChoice(storage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

export function systemIsDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Sets data-theme on the document. Light adds no color rules of its own. */
export function applyTheme(choice: ThemeChoice): ResolvedTheme {
  const resolved = resolveTheme(choice, systemIsDark());
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeChoice = choice;
  return resolved;
}

export function storeThemeChoice(storage: Pick<Storage, "setItem">, choice: ThemeChoice): void {
  try {
    storage.setItem(THEME_KEY, choice);
  } catch {
    /* private mode */
  }
}
