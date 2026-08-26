import { describe, expect, it } from "vitest";
import { convertQuantityMilli, createCatalogTemplate, createDirectConversion, createMeasurementUnit } from "@micro-domain/catalog/index.js";
import { CatalogService } from "./catalogService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const at = "2026-08-26T10:00:00.000Z";

function unit(id: string, nameAr: string, dimension: "count" | "mass" | "volume" | "time" | "distance" | "area") {
  return createMeasurementUnit({ id, nameAr, dimension, symbol: null, createdAt: at, createdOperationKey: `unit:${id}` });
}

describe("catalog core domain", () => {
  it("supports the six shared dimensions and exact direct conversion without floating point truth", () => {
    expect([unit("count", "قطعة", "count"), unit("mass", "كيلوغرام", "mass"), unit("volume", "لتر", "volume"), unit("time", "ساعة", "time"), unit("distance", "متر", "distance"), unit("area", "متر مربع", "area")]).toHaveLength(6);
    const conversion = createDirectConversion({ id: "kg-g", fromUnitId: "kg", toUnitId: "g", dimension: "mass", numerator: 1000, denominator: 1, note: "1 كيلوغرام = 1000 غرام", createdAt: at, createdOperationKey: "conversion:kg-g" });
    expect(convertQuantityMilli(1000, conversion)).toEqual({ quantityMilli: 1_000_000, exact: true });
    expect(() => convertQuantityMilli(1, createDirectConversion({ ...conversion, id: "not-exact", numerator: 2, denominator: 3, createdOperationKey: "conversion:not-exact" }))).toThrow("لا يمكن تمثيل");
  });

  it("rejects invalid quantities and never allows a zero or negative conversion factor", () => {
    expect(() => createMeasurementUnit({ id: "bad", nameAr: " ", dimension: "mass", symbol: null, createdAt: at, createdOperationKey: "unit:bad" })).toThrow("اسم الوحدة مطلوب");
    expect(() => createDirectConversion({ id: "bad", fromUnitId: "kg", toUnitId: "g", dimension: "mass", numerator: 0, denominator: 1, note: "غير صالح", createdAt: at, createdOperationKey: "conversion:bad" })).toThrow("بسط عامل التحويل");
    expect(() => createDirectConversion({ id: "bad-dimension", fromUnitId: "kg", toUnitId: "g", dimension: "unsupported" as "mass", numerator: 1, denominator: 1, note: "غير صالح", createdAt: at, createdOperationKey: "conversion:bad-dimension" })).toThrow("بُعد التحويل غير مدعوم");
    expect(() => convertQuantityMilli(0, createDirectConversion({ id: "good", fromUnitId: "kg", toUnitId: "g", dimension: "mass", numerator: 1, denominator: 1, note: "صريح", createdAt: at, createdOperationKey: "conversion:good" }))).toThrow("الكمية");
  });

  it("keeps a template optional and records an explicit not-ready yield instead of guessing", () => {
    const withoutYield = createCatalogTemplate({ id: "template-1", catalogItemId: "item-1", title: null, note: "مرجع", components: [], yield: null, yieldReadiness: "not_configured", revision: 1, sourceTemplateId: null, createdAt: at, createdOperationKey: "template:1" });
    const needsConversion = createCatalogTemplate({ id: "template-2", catalogItemId: "item-1", title: "مراجعة", note: null, components: [{ id: "component-1", name: "مادة", quantityMilli: 1250, unitId: "kg", note: null }], yield: { quantityMilli: 1000, unitId: "g" }, yieldReadiness: "needs_conversion", revision: 2, sourceTemplateId: withoutYield.id, createdAt: at, createdOperationKey: "template:2" });
    expect(withoutYield).toMatchObject({ yield: null, yieldReadiness: "not_configured" });
    expect(needsConversion).toMatchObject({ revision: 2, sourceTemplateId: "template-1", yieldReadiness: "needs_conversion", components: [{ quantityMilli: 1250 }] });
  });
});

describe("CatalogService G4-A", () => {
  it("creates units and a catalog item with an optional organized unit, then retries without duplication", async () => {
    const store = new MemoryLocalStore();
    const service = new CatalogService(store, () => at);
    const createdUnit = await service.createUnit({ nameAr: "قطعة", dimension: "count", operationKey: "unit:piece" });
    if (!createdUnit.ok) throw new Error("unit should be created");
    const created = await service.create({ kind: "product", name: "صندوق هدايا", unitLabel: "قطعة", unitId: createdUnit.unit.id, operationKey: "catalog:gift" });
    const retry = await service.create({ kind: "product", name: "اسم آخر لا يبدل السابق", unitLabel: null, operationKey: "catalog:gift" });
    expect(created).toMatchObject({ ok: true, item: { unitId: createdUnit.unit.id } });
    expect(retry).toMatchObject({ ok: true, item: { id: created.ok ? created.item.id : "missing" } });
  });

  it("keeps unit, conversion, and template creation idempotent on retry", async () => {
    const store = new MemoryLocalStore();
    const service = new CatalogService(store, () => at);
    const firstUnit = await service.createUnit({ nameAr: "قطعة", dimension: "count", operationKey: "unit:idempotent" });
    const retriedUnit = await service.createUnit({ nameAr: "اسم لا يبدل العملية", dimension: "count", operationKey: "unit:idempotent" });
    if (!firstUnit.ok || !retriedUnit.ok) throw new Error("unit should be idempotent");
    expect(retriedUnit.unit.id).toBe(firstUnit.unit.id);
    const firstConversion = await service.createConversion({ fromUnitId: firstUnit.unit.id, toUnitId: "other-unit", numerator: 1, denominator: 1, note: "لن تحفظ", operationKey: "conversion:invalid" });
    expect(firstConversion).toMatchObject({ ok: false });
    const otherUnit = await service.createUnit({ nameAr: "دزينة", dimension: "count", operationKey: "unit:dozen:idempotent" });
    if (!otherUnit.ok) throw new Error("second unit should be created");
    const conversion = await service.createConversion({ fromUnitId: firstUnit.unit.id, toUnitId: otherUnit.unit.id, numerator: 1, denominator: 12, note: "12 قطعة = 1 دزينة", operationKey: "conversion:idempotent" });
    const retriedConversion = await service.createConversion({ fromUnitId: firstUnit.unit.id, toUnitId: otherUnit.unit.id, numerator: 99, denominator: 1, note: "لا يبدل العامل", operationKey: "conversion:idempotent" });
    if (!conversion.ok || !retriedConversion.ok) throw new Error("conversion should be idempotent");
    expect(conversion.conversion).toMatchObject({ fromUnitId: firstUnit.unit.id, toUnitId: otherUnit.unit.id, numerator: 1, denominator: 12 });
    expect(convertQuantityMilli(12_000, conversion.conversion)).toEqual({ quantityMilli: 1_000, exact: true });
    expect(retriedConversion.conversion.id).toBe(conversion.conversion.id);
    const item = await service.create({ kind: "service", name: "تجهيز", unitLabel: null, operationKey: "catalog:idempotent" });
    if (!item.ok) throw new Error("catalog should be created");
    const template = await service.createTemplate({ catalogItemId: item.item.id, title: "قالب", note: null, components: [], yield: null, operationKey: "template:idempotent" });
    const retriedTemplate = await service.createTemplate({ catalogItemId: item.item.id, title: "عنوان لا يبدل العملية", note: null, components: [], yield: null, operationKey: "template:idempotent" });
    if (!template.ok || !retriedTemplate.ok) throw new Error("template should be idempotent");
    expect(retriedTemplate.template.id).toBe(template.template.id);
  });

  it("rejects cross-dimension conversion and duplicate active pairs while preserving an inactive revision path", async () => {
    const store = new MemoryLocalStore();
    const service = new CatalogService(store, () => at);
    const kg = await service.createUnit({ nameAr: "كيلوغرام", dimension: "mass", operationKey: "unit:kg" });
    const liter = await service.createUnit({ nameAr: "لتر", dimension: "volume", operationKey: "unit:liter" });
    const gram = await service.createUnit({ nameAr: "غرام", dimension: "mass", operationKey: "unit:g" });
    if (!kg.ok || !liter.ok || !gram.ok) throw new Error("units should be created");
    const cross = await service.createConversion({ fromUnitId: kg.unit.id, toUnitId: liter.unit.id, numerator: 1, denominator: 1, note: "لا كثافة", operationKey: "conversion:cross" });
    const valid = await service.createConversion({ fromUnitId: kg.unit.id, toUnitId: gram.unit.id, numerator: 1000, denominator: 1, note: "تحويل صريح", operationKey: "conversion:kg-g" });
    const duplicate = await service.createConversion({ fromUnitId: kg.unit.id, toUnitId: gram.unit.id, numerator: 1, denominator: 1, note: "عامل متناقض", operationKey: "conversion:kg-g-2" });
    expect(cross).toMatchObject({ ok: false, message: expect.stringContaining("بُعدين مختلفين") });
    expect(valid).toMatchObject({ ok: true, conversion: { dimension: "mass", numerator: 1000 } });
    expect(duplicate).toMatchObject({ ok: false, message: expect.stringContaining("تحويل نشط") });
    if (!valid.ok) throw new Error("conversion should be created");
    await expect(service.deactivateConversion(valid.conversion.id)).resolves.toMatchObject({ ok: true, conversion: { active: false } });
    await expect(service.createConversion({ fromUnitId: kg.unit.id, toUnitId: gram.unit.id, numerator: 1000, denominator: 1, note: "نسخة موثقة", operationKey: "conversion:kg-g-3" })).resolves.toMatchObject({ ok: true, conversion: { active: true } });
  });

  it("keeps templates planning-only and creates a dated revision without changing catalog history", async () => {
    const store = new MemoryLocalStore();
    const service = new CatalogService(store, () => at);
    const count = await service.createUnit({ nameAr: "قطعة", dimension: "count", operationKey: "unit:piece:candle" });
    if (!count.ok) throw new Error("count unit should be created");
    const created = await service.create({ kind: "product", name: "شمعة", unitLabel: "قطعة", unitId: count.unit.id, operationKey: "catalog:candle" });
    if (!created.ok) throw new Error("catalog should be created");
    const first = await service.createTemplate({ catalogItemId: created.item.id, title: "تجهيز معتاد", note: null, components: [], yield: null, operationKey: "template:candle:1" });
    if (!first.ok) throw new Error("template should be created");
    const second = await service.reviseTemplate(first.template.id, { title: "تجهيز محدث", note: "مراجعة مستقبلية", components: [{ id: "wax", name: "شمع", quantityMilli: 1000, unitId: "missing", note: null }], yield: null, operationKey: "template:candle:2" });
    expect(second).toMatchObject({ ok: false, message: expect.stringContaining("وحدة نشطة") });
    const mass = await service.createUnit({ nameAr: "غرام", dimension: "mass", operationKey: "unit:gram:template" });
    if (!mass.ok) throw new Error("mass unit should be created");
    const crossDimensionYield = await service.reviseTemplate(first.template.id, { title: "مراجعة وزن", note: null, components: [], yield: { quantityMilli: 1000, unitId: mass.unit.id }, operationKey: "template:candle:cross" });
    expect(crossDimensionYield).toMatchObject({ ok: false, message: expect.stringContaining("بُعد مختلف") });
    const snapshot = await store.readSnapshot();
    expect(snapshot).toMatchObject({ ok: true, value: { catalogItems: [{ id: created.item.id }], catalogTemplates: [{ id: first.template.id, active: true }] } });
  });
});
