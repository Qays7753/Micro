import type {
  InventoryMovement,
  InventoryShortage,
  Material,
  WasteContext,
} from "@micro-domain/inventory-material/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

/* S07-MR-001 (أمر S08 — القسم ١): الكتابة العمياء للمخزون (قراءة-ثم-كتابة بلا
 * تحقق داخل الحد) كانت تسمح لعمليتي استلام متزامنتين قراءة الحالة نفسها
 * فتجتازا حد الشراء/البند كلتاهما ثم تكتبان معًا — استلام فوق الحد يمر صامتًا.
 * هذا الحارس النقي (نمط supplierScheduleCommitGuard/cashContinuityCommitGuard)
 * هو مالك قرار واحد يستهلكه المهايئان معًا داخل حد الكتابة نفسه:
 *
 * ١) ذراع الحالة المتوقعة (CAS): الخدمة تُمرر بصمات عزل للحالة الحية التي
 *    قرأتها وبنت عليها كل حرسها (حركات/مواد/نواقص/حدود مشتريات)؛ المهايئ
 *    يعيد حساب البصمات من الحقيقة الحية داخل المعاملة (IndexedDB) أو
 *    الخطوة المتزامنة (الذاكرة) — أي انحراف يعني كاتبًا آخر سبق الحد
 *    فتُرفض المعاملة كاملة بـstorage_stale بلا أي كتابة جزئية.
 * ٢) ذراع الحتمية داخل الحد: مفتاح العملية المكرر الذي ظهر بعد قراءة
 *    الخدمة (سباق النقر المزدوج/الإرسال المتكرر) يُقارن بالهوية المالية:
 *    نفس الحملة يعاد تخزينه كما هو (إعادة استخدام صادقة بلا كتابة ثانية)،
 *    والحملة المختلفة بنفس المفتاح تعارض صادق بلا استبدال.
 *
 * البصمات والهويات هنا حقائق عزل لا حساب مالي ثانٍ: المجال يبقى مالك
 * المعنى الوحيد، والواجهة لا تحسب شيئًا — الخدمة تبني البصمة من قراءتها
 * نفسها حرفيًا. المسارات منخفضة المستوى (بذر الاختبارات المباشر وعقود
 * المطابقة) تمرر بلا توقع فتحصل على السلوك القائم نفسه دون تغيير. */

export const INVENTORY_STATE_CHANGED_MESSAGE =
  "حالة المخزون تغيّرت من مسار آخر بعد قراءتك — لم يُسجَّل شيء؛ أعد المحاولة.";
export const INVENTORY_OPERATION_KEY_CONFLICT_MESSAGE =
  "عملية مخزون أخرى بنفس المفتاح وحملة مختلفة سبقتك — لم يُسجَّل شيء ولم يُستبدل شيء؛ أعد المحاولة بمفتاح جديد.";
const INVENTORY_EXPECTATION_INCOMPLETE_MESSAGE =
  "تعذر التحقق من حالة المخزون داخل حد الكتابة — لم يُسجَّل شيء.";

/** بصمة عزل لحركة مخزون — كل حقل حراسة/هوية؛ الحقول العرضية (note/reason)
 * والفنية (recordedAt) خارج البصمة فلا يكسرها إعادة عرض صادقة. */
function movementToken(movement: InventoryMovement): string {
  return [
    movement.id,
    movement.type,
    movement.materialId,
    movement.occurredOn,
    movement.quantityDeltaMilli,
    movement.valueDeltaMinor,
    movement.operationKey,
    movement.purchaseId ?? "",
    movement.purchaseLineId ?? "",
    movement.orderId ?? "",
    movement.saleId ?? "",
    movement.reversesMovementId ?? "",
    movement.costKnowledge ?? "",
    movement.wasteProfitImpact ?? "",
    wasteContextToken(movement.wasteContext),
  ].join("~");
}

function wasteContextToken(context: WasteContext | null): string {
  if (!context) return "";
  switch (context.kind) {
    case "order":
      return `order:${context.orderId}`;
    case "catalog_item":
      return `item:${context.catalogItemId}`;
    case "catalog_template":
      return `template:${context.catalogItemId}:${context.templateId}`;
    case "general_project":
      return "general";
    case "unallocated":
      return `unallocated:${context.allocationNote ?? ""}`;
  }
}

/** الهوية المالية لحركة (مفتاح + كل أثر مالي/مرجعي) — بدون المعرف العشوائي
 * ولا وقت التسجيل ولا النصوص العرضية: إعادة الإرسال المتطابقة ماليًا بعد
 * فشل/انقطاع هي «نفس الحملة» فتُعاد كما هي، والاختلاف المالي تعارض. */
export function movementFinancialIdentity(movement: InventoryMovement): string {
  return [
    movement.type,
    movement.materialId,
    movement.occurredOn,
    movement.quantityDeltaMilli,
    movement.valueDeltaMinor,
    movement.operationKey,
    movement.purchaseId ?? "",
    movement.purchaseLineId ?? "",
    movement.orderId ?? "",
    movement.saleId ?? "",
    movement.reversesMovementId ?? "",
    movement.costKnowledge ?? "",
    movement.wasteProfitImpact ?? "",
    wasteContextToken(movement.wasteContext),
  ].join("~");
}

function materialToken(material: Material): string {
  const tracking = material.tracking ?? null;
  const opening = material.opening ?? null;
  return [
    material.id,
    material.name,
    material.unit,
    material.createdAt,
    material.createdOperationKey,
    tracking ? `${tracking.status}|${tracking.decidedOn ?? ""}|${tracking.reason ?? ""}` : "",
    opening
      ? [
          opening.quantityState,
          opening.quantityMilli ?? "",
          opening.costState,
          opening.valueMinor ?? "",
          opening.confirmedOn ?? "",
          opening.sourceNote ?? "",
        ].join("|")
      : "",
  ].join("~");
}

function shortageToken(shortage: InventoryShortage): string {
  return [
    shortage.id,
    shortage.materialId,
    shortage.requestedQuantityMilli,
    shortage.availableQuantityMilli,
    shortage.shortageQuantityMilli,
    shortage.occurredOn,
    shortage.orderId ?? "",
    shortage.operationKey,
    shortage.status,
    shortage.resolvedOn ?? "",
    shortage.resolutionNote ?? "",
  ].join("~");
}

function shortageFinancialIdentity(shortage: InventoryShortage): string {
  return [
    shortage.materialId,
    shortage.requestedQuantityMilli,
    shortage.availableQuantityMilli,
    shortage.shortageQuantityMilli,
    shortage.occurredOn,
    shortage.orderId ?? "",
    shortage.operationKey,
  ].join("~");
}

/* بصمة حدود الاستلام لسجل شراء — حقول حدود الاستلام التي يفحصها المسار
 * (الإجمالي/المادة/الكمية المتوقعة/البنود) فقط؛ دفعة متزامنة على شراء آخر
 * لا تُسقط الاستلام (البصمة لا تشملها) بينما مراجعة تمس الحدود تُسقطه. */
function purchaseBoundToken(purchase: SupplierPurchase): string {
  const lines = purchase.lines ?? [];
  return [
    purchase.id,
    purchase.totalMinor,
    purchase.materialId ?? "",
    purchase.expectedQuantityMilli ?? "",
    lines
      .map(line =>
        [
          line.lineId,
          line.materialId ?? "",
          line.expectedQuantityMilli ?? "",
          line.valueMinor ?? "",
          line.costKnowledge,
          line.treatment,
        ].join("|"),
      )
      .join(";"),
  ].join("~");
}

export function inventoryMovementsFingerprint(movements: readonly InventoryMovement[]): string {
  return movements.map(movementToken).sort().join(";");
}
export function inventoryMaterialsFingerprint(materials: readonly Material[]): string {
  return materials.map(materialToken).sort().join(";");
}
export function inventoryShortagesFingerprint(shortages: readonly InventoryShortage[]): string {
  return shortages.map(shortageToken).sort().join(";");
}
export function inventoryPurchasesFingerprint(purchases: readonly SupplierPurchase[]): string {
  return purchases.map(purchaseBoundToken).sort().join(";");
}

/** عقد الحالة المتوقعة لكتابة المخزون — بصمات عزل للحالة الحية التي قرأتها
 * الخدمة وبنت عليها حراسها؛ تُقارن داخل حد الكتابة نفسه فلا تمر كتابة فوق
 * واقع تغيّر بعد القراءة. كل بصمة اختيارية بحسب ما يمسّه الالتزام؛ الحضور
 * يُلزم المهايئ بقراءة المتجر المقابل داخل المعاملة (فشل مغلق إن تعذّر). */
/** بصمة عزل لحدث مالي في سياق كتابة المخزون — الحقول الحرجة للقرار
 * (النوع/المبلغ/المفتاح/علاقات التصحيح) دون النصوص العرضية. */
function financialEventToken(event: FinancialEvent): string {
  return [
    event.id,
    event.type,
    event.amountMinor,
    event.idempotencyKey,
    event.correctionType ?? "",
    event.correctionOfEventId ?? "",
    event.assetContext?.assetId ?? "",
  ].join("~");
}

export function inventoryFinancialEventsFingerprint(events: readonly FinancialEvent[]): string {
  return events.map(financialEventToken).sort().join(";");
}

export type InventoryCommitExpectation = {
  movementsFingerprint?: string;
  materialsFingerprint?: string;
  shortagesFingerprint?: string;
  purchasesFingerprint?: string;
  /* مسار التراجع عن هدرٍ أثّر في النتيجة يقرأ الأحداث المالية ليقرر شكل
   * العكس (حركة وحدها أو حركة + عكس خسارة) — بصمة الأحداث تُقارن داخل
   * الحد فلا يمر عكسٌ مبسّط فوق خسارة ظهرت بعد القراءة. */
  eventsFingerprint?: string;
};

/** الشكل الموحد لنتيجة تطبيق التزام مخزون — يستهلكه المهايئان في تواقيع
 * المنافذ الثلاثة (كل منفذ يعرض أجزاءه). */
export type InventoryCommitApplyResult = {
  material: Material | null;
  movements: readonly InventoryMovement[];
  events: readonly FinancialEvent[];
  shortage: InventoryShortage | null;
  reused: boolean;
};

export type InventoryCommitDecision =
  | { kind: "reject"; code: "storage_stale" | "storage_error"; message: string }
  | {
      kind: "apply";
      reused: boolean;
      material: Material | null;
      newMovements: readonly InventoryMovement[];
      resultMovements: readonly InventoryMovement[];
      newEvents: readonly FinancialEvent[];
      resultEvents: readonly FinancialEvent[];
      newShortage: InventoryShortage | null;
      resultShortage: InventoryShortage | null;
    };

/** قرار التزام المخزون — المالك النقي الواحد للمهايئين. بلا توقع (البذر
 * المنخفض المستوى): سلوك الالتزام القائم نفسه حرفيًا (معاملات الأحداث
 * تحفظ منطق إعادة الاستخدام بالمفتاح القائم كما كان). بتوقع: فحص CAS
 * أولًا ثم الحتمية داخل الحد، وكل رفض بلا أي كتابة. */
export function decideInventoryCommit(input: {
  expectation: InventoryCommitExpectation | null | undefined;
  liveMovements: readonly InventoryMovement[];
  liveMaterials: readonly Material[] | null;
  liveShortages: readonly InventoryShortage[] | null;
  livePurchases: readonly SupplierPurchase[] | null;
  liveEvents: readonly FinancialEvent[] | null;
  material: Material | null;
  movements: readonly InventoryMovement[];
  events: readonly FinancialEvent[];
  shortage: InventoryShortage | null;
}): InventoryCommitDecision {
  const { expectation } = input;
  const asIs = (reused: boolean): InventoryCommitDecision => ({
    kind: "apply",
    reused,
    material: input.material,
    newMovements: input.movements,
    resultMovements: input.movements,
    newEvents: input.events,
    resultEvents: input.events,
    newShortage: input.shortage,
    resultShortage: input.shortage,
  });
  if (expectation) {
    /* ١) ذراع الحالة المتوقعة — بصمة لكل متجر حضوره إلزامي على المهايئ. */
    if (expectation.movementsFingerprint !== undefined) {
      if (expectation.movementsFingerprint !== inventoryMovementsFingerprint(input.liveMovements))
        return { kind: "reject", code: "storage_stale", message: INVENTORY_STATE_CHANGED_MESSAGE };
    }
    if (expectation.materialsFingerprint !== undefined) {
      if (!input.liveMaterials)
        return { kind: "reject", code: "storage_error", message: INVENTORY_EXPECTATION_INCOMPLETE_MESSAGE };
      if (expectation.materialsFingerprint !== inventoryMaterialsFingerprint(input.liveMaterials))
        return { kind: "reject", code: "storage_stale", message: INVENTORY_STATE_CHANGED_MESSAGE };
    }
    if (expectation.shortagesFingerprint !== undefined) {
      if (!input.liveShortages)
        return { kind: "reject", code: "storage_error", message: INVENTORY_EXPECTATION_INCOMPLETE_MESSAGE };
      if (expectation.shortagesFingerprint !== inventoryShortagesFingerprint(input.liveShortages))
        return { kind: "reject", code: "storage_stale", message: INVENTORY_STATE_CHANGED_MESSAGE };
    }
    if (expectation.purchasesFingerprint !== undefined) {
      if (!input.livePurchases)
        return { kind: "reject", code: "storage_error", message: INVENTORY_EXPECTATION_INCOMPLETE_MESSAGE };
      if (expectation.purchasesFingerprint !== inventoryPurchasesFingerprint(input.livePurchases))
        return { kind: "reject", code: "storage_stale", message: INVENTORY_STATE_CHANGED_MESSAGE };
    }
    if (expectation.eventsFingerprint !== undefined) {
      if (!input.liveEvents)
        return { kind: "reject", code: "storage_error", message: INVENTORY_EXPECTATION_INCOMPLETE_MESSAGE };
      if (expectation.eventsFingerprint !== inventoryFinancialEventsFingerprint(input.liveEvents))
        return { kind: "reject", code: "storage_stale", message: INVENTORY_STATE_CHANGED_MESSAGE };
    }
    /* ٢) الحتمية داخل الحد — المفتاح الذي سبقك مسار آخر بعد قراءتك:
     * نفس الهوية المالية إعادة استخدام صادقة، والهوية المختلفة تعارض. */
    const movementByKey = new Map(
      input.liveMovements.map(movement => [movement.operationKey, movement] as const),
    );
    let reused = false;
    const resultMovements: InventoryMovement[] = [];
    const newMovements: InventoryMovement[] = [];
    for (const movement of input.movements) {
      const stored = movementByKey.get(movement.operationKey);
      if (stored) {
        if (movementFinancialIdentity(stored) !== movementFinancialIdentity(movement))
          return {
            kind: "reject",
            code: "storage_stale",
            message: INVENTORY_OPERATION_KEY_CONFLICT_MESSAGE,
          };
        reused = true;
        resultMovements.push(stored);
        continue;
      }
      resultMovements.push(movement);
      newMovements.push(movement);
    }
    let newShortage: InventoryShortage | null = input.shortage;
    let resultShortage: InventoryShortage | null = input.shortage;
    if (input.shortage) {
      const storedShortage = input.liveShortages?.find(
        candidate => candidate.operationKey === input.shortage!.operationKey,
      );
      if (storedShortage) {
        if (storedShortage.id === input.shortage.id) {
          /* تحديث في موضعه للسجل نفسه (حل النقص مثلًا) — المفتاح مفتاح السجل
           * لا مفتاح عملية جديدة؛ ذراع CAS للنواقص يحرس تقادمه داخل الحد،
           * والكتابة تجري كما أرادت الخدمة. */
        } else if (shortageFinancialIdentity(storedShortage) === shortageFinancialIdentity(input.shortage)) {
          /* إعادة إرسال مكررة بنفس المفتاح ومحتوى مالي متطابق بعد القراءة —
           * إعادة استخدام صادقة للمخزّن بلا سجل ثانٍ. */
          reused = true;
          newShortage = null;
          resultShortage = storedShortage;
        } else {
          return {
            kind: "reject",
            code: "storage_stale",
            message: INVENTORY_OPERATION_KEY_CONFLICT_MESSAGE,
          };
        }
      }
    }
    const eventByKey = new Map((input.liveEvents ?? []).map(event => [event.idempotencyKey, event] as const));
    const resultEvents: FinancialEvent[] = [];
    const newEvents: FinancialEvent[] = [];
    for (const event of input.events) {
      const storedEvent = eventByKey.get(event.idempotencyKey);
      if (storedEvent) {
        reused = true;
        resultEvents.push(storedEvent);
        continue;
      }
      resultEvents.push(event);
      newEvents.push(event);
    }
    return {
      kind: "apply",
      reused,
      material: input.material,
      newMovements,
      resultMovements,
      newEvents,
      resultEvents,
      newShortage,
      resultShortage,
    };
  }
  /* بلا توقع (البذر/المطابقة منخفضة المستوى): معاملة الحركة+الحدث تحافظ
   * على منطق إعادة الاستخدام بالمفتاح القائم حرفيًا (أول-كتابة-يفوز كما
   * كان)، والبقية كتابة مباشرة كما كانت — لا سلوك جديد يُفترض. */
  if (input.events.length > 0) {
    if (!input.liveEvents) return asIs(false);
    const movementByKey = new Map(
      input.liveMovements.map(movement => [movement.operationKey, movement] as const),
    );
    const eventByKey = new Map(input.liveEvents.map(event => [event.idempotencyKey, event] as const));
    const newMovements = input.movements.filter(movement => !movementByKey.has(movement.operationKey));
    const newEvents = input.events.filter(event => !eventByKey.has(event.idempotencyKey));
    const reused = newMovements.length < input.movements.length || newEvents.length < input.events.length;
    return {
      kind: "apply",
      reused,
      material: input.material,
      newMovements,
      resultMovements: input.movements.map(movement => movementByKey.get(movement.operationKey) ?? movement),
      newEvents,
      resultEvents: input.events.map(event => eventByKey.get(event.idempotencyKey) ?? event),
      newShortage: input.shortage,
      resultShortage: input.shortage,
    };
  }
  return asIs(false);
}
