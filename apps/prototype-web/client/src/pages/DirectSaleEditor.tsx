/** Phone-first direct-sale form. It records a sale, never an order or inferred profit. */
import { ArrowRight, Ban, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { localDateInAmman } from "@/presentation/formatters";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";

export default function DirectSaleEditor() {
  const [location, navigate] = useLocation();
  const { directSales, notifyDataChanged } = usePrototypeServices();
  const saleMatch = location.match(/^\/direct-sales\/([^/?]+)$/);
  const saleId = saleMatch?.[1] && saleMatch[1] !== "new" ? decodeURIComponent(saleMatch[1]) : null;
  const editing = saleId !== null;
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
  const [loadingSale, setLoadingSale] = useState(editing);
  const [savedSale, setSavedSale] = useState<DirectSale | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const idempotencyKey = useRef(`direct-sale-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  const correctionIdempotencyKey = useRef(
    `direct-sale-correction-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
  );
  const cancellationIdempotencyKey = useRef(
    `direct-sale-cancellation-ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
  );

  useEffect(() => {
    if (!saleId) return;
    let active = true;
    setLoadingSale(true);
    void directSales.get(saleId).then(result => {
      if (!active) return;
      setLoadingSale(false);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      if (!result.value) {
        setMessage("بيع مباشر غير موجود؛ لم يتغير شيء.");
        return;
      }
      const sale = result.value;
      setSavedSale(sale);
      setItemName(sale.itemName);
      setQuantity(sale.quantity);
      setRevenueMinor(sale.revenueMinor);
      setCostKnown(sale.costMinor !== null);
      setCostMinor(sale.costMinor ?? 0);
      setOccurredOn(sale.occurredOn);
      setNote(sale.note);
    });
    return () => {
      active = false;
    };
  }, [directSales, saleId]);

  async function save() {
    if (savedSale?.status === "cancelled") {
      setMessage("هذا البيع ملغى ولا يمكن تعديله.");
      return;
    }
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
    const result = editing
      ? await directSales.update(saleId!, {
          itemName,
          quantity,
          revenueMinor,
          costMinor: costKnown ? costMinor : null,
          occurredOn,
          note,
          idempotencyKey: correctionIdempotencyKey.current,
        })
      : await directSales.record({
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

  async function cancel() {
    if (!saleId || !cancelReason.trim()) {
      setMessage("اكتب سبب الإلغاء قبل تأكيده.");
      return;
    }
    setMessage(null);
    setSaving(true);
    const result = await directSales.cancel(saleId, cancelReason, cancellationIdempotencyKey.current);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    navigate("/orders");
  }

  if (editing && loadingSale)
    return (
      <div className="micro-route-loading" role="status">
        جارٍ تحميل البيع المباشر…
      </div>
    );

  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => navigate("/orders")}>
        <ArrowRight aria-hidden="true" /> العمل
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">سجل بيع مستقل</span>
        <h1>{editing ? "تصحيح بيع مباشر" : "تسجيل بيع مباشر"}</h1>
        <p>
          {editing
            ? "صحح البيانات التي أدخلتها مع إبقاء البيع مستقلًا عن الطلبات. لا يُحذف السجل عند إلغائه."
            : "سجّل ما بعته وقيمته من دون إنشاء طلب. تحصيلات الطلبات تبقى في طلباتها ولا تظهر هنا."}
        </p>
      </div>
      <section className="micro-decision-card">
        <div>
          <span>حد الحقيقة</span>
          <strong>التحصيل ليس ربحًا.</strong>
          <p>إذا لم تعرف التكلفة الآن، سيظهر الربح «غير متاح» بدل أن يفترضه النظام صفرًا.</p>
        </div>
      </section>
      {savedSale?.status === "cancelled" ? (
        <section className="micro-decision-card" data-tone="warning" role="status">
          <div>
            <span>حالة السجل</span>
            <strong>هذا البيع ملغى.</strong>
            <p>{savedSale.cancellationReason ?? "لا يوجد سبب مسجل."} — بقي السجل محفوظًا لأثر المراجعة.</p>
          </div>
        </section>
      ) : null}
      <section className="micro-form-card">
        <fieldset disabled={savedSale?.status === "cancelled"} style={{ border: 0, padding: 0, margin: 0 }}>
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
          {saving ? "جارٍ الحفظ…" : editing ? "حفظ تصحيح البيع" : "حفظ البيع المباشر"}
        </button>
        </fieldset>
      </section>
      {editing && savedSale?.status !== "cancelled" ? (
        <section className="micro-danger-zone" aria-labelledby="direct-sale-cancel-title">
          <div className="micro-section-heading">
            <Ban aria-hidden="true" />
            <div>
              <span className="micro-overline">تصحيح لا يحذف السجل</span>
              <h2 id="direct-sale-cancel-title">إلغاء البيع</h2>
            </div>
          </div>
          {!cancelOpen ? (
            <button className="micro-button micro-button-danger" type="button" onClick={() => setCancelOpen(true)}>
              إظهار تأكيد الإلغاء
            </button>
          ) : (
            <>
              <p>سيبقى البيع ظاهرًا في «مبيعاتي» بحالة ملغى، ولن يُحذف بصمت.</p>
              <label className="micro-field">
                <span>سبب الإلغاء</span>
                <textarea
                  value={cancelReason}
                  onChange={event => setCancelReason(event.target.value)}
                  placeholder="مثال: أُدخل المبلغ بالخطأ"
                />
              </label>
              <div className="micro-form-actions">
                <button className="micro-button micro-button-danger" type="button" disabled={saving} onClick={cancel}>
                  تأكيد إلغاء البيع
                </button>
                <button className="micro-button micro-button-secondary" type="button" disabled={saving} onClick={() => setCancelOpen(false)}>
                  إبقاء البيع
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}
    </section>
  );
}