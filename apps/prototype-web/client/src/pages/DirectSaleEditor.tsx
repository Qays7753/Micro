/** Phone-first direct-sale form. It records a sale, never an order or inferred profit. */
import { ArrowRight, Save } from "lucide-react";
import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { localDateInAmman } from "@/presentation/formatters";

export default function DirectSaleEditor() {
  const [, navigate] = useLocation();
  const { directSales, notifyDataChanged } = usePrototypeServices();
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [validQuantity, setValidQuantity] = useState(true);
  const [revenueMinor, setRevenueMinor] = useState(0);
  const [validRevenue, setValidRevenue] = useState(true);
  const [costKnown, setCostKnown] = useState(false);
  const [costMinor, setCostMinor] = useState(0);
  const [validCost, setValidCost] = useState(true);
  const [occurredOn, setOccurredOn] = useState(() => localDateInAmman());
  const [note, setNote] = useState("بيع مباشر");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const idempotencyKey = useRef(`direct-sale-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);

  async function save() {
    if (
      !itemName.trim() ||
      !note.trim() ||
      !validQuantity ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !validRevenue ||
      revenueMinor <= 0 ||
      (costKnown && (!validCost || costMinor < 0))
    ) {
      setMessage("أكمل اسم البيع والكمية والمبلغ بالأرقام 0–9 قبل الحفظ.");
      return;
    }
    setMessage(null);
    setSaving(true);
    const result = await directSales.record({
      itemName,
      quantity,
      revenueMinor,
      costMinor: costKnown ? costMinor : null,
      occurredOn,
      note,
      idempotencyKey: idempotencyKey.current,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    navigate("/orders");
  }

  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => navigate("/orders")}>
        <ArrowRight aria-hidden="true" /> العمل
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">سجل بيع مستقل</span>
        <h1>تسجيل بيع مباشر</h1>
        <p>سجّل ما بعته وقيمته من دون إنشاء طلب. تحصيلات الطلبات تبقى في طلباتها ولا تظهر هنا.</p>
      </div>
      <section className="micro-decision-card">
        <div>
          <span>حد الحقيقة</span>
          <strong>التحصيل ليس ربحًا.</strong>
          <p>إذا لم تعرف التكلفة الآن، سيظهر الربح «غير متاح» بدل أن يفترضه النظام صفرًا.</p>
        </div>
      </section>
      <section className="micro-form-card">
        <label className="micro-field">
          <span>ما الذي بعته؟</span>
          <input value={itemName} onChange={event => setItemName(event.target.value)} placeholder="مثال: كوب جاهز" />
        </label>
        <label className="micro-field">
          <span>الكمية</span>
          <EnglishNumberInput
            value={quantity}
            kind="integer"
            onNumericChange={setQuantity}
            onTextValidityChange={setValidQuantity}
            aria-label="الكمية"
          />
        </label>
        <label className="micro-field">
          <span>المبلغ المحصل بالدينار الأردني</span>
          <EnglishNumberInput
            value={revenueMinor}
            kind="money"
            onNumericChange={setRevenueMinor}
            onTextValidityChange={setValidRevenue}
            aria-label="المبلغ المحصل"
          />
        </label>
        <label className="micro-field">
          <span>هل تعرف تكلفة ما بيع؟</span>
          <select value={costKnown ? "known" : "unknown"} onChange={event => setCostKnown(event.target.value === "known")}>
            <option value="unknown">لا أعرف الآن</option>
            <option value="known">نعم، أعرفها</option>
          </select>
          <small>عدم المعرفة يبقى معلومة ناقصة، ولا يسجّل تكلفة صفرية.</small>
        </label>
        {costKnown ? (
          <label className="micro-field">
            <span>التكلفة بالدينار الأردني</span>
            <EnglishNumberInput
              value={costMinor}
              kind="money"
              onNumericChange={setCostMinor}
              onTextValidityChange={setValidCost}
              aria-label="تكلفة البيع"
            />
          </label>
        ) : null}
        <LocalDateField label="تاريخ البيع" value={occurredOn} onChange={event => setOccurredOn(event.target.value)} />
        <label className="micro-field">
          <span>بيان مختصر</span>
          <textarea value={note} onChange={event => setNote(event.target.value)} />
        </label>
        {message ? (
          <p className="micro-field-error" role="status">
            {message}
          </p>
        ) : null}
        <button className="micro-button micro-button-primary micro-save-cost" type="button" disabled={saving} onClick={save}>
          <Save aria-hidden="true" />
          {saving ? "جارٍ الحفظ…" : "حفظ البيع المباشر"}
        </button>
      </section>
    </section>
  );
}