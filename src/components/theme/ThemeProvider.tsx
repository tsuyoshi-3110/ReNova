// src/components/theme/ThemeProvider.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "renova_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  // 初期化：localStorage or OS設定
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === "light" || stored === "dark") {
        setTheme(stored);
        return;
      }
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      setTheme(mql.matches ? "dark" : "light");
    } catch {
      setTheme("light");
    }
  }, []);

  // <html> に dark クラスを付け外し
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement; // <html>

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // 失敗しても致命的ではないので無視
    }
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((prev) => (prev === "dark" ? "light" : "dark")),
    []
  );

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return ctx;
}
