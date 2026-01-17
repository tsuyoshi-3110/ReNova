"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";
type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<Ctx | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // 初期状態は layout の <script> ですでに反映済みだが、
  // ここで state と同期させる（UI表示用）
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      const t: Theme =
        saved === "dark" || saved === "light"
          ? (saved as Theme)
          : window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

      setThemeState(t);
      applyTheme(t);
    } catch {
      // ignore
    }
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
