/**
 * Post-Group 6 continuous completion (G02 — Q129): قسم «إلغاء حجز جارٍ
 * إداريًا» داخل لوحة المشرف — بسبب إلزامي مكتوب وتأكيد صريح، ويُبلَّغ
 * صاحب الحجز فورًا (خادميًا). جزء من وحدة لوحة المشرف المنفصلة.
 */
import { useState } from "react";
import { adminCancelBooking } from "@/application/admin";
import { ApiError } from "@/application/network";
import { Button } from "@/components/primitives";

export function AdminCancelBooking({ onActioned }: { onActioned: () => void }) {
  const [bookingId, setBookingId] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(): Promise<void> {
    if (bookingId.trim().length < 2 || reason.trim().length < 4) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await adminCancelBooking(bookingId.trim(), reason.trim());
      setBusy(false);
      setNotice("أُلغي الحجز إداريًا وأُبلغ صاحب الحجز فورًا بسبب القرار.");
      setBookingId("");
      setReason("");
      setConfirming(false);
      onActioned();
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof ApiError ? cause.message : "تعذر الإلغاء الإداري الآن — أعد المحاولة.");
    }
  }

  return (
    <section className="micro-admin-section" aria-labelledby="admin-cancel-title">
      <h2 id="admin-cancel-title">إلغاء حجز جارٍ إداريًا</h2>
      {!confirming ? (
        <Button action="secondary" onClick={() => setConfirming(true)}>
          ألغِ حجزًا جاريًا بقرار إداري
        </Button>
      ) : (
        <div className="micro-confirm-box" role="alertdialog" aria-label="تأكيد الإلغاء الإداري">
          <p>
            الإلغاء الإداري للحجز الجارٍ فعل نهائي بسبب مكتوب — يُبلَّغ صاحب الحجز فورًا، ويبقى سجل الحجز
            للطرفين.
          </p>
          <label className="micro-field">
            <span>معرّف الحجز</span>
            <input value={bookingId} onChange={event => setBookingId(event.target.value)} dir="ltr" />
          </label>
          <label className="micro-field">
            <span>السبب (إلزامي)</span>
            <input
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder="مثال: خطر على الناس"
            />
          </label>
          <div className="micro-form-actions">
            <Button action="quiet" disabled={busy} onClick={() => setConfirming(false)}>
              تراجع
            </Button>
            <Button
              action="commit"
              disabled={busy || bookingId.trim().length < 2 || reason.trim().length < 4}
              onClick={() => void run()}
            >
              {busy ? "جارٍ الإلغاء…" : "ألغِ الحجز"}
            </Button>
          </div>
        </div>
      )}
      {notice ? (
        <p className="micro-save-note" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="micro-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
