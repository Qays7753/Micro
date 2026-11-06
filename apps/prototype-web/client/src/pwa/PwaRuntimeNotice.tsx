import { CheckCircle2, RefreshCw, WifiOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { applyPwaUpdate, getPwaRuntimeState, subscribePwa } from "./register";
import { hasDirtyForms } from "./dirtyRegistry";

import { Button } from "@/components/primitives";
export function PwaRuntimeNotice() {
  const [runtime, setRuntime] = useState(getPwaRuntimeState());
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isApplying, setIsApplying] = useState(false);
  const [isUpdateDismissed, setIsUpdateDismissed] = useState(false);

  useEffect(() => subscribePwa(() => setRuntime(getPwaRuntimeState())), []);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (runtime.updateAvailable) setIsUpdateDismissed(false);
  }, [runtime.updateAvailable]);

  const [dirtyBlocked, setDirtyBlocked] = useState(false);

  async function updateNow() {
    /* المجموعة ٥ (عقد ٣٨): نموذج قذر يعلّم ولا يُدمَّر — الزر يشرح أن الحفظ
     * أولًا، والإغلاق اليدوي للبطاقة قرار المستخدم لا قفزة تحديث. */
    if (hasDirtyForms()) {
      setDirtyBlocked(true);
      return;
    }
    setDirtyBlocked(false);
    setIsApplying(true);
    await applyPwaUpdate();
    setIsApplying(false);
  }

  const showUpdate = runtime.updateAvailable && !isUpdateDismissed;
  const showOffline = !isOnline;
  /* تصحيح مؤرخ 2026-11-06 (UXR-W05/مراجعة 2/مراجعة 5): فشل تفعيل وضع التطبيق المحلي
   * حالة صادقة محسوبة أصلًا في register.ts ولم تكن تُعرض إطلاقًا — تُعلن الآن
   * كبطاقة ثالثة بrole=status (SOP-12: الحالة الصادقة قبل الرسالة الجميلة)؛ وفشل تطبيق
   * التحديث (register.ts يُبقي updateAvailable=true مع الخطأ) يُعلن داخل بطاقة التحديث
   * نفسها بسطر role=alert بدل ابتلاعه (WCAG 4.1.3)، وعنوان بطاقة الخطأ مستمد من
   * نوع الخطأ لا ثابتًا واحدًا لمسارين مختلفين. */
  const showError = Boolean(runtime.error) && !showUpdate && !showOffline;
  const errorTitle = runtime.error?.includes("التحديث")
    ? "تعذّر تطبيق التحديث"
    : "تعذّر تفعيل وضع التطبيق المحلي";
  if (!showUpdate && !showOffline && !showError) return null;

  return (
    <div className="micro-runtime-notices" aria-live="polite">
      {showUpdate ? (
        <aside className="micro-runtime-card" data-tone="update">
          <span className="micro-runtime-icon" aria-hidden="true">
            <RefreshCw />
          </span>
          <div className="micro-runtime-copy">
            <h2>تحديث Micro جاهز</h2>
            <p>التحديث ينتظر موافقتك؛ لن نعيد تحميل الصفحة أو نستبدل النسخة أثناء عملك دون اختيارك.</p>
            {dirtyBlocked ? (
              <p className="micro-field-error" role="alert">
                عندك مدخلات غير محفوظة — احفظها أولًا ثم حدّث؛ التحديث لن يبدأ فوق عملك المفتوح.
              </p>
            ) : null}
            {runtime.error ? (
              <p className="micro-field-error" role="alert">
                {runtime.error}
              </p>
            ) : null}
          </div>
          <div className="micro-runtime-actions">
            <Button
              action="save"

              disabled={isApplying}
              onClick={updateNow}
            >
              <RefreshCw aria-hidden="true" />
              {isApplying ? "جارٍ التحديث…" : "حدّث الآن"}
            </Button>
            <button
              className="micro-icon-button"
              type="button"
              onClick={() => setIsUpdateDismissed(true)}
              aria-label="لاحقًا"
              title="لاحقًا"
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </aside>
      ) : null}
      {showError ? (
        <aside className="micro-runtime-card" data-tone="offline" role="status">
          <span className="micro-runtime-icon" aria-hidden="true">
            <WifiOff />
          </span>
          <div className="micro-runtime-copy">
            <h2>{errorTitle}</h2>
            <p>{runtime.error ?? "تعذر تفعيل وضع التطبيق المحلي؛ سيستمر Micro من المتصفح."}</p>
          </div>
        </aside>
      ) : null}
      {showOffline ? (
        <aside className="micro-runtime-card" data-tone="offline" role="status">
          <span className="micro-runtime-icon" aria-hidden="true">
            <WifiOff />
          </span>
          <div className="micro-runtime-copy">
            <h2>أنت غير متصل الآن</h2>
            <p>
              يستمر Micro بما تم حفظه محليًا على هذا الجهاز. لا توجد مزامنة أو نسخة سحابية في هذا الإصدار.
            </p>
          </div>
          <CheckCircle2 className="micro-runtime-confirmation" aria-hidden="true" />
        </aside>
      ) : null}
    </div>
  );
}
