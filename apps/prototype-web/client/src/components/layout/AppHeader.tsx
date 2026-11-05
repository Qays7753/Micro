/** Anti-vibe chrome: visible brand and contextual route label without a repeated decorative local badge. */
/* Wave 4.3 — P-4.3-1 (D1..D5): منطقة علوية خفيفة ومفتوحة — لا شريط علوي
 * تقليديًا ولا صندوقًا منفصلًا. الشعار زر حقيقي (≥44×44) يفتح قائمة الحساب
 * العمودية؛ النقل و«اسأل Micro» على اليسار بإعلاني «قريبًا» الصادقين.
 * زر الوضع الليلي أُزيل من هنا نهائيًا — مدخله الوحيد: الإعدادات ← المظهر (D4). */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, CircleUserRound, Landmark, MessageCircleQuestion, Settings, X } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { withReturnTo } from "@/app/navigationContract";
import { futureServiceAnnouncements } from "@/app/futureServices";

type AppHeaderProps = {
  /* §4 بند ٥: التسمية السياقية تُحذف حين تكرر عنوان الصفحة h1 — الاسم وحده */
  contextLabel: string | null;
  /* D5: حالة الحساب تحدد تسمية المدخل — null (غير معروفة بعد) تعرض «الحساب» المحايد. */
  accountComplete: boolean | null;
  /* تنقل قائمة الشعار عبر حارس التغييرات غير المحفوظة في القشرة، لا مباشرة. */
  onNavigate: (href: string) => void;
};

/* UNIT-043 (S16 — SH-21): إعلان «قريبًا» الصادق لاسأل Micro فقط هنا؛
 * مدخل النقل والتوصيل انتقل إلى مقعده في الشريط السفلي (/delivery) والبديل
 * جاهز قبل الإزالة؛ لا حجز ولا تتبع ولا تسعير ولا ربط نموذج ذكاء، ولا
 * يُرسل أي بيان محلي إلى خارج الجهاز. */
type SoonPanel = "assistant" | null;

const soonPanelCopy: Record<"assistant", { title: string; body: string; footer: string }> = {
  assistant: futureServiceAnnouncements.assistant,
};

/* D3: مجموعات قائمة الشعار — قصيرة ومرتبة: الحساب والمشروع ثم النظام.
 * كل بند يفتح السطح الرسمي القائم نفسه ويحفظ مصدر رجوعه (EXE-016)؛ وبند
 * «اسأل Micro — قريبًا» يفتح لوحة الإعلان القائمة نفسها (DEC-SHELL-01/
 * DEC-HOM-01 — UXR-03: موضع واحد عند الطلب داخل القائمة، بلا أثر دائم في
 * أي ترويسة ولا بطاقة دائمة في الرئيسية). */
type LogoMenuItem = {
  id: string;
  label: string;
  icon: typeof Settings;
  href: string;
  /** فعل محلي داخل القائمة (لوحة إعلان) — يغلق القائمة ويفتح لوحته. */
  onOpen?: () => void;
};
type LogoMenuGroup = { id: string; label: string; items: readonly LogoMenuItem[] };

export function AppHeader({ contextLabel, accountComplete, onNavigate }: AppHeaderProps) {
  /* §4 بند ١٦: حد الترويسة يقوى بلون الفاصل عند التمرير فقط — المنطقة المفتوحة
   * تبقى بلا صندوق في وضع الراحة (D1). */
  const [isScrolled, setIsScrolled] = useState(false);
  const [soonPanel, setSoonPanel] = useState<SoonPanel>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const logoButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const soonPanelRef = useRef<HTMLElement>(null);
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

  const closeSoonPanel = useCallback((_restoreFocus: boolean) => {
    setSoonPanel(null);
    /* DEC-SHELL-01 (UXR-03): المشغّل صار بند القائمة — إعادة التركيز لزر
     * الشعار (مالك القائمة) بعد الإغلاق كسلوك القائمة نفسه. */
    logoButtonRef.current?.focus();
  }, []);

  /* Wave 4.4 — P-4.4-1: توحيد سلوك لوحتي «قريبًا» مع قائمة الشعار — Escape
   * يغلق ويعيد التركيز للمشغّل، والنقر خارجيًا يغلق، وTab يبقى داخل اللوحة
   * (حبس تركيز مناسب لـDialog) حتى إغلاقها. */
  useEffect(() => {
    if (!soonPanel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeSoonPanel(true);
        return;
      }
      if (event.key === "Tab") {
        const focusables = Array.from(
          soonPanelRef.current?.querySelectorAll<HTMLElement>(
            "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
          ) ?? [],
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [soonPanel, closeSoonPanel]);

  /* P-4.4-1: عند فتح اللوحة يدخل التركيز إليها — الزر الأول داخلها. */
  useEffect(() => {
    if (!soonPanel) return;
    const timer = window.setTimeout(() => {
      soonPanelRef.current
        ?.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])")[0]
        ?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [soonPanel]);

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
      items: [
        { id: "settings", label: "الإعدادات", icon: Settings, href: "/settings" },
        {
          id: "assistant",
          label: "اسأل Micro — قريبًا",
          icon: MessageCircleQuestion,
          href: "",
          onOpen: () => setSoonPanel("assistant"),
        },
      ],
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
        {/* DEC-SHELL-01 (UXR-03 — أمر W02): زر «اسأل Micro» الدائم في
           * الترويسة أُزيل — مدخله الوحيد عند الطلب داخل قائمة «مايكرو»
           * (مجموعة النظام)؛ لا مساحة دائمة في ~70 قالبًا لإعلان مستقبلي. */}
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
                    aria-haspopup={item.onOpen ? "dialog" : undefined}
                    onClick={() => {
                      if (item.onOpen) {
                        closeMenu(false);
                        item.onOpen();
                        return;
                      }
                      menuNavigate(item.href);
                    }}
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
        <div className="micro-soon-backdrop" role="presentation" onClick={() => closeSoonPanel(false)}>
          <section
            ref={soonPanelRef}
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
                onClick={() => closeSoonPanel(true)}
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
