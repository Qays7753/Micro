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
import { normalizeAsciiDigits } from "@/application/input/englishNumeric";
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

  /* نبض أثناء الاستخدام المتواصل يحدّث آخر نشاط فيمنع القفل تحت يدي المالك.
   * المجموعة ٦ (تدقيق A1 — SP-03): «الاستخدام» = إدخال فعلي (لمس/مفاتيح/عجلة)،
   * لا مجرد ظهور التبويب — الجهاز المفتوح بلا لمس على سطح المكتب يُقفل بعد
   * الخمول المختار كما يعد الإعداد، والقراءة المتصلة مع أي تمرير تبقى حية. */
  useEffect(() => {
    if (state.phase !== "open") return;
    const lastInputAtRef = { current: Date.now() };
    const markInput = () => {
      lastInputAtRef.current = Date.now();
    };
    const inputEvents: Array<keyof DocumentEventMap> = ["pointerdown", "keydown", "wheel", "touchstart"];
    inputEvents.forEach(type => document.addEventListener(type, markInput, { passive: true }));
    const interval = globalThis.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const idleMs = Date.now() - lastInputAtRef.current;
      if (idleMs <= HEARTBEAT_MS) void localLock.touchActivity();
      else void evaluate();
    }, HEARTBEAT_MS);
    return () => {
      inputEvents.forEach(type => document.removeEventListener(type, markInput));
      globalThis.clearInterval(interval);
    };
  }, [state.phase, localLock, evaluate]);

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
    const delay = result.value.retryInMs ?? LocalLockService.retryDelayMs(attempts);
    setPin("");
    setMessage(
      delay > 0
        ? `الرمز غير صحيح (${attempts} محاولات) — انتظر ${Math.ceil(delay / 1000)} ثانية ثم أعد المحاولة.`
        : "الرمز غير صحيح — أعد المحاولة.",
    );
    setState({ phase: "locked", failedAttempts: attempts });
  }

  /* مراجعة 5-RV-D: بنية ثابتة في الحالتين — غلاف المحتوى نفسه في كل إعادة
   * رسم (لا إعادة تركيب عند القفل/الفتح فتبقى حالات النماذج محفوظة تحت
   * الغطاء)، والخمول (inert) عند القفل فقط فيمنع تجاوز القفل بالمفاتيح
   * وتجوال التركيز إلى ما تحت الغطاء؛ الغطاء نفسه بلا حالة فيأتي ويذهب. */
  const locked = state.phase === "locked";
  return (
    <>
      {locked ? (
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
                والاتجاه المعزول كنمط EnglishNumberInput بلا قيمة رقمية.
                المجموعة ٦ (تدقيق A1): أرقام لوحة المفاتيح العربية (٠–٩)
                تُطبّع إلى الإنجليزية عند الإدخال كما في كل حقول الأرقام،
                والإدخال مقنّع عن النظرة الجانبية (نمط كلمة مرور). */}
            <input
              type="password"
              value={pin}
              onChange={event =>
                setPin(normalizeAsciiDigits(event.target.value).replace(/[^0-9]/g, "").slice(0, 8))
              }
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
          {/* مراجعة 5-RV-D: صياغة صادقة — لا مسار استرداد بلا الرمز؛ التعطيل من
              الإعدادات يحتاج الرمز نفسه ولا بديل سحابي. */}
          لا يوجد استرداد بلا الرمز: تعطيل القفل من إعدادات هذا الجهاز يتطلب الرمز
          نفسه، ولا يوجد بديل سحابي. بياناتك تبقى محلية كما هي.
        </p>
          </div>
        </>
      ) : null}
      <div inert={locked}>{children}</div>
    </>
  );
}