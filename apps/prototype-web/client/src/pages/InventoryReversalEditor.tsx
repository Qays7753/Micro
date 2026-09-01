/** Style: Micro correction path — an inventory correction adds an opposite movement; it never erases stock history. */
/* مبدأ Micro: يبقى أصل حركة المخزون ظاهرًا، ويشرح تاريخ العكس دون تغيير التاريخ السابق. */
import { ArrowRight, RotateCcw, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { InventoryMovement } from "@micro-domain/inventory-material/index.js";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { LocalDateValue, QuantityValue } from "@/components/presentation/DisplayValue";
import { localDateInAmman } from "@/presentation/formatters";
const ammanDate = () => localDateInAmman();
export default function InventoryReversalEditor() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const { inventory, notifyDataChanged } = usePrototypeServices();
  const [movement, setMovement] = useState<InventoryMovement | null>(null);
  const [date, setDate] = useState(ammanDate);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const operationKey = useRef(`inventory-reversal-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  useEffect(() => {
    inventory.movements().then(result => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMovement(result.value.find(candidate => candidate.id === id) ?? null);
    });
  }, [id, inventory]);
  /* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة — الرجوع يمر
   * بالحارس: «ابقَ / احفظ ثم اخرج / اخرج بلا حفظ» كبقية المحررات العميقة. */
  const isDirty = useFormDirty([date, reason]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });

  async function save(): Promise<boolean> {
    if (!movement || !reason.trim()) {
      setMessage("أدخل سبب التراجع عن حركة المادة.");
      return false;
    }
    setSaving(true);
    const result = await inventory.reverse({
      movementId: movement.id,
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
    navigate("/inventory");
    return true;
  }
  if (!movement && !message)
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح حركة المادة…
      </div>
    );
  if (!movement)
    return (
      <section className="micro-page micro-not-found">
        <h1>لم نجد حركة المادة</h1>
        <p>ارجع إلى المواد واختر حركة محفوظة.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/inventory")}
        >
          المواد والمخزون
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
        <ArrowRight aria-hidden="true" /> المواد والمخزون
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">تراجع محفوظ</span>
        <h1>تراجع عن حركة المادة</h1>
        <p>يبقى الأصل ظاهرًا ويضاف أثر مقابل له بدل الحذف أو التعديل الصامت.</p>
      </div>
      <section className="micro-decision-card">
        <RotateCcw aria-hidden="true" />
        <div>
          <span>الأثر الذي سيتم التراجع عنه</span>
          <strong>{movement.note}</strong>
          <p>
            <LocalDateValue value={movement.occurredOn} /> · الكمية{" "}
            <QuantityValue valueMilli={movement.quantityDeltaMilli} className="micro-inline-number" />
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
            placeholder="مثال: سجلت كمية أو مادة خاطئة"
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
