/**
 * Micro design reminder: system is the default; theme preference alters contrast
 * only, never financial meaning or business-data persistence semantics.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";
type ThemePreference = Theme | "system";

interface ThemeContextType {
  theme: Theme;
  preference: ThemePreference;
  toggleTheme?: () => void;
  switchable: boolean;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemePreference;
  switchable?: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const themeStorageKey = "micro.prototype.theme-preference";

function getStoredPreference(defaultTheme: ThemePreference): ThemePreference {
  const stored = window.localStorage.getItem(themeStorageKey);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : defaultTheme;
}

function resolveTheme(preference: ThemePreference): Theme {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children, defaultTheme = "system", switchable = false }: ThemeProviderProps) {
  const [preference, setPreference] = useState<ThemePreference>(() => switchable ? getStoredPreference(defaultTheme) : defaultTheme);
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(preference));

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => setTheme(resolveTheme(preference));
    updateTheme();
    if (preference === "system") {
      mediaQuery.addEventListener("change", updateTheme);
      return () => mediaQuery.removeEventListener("change", updateTheme);
    }
  }, [preference]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
    if (switchable) window.localStorage.setItem(themeStorageKey, preference);
  }, [preference, switchable, theme]);

  const toggleTheme = switchable ? () => setPreference(theme === "light" ? "dark" : "light") : undefined;
  const value = useMemo(() => ({ theme, preference, toggleTheme, switchable }), [preference, switchable, theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
