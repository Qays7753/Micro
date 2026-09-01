/** Style: Micro «مسار القرار» — reversal preserves the original trace and explains why it is being negated. */
/* مبدأ Micro: يبقى أصل حركة الكاش محفوظًا، ويعرض تاريخ العكس بوضوح قبل التسجيل. */
import { ArrowRight, RotateCcw, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import { localDateInAmman } from "@/presentation/formatters";

const ammanDate = () => localDateInAmman();
export default function CashReversalEditor() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const { cashContinuity, notifyDataChanged } = usePrototypeServices();
  const [entry, setEntry] = useState<CashContinuityEntry | null>(null);
  const [date, setDate] = useState(() => ammanDate());
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const operationKey = useRef(`cash-reversal-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  useEffect(() => {
    cashContinuity.entries().then(result => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setEntry(result.value.find(candidate => candidate.id === id) ?? null);
    });
  }, [cashContinuity, id]);
  /* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة — الرجوع يمر
   * بالحارس: «ابقَ / احفظ ثم اخرج / اخرج بلا حفظ» كبقية المحررات العميقة. */
  const isDirty = useFormDirty([
      date,
      reason,
    ]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });

  async function save(): Promise<boolean> {
    if (!entry || !reason.trim()) {
      setMessage("اذكر سبب التراجع قبل الحفظ.");
      return false;
    }
    setSaving(true);
    const result = await cashContinuity.reverse({
      entryId: entry.id,
      occurredOn: date,
      reason,
      operationKey: operationKey.current,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    notifyDataChanged();
    navigate("/cash");
    return true;
  }
  if (!entry && !message)
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح الأثر…
      </div>
    );
  if (!entry)
    return (
      <section className="micro-page micro-not-found">
        <h1>لم نجد أثر الكاش</h1>
        <p>قد يكون السجل حُذف من هذا الجهاز أو تم التراجع عنه سابقًا.</p>
        <button className="micro-button micro-button-primary" type="button" onClick={() => navigate("/cash")}>
          محافظ الكاش
        </button>
      </section>
    );
  return (
    <section className="micro-page micro-finance-page">
      <button
        className="micro-back-button"
        type="button"
        onClick={() => requestNavigation(returnPath)}
      >
        <ArrowRight aria-hidden="true" /> محافظ الكاش
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">تراجع محفوظ</span>
        <h1>تراجع عن هذا الأثر</h1>
        <p>سيبقى الأصل ظاهرًا، ويضاف أثر مقابل له بدل الحذف أو التعديل الصامت.</p>
      </div>
      <section className="micro-decision-card">
        <RotateCcw aria-hidden="true" />
        <div>
          <span>الأثر الذي سيتم التراجع عنه</span>
          <strong>
            <MoneyValue minor={entry.cashDeltaMinor} showPlus />
          </strong>
          <p>
            <LocalDateValue value={entry.occurredOn} /> · {entry.note}
          </p>
        </div>
      </section>
      <section className="micro-form-card">
        <LocalDateField label="تاريخ التراجع" value={date} onChange={event => setDate(event.target.value)} />
        <label className="micro-field">
          <span>لماذا تتراجع عنه؟</span>
          <textarea
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="مثال: سجلت فرق الجرد بالعكس"
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
          {saving ? "جارٍ الحفظ…" : "حفظ التراجع"}
        </button>
      </section>
    </section>
  );
}
