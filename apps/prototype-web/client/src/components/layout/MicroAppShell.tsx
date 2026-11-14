/*
 * Micro design reminder: the shell keeps phone-first context persistent and sends
 * future financial actions to the application layer, never to UI state.
 */
/* مبدأ Micro: يبقى السياق وحارس الرجوع مركزيين، ويظهر الكروم العام في الأسطح لا النماذج العميقة.
 * NAV-001 (2026-09-16): ورقة «سجّل» العامة انتقلت إلى «مشروعي الآن» — أزرار
 * التسجيل السريع وورقة البيع/المصروف يملكها سطح الرئيسية، فلا زر مركزي ولا
 * نموذج تنقل مزدوج في القشرة. */
import { type ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getNavigationLabel, primaryNavigation } from "@/app/navigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { useNetworkSession } from "@/app/useNetworkSession";
import { withReturnTo } from "@/app/navigationContract";
import { getMicroRouteKind, pathnameOnly, showsGlobalChrome } from "@/app/routeClassifier";
import { UnsavedChangesProvider, useUnsavedChangesNavigation } from "@/components/forms/UnsavedChangesGuard";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { QuickRecordingProvider } from "@/app/quickRecording";
import { PwaInstallControl } from "@/pwa/PwaInstallControl";
import { PwaRuntimeNotice } from "@/pwa/PwaRuntimeNotice";

/* §4 بند ٥: مسارات عنوانها h1 هو نفسه تسمية التنقل — الترويسة تعرض الاسم وحده */
const CONTEXT_REPEATS_H1 = new Set([
  "/finance",
  "/schedule",
  "/settings",
  "/inventory",
  "/suppliers",
  "/cash",
  "/market",
  "/delivery",
  "/market/vendor",
  "/market/review",
  "/delivery/drivers",
  /* Stage C (S13/R5-10): ترويسة «مراجعة التوصيل» كانت تكرر عنوان h1
   * نفسه — ضمّها لمجموعة عدم التكرار كأخواتها في مراجعة السوق. */
  "/delivery/review",
]);

export function MicroAppShell({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  return (
    <UnsavedChangesProvider navigate={navigate}>
      <QuickRecordingProvider>
        <ShellContent location={location}>{children}</ShellContent>
      </QuickRecordingProvider>
    </UnsavedChangesProvider>
  );
}

/* R10-B4/OD-12 (قرار المالك مقبول ٢٠٢٦-١٠-١٣): ردّ المرجع الوحدوي لاستقبال
 * التركيز عند كل انتقال مسار — نمط RC-3 نفسه: يشتعل عند تركيب عنصر main
 * الجديد ذاته (بمفتاح المسار) فيغطي الدخول المباشر وكل انتقال أمامي/رجوعي،
 * وكونه دالة وحدوية خارج المكوّن يجعل هويته ثابتة بنيويًا فلا يعاد اشتعاله
 * عند إعادة رسم القشرة العادية أبدًا (لا سرقة تركيز). الهدف قابل للتوجيه
 * البرمجي بلا دخول ترتيب الجدولة، وبلا أي قاعدة CSS تلمسه فالتركيز عليه
 * محايد بصريًا، وpreventScroll يبقي سلوك التمرير كما هو بالضبط. */
function receiveRouteFocus(element: HTMLElement | null): void {
  element?.focus({ preventScroll: true });
}

function ShellContent({ location, children }: { location: string; children: ReactNode }) {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const requestNavigation = useUnsavedChangesNavigation();
  /* EX-D19/EX-D21 (Phase B): جلسة قشرية واحدة تخدم القشرة — بند بوابة
   * السائق لحاملي الدور، ومدخل Ask Micro داخل ترويسة السائق المستقلة. */
  const { session, loading: sessionLoading } = useNetworkSession();
  const hasDriverRole = Boolean(session.driver);
  /* NAV-001/R1-15 (أمر المالك 2026-11-14 — Workstream A): مقاعد المالية
   * والطلبات وجهات المالك وحده — تُخفى عن الضيف غير الموثق الذي لا مشروع
   * محليًا على هذا الجهاز. القرار فتحًا لا غلقًا: الحالة المجهولة (إقلاع/
   * تحميل) تعرض المقاعد الخمسة كاملة فلا يُحجب شيء عن المالك المحلي ولا
   * يومض الإخفاء — المالك بعد التأسيس مباشرة يقرأ المشروع من المصدر نفسه
   * الذي تقرأه بوابة الإقلاع فتعود مقاعده فورًا. المستخدم الموثق يبقى له
   * كل المداخل (أمر المالك: لا تُزال المداخل المشتركة عن الموثقين)؛
   * والإنكار الخادمي للمال بنيوي أصلًا: لا مسار مالي شبكي واحد موجود
   * (foundation.isolation) — الإخفاء هنا تنقّل لا تخويل. */
  const { ownerProfile, profiles, dataVersion } = usePrototypeServices();
  const [hasLocalProject, setHasLocalProject] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    profiles
      .load()
      .then(result => {
        if (!active || !result.ok) return;
        setHasLocalProject(result.value !== null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [profiles, dataVersion]);
  const isGuest = hasLocalProject === false && !sessionLoading && session.authenticated === false;
  const navItems = isGuest
    ? primaryNavigation.filter(item => item.href !== "/finance" && item.href !== "/orders")
    : primaryNavigation;
  const routeKind = getMicroRouteKind(location);
  const isSetup = routeKind === "setup";
  const showGlobalChrome = showsGlobalChrome(location);
  const pathname = pathnameOnly(location);
  /* F-015 (UXR-02 — أمر UXR-W01): حاوية التمرير الفعلية هي المستند
   * (document.scrollingElement === documentElement) — تعويض التمرير
   * (scroll-padding) لا يصرف إلا على حاوية التمرير، فالإعلان عليه داخل
   * .micro-main كان بلا أثر والتركيز البرمجي/scrollIntoView يهبط خلف
   * الشريط السفلي الثابت. القيم تُعلن على html الآن (index.css) ويتخصص
   * سطر الأسطح حسب نوع المسار الذي تزامنه القشرة هنا على وسم المستند —
   * نفس سابقة ThemeContext في كتابة documentElement (بلا قواعد CSS تلمس
   * التركيز وبلا قيم جمالية جديدة ولا padding أعمى). */
  useEffect(() => {
    document.documentElement.dataset.microRouteKind = routeKind;
    return () => {
      delete document.documentElement.dataset.microRouteKind;
    };
  }, [routeKind]);
  /* Wave 4.3 — P-4.3-1 (D5): حالة اكتمال الحساب لقائمة الشعار — قراءة رسمية
   * واحدة من خدمة هوية المالك (لا Store جديد ولا كتابة). المجهول المؤقت
   * يعرض المدخل المحايد «الحساب» حتى تصل القراءة. */
  const [accountComplete, setAccountComplete] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    ownerProfile
      .read()
      .then(result => {
        if (!active || !result.ok) return;
        const owner = result.value;
        setAccountComplete(Boolean(owner?.displayName?.trim() || owner?.email?.trim()));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [ownerProfile, dataVersion]);
  /* §4 بند ١٨: الكروم العام يختفي ولوحة المفاتيح مفتوحة — المحتوى لا يختفي تحتها */
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setIsKeyboardOpen(viewport.height < window.innerHeight - 120);
    update();
    viewport.addEventListener("resize", update);
    return () => viewport.removeEventListener("resize", update);
  }, []);
  /* R10-B4/OD-12 (قرار المالك مقبول ٢٠٢٦-١٠-١٣): نظام انتقال المسار الواحد
   * المركزي — التركيز يستقبل عبر ردّ المرجع الوحدوي أدناه على عنصر main
   * الذي يعيد الموجّه تركيبه بمفتاح المسار، والعنوان يُضبط من التسمية
   * الكنونية للمسار ذاته (أسلم اشتقاق وأدقّه: عنوان المسار = تسميته
   * الكنونية — لا سجلّ عناوين ثانٍ ولا معالجات مبعثرة في الصفحات؛ صيغة
   * «التسمية — العلامة» قيست في الموجة ورُفضت: كلفتها gzip فوق السقف
   * المحمي ١٥٥٬٣٠٠). العنوان يشتق من المسار المجرد وحده — الاستعلام لا يمسه. */
  useEffect(() => {
    document.title = getNavigationLabel(pathname);
  }, [pathname]);
  /* بوابة السائق (عقد ٢٦ §8/OD01): سياق مستقل تمامًا — لا ترويسة المالك
   * (قائمة الشعار → الحساب/البيانات/الإعدادات) ولا شريط سفلي؛ شريط هوية
   * السائق وحده أعلى البوابة. */
  const isDriverPortal = pathname.startsWith("/driver");
  return (
    <div className="micro-app" data-route-kind={routeKind} data-keyboard-open={isKeyboardOpen} dir="rtl">
      {isDriverPortal ? (
        /* عقد 26 §8/OD01: ترويسة السائق وحدها — لا كروم مالك؛ ومدخل Ask
         * Micro الشامل داخلها (EX-D21) يبقى في سياق السائق ويعود إليه. */
        <header className="micro-driver-shell-header">
          <span className="micro-overline">Micro — السائق</span>
          <button
            type="button"
            className="micro-driver-ask-entry"
            onClick={() => requestNavigation(withReturnTo("/ask", "/driver"))}
          >
            اسأل Micro
          </button>
        </header>
      ) : (
        <AppHeader
          contextLabel={
            isSetup ? "تأسيس محلي" : CONTEXT_REPEATS_H1.has(pathname) ? null : getNavigationLabel(location)
          }
          accountComplete={accountComplete}
          hasDriverRole={hasDriverRole}
          onNavigate={requestNavigation}
        />
      )}
      <main
        className="micro-main"
        data-route-kind={routeKind}
        key={location}
        ref={receiveRouteFocus}
        tabIndex={-1}
      >
        <PwaInstallControl />
        <PwaRuntimeNotice />
        {children}
      </main>
      {showGlobalChrome ? (
        <BottomNav activePath={location} items={navItems} onNavigate={requestNavigation} />
      ) : null}
    </div>
  );
}
