import {
  assertInventoryRemainsNonNegative,
  consumptionValueMinor,
  createInventoryMovement,
  createMaterial,
  summarizeMaterialInventory,
  type InventoryMovement,
  type Material,
  type MaterialUnit,
  type WasteContext,
} from "@micro-domain/inventory-material/index.js";
import type { CatalogItem, CatalogTemplate } from "@micro-domain/catalog/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";

export type InventoryResult<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };
export type InventoryMaterialOverview = Material & {
  quantityMilli: number;
  valueMinor: number;
  movementCount: number;
};
export type InventoryOverview = {
  materials: readonly InventoryMaterialOverview[];
  movementCount: number;
  truth: string;
};
export type OrderActualMaterialComparison = {
  orderId: string;
  status: "not_recorded" | "recorded" | "needs_review";
  plannedMaterialMinor: number;
  actualMaterialMinor: number | null;
  actualQuantityMilli: number | null;
  varianceMinor: number | null;
  consumptionCount: number;
  truth: string;
};
export type InventoryReferences = {
  materials: readonly Material[];
  purchases: readonly { id: string; supplierName: string; note: string; totalMinor: number }[];
  orders: readonly { id: string; itemName: string; customerName: string }[];
  catalogItems: readonly CatalogItem[];
  catalogTemplates: readonly CatalogTemplate[];
};
export type OpenMaterialInput = {
  name: string;
  unit: MaterialUnit;
  openingQuantityMilli: number;
  openingValueMinor: number;
  occurredOn: string;
  note: string;
  operationKey: string;
};
export type ReceivePurchaseInput = {
  materialId: string;
  purchaseId: string;
  quantityMilli: number;
  valueMinor: number;
  occurredOn: string;
  note: string;
  operationKey: string;
};
export type ConsumeMaterialInput = {
  materialId: string;
  orderId: string;
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
export type AdjustMaterialInput = {
  materialId: string;
  quantityDeltaMilli: number;
  valueMinorWhenIncrease: number | null;
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

const id = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const storageFailure = <T>(): InventoryResult<T> => ({
  ok: false,
  code: "storage_error",
  message: "تعذر حفظ حركة المادة محليًا. لم يتم تأكيد نجاح العملية.",
});

export class InventoryMaterialService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}
  async overview(): Promise<InventoryResult<InventoryOverview>> {
    const [materials, movements] = await Promise.all([
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
    ]);
    if (!materials.ok || !movements.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة المواد المحلية." };
    return {
      ok: true,
      value: {
        materials: materials.value.map(material => ({
          ...material,
          ...summarizeMaterialInventory(material.id, movements.value),
        })),
        movementCount: movements.value.length,
        truth:
          "قيمة المادة المتاحة ليست مصروفًا أو تكلفة بيع. ينتقل الجزء المستهلك أو المهدر فقط إلى أثر واضح، ولا يغير هذا الإصدار Snapshot أو نتيجة فترة سابقة.",
      },
    };
  }
  async movements(): Promise<InventoryResult<readonly InventoryMovement[]>> {
    const result = await this.store.listInventoryMovements();
    return result.ok
      ? { ok: true, value: result.value }
      : { ok: false, code: "storage_error", message: "تعذر قراءة حركات المواد المحلية." };
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
          truth:
            "لم تسجل مادة منفذة لهذا الطلب بعد. عدم وجود سجل لا يعني أن المادة الفعلية صفر أو أن الطلب لا يحتاج مادة.",
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
    const status = order.costSnapshot.knowledgeState === "known" ? "recorded" : "needs_review";
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
        truth:
          status === "recorded"
            ? "هذه مقارنة بين مادة مخططة في Snapshot ومادة منفذة مسجلة من المخزون. لا تغير السعر أو النتيجة أو الكاش، وليست تكلفة فعلية كاملة للطلب."
            : "سجلت مادة منفذة، لكن Snapshot التخطيط يحتاج مراجعة. لا تعتبر الفرق نتيجة نهائية قبل استكمال البنود المؤثرة.",
      },
    };
  }
  async references(): Promise<InventoryResult<InventoryReferences>> {
    const [materials, purchases, orders, catalogItems, catalogTemplates] = await Promise.all([
      this.store.listMaterials(),
      this.store.listSupplierPurchases(),
      this.store.listOrders(),
      this.store.listCatalogItems(),
      this.store.listCatalogTemplates(),
    ]);
    if (!materials.ok || !purchases.ok || !orders.ok || !catalogItems.ok || !catalogTemplates.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة مراجع المادة أو الشراء أو الطلب." };
    return {
      ok: true,
      value: {
        materials: materials.value,
        purchases: purchases.value.map(purchase => ({
          id: purchase.id,
          supplierName: purchase.supplierName,
          note: purchase.note,
          totalMinor: purchase.totalMinor,
        })),
        orders: orders.value.map(stored => ({
          id: stored.id,
          itemName: stored.order.itemName,
          customerName: stored.order.customerName,
        })),
        catalogItems: catalogItems.value,
        catalogTemplates: catalogTemplates.value,
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
      const noOpening = input.openingQuantityMilli === 0 && input.openingValueMinor === 0;
      if (!noOpening && (input.openingQuantityMilli <= 0 || input.openingValueMinor <= 0))
        throw new Error("رصيد المادة الافتتاحي يحتاج كمية وقيمة موجبتين، أو اتركهما صفرًا معًا.");
      const material = createMaterial({
        id: id("material"),
        name: input.name,
        unit: input.unit,
        createdAt: this.now(),
        createdOperationKey: input.operationKey,
      });
      const opening = noOpening
        ? null
        : createInventoryMovement({
            id: id("opening-material"),
            materialId: material.id,
            type: "opening",
            occurredOn: input.occurredOn,
            recordedAt: this.now(),
            quantityDeltaMilli: input.openingQuantityMilli,
            valueDeltaMinor: input.openingValueMinor,
            note: input.note,
            operationKey: input.operationKey,
          });
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
  async receivePurchase(input: ReceivePurchaseInput): Promise<InventoryResult<InventoryMovement>> {
    const [materials, movements, purchases] = await Promise.all([
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
      this.store.listSupplierPurchases(),
    ]);
    if (!materials.ok || !movements.ok || !purchases.ok) return storageFailure();
    const repeated = movements.value.find(movement => movement.operationKey === input.operationKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    if (!materials.value.some(material => material.id === input.materialId))
      return { ok: false, code: "validation_error", message: "اختر مادة موجودة قبل استلام الشراء." };
    const purchase = purchases.value.find(candidate => candidate.id === input.purchaseId);
    if (!purchase)
      return { ok: false, code: "validation_error", message: "اختر شراء مواد موجودًا لاستلامه." };
    const reversedMovementIds = new Set(
      movements.value
        .filter(movement => movement.type === "reversal" && movement.reversesMovementId)
        .map(movement => movement.reversesMovementId),
    );
    const receivedValue = movements.value
      .filter(
        movement =>
          movement.type === "purchase_receipt" &&
          movement.purchaseId === input.purchaseId &&
          !reversedMovementIds.has(movement.id),
      )
      .reduce((sum, movement) => sum + movement.valueDeltaMinor, 0);
    if (receivedValue + input.valueMinor > purchase.totalMinor)
      return {
        ok: false,
        code: "validation_error",
        message: "قيمة الاستلام تتجاوز إجمالي شراء المواد المرجعي.",
      };
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
    const [materials, movements, order] = await Promise.all([
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
      this.store.getOrder(input.orderId),
    ]);
    if (!materials.ok || !movements.ok || !order.ok) return storageFailure();
    const repeated = movements.value.find(movement => movement.operationKey === input.operationKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    if (!materials.value.some(material => material.id === input.materialId))
      return { ok: false, code: "validation_error", message: "اختر مادة موجودة قبل تسجيل الاستهلاك." };
    if (!order.value)
      return { ok: false, code: "validation_error", message: "اختر طلبًا محليًا موجودًا لاستهلاك المادة." };
    try {
      const position = assertInventoryRemainsNonNegative(input.materialId, movements.value);
      const value = consumptionValueMinor(input.quantityMilli, position);
      const movement = createInventoryMovement({
        id: id("consume"),
        materialId: input.materialId,
        type: "consumption",
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        quantityDeltaMilli: -input.quantityMilli,
        valueDeltaMinor: -value,
        note: input.note,
        operationKey: input.operationKey,
        orderId: input.orderId,
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
  async waste(input: WasteMaterialInput): Promise<InventoryResult<InventoryMovement>> {
    return this.outbound({ ...input, type: "waste" });
  }
  async adjust(input: AdjustMaterialInput): Promise<InventoryResult<InventoryMovement>> {
    const [materials, movements] = await Promise.all([
      this.store.listMaterials(),
      this.store.listInventoryMovements(),
    ]);
    if (!materials.ok || !movements.ok) return storageFailure();
    const repeated = movements.value.find(movement => movement.operationKey === input.operationKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    if (!materials.value.some(material => material.id === input.materialId))
      return { ok: false, code: "validation_error", message: "اختر مادة موجودة قبل ضبطها." };
    try {
      const position = assertInventoryRemainsNonNegative(input.materialId, movements.value);
      let value: number;
      if (input.quantityDeltaMilli > 0) {
        if (
          !Number.isInteger(input.valueMinorWhenIncrease) ||
          input.valueMinorWhenIncrease === null ||
          input.valueMinorWhenIncrease <= 0
        )
          throw new Error("ضبط الزيادة يحتاج قيمة موجبة معلنة.");
        value = input.valueMinorWhenIncrease;
      } else {
        value = -consumptionValueMinor(Math.abs(input.quantityDeltaMilli), position);
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
      return { ok: false, code: "validation_error", message: "لم نجد حركة المادة التي تريد عكسها." };
    if (target.type === "reversal" || movements.some(movement => movement.reversesMovementId === target.id))
      return {
        ok: false,
        code: "validation_error",
        message: "تم عكس هذه الحركة سابقًا ولا يمكن عكسها مرة ثانية.",
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
        note: `عكس: ${target.note}`,
        reason: input.reason,
        operationKey: input.operationKey,
        reversesMovementId: target.id,
      });
      assertInventoryRemainsNonNegative(target.materialId, [...movements, reversal]);
      const saved = await this.store.commitInventory(null, [reversal]);
      return saved.ok ? { ok: true, value: reversal } : storageFailure();
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات عكس المادة غير صالحة.",
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
    if (!materials.value.some(material => material.id === input.materialId))
      return { ok: false, code: "validation_error", message: "اختر مادة موجودة قبل تسجيل الهدر." };
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
      const value = consumptionValueMinor(input.quantityMilli, position);
      const movement = createInventoryMovement({
        id: id("waste"),
        materialId: input.materialId,
        type: input.type,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        quantityDeltaMilli: -input.quantityMilli,
        valueDeltaMinor: -value,
        note: input.note,
        reason: input.reason,
        operationKey: input.operationKey,
        wasteContext: input.wasteContext ?? { kind: "general_project" },
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
}
