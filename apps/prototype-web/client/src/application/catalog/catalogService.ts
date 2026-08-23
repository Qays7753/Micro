import { createCatalogItem, type CatalogItem, type CatalogItemKind } from "@micro-domain/catalog/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";

export type CatalogResult = { ok: true; item: CatalogItem } | { ok: false; code: "validation_error" | "storage_error" | "not_found"; message: string };
export type CatalogListResult = { ok: true; items: readonly CatalogItem[] } | Extract<CatalogResult, { ok: false }>;
export type CatalogMaterialVariance = { recordedOrderCount: number; notRecordedOrderCount: number; needsReviewOrderCount: number; plannedMaterialMinor: number; actualMaterialMinor: number | null; varianceMinor: number | null };
export type CatalogRecordedMargin = { catalogItemId: string; finalOrderCount: number; deliveredQuantity: number; recognizedRevenueMinor: number; recognizedDirectCostMinor: number; directMarginMinor: number; materialVariance: CatalogMaterialVariance };
export type CatalogMarginsResult = { ok: true; items: readonly CatalogRecordedMargin[] } | Extract<CatalogResult, { ok: false }>;
export type CreateCatalogInput = { kind: CatalogItemKind; name: string; unitLabel: string | null; operationKey: string };

const createId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `catalog-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const normalizedName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar-JO");

export class CatalogService {
  constructor(private readonly store: PrototypeLocalStore, private readonly now: () => string = () => new Date().toISOString()) {}

  async list(options: { includeInactive?: boolean } = {}): Promise<CatalogListResult> {
    const result = await this.store.listCatalogItems();
    if (!result.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة مراجع الأعمال المحلية." };
    return { ok: true, items: result.value.filter(item => options.includeInactive || item.active) };
  }

  async create(input: CreateCatalogInput): Promise<CatalogResult> {
    const existing = await this.store.listCatalogItems();
    if (!existing.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة مراجع الأعمال المحلية." };
    const retry = existing.value.find(item => item.createdOperationKey === input.operationKey);
    if (retry) return { ok: true, item: retry };
    if (existing.value.some(item => item.active && item.kind === input.kind && normalizedName(item.name) === normalizedName(input.name))) return { ok: false, code: "validation_error", message: "يوجد مرجع نشط بالاسم والنوع نفسيهما. عطّله أو اختر اسمًا يميزه." };
    try {
      const item = createCatalogItem({ id: createId(), kind: input.kind, name: input.name, unitLabel: input.unitLabel, createdAt: this.now(), createdOperationKey: input.operationKey });
      const saved = await this.store.saveCatalogItem(item);
      return saved.ok ? { ok: true, item: saved.value } : { ok: false, code: "storage_error", message: "تعذر حفظ مرجع العمل محليًا." };
    } catch (error) {
      return { ok: false, code: "validation_error", message: error instanceof Error ? error.message : "مرجع العمل غير صالح." };
    }
  }

  async deactivate(id: string): Promise<CatalogResult> {
    const existing = await this.store.getCatalogItem(id);
    if (!existing.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة مرجع العمل محليًا." };
    if (!existing.value) return { ok: false, code: "not_found", message: "مرجع العمل غير متاح محليًا." };
    if (!existing.value.active) return { ok: true, item: existing.value };
    const item = { ...existing.value, active: false, updatedAt: this.now() };
    const saved = await this.store.saveCatalogItem(item);
    return saved.ok ? { ok: true, item: saved.value } : { ok: false, code: "storage_error", message: "تعذر تعطيل مرجع العمل محليًا." };
  }

  async readRecordedMargins(): Promise<CatalogMarginsResult> {
    const [catalog, orders, movements] = await Promise.all([this.store.listCatalogItems(), this.store.listOrders(), this.store.listInventoryMovements()]);
    if (!catalog.ok || !orders.ok || !movements.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة الأعمال المرتبطة لحساب الهامش المسجل." };
    const catalogIds = new Set(catalog.value.map(item => item.id));
    const reversedMovementIds = new Set(movements.value.filter(movement => movement.type === "reversal" && movement.reversesMovementId).map(movement => movement.reversesMovementId));
    const grouped = new Map<string, CatalogRecordedMargin>();
    for (const stored of orders.value) {
      if (!stored.catalogItemId || !catalogIds.has(stored.catalogItemId) || stored.order.resultStatus !== "final") continue;
      const current = grouped.get(stored.catalogItemId) ?? { catalogItemId: stored.catalogItemId, finalOrderCount: 0, deliveredQuantity: 0, recognizedRevenueMinor: 0, recognizedDirectCostMinor: 0, directMarginMinor: 0, materialVariance: { recordedOrderCount: 0, notRecordedOrderCount: 0, needsReviewOrderCount: 0, plannedMaterialMinor: 0, actualMaterialMinor: null, varianceMinor: null } };
      const revenue = stored.order.recognizedRevenueMinor;
      const directCost = stored.order.recognizedCostMinor;
      const consumptions = movements.value.filter(movement => movement.type === "consumption" && movement.orderId === stored.id && !reversedMovementIds.has(movement.id));
      const materialVariance = consumptions.length === 0
        ? { ...current.materialVariance, notRecordedOrderCount: current.materialVariance.notRecordedOrderCount + 1 }
        : (() => { const actualMaterialMinor = consumptions.reduce((sum, movement) => sum + Math.abs(movement.valueDeltaMinor), 0); const plannedMaterialMinor = stored.order.costSnapshot.materialCostMinor; const nextActual = (current.materialVariance.actualMaterialMinor ?? 0) + actualMaterialMinor; const nextPlanned = current.materialVariance.plannedMaterialMinor + plannedMaterialMinor; return { recordedOrderCount: current.materialVariance.recordedOrderCount + 1, notRecordedOrderCount: current.materialVariance.notRecordedOrderCount, needsReviewOrderCount: current.materialVariance.needsReviewOrderCount + (stored.order.costSnapshot.knowledgeState === "known" ? 0 : 1), plannedMaterialMinor: nextPlanned, actualMaterialMinor: nextActual, varianceMinor: nextActual - nextPlanned }; })();
      grouped.set(stored.catalogItemId, { ...current, finalOrderCount: current.finalOrderCount + 1, deliveredQuantity: current.deliveredQuantity + stored.order.quantity, recognizedRevenueMinor: current.recognizedRevenueMinor + revenue, recognizedDirectCostMinor: current.recognizedDirectCostMinor + directCost, directMarginMinor: current.directMarginMinor + revenue - directCost, materialVariance });
    }
    return { ok: true, items: Array.from(grouped.values()).sort((left, right) => right.directMarginMinor - left.directMarginMinor || left.catalogItemId.localeCompare(right.catalogItemId)) };
  }
}
