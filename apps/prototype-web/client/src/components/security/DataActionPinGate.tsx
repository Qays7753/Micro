/**
 * المجموعة ٦ (تدقيق A1 — SP-01/DP-04): مسارات الاسترداد العامة (/settings)
 * معفاة من غطاء القفل الكامل (الطوارئ لا تُقفل)، لكن إجراءات مغادرة البيانات
 * نفسها (تصدير النسخة، استيراد بديل، البدء من جديد) لا تخرج بلا الرمز —
 * إثبات الرمز مرة واحدة في الجلسة يفتح البوابة، والفشل يخضع لعدّاد الخدمة
 * ووقفتها المُنفَّذة. النافذة حوار تحذير كامل الشاشة بلغة غطاء القفل نفسها.
 */
import { useRef, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { normalizeAsciiDigits } from "@/application/input";

import { Button } from "@/components/primitives";
import { useOverlayFocusContract } from "./overlayFocusContract";
export function DataActionPinGate({
  actionTitle,
  actionDescription,
  onVerified,
  onCancel,
}: {
  actionTitle: string;
  actionDescription: string;
  onVerified: () => void;
  onCancel: () => void;
}) {
  const { localLock } = usePrototypeServices();
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  /* R11 W4 / D-14 (OD-A11Y): عقد التركيز الكامل للمودال الحقيقي — ستار
   * + focus-in + احتواء Tab + Escape=إلغاء + استعادة؛ لا تغيير بصري
   * ولا منطق رمز. */
  useOverlayFocusContract(overlayRef, onCancel);

  async function submit() {
    if (busy || pin.trim().length < 4) return;
    setBusy(true);
    const result = await localLock.unlock(pin);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (result.value.unlocked) {
      setPin("");
      setMessage(null);
      onVerified();
      return;
    }
    const delay = result.value.retryInMs ?? 0;
    setPin("");
    setMessage(
      delay > 0
        ? `الرمز غير صحيح — انتظر ${Math.ceil(delay / 1000)} ثانية ثم أعد المحاولة.`
        : "الرمز غير صحيح — أعد المحاولة.",
    );
  }

  return (
    <>
      <div aria-hidden="true" className="micro-lock-veil" />
      <div
        ref={overlayRef}
        tabIndex={-1}
        className="micro-lock-overlay"
        role="alertdialog"
        aria-modal="true"
        aria-label="تأكيد رمز القفل"
      >
        <Lock aria-hidden="true" className="micro-lock-icon" />
        <h1>{actionTitle}</h1>
        <p>{actionDescription}</p>
        <form
          className="micro-lock-form"
          onSubmit={event => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="micro-field">
            <span>رمز القفل</span>
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
            />
          </label>
          <Button action="save" type="submit" disabled={busy || pin.trim().length < 4}>
            <LockOpen aria-hidden="true" /> أكمل الإجراء
          </Button>
          <Button action="secondary" onClick={onCancel}>
            إلغاء
          </Button>
        </form>
        {message ? (
          <p className="micro-field-error" role="alert">
            {message}
          </p>
        ) : null}
      </div>
    </>
  );
}
