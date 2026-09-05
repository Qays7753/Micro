/**
 * المجموعة ٥ (عقد ٣٧): بطاقة إعداد القفل المحلي داخل الإعدادات — تفعيل برمز
 * مع اختيار مدة الخمول، أو تعطيل بالرمز الحالي. الوعد الصادق معروض دائمًا:
 * حماية من النظرة العابرة على هذا الجهاز، لا تشفير ولا سحابة.
 */
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { LOCK_AUTO_LOCK_OPTIONS } from "@/application/security/localLockService";

type Phase = "loading" | "off" | "enabling" | "on" | "disabling";

const autoLockLabel = (minutes: number | null): string => {
  if (minutes === null) return "يدويًا فقط";
  if (minutes === 1) return "بعد دقيقة";
  /* مراجعة 5-RV-D: قاعدة الجمع العربي ٣–١١ مفرد (٣ دقائق) و١٢+ جمع
   * (٣٠ دقيقة) — الرقم 30 يدخل باب الجمع. */
  if (minutes <= 10) return `بعد ${minutes} دقائق`;
  return `بعد ${minutes} دقيقة`;
};

export function LockSettingsCard() {
  const { localLock, notifyDataChanged } = usePrototypeServices();
  const [phase, setPhase] = useState<Phase>("loading");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [autoLockMinutes, setAutoLockMinutes] = useState<number | null>(10);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void localLock.status().then(result => {
      if (!active || !result.ok) {
        if (active) setPhase(result.ok ? "off" : "off");
        return;
      }
      if (active) {
        setPhase(result.value.enabled ? "on" : "off");
        if (result.value.autoLockMinutes !== undefined) setAutoLockMinutes(result.value.autoLockMinutes);
      }
    });
    return () => {
      active = false;
    };
  }, [localLock]);

  async function enable() {
    if (pin !== confirmPin) {
      setMessage("الرمز وتأكيده غير متطابقين — أعد كتابتهما.");
      return;
    }
    const result = await localLock.enable(pin, autoLockMinutes);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setPin("");
    setConfirmPin("");
    setMessage(null);
    setPhase("on");
    notifyDataChanged();
  }

  async function disable() {
    const result = await localLock.disable(pin);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setPin("");
    setMessage(null);
    setPhase("off");
    notifyDataChanged();
  }

  return (
    <article className="micro-setting-row">
      <span className="micro-setting-icon">
        <Lock aria-hidden="true" />
      </span>
      <div>
        <h2>قفل التطبيق المحلي</h2>
        <p>
          رمز محلي يُقفل Micro بعد الخمول أو عند عودتك للتطبيق — يحمي من النظرة العابرة
          على هذا الجهاز فقط، وليس تشفيرًا للبيانات ولا حسابًا سحابيًا. الرمز نفسه لا
          يُخزَّن ولا يخرج من الجهاز أبدًا.
        </p>
        {phase === "loading" ? <p>يُقرأ إعداد القفل…</p> : null}
        {phase === "on" ? (
          <>
            <p>
              مفعّل — يُقفل {autoLockLabel(autoLockMinutes)} من إخفاء التطبيق؛ نموذج مفتوح تبقى
              قيمه محفوظة كممسودة نصية حيث تدعمها الشاشة.
            </p>
            <div className="micro-lock-admin">
              <label className="micro-field">
                <span>أدخل الرمز الحالي للتعطيل</span>
                <input
                  type="text"
                  value={pin}
                  onChange={event => setPin(event.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
                  inputMode="numeric"
                  dir="ltr"
                  lang="en"
                  pattern="[0-9]*"
                  autoComplete="off"
                />
              </label>
              <button
                className="micro-button micro-button-secondary"
                type="button"
                disabled={pin.trim().length < 4}
                onClick={() => void disable()}
              >
                عطّل القفل
              </button>
            </div>
          </>
        ) : null}
        {phase === "off" || phase === "enabling" ? (
          <>
            <div className="micro-form-actions" role="group" aria-label="مدة القفل التلقائي">
              {LOCK_AUTO_LOCK_OPTIONS.map(option => (
                <button
                  key={String(option)}
                  className="micro-text-action"
                  type="button"
                  aria-pressed={autoLockMinutes === option}
                  onClick={() => setAutoLockMinutes(option)}
                >
                  {autoLockLabel(option)}
                </button>
              ))}
            </div>
            <div className="micro-lock-admin">
              <label className="micro-field">
                <span>رمز من 4 إلى 8 أرقام إنجليزية</span>
                <input
                  type="text"
                  value={pin}
                  onChange={event => setPin(event.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
                  inputMode="numeric"
                  dir="ltr"
                  lang="en"
                  pattern="[0-9]*"
                  autoComplete="off"
                />
              </label>
              <label className="micro-field">
                <span>أكّد الرمز</span>
                <input
                  type="text"
                  value={confirmPin}
                  onChange={event => setConfirmPin(event.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
                  inputMode="numeric"
                  dir="ltr"
                  lang="en"
                  pattern="[0-9]*"
                  autoComplete="off"
                />
              </label>
              <button
                className="micro-button micro-button-primary"
                type="button"
                disabled={pin.trim().length < 4 || confirmPin.trim().length < 4}
                onClick={() => void enable()}
              >
                فعّل القفل
              </button>
            </div>
          </>
        ) : null}
        {message ? (
          <p className="micro-field-error" role="alert">
            {message}
          </p>
        ) : null}
      </div>
    </article>
  );
}
