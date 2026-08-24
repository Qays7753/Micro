/**
 * Micro design reminder: the shell keeps phone-first context persistent and sends
 * future financial actions to the application layer, never to UI state.
 */
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { getNavigationLabel, primaryNavigation } from "@/app/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { type QuickAction, QuickActionSheet } from "@/components/layout/QuickActionSheet";
import { PwaInstallControl } from "@/pwa/PwaInstallControl";
import { PwaRuntimeNotice } from "@/pwa/PwaRuntimeNotice";

const futureActionCopy: Record<QuickAction, string> = {
  order: "سيصبح بدء مسودة الطلب متاحًا في Slice البداية المحلية.",
  estimate: "سيصبح التقدير متاحًا قبل إدخال تكلفة الطلب في Slice لاحق.",
  collection: "لا نسجل قبضًا أو عربونًا قبل وجود طلب محلي محفوظ.",
};

export function MicroAppShell({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const isSetup = location === "/setup";
  function handleQuickAction(action: QuickAction) {
    setIsActionSheetOpen(false);
    if (action === "order") { navigate("/orders/new"); return; }
    toast.message("هذه الخطوة لم تُفعّل بعد", { description: futureActionCopy[action] });
  }
  return <div className="micro-app" dir="rtl"><AppHeader contextLabel={isSetup ? "تأسيس محلي" : getNavigationLabel(location)} /><main className="micro-main" key={location}><PwaInstallControl /><PwaRuntimeNotice />{children}</main>{!isSetup ? <><BottomNav activePath={location} items={primaryNavigation} onNavigate={navigate} onOpenActions={() => setIsActionSheetOpen(true)} /><QuickActionSheet open={isActionSheetOpen} onOpenChange={setIsActionSheetOpen} onAction={handleQuickAction} /></> : null}</div>;
}
