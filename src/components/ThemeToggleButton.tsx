"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/theme-provider";

export default function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50
                 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
      aria-label="toggle dark mode"
    >
      {theme === "dark" ? (
        <>
          <Sun className="h-4 w-4" />
          Light
        </>
      ) : (
        <>
          <Moon className="h-4 w-4" />
          Dark
        </>
      )}
    </button>
  );
}
