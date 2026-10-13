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
  const routeKind = getMicroRouteKind(location);
  const isSetup = routeKind === "setup";
  const showGlobalChrome = showsGlobalChrome(location);
  const pathname = pathnameOnly(location);
  /* Wave 4.3 — P-4.3-1 (D5): حالة اكتمال الحساب لقائمة الشعار — قراءة رسمية
   * واحدة من خدمة هوية المالك (لا Store جديد ولا كتابة). المجهول المؤقت
   * يعرض المدخل المحايد «الحساب» حتى تصل القراءة. */
  const { ownerProfile, dataVersion } = usePrototypeServices();
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
  return (
    <div className="micro-app" data-route-kind={routeKind} data-keyboard-open={isKeyboardOpen} dir="rtl">
      <AppHeader
        contextLabel={
          isSetup ? "تأسيس محلي" : CONTEXT_REPEATS_H1.has(pathname) ? null : getNavigationLabel(location)
        }
        accountComplete={accountComplete}
        onNavigate={requestNavigation}
      />
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
        <BottomNav activePath={location} items={primaryNavigation} onNavigate={requestNavigation} />
      ) : null}
    </div>
  );
}
