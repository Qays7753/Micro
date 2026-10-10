/** R7 / R6-F17-P08 (2026-10-10): عقد نموذج عرض محرر حركة المخزون — روابط
 * الوصلة، البوابة المطابقة لنوع الحركة، وسياق الهدر الخمسي. */
import { describe, expect, it } from "vitest";
import {
  deriveWasteContext,
  parseMovementLinkParams,
  validateMovementSubmission,
} from "./inventoryMovementEditorModel";

describe("R7/P08 — روابط الوصلة العميقة", () => {
  it("الأشكال الصالحة تمر والبقية تُهمل بهدوء", () => {
    const links = parseMovementLinkParams("?order=ord-1&sale=s_2&purchase=p3&material=m-4&order=bad");
    expect(links).toEqual({
      linkedOrderId: "ord-1",
      linkedSaleId: "s_2",
      linkedPurchaseId: "p3",
      linkedMaterialId: "m-4",
    });
  });

  it("الباطل والفارغ والطويل وغير النمط = null", () => {
    expect(parseMovementLinkParams("?order=%D9%85&sale=&purchase=x".repeat(40))).toEqual({
      linkedOrderId: null,
      linkedSaleId: null,
      linkedPurchaseId: null,
      linkedMaterialId: null,
    });
    expect(parseMovementLinkParams(null)).toEqual({
      linkedOrderId: null,
      linkedSaleId: null,
      linkedPurchaseId: null,
      linkedMaterialId: null,
    });
  });
});

describe("R7/P08 — بوابة التحقق المطابقة لنوع الحركة", () => {
  const base = {
    safeType: "consume" as const,
    referencesLoaded: true,
    materialId: "m1",
    quantityValid: true,
    quantityMilli: 500,
    note: "استهلاك",
    valueValid: true,
    purchaseId: "",
    costKnown: false,
    valueMinor: 0,
    consumeTarget: "order" as const,
    orderId: "o1",
    saleId: "",
    reason: "",
    wasteContextKind: "general_project" as const,
    wasteOrderId: "",
    wasteCatalogItemId: "",
    wasteTemplateId: "",
  };

  it("القيم السليمة تمر", () => {
    expect(validateMovementSubmission(base)).toBeNull();
  });

  it("الحقول الناقصة أولًا (نفس ترتيب الأصل)", () => {
    expect(validateMovementSubmission({ ...base, materialId: "" })).toBe("missing_fields");
    expect(validateMovementSubmission({ ...base, quantityMilli: 0 })).toBe("missing_fields");
    expect(validateMovementSubmission({ ...base, note: "  " })).toBe("missing_fields");
    expect(validateMovementSubmission({ ...base, referencesLoaded: false })).toBe("missing_fields");
    expect(validateMovementSubmission({ ...base, safeType: null })).toBe("missing_fields");
  });

  it("كل نوع يفحص شرطه الخاص", () => {
    expect(validateMovementSubmission({ ...base, safeType: "receipt", purchaseId: "" })).toBe(
      "receipt_needs_purchase",
    );
    expect(
      validateMovementSubmission({
        ...base,
        safeType: "receipt",
        purchaseId: "p1",
        costKnown: true,
        valueMinor: 0,
      }),
    ).toBe("receipt_needs_purchase");
    expect(validateMovementSubmission({ ...base, orderId: "" })).toBe("consume_needs_order");
    expect(validateMovementSubmission({ ...base, consumeTarget: "sale" })).toBe("consume_needs_sale");
    /* استهلاك المشروع ببيان فارغ يلتقطه الشرط الأول (missing_fields) — فرع
     * «consume_project_needs_note» دفاعي محفوظ حرفيًا كما بالأصل (غير قابل
     * للوصول عبر بيان فارغ لأن البوابة الأولى تسبقه). */
    expect(validateMovementSubmission({ ...base, consumeTarget: "project", note: "  " })).toBe(
      "missing_fields",
    );
    expect(validateMovementSubmission({ ...base, consumeTarget: "project" })).toBeNull();
    expect(validateMovementSubmission({ ...base, safeType: "waste", reason: "" })).toBe(
      "movement_needs_reason",
    );
    expect(validateMovementSubmission({ ...base, safeType: "adjust", reason: "" })).toBe(
      "movement_needs_reason",
    );
    expect(
      validateMovementSubmission({ ...base, safeType: "waste", reason: "سبب", wasteContextKind: "order" }),
    ).toBe("waste_needs_order");
    expect(
      validateMovementSubmission({
        ...base,
        safeType: "waste",
        reason: "سبب",
        wasteContextKind: "catalog_item",
      }),
    ).toBe("waste_needs_catalog_item");
    expect(
      validateMovementSubmission({
        ...base,
        safeType: "waste",
        reason: "سبب",
        wasteContextKind: "catalog_template",
        wasteCatalogItemId: "c1",
        wasteTemplateId: "",
      }),
    ).toBe("waste_needs_template");
  });
});

describe("R7/P08 — سياق الهدر الخمسي", () => {
  it("نفس اشتقاق الصفحة لكل الأنواع", () => {
    const input = {
      wasteOrderId: "o1",
      wasteCatalogItemId: "c1",
      wasteTemplateId: "t1",
      wasteAllocationNote: "  ملاحظة  ",
    };
    expect(deriveWasteContext({ ...input, wasteContextKind: "order" })).toEqual({
      kind: "order",
      orderId: "o1",
    });
    expect(deriveWasteContext({ ...input, wasteContextKind: "catalog_item" })).toEqual({
      kind: "catalog_item",
      catalogItemId: "c1",
    });
    expect(deriveWasteContext({ ...input, wasteContextKind: "catalog_template" })).toEqual({
      kind: "catalog_template",
      catalogItemId: "c1",
      templateId: "t1",
    });
    expect(deriveWasteContext({ ...input, wasteContextKind: "unallocated" })).toEqual({
      kind: "unallocated",
      allocationNote: "ملاحظة",
    });
    expect(
      deriveWasteContext({ ...input, wasteContextKind: "unallocated", wasteAllocationNote: "" }),
    ).toEqual({
      kind: "unallocated",
      allocationNote: null,
    });
    expect(deriveWasteContext({ ...input, wasteContextKind: "general_project" })).toEqual({
      kind: "general_project",
    });
  });
});
