/**
 * المجموعة ٥ (عقد ٣٧ — بوابة القفل المحلي): غطاء قفل كامل الشاشة فوق المحتوى
 * لا بديلًا عنه — النماذج المفتوحة تبقى محمّلة تحته فلا يفقد المالك شيئًا
 * غير محفوظ بمجرد الخمول.
 *
 * سلوك البوابة:
 * - إخفاء التطبيق (تبديل/شاشة قفل) يعلّم آخر نشاط؛ الظهور يفحص مدة الخمول
 *   ويقفل عند تجاوزها — النمط ذاته الذي أثبتته تجربة Zman (IdleLock).
 * - نبض ٣٠ ثانية أثناء الظهور يمنع قفلًا أثناء الاستخدام المتواصل.
 * - مسارات الاسترداد العامة (/setup، /settings) معفاة — الطوارئ لا تُقفل.
 * - الرمز لا يُخزَّن ولا يُصدَّر؛ البصمة فقط (عقد ٣٧).
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { LocalLockService } from "@/application/security/localLockService";
import { isPublicLocalRecoveryRoute } from "@/app/StartupGate";

const HEARTBEAT_MS = 30_000;

type GateState = { phase: "checking" } | { phase: "open" } | { phase: "locked"; failedAttempts: number };

export function AppLockGate({ children }: { children: ReactNode }) {
  const { localLock } = usePrototypeServices();
  const [location] = useLocation();
  const [state, setState] = useState<GateState>({ phase: "checking" });
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const busyRef = useRef(false);

  const evaluate = useCallback(async () => {
    if (isPublicLocalRecoveryRoute(location.split("?")[0] ?? location)) {
      setState(current => (current.phase === "open" ? current : { phase: "open" }));
      return;
    }
    const status = await localLock.status();
    if (!status.ok || !status.value.enabled) {
      setState({ phase: "open" });
      return;
    }
    const shouldLock = await localLock.shouldLockNow();
    if (!shouldLock.ok) {
      setState({ phase: "open" });
      return;
    }
    if (shouldLock.value) {
      setPin("");
      setMessage(null);
      setState({ phase: "locked", failedAttempts: 0 });
    } else {
      setState(current => (current.phase === "locked" ? current : { phase: "open" }));
      await localLock.touchActivity();
    }
  }, [localLock, location]);

  useEffect(() => {
    void evaluate();
  }, [evaluate]);

  /* إخفاء التطبيق يعلّم النشاط الأخير؛ الظهور يعيد التقييم — يعمل مع تبديل
   * التطبيق وقفل الشاشة معًا (درس Zman: لا مؤقتات منفصلة عن الرؤية). */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void localLock.touchActivity();
      } else {
        void evaluate();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [evaluate, localLock]);

  /* نبض أثناء الاستخدام المتواصل يحدّث آخر نشاط فيمنع القفل تحت يدي المالك. */
  useEffect(() => {
    if (state.phase !== "open") return;
    const interval = globalThis.setInterval(() => {
      if (document.visibilityState === "visible") void localLock.touchActivity();
    }, HEARTBEAT_MS);
    return () => {
      globalThis.clearInterval(interval);
    };
  }, [state.phase, localLock]);

  async function tryUnlock() {
    if (busyRef.current || state.phase !== "locked") return;
    busyRef.current = true;
    const result = await localLock.unlock(pin);
    busyRef.current = false;
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (result.value.unlocked) {
      setPin("");
      setMessage(null);
      setState({ phase: "open" });
      return;
    }
    const attempts = result.value.failedAttempts;
    const delay = LocalLockService.retryDelayMs(attempts);
    setPin("");
    setMessage(
      delay > 0
        ? `الرمز غير صحيح (${attempts} محاولات) — انتظر قليلًا ثم أعد المحاولة.`
        : "الرمز غير صحيح — أعد المحاولة.",
    );
    setState({ phase: "locked", failedAttempts: attempts });
  }

  if (state.phase !== "locked") return <>{children}</>;

  return (
    <>
      {/* المحتوى يبقى محمّلًا تحته — القفل غطاء لا إعادة توجيه، فلا يفقد
          المالك نموذجًا مفتوحًا غير محفوظ. */}
      <div aria-hidden="true" className="micro-lock-veil" />
      <div className="micro-lock-overlay" role="dialog" aria-modal="true" aria-label="قفل Micro">
        <Lock aria-hidden="true" className="micro-lock-icon" />
        <h1>Micro مقفل</h1>
        <p>
          أدخل رمز القفل لمتابعة عملك كما تركته — بياناتك محلية على هذا الجهاز كما هي،
          والقفل يحمي من النظرة العابرة فقط.
        </p>
        <form
          className="micro-lock-form"
          onSubmit={event => {
            event.preventDefault();
            void tryUnlock();
          }}
        >
          <label className="micro-field">
            <span>رمز القفل</span>
            {/* رمز القفل نص أرقام إنجليزية بخط واحد — معيّن المدخلات الرقمي
                والاتجاه المعزول كنمط EnglishNumberInput بلا قيمة رقمية. */}
            <input
              type="text"
              value={pin}
              onChange={event => setPin(event.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
              inputMode="numeric"
              autoComplete="off"
              dir="ltr"
              lang="en"
              pattern="[0-9]*"
              autoFocus
            />
          </label>
          <button className="micro-button micro-button-primary" type="submit" disabled={pin.trim().length < 4}>
            <LockOpen aria-hidden="true" /> افتح
          </button>
        </form>
        {message ? (
          <p className="micro-field-error" role="alert">
            {message}
          </p>
        ) : null}
        <p className="micro-offline-truth">
          نسيت الرمز؟ افتح الإعدادات من هذا الجهاز — إلغاء القفل يحتاج رمزك ولا يوجد بديل سحابي.
        </p>
      </div>
      {children}
    </>
  );
}
