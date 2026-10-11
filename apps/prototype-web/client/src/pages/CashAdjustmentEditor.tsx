/** Style: Micro «مسار القرار» — correction records a reason, it does not rewrite a balance silently. */
/* مبدأ Micro: يظهر ضبط الكاش كأثر مسبب، ويظل التاريخ المحلي قابلًا للقراءة دون إعادة تفسيره. */
import { ArrowRight, Save, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { CashWalletBalance } from "@/application/cash";

import { Button } from "@/components/primitives";
import { todayInAmman } from "@/application/time";

/* R9-GA-F3.7 (استمرار R9 الجذري — عائلة F3.1/F3.2/W3-F1): حارس العرض
 * القديم (!wallet && !message ⇒ تحميل، !wallet ⇒ «لم نجد») يجعل مسار نجاح
 * القراءة لمحفظة مجهولة الهوية تحميلًا أبديًا، ويبتلع فشل القراءة داخل سطح
 * «لم نجد» (رسالة الخطأ الفعلية لا تُعرض أبدًا). الفصل الصريح للمراحل
 * (تحميل/جاهز/غير موجود/خطأ قراءة) يجعل كل حالة صادقة بذاتها — نفس نمط
 * CashReversalEditor/EstimateDetail؛ لا تغيير في النصوص العربية القائمة
 * ولا في أي سطح بصري إلا سطح خطأ القراءة الجديد وفق النمط القائم. */
type AdjustmentReadState =
  | { phase: "loading" }
  | { phase: "not-found" }
  | { phase: "read-error"; message: string }
  | { phase: "ready"; wallet: CashWalletBalance };

export default function CashAdjustmentEditor() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const { dataVersion, cashContinuity, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<AdjustmentReadState>({ phase: "loading" });
  const [retryCount, setRetryCount] = useState(0);
  const [direction, setDirection] = useState<"increase" | "decrease">("decrease");
  const [amountMinor, setAmountMinor] = useState(0);
  const [validAmount, setValidAmount] = useState(true);
  const [date, setDate] = useState(todayInAmman);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const operationKey = useRef(`cash-adjustment-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  useEffect(() => {
    let active = true;
    cashContinuity.overview().then(result => {
      if (!active) return;
      if (!result.ok) {
        setState({ phase: "read-error", message: result.message });
        return;
      }
      const found = result.value.wallets.find(candidate => candidate.id === id) ?? null;
      setState(found ? { phase: "ready", wallet: found } : { phase: "not-found" });
    });
    return () => {
      active = false;
    };
  }, [cashContinuity, id, dataVersion, retryCount]);
  /* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة — الرجوع يمر
   * بالحارس: «ابقَ / احفظ ثم اخرج / اخرج بلا حفظ» كبقية المحررات العميقة. */
  const isDirty = useFormDirty([direction, amountMinor, date, reason, note]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });

  async function save(): Promise<boolean> {
    /* R9-GA-F3.7: لا حفظ ولا رسالة خارج مرحلة الجاهزية — حارس الحوار
     * (احفظ ثم اخرج) قد يستدعي الحفظ بعد تغيّر المرحلة. */
    if (state.phase !== "ready") return false;
    const { wallet } = state;
    if (!validAmount || amountMinor <= 0 || !reason.trim() || !note.trim()) {
      setMessage("أدخل فرق الكاش وسببًا وبيانًا قبل الحفظ.");
      return false;
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
      return false;
    }
    notifyDataChanged();
    /* S1-07: الخروج بعد حفظ ناجح يعود للمصدر (?from) — عقد ٢٦ قاعدة ٣. */
    navigate(returnPath);
    return true;
  }
  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح المحفظة…
      </div>
    );
  if (state.phase === "not-found")
    return (
      <section className="micro-page micro-not-found">
        <h1>لم نجد محفظة الكاش</h1>
        <p>ارجع إلى المحافظ واختر مكان كاش مسجلًا.</p>
        <Button action="secondary" onClick={() => navigate("/cash")}>
          محافظ الكاش
        </Button>
      </section>
    );
  if (state.phase === "read-error")
    /* R9-GA-F3.7: فشل القراءة يُعرض برسالته الفعلية لا مموّهًا ك«عدم
     * وجود» — نمط ReceivedLoanDetail: زر رجوع + رسالة الخطأ الحقيقية
     * بصفة alert + إعادة محاولة. لا حفظ ولا تنقل ولا إشعار هنا. */
    return (
      <section className="micro-page">
        <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
          محافظ الكاش
        </button>
        <p className="micro-field-error" role="alert">
          {state.message}
        </p>
        <div className="micro-form-actions">
          <Button action="save" onClick={() => setRetryCount(count => count + 1)}>
            إعادة المحاولة
          </Button>
        </div>
      </section>
    );
  const wallet = state.wallet;
  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
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
          <p className="micro-field-error" role="alert">
            {message}
          </p>
        ) : null}
        <div className="micro-form-actions micro-sticky-save">
          <Button
            action="save"
            block

            disabled={saving}
            onClick={save}
          >
            <Save aria-hidden="true" />
            {saving ? "جارٍ الحفظ…" : "حفظ ضبط الكاش"}
          </Button>
        </div>
      </section>
    </section>
  );
}
