/**
 * المجموعة ٥ (عقد ٣٧ — بوابة القفل المحلي): غطاء قفل كامل الشاشة فوق المحتوى
 * لا بديلًا عنه — النماذج المفتوحة تبقى محمّلة تحته فلا يفقد المالك شيئًا
 * غير محفوظ بمجرد الخمول.
 *
 * سلوك البوابة:
 * - إخفاء التطبيق (تبديل/شاشة قفل) يعلّم آخر نشاط؛ الظهور يفحص مدة الخمول
 *   ويقفل عند تجاوزها — النمط ذاته الذي أثبتته تجربة Zman (IdleLock).
 * - نبض ٣٠ ثانية أثناء الظهور يجدد النشاط عند الإدخال الفعلي وحده (R11 Lock
 *   Remediation — OD-LOCK-SEMANTICS=A): الظاهر بلا إدخال يقفل بعد الخمول
 *   المختار، والفحص الابتدائي وفشل القراءة لا يفتحان أبدًا (OD-LOCK-STORAGE=A
 *   — حالة unreadable صادقة قابلة للاستعادة).
 * - مسارات الاسترداد العامة (/setup، /settings) معفاة — الطوارئ لا تُقفل.
 * - الرمز لا يُخزَّن ولا يُصدَّر؛ البصمة فقط (عقد ٣٧).
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { LocalLockService } from "@/application/security";
import { normalizeAsciiDigits } from "@/application/input";
import { isPublicLocalRecoveryRoute } from "@/app/StartupGate";

import { Button } from "@/components/primitives";
const HEARTBEAT_MS = 30_000;

/* R11 Lock Remediation (OD-LOCK-STORAGE=A — R11-W1B4-NF-003): الحالات
 * مفصولة بصدق — checking وopen (بعد قراءة موثوقة ناجحة فقط) وlocked
 * وunreadable (فشل قراءة التخزين: لا فتح أبدًا، والمحتوى خامل مع خطأ صادق). */
type GateState =
  | { phase: "checking" }
  | { phase: "open" }
  | { phase: "locked"; failedAttempts: number }
  | { phase: "unreadable" };

export function AppLockGate({ children }: { children: ReactNode }) {
  const { localLock } = usePrototypeServices();
  const [location] = useLocation();
  const [state, setState] = useState<GateState>({ phase: "checking" });
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const busyRef = useRef(false);
  /* R11 Lock Remediation (OD-LOCK-SEMANTICS=A — R11-W1B4-NF-004): آخر إدخال
   * فعلي على مستوى المكوّن — null حتى يقع إدخال حقيقي؛ لا قيمة بدء مزيفة
   * فالنبض بلا إدخال يقيّم فقط ولا يجدد النشاط أبدًا. */
  const lastInputAtRef = useRef<number | null>(null);

  const evaluate = useCallback(async () => {
    if (isPublicLocalRecoveryRoute(location.split("?")[0] ?? location)) {
      setState(current => (current.phase === "open" ? current : { phase: "open" }));
      return;
    }
    const status = await localLock.status();
    /* R11 Lock Remediation (OD-LOCK-STORAGE=A — R11-W1B4-NF-003): فشل قراءة
     * حالة القفل ليس «لا قفل» — لا فتح أبدًا؛ حالة unreadable صادقة والمحتوى
     * المحمي خامل غير قابل للتفاعل أو التركيز حتى قراءة موثوقة ناجحة. */
    if (!status.ok) {
      setState(current => (current.phase === "unreadable" ? current : { phase: "unreadable" }));
      return;
    }
    if (!status.value.enabled) {
      setState({ phase: "open" });
      return;
    }
    const shouldLock = await localLock.shouldLockNow();
    if (!shouldLock.ok) {
      setState(current => (current.phase === "unreadable" ? current : { phase: "unreadable" }));
      return;
    }
    if (shouldLock.value) {
      setPin("");
      setMessage(null);
      setState({ phase: "locked", failedAttempts: 0 });
    } else {
      /* R11 Lock Remediation (OD-LOCK-SEMANTICS=A — R11-W1B4-NF-004): التقييم
       * السلبي لا يجدد النشاط — الإدخال الفعلي وحده (أو الفتح الناجح داخل
       * الخدمة) يحدّث آخر نشاط، فالظاهر بلا إدخال يقفل بعد المدة المختارة. */
      setState(current => (current.phase === "locked" ? current : { phase: "open" }));
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

  /* نبض أثناء الاستخدام المتواصل يحدّث آخر نشاط عند الإدخال الفعلي فقط.
   * المجموعة ٦ (تدقيق A1 — SP-03؛ صُدِّق ونُفِّذ بموجب OD-LOCK-SEMANTICS=A في
   * موجة إصلاح القفل 2026-10-15): «الاستخدام» = إدخال فعلي (لمس/مفاتيح/
   * عجلة)، لا مجرد ظهور التبويب — الجهاز المفتوح بلا لمس على سطح المكتب
   * يُقفل بعد الخمول المختار كما يعد الإعداد، والقراءة المتصلة مع أي تمرير
   * تبقى حية. النبض بلا إدخال يقيّم فقط ولا يلمس أبدًا. */
  useEffect(() => {
    if (state.phase !== "open") return;
    const markInput = () => {
      lastInputAtRef.current = Date.now();
    };
    const inputEvents: Array<keyof DocumentEventMap> = ["pointerdown", "keydown", "wheel", "touchstart"];
    inputEvents.forEach(type => document.addEventListener(type, markInput, { passive: true }));
    const interval = globalThis.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const lastInputAt = lastInputAtRef.current;
      /* الإدخال الفعلي الحديث وحده يجدد النشاط؛ النبض بلا إدخال يقيّم فقط —
       * فالظاهر الخالي من الإدخال يقفل عند أول تقييم فوق العتبة. */
      if (lastInputAt !== null && Date.now() - lastInputAt <= HEARTBEAT_MS) void localLock.touchActivity();
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

  /* R11 Lock Remediation (OD-LOCK-STORAGE=A): استعادة صادقة من حالة القراءة
   * غير الموثوقة — إعادة تقييم كاملة من checking بلا أي كتابة بيانات. */
  async function retryAfterUnreadable() {
    setState({ phase: "checking" });
    await evaluate();
  }

  /* مراجعة 5-RV-D: بنية ثابتة — غلاف المحتوى نفسه في كل إعادة رسم (لا
   * إعادة تركيب عند القفل/الفتح فتبقى حالات النماذج محفوظة تحت الغطاء)،
   * والخمول (inert) في كل حالة غير المفتوح (checking/قفل/فشل قراءة — R11
   * Lock Remediation) فيمنع تجاوز القفل بالمفاتيح وتجوال التركيز إلى ما
   * تحت الغطاء؛ الغطاء نفسه بلا حالة فيأتي ويذهب. */
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
              أدخل رمز القفل لمتابعة عملك كما تركته — بياناتك محلية على هذا الجهاز كما هي، والقفل يحمي من
              النظرة العابرة فقط.
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
                    setPin(
                      normalizeAsciiDigits(event.target.value)
                        .replace(/[^0-9]/g, "")
                        .slice(0, 8),
                    )
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  dir="ltr"
                  lang="en"
                  pattern="[0-9]*"
                  autoFocus
                />
              </label>
              <Button action="save" type="submit" disabled={pin.trim().length < 4}>
                <LockOpen aria-hidden="true" /> افتح
              </Button>
            </form>
            {message ? (
              <p className="micro-field-error" role="alert">
                {message}
              </p>
            ) : null}
            <p className="micro-offline-truth">
              {/* مراجعة 5-RV-D: صياغة صادقة — لا مسار استرداد بلا الرمز؛ التعطيل من
              الإعدادات يحتاج الرمز نفسه ولا بديل سحابي. */}
              لا يوجد استرداد بلا الرمز: تعطيل القفل من إعدادات هذا الجهاز يتطلب الرمز نفسه، ولا يوجد بديل
              سحابي. بياناتك تبقى محلية كما هي.
            </p>
          </div>
        </>
      ) : null}
      {state.phase === "unreadable" ? (
        <>
          {/* المحتوى يبقى محجوبًا خاملًا تحته — فشل قراءة سجل القفل ليس دليل
              غيابه؛ الخطأ صادق قابل للاستعادة بلا تغيير أي بيانات وبلا أي
              فعل تدميري أو مالي (عقد ٣٧ مبدأ ٥ — غياب القفل ليس تحققًا). */}
          <div aria-hidden="true" className="micro-lock-veil" />
          <div
            className="micro-lock-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="تعذر التحقق من قفل Micro"
          >
            <Lock aria-hidden="true" className="micro-lock-icon" />
            <h1>تعذر التحقق من حالة القفل</h1>
            <p>
              لم يستطع التطبيق قراءة إعداد القفل من التخزين المحلي. حُجب المحتوى احتياطًا ولم تتغير أي بيانات
              — أعد المحاولة، فإن تكرر الفشل أغلق أي نوافذ أخرى مفتوحة لهذا التطبيق ثم أعد تحميله.
            </p>
            <Button action="save" type="button" onClick={() => void retryAfterUnreadable()}>
              أعد المحاولة
            </Button>
          </div>
        </>
      ) : null}
      <div inert={state.phase !== "open"}>{children}</div>
    </>
  );
}
