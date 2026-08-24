/** Anti-vibe chrome: visible brand and contextual route label without a repeated decorative local badge. */
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

type AppHeaderProps = { contextLabel: string };

export function AppHeader({ contextLabel }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return <header className="micro-app-header"><div className="micro-header-inner"><div className="micro-brand-lockup" aria-label="Micro"><span className="micro-brand-mark-frame"><img src="/micro-mark.svg" alt="" className="micro-brand-mark" /></span><div className="micro-brand-copy"><span className="micro-wordmark" lang="ar">مايكرو</span><span className="micro-header-context">{contextLabel}</span></div></div><div className="micro-header-actions"><button className="micro-icon-button" type="button" onClick={toggleTheme} aria-label={isDark ? "تفعيل المظهر الفاتح" : "تفعيل المظهر الداكن"} title={isDark ? "المظهر الفاتح" : "المظهر الداكن"}>{isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</button></div></div></header>;
}
