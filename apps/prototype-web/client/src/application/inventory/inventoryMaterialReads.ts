/* Wave F شريحة ٣ (ADR-014 — تقسيم مسؤولية داخلي، 2026-10-04): عائلة قراءات
 * المخزون المشتقة — نظرة عامة وقائمة الحركات ومقارنة مادة الطلب المنفذة
 * ومراجع الاستهلاك وحالة استلام الشراء وهدر الفترة (المجموعة ٢ عقد ٢٨:
 * المعرفة والحقول المشتقة تُقرأ من الحركات والسجلات لا تُخزن) — انتقلت
 * حرفيًا إلى هذا البيت الشقيق؛ الخدمة تفوّض هنا. قراءة فقط: لا كتابة أبدًا. */
import {
  lowStockAlertState,
  materialIsTracked,
  materialQuantityKnowledge,
  positionCostKnowledge,
  summarizeMaterialInventory,
  type InventoryMovement,
} from "@micro-domain/inventory-material/index.js";
import { storageFailure, validationFailure } from "@/application/resultCodes";
import type { PrototypeLocalStore } from "@/storage/local/types";
import type { InventoryMaterialStore } from "@/storage/local/capabilities/inventoryMaterialStore";

/** R3 (R3-SC-07): عدسة الوحدة — قراءة عابرة للعائلات (طلبات/مبيعات/
 * مشتريات/كتالوج/تفضيلات) بـPick موضعي يسرد المستخدم بالضبط. */
export type InventoryMaterialReadsStore = Pick<
  InventoryMaterialStore,
  "listMaterials" | "listInventoryMovements" | "listInventoryShortages"
> &
  Pick<
    PrototypeLocalStore,
    | "getPreferences"
    | "listOrders"
    | "getOrder"
    | "listDirectSales"
    | "listSupplierPurchases"
    | "listCatalogItems"
    | "listCatalogTemplates"
  >;
import {
  reversedMovementIdsOf,
  writeStorageFailure,
  type InventoryOverview,
  type InventoryReferences,
  type InventoryResult,
  type OrderActualMaterialComparison,
  type OrderActualMaterialComparisonReviewReason,
  type PeriodWasteReading,
  type PurchaseReceiptStatus,
} from "./inventoryMaterialModel";

export async function overview(
  store: InventoryMaterialReadsStore,
): Promise<InventoryResult<InventoryOverview>> {
  const [materials, movements, shortages, purchases] = await Promise.all([
    store.listMaterials(),
    store.listInventoryMovements(),
    store.listInventoryShortages(),
    store.listSupplierPurchases(),
  ]);
  if (!materials.ok || !movements.ok || !shortages.ok || !purchases.ok)
    return storageFailure("تعذر قراءة المواد المحلية.");
  /* المجموعة ٢ (عقد ٢٨): الإيصالات المعكوسة لا تحسب في المتبقي. */
  const reversedMovementIds = reversedMovementIdsOf(movements.value);
  const receivedValueByPurchase = new Map<string, number>();
  for (const movement of movements.value) {
    if (movement.type === "purchase_receipt" && movement.purchaseId && !reversedMovementIds.has(movement.id))
      receivedValueByPurchase.set(
        movement.purchaseId,
        (receivedValueByPurchase.get(movement.purchaseId) ?? 0) + movement.valueDeltaMinor,
      );
  }
  const openShortagesByMaterial = new Map<string, number>();
  for (const shortage of shortages.value) {
    if (shortage.status === "open")
      openShortagesByMaterial.set(
        shortage.materialId,
        (openShortagesByMaterial.get(shortage.materialId) ?? 0) + 1,
      );
  }
  /* Stage 2 — OPS-002: حدود التنبيه من التفضيلات — فشل قراءتها = سياسة غير
   * معروفة = لا تنبيه (تدهور صادق لا فشل عام للصفحة، ولا كتابة أبدًا). */
  const preferences = await store.getPreferences();
  const lowStockThresholds = preferences.ok ? (preferences.value?.lowStockThresholdsMilli ?? {}) : {};
  return {
    ok: true,
    value: {
      materials: materials.value.map(material => {
        const fold = summarizeMaterialInventory(material.id, movements.value);
        const awaitingPurchases = purchases.value.filter(
          purchase =>
            purchase.materialId === material.id &&
            (purchase.totalMinor ?? 0) - (receivedValueByPurchase.get(purchase.id) ?? 0) > 0,
        );
        return {
          ...material,
          ...fold,
          quantityKnowledge: materialQuantityKnowledge(material),
          costKnowledge: positionCostKnowledge(movements.value, material.id),
          openShortageCount: openShortagesByMaterial.get(material.id) ?? 0,
          awaitingReceiptPurchaseCount: awaitingPurchases.length,
          awaitingReceiptRemainingMinor: awaitingPurchases.reduce(
            (sum, purchase) => sum + (purchase.totalMinor - (receivedValueByPurchase.get(purchase.id) ?? 0)),
            0,
          ),
          lowStock: lowStockAlertState({
            tracked: materialIsTracked(material),
            quantityKnowledge: materialQuantityKnowledge(material),
            quantityMilli: fold.quantityMilli,
            thresholdMilli: lowStockThresholds[material.id],
          }),
          lowStockThresholdMilli: lowStockThresholds[material.id] ?? null,
        };
      }),
      movementCount: movements.value.length,
    },
  };
}

export async function listMovements(
  store: InventoryMaterialReadsStore,
): Promise<InventoryResult<readonly InventoryMovement[]>> {
  const result = await store.listInventoryMovements();
  return result.ok ? { ok: true, value: result.value } : storageFailure("تعذر قراءة حركات المواد المحلية.");
}

export async function readOrderActualMaterialComparison(
  store: InventoryMaterialReadsStore,
  orderId: string,
): Promise<InventoryResult<OrderActualMaterialComparison>> {
  const [orderResult, movementsResult] = await Promise.all([
    store.getOrder(orderId),
    store.listInventoryMovements(),
  ]);
  if (!orderResult.ok || !movementsResult.ok)
    return storageFailure("تعذر قراءة فرق المادة المنفذة لهذا الطلب.");
  if (!orderResult.value) return validationFailure("لم نجد الطلب المحلي الذي تريد مراجعة مادته.");
  const order = orderResult.value.order;
  const reversedMovementIds = reversedMovementIdsOf(movementsResult.value);
  const consumptions = movementsResult.value.filter(
    movement =>
      movement.type === "consumption" &&
      movement.orderId === orderId &&
      !reversedMovementIds.has(movement.id),
  );
  const plannedMaterialMinor = order.costSnapshot.materialCostMinor;
  const actualCostKnowledge: "known" | "unknown" | null =
    consumptions.length === 0
      ? null
      : consumptions.some(movement => movement.costKnowledge === "unknown")
        ? "unknown"
        : "known";
  if (consumptions.length === 0)
    return {
      ok: true,
      value: {
        orderId,
        status: "not_recorded",
        plannedMaterialMinor,
        actualMaterialMinor: null,
        actualQuantityMilli: null,
        varianceMinor: null,
        consumptionCount: 0,
        actualCostKnowledge: null,
        reviewReasons: [],
      },
    };
  const actualMaterialMinor = consumptions.reduce(
    (total, movement) => total + Math.abs(movement.valueDeltaMinor),
    0,
  );
  const actualQuantityMilli = consumptions.reduce(
    (total, movement) => total + Math.abs(movement.quantityDeltaMilli),
    0,
  );
  /* المجموعة ٢ (عقد ٢٨): استهلاك بتكلفة غير معروفة → «يحتاج مراجعة» — لا 0.00
   * واثقة (المجهول يُصرَّح به لا يُعرض صفرًا). */
  const snapshotKnowledgeKnown = order.costSnapshot.knowledgeState === "known";
  const status = snapshotKnowledgeKnown && actualCostKnowledge === "known" ? "recorded" : "needs_review";
  /* Stage 2 — OPS-007 (عقد ١٣): أسباب needs_review تُشتق من مصدرها الصريح */
  const reviewReasons: OrderActualMaterialComparisonReviewReason[] = [];
  if (!snapshotKnowledgeKnown) reviewReasons.push("snapshot_knowledge");
  if (actualCostKnowledge === "unknown") reviewReasons.push("actual_cost_unknown");
  return {
    ok: true,
    value: {
      orderId,
      status,
      plannedMaterialMinor,
      actualMaterialMinor,
      actualQuantityMilli,
      varianceMinor: actualMaterialMinor - plannedMaterialMinor,
      consumptionCount: consumptions.length,
      actualCostKnowledge,
      reviewReasons,
    },
  };
}

export async function readReferences(
  store: InventoryMaterialReadsStore,
): Promise<InventoryResult<InventoryReferences>> {
  const [materials, purchases, orders, catalogItems, catalogTemplates, movements, sales] = await Promise.all([
    store.listMaterials(),
    store.listSupplierPurchases(),
    store.listOrders(),
    store.listCatalogItems(),
    store.listCatalogTemplates(),
    store.listInventoryMovements(),
    /* المجموعة ٣ (عقد D6): المبيعات المباشرة النشطة — مرجع استهلاك صريح. */
    store.listDirectSales(),
  ]);
  if (
    !materials.ok ||
    !purchases.ok ||
    !orders.ok ||
    !catalogItems.ok ||
    !catalogTemplates.ok ||
    !movements.ok ||
    !sales.ok
  )
    return storageFailure("تعذر قراءة مراجع المادة أو الشراء أو الطلب.");
  /* المجموعة ٢ (عقد ٢٨): مواد المحررات = المتتبَّعة فقط (وعد «لن تظهر في
   * النماذج»)؛ وكل المواد تبقى لربط الشراء؛ والرصيد الحي لتحذير النقص. */
  const trackedMaterials = materials.value.filter(material => materialIsTracked(material));
  return {
    ok: true,
    value: {
      materials: trackedMaterials,
      allMaterials: materials.value,
      purchases: purchases.value.map(purchase => ({
        id: purchase.id,
        supplierName: purchase.supplierName,
        note: purchase.note,
        totalMinor: purchase.totalMinor,
        materialId: purchase.materialId ?? null,
        expectedQuantityMilli: purchase.expectedQuantityMilli ?? null,
      })),
      orders: orders.value.map(stored => ({
        id: stored.id,
        itemName: stored.order.itemName,
        customerName: stored.order.customerName,
      })),
      /* المجموعة ٣ (عقد D6): البيع النشط فقط — الملغى لا يُستهلك باسمه. */
      sales: sales.value
        .filter(sale => (sale.status ?? "active") === "active")
        .map(sale => ({
          id: sale.id,
          itemName: sale.itemName,
          revenueMinor: sale.revenueMinor,
        })),
      catalogItems: catalogItems.value,
      catalogTemplates: catalogTemplates.value,
      materialPositions: trackedMaterials.map(material => {
        const fold = summarizeMaterialInventory(material.id, movements.value);
        return {
          materialId: material.id,
          quantityMilli: fold.quantityMilli,
          valueMinor: fold.valueMinor,
          costKnowledge: positionCostKnowledge(movements.value, material.id),
        };
      }),
    },
  };
}

export async function readPurchaseReceiptStatus(
  store: InventoryMaterialReadsStore,
  purchaseId: string,
): Promise<InventoryResult<PurchaseReceiptStatus | null>> {
  const [purchases, movements] = await Promise.all([
    store.listSupplierPurchases(),
    store.listInventoryMovements(),
  ]);
  if (!purchases.ok || !movements.ok) return writeStorageFailure();
  const purchase = purchases.value.find(candidate => candidate.id === purchaseId);
  if (!purchase) return { ok: true, value: null };
  const reversedMovementIds = reversedMovementIdsOf(movements.value);
  const receipts = movements.value.filter(
    movement => movement.type === "purchase_receipt" && movement.purchaseId === purchaseId,
  );
  const active = receipts.filter(movement => !reversedMovementIds.has(movement.id));
  const receivedValueMinor = active.reduce((sum, movement) => sum + movement.valueDeltaMinor, 0);
  const receivedQuantityMilli =
    purchase.materialId !== null && purchase.materialId !== undefined
      ? active.reduce((sum, movement) => sum + movement.quantityDeltaMilli, 0)
      : null;
  /* S07 (UNIT-027 D01): حالة الاستلام لكل بند — الإيصالات النشطة لكل بند
   * بمفتاحه (purchaseLineId)، والمتبقي من حدود البند نفسه (قيمة معلومة →
   * متبقٍ محسوب؛ مجهولة → null لا صفرًا معلومًا). الغياب (إرث بلا بنود) =
   * بلا صفوف بنود: مسار الرأس القائم نفسه. */
  const lines = (purchase.lines ?? []).map(line => {
    const lineReceipts = active.filter(movement => movement.purchaseLineId === line.lineId);
    const lineReceivedValueMinor = lineReceipts.reduce((sum, movement) => sum + movement.valueDeltaMinor, 0);
    const lineReceivedQuantityMilli = lineReceipts.reduce(
      (sum, movement) => sum + movement.quantityDeltaMilli,
      0,
    );
    const lineValueKnown = line.costKnowledge === "known" && typeof line.valueMinor === "number";
    return {
      lineId: line.lineId,
      materialId: line.materialId ?? null,
      treatment: line.treatment,
      expectedQuantityMilli: line.expectedQuantityMilli ?? null,
      valueMinor: line.valueMinor ?? null,
      costKnowledge: line.costKnowledge,
      receivedValueMinor: lineReceivedValueMinor,
      remainingValueMinor: lineValueKnown ? (line.valueMinor as number) - lineReceivedValueMinor : null,
      receivedQuantityMilli: lineReceivedQuantityMilli,
      remainingQuantityMilli:
        (line.expectedQuantityMilli ?? null) !== null
          ? (line.expectedQuantityMilli as number) - lineReceivedQuantityMilli
          : null,
    };
  });
  return {
    ok: true,
    value: {
      purchaseId,
      totalMinor: purchase.totalMinor,
      expectedQuantityMilli: purchase.expectedQuantityMilli ?? null,
      materialId: purchase.materialId ?? null,
      receivedValueMinor,
      remainingValueMinor: purchase.totalMinor - receivedValueMinor,
      receivedQuantityMilli,
      remainingQuantityMilli:
        purchase.expectedQuantityMilli != null && receivedQuantityMilli != null
          ? purchase.expectedQuantityMilli - receivedQuantityMilli
          : null,
      receipts: receipts.map(movement => ({
        id: movement.id,
        materialId: movement.materialId,
        quantityMilli: movement.quantityDeltaMilli,
        valueMinor: movement.valueDeltaMinor,
        occurredOn: movement.occurredOn,
        reversed: reversedMovementIds.has(movement.id),
        purchaseLineId: movement.purchaseLineId ?? null,
      })),
      lines: lines.length > 0 ? lines : undefined,
    },
  };
}

export async function readPeriodWaste(
  store: InventoryMaterialReadsStore,
  from: string,
  to: string,
): Promise<InventoryResult<PeriodWasteReading>> {
  const movementsResult = await store.listInventoryMovements();
  if (!movementsResult.ok) return storageFailure("تعذر قراءة حركات المخزون المحلية.");
  const reversedMovementIds = reversedMovementIdsOf(movementsResult.value);
  const wasteMovements = movementsResult.value.filter(
    movement =>
      movement.type === "waste" &&
      !reversedMovementIds.has(movement.id) &&
      movement.occurredOn >= from &&
      movement.occurredOn <= to,
  );
  return {
    ok: true,
    value: {
      count: wasteMovements.length,
      valueMinor: wasteMovements.reduce((sum, movement) => sum + Math.abs(movement.valueDeltaMinor), 0),
      hasUnknownCost: wasteMovements.some(movement => movement.costKnowledge === "unknown"),
    },
  };
}
