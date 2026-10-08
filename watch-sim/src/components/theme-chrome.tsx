import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { paintDarkDither } from "@/lib/dark-dither";
import { applyTheme, readThemeChoice, storeThemeChoice, type ThemeChoice } from "@/lib/theme";

interface ThemeApi {
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => void;
  dark: boolean;
}

const ThemeContext = createContext<ThemeApi | null>(null);

function useThemeApi(): ThemeApi {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeControl must sit inside ThemeRoot");
  return value;
}

export function ThemeRoot({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>(() => readThemeChoice(localStorage));
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");

  useEffect(() => {
    setDark(applyTheme(choice) === "dark");
    storeThemeChoice(localStorage, choice);
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setDark(applyTheme("system") === "dark");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  return <ThemeContext.Provider value={{ choice, setChoice, dark }}>{children}</ThemeContext.Provider>;
}

export function ThemeControl() {
  const { choice, setChoice } = useThemeApi();
  return (
    <label className="sk-plate flex items-center gap-2 text-14">
      <span className="text-graphite">Theme</span>
      <select
        aria-label="Theme"
        value={choice}
        onChange={(event) => setChoice(event.target.value as ThemeChoice)}
        className="h-11 rounded-sk border border-line bg-paper px-2 text-14 text-ink"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}

/** Full-viewport pixel dither. Present only while the resolved theme is dark. */
export function DarkGround() {
  const { dark } = useThemeApi();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!dark) return;
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => paintDarkDither(canvas);
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [dark]);

  if (!dark) return null;
  return <canvas ref={ref} className="sk-dither" aria-hidden="true" />;
}
