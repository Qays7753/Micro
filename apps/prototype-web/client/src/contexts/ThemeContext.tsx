/** Micro design reminder: theme is a local UI preference saved through Application/LocalStore, never a financial value. */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";

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

function resolveTheme(preference: ThemePreference): Theme {
  /* W5 (D1): الفاتح هو الوضع الافتراضي للمنتج. القيمة غير المحفوظة تُقرأ
   * «system» من خدمة التفضيلات — تُحلّ فاتحًا: لا يتبع Micro نظام التشغيل
   * أبدًا؛ الداكن اختيار صريح محفوظ فقط. */
  return preference === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children, defaultTheme = "system", switchable = false }: ThemeProviderProps) {
  const { preferences, dataVersion } = usePrototypeServices();
  const [preference, setPreference] = useState<ThemePreference>(defaultTheme);
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(defaultTheme));
  useEffect(() => {
    let active = true;
    preferences.load().then(result => {
      if (active && result.ok) setPreference(result.preference);
    });
    return () => {
      active = false;
    };
  }, [dataVersion, preferences]);
  useEffect(() => {
    /* W5 (D1): لا متابعة للنظام — resolveTheme يحسم التفضيل محليًا؛ هذا
     * الأثر يزامن السمة الفعلية مع حالة التفضيل بعد التحميل/التبديل. */
    setTheme(resolveTheme(preference));
  }, [preference]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
    /* §4 بند ١٩: التبديل اليدوي يحدّث شريط النظام فورًا — القيمة من توكن §1.1
     * لا هيكس خام في TSX (§5 بند ١٤) */
    const styles = getComputedStyle(document.documentElement);
    const color = styles.getPropertyValue("--color-bg-canvas").trim();
    if (color) {
      document
        .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
        .forEach(meta => meta.setAttribute("content", color));
    }
  }, [theme]);
  const toggleTheme = switchable
    ? () => {
        const next = theme === "light" ? "dark" : "light";
        setPreference(next);
        void preferences.save(next);
      }
    : undefined;
  const value = useMemo(
    () => ({ theme, preference, toggleTheme, switchable }),
    [preference, switchable, theme, toggleTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
