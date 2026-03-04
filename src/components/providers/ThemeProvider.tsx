"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: ResolvedTheme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "theme";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize with server-safe defaults to avoid hydration mismatch.
  // The inline <script> in layout.tsx already applies the correct class
  // before React hydrates, so there's no visible flash.
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  // Read the actual stored theme after mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial: Theme =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    const resolved = initial === "system" ? getSystemTheme() : initial;
    setThemeState(initial);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Listen for OS preference changes when in system mode
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    const handler = (e: MediaQueryListEvent) => {
      // Only react if we're in system mode - read from localStorage
      // to avoid stale closure over `theme`
      const current = localStorage.getItem(STORAGE_KEY);
      const isSystem =
        current === "system" || current === null || current === "";
      if (isSystem) {
        const resolved: ResolvedTheme = e.matches ? "dark" : "light";
        setResolvedTheme(resolved);
        applyTheme(resolved);
      }
    };

    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    const resolved = newTheme === "system" ? getSystemTheme() : newTheme;

    localStorage.setItem(STORAGE_KEY, newTheme);
    setThemeState(newTheme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, setTheme, resolvedTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
