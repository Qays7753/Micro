/**
 * Micro design reminder: calm chrome, visible brand mark, one context label, and
 * accessible controls using semantic tokens only.
 */
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

type AppHeaderProps = { contextLabel: string };

export function AppHeader({ contextLabel }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <header className="micro-app-header">
      <div className="micro-header-inner">
        <div className="micro-brand-lockup" aria-label="Micro">
          <img src="/manus-storage/micro-decision-mark_3b22baee.png" alt="" className="micro-brand-mark" />
          <div><span className="micro-wordmark" lang="ar">مايكرو</span><span className="micro-header-context">{contextLabel}</span></div>
        </div>
        <div className="micro-header-actions">
          <span className="micro-local-badge" title="لا توجد مزامنة سحابية في Prototype">محلي</span>
          <button className="micro-icon-button" type="button" onClick={toggleTheme} aria-label={isDark ? "تفعيل المظهر الفاتح" : "تفعيل المظهر الداكن"} title={isDark ? "المظهر الفاتح" : "المظهر الداكن"}>
            {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
