import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export type UnsavedExitChoice = "save" | "discard" | "cancel";
export type UnsavedGuardRegistration = { isDirty: boolean; onSave: () => Promise<boolean> };
export type UnsavedExitDecision =
  | { kind: "save" | "discard"; target: string }
  | { kind: "cancel" };

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

export async function completeSaveNavigation(onSave: () => Promise<boolean>, navigate: (target: string) => void, target: string) {
  const saved = await onSave();
  if (saved) navigate(target);
  return saved;
}

export function UnsavedChangesProvider({ navigate, children }: { navigate: (target: string) => void; children: ReactNode }) {
  const guardRef = useRef<RegisteredGuard | null>(null);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const registerGuard = useCallback((guard: UnsavedGuardRegistration) => {
    const token = Symbol("unsaved-guard");
    guardRef.current = { ...guard, token };
    return () => {
      if (guardRef.current?.token === token) guardRef.current = null;
    };
  }, []);
  const requestNavigation = useCallback((target: string) => {
    const guard = guardRef.current;
    if (!guard || !guard.isDirty) {
      navigate(target);
      return;
    }
    setPendingTarget(target);
    setIsOpen(true);
  }, [navigate]);
  const close = useCallback(() => {
    if (isSaving) return;
    setIsOpen(false);
    setPendingTarget(null);
  }, [isSaving]);
  const discard = useCallback(() => {
    if (isSaving || !pendingTarget) return;
    const target = pendingTarget;
    setIsOpen(false);
    setPendingTarget(null);
    navigate(target);
  }, [isSaving, navigate, pendingTarget]);
  const saveAndContinue = useCallback(async () => {
    const guard = guardRef.current;
    if (isSaving || !guard || !pendingTarget) return;
    setIsSaving(true);
    const target = pendingTarget;
    const saved = await completeSaveNavigation(guard.onSave, nextTarget => {
      setIsSaving(false);
      setIsOpen(false);
      setPendingTarget(null);
      navigate(nextTarget);
    }, target);
    setIsSaving(false);
    if (!saved) return;
  }, [isSaving, navigate, pendingTarget]);

  return <UnsavedChangesContext.Provider value={{ registerGuard, requestNavigation }}>
    {children}
    <Drawer open={isOpen} onOpenChange={open => { if (!open) close(); }} direction="bottom">
      <DrawerContent dir="rtl" data-testid="unsaved-changes-drawer">
        <DrawerHeader>
          <DrawerTitle>لديك تعديلات غير محفوظة</DrawerTitle>
          <DrawerDescription>اختر كيف تتابع. لن يُحفظ شيء تلقائيًا، ولن يُفقد عملك ما لم تختر الخروج.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <button className="micro-button micro-button-primary" type="button" disabled={isSaving} onClick={saveAndContinue}>{isSaving ? "جارٍ الحفظ…" : "احفظ واستمر"}</button>
          <button className="micro-button micro-button-secondary" type="button" disabled={isSaving} onClick={discard}>اخرج دون حفظ</button>
          <button className="micro-button micro-button-secondary" type="button" disabled={isSaving} onClick={close}>إلغاء</button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  </UnsavedChangesContext.Provider>;
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
