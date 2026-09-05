/** Style: Micro decision path — every stock movement says where material went; it never rewrites history. */
/* مبدأ Micro: حركة المخزون المجهولة تتوقف بوضوح، ولا ترث معنى الهدر أو أي حركة أخرى. */
import { ArrowRight, CircleMinus, PackagePlus, Save, Scissors, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch, useParams } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { localDateInAmman, formatMoneyMinor, formatQuantityMilli } from "@/presentation/formatters";
import { EnglishQuantityInput } from "@/components/forms/EnglishQuantityInput";
import { LocalDateField } from "@/components/forms/LocalDateField";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useFormDirty } from "@/components/forms/useFormDirty";
import type {
  InventoryReferences,
  PurchaseReceiptStatus,
} from "@/application/inventory/inventoryMaterialService";
import {
  resolveInventoryMovementType,
  type InventoryMovementRouteType,
} from "@/application/inventory/inventoryMovementRoute";
import { MoneyValue, QuantityValue } from "@/components/presentation/DisplayValue";
const ammanDate = () => localDateInAmman();
const ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;
type MovementType = InventoryMovementRouteType;
const unitWord = (unit: string) =>
  unit === "piece"
    ? "قطعة"
    : unit === "meter"
      ? "متر"
      : unit === "kilogram"
        ? "كيلوغرام"
        : unit === "liter"
          ? "لتر"
          : "وحدة أخرى";
export default function InventoryMovementEditor() {
  const { type } = useParams<{ type: string }>();
  const [, navigate] = useLocation();
  const search = useSearch();
  /* المجموعة ١ (Scope A): الرجوع للمصدر (?from) والمواد كبديل قانوني. */
  const returnPath = useReturnPath();
  /* المجموعة ١ (Scope E): وصلة عميقة تحفظ سياق الطلب الأصلي —
   * /inventory/movement/consume?order=<id>&from=/orders/<id> تُعبّئ الطلب مسبقًا.
   * المجموعة ٢ (عقد ٢٨): ?purchase=<id> جسر الاستلام من سجل الشراء،
   * و?material=<id> يمنع الافتراض الصامت لأول مادة. */
  const query = new URLSearchParams(search ?? "");
  const linkedOrderId = (() => {
    const order = query.get("order");
    return order && ID_SHAPE.test(order) ? order : null;
  })();
  /* المجموعة ٣ (عقد D6): وصلة استهلاك بيع مباشر — /inventory/movement/consume?sale=<id>. */
  const linkedSaleId = (() => {
    const sale = query.get("sale");
    return sale && ID_SHAPE.test(sale) ? sale : null;
  })();
  const linkedPurchaseId = (() => {
    const purchase = query.get("purchase");
    return purchase && ID_SHAPE.test(purchase) ? purchase : null;
  })();
  const linkedMaterialId = (() => {
    const material = query.get("material");
    return material && ID_SHAPE.test(material) ? material : null;
  })();
  const { dataVersion, inventory, notifyDataChanged } = usePrototypeServices();
  const [references, setReferences] = useState<InventoryReferences | null>(null);
  const [materialId, setMaterialId] = useState("");
  const [purchaseId, setPurchaseId] = useState("");
  const [receiptStatus, setReceiptStatus] = useState<PurchaseReceiptStatus | null>(null);
  const [orderId, setOrderId] = useState("");
  /* المجموعة ٢ (عقد ٢٨): الاستهلاك لطلب محدد أم لعمل المشروع — سؤال صريح.
   * المجموعة ٣ (عقد D6): أو لبيع مباشر محدد — مرجع صريح ثالث. */
  const [consumeTarget, setConsumeTarget] = useState<"order" | "sale" | "project">(
    linkedSaleId ? "sale" : "order",
  );
  const [saleId, setSaleId] = useState("");
  const [wasteContextKind, setWasteContextKind] = useState<
    "order" | "catalog_item" | "catalog_template" | "general_project" | "unallocated"
  >("general_project");
  const [wasteOrderId, setWasteOrderId] = useState("");
  const [wasteCatalogItemId, setWasteCatalogItemId] = useState("");
  const [wasteTemplateId, setWasteTemplateId] = useState("");
  const [wasteAllocationNote, setWasteAllocationNote] = useState("");
  const [quantityMilli, setQuantityMilli] = useState(0);
  const [valueMinor, setValueMinor] = useState(0);
  const [costKnown, setCostKnown] = useState(true);
  const [direction, setDirection] = useState<"increase" | "decrease">("decrease");
  const [quantityValid, setQuantityValid] = useState(true);
  const [valueValid, setValueValid] = useState(true);
  const [date, setDate] = useState(ammanDate);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const operationKey = useRef(`inventory-${type}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
  const prefilledPurchaseRef = useRef<string | null>(null);
  const safeType = resolveInventoryMovementType(type);
  const title =
    safeType === "receipt"
      ? "استلم شراء مواد"
      : safeType === "consume"
        ? "استهلك مادة"
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
      const linkedMaterial =
        linkedMaterialId && result.value.materials.some(material => material.id === linkedMaterialId)
          ? linkedMaterialId
          : null;
      setMaterialId(
        (linkedMaterial as string | null) ??
          (linkedPurchaseId
            ? (result.value.purchases.find(purchase => purchase.id === linkedPurchaseId)?.materialId ?? null)
            : null) ??
          result.value.materials[0]?.id ??
          "",
      );
      const purchaseFromLink = linkedPurchaseId
        ? result.value.purchases.find(purchase => purchase.id === linkedPurchaseId)
        : undefined;
      setPurchaseId(purchaseFromLink ? purchaseFromLink.id : (result.value.purchases[0]?.id ?? ""));
      /* SA-5 (F1): لا نُعلّم الإحالة هنا — بطاقة حالة الاستلام هي التي تعبّئ
       * (كمية/قيمة متبقية) مرة واحدة لكل شراء؛ الوصلة العميقة تمر بالمسار نفسه. */
      if (purchaseFromLink && safeType === "receipt" && purchaseFromLink.materialId) {
        setMaterialId(purchaseFromLink.materialId);
        setNote(`استلام شراء: ${purchaseFromLink.supplierName}`);
      }
      /* سياق الطلب من الوصلة العميقة إن وُجد؛ وإلا أول طلب كالسلوك القائم. */
      const linked = linkedOrderId && result.value.orders.some(order => order.id === linkedOrderId);
      setOrderId(linked ? (linkedOrderId as string) : (result.value.orders[0]?.id ?? ""));
      /* المجموعة ٣ (عقد D6): بيع مباشر من الوصلة العميقة إن وُجد؛ وإلا أول بيع نشط. */
      const linkedSale = linkedSaleId && result.value.sales.some(sale => sale.id === linkedSaleId);
      setSaleId(linkedSale ? (linkedSaleId as string) : (result.value.sales[0]?.id ?? ""));
      setWasteOrderId(result.value.orders[0]?.id ?? "");
      setWasteCatalogItemId(result.value.catalogItems[0]?.id ?? "");
      setWasteTemplateId(result.value.catalogTemplates[0]?.id ?? "");
    });
  }, [inventory, safeType, linkedOrderId, linkedSaleId, linkedPurchaseId, linkedMaterialId, dataVersion]);
  /* المجموعة ٢ (عقد ٢٨ / TR-07): حالة الاستلام الحية للشراء المحدد — المستلم
   * والمتبقي قيمةً وكميةً، وتغيير الشراء يعيد اشتقاق التعبئة (لا تعبئة كاذبة). */
  useEffect(() => {
    if (safeType !== "receipt" || !purchaseId) {
      setReceiptStatus(null);
      return;
    }
    inventory.purchaseReceiptStatus(purchaseId).then(result => {
      if (!result.ok) {
        setReceiptStatus(null);
        return;
      }
      setReceiptStatus(result.value);
      /* إعادة التعبئة عند تغيير الشراء فقط — ما يكتبه المالك لا يُمسّ. */
      if (result.value && prefilledPurchaseRef.current !== purchaseId && references) {
        prefilledPurchaseRef.current = purchaseId;
        const purchase = references.purchases.find(candidate => candidate.id === purchaseId);
        if (purchase?.materialId) setMaterialId(purchase.materialId);
        if (result.value.remainingQuantityMilli && result.value.remainingQuantityMilli > 0)
          setQuantityMilli(result.value.remainingQuantityMilli);
        if (result.value.remainingValueMinor > 0) {
          setValueMinor(result.value.remainingValueMinor);
          setCostKnown(true);
        }
        if (purchase) setNote(`استلام شراء: ${purchase.supplierName}`);
      }
    });
  }, [safeType, purchaseId, inventory, references, dataVersion]);
  /* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة — الرجوع يمر
   * بالحارس: «ابقَ / احفظ ثم اخرج / اخرج بلا حفظ» كبقية المحررات العميقة.
   * تُستدعى الخطافات قبل أي return شرطي (قواعد الخطافات): فرع «حركة غير
   * متاحة» يمر بها أيضًا بأمان (النموذج نظيف فالحارس خامل). */
  const isDirty = useFormDirty([
    type,
    materialId,
    purchaseId,
    orderId,
    consumeTarget,
    direction,
    costKnown,
    wasteContextKind,
    wasteOrderId,
    wasteCatalogItemId,
    wasteTemplateId,
    wasteAllocationNote,
    quantityMilli,
    valueMinor,
    date,
    reason,
    note,
  ]);
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save() });

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
  const selectedMaterial = references?.materials.find(material => material.id === materialId) ?? null;
  const selectedPosition = references?.materialPositions.find(position => position.materialId === materialId);
  const availableMilli = selectedPosition?.quantityMilli ?? 0;
  const shortageImminent = safeType === "consume" && quantityMilli > availableMilli;

  async function save(): Promise<boolean> {
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
      return false;
    }
    if (safeType === "receipt" && (!purchaseId || (costKnown && valueMinor <= 0))) {
      setMessage(costKnown ? "اختر شراء مواد وأدخل قيمة الجزء المستلم." : "اختر شراء مواد قبل الحفظ.");
      return false;
    }
    if (safeType === "consume" && consumeTarget === "order" && !orderId) {
      setMessage("اختر طلبًا موجودًا لاستهلاك المادة.");
      return false;
    }
    if (safeType === "consume" && consumeTarget === "sale" && !saleId) {
      setMessage("اختر بيعًا مباشرًا موجودًا لاستهلاك المادة.");
      return false;
    }
    if (safeType === "consume" && consumeTarget === "project" && !note.trim()) {
      setMessage("اكتب بيان الاستهلاك — استهلاك بلا طلب يحتاج بيانًا واضحًا.");
      return false;
    }
    if ((safeType === "waste" || safeType === "adjust") && !reason.trim()) {
      setMessage("أدخل سببًا واضحًا للحركة.");
      return false;
    }
    if (safeType === "waste" && wasteContextKind === "order" && !wasteOrderId) {
      setMessage("اختر الطلب المرتبط بالهدر.");
      return false;
    }
    if (safeType === "waste" && wasteContextKind === "catalog_item" && !wasteCatalogItemId) {
      setMessage("اختر مرجع العمل المرتبط بالهدر.");
      return false;
    }
    if (
      safeType === "waste" &&
      wasteContextKind === "catalog_template" &&
      (!wasteCatalogItemId || !wasteTemplateId)
    ) {
      setMessage("اختر مرجع العمل والقالب المرتبطين بالهدر.");
      return false;
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
            valueMinor: costKnown ? valueMinor : 0,
            costKnowledge: costKnown ? "known" : "unknown",
            occurredOn: date,
            note,
            operationKey: operationKey.current,
          })
        : safeType === "consume"
          ? await inventory.consume({
              materialId,
              orderId: consumeTarget === "order" ? orderId : null,
              saleId: consumeTarget === "sale" ? saleId : null,
              reason: consumeTarget === "project" ? note : null,
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
                valueMinorWhenIncrease: direction === "increase" ? (costKnown ? valueMinor : null) : null,
                increaseCostKnowledge: direction === "increase" && !costKnown ? "unknown" : "known",
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
    navigate(returnPath);
    return true;
  }
  /* المجموعة ٢ (عقد ٢٨ / D-027): بدائل النقص الصريحة — توثيق النقص وحده، أو
   * استهلاك المتاح مع توثيق الباقي نقصًا في حفظ ذرّي واحد. */
  async function saveShortageOnly(): Promise<void> {
    if (!materialId || !note.trim() || quantityMilli <= availableMilli) return;
    setSaving(true);
    const result = await inventory.recordShortage({
      materialId,
      requestedQuantityMilli: quantityMilli,
      orderId: consumeTarget === "order" ? orderId : null,
      occurredOn: date,
      note,
      operationKey: `${operationKey.current}:shortage`,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    navigate(returnPath);
  }
  async function saveConsumeAvailableWithShortage(): Promise<void> {
    if (!materialId || !note.trim() || availableMilli <= 0 || quantityMilli <= availableMilli) return;
    setSaving(true);
    const result = await inventory.consumeWithShortage({
      materialId,
      orderId: consumeTarget === "order" ? orderId : null,
      reason: consumeTarget === "project" ? note : null,
      quantityMilli,
      occurredOn: date,
      note,
      operationKey: operationKey.current,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    navigate(returnPath);
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
  if (references.materials.length === 0)
    return (
      <section className="micro-page micro-not-found" data-testid="inventory-movement-no-materials">
        <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
          <ArrowRight aria-hidden="true" /> المواد والمخزون
        </button>
        <div className="micro-page-heading">
          <span className="micro-overline">حركة مخزون</span>
          <h1>لا مواد متتبَّعة بعد</h1>
          <p>سجّل مادة وفعّل متابعة كميتها أولًا — حركة المخزون تحتاج مادة متتبَّعة.</p>
        </div>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/inventory/material/new")}
        >
          مادة جديدة
        </button>
      </section>
    );
  const unit = unitWord(selectedMaterial?.unit ?? "other");
  const afterMilli =
    safeType === "receipt"
      ? availableMilli + quantityMilli
      : safeType === "consume" || safeType === "waste"
        ? availableMilli - quantityMilli
        : direction === "increase"
          ? availableMilli + quantityMilli
          : availableMilli - quantityMilli;
  const previewLines: string[] =
    safeType === "receipt"
      ? [
          `رصيد المادة يصبح ${formatQuantityMilli(afterMilli)} ${unit}${
            costKnown ? ` بقيمة معروفة (${formatMoneyMinor(valueMinor)} د.أ).` : "."
          }`,
          costKnown
            ? "لا يتغير الكاش ولا ذمة المورد — الاستلام حركة مخزون فقط."
            : "قيمة الاستلام غير معروفة — تُعرض «التكلفة غير معروفة» لا صفرًا، ولا يتغير الكاش.",
        ]
      : safeType === "consume"
        ? shortageImminent
          ? ["لا يمكن تنفيذ الكمية المطلوبة — انظر خيارات النقص أسفل النموذج."]
          : [
              `ينقص رصيد المادة ${formatQuantityMilli(quantityMilli)} ${unit} ليصبح ${formatQuantityMilli(afterMilli)}.`,
              "لا يتغير الكاش ولا نتيجة الفترة الآن.",
            ]
        : safeType === "waste"
          ? [
              `ينقص رصيد المادة ${formatQuantityMilli(quantityMilli)} ${unit} وتخرج قيمته من المخزون.`,
              "هدر مخزون — بلا خروج نقد جديد ولا أثر في نتيجة الفترة.",
            ]
          : [
              `رصيد المادة يصبح ${formatQuantityMilli(afterMilli)} ${unit} (فرق ${
                direction === "increase" ? "+" : "−"
              }${formatQuantityMilli(quantityMilli)}).`,
              direction === "increase"
                ? costKnown
                  ? `قيمة الزيادة المعلنة ${formatMoneyMinor(valueMinor)} د.أ — لا يتغير الكاش.`
                  : "قيمة الزيادة غير معروفة — قيمة صفرية موسومة، لا يتغير الكاش."
                : "قيمة النقص تُشتق من رصيد المادة — لا يتغير الكاش ولا نتيجة الفترة.",
            ];
  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        <ArrowRight aria-hidden="true" /> المواد والمخزون
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">حركة محفوظة</span>
        <h1>{title}</h1>
        <p>
          {safeType === "receipt"
            ? "يزيد الاستلام المخزون فقط؛ لا يكرر كاش أو ذمة شراء المواد."
            : safeType === "consume"
              ? "يربط الجزء المستهلك بطلب أو ببيان مشروع، دون تعديل نسخة التكلفة أو نتيجة فترة قديمة."
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
        {safeType === "receipt" ? (
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
        ) : null}
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
        {safeType === "receipt" && receiptStatus ? (
          <section
            className="micro-inventory-inactive"
            aria-label="حالة الاستلام"
            data-testid="receipt-status-card"
          >
            <div>
              <span className="micro-overline">حالة الاستلام</span>
              <p>
                قيمة مستلمة:{" "}
                <MoneyValue minor={receiptStatus.receivedValueMinor} className="micro-inline-number" /> من{" "}
                <MoneyValue minor={receiptStatus.totalMinor} className="micro-inline-number" /> د.أ
                {receiptStatus.remainingQuantityMilli !== null
                  ? ` · كمية مستلمة: ${formatQuantityMilli(receiptStatus.receivedQuantityMilli ?? 0)} من ${formatQuantityMilli(receiptStatus.expectedQuantityMilli ?? 0)} ${unit}`
                  : " · لا كمية متوقعة مسجلة — الحد على القيمة فقط."}
              </p>
            </div>
          </section>
        ) : null}
        {safeType === "receipt" ? (
          <fieldset className="micro-field">
            <legend>هل تعرف قيمة هذا الاستلام؟</legend>
            <label className="micro-radio-choice">
              <input
                type="radio"
                name="receipt-cost"
                checked={costKnown}
                onChange={() => setCostKnown(true)}
              />
              <span>
                <b>نعم، معلومة</b>
              </span>
            </label>
            <label className="micro-radio-choice">
              <input
                type="radio"
                name="receipt-cost"
                checked={!costKnown}
                onChange={() => setCostKnown(false)}
              />
              <span>
                <b>لا، غير معروفة بعد</b>
                <small>تُسجَّل قيمة صفرية موسومة «غير معروفة» — لا مجانية مفترضة.</small>
              </span>
            </label>
            {costKnown ? (
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
            ) : null}
          </fieldset>
        ) : null}
        {safeType === "consume" ? (
          <fieldset className="micro-field" data-testid="consume-target-question">
            <legend>الاستهلاك لطلب محدد أم لعمل المشروع؟</legend>
            <label className="micro-radio-choice">
              <input
                type="radio"
                name="consume-target"
                checked={consumeTarget === "order"}
                onChange={() => setConsumeTarget("order")}
                disabled={references.orders.length === 0}
              />
              <span>
                <b>لطلب محدد</b>
                <small>يُربط الاستهلاك بطلب موثق للمقارنة لاحقًا.</small>
              </span>
            </label>
            <label className="micro-radio-choice">
              <input
                type="radio"
                name="consume-target"
                checked={consumeTarget === "sale"}
                onChange={() => setConsumeTarget("sale")}
                disabled={references.sales.length === 0}
              />
              <span>
                <b>لبيع مباشر محدد</b>
                <small>يُربط الاستهلاك ببيع نقدي مسجل — مرجع صريح كالطلب.</small>
              </span>
            </label>
            <label className="micro-radio-choice">
              <input
                type="radio"
                name="consume-target"
                checked={consumeTarget === "project"}
                onChange={() => setConsumeTarget("project")}
              />
              <span>
                <b>لعمل المشروع</b>
                <small>استهلاك بلا طلب — ببيان واضح في خانة البيان.</small>
              </span>
            </label>
            {consumeTarget === "order" ? (
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
            {consumeTarget === "sale" ? (
              <label className="micro-field">
                <span>البيع المباشر الذي استهلك المادة</span>
                <select value={saleId} onChange={event => setSaleId(event.target.value)}>
                  {references.sales.map(sale => (
                    <option key={sale.id} value={sale.id}>
                      {sale.itemName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </fieldset>
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
              <fieldset className="micro-field">
                <legend>هل تعرف قيمة الزيادة؟</legend>
                <label className="micro-radio-choice">
                  <input
                    type="radio"
                    name="adjust-cost"
                    checked={costKnown}
                    onChange={() => setCostKnown(true)}
                  />
                  <span>
                    <b>نعم، معلومة</b>
                  </span>
                </label>
                <label className="micro-radio-choice">
                  <input
                    type="radio"
                    name="adjust-cost"
                    checked={!costKnown}
                    onChange={() => setCostKnown(false)}
                  />
                  <span>
                    <b>لا، غير معروفة بعد</b>
                    <small>قيمة صفرية موسومة «غير معروفة» — لا مجانية مفترضة.</small>
                  </span>
                </label>
                {costKnown ? (
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
              </fieldset>
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
          {safeType === "consume" && selectedMaterial ? (
            <small data-testid="consume-available-hint">
              {shortageImminent
                ? `الكمية أكبر من المتاحة (المتاح: ${formatQuantityMilli(availableMilli)} ${unit}) — الخيارات أسفل النموذج.`
                : `المتاح الآن: ${formatQuantityMilli(availableMilli)} ${unit}.`}
            </small>
          ) : null}
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
        {/* المجموعة ٢ (عقد ٢٨ / D-027): بدائل النقص — آخر كتلة قبل المعاينة
            والحفظ (لا صفوف شرطية فوق حقول الإدخال — قانون عدم الاهتزاز). */}
        {shortageImminent && selectedMaterial ? (
          <section
            className="micro-danger-zone"
            aria-labelledby="shortage-title"
            data-testid="shortage-panel"
          >
            <div className="micro-section-heading">
              <CircleMinus aria-hidden="true" />
              <div>
                <span className="micro-overline">أنت توثّق نقصًا</span>
                <h2 id="shortage-title">الكمية المطلوبة أكبر من المتاحة</h2>
              </div>
            </div>
            <p>
              المتاح الآن <QuantityValue valueMilli={availableMilli} className="micro-inline-number" /> من{" "}
              {selectedMaterial.name}. لا يُسمح برصيد سالب في Micro — النقص يُوثَّق سجلًا يُحلّ لاحقًا، لا
              رقمًا سالبًا يُخفى. اختر:
            </p>
            <div className="micro-form-actions">
              <button
                className="micro-button micro-button-secondary"
                type="button"
                disabled={saving || !note.trim()}
                onClick={() => {
                  void saveShortageOnly();
                }}
              >
                سجّل نقصًا بدل الاستهلاك
              </button>
              <button
                className="micro-button micro-button-primary"
                type="button"
                disabled={saving || !note.trim() || availableMilli <= 0}
                onClick={() => {
                  void saveConsumeAvailableWithShortage();
                }}
              >
                استهلك المتاح
              </button>
            </div>
            <p>
              <small>
                «سجّل نقصًا»: بلا استهلاك — يُوثَّق النقص ويبقى مفتوحًا حتى الحل. · «استهلك المتاح»: يُسجَّل
                الاستهلاك للجزء المتاح، والباقي نقصًا في حفظ ذرّي واحد.
              </small>
            </p>
          </section>
        ) : null}
        {message ? (
          <p className="micro-field-error" role="status">
            {message}
          </p>
        ) : null}
        {/* معاينة الأثر (المجموعة ٢): منطقة ارتفاع محجوز، آخر كتلة قبل زر
            الحفظ اللاصق — لحظة الحفظ تقترن بما سيتغير. */}
        <div className="micro-effect-preview" data-testid="movement-effect-preview" aria-live="polite">
          <span className="micro-effect-preview-label">بعد الحفظ:</span>
          {previewLines.map(line => (
            <p className="micro-effect-preview-line" key={line}>
              {line}
            </p>
          ))}
        </div>
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
