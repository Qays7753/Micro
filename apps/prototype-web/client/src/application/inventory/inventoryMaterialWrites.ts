/* Wave F شريحة ٣ (ADR-014 — تقسيم مسؤولية داخلي، 2026-10-04): مسار كتابة
 * حركات المخزون القياسي المحروس — استلام الشراء والاستهلاك (لطلب أو بيع
 * مباشر أو بيان) والضبط والتراجع المرآتي — انتقل حرفيًا إلى هذا البيت
 * الشقيق؛ الخدمة تفوّض هنا. كل الحراس باقية كما كانت: حتمية operationKey،
 * وعدم سلبية الرصيد (assertInventoryRemainsNonNegative)، ومعرفة التكلفة
 * الموسومة، وذَرّية المعاملات. لا صيغة ولا تقريب ولا هوية خطأ تحرّك —
 * نقل نصّي فقط. مسارات الهدر وإخراج المتبقي في البيت الشقيق
 * inventoryMaterialWaste (حد النمو لـADR-014: كل ملف بعد التقسيم دون WATCH). */
import {
  assertInventoryRemainsNonNegative,
  consumptionValueMinor,
  createInventoryMovement,
  materialIsTracked,
  positionCostKnowledge,
  type InventoryMovement,
} from "@micro-domain/inventory-material/index.js";
import { createFinancialReversal } from "@micro-domain/financial-event/index.js";
import { errorMessageOf, validationFailure } from "@/application/resultCodes";
import type { Clock } from "@/application/time/clock";
import type { PrototypeLocalStore } from "@/storage/local/types";
import type { InventoryMaterialStore } from "@/storage/local/capabilities/inventoryMaterialStore";

/** R3 (R3-SC-07): عدسة الوحدة — الكتابة بمصادرها العابرة للعائلات. */
export type InventoryMaterialWritesStore = Pick<
  InventoryMaterialStore,
  "listMaterials" | "listInventoryMovements" | "commitInventory" | "commitInventoryWithEvents"
> &
  Pick<
    PrototypeLocalStore,
    "getOrder" | "listDirectSales" | "listFinancialEvents" | "listSupplierPurchases"
  >;
import {
  id,
  materialById,
  movementByOperationKey,
  reversedMovementIdsOf,
  writeStorageFailure,
  type AdjustMaterialInput,
  type ConsumeMaterialInput,
  type InventoryResult,
  type ReceivePurchaseInput,
  type ReverseInventoryInput,
} from "./inventoryMaterialModel";

export async function receivePurchase(
  store: InventoryMaterialWritesStore,
  now: Clock,
  input: ReceivePurchaseInput,
): Promise<InventoryResult<InventoryMovement>> {
  const [materials, movements, purchases] = await Promise.all([
    store.listMaterials(),
    store.listInventoryMovements(),
    store.listSupplierPurchases(),
  ]);
  if (!materials.ok || !movements.ok || !purchases.ok) return writeStorageFailure();
  const repeated = movementByOperationKey(movements.value, input.operationKey);
  if (repeated) return { ok: true, value: repeated, reused: true };
  const material = materialById(materials.value, input.materialId);
  if (!material) return validationFailure("اختر مادة موجودة قبل استلام الشراء.");
  /* المجموعة ٢ (عقد ٢٨): الاستلام حركة تتبع — المادة غير المتتبَّعة لا تستلم. */
  if (!materialIsTracked(material))
    return validationFailure("المادة غير متتبَّعة — فعّل متابعتها أولًا ثم استلم الشراء.");
  const purchase = purchases.value.find(candidate => candidate.id === input.purchaseId);
  if (!purchase) return validationFailure("اختر شراء مواد موجودًا لاستلامه.");
  /* المجموعة ٢ (عقد ٢٨): الشراء المرتبط بمادة تُستلم عليها — الربط عقد، لا اقتراح. */
  if (purchase.materialId && purchase.materialId !== input.materialId)
    return validationFailure("هذا الشراء مرتبط بمادة أخرى — استلمه على مادته أو عدّل ربط الشراء.");
  const reversedMovementIds = reversedMovementIdsOf(movements.value);
  const activeReceipts = movements.value.filter(
    movement =>
      movement.type === "purchase_receipt" &&
      movement.purchaseId === input.purchaseId &&
      !reversedMovementIds.has(movement.id),
  );
  const receivedValue = activeReceipts.reduce((sum, movement) => sum + movement.valueDeltaMinor, 0);
  if (receivedValue + input.valueMinor > purchase.totalMinor)
    return validationFailure("قيمة الاستلام تتجاوز إجمالي شراء المواد المرجعي.");
  /* المجموعة ٢ (عقد ٢٨): حد الكمية المتوقعة — الاستلام الجزئي المتعمد مسموح،
   * والتجاوز فوق المتوقع يُرفض بصدق (وحدة المادة واحدة لأن الربط ملزم أعلاه). */
  if (purchase.expectedQuantityMilli !== null && purchase.expectedQuantityMilli !== undefined) {
    const receivedQuantity = activeReceipts.reduce((sum, movement) => sum + movement.quantityDeltaMilli, 0);
    if (receivedQuantity + input.quantityMilli > purchase.expectedQuantityMilli)
      return validationFailure("الكمية المستلمة تتجاوز الكمية المتوقعة لهذا الشراء.");
  }
  try {
    const movement = createInventoryMovement({
      id: id("receipt"),
      materialId: input.materialId,
      type: "purchase_receipt",
      occurredOn: input.occurredOn,
      recordedAt: now(),
      quantityDeltaMilli: input.quantityMilli,
      valueDeltaMinor: input.valueMinor,
      note: input.note,
      operationKey: input.operationKey,
      purchaseId: input.purchaseId,
      costKnowledge: input.costKnowledge === "unknown" ? "unknown" : "known",
    });
    const saved = await store.commitInventory(null, [movement]);
    return saved.ok ? { ok: true, value: movement } : writeStorageFailure();
  } catch (error) {
    return validationFailure(errorMessageOf(error, "بيانات استلام الشراء غير صالحة."));
  }
}

export async function consumeMaterial(
  store: InventoryMaterialWritesStore,
  now: Clock,
  input: ConsumeMaterialInput,
): Promise<InventoryResult<InventoryMovement>> {
  const [materials, movements, order, sales] = await Promise.all([
    store.listMaterials(),
    store.listInventoryMovements(),
    input.orderId ? store.getOrder(input.orderId) : Promise.resolve({ ok: true, value: null } as const),
    /* المجموعة ٣ (عقد D6): تحقق وجود البيع المباشر المرتبط إن ذُكر. */
    input.saleId ? store.listDirectSales() : Promise.resolve({ ok: true, value: [] as const } as const),
  ]);
  if (!materials.ok || !movements.ok || !order.ok || !sales.ok) return writeStorageFailure();
  const repeated = movementByOperationKey(movements.value, input.operationKey);
  if (repeated) return { ok: true, value: repeated, reused: true };
  const material = materialById(materials.value, input.materialId);
  if (!material) return validationFailure("اختر مادة موجودة قبل تسجيل الاستهلاك.");
  /* المجموعة ٢ (عقد ٢٨): الاستهلاك حركة تتبع — المادة غير المتتبَّعة لا تُستهلك. */
  if (!materialIsTracked(material))
    return validationFailure("المادة غير متتبَّعة — فعّل متابعتها أولًا قبل تسجيل الاستهلاك.");
  if (input.orderId && !order.value) return validationFailure("اختر طلبًا محليًا موجودًا لاستهلاك المادة.");
  /* المجموعة ٣ (عقد D6): البيع المرتبط إن ذُكر يجب أن يكون مسجلًا ونشطًا —
   * الملغى لا يُستهلك باسمه (المُنتقي يرى النشط فقط؛ الحارس هنا يطابق). */
  if (
    input.saleId &&
    !sales.value.some(sale => sale.id === input.saleId && (sale.status ?? "active") === "active")
  )
    return validationFailure("اختر بيعًا مباشرًا نشطًا لاستهلاك المادة.");
  /* المجموعة ٢ (عقد ٢٨): استهلاك بلا طلب يحتاج بيانًا واضحًا (عمل المشروع).
   * المجموعة ٣ (عقد D6): البيع المباشر مرجع صريح يغني عن البيان. */
  if (!input.orderId && !input.saleId && !input.reason?.trim())
    return validationFailure("استهلاك بلا طلب أو بيع يحتاج بيانًا واضحًا — مثال: تجربة لون لطلب قادم.");
  try {
    const position = assertInventoryRemainsNonNegative(input.materialId, movements.value);
    const costUnknown = positionCostKnowledge(movements.value, input.materialId) === "unknown";
    const value = consumptionValueMinor(input.quantityMilli, position, costUnknown);
    const movement = createInventoryMovement({
      id: id("consume"),
      materialId: input.materialId,
      type: "consumption",
      occurredOn: input.occurredOn,
      recordedAt: now(),
      quantityDeltaMilli: -input.quantityMilli,
      valueDeltaMinor: -value || 0,
      note: input.note,
      reason: input.reason?.trim() || null,
      operationKey: input.operationKey,
      orderId: input.orderId,
      saleId: input.saleId ?? null,
      costKnowledge: value === 0 ? "unknown" : "known",
    });
    const saved = await store.commitInventory(null, [movement]);
    return saved.ok ? { ok: true, value: movement } : writeStorageFailure();
  } catch (error) {
    return validationFailure(errorMessageOf(error, "بيانات استهلاك المادة غير صالحة."));
  }
}

export async function adjustMaterial(
  store: InventoryMaterialWritesStore,
  now: Clock,
  input: AdjustMaterialInput,
): Promise<InventoryResult<InventoryMovement>> {
  const [materials, movements] = await Promise.all([store.listMaterials(), store.listInventoryMovements()]);
  if (!materials.ok || !movements.ok) return writeStorageFailure();
  const repeated = movementByOperationKey(movements.value, input.operationKey);
  if (repeated) return { ok: true, value: repeated, reused: true };
  const material = materialById(materials.value, input.materialId);
  if (!material) return validationFailure("اختر مادة موجودة قبل ضبطها.");
  if (!materialIsTracked(material))
    return validationFailure("المادة غير متتبَّعة — فعّل متابعتها أولًا قبل الضبط.");
  try {
    const position = assertInventoryRemainsNonNegative(input.materialId, movements.value);
    let value: number;
    let costKnowledge: "known" | "unknown" = "known";
    if (input.quantityDeltaMilli > 0) {
      const increaseCostUnknown = input.increaseCostKnowledge === "unknown";
      if (increaseCostUnknown) {
        /* المجموعة ٢ (عقد ٢٨): زيادة بتكلفة غير معروفة — قيمة صفرية موسومة. */
        value = 0;
        costKnowledge = "unknown";
      } else {
        if (
          !Number.isInteger(input.valueMinorWhenIncrease) ||
          input.valueMinorWhenIncrease === null ||
          input.valueMinorWhenIncrease <= 0
        )
          throw new Error("ضبط الزيادة يحتاج قيمة موجبة معلنة.");
        value = input.valueMinorWhenIncrease;
      }
    } else {
      const costUnknownPosition = positionCostKnowledge(movements.value, input.materialId) === "unknown";
      value = -consumptionValueMinor(Math.abs(input.quantityDeltaMilli), position, costUnknownPosition);
      if (value === 0) costKnowledge = "unknown";
    }
    const movement = createInventoryMovement({
      id: id("adjust-material"),
      materialId: input.materialId,
      type: "adjustment",
      occurredOn: input.occurredOn,
      recordedAt: now(),
      quantityDeltaMilli: input.quantityDeltaMilli,
      valueDeltaMinor: value,
      note: input.note,
      reason: input.reason,
      operationKey: input.operationKey,
      costKnowledge,
    });
    assertInventoryRemainsNonNegative(input.materialId, [...movements.value, movement]);
    const saved = await store.commitInventory(null, [movement]);
    return saved.ok ? { ok: true, value: movement } : writeStorageFailure();
  } catch (error) {
    return validationFailure(errorMessageOf(error, "بيانات ضبط المادة غير صالحة."));
  }
}

export async function reverseMovement(
  store: InventoryMaterialWritesStore,
  now: Clock,
  input: ReverseInventoryInput,
): Promise<InventoryResult<InventoryMovement>> {
  const movementsResult = await store.listInventoryMovements();
  if (!movementsResult.ok) return writeStorageFailure();
  const movements = movementsResult.value;
  const repeated = movementByOperationKey(movements, input.operationKey);
  if (repeated) return { ok: true, value: repeated, reused: true };
  const target = movements.find(movement => movement.id === input.movementId);
  if (!target) return validationFailure("لم نجد حركة المادة التي تريد التراجع عنها.");
  if (target.type === "reversal" || movements.some(movement => movement.reversesMovementId === target.id))
    return validationFailure("تم التراجع عن هذه الحركة سابقًا ولا يمكن التراجع عنها مرة ثانية.");
  try {
    const reversal = createInventoryMovement({
      id: id("reverse-material"),
      materialId: target.materialId,
      type: "reversal",
      occurredOn: input.occurredOn,
      recordedAt: now(),
      quantityDeltaMilli: -target.quantityDeltaMilli,
      valueDeltaMinor: -target.valueDeltaMinor,
      note: `تراجع: ${target.note}`,
      reason: input.reason,
      operationKey: input.operationKey,
      reversesMovementId: target.id,
      /* المجموعة ٢ (عقد ٢٨): المرآة تحمل معرفة تكلفة الأصل — صفر موسوم يبقى موسومًا. */
      costKnowledge: target.costKnowledge ?? "known",
    });
    assertInventoryRemainsNonNegative(target.materialId, [...movements, reversal]);
    /* عقد الإغلاق العميق (العقد ١): التراجع عن هدرٍ أثّر في النتيجة يعكس
     * الحركة وحدث الخسارة معًا في معاملة واحدة — لا رصيد يعود وخسارة تبقى. */
    if (target.type === "waste" && target.wasteProfitImpact === true) {
      const eventsResult = await store.listFinancialEvents();
      if (!eventsResult.ok) return writeStorageFailure();
      const lossEvent = eventsResult.value.find(
        event =>
          event.idempotencyKey === `${target.operationKey}:loss` &&
          event.type === "loss_non_cash" &&
          !event.correctionType,
      );
      if (lossEvent) {
        const lossReversal = createFinancialReversal({
          id: id("waste-loss-reverse"),
          sourceEvent: lossEvent,
          occurredOn: input.occurredOn,
          recordedAt: now(),
          idempotencyKey: `${input.operationKey}:loss-reversal`,
          reason: input.reason,
        });
        const saved = await store.commitInventoryWithEvents(null, [reversal], [lossReversal]);
        return saved.ok
          ? { ok: true, value: saved.value.movements[0] ?? reversal, reused: saved.value.reused }
          : writeStorageFailure();
      }
    }
    const saved = await store.commitInventory(null, [reversal]);
    return saved.ok ? { ok: true, value: reversal } : writeStorageFailure();
  } catch (error) {
    return validationFailure(errorMessageOf(error, "بيانات التراجع عن المادة غير صالحة."));
  }
}
