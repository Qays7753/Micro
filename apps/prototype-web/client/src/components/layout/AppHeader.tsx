/** Anti-vibe chrome: visible brand and contextual route label without a repeated decorative local badge. */
import { useEffect, useState } from "react";
import { MessageCircleQuestion, Moon, Settings, Sun, Truck, X } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { useTheme } from "@/contexts/ThemeContext";

type AppHeaderProps = {
  /* §4 بند ٥: التسمية السياقية تُحذف حين تكرر عنوان الصفحة h1 — الاسم وحده */
  contextLabel: string | null;
  onOpenSettings: () => void;
};

/* NAV-001 (قرار المالك ٢٠٢٦-٠٩-١٦): مدخلا النقل والتوصيل و«اسأل Micro» في
 * الترويسة — إعلانا «قريبًا» صادقان: لا حجز ولا تتبع ولا تسعير ولا ربط
 * نموذج ذكاء، ولا يُرسل أي بيان محلي إلى خارج الجهاز. */
type SoonPanel = "transport" | "assistant" | null;

const soonPanelCopy: Record<"transport" | "assistant", { title: string; body: string; footer: string }> = {
  transport: {
    title: "النقل والتوصيل — قريبًا",
    body: "ستدعم الخدمة مستقبليًا إحضار المواد من الموردين وتوصيل الطلبات إلى الزبائن من داخل التطبيق. حتى تجهز، تسليم طلبك يُدار من صفحة الطلب نفسها في «العمل»، وشراء المواد من «المالية».",
    footer: "لا حجز نقل ولا تسعير ولا تتبع في هذه النسخة — وتغيير طلب إلى «تم التسليم» ليس حجز نقل.",
  },
  assistant: {
    title: "اسأل Micro — قريبًا",
    body: "سيكون المساعد مستقبليًا قارئًا فقط: يجيب من بياناتك المسجلة على جهازك لتفهم رقمك بسرعة، بلا إنشاء أو تعديل أو حذف أي سجل.",
    footer: "لا نموذج ذكاء خارجي متصل في هذه النسخة، ولا تُرسل بيانات مشروعك إلى أي خدمة خارجية.",
  },
};

export function AppHeader({ contextLabel, onOpenSettings }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  /* §4 بند ١٦: حد الترويسة يقوى بلون الفاصل عند التمرير */
  const [isScrolled, setIsScrolled] = useState(false);
  const [soonPanel, setSoonPanel] = useState<SoonPanel>(null);
  useEffect(() => {
    const update = () => setIsScrolled(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  const panel = soonPanel ? soonPanelCopy[soonPanel] : null;
  return (
    <header className="micro-app-header" data-scrolled={isScrolled}>
      <div className="micro-header-inner">
        <div className="micro-brand-lockup" aria-label="Micro">
          <span className="micro-brand-mark-frame">
            <BrandMark size={36} className="micro-brand-mark" />
          </span>
          <div className="micro-brand-copy">
            <span className="micro-wordmark" lang="ar">
              مايكرو
            </span>
            {contextLabel ? <span className="micro-header-context">{contextLabel}</span> : null}
          </div>
        </div>
        <div className="micro-header-actions">
          <button
            className="micro-icon-button"
            type="button"
            onClick={() => setSoonPanel("transport")}
            aria-label="النقل والتوصيل — قريبًا"
            title="النقل والتوصيل — قريبًا"
          >
            <Truck aria-hidden="true" />
          </button>
          <button
            className="micro-icon-button"
            type="button"
            onClick={() => setSoonPanel("assistant")}
            aria-label="اسأل Micro — قريبًا"
            title="اسأل Micro — قريبًا"
          >
            <MessageCircleQuestion aria-hidden="true" />
          </button>
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
      {panel ? (
        <div className="micro-soon-backdrop" role="presentation" onClick={() => setSoonPanel(null)}>
          <section
            className="micro-soon-panel"
            role="dialog"
            aria-modal="false"
            aria-label={panel.title}
            data-testid="soon-panel"
            onClick={event => event.stopPropagation()}
          >
            <div className="micro-soon-panel-head">
              <strong>{panel.title}</strong>
              <button
                className="micro-icon-button"
                type="button"
                aria-label="إغلاق"
                onClick={() => setSoonPanel(null)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <p>{panel.body}</p>
            <p className="micro-soon-panel-footer">{panel.footer}</p>
          </section>
        </div>
      ) : null}
    </header>
  );
}
