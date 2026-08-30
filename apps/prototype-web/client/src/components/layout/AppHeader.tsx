/** Anti-vibe chrome: visible brand and contextual route label without a repeated decorative local badge. */
import { useEffect, useState } from "react";
import { Moon, Settings, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

type AppHeaderProps = {
  /* §4 بند ٥: التسمية السياقية تُحذف حين تكرر عنوان الصفحة h1 — الاسم وحده */
  contextLabel: string | null;
  onOpenSettings: () => void;
};

export function AppHeader({ contextLabel, onOpenSettings }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  /* §4 بند ١٦: حد الترويسة يقوى بلون الفاصل عند التمرير */
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const update = () => setIsScrolled(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <header className="micro-app-header" data-scrolled={isScrolled}>
      <div className="micro-header-inner">
        <div className="micro-brand-lockup" aria-label="Micro">
          <span className="micro-brand-mark-frame">
            <img src="/micro-mark.svg" alt="" className="micro-brand-mark" />
          </span>
          <div className="micro-brand-copy">
            <span className="micro-wordmark" lang="ar">
              مايكرو
            </span>
            {contextLabel ? <span className="micro-header-context">{contextLabel}</span> : null}
          </div>
        </div>
        <div className="micro-header-actions">
          {/* §2.2: الإعدادات ترسًا في الترويسة — المقعد الخامس يبقى شاغرًا معلنًا للسوق. */}
          <button
            className="micro-icon-button"
            type="button"
            onClick={onOpenSettings}
            aria-label="الإعدادات"
            title="الإعدادات"
          >
            <Settings aria-hidden="true" />
          </button>
          <button
            className="micro-icon-button"
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "تفعيل المظهر الفاتح" : "تفعيل المظهر الداكن"}
            title={isDark ? "المظهر الفاتح" : "المظهر الداكن"}
          >
            {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
