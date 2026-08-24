/*
 * Micro design reminder: the shell keeps phone-first context persistent and sends
 * future financial actions to the application layer, never to UI state.
 */
import { type ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { getNavigationLabel, primaryNavigation } from "@/app/navigation";
import { UnsavedChangesProvider, useUnsavedChangesNavigation } from "@/components/forms/UnsavedChangesGuard";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { type QuickAction, QuickActionSheet } from "@/components/layout/QuickActionSheet";
import { PwaInstallControl } from "@/pwa/PwaInstallControl";
import { PwaRuntimeNotice } from "@/pwa/PwaRuntimeNotice";


export function MicroAppShell({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  return <UnsavedChangesProvider navigate={navigate}><ShellContent location={location}>{children}</ShellContent></UnsavedChangesProvider>;
}

function ShellContent({ location, children }: { location: string; children: ReactNode }) {
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const requestNavigation = useUnsavedChangesNavigation();
  const isSetup = location === "/setup";
  function handleQuickAction(action: QuickAction) {
    setIsActionSheetOpen(false);
    if (action === "order") { requestNavigation("/orders/new"); return; }
    if (action === "collection") { requestNavigation("/orders"); }
  }
  return <div className="micro-app" dir="rtl"><AppHeader contextLabel={isSetup ? "تأسيس محلي" : getNavigationLabel(location)} /><main className="micro-main" key={location}><PwaInstallControl /><PwaRuntimeNotice />{children}</main>{!isSetup ? <><BottomNav activePath={location} items={primaryNavigation} onNavigate={requestNavigation} onOpenActions={() => setIsActionSheetOpen(true)} /><QuickActionSheet open={isActionSheetOpen} onOpenChange={setIsActionSheetOpen} onAction={handleQuickAction} /></> : null}</div>;
}
