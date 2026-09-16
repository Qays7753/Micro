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
import { getMicroRouteKind, showsGlobalChrome } from "@/app/routeClassifier";
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

function ShellContent({ location, children }: { location: string; children: ReactNode }) {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const requestNavigation = useUnsavedChangesNavigation();
  const routeKind = getMicroRouteKind(location);
  const isSetup = routeKind === "setup";
  const showGlobalChrome = showsGlobalChrome(location);
  const pathname = location.split(/[?#]/, 1)[0] ?? location;
  /* §4 بند ١٨: الكروم العام يختفي ولوحة المفاتيح مفتوحة — المحتوى لا يختفي تحتها */
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setIsKeyboardOpen(viewport.height < window.innerHeight - 120);
    update();
    viewport.addEventListener("resize", update);
    return () => viewport.removeEventListener("resize", update);
  }, []);
  return (
    <div className="micro-app" data-route-kind={routeKind} data-keyboard-open={isKeyboardOpen} dir="rtl">
      <AppHeader
        contextLabel={
          isSetup ? "تأسيس محلي" : CONTEXT_REPEATS_H1.has(pathname) ? null : getNavigationLabel(location)
        }
        onOpenSettings={() => requestNavigation("/settings")}
      />
      <main className="micro-main" data-route-kind={routeKind} key={location}>
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
