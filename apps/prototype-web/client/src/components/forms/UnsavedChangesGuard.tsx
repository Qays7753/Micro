import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export type UnsavedExitChoice = "save" | "discard" | "cancel";
export type UnsavedGuardRegistration = { isDirty: boolean; onSave: () => Promise<boolean> };
export type UnsavedExitDecision = { kind: "save" | "discard"; target: string } | { kind: "cancel" };

type RegisteredGuard = UnsavedGuardRegistration & { token: symbol };
type UnsavedChangesContextValue = {
  registerGuard: (guard: UnsavedGuardRegistration) => () => void;
  requestNavigation: (target: string) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function navigationDecision(isDirty: boolean, target: string): "navigate" | "prompt" {
  return isDirty ? "prompt" : "navigate";
}

export function resolveUnsavedExit(choice: UnsavedExitChoice, target: string): UnsavedExitDecision {
  if (choice === "cancel") return { kind: "cancel" };
  return { kind: choice, target };
}

export async function completeSaveNavigation(
  onSave: () => Promise<boolean>,
  navigate: (target: string) => void,
  target: string,
) {
  const saved = await onSave();
  if (saved) navigate(target);
  return saved;
}

export function UnsavedChangesProvider({
  navigate,
  children,
}: {
  navigate: (target: string) => void;
  children: ReactNode;
}) {
  const guardRef = useRef<RegisteredGuard | null>(null);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [pendingExit, setPendingExit] = useState<"app" | "back">("app");
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasDirtyGuard, setHasDirtyGuard] = useState(false);
  const sentinelArmedRef = useRef(false);
  const suppressHistoryGuardRef = useRef(false);
  const registerGuard = useCallback((guard: UnsavedGuardRegistration) => {
    const token = Symbol("unsaved-guard");
    guardRef.current = { ...guard, token };
    setHasDirtyGuard(guard.isDirty);
    if (guard.isDirty && !sentinelArmedRef.current) {
      history.pushState({ microGuard: true }, "");
      sentinelArmedRef.current = true;
    }
    return () => {
      if (guardRef.current?.token === token) {
        guardRef.current = null;
        setHasDirtyGuard(false);
        sentinelArmedRef.current = false;
      }
    };
  }, []);
  const requestNavigation = useCallback(
    (target: string) => {
      const guard = guardRef.current;
      if (!guard || !guard.isDirty) {
        navigate(target);
        return;
      }
      setPendingTarget(target);
      setPendingExit("app");
      setIsOpen(true);
    },
    [navigate],
  );
  // Browser/system back is the most common phone interruption; the sentinel history entry keeps
  // the form mounted (same URL) so its unsaved state survives, and the same three-choice drawer
  // decides what happens. Stale sentinels left after an in-app exit are skipped on pop.
  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      if (suppressHistoryGuardRef.current) {
        suppressHistoryGuardRef.current = false;
        return;
      }
      const guard = guardRef.current;
      if (guard?.isDirty) {
        history.pushState({ microGuard: true }, "");
        sentinelArmedRef.current = true;
        setPendingTarget(null);
        setPendingExit("back");
        setIsOpen(true);
        return;
      }
      if (sentinelArmedRef.current) {
        sentinelArmedRef.current = false;
        history.back();
        return;
      }
      if (event.state?.microGuard) history.back();
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    if (!hasDirtyGuard) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasDirtyGuard]);
  const close = useCallback(() => {
    if (isSaving) return;
    setIsOpen(false);
    setPendingTarget(null);
    setPendingExit("app");
  }, [isSaving]);
  const runExit = useCallback(
    (exit: "app" | "back", target: string | null) => {
      if (exit === "back") {
        suppressHistoryGuardRef.current = true;
        history.go(history.state?.microGuard ? -2 : -1);
        return;
      }
      if (target) navigate(target);
    },
    [navigate],
  );
  const discard = useCallback(() => {
    if (isSaving || (pendingExit === "app" && !pendingTarget)) return;
    const exit = pendingExit;
    const target = pendingTarget;
    setIsOpen(false);
    setPendingTarget(null);
    setPendingExit("app");
    runExit(exit, target);
  }, [isSaving, pendingExit, pendingTarget, runExit]);
  const saveAndContinue = useCallback(async () => {
    const guard = guardRef.current;
    if (isSaving || !guard || (pendingExit === "app" && !pendingTarget)) return;
    const exit = pendingExit;
    const target = pendingTarget;
    setIsSaving(true);
    const saved = await completeSaveNavigation(
      guard.onSave,
      () => {
        setIsSaving(false);
        setIsOpen(false);
        setPendingTarget(null);
        setPendingExit("app");
        runExit(exit, target);
      },
      exit === "app" ? (target ?? "") : "",
    );
    setIsSaving(false);
    if (!saved) return;
  }, [isSaving, pendingExit, pendingTarget, runExit]);

  return (
    <UnsavedChangesContext.Provider value={{ registerGuard, requestNavigation }}>
      {children}
      <Drawer
        open={isOpen}
        onOpenChange={open => {
          if (!open) close();
        }}
        direction="bottom"
      >
        <DrawerContent dir="rtl" data-testid="unsaved-changes-drawer">
          <DrawerHeader>
            <DrawerTitle>لديك تعديلات غير محفوظة</DrawerTitle>
            <DrawerDescription>
              اختر كيف تتابع. لن يُحفظ شيء تلقائيًا، وإذا أغلقت الصفحة أو التطبيق قبل الحفظ يفقد ما لم تحفظه.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <button
              className="micro-button micro-button-primary"
              type="button"
              disabled={isSaving}
              onClick={saveAndContinue}
            >
              {isSaving ? "جارٍ الحفظ…" : "احفظ واستمر"}
            </button>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              disabled={isSaving}
              onClick={discard}
            >
              اخرج دون حفظ
            </button>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              disabled={isSaving}
              onClick={close}
            >
              إلغاء
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChangesGuard(guard: UnsavedGuardRegistration) {
  const context = useContext(UnsavedChangesContext);
  if (!context) throw new Error("useUnsavedChangesGuard must be used inside UnsavedChangesProvider");
  const { registerGuard } = context;
  useEffect(() => registerGuard(guard), [guard.isDirty, guard.onSave, registerGuard]);
  return context.requestNavigation;
}

export function useUnsavedChangesNavigation() {
  const context = useContext(UnsavedChangesContext);
  if (!context) throw new Error("useUnsavedChangesNavigation must be used inside UnsavedChangesProvider");
  return context.requestNavigation;
}
