import {
  assertSameDimension,
  createCatalogItem,
  createCatalogTemplate,
  createDirectConversion,
  createMeasurementUnit,
  type CatalogItem,
  type CatalogItemKind,
  type CatalogTemplate,
  type CatalogTemplateComponent,
  type DirectConversion,
  type MeasurementUnit,
  type UnitDimension,
} from "@micro-domain/catalog/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";

export type CatalogFailure = {
  ok: false;
  code: "validation_error" | "storage_error" | "not_found";
  message: string;
};
export type CatalogResult = { ok: true; item: CatalogItem } | CatalogFailure;
export type CatalogListResult = { ok: true; items: readonly CatalogItem[] } | CatalogFailure;
export type CatalogMarginsResult = { ok: true; items: readonly CatalogRecordedMargin[] } | CatalogFailure;
export type UnitResult = { ok: true; unit: MeasurementUnit } | CatalogFailure;
export type UnitListResult = { ok: true; units: readonly MeasurementUnit[] } | CatalogFailure;
export type ConversionResult = { ok: true; conversion: DirectConversion } | CatalogFailure;
export type ConversionListResult = { ok: true; conversions: readonly DirectConversion[] } | CatalogFailure;
export type TemplateResult = { ok: true; template: CatalogTemplate } | CatalogFailure;
export type TemplateListResult = { ok: true; templates: readonly CatalogTemplate[] } | CatalogFailure;

export type CatalogMaterialVariance = {
  recordedOrderCount: number;
  notRecordedOrderCount: number;
  needsReviewOrderCount: number;
  plannedMaterialMinor: number;
  actualMaterialMinor: number | null;
  varianceMinor: number | null;
};
export type CatalogRecordedMargin = {
  catalogItemId: string;
  finalOrderCount: number;
  deliveredQuantity: number;
  recognizedRevenueMinor: number;
  recognizedDirectCostMinor: number;
  directMarginMinor: number;
  materialVariance: CatalogMaterialVariance;
};
export type CreateCatalogInput = {
  kind: CatalogItemKind;
  name: string;
  unitLabel: string | null;
  unitId?: string | null;
  operationKey: string;
};
export type CreateUnitInput = {
  nameAr: string;
  dimension: UnitDimension;
  symbol?: string | null;
  operationKey: string;
};
export type CreateConversionInput = {
  fromUnitId: string;
  toUnitId: string;
  numerator: number;
  denominator: number;
  note: string;
  operationKey: string;
};
export type CreateTemplateInput = {
  catalogItemId: string;
  title?: string | null;
  note?: string | null;
  components: readonly CatalogTemplateComponent[];
  yield: { quantityMilli: number; unitId: string } | null;
  operationKey: string;
};

const createId = (prefix: string) =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const normalizedName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar-JO");
const failure = (message: string, code: CatalogFailure["code"] = "validation_error"): CatalogFailure => ({
  ok: false,
  code,
  message,
});

function resolveYieldReadiness(
  item: CatalogItem,
  value: { quantityMilli: number; unitId: string } | null,
  units: readonly MeasurementUnit[],
  conversions: readonly DirectConversion[],
): "not_configured" | "ready" | "needs_conversion" {
  if (value === null) return "not_configured";
  if (!item.unitId || item.unitId === value.unitId) return "ready";
  const itemUnit = units.find(unit => unit.id === item.unitId);
  const outputUnit = units.find(unit => unit.id === value.unitId);
  if (!itemUnit || !outputUnit || itemUnit.dimension !== outputUnit.dimension) return "needs_conversion";
  return conversions.some(
    conversion =>
      conversion.active && conversion.fromUnitId === value.unitId && conversion.toUnitId === item.unitId,
  )
    ? "ready"
    : "needs_conversion";
}

export class CatalogService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async list(options: { includeInactive?: boolean } = {}): Promise<CatalogListResult> {
    const result = await this.store.listCatalogItems();
    if (!result.ok) return failure("تعذر قراءة مراجع الأعمال المحلية.", "storage_error");
    return { ok: true, items: result.value.filter(item => options.includeInactive || item.active) };
  }

  async create(input: CreateCatalogInput): Promise<CatalogResult> {
    const existing = await this.store.listCatalogItems();
    if (!existing.ok) return failure("تعذر قراءة مراجع الأعمال المحلية.", "storage_error");
    const retry = existing.value.find(item => item.createdOperationKey === input.operationKey);
    if (retry) return { ok: true, item: retry };
    if (input.unitId) {
      const unit = await this.store.getMeasurementUnit(input.unitId);
      if (!unit.ok) return failure("تعذر قراءة وحدة المرجع.", "storage_error");
      if (!unit.value || !unit.value.active)
        return failure("وحدة المرجع غير متاحة للاختيار الجديد.", "not_found");
    }
    if (
      existing.value.some(
        item =>
          item.active && item.kind === input.kind && normalizedName(item.name) === normalizedName(input.name),
      )
    )
      return failure("يوجد مرجع نشط بالاسم والنوع نفسيهما. عطّله أو اختر اسمًا يميزه.");
    try {
      const item = createCatalogItem({
        id: createId("catalog"),
        kind: input.kind,
        name: input.name,
        unitLabel: input.unitLabel,
        unitId: input.unitId ?? null,
        createdAt: this.now(),
        createdOperationKey: input.operationKey,
      });
      const saved = await this.store.saveCatalogItem(item);
      return saved.ok
        ? { ok: true, item: saved.value }
        : failure("تعذر حفظ مرجع العمل محليًا.", "storage_error");
    } catch (error) {
      return failure(error instanceof Error ? error.message : "مرجع العمل غير صالح.");
    }
  }

  async deactivate(id: string): Promise<CatalogResult> {
    const existing = await this.store.getCatalogItem(id);
    if (!existing.ok) return failure("تعذر قراءة مرجع العمل محليًا.", "storage_error");
    if (!existing.value) return failure("مرجع العمل غير متاح محليًا.", "not_found");
    if (!existing.value.active) return { ok: true, item: existing.value };
    const saved = await this.store.saveCatalogItem({
      ...existing.value,
      active: false,
      updatedAt: this.now(),
    });
    return saved.ok
      ? { ok: true, item: saved.value }
      : failure("تعذر تعطيل مرجع العمل محليًا.", "storage_error");
  }

  async listUnits(options: { includeInactive?: boolean } = {}): Promise<UnitListResult> {
    const result = await this.store.listMeasurementUnits();
    if (!result.ok) return failure("تعذر قراءة وحدات القياس المحلية.", "storage_error");
    return { ok: true, units: result.value.filter(unit => options.includeInactive || unit.active) };
  }

  async createUnit(input: CreateUnitInput): Promise<UnitResult> {
    const existing = await this.store.listMeasurementUnits();
    if (!existing.ok) return failure("تعذر قراءة وحدات القياس المحلية.", "storage_error");
    const retry = existing.value.find(unit => unit.createdOperationKey === input.operationKey);
    if (retry) return { ok: true, unit: retry };
    if (
      existing.value.some(
        unit =>
          unit.active &&
          unit.dimension === input.dimension &&
          normalizedName(unit.nameAr) === normalizedName(input.nameAr),
      )
    )
      return failure("يوجد اسم وحدة نشط في هذا البعد. اختر اسمًا أوضح.");
    try {
      const unit = createMeasurementUnit({
        id: createId("unit"),
        nameAr: input.nameAr,
        dimension: input.dimension,
        symbol: input.symbol ?? null,
        createdAt: this.now(),
        createdOperationKey: input.operationKey,
      });
      const saved = await this.store.saveMeasurementUnit(unit);
      return saved.ok
        ? { ok: true, unit: saved.value }
        : failure("تعذر حفظ وحدة القياس محليًا.", "storage_error");
    } catch (error) {
      return failure(error instanceof Error ? error.message : "وحدة القياس غير صالحة.");
    }
  }

  async deactivateUnit(id: string): Promise<UnitResult> {
    const existing = await this.store.getMeasurementUnit(id);
    if (!existing.ok) return failure("تعذر قراءة وحدة القياس محليًا.", "storage_error");
    if (!existing.value) return failure("وحدة القياس غير متاحة محليًا.", "not_found");
    if (!existing.value.active) return { ok: true, unit: existing.value };
    const saved = await this.store.saveMeasurementUnit({
      ...existing.value,
      active: false,
      updatedAt: this.now(),
    });
    return saved.ok
      ? { ok: true, unit: saved.value }
      : failure("تعذر إيقاف وحدة القياس محليًا.", "storage_error");
  }

  async listConversions(options: { includeInactive?: boolean } = {}): Promise<ConversionListResult> {
    const result = await this.store.listDirectConversions();
    if (!result.ok) return failure("تعذر قراءة التحويلات المحلية.", "storage_error");
    return {
      ok: true,
      conversions: result.value.filter(conversion => options.includeInactive || conversion.active),
    };
  }

  async createConversion(input: CreateConversionInput): Promise<ConversionResult> {
    const [unitResult, conversionResult] = await Promise.all([
      this.store.listMeasurementUnits(),
      this.store.listDirectConversions(),
    ]);
    if (!unitResult.ok || !conversionResult.ok)
      return failure("تعذر قراءة الوحدات والتحويلات المحلية.", "storage_error");
    const retry = conversionResult.value.find(
      conversion => conversion.createdOperationKey === input.operationKey,
    );
    if (retry) return { ok: true, conversion: retry };
    const from = unitResult.value.find(unit => unit.id === input.fromUnitId);
    const to = unitResult.value.find(unit => unit.id === input.toUnitId);
    if (!from || !to) return failure("اختر وحدتي المصدر والوجهة من الوحدات المسجلة.", "not_found");
    if (!from.active || !to.active) return failure("لا يمكن إنشاء تحويل جديد باستخدام وحدة موقوفة.");
    try {
      assertSameDimension(from, to);
      if (
        conversionResult.value.some(
          conversion =>
            conversion.active && conversion.fromUnitId === from.id && conversion.toUnitId === to.id,
        )
      )
        return failure("يوجد تحويل نشط لهذا الزوج. عطّل القديم وأنشئ نسخة موثقة عند الحاجة.");
      const conversion = createDirectConversion({
        id: createId("conversion"),
        fromUnitId: from.id,
        toUnitId: to.id,
        dimension: from.dimension,
        numerator: input.numerator,
        denominator: input.denominator,
        note: input.note,
        createdAt: this.now(),
        createdOperationKey: input.operationKey,
      });
      const saved = await this.store.saveDirectConversion(conversion);
      return saved.ok
        ? { ok: true, conversion: saved.value }
        : failure("تعذر حفظ التحويل محليًا.", "storage_error");
    } catch (error) {
      return failure(error instanceof Error ? error.message : "التحويل غير صالح.");
    }
  }

  async deactivateConversion(id: string): Promise<ConversionResult> {
    const existing = await this.store.getDirectConversion(id);
    if (!existing.ok) return failure("تعذر قراءة التحويل محليًا.", "storage_error");
    if (!existing.value) return failure("التحويل غير متاح محليًا.", "not_found");
    if (!existing.value.active) return { ok: true, conversion: existing.value };
    const saved = await this.store.saveDirectConversion({
      ...existing.value,
      active: false,
      updatedAt: this.now(),
    });
    return saved.ok
      ? { ok: true, conversion: saved.value }
      : failure("تعذر إيقاف التحويل محليًا.", "storage_error");
  }

  async listTemplates(
    catalogItemId?: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<TemplateListResult> {
    const result = await this.store.listCatalogTemplates(catalogItemId);
    if (!result.ok) return failure("تعذر قراءة قوالب العمل المحلية.", "storage_error");
    return {
      ok: true,
      templates: result.value.filter(template => options.includeInactive || template.active),
    };
  }

  private async buildTemplate(
    input: CreateTemplateInput,
    revision: number,
    sourceTemplateId: string | null,
  ): Promise<TemplateResult> {
    const [itemResult, unitsResult, conversionsResult] = await Promise.all([
      this.store.getCatalogItem(input.catalogItemId),
      this.store.listMeasurementUnits(),
      this.store.listDirectConversions(),
    ]);
    if (!itemResult.ok || !unitsResult.ok || !conversionsResult.ok)
      return failure("تعذر قراءة مرجع العمل والوحدات والتحويلات.", "storage_error");
    const item = itemResult.value;
    if (!item) return failure("مرجع القالب غير متاح محليًا.", "not_found");
    const activeUnits = unitsResult.value.filter(unit => unit.active);
    if (input.components.some(component => !activeUnits.some(unit => unit.id === component.unitId)))
      return failure("كل مكوّن يحتاج وحدة نشطة مسجلة.");
    const yieldInput = input.yield;
    if (yieldInput && !activeUnits.some(unit => unit.id === yieldInput.unitId))
      return failure("وحدة الناتج غير متاحة للاختيار الجديد.");
    const itemUnit = item.unitId ? unitsResult.value.find(unit => unit.id === item.unitId) : null;
    const outputUnit = yieldInput ? unitsResult.value.find(unit => unit.id === yieldInput.unitId) : null;
    if (itemUnit && outputUnit && itemUnit.dimension !== outputUnit.dimension)
      return failure("وحدة الناتج من بُعد مختلف؛ اختر وحدة من البعد نفسه أو اترك الناتج غير مهيأ.");
    const yieldReadiness = resolveYieldReadiness(
      item,
      yieldInput,
      unitsResult.value,
      conversionsResult.value,
    );
    try {
      const template = createCatalogTemplate({
        id: createId("template"),
        catalogItemId: item.id,
        title: input.title ?? null,
        note: input.note ?? null,
        components: input.components,
        yield: yieldInput,
        yieldReadiness,
        revision,
        sourceTemplateId,
        createdAt: this.now(),
        createdOperationKey: input.operationKey,
      });
      return { ok: true, template };
    } catch (error) {
      return failure(error instanceof Error ? error.message : "قالب العمل غير صالح.");
    }
  }

  async createTemplate(input: CreateTemplateInput): Promise<TemplateResult> {
    const existing = await this.store.listCatalogTemplates(input.catalogItemId);
    if (!existing.ok) return failure("تعذر قراءة قوالب العمل المحلية.", "storage_error");
    const retry = existing.value.find(template => template.createdOperationKey === input.operationKey);
    if (retry) return { ok: true, template: retry };
    if (existing.value.some(template => template.active))
      return failure("يوجد قالب فعال لهذا المرجع. استخدم مراجعة جديدة بدل إنشاء قالب ثانٍ.");
    const built = await this.buildTemplate(input, 1, null);
    if (!built.ok) return built;
    const saved = await this.store.saveCatalogTemplate(built.template);
    return saved.ok
      ? { ok: true, template: saved.value }
      : failure("تعذر حفظ قالب العمل محليًا.", "storage_error");
  }

  async reviseTemplate(
    previousId: string,
    input: Omit<CreateTemplateInput, "catalogItemId">,
  ): Promise<TemplateResult> {
    const previousResult = await this.store.getCatalogTemplate(previousId);
    if (!previousResult.ok) return failure("تعذر قراءة القالب السابق.", "storage_error");
    if (!previousResult.value) return failure("القالب السابق غير متاح محليًا.", "not_found");
    const existing = await this.store.listCatalogTemplates(previousResult.value.catalogItemId);
    if (!existing.ok) return failure("تعذر قراءة مراجعات القالب.", "storage_error");
    const retry = existing.value.find(template => template.createdOperationKey === input.operationKey);
    if (retry) return { ok: true, template: retry };
    if (!previousResult.value.active) return failure("لا يمكن مراجعة قالب موقوف.");
    const built = await this.buildTemplate(
      { ...input, catalogItemId: previousResult.value.catalogItemId },
      previousResult.value.revision + 1,
      previousResult.value.id,
    );
    if (!built.ok) return built;
    const result = await this.store.commitCatalogTemplateRevision(
      { ...previousResult.value, active: false, updatedAt: this.now() },
      built.template,
    );
    return result.ok ? { ok: true, template: result.value.next } : failure(result.message, "storage_error");
  }

  async deactivateTemplate(id: string): Promise<TemplateResult> {
    const existing = await this.store.getCatalogTemplate(id);
    if (!existing.ok) return failure("تعذر قراءة القالب محليًا.", "storage_error");
    if (!existing.value) return failure("القالب غير متاح محليًا.", "not_found");
    if (!existing.value.active) return { ok: true, template: existing.value };
    const saved = await this.store.saveCatalogTemplate({
      ...existing.value,
      active: false,
      updatedAt: this.now(),
    });
    return saved.ok
      ? { ok: true, template: saved.value }
      : failure("تعذر إيقاف القالب محليًا.", "storage_error");
  }

  async readRecordedMargins(): Promise<CatalogMarginsResult> {
    const [catalog, orders, movements] = await Promise.all([
      this.store.listCatalogItems(),
      this.store.listOrders(),
      this.store.listInventoryMovements(),
    ]);
    if (!catalog.ok || !orders.ok || !movements.ok)
      return failure("تعذر قراءة الأعمال المرتبطة لحساب الهامش المسجل.", "storage_error");
    const catalogIds = new Set(catalog.value.map(item => item.id));
    const reversedMovementIds = new Set(
      movements.value
        .filter(movement => movement.type === "reversal" && movement.reversesMovementId)
        .map(movement => movement.reversesMovementId),
    );
    const grouped = new Map<string, CatalogRecordedMargin>();
    for (const stored of orders.value) {
      if (
        !stored.catalogItemId ||
        !catalogIds.has(stored.catalogItemId) ||
        stored.order.resultStatus !== "final"
      )
        continue;
      const current = grouped.get(stored.catalogItemId) ?? {
        catalogItemId: stored.catalogItemId,
        finalOrderCount: 0,
        deliveredQuantity: 0,
        recognizedRevenueMinor: 0,
        recognizedDirectCostMinor: 0,
        directMarginMinor: 0,
        materialVariance: {
          recordedOrderCount: 0,
          notRecordedOrderCount: 0,
          needsReviewOrderCount: 0,
          plannedMaterialMinor: 0,
          actualMaterialMinor: null,
          varianceMinor: null,
        },
      };
      const revenue = stored.order.recognizedRevenueMinor;
      const directCost = stored.order.recognizedCostMinor;
      const consumptions = movements.value.filter(
        movement =>
          movement.type === "consumption" &&
          movement.orderId === stored.id &&
          !reversedMovementIds.has(movement.id),
      );
      const materialVariance =
        consumptions.length === 0
          ? {
              ...current.materialVariance,
              notRecordedOrderCount: current.materialVariance.notRecordedOrderCount + 1,
            }
          : (() => {
              const actualMaterialMinor = consumptions.reduce(
                (sum, movement) => sum + Math.abs(movement.valueDeltaMinor),
                0,
              );
              const plannedMaterialMinor = stored.order.costSnapshot.materialCostMinor;
              const nextActual = (current.materialVariance.actualMaterialMinor ?? 0) + actualMaterialMinor;
              const nextPlanned = current.materialVariance.plannedMaterialMinor + plannedMaterialMinor;
              return {
                recordedOrderCount: current.materialVariance.recordedOrderCount + 1,
                notRecordedOrderCount: current.materialVariance.notRecordedOrderCount,
                needsReviewOrderCount:
                  current.materialVariance.needsReviewOrderCount +
                  (stored.order.costSnapshot.knowledgeState === "known" ? 0 : 1),
                plannedMaterialMinor: nextPlanned,
                actualMaterialMinor: nextActual,
                varianceMinor: nextActual - nextPlanned,
              };
            })();
      grouped.set(stored.catalogItemId, {
        ...current,
        finalOrderCount: current.finalOrderCount + 1,
        deliveredQuantity: current.deliveredQuantity + stored.order.quantity,
        recognizedRevenueMinor: current.recognizedRevenueMinor + revenue,
        recognizedDirectCostMinor: current.recognizedDirectCostMinor + directCost,
        directMarginMinor: current.directMarginMinor + revenue - directCost,
        materialVariance,
      });
    }
    return {
      ok: true,
      items: Array.from(grouped.values()).sort(
        (left, right) =>
          right.directMarginMinor - left.directMarginMinor ||
          left.catalogItemId.localeCompare(right.catalogItemId),
      ),
    };
  }
}
