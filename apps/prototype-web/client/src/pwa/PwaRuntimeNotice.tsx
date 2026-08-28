import { CheckCircle2, RefreshCw, WifiOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { applyPwaUpdate, getPwaRuntimeState, subscribePwa } from "./register";

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

  async function updateNow() {
    setIsApplying(true);
    await applyPwaUpdate();
    setIsApplying(false);
  }

  const showUpdate = runtime.updateAvailable && !isUpdateDismissed;
  const showOffline = !isOnline;
  if (!showUpdate && !showOffline) return null;

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
          </div>
          <div className="micro-runtime-actions">
            <button
              className="micro-button micro-button-primary"
              type="button"
              disabled={isApplying}
              onClick={updateNow}
            >
              <RefreshCw aria-hidden="true" />
              {isApplying ? "جارٍ التحديث…" : "حدّث الآن"}
            </button>
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
