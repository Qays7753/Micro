/** Style: Micro decision path — every stock movement says where material went; it never rewrites history. */
/* مبدأ Micro: حركة المخزون المجهولة تتوقف بوضوح، ولا ترث معنى الهدر أو أي حركة أخرى. */
import { ArrowRight, CircleMinus, PackagePlus, Save, Scissors, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { EnglishQuantityInput } from "@/components/forms/EnglishQuantityInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import type { InventoryReferences } from "@/application/inventory/inventoryMaterialService";
import {
  resolveInventoryMovementType,
  type InventoryMovementRouteType,
} from "@/application/inventory/inventoryMovementRoute";
const ammanDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());
type MovementType = InventoryMovementRouteType;
export default function InventoryMovementEditor() {
  const { type } = useParams<{ type: string }>();
  const [, navigate] = useLocation();
  const { inventory, notifyDataChanged } = usePrototypeServices();
  const [references, setReferences] = useState<InventoryReferences | null>(null);
  const [materialId, setMaterialId] = useState("");
  const [purchaseId, setPurchaseId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [wasteContextKind, setWasteContextKind] = useState<
    "order" | "catalog_item" | "catalog_template" | "general_project" | "unallocated"
  >("general_project");
  const [wasteOrderId, setWasteOrderId] = useState("");
  const [wasteCatalogItemId, setWasteCatalogItemId] = useState("");
  const [wasteTemplateId, setWasteTemplateId] = useState("");
  const [wasteAllocationNote, setWasteAllocationNote] = useState("");
  const [quantityMilli, setQuantityMilli] = useState(0);
  const [valueMinor, setValueMinor] = useState(0);
  const [direction, setDirection] = useState<"increase" | "decrease">("decrease");
  const [quantityValid, setQuantityValid] = useState(true);
  const [valueValid, setValueValid] = useState(true);
  const [date, setDate] = useState(ammanDate);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const operationKey = useRef(`inventory-${type}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  const safeType = resolveInventoryMovementType(type);
  const title =
    safeType === "receipt"
      ? "استلم شراء مواد"
      : safeType === "consume"
        ? "استهلك مادة لطلب"
        : safeType === "waste"
          ? "سجل هدر مادة"
          : "اضبط كمية مادة";
  const Icon =
    safeType === "receipt"
      ? PackagePlus
      : safeType === "consume"
        ? Scissors
        : safeType === "waste"
          ? CircleMinus
          : SlidersHorizontal;
  useEffect(() => {
    if (!safeType) return;
    inventory.references().then(result => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setReferences(result.value);
      setMaterialId(result.value.materials[0]?.id ?? "");
      setPurchaseId(result.value.purchases[0]?.id ?? "");
      setOrderId(result.value.orders[0]?.id ?? "");
      setWasteOrderId(result.value.orders[0]?.id ?? "");
      setWasteCatalogItemId(result.value.catalogItems[0]?.id ?? "");
      setWasteTemplateId(result.value.catalogTemplates[0]?.id ?? "");
    });
  }, [inventory, safeType]);
  if (!safeType)
    return (
      <section className="micro-page micro-not-found" data-testid="inventory-movement-unavailable">
        <button className="micro-back-button" type="button" onClick={() => navigate("/inventory")}>
          <ArrowRight aria-hidden="true" /> المواد والمخزون
        </button>
        <div className="micro-page-heading">
          <span className="micro-overline">حركة مخزون</span>
          <h1>حركة غير متاحة</h1>
          <p>نوع الحركة المطلوب غير معروف، لذلك لم نفتح نموذجًا ولم نسجل أي أثر للمخزون.</p>
        </div>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/inventory")}
        >
          العودة إلى المواد والمخزون
        </button>
      </section>
    );
  async function save() {
    if (
      !safeType ||
      !references ||
      !materialId ||
      !quantityValid ||
      quantityMilli <= 0 ||
      !note.trim() ||
      !valueValid
    ) {
      setMessage("أدخل المادة والكمية والبيان بالأرقام 0–9 قبل الحفظ.");
      return;
    }
    if (safeType === "receipt" && (!purchaseId || valueMinor <= 0)) {
      setMessage("اختر شراء مواد وأدخل قيمة الجزء المستلم.");
      return;
    }
    if (safeType === "consume" && !orderId) {
      setMessage("اختر طلبًا موجودًا لاستهلاك المادة.");
      return;
    }
    if ((safeType === "waste" || safeType === "adjust") && !reason.trim()) {
      setMessage("أدخل سببًا واضحًا للحركة.");
      return;
    }
    if (safeType === "waste" && wasteContextKind === "order" && !wasteOrderId) {
      setMessage("اختر الطلب المرتبط بالهدر.");
      return;
    }
    if (safeType === "waste" && wasteContextKind === "catalog_item" && !wasteCatalogItemId) {
      setMessage("اختر مرجع العمل المرتبط بالهدر.");
      return;
    }
    if (
      safeType === "waste" &&
      wasteContextKind === "catalog_template" &&
      (!wasteCatalogItemId || !wasteTemplateId)
    ) {
      setMessage("اختر مرجع العمل والقالب المرتبطين بالهدر.");
      return;
    }
    setSaving(true);
    const wasteContext =
      wasteContextKind === "order"
        ? { kind: "order" as const, orderId: wasteOrderId }
        : wasteContextKind === "catalog_item"
          ? { kind: "catalog_item" as const, catalogItemId: wasteCatalogItemId }
          : wasteContextKind === "catalog_template"
            ? {
                kind: "catalog_template" as const,
                catalogItemId: wasteCatalogItemId,
                templateId: wasteTemplateId,
              }
            : wasteContextKind === "unallocated"
              ? { kind: "unallocated" as const, allocationNote: wasteAllocationNote.trim() || null }
              : { kind: "general_project" as const };
    const result =
      safeType === "receipt"
        ? await inventory.receivePurchase({
            materialId,
            purchaseId,
            quantityMilli,
            valueMinor,
            occurredOn: date,
            note,
            operationKey: operationKey.current,
          })
        : safeType === "consume"
          ? await inventory.consume({
              materialId,
              orderId,
              quantityMilli,
              occurredOn: date,
              note,
              operationKey: operationKey.current,
            })
          : safeType === "waste"
            ? await inventory.waste({
                materialId,
                quantityMilli,
                occurredOn: date,
                note,
                reason,
                operationKey: operationKey.current,
                wasteContext,
              })
            : await inventory.adjust({
                materialId,
                quantityDeltaMilli: direction === "increase" ? quantityMilli : -quantityMilli,
                valueMinorWhenIncrease: direction === "increase" ? valueMinor : null,
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
    navigate("/inventory");
  }
  if (!references && !message)
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح حركة المادة…
      </div>
    );
  if (!references)
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر فتح حركة المادة</h1>
        <p>{message}</p>
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
      <button className="micro-back-button" type="button" onClick={() => navigate("/inventory")}>
        <ArrowRight aria-hidden="true" /> المواد والمخزون
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">حركة محفوظة</span>
        <h1>{title}</h1>
        <p>
          {safeType === "receipt"
            ? "يزيد الاستلام المخزون فقط؛ لا يكرر كاش أو ذمة شراء المواد."
            : safeType === "consume"
              ? "يربط الجزء المستهلك بطلب دون تعديل نسخة التكلفة أو نتيجة فترة قديمة."
              : "لا تحذف المادة من السجل؛ سجّل هدرًا أو فرقًا بسبب واضح."}
        </p>
      </div>
      <section className="micro-decision-card">
        <Icon aria-hidden="true" />
        <div>
          <span>حد الحقيقة</span>
          <strong>
            {safeType === "consume"
              ? "الاستهلاك ليس تعديلًا صامتًا لسعر الطلب."
              : "الحركة توضح كمية وقيمة المادة، لا مصروفًا تشغيليًا تلقائيًا."}
          </strong>
          <p>لا يمكن إخراج كمية أكبر من المتاحة.</p>
        </div>
      </section>
      <section className="micro-form-card">
        <label className="micro-field">
          <span>المادة</span>
          <select value={materialId} onChange={event => setMaterialId(event.target.value)}>
            {references.materials.map(material => (
              <option key={material.id} value={material.id}>
                {material.name}
              </option>
            ))}
          </select>
        </label>
        {safeType === "receipt" ? (
          <>
            <label className="micro-field">
              <span>شراء المواد المرجعي</span>
              <select value={purchaseId} onChange={event => setPurchaseId(event.target.value)}>
                {references.purchases.map(purchase => (
                  <option key={purchase.id} value={purchase.id}>
                    {purchase.supplierName} · {purchase.note}
                  </option>
                ))}
              </select>
            </label>
            <label className="micro-field">
              <span>قيمة الجزء المستلم بالدينار الأردني</span>
              <EnglishNumberInput
                value={valueMinor}
                kind="money"
                onNumericChange={setValueMinor}
                onTextValidityChange={setValueValid}
                aria-label="قيمة استلام الشراء"
              />
            </label>
          </>
        ) : null}
        {safeType === "consume" ? (
          <label className="micro-field">
            <span>الطلب الذي استهلك المادة</span>
            <select value={orderId} onChange={event => setOrderId(event.target.value)}>
              {references.orders.map(order => (
                <option key={order.id} value={order.id}>
                  {order.itemName} · {order.customerName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {safeType === "waste" ? (
          <div className="micro-subsection">
            <div className="micro-subsection-heading">
              <div>
                <span className="micro-overline">سياق الهدر</span>
                <h3>أين وقع الهدر؟</h3>
              </div>
              <p>السياق يشرح الهدر فقط؛ لا ينشئ مصروفًا ولا تكلفة بيع تلقائيًا.</p>
            </div>
            <label className="micro-field">
              <span>نوع السياق</span>
              <select
                value={wasteContextKind}
                onChange={event => setWasteContextKind(event.target.value as typeof wasteContextKind)}
              >
                <option value="order">طلب محدد</option>
                <option value="catalog_item">مرجع عمل</option>
                <option value="catalog_template">قالب مرجع عمل</option>
                <option value="general_project">عام للمشروع</option>
                <option value="unallocated">غير موزع بعد</option>
              </select>
            </label>
            {wasteContextKind === "order" ? (
              <label className="micro-field">
                <span>الطلب</span>
                <select value={wasteOrderId} onChange={event => setWasteOrderId(event.target.value)}>
                  {references.orders.map(order => (
                    <option key={order.id} value={order.id}>
                      {order.itemName} · {order.customerName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {wasteContextKind === "catalog_item" || wasteContextKind === "catalog_template" ? (
              <label className="micro-field">
                <span>مرجع العمل</span>
                <select
                  value={wasteCatalogItemId}
                  onChange={event => setWasteCatalogItemId(event.target.value)}
                >
                  {references.catalogItems
                    .filter(item => item.active)
                    .map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            {wasteContextKind === "catalog_template" ? (
              <label className="micro-field">
                <span>القالب</span>
                <select value={wasteTemplateId} onChange={event => setWasteTemplateId(event.target.value)}>
                  {references.catalogTemplates
                    .filter(template => template.catalogItemId === wasteCatalogItemId)
                    .map(template => (
                      <option key={template.id} value={template.id}>
                        {template.title || "قالب بلا عنوان"} · نسخة {template.revision}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            {wasteContextKind === "unallocated" ? (
              <label className="micro-field">
                <span>
                  ملاحظة عدم التوزيع <small>اختيارية</small>
                </span>
                <input
                  value={wasteAllocationNote}
                  onChange={event => setWasteAllocationNote(event.target.value)}
                  placeholder="مثال: أراجع ارتباطه بعد الجرد"
                />
              </label>
            ) : null}
          </div>
        ) : null}
        {safeType === "adjust" ? (
          <>
            <label className="micro-field">
              <span>اتجاه الضبط</span>
              <select
                value={direction}
                onChange={event => setDirection(event.target.value as "increase" | "decrease")}
              >
                <option value="decrease">الكمية أقل من المسجل</option>
                <option value="increase">الكمية أكثر من المسجل</option>
              </select>
            </label>
            {direction === "increase" ? (
              <label className="micro-field">
                <span>قيمة الزيادة المعلنة بالدينار الأردني</span>
                <EnglishNumberInput
                  value={valueMinor}
                  kind="money"
                  onNumericChange={setValueMinor}
                  onTextValidityChange={setValueValid}
                  aria-label="قيمة زيادة المادة"
                />
              </label>
            ) : null}
          </>
        ) : null}
        <label className="micro-field">
          <span>الكمية</span>
          <EnglishQuantityInput
            valueMilli={quantityMilli}
            onMilliChange={setQuantityMilli}
            onTextValidityChange={setQuantityValid}
            aria-label="كمية حركة المادة"
          />
        </label>
        <LocalDateField label="تاريخ الحركة" value={date} onChange={event => setDate(event.target.value)} />
        {safeType === "waste" || safeType === "adjust" ? (
          <label className="micro-field">
            <span>السبب</span>
            <textarea
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder="مثال: تلف أثناء القص أو فرق جرد"
            />
          </label>
        ) : null}
        <label className="micro-field">
          <span>بيان مختصر</span>
          <input
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="مثال: استهلاك لطلب سارة"
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
          {saving ? "جارٍ الحفظ…" : "حفظ حركة المادة"}
        </button>
      </section>
    </section>
  );
}
