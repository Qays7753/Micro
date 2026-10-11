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
import { Button } from "@/components/primitives";
import { todayInAmman } from "@/application/time";

/* R9-GA-F3.2 + R9-W3-F1 (استمرار R9 — آلة حالة القراءة الصريحة): نفس
 * جذر عيب حارس العرض في محرر تراجع الكاش — سطح «لم نجد حركة المادة» كان
 * غير قابل للوصول عبر مسار النجاح، وفشل قراءة الحركات كان يُبتلع داخل
 * سطح «لم نجد». الفصل الصريح للمراحل يعطي كل حالة صادقة بذاتها، ونمط
 * خطأ القراءة هو نمط ReceivedLoanDetail نفسه. */
type ReversalReadState =
  | { phase: "loading" }
  | { phase: "not-found" }
  | { phase: "read-error"; message: string }
  | { phase: "ready"; movement: InventoryMovement };

export default function InventoryReversalEditor() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const { dataVersion, inventory, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<ReversalReadState>({ phase: "loading" });
  const [retryCount, setRetryCount] = useState(0);
  const [date, setDate] = useState(todayInAmman);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const operationKey = useRef(`inventory-reversal-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  useEffect(() => {
    let active = true;
    void inventory.movements().then(result => {
      if (!active) return;
      if (!result.ok) {
        setState({ phase: "read-error", message: result.message });
        return;
      }
      const found = result.value.find(candidate => candidate.id === id) ?? null;
      setState(found ? { phase: "ready", movement: found } : { phase: "not-found" });
    });
    return () => {
      active = false;
    };
  }, [id, inventory, dataVersion, retryCount]);
  /* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة — الرجوع يمر
   * بالحارس: «ابقَ / احفظ ثم اخرج / اخرج بلا حفظ» كبقية المحررات العميقة. */
  const isDirty = useFormDirty([date, reason]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });

  async function save(): Promise<boolean> {
    /* R9-GA-F3.2/W3-F1: لا حفظ ولا رسالة خارج مرحلة الجاهزية — حارس
     * الحوار (احفظ ثم اخرج) قد يستدعي الحفظ بعد تغيّر المرحلة. */
    if (state.phase !== "ready") return false;
    if (!reason.trim()) {
      setMessage("أدخل سبب التراجع عن حركة المادة.");
      return false;
    }
    setSaving(true);
    const result = await inventory.reverse({
      movementId: state.movement.id,
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
    /* S1-07 (R9-GA-F3.3 — استمرار R9): الخروج بعد حفظ ناجح يعود للمصدر
     * (?from) مع البديل القانوني — عقد ٢٦ قاعدة ٣، كمحررات التراجع
     * الأخرى؛ الوجهة الثابتة كانت استثناءً بلا مستند عقدي. */
    navigate(returnPath);
    return true;
  }
  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح حركة المادة…
      </div>
    );
  if (state.phase === "not-found")
    return (
      <section className="micro-page micro-not-found">
        <h1>لم نجد حركة المادة</h1>
        <p>ارجع إلى المواد واختر حركة محفوظة.</p>
        <Button
          action="secondary"

          onClick={() => navigate("/inventory")}
        >
          المواد والمخزون
        </Button>
      </section>
    );
  if (state.phase === "read-error")
    /* R9-GA-F3.2: فشل القراءة يُعرض برسالته الفعلية لا مموّهًا ك«عدم
     * وجود» — نمط ReceivedLoanDetail: زر رجوع + رسالة الخطأ الحقيقية
     * بصفة alert + إعادة محاولة. لا حفظ ولا تنقل ولا إشعار هنا. */
    return (
      <section className="micro-page">
        <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
          المواد والمخزون
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
  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
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
          <strong>{state.movement.note}</strong>
          <p>
            <LocalDateValue value={state.movement.occurredOn} /> · الكمية{" "}
            <QuantityValue valueMilli={state.movement.quantityDeltaMilli} className="micro-inline-number" />
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
          <p className="micro-field-error" role="alert">
            {message}
          </p>
        ) : null}
        <Button
          action="commit"
          block

          disabled={saving}
          onClick={save}
        >
          <Save aria-hidden="true" />
          {saving ? "جارٍ الحفظ…" : "حفظ التراجع"}
        </Button>
      </section>
    </section>
  );
}
