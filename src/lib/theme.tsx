import { useEffect, useState, type ReactNode } from "react";

export const themeBootScript = `(function(){try{localStorage.setItem('ledger-theme','dark');document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}catch(e){document.documentElement.classList.add('dark');}})();`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    localStorage.setItem("ledger-theme", "dark");
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  }, []);

  return children;
}

export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
