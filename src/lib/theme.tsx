import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Mode = "dark" | "light";

const ThemeContext = createContext<{ mode: Mode; toggle: () => void }>({
  mode: "dark",
  toggle: () => {},
});

export const themeBootScript = `(function(){try{var m=localStorage.getItem('ledger-theme');if(!m){m=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.classList.toggle('dark',m!=='light');document.documentElement.style.colorScheme=m;}catch(e){document.documentElement.classList.add('dark');}})();`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("ledger-theme") as Mode | null;
    const initial: Mode =
      stored ?? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    setMode(initial);
    document.documentElement.classList.toggle("dark", initial !== "light");
    document.documentElement.style.colorScheme = initial;
  }, []);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next: Mode = prev === "dark" ? "light" : "dark";
      localStorage.setItem("ledger-theme", next);
      withSmoothSwitch(() => document.documentElement.classList.toggle("dark", next !== "light"));
      document.documentElement.style.colorScheme = next;
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ mode, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

// Fades the colours for a moment while the theme flips, so the change is smooth instead of a hard flash.
function withSmoothSwitch(apply: () => void) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  apply();
  window.setTimeout(() => root.classList.remove("theme-switching"), 450);
}
