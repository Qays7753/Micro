/** Style: Micro «مسار القرار» — correction records a reason, it does not rewrite a balance silently. */
/* مبدأ Micro: يظهر ضبط الكاش كأثر مسبب، ويظل التاريخ المحلي قابلًا للقراءة دون إعادة تفسيره. */
import { ArrowRight, Save, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import type { CashWalletBalance } from "@/application/cash/cashContinuityService";
import { localDateInAmman } from "@/presentation/formatters";

const ammanDate = () => localDateInAmman();
export default function CashAdjustmentEditor() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { cashContinuity, notifyDataChanged } = usePrototypeServices();
  const [wallet, setWallet] = useState<CashWalletBalance | null>(null);
  const [direction, setDirection] = useState<"increase" | "decrease">("decrease");
  const [amountMinor, setAmountMinor] = useState(0);
  const [validAmount, setValidAmount] = useState(true);
  const [date, setDate] = useState(ammanDate);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const operationKey = useRef(`cash-adjustment-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  useEffect(() => {
    cashContinuity.overview().then(result => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setWallet(result.value.wallets.find(candidate => candidate.id === id) ?? null);
    });
  }, [cashContinuity, id]);
  async function save() {
    if (!wallet || !validAmount || amountMinor <= 0 || !reason.trim() || !note.trim()) {
      setMessage("أدخل فرق الكاش وسببًا وبيانًا قبل الحفظ.");
      return;
    }
    setSaving(true);
    const result = await cashContinuity.adjust({
      walletId: wallet.id,
      deltaMinor: direction === "increase" ? amountMinor : -amountMinor,
      occurredOn: date,
      note,
      reason,
      operationKey: operationKey.current,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    navigate("/cash");
  }
  if (!wallet && !message)
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح المحفظة…
      </div>
    );
  if (!wallet)
    return (
      <section className="micro-page micro-not-found">
        <h1>لم نجد محفظة الكاش</h1>
        <p>ارجع إلى المحافظ واختر مكان كاش مسجلًا.</p>
        <button className="micro-button micro-button-primary" type="button" onClick={() => navigate("/cash")}>
          محافظ الكاش
        </button>
      </section>
    );
  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => navigate("/cash")}>
        <ArrowRight aria-hidden="true" /> محافظ الكاش
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">تصحيح محفوظ</span>
        <h1>اضبط كاش {wallet.name}</h1>
        <p>لا يعدّل هذا السجل القديم. يضيف فرقًا واضحًا بسبب كي ترى ما حدث لاحقًا.</p>
      </div>
      <section className="micro-decision-card">
        <SlidersHorizontal aria-hidden="true" />
        <div>
          <span>حد الحقيقة</span>
          <strong>الضبط ليس مبيعات ولا مصروفًا.</strong>
          <p>سيغير رصيد المحفظة والكاش المسجل فقط، مع سبب وتاريخ.</p>
        </div>
      </section>
      <section className="micro-form-card">
        <label className="micro-field">
          <span>اتجاه فرق الكاش</span>
          <select
            value={direction}
            onChange={event => setDirection(event.target.value as "increase" | "decrease")}
          >
            <option value="decrease">الكاش أقل من المسجل</option>
            <option value="increase">الكاش أكثر من المسجل</option>
          </select>
        </label>
        <label className="micro-field">
          <span>قيمة الفرق بالدينار الأردني</span>
          <EnglishNumberInput
            value={amountMinor}
            kind="money"
            onNumericChange={setAmountMinor}
            onTextValidityChange={setValidAmount}
            aria-label="فرق الكاش"
          />
        </label>
        <LocalDateField label="تاريخ الضبط" value={date} onChange={event => setDate(event.target.value)} />
        <label className="micro-field">
          <span>لماذا ظهر الفرق؟</span>
          <textarea
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="مثال: فرق بعد عدّ الدرج"
          />
        </label>
        <label className="micro-field">
          <span>بيان مختصر</span>
          <input
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="مثال: ضبط جرد يومي"
          />
        </label>
        {message ? (
          <p className="micro-field-error" role="status">
            {message}
          </p>
        ) : null}
        <button
          className="micro-button micro-button-primary micro-save-cost"
          type="button"
          disabled={saving}
          onClick={save}
        >
          <Save aria-hidden="true" />
          {saving ? "جارٍ الحفظ…" : "حفظ ضبط الكاش"}
        </button>
      </section>
    </section>
  );
}
