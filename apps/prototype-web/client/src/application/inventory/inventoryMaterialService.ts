import {
  applyInventoryShortageResolution,
  assertInventoryRemainsNonNegative,
  consumptionValueMinor,
  createInventoryMovement,
  createInventoryShortage,
  createMaterial,
  materialIsTracked,
  materialQuantityKnowledge,
  positionCostKnowledge,
  summarizeMaterialInventory,
  type InventoryMovement,
  type InventoryShortage,
  type Material,
  type MaterialOpeningKnowledge,
  type MaterialUnit,
  type WasteContext,
} from "@micro-domain/inventory-material/index.js";
import type { CatalogItem, CatalogTemplate } from "@micro-domain/catalog/index.js";
import {
  localInventoryActivationId,
  type InventoryActivation,
  type PrototypeLocalStore,
} from "@/storage/local/types";

export type InventoryResult<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };
/* المجموعة ٢ (عقد ٢٨): القراءة المشتقة للمادة — المعرفة (كمية/تكلفة) وحقول النقص
 * والانتظار تُشتق من الحركات والسجلات، لا تُخزن. */
export type InventoryMaterialOverview = Material & {
  quantityMilli: number;
  valueMinor: number;
  movementCount: number;
  quantityKnowledge: "known" | "unconfirmed";
  costKnowledge: "known" | "partial" | "unknown";
  openShortageCount: number;
  awaitingReceiptPurchaseCount: number;
  awaitingReceiptRemainingMinor: number;
};
export type InventoryOverview = {
  materials: readonly InventoryMaterialOverview[];
  movementCount: number;
};
/* القرار ٩: التفعيل صريح مؤرّخ — الموضع غير نشط قبله. الإرث الموجود (مواد أو حركات
 * بلا سجل) يُقرأ تفعيله من أقدم دليل، لأن حمل مستخدم قائم على بوابة جديدة يعيد
 * إنتاج period_result بصيغة ثانية (القرار ٧). */
export type InventoryActivationState = {
  activatedOn: string | null;
  source: "declared" | "derived" | null;
};
export type InventoryActivationInput = { operationKey: string };
export type OrderActualMaterialComparison = {
  orderId: string;
  status: "not_recorded" | "recorded" | "needs_review";
  plannedMaterialMinor: number;
  actualMaterialMinor: number | null;
  actualQuantityMilli: number | null;
  varianceMinor: number | null;
  consumptionCount: number;
  /* المجموعة ٢ (عقد ٢٨): معرفة تكلفة الاستهلاك الفعلي — استهلاك بتكلفة غير معروفة
   * لا يظهر 0.00 واثقًا في مقارنة الطلب. */
  actualCostKnowledge: "known" | "unknown" | null;
};
export type InventoryReferences = {
  materials: readonly Material[];
  /* المجموعة ٢ (عقد ٢٨): كل المواد (مربوطة الشراء تشمل غير المتتبَّعة). */
  allMaterials: readonly Material[];
  purchases: readonly {
    id: string;
    supplierName: string;
    note: string;
    totalMinor: number;
    materialId: string | null;
    expectedQuantityMilli: number | null;
  }[];
  orders: readonly { id: string; itemName: string; customerName: string }[];
  /* المجموعة ٣ (عقد D6): المبيعات المباشرة النشطة — مرجع استهلاك صريح كالطلب. */
  sales: readonly { id: string; itemName: string; revenueMinor: number }[];
  catalogItems: readonly CatalogItem[];
  catalogTemplates: readonly CatalogTemplate[];
  /* المجموعة ٢ (عقد ٢٨): الرصيد الحي لكل مادة متتبَّعة — لتحذير النقص قبل الحفظ. */
  materialPositions: readonly {
    materialId: string;
    quantityMilli: number;
    valueMinor: number;
    costKnowledge: "known" | "partial" | "unknown";
  }[];
};
/* المجموعة ٢ (عقد ٢٨): معرفة رصيد البداية في رحلة الإنشاء/التأكيد. */
export type MaterialOpeningInput = {
  quantityState: "unconfirmed" | "confirmed";
  quantityMilli: number | null;
  costState: "known" | "unknown";
  valueMinor: number | null;
  confirmedOn: string | null;
  sourceNote: string | null;
};
export type OpenMaterialInput = {
  name: string;
  unit: MaterialUnit;
  /* المجموعة ٢ (عقد ٢٨): قرار المتابعة صريح لكل مادة. */
  tracking: "tracked" | "untracked";
  opening: MaterialOpeningInput;
  note: string;
  operationKey: string;
};
export type ReceivePurchaseInput = {
  materialId: string;
  purchaseId: string;
  quantityMilli: number;
  valueMinor: number;
  /* المجموعة ٢ (عقد ٢٨): قيمة الاستلام قد تكون غير معروفة — قيمة صفرية موسومة. */
  costKnowledge?: "known" | "unknown";
  occurredOn: string;
  note: string;
  operationKey: string;
};
export type ConsumeMaterialInput = {
  materialId: string;
  /* المجموعة ٢ (عقد ٢٨): الاستهلاك لطلب محدد أو لعمل المشروع (بسبب/بيان). */
  orderId: string | null;
  /* المجموعة ٣ (عقد D6): استهلاك مرتبط ببيع مباشر — مرجع صريح كالطلب. */
  saleId?: string | null;
  reason: string | null;
  quantityMilli: number;
  occurredOn: string;
  note: string;
  operationKey: string;
};
export type WasteMaterialInput = {
  materialId: string;
  quantityMilli: number;
  occurredOn: string;
  note: string;
  reason: string;
  operationKey: string;
  wasteContext?: WasteContext | null;
};
/* القرار ٢٠: «أخرِج المتبقي» — المادة والسبب فقط؛ الكمية والقيمة تأتيان من المتبقي كاملًا. */
export type ExtractRemainderInput = {
  materialId: string;
  occurredOn: string;
  reason: string;
  operationKey: string;
};
export type AdjustMaterialInput = {
  materialId: string;
  quantityDeltaMilli: number;
  valueMinorWhenIncrease: number | null;
  /* المجموعة ٢ (عقد ٢٨): زيادة بتكلفة غير معروفة — قيمة صفرية موسومة لا مبلغ معلن. */
  increaseCostKnowledge?: "known" | "unknown";
  occurredOn: string;
  note: string;
  reason: string;
  operationKey: string;
};
export type ReverseInventoryInput = {
  movementId: string;
  occurredOn: string;
  reason: string;
  operationKey: string;
};
/* المجموعة ٢ (عقد ٢٨ / D-027): سجل النقص وإحصاءات الاستلام. */
export type RecordShortageInput = {
  materialId: string;
  requestedQuantityMilli: number;
  orderId: string | null;
  occurredOn: string;
  note: string;
  operationKey: string;
};
export type ResolveShortageInput = {
  shortageId: string;
  resolutionNote: string;
  resolvedOn: string;
};
export type PurchaseReceiptStatus = {
  purchaseId: string;
  totalMinor: number;
  expectedQuantityMilli: number | null;
  materialId: string | null;
  receivedValueMinor: number;
  remainingValueMinor: number;
  receivedQuantityMilli: number | null;
  remainingQuantityMilli: number | null;
  receipts: readonly {
    id: string;
    materialId: string;
    quantityMilli: number;
    valueMinor: number;
    occurredOn: string;
    reversed: boolean;
  }[];
};
export type UntrackMaterialInput = {
  materialId: string;
  reason: string | null;
  operationKey: string;
};
export type RetrackMaterialInput = { materialId: string; operationKey: string };
export type ConfirmOpeningInput = {
  materialId: string;
  actualQuantityMilli: number;
  costKnown: boolean;
  valueMinor: number | null;
  occurredOn: string;
  note: string;
  sourceNote: string | null;
  operationKey: string;
};
export type PeriodWasteReading = {
  count: number;
  valueMinor: number;
  hasUnknownCost: boolean;
};

const id = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const storageFailure = <T>(): InventoryResult<T> => ({
  ok: false,
  code: "storage_error",
  message: "تعذر حفظ حركة المادة محليًا. لم يتم تأكيد نجاح العملية.",
});
const ammanLocalDate = (iso: string): string => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find(entry => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export class InventoryMaterialService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}
  async overview(): Promise<InventoryResult<InventoryOverview>> {
    const [materials, movements, shortages, purchases] = await Promise.all([
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
      this.store.listInventoryShortages(),
      this.store.listSupplierPurchases(),
    ]);
    if (!materials.ok || !movements.ok || !shortages.ok || !purchases.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة المواد المحلية." };
    /* المجموعة ٢ (عقد ٢٨): الإيصالات المعكوسة لا تحسب في المتبقي. */
    const reversedMovementIds = new Set(
      movements.value
        .filter(movement => movement.type === "reversal" && movement.reversesMovementId)
        .map(movement => movement.reversesMovementId),
    );
    const receivedValueByPurchase = new Map<string, number>();
    for (const movement of movements.value) {
      if (
        movement.type === "purchase_receipt" &&
        movement.purchaseId &&
        !reversedMovementIds.has(movement.id)
      )
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
          };
        }),
        movementCount: movements.value.length,
      },
    };
  }
  async movements(): Promise<InventoryResult<readonly InventoryMovement[]>> {
    const result = await this.store.listInventoryMovements();
    return result.ok
      ? { ok: true, value: result.value }
      : { ok: false, code: "storage_error", message: "تعذر قراءة حركات المواد المحلية." };
  }
  /* القرار ٩: قراءة تفعيل المخزون — المعلن صراحة أولًا، ثم أقدم دليل للموجود القائم. */
  async readActivation(): Promise<InventoryResult<InventoryActivationState>> {
    const [activation, materials, movements] = await Promise.all([
      this.store.getInventoryActivation(),
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
    ]);
    if (!activation.ok || !materials.ok || !movements.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة حالة تفعيل المخزون." };
    if (activation.value)
      return {
        ok: true,
        value: {
          activatedOn: activation.value.activatedOn,
          source: "declared",
        },
      };
    const evidenceDates = [
      ...movements.value.map(movement => movement.occurredOn),
      ...materials.value.map(material => material.createdAt.slice(0, 10)),
    ].filter(date => date);
    if (evidenceDates.length === 0)
      return {
        ok: true,
        value: {
          activatedOn: null,
          source: null,
        },
      };
    const earliest = evidenceDates.sort()[0]!;
    return {
      ok: true,
      value: {
        activatedOn: earliest,
        source: "derived",
      },
    };
  }
  /** القرار ٩: تفعيل صريح بتاريخ اليوم — لحظة معلنة تُعرض، والرصيد يومها يكفي. */
  async activate(input: InventoryActivationInput): Promise<InventoryResult<InventoryActivation>> {
    const current = await this.store.getInventoryActivation();
    if (!current.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة حالة تفعيل المخزون." };
    if (current.value) return { ok: true, value: current.value, reused: true };
    const activation: InventoryActivation = {
      id: localInventoryActivationId,
      activatedOn: ammanLocalDate(this.now()),
      recordedAt: this.now(),
      operationKey: input.operationKey,
    };
    const saved = await this.store.saveInventoryActivation(activation);
    return saved.ok ? { ok: true, value: saved.value } : storageFailure();
  }
  async readOrderActualMaterialComparison(
    orderId: string,
  ): Promise<InventoryResult<OrderActualMaterialComparison>> {
    const [orderResult, movementsResult] = await Promise.all([
      this.store.getOrder(orderId),
      this.store.listInventoryMovements(),
    ]);
    if (!orderResult.ok || !movementsResult.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة فرق المادة المنفذة لهذا الطلب." };
    if (!orderResult.value)
      return { ok: false, code: "validation_error", message: "لم نجد الطلب المحلي الذي تريد مراجعة مادته." };
    const order = orderResult.value.order;
    const reversedMovementIds = new Set(
      movementsResult.value
        .filter(movement => movement.type === "reversal" && movement.reversesMovementId)
        .map(movement => movement.reversesMovementId),
    );
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
    const status =
      order.costSnapshot.knowledgeState === "known" && actualCostKnowledge === "known"
        ? "recorded"
        : "needs_review";
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
      },
    };
  }
  async references(): Promise<InventoryResult<InventoryReferences>> {
    const [materials, purchases, orders, catalogItems, catalogTemplates, movements, sales] = await Promise.all([
      this.store.listMaterials(),
      this.store.listSupplierPurchases(),
      this.store.listOrders(),
      this.store.listCatalogItems(),
      this.store.listCatalogTemplates(),
      this.store.listInventoryMovements(),
      /* المجموعة ٣ (عقد D6): المبيعات المباشرة النشطة — مرجع استهلاك صريح. */
      this.store.listDirectSales(),
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
      return { ok: false, code: "storage_error", message: "تعذر قراءة مراجع المادة أو الشراء أو الطلب." };
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
  async openMaterial(
    input: OpenMaterialInput,
  ): Promise<InventoryResult<{ material: Material; opening: InventoryMovement | null }>> {
    const [materials, movements] = await Promise.all([
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
    ]);
    if (!materials.ok || !movements.ok) return storageFailure();
    const repeated = materials.value.find(material => material.createdOperationKey === input.operationKey);
    if (repeated)
      return {
        ok: true,
        value: {
          material: repeated,
          opening: movements.value.find(movement => movement.operationKey === input.operationKey) ?? null,
        },
        reused: true,
      };
    try {
      /* المجموعة ٢ (عقد ٢٨): الرحلة الموجهة — قرار متابعة + معرفة رصيد البداية.
       * غير المتتبَّعة: بلا حركة وبلا رصيد؛ مؤكد موجب: حركة بداية؛ غير محدد/صفر
       * مؤكد: بلا حركة — الصفر المعلن حالة معرفة لا حركة. */
      const isTracked = input.tracking === "tracked";
      const confirmed = input.opening.quantityState === "confirmed";
      const quantityMilli = input.opening.quantityMilli;
      const costKnown = isTracked && confirmed && (quantityMilli ?? 0) > 0 && input.opening.costState === "known";
      if (!isTracked && input.opening.quantityState === "confirmed")
        throw new Error(
          "المادة غير المتتبَّعة لا تحتاج رصيد بداية — أنشئها للتكلفة فقط أو فعّل المتابعة.",
        );
      if (confirmed && (quantityMilli === null || quantityMilli === undefined))
        throw new Error("الرصيد المؤكد يحتاج كمية معلومة.");
      if (confirmed && (quantityMilli as number) < 0)
        throw new Error("الكمية لا يمكن أن تكون سالبة.");
      if (costKnown && (!Number.isInteger(input.opening.valueMinor) || (input.opening.valueMinor as number) <= 0))
        throw new Error("قيمة الرصيد المعروفة يجب أن تكون رقمًا موجبًا — أو اختر «غير معروفة بعد».");
      const openingKnowledge: MaterialOpeningKnowledge | null = isTracked
        ? {
            quantityState: input.opening.quantityState,
            quantityMilli: confirmed ? (quantityMilli as number) : null,
            costState: costKnown ? "known" : "unknown",
            valueMinor: costKnown ? (input.opening.valueMinor as number) : null,
            confirmedOn: confirmed ? input.opening.confirmedOn : null,
            sourceNote: input.opening.sourceNote?.trim() || null,
          }
        : null;
      const material = createMaterial({
        id: id("material"),
        name: input.name,
        unit: input.unit,
        createdAt: this.now(),
        createdOperationKey: input.operationKey,
        tracking: {
          status: isTracked ? "tracked" : "untracked",
          decidedOn: isTracked && confirmed ? input.opening.confirmedOn : null,
          reason: null,
        },
        opening: openingKnowledge,
      });
      const opening =
        isTracked && confirmed && (quantityMilli as number) > 0
          ? createInventoryMovement({
              id: id("opening-material"),
              materialId: material.id,
              type: "opening",
              occurredOn: input.opening.confirmedOn ?? ammanLocalDate(this.now()),
              recordedAt: this.now(),
              quantityDeltaMilli: quantityMilli as number,
              valueDeltaMinor: costKnown ? (input.opening.valueMinor as number) : 0,
              note: input.note,
              operationKey: input.operationKey,
              costKnowledge: costKnown ? "known" : "unknown",
            })
          : null;
      const saved = await this.store.commitInventory(material, opening ? [opening] : []);
      return saved.ok ? { ok: true, value: { material, opening } } : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات المادة غير صالحة.",
      };
    }
  }
  /* المجموعة ٢ (عقد ٢٨): إيقاف المتابعة بعواقب معلنة — الحركات كلها تبقى، والرصيد
   * يجمَّد في السجل، وإعادة التفعيل تعيده «غير محدد بعد» حتى يؤكده المالك. */
  async untrackMaterial(
    input: UntrackMaterialInput,
  ): Promise<InventoryResult<Material>> {
    const materialsResult = await this.store.listMaterials();
    if (!materialsResult.ok) return storageFailure();
    const material = materialsResult.value.find(candidate => candidate.id === input.materialId);
    if (!material)
      return { ok: false, code: "validation_error", message: "لم نجد المادة التي تريد إيقاف متابعتها." };
    if (!materialIsTracked(material))
      return { ok: true, value: material, reused: true };
    const updated: Material = {
      ...material,
      tracking: {
        status: "untracked",
        decidedOn: ammanLocalDate(this.now()),
        reason: input.reason?.trim() || null,
      },
    };
    const saved = await this.store.commitInventory(updated, []);
    return saved.ok ? { ok: true, value: updated } : storageFailure();
  }
  /* المجموعة ٢ (عقد ٢٨): إعادة التفعيل — الرصيد المحفوظ يعود «غير محدد بعد» حتى
   * يؤكده المالك من جديد؛ لا ثقة صامتة برقم قديم. */
  async retrackMaterial(input: RetrackMaterialInput): Promise<InventoryResult<Material>> {
    const materialsResult = await this.store.listMaterials();
    if (!materialsResult.ok) return storageFailure();
    const material = materialsResult.value.find(candidate => candidate.id === input.materialId);
    if (!material)
      return { ok: false, code: "validation_error", message: "لم نجد المادة التي تريد تفعيل متابعتها." };
    if (materialIsTracked(material)) return { ok: true, value: material, reused: true };
    const updated: Material = {
      ...material,
      tracking: { status: "tracked", decidedOn: ammanLocalDate(this.now()), reason: null },
      opening: {
        quantityState: "unconfirmed",
        quantityMilli: null,
        costState: "unknown",
        valueMinor: null,
        confirmedOn: null,
        sourceNote: null,
      },
    };
    const saved = await this.store.commitInventory(updated, []);
    return saved.ok ? { ok: true, value: updated } : storageFailure();
  }
  /* المجموعة ٢ (عقد ٢٨): تأكيد رصيد — الفرق عن الحركات المحفوظة يُسجَّل بحركة
   * موثقة (بداية إن كانت أول حركة، أو ضبطًا)، والمادة تحمل معرفة مؤكدة. */
  async confirmMaterialOpening(
    input: ConfirmOpeningInput,
  ): Promise<InventoryResult<{ material: Material; movement: InventoryMovement | null }>> {
    const [materials, movements] = await Promise.all([
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
    ]);
    if (!materials.ok || !movements.ok) return storageFailure();
    const material = materials.value.find(candidate => candidate.id === input.materialId);
    if (!material)
      return { ok: false, code: "validation_error", message: "لم نجد المادة التي تريد تأكيد رصيدها." };
    if (!materialIsTracked(material))
      return {
        ok: false,
        code: "validation_error",
        message: "المادة غير متتبَّعة — فعّل المتابعة أولًا قبل تأكيد الرصيد.",
      };
    const position = summarizeMaterialInventory(material.id, movements.value);
    const delta = input.actualQuantityMilli - position.quantityMilli;
    const repeated = movements.value.find(movement => movement.operationKey === input.operationKey);
    if (repeated) return { ok: true, value: { material, movement: repeated }, reused: true };
    if (input.actualQuantityMilli < 0)
      return { ok: false, code: "validation_error", message: "الكمية الفعلية لا يمكن أن تكون سالبة." };
    if (
      input.costKnown &&
      (!Number.isInteger(input.valueMinor) || (input.valueMinor as number) < 0)
    )
      return { ok: false, code: "validation_error", message: "قيمة الرصيد المعروفة يجب أن تكون رقمًا غير سالب." };
    try {
      let movement: InventoryMovement | null = null;
      if (delta !== 0) {
        const costUnknown = !input.costKnown;
        if (delta > 0) {
          movement = createInventoryMovement({
            id: id(position.movementCount === 0 ? "opening-material" : "adjust-material"),
            materialId: material.id,
            type: position.movementCount === 0 ? "opening" : "adjustment",
            occurredOn: input.occurredOn,
            recordedAt: this.now(),
            quantityDeltaMilli: delta,
            valueDeltaMinor: costUnknown ? 0 : (input.valueMinor as number),
            note: input.note,
            reason: position.movementCount === 0 ? null : input.note,
            operationKey: input.operationKey,
            costKnowledge: costUnknown ? "unknown" : "known",
          });
        } else {
          const costUnknownPosition = positionCostKnowledge(movements.value, material.id) === "unknown";
          const value = consumptionValueMinor(
            Math.abs(delta),
            position,
            costUnknownPosition,
          );
          movement = createInventoryMovement({
            id: id("adjust-material"),
            materialId: material.id,
            type: "adjustment",
            occurredOn: input.occurredOn,
            recordedAt: this.now(),
            quantityDeltaMilli: delta,
            valueDeltaMinor: -value || 0,
            note: input.note,
            reason: input.sourceNote?.trim() || input.note,
            operationKey: input.operationKey,
            costKnowledge: value === 0 ? "unknown" : "known",
          });
        }
      }
      const updated: Material = {
        ...material,
        opening: {
          quantityState: "confirmed",
          quantityMilli: input.actualQuantityMilli,
          costState: input.costKnown ? "known" : "unknown",
          valueMinor: input.costKnown ? (input.valueMinor as number) : null,
          confirmedOn: input.occurredOn,
          sourceNote: input.sourceNote?.trim() || null,
        },
      };
      assertInventoryRemainsNonNegative(material.id, movement ? [...movements.value, movement] : movements.value);
      const saved = await this.store.commitInventory(updated, movement ? [movement] : []);
      return saved.ok
        ? { ok: true, value: { material: updated, movement } }
        : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات تأكيد الرصيد غير صالحة.",
      };
    }
  }
  async receivePurchase(input: ReceivePurchaseInput): Promise<InventoryResult<InventoryMovement>> {
    const [materials, movements, purchases] = await Promise.all([
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
      this.store.listSupplierPurchases(),
    ]);
    if (!materials.ok || !movements.ok || !purchases.ok) return storageFailure();
    const repeated = movements.value.find(movement => movement.operationKey === input.operationKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    const material = materials.value.find(candidate => candidate.id === input.materialId);
    if (!material)
      return { ok: false, code: "validation_error", message: "اختر مادة موجودة قبل استلام الشراء." };
    /* المجموعة ٢ (عقد ٢٨): الاستلام حركة تتبع — المادة غير المتتبَّعة لا تستلم. */
    if (!materialIsTracked(material))
      return {
        ok: false,
        code: "validation_error",
        message: "المادة غير متتبَّعة — فعّل متابعتها أولًا ثم استلم الشراء.",
      };
    const purchase = purchases.value.find(candidate => candidate.id === input.purchaseId);
    if (!purchase)
      return { ok: false, code: "validation_error", message: "اختر شراء مواد موجودًا لاستلامه." };
    /* المجموعة ٢ (عقد ٢٨): الشراء المرتبط بمادة تُستلم عليها — الربط عقد، لا اقتراح. */
    if (purchase.materialId && purchase.materialId !== input.materialId)
      return {
        ok: false,
        code: "validation_error",
        message: "هذا الشراء مرتبط بمادة أخرى — استلمه على مادته أو عدّل ربط الشراء.",
      };
    const reversedMovementIds = new Set(
      movements.value
        .filter(movement => movement.type === "reversal" && movement.reversesMovementId)
        .map(movement => movement.reversesMovementId),
    );
    const activeReceipts = movements.value.filter(
      movement =>
        movement.type === "purchase_receipt" &&
        movement.purchaseId === input.purchaseId &&
        !reversedMovementIds.has(movement.id),
    );
    const receivedValue = activeReceipts.reduce(
      (sum, movement) => sum + movement.valueDeltaMinor,
      0,
    );
    if (receivedValue + input.valueMinor > purchase.totalMinor)
      return {
        ok: false,
        code: "validation_error",
        message: "قيمة الاستلام تتجاوز إجمالي شراء المواد المرجعي.",
      };
    /* المجموعة ٢ (عقد ٢٨): حد الكمية المتوقعة — الاستلام الجزئي المتعمد مسموح،
     * والتجاوز فوق المتوقع يُرفض بصدق (وحدة المادة واحدة لأن الربط ملزم أعلاه). */
    if (purchase.expectedQuantityMilli !== null && purchase.expectedQuantityMilli !== undefined) {
      const receivedQuantity = activeReceipts.reduce(
        (sum, movement) => sum + movement.quantityDeltaMilli,
        0,
      );
      if (receivedQuantity + input.quantityMilli > purchase.expectedQuantityMilli)
        return {
          ok: false,
          code: "validation_error",
          message: "الكمية المستلمة تتجاوز الكمية المتوقعة لهذا الشراء.",
        };
    }
    try {
      const movement = createInventoryMovement({
        id: id("receipt"),
        materialId: input.materialId,
        type: "purchase_receipt",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        quantityDeltaMilli: input.quantityMilli,
        valueDeltaMinor: input.valueMinor,
        note: input.note,
        operationKey: input.operationKey,
        purchaseId: input.purchaseId,
        costKnowledge: input.costKnowledge === "unknown" ? "unknown" : "known",
      });
      const saved = await this.store.commitInventory(null, [movement]);
      return saved.ok ? { ok: true, value: movement } : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات استلام الشراء غير صالحة.",
      };
    }
  }
  async consume(input: ConsumeMaterialInput): Promise<InventoryResult<InventoryMovement>> {
    const [materials, movements, order, sales] = await Promise.all([
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
      input.orderId ? this.store.getOrder(input.orderId) : Promise.resolve({ ok: true, value: null } as const),
      /* المجموعة ٣ (عقد D6): تحقق وجود البيع المباشر المرتبط إن ذُكر. */
      input.saleId ? this.store.listDirectSales() : Promise.resolve({ ok: true, value: [] as const } as const),
    ]);
    if (!materials.ok || !movements.ok || !order.ok || !sales.ok) return storageFailure();
    const repeated = movements.value.find(movement => movement.operationKey === input.operationKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    const material = materials.value.find(candidate => candidate.id === input.materialId);
    if (!material)
      return { ok: false, code: "validation_error", message: "اختر مادة موجودة قبل تسجيل الاستهلاك." };
    /* المجموعة ٢ (عقد ٢٨): الاستهلاك حركة تتبع — المادة غير المتتبَّعة لا تُستهلك. */
    if (!materialIsTracked(material))
      return {
        ok: false,
        code: "validation_error",
        message: "المادة غير متتبَّعة — فعّل متابعتها أولًا قبل تسجيل الاستهلاك.",
      };
    if (input.orderId && !order.value)
      return { ok: false, code: "validation_error", message: "اختر طلبًا محليًا موجودًا لاستهلاك المادة." };
    /* المجموعة ٣ (عقد D6): البيع المرتبط إن ذُكر يجب أن يكون مسجلًا ونشطًا —
     * الملغى لا يُستهلك باسمه (المُنتقي يرى النشط فقط؛ الحارس هنا يطابق). */
    if (
      input.saleId &&
      !sales.value.some(sale => sale.id === input.saleId && (sale.status ?? "active") === "active")
    )
      return { ok: false, code: "validation_error", message: "اختر بيعًا مباشرًا نشطًا لاستهلاك المادة." };
    /* المجموعة ٢ (عقد ٢٨): استهلاك بلا طلب يحتاج بيانًا واضحًا (عمل المشروع).
     * المجموعة ٣ (عقد D6): البيع المباشر مرجع صريح يغني عن البيان. */
    if (!input.orderId && !input.saleId && !input.reason?.trim())
      return {
        ok: false,
        code: "validation_error",
        message: "استهلاك بلا طلب أو بيع يحتاج بيانًا واضحًا — مثال: تجربة لون لطلب قادم.",
      };
    try {
      const position = assertInventoryRemainsNonNegative(input.materialId, movements.value);
      const costUnknown = positionCostKnowledge(movements.value, input.materialId) === "unknown";
      const value = consumptionValueMinor(input.quantityMilli, position, costUnknown);
      const movement = createInventoryMovement({
        id: id("consume"),
        materialId: input.materialId,
        type: "consumption",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        quantityDeltaMilli: -input.quantityMilli,
        valueDeltaMinor: -value || 0,
        note: input.note,
        reason: input.reason?.trim() || null,
        operationKey: input.operationKey,
        orderId: input.orderId,
        saleId: input.saleId ?? null,
        costKnowledge: value === 0 ? "unknown" : "known",
      });
      const saved = await this.store.commitInventory(null, [movement]);
      return saved.ok ? { ok: true, value: movement } : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات استهلاك المادة غير صالحة.",
      };
    }
  }
  /* المجموعة ٢ (عقد ٢٨ / D-027): تسجيل نقص صريح — بديل الرصيد السالب الموثّق.
   * طلب الكمية أكبر من المتاح يُوثَّق نقصًا، والمتاح يبقى كما هو حتى يقرر المالك. */
  async recordShortage(input: RecordShortageInput): Promise<InventoryResult<InventoryShortage>> {
    const [materials, movements, shortages] = await Promise.all([
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
      this.store.listInventoryShortages(),
    ]);
    if (!materials.ok || !movements.ok || !shortages.ok) return storageFailure();
    const repeated = shortages.value.find(shortage => shortage.operationKey === input.operationKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    const material = materials.value.find(candidate => candidate.id === input.materialId);
    if (!material)
      return { ok: false, code: "validation_error", message: "اختر مادة موجودة قبل تسجيل النقص." };
    if (!materialIsTracked(material))
      return {
        ok: false,
        code: "validation_error",
        message: "المادة غير متتبَّعة — النقص حالة تتبع؛ فعّل المتابعة أولًا.",
      };
    const position = assertInventoryRemainsNonNegative(input.materialId, movements.value);
    if (input.requestedQuantityMilli <= position.quantityMilli)
      return {
        ok: false,
        code: "validation_error",
        message: "الكمية متوفرة فعلًا — سجّل استهلاكًا عاديًا، لا نقصًا.",
      };
    try {
      const shortage = createInventoryShortage({
        id: id("shortage"),
        materialId: input.materialId,
        requestedQuantityMilli: input.requestedQuantityMilli,
        availableQuantityMilli: position.quantityMilli,
        shortageQuantityMilli: input.requestedQuantityMilli - position.quantityMilli,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        note: input.note,
        orderId: input.orderId,
        operationKey: input.operationKey,
      });
      const saved = await this.store.commitInventoryWithShortage(null, [], shortage);
      return saved.ok ? { ok: true, value: shortage } : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات سجل النقص غير صالحة.",
      };
    }
  }
  /* المجموعة ٢ (عقد ٢٨ / D-027): استهلاك المتاح + توثيق النقص معًا — معاملة ذرّية
   * واحدة (حركة + سجل نقص) فلا حالة بينية أبدًا. */
  async consumeWithShortage(
    input: ConsumeMaterialInput,
  ): Promise<InventoryResult<{ movement: InventoryMovement | null; shortage: InventoryShortage }>> {
    const [materials, movements, shortages] = await Promise.all([
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
      this.store.listInventoryShortages(),
    ]);
    if (!materials.ok || !movements.ok || !shortages.ok) return storageFailure();
    const repeated = shortages.value.find(shortage => shortage.operationKey === `${input.operationKey}:shortage`);
    if (repeated) {
      const movement =
        movements.value.find(candidate => candidate.operationKey === input.operationKey) ?? null;
      return { ok: true, value: { movement, shortage: repeated }, reused: true };
    }
    const material = materials.value.find(candidate => candidate.id === input.materialId);
    if (!material)
      return { ok: false, code: "validation_error", message: "اختر مادة موجودة قبل تسجيل الاستهلاك." };
    if (!materialIsTracked(material))
      return {
        ok: false,
        code: "validation_error",
        message: "المادة غير متتبَّعة — فعّل متابعتها أولًا قبل تسجيل الاستهلاك.",
      };
    const position = assertInventoryRemainsNonNegative(input.materialId, movements.value);
    if (input.quantityMilli <= position.quantityMilli)
      return {
        ok: false,
        code: "validation_error",
        message: "الكمية متوفرة — استخدم الاستهلاك العادي، لا مسار النقص.",
      };
    if (position.quantityMilli <= 0)
      return { ok: false, code: "validation_error", message: "لا متاح من هذه المادة الآن — سجّل النقص وحده." };
    try {
      const costUnknown = positionCostKnowledge(movements.value, input.materialId) === "unknown";
      const value = consumptionValueMinor(position.quantityMilli, position, costUnknown);
      const movement = createInventoryMovement({
        id: id("consume"),
        materialId: input.materialId,
        type: "consumption",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        quantityDeltaMilli: -position.quantityMilli,
        valueDeltaMinor: -value || 0,
        note: input.note,
        reason: input.reason?.trim() || null,
        operationKey: input.operationKey,
        orderId: input.orderId,
        costKnowledge: value === 0 ? "unknown" : "known",
      });
      const shortage = createInventoryShortage({
        id: id("shortage"),
        materialId: input.materialId,
        requestedQuantityMilli: input.quantityMilli,
        availableQuantityMilli: position.quantityMilli,
        shortageQuantityMilli: input.quantityMilli - position.quantityMilli,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        note: input.note,
        orderId: input.orderId,
        operationKey: `${input.operationKey}:shortage`,
      });
      const saved = await this.store.commitInventoryWithShortage(null, [movement], shortage);
      return saved.ok ? { ok: true, value: { movement, shortage } } : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات استهلاك المادة مع النقص غير صالحة.",
      };
    }
  }
  /* المجموعة ٢ (عقد ٢٨ / D-027): حل النقص صريح وموثّق — لا يُغلق تلقائيًا عند
   * وصول استلام؛ المالك يقرر الحل بعد التحقق. */
  async resolveShortage(input: ResolveShortageInput): Promise<InventoryResult<InventoryShortage>> {
    const shortagesResult = await this.store.listInventoryShortages();
    if (!shortagesResult.ok) return storageFailure();
    const shortage = shortagesResult.value.find(candidate => candidate.id === input.shortageId);
    if (!shortage)
      return { ok: false, code: "validation_error", message: "لم نجد سجل النقص الذي تريد حلّه." };
    if (shortage.status === "resolved") return { ok: true, value: shortage, reused: true };
    try {
      const resolved = applyInventoryShortageResolution(shortage, {
        resolvedOn: input.resolvedOn,
        resolutionNote: input.resolutionNote,
      });
      const saved = await this.store.commitInventoryWithShortage(null, [], resolved);
      return saved.ok ? { ok: true, value: resolved } : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات حل النقص غير صالحة.",
      };
    }
  }
  async shortages(): Promise<InventoryResult<readonly InventoryShortage[]>> {
    const result = await this.store.listInventoryShortages();
    return result.ok
      ? { ok: true, value: result.value }
      : { ok: false, code: "storage_error", message: "تعذر قراءة سجلات النقص المحلية." };
  }
  async waste(input: WasteMaterialInput): Promise<InventoryResult<InventoryMovement>> {
    return this.outbound({ ...input, type: "waste" });
  }

  /* القرار ٢٠ (عقد ١١ المعدَّل): فعل صريح «أخرِج المتبقي» يسجّل حركة هدر بكمية المتبقي
   * كاملة وقيمته كاملة — لا حذفًا ولا شطبًا. المخزون يبلغ صفرًا صادقًا والقيمة تظهر
   * حيث تنتمي: الهدر. والفعل عام — يخدم إخراج مادة تلفت كلها لا الفتات وحده. */
  async extractRemainder(input: ExtractRemainderInput): Promise<InventoryResult<InventoryMovement>> {
    const [materials, movements] = await Promise.all([
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
    ]);
    if (!materials.ok || !movements.ok) return storageFailure();
    const repeated = movements.value.find(movement => movement.operationKey === input.operationKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    const material = materials.value.find(candidate => candidate.id === input.materialId);
    if (!material)
      return { ok: false, code: "validation_error", message: "اختر مادة موجودة قبل إخراج الفاقد." };
    /* SA-5 (F2): الإخراج حركة هدر — المادة غير المتتبَّعة لا تُخرج رصيدًا. */
    if (!materialIsTracked(material))
      return {
        ok: false,
        code: "validation_error",
        message: "المادة غير متتبَّعة — فعّل متابعتها أولًا قبل إخراج الفاقد.",
      };
    try {
      const position = assertInventoryRemainsNonNegative(input.materialId, movements.value);
      if (position.quantityMilli <= 0) throw new Error("لا متبقي من هذه المادة لإخراجه.");
      /* المجموعة ٢ (عقد ٢٨): موضع نقي بتكلفة غير معروفة — الإخراج بقيمة صفر موسومة
       * «غير معروفة» لا برفض (كسابقة الاستهلاك). */
      const costUnknown =
        position.valueMinor <= 0 && positionCostKnowledge(movements.value, input.materialId) === "unknown";
      if (position.valueMinor <= 0 && !costUnknown)
        throw new Error("لا متبقي من هذه المادة لإخراجه.");
      const movement = createInventoryMovement({
        id: id("extract-waste"),
        materialId: input.materialId,
        type: "waste",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        quantityDeltaMilli: -position.quantityMilli,
        valueDeltaMinor: -position.valueMinor,
        note: "إخراج الفاقد — كامل المتبقي بقيمته",
        reason: input.reason,
        operationKey: input.operationKey,
        wasteContext: { kind: "general_project" },
        costKnowledge: costUnknown ? "unknown" : "known",
      });
      const saved = await this.store.commitInventory(null, [movement]);
      return saved.ok ? { ok: true, value: movement } : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات إخراج الفاقد غير صالحة.",
      };
    }
  }
  async adjust(input: AdjustMaterialInput): Promise<InventoryResult<InventoryMovement>> {
    const [materials, movements] = await Promise.all([
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
    ]);
    if (!materials.ok || !movements.ok) return storageFailure();
    const repeated = movements.value.find(movement => movement.operationKey === input.operationKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    const material = materials.value.find(candidate => candidate.id === input.materialId);
    if (!material)
      return { ok: false, code: "validation_error", message: "اختر مادة موجودة قبل ضبطها." };
    if (!materialIsTracked(material))
      return {
        ok: false,
        code: "validation_error",
        message: "المادة غير متتبَّعة — فعّل متابعتها أولًا قبل الضبط.",
      };
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
        recordedAt: this.now(),
        quantityDeltaMilli: input.quantityDeltaMilli,
        valueDeltaMinor: value,
        note: input.note,
        reason: input.reason,
        operationKey: input.operationKey,
        costKnowledge,
      });
      assertInventoryRemainsNonNegative(input.materialId, [...movements.value, movement]);
      const saved = await this.store.commitInventory(null, [movement]);
      return saved.ok ? { ok: true, value: movement } : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات ضبط المادة غير صالحة.",
      };
    }
  }
  async reverse(input: ReverseInventoryInput): Promise<InventoryResult<InventoryMovement>> {
    const movementsResult = await this.store.listInventoryMovements();
    if (!movementsResult.ok) return storageFailure();
    const movements = movementsResult.value;
    const repeated = movements.find(movement => movement.operationKey === input.operationKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    const target = movements.find(movement => movement.id === input.movementId);
    if (!target)
      return { ok: false, code: "validation_error", message: "لم نجد حركة المادة التي تريد التراجع عنها." };
    if (target.type === "reversal" || movements.some(movement => movement.reversesMovementId === target.id))
      return {
        ok: false,
        code: "validation_error",
        message: "تم التراجع عن هذه الحركة سابقًا ولا يمكن التراجع عنها مرة ثانية.",
      };
    try {
      const reversal = createInventoryMovement({
        id: id("reverse-material"),
        materialId: target.materialId,
        type: "reversal",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
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
      const saved = await this.store.commitInventory(null, [reversal]);
      return saved.ok ? { ok: true, value: reversal } : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات التراجع عن المادة غير صالحة.",
      };
    }
  }
  private async outbound(
    input: WasteMaterialInput & { type: "waste" },
  ): Promise<InventoryResult<InventoryMovement>> {
    const [materials, movements] = await Promise.all([
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
    ]);
    if (!materials.ok || !movements.ok) return storageFailure();
    const repeated = movements.value.find(movement => movement.operationKey === input.operationKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    const material = materials.value.find(candidate => candidate.id === input.materialId);
    if (!material)
      return { ok: false, code: "validation_error", message: "اختر مادة موجودة قبل تسجيل الهدر." };
    /* المجموعة ٢ (عقد ٢٨): الهدر حركة تتبع — المادة غير المتتبَّعة لا تهدر رصيدًا. */
    if (!materialIsTracked(material))
      return {
        ok: false,
        code: "validation_error",
        message: "المادة غير متتبَّعة — فعّل متابعتها أولًا قبل تسجيل الهدر.",
      };
    const context = input.wasteContext ?? { kind: "general_project" as const };
    if (context.kind === "order") {
      const order = await this.store.getOrder(context.orderId);
      if (!order.ok) return storageFailure();
      if (!order.value)
        return { ok: false, code: "validation_error", message: "الطلب المرتبط بالهدر غير موجود محليًا." };
    }
    if (context.kind === "catalog_item") {
      const item = await this.store.getCatalogItem(context.catalogItemId);
      if (!item.ok) return storageFailure();
      if (!item.value)
        return {
          ok: false,
          code: "validation_error",
          message: "مرجع العمل المرتبط بالهدر غير موجود محليًا.",
        };
    }
    if (context.kind === "catalog_template") {
      const [item, template] = await Promise.all([
        this.store.getCatalogItem(context.catalogItemId),
        this.store.getCatalogTemplate(context.templateId),
      ]);
      if (!item.ok || !template.ok) return storageFailure();
      if (!item.value || !template.value || template.value.catalogItemId !== context.catalogItemId)
        return {
          ok: false,
          code: "validation_error",
          message: "قالب الهدر غير موجود أو لا يتبع مرجع العمل المحدد.",
        };
    }
    try {
      const position = assertInventoryRemainsNonNegative(input.materialId, movements.value);
      const costUnknown = positionCostKnowledge(movements.value, input.materialId) === "unknown";
      const value = consumptionValueMinor(input.quantityMilli, position, costUnknown);
      const movement = createInventoryMovement({
        id: id("waste"),
        materialId: input.materialId,
        type: input.type,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        quantityDeltaMilli: -input.quantityMilli,
        valueDeltaMinor: -value || 0,
        note: input.note,
        reason: input.reason,
        operationKey: input.operationKey,
        wasteContext: input.wasteContext ?? { kind: "general_project" },
        costKnowledge: value === 0 ? "unknown" : "known",
      });
      const saved = await this.store.commitInventory(null, [movement]);
      return saved.ok ? { ok: true, value: movement } : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات هدر المادة غير صالحة.",
      };
    }
  }
  /* المجموعة ٢ (عقد ٢٨ / TR-07): حالة الاستلام لشراء — المستلم والمتبقي قيمةً
   * وكميةً، مع قائمة الإيصالات (المعكوس يُعرض موسومًا ولا يحسب). */
  async purchaseReceiptStatus(purchaseId: string): Promise<InventoryResult<PurchaseReceiptStatus | null>> {
    const [purchases, movements] = await Promise.all([
      this.store.listSupplierPurchases(),
      this.store.listInventoryMovements(),
    ]);
    if (!purchases.ok || !movements.ok) return storageFailure();
    const purchase = purchases.value.find(candidate => candidate.id === purchaseId);
    if (!purchase) return { ok: true, value: null };
    const reversedMovementIds = new Set(
      movements.value
        .filter(movement => movement.type === "reversal" && movement.reversesMovementId)
        .map(movement => movement.reversesMovementId),
    );
    const receipts = movements.value.filter(
      movement => movement.type === "purchase_receipt" && movement.purchaseId === purchaseId,
    );
    const active = receipts.filter(movement => !reversedMovementIds.has(movement.id));
    const receivedValueMinor = active.reduce((sum, movement) => sum + movement.valueDeltaMinor, 0);
    const receivedQuantityMilli =
      purchase.materialId !== null && purchase.materialId !== undefined
        ? active.reduce((sum, movement) => sum + movement.quantityDeltaMilli, 0)
        : null;
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
        })),
      },
    };
  }
  /* المجموعة ٢ (عقد ٢٨): هدر الفترة قراءة مشتقة — حركات الهدر غير المعكوسة داخل
   * النافذة، بأساس occurredOn (أساس قارئ نتيجة الفترة نفسه)، مع وسم تكلفة مجهولة. */
  async readPeriodWaste(from: string, to: string): Promise<InventoryResult<PeriodWasteReading>> {
    const movementsResult = await this.store.listInventoryMovements();
    if (!movementsResult.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة حركات المخزون المحلية." };
    const reversedMovementIds = new Set(
      movementsResult.value
        .filter(movement => movement.type === "reversal" && movement.reversesMovementId)
        .map(movement => movement.reversesMovementId),
    );
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
}
