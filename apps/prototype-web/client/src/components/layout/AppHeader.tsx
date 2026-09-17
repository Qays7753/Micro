/** Anti-vibe chrome: visible brand and contextual route label without a repeated decorative local badge. */
/* Wave 4.3 — P-4.3-1 (D1..D5): منطقة علوية خفيفة ومفتوحة — لا شريط علوي
 * تقليديًا ولا صندوقًا منفصلًا. الشعار زر حقيقي (≥44×44) يفتح قائمة الحساب
 * العمودية؛ النقل و«اسأل Micro» على اليسار بإعلاني «قريبًا» الصادقين.
 * زر الوضع الليلي أُزيل من هنا نهائيًا — مدخله الوحيد: الإعدادات ← المظهر (D4). */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  CircleUserRound,
  Landmark,
  MessageCircleQuestion,
  Settings,
  Truck,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { withReturnTo } from "@/app/navigationContract";

type AppHeaderProps = {
  /* §4 بند ٥: التسمية السياقية تُحذف حين تكرر عنوان الصفحة h1 — الاسم وحده */
  contextLabel: string | null;
  /* D5: حالة الحساب تحدد تسمية المدخل — null (غير معروفة بعد) تعرض «الحساب» المحايد. */
  accountComplete: boolean | null;
  /* تنقل قائمة الشعار عبر حارس التغييرات غير المحفوظة في القشرة، لا مباشرة. */
  onNavigate: (href: string) => void;
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

/* D3: مجموعات قائمة الشعار — قصيرة ومرتبة: الحساب والمشروع ثم النظام.
 * كل بند يفتح السطح الرسمي القائم نفسه ويحفظ مصدر رجوعه (EXE-016). */
type LogoMenuItem = { id: string; label: string; icon: typeof Settings; href: string };
type LogoMenuGroup = { id: string; label: string; items: readonly LogoMenuItem[] };

export function AppHeader({ contextLabel, accountComplete, onNavigate }: AppHeaderProps) {
  /* §4 بند ١٦: حد الترويسة يقوى بلون الفاصل عند التمرير فقط — المنطقة المفتوحة
   * تبقى بلا صندوق في وضع الراحة (D1). */
  const [isScrolled, setIsScrolled] = useState(false);
  const [soonPanel, setSoonPanel] = useState<SoonPanel>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const logoButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => setIsScrolled(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const closeMenu = useCallback((restoreFocus: boolean) => {
    setMenuOpen(false);
    if (restoreFocus) logoButtonRef.current?.focus();
  }, []);

  /* D3: الإغلاق بالنقر خارج القائمة وبزر Escape — والتركيز يعود للشعار. */
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      if (logoButtonRef.current?.contains(event.target as Node)) return;
      closeMenu(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeMenu(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, closeMenu]);

  /* D3: التنقل بلوحة المفاتيح داخل القائمة — أسهم عمودية دورية + Home/End. */
  const menuOnKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? []);
    if (items.length === 0) return;
    const currentIndex = items.findIndex(item => item === document.activeElement);
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1 + items.length) % items.length;
    else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = items.length - 1;
    else return;
    event.preventDefault();
    items[nextIndex]?.focus();
  };

  /* D5: تسمية مدخل الحساب حسب الحالة — «الحساب» للمكتمل وغير المعروف بعد،
   * «أكمل إعداد الحساب» للفارغ؛ الوجهة السطح الرسمي نفسه دائمًا. */
  const accountLabel = accountComplete === false ? "أكمل إعداد الحساب" : "الحساب";
  const menuGroups: readonly LogoMenuGroup[] = [
    {
      id: "account-project",
      label: "الحساب والمشروع",
      items: [
        { id: "account", label: accountLabel, icon: CircleUserRound, href: "/profile" },
        { id: "project-data", label: "بيانات المشروع", icon: Landmark, href: "/foundation" },
      ],
    },
    {
      id: "system",
      label: "النظام",
      items: [{ id: "settings", label: "الإعدادات", icon: Settings, href: "/settings" }],
    },
  ];
  const currentPathname = window.location.pathname;
  const menuNavigate = (href: string) => {
    closeMenu(true);
    /* القائمة تفتح الأسطح من أي مكان — الرجوع يعود إلى حيث كان المالك (EXE-016). */
    onNavigate(withReturnTo(href, currentPathname));
  };

  const panel = soonPanel ? soonPanelCopy[soonPanel] : null;
  return (
    <header className="micro-app-header" data-scrolled={isScrolled} data-menu-open={menuOpen}>
      <div className="micro-header-inner">
        {/* D2: الشعار زر حقيقي — منطقة لمس ≥44×44 وaria-label واضح وقائمة مرتبطة. */}
        <div className="micro-brand-lockup">
          <button
            ref={logoButtonRef}
            className="micro-logo-button"
            type="button"
            aria-label="قائمة Micro"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-testid="micro-logo-menu-button"
            onClick={() => {
              if (menuOpen) closeMenu(true);
              else setMenuOpen(true);
            }}
            onKeyDown={event => {
              if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
                if (!menuOpen) return;
                event.preventDefault();
                menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']")[0]?.focus();
              }
            }}
          >
            <BrandMark size={32} className="micro-brand-mark" />
            <span className="micro-wordmark" lang="ar">
              مايكرو
            </span>
            <ChevronDown aria-hidden="true" className="micro-logo-menu-chevron" data-open={menuOpen} />
          </button>
          {contextLabel ? <span className="micro-header-context">{contextLabel}</span> : null}
        </div>
        <div className="micro-header-actions">
          <button
            className="micro-icon-button"
            type="button"
            onClick={() => {
              closeMenu(false);
              setSoonPanel("transport");
            }}
            aria-label="النقل والتوصيل — قريبًا"
            title="النقل والتوصيل — قريبًا"
          >
            <Truck aria-hidden="true" />
          </button>
          <button
            className="micro-icon-button"
            type="button"
            onClick={() => {
              closeMenu(false);
              setSoonPanel("assistant");
            }}
            aria-label="اسأل Micro — قريبًا"
            title="اسأل Micro — قريبًا"
          >
            <MessageCircleQuestion aria-hidden="true" />
          </button>
        </div>
      </div>
      {menuOpen ? (
        <div
          ref={menuRef}
          className="micro-logo-menu"
          role="menu"
          aria-label="قائمة Micro"
          data-testid="micro-logo-menu"
          onKeyDown={menuOnKeyDown}
        >
          {menuGroups.map(group => (
            <div className="micro-logo-menu-group" key={group.id} role="presentation">
              <p className="micro-logo-menu-group-label">{group.label}</p>
              {group.items.map(item => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.id}
                    className="micro-logo-menu-item"
                    type="button"
                    role="menuitem"
                    data-account-state={item.id === "account" ? accountComplete : undefined}
                    onClick={() => menuNavigate(item.href)}
                  >
                    <ItemIcon aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <p className="micro-logo-menu-note">بياناتك محفوظة على هذا الجهاز</p>
        </div>
      ) : null}
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
