import { describe, expect, it } from "vitest";
import {
  createCatalogTemplate,
  createCatalogItem,
  updateCatalogItemDefaults,
} from "../../src/domain/catalog/index.js";

describe("catalog domain core", () => {
  it("creates an optional product or service reference without price, stock, or cost semantics", () => {
    const product = createCatalogItem({
      id: "gift-box",
      kind: "product",
      name: " صندوق هدايا ",
      unitLabel: " قطعة ",
      createdAt: "2026-08-23T10:00:00.000Z",
      createdOperationKey: "catalog-gift-box",
    });
    const service = createCatalogItem({
      id: "gift-wrap",
      kind: "service",
      name: "تغليف هدايا",
      unitLabel: null,
      createdAt: "2026-08-23T10:00:00.000Z",
      createdOperationKey: "catalog-gift-wrap",
    });
    expect(product).toEqual({
      id: "gift-box",
      kind: "product",
      name: "صندوق هدايا",
      unitLabel: "قطعة",
      unitId: null,
      /* P-002 (الخيار أ): اقتراحان اختياريان على المرجع — غيابهما null صريح:
       * لا سعرًا مفروضًا ولا تكلفة فعلية ولا مخزونًا. حدّث الاختبار مع القرار المعتمد. */
      defaultPriceMinor: null,
      defaultUnitCostMinor: null,
      active: true,
      createdAt: "2026-08-23T10:00:00.000Z",
      updatedAt: "2026-08-23T10:00:00.000Z",
      createdOperationKey: "catalog-gift-box",
    });
    expect(service).toMatchObject({ kind: "service", unitLabel: null, active: true });
    expect(product).not.toHaveProperty("priceMinor");
    expect(product).not.toHaveProperty("stock");
  });

  it("rejects a catalog reference with blank identity or unsupported type instead of inventing a product", () => {
    expect(() =>
      createCatalogItem({
        id: "",
        kind: "product",
        name: "صندوق",
        unitLabel: null,
        createdAt: "2026-08-23T10:00:00.000Z",
        createdOperationKey: "key",
      }),
    ).toThrow("معرف المرجع");
    expect(() =>
      createCatalogItem({
        id: "bad-kind",
        kind: "other" as never,
        name: "صندوق",
        unitLabel: null,
        createdAt: "2026-08-23T10:00:00.000Z",
        createdOperationKey: "key",
      }),
    ).toThrow("نوع المرجع");
    expect(() =>
      createCatalogItem({
        id: "blank-name",
        kind: "product",
        name: " ",
        unitLabel: null,
        createdAt: "2026-08-23T10:00:00.000Z",
        createdOperationKey: "key",
      }),
    ).toThrow("اسم المرجع");
  });

  /* P-002 (الخيار أ): تحديث الاقتراحات فقط — الاسم والتفعيل والتاريخ الأصلي لا تُمس. */
  it("updates only the suggested defaults, keeping identity and activation untouched", () => {
    const product = createCatalogItem({
      id: "cup",
      kind: "product",
      name: "كوب جاهز",
      unitLabel: "قطعة",
      defaultPriceMinor: 250,
      defaultUnitCostMinor: 120,
      createdAt: "2026-08-23T10:00:00.000Z",
      createdOperationKey: "catalog-cup",
    });
    const updated = updateCatalogItemDefaults(product, {
      defaultPriceMinor: 300,
      defaultUnitCostMinor: null,
      updatedAt: "2026-08-24T10:00:00.000Z",
    });
    expect(updated).toMatchObject({
      id: "cup",
      kind: "product",
      name: "كوب جاهز",
      active: true,
      defaultPriceMinor: 300,
      defaultUnitCostMinor: null,
      updatedAt: "2026-08-24T10:00:00.000Z",
    });
  });

  it("rejects invalid suggestion values instead of storing a silent zero", () => {
    const product = createCatalogItem({
      id: "cup",
      kind: "product",
      name: "كوب جاهز",
      unitLabel: null,
      createdAt: "2026-08-23T10:00:00.000Z",
      createdOperationKey: "catalog-cup-2",
    });
    expect(() =>
      updateCatalogItemDefaults(product, {
        defaultPriceMinor: 0,
        defaultUnitCostMinor: null,
        updatedAt: "2026-08-24T10:00:00.000Z",
      }),
    ).toThrow("السعر الافتراضي المقترح");
    expect(() =>
      updateCatalogItemDefaults(product, {
        defaultPriceMinor: null,
        defaultUnitCostMinor: -5,
        updatedAt: "2026-08-24T10:00:00.000Z",
      }),
    ).toThrow("التكلفة الافتراضية المقترحة");
  });
});

/* المجموعة ٤ (عقد ٢٩): علم الخصم التلقائي عند التسليم — إعلان صريح على القالب،
 * غيابه = غير معلن (سلوك المجموعة ٣ كما هو). */
describe("template auto-consume declaration (group 4)", () => {
  const baseTemplateInput = {
    id: "template-auto",
    catalogItemId: "item-1",
    title: "قالب أساسي",
    note: null,
    components: [{ id: "comp-1", name: "خيط", quantityMilli: 1000, unitId: "unit-piece", note: null }],
    yield: null as { quantityMilli: number; unitId: string } | null,
    yieldReadiness: "not_configured" as const,
    revision: 1,
    sourceTemplateId: null,
    createdAt: "2026-09-04T08:00:00.000Z",
    createdOperationKey: "template-auto-1",
  };
  it("stores true when declared and null when absent — never a silent default true", () => {
    const declared = createCatalogTemplate({ ...baseTemplateInput, autoConsumeOnDelivery: true });
    expect(declared.autoConsumeOnDelivery).toBe(true);
    const undeclared = createCatalogTemplate({
      ...baseTemplateInput,
      createdOperationKey: "template-auto-2",
    });
    expect(undeclared.autoConsumeOnDelivery).toBeNull();
    const rejected = createCatalogTemplate({
      ...baseTemplateInput,
      createdOperationKey: "template-auto-3",
      autoConsumeOnDelivery: "yes" as unknown as boolean,
    });
    expect(rejected.autoConsumeOnDelivery).toBeNull();
  });
});
