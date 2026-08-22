/** Micro design reminder: theme is a local UI preference saved through Application/LocalStore, never a financial value. */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";

type Theme = "light" | "dark";
type ThemePreference = Theme | "system";
interface ThemeContextType { theme: Theme; preference: ThemePreference; toggleTheme?: () => void; switchable: boolean; }
interface ThemeProviderProps { children: React.ReactNode; defaultTheme?: ThemePreference; switchable?: boolean; }
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function resolveTheme(preference: ThemePreference): Theme {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children, defaultTheme = "system", switchable = false }: ThemeProviderProps) {
  const { preferences, dataVersion } = usePrototypeServices();
  const [preference, setPreference] = useState<ThemePreference>(defaultTheme); const [theme, setTheme] = useState<Theme>(() => resolveTheme(defaultTheme));
  useEffect(() => { let active = true; preferences.load().then(result => { if (active && result.ok) setPreference(result.preference); }); return () => { active = false; }; }, [dataVersion, preferences]);
  useEffect(() => { const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)"); const updateTheme = () => setTheme(resolveTheme(preference)); updateTheme(); if (preference === "system") { mediaQuery.addEventListener("change", updateTheme); return () => mediaQuery.removeEventListener("change", updateTheme); } }, [preference]);
  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); document.documentElement.dataset.theme = theme; }, [theme]);
  const toggleTheme = switchable ? () => { const next = theme === "light" ? "dark" : "light"; setPreference(next); void preferences.save(next); } : undefined;
  const value = useMemo(() => ({ theme, preference, toggleTheme, switchable }), [preference, switchable, theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
