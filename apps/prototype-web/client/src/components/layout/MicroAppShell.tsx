/*
 * Micro design reminder: the shell keeps phone-first context persistent and sends
 * future financial actions to the application layer, never to UI state.
 */
/* مبدأ Micro: يبقى السياق وحارس الرجوع مركزيين، ويظهر الكروم العام في الأسطح لا النماذج العميقة. */
import { type ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getNavigationLabel, primaryNavigation } from "@/app/navigation";
import { withFrom } from "@/app/navigationContract";
import { getMicroRouteKind, showsGlobalChrome } from "@/app/routeClassifier";
import { UnsavedChangesProvider, useUnsavedChangesNavigation } from "@/components/forms/UnsavedChangesGuard";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { type QuickAction, QuickActionSheet } from "@/components/layout/QuickActionSheet";
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
      <ShellContent location={location}>{children}</ShellContent>
    </UnsavedChangesProvider>
  );
}

function ShellContent({ location, children }: { location: string; children: ReactNode }) {
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
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
  function handleQuickAction(action: QuickAction) {
    setIsActionSheetOpen(false);
    /* §٥-١٤ (م٣): البيع والمصروف يتمان داخل الورقة نفسها (QuickActionSheet) — لا
     * يصلان إلى هنا. ما يصل هنا بدايات المسارات الأعمق فقط. */
    /* §٥-١ (و٥): النقر يفتح المحرر بلا إنشاء — المسودة تُنشأ عند أول إدخال حقيقي
     * داخل المحرر، فلا يخلّف الاستكشاف مسودات فارغة. */
    if (action === "order") {
      requestNavigation("/orders/draft/new?intent=customer_order");
      return;
    }
    if (action === "estimate") {
      requestNavigation("/orders/draft/new?intent=planned_design");
      return;
    }
    if (action === "collection") {
      /* المجموعة ٢ (Scope B): التحصيل يفتح ورقة التحصيل مباشرة لا قائمة الطلبات —
       * مع الحفاظ على السطح الحالي مصدرًا للرجوع (?from). */
      requestNavigation(withFrom("/collect", pathname));
    }
  }
  return (
    <div className="micro-app" data-route-kind={routeKind} data-keyboard-open={isKeyboardOpen} dir="rtl">
      <AppHeader
        contextLabel={
          isSetup
            ? "تأسيس محلي"
            : CONTEXT_REPEATS_H1.has(pathname)
              ? null
              : getNavigationLabel(location)
        }
        onOpenSettings={() => requestNavigation("/settings")}
      />
      <main className="micro-main" data-route-kind={routeKind} key={location}>
        <PwaInstallControl />
        <PwaRuntimeNotice />
        {children}
      </main>
      {showGlobalChrome ? (
        <>
          <BottomNav
            activePath={location}
            items={primaryNavigation}
            onNavigate={requestNavigation}
            onOpenActions={() => setIsActionSheetOpen(true)}
          />
          <QuickActionSheet
            open={isActionSheetOpen}
            onOpenChange={setIsActionSheetOpen}
            onAction={handleQuickAction}
          />
        </>
      ) : null}
    </div>
  );
}
