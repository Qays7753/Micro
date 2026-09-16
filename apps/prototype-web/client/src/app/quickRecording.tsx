/*
 * NAV-001 (قرار المالك ٢٠٢٦-٠٩-١٦): سياق التسجيل السريع — ورقة البيع/المصروف
 * يملكها مزوّد في القشرة فوق كل الأسطح، وتفتح من أزرار «مشروعي الآن» فقط.
 * الرئيسية تستدعي الخطاف بلا استيراد مكونات النموذجين، وتبقى مركّبة تحت
 * الورقة فلا تضيع قراءة الحقيقة بعد الحفظ (FIN-004).
 */
import { type ReactNode, Suspense, createContext, lazy, useContext, useMemo, useState } from "react";
import type { QuickAction } from "@/components/layout/QuickActionSheet";
import { useLocation } from "wouter";
import { withReturnTo } from "@/app/navigationContract";

const QuickActionSheet = lazy(async () => {
  const module = await import("@/components/layout/QuickActionSheet");
  return { default: module.QuickActionSheet };
});

export type QuickRecordingMode = "menu" | "sale-form" | "expense-form";

type QuickRecordingContextValue = {
  openQuickForm: (mode: QuickRecordingMode) => void;
};

const QuickRecordingContext = createContext<QuickRecordingContextValue | null>(null);

export function useQuickRecording(): QuickRecordingContextValue {
  const value = useContext(QuickRecordingContext);
  if (!value) throw new Error("useQuickRecording يتطلب مزوّد التسجيل السريع.");
  return value;
}

export function QuickRecordingProvider({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<QuickRecordingMode>("menu");
  const value = useMemo<QuickRecordingContextValue>(
    () => ({
      openQuickForm: nextMode => {
        setMode(nextMode);
        setOpen(true);
      },
    }),
    [],
  );
  function handleQuickAction(action: QuickAction) {
    setOpen(false);
    /* §٥-١ (و٥): النقر يفتح المحرر بلا إنشاء — المسودة تُنشأ عند أول إدخال حقيقي. */
    if (action === "order") navigate(withReturnTo("/orders/draft/new?intent=customer_order", "/"));
    else if (action === "estimate") navigate(withReturnTo("/orders/draft/new?intent=planned_design", "/"));
    else if (action === "collection") navigate(withReturnTo("/collect", "/"));
  }
  return (
    <QuickRecordingContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <QuickActionSheet
          open={open}
          onOpenChange={setOpen}
          onAction={handleQuickAction}
          initialMode={mode}
        />
      </Suspense>
    </QuickRecordingContext.Provider>
  );
}
