import { describe, expect, it } from "vitest";
import { isValidWasteContext } from "../../src/domain/recurring-margin/index.js";
import { createInventoryMovement } from "../../src/domain/inventory-material/index.js";

/* المجموعة ٩ (STR-030): توصيف سياق الهدر قبل توحيد مصدر الحقيقة — النسختان
 * (inventory-material صاحبة الحركة، وrecurring-margin التي تعيد استخدام
 * الشكل) متطابقتان بايتًا بايتًا، ومحققتاهما متطابقتان سلوكًا على كل فئات
 * المدخلات. يثبت هذا الملف سلوك المسارين العامين معًا ليظل التوحيد لاحقًا
 * محكومًا بتوأمة مثبتة لا بافتراض صامت. */

const validContexts = [
  { kind: "order", orderId: "order-1" },
  { kind: "catalog_item", catalogItemId: "catalog-1" },
  { kind: "catalog_template", catalogItemId: "catalog-1", templateId: "template-1" },
  { kind: "general_project" },
  { kind: "unallocated", allocationNote: null },
  { kind: "unallocated", allocationNote: "مشروع صيانة الأفران" },
] as const;

const invalidContexts = [
  "order",
  42,
  [],
  { kind: "unknown" },
  { kind: "order", orderId: "" },
  { kind: "order", orderId: "   " },
  { kind: "order", orderId: 5 },
  { kind: "catalog_item", catalogItemId: "" },
  { kind: "catalog_item", catalogItemId: null },
  { kind: "catalog_template", catalogItemId: "catalog-1", templateId: "" },
  { kind: "catalog_template", catalogItemId: "catalog-1" },
  { kind: "unallocated", allocationNote: "" },
  { kind: "unallocated", allocationNote: 7 },
  { kind: "unallocated" },
];

function wasteMovement(wasteContext: unknown) {
  return createInventoryMovement({
    id: `movement-${Math.random().toString(36).slice(2, 8)}`,
    materialId: "material-1",
    type: "waste",
    occurredOn: "2026-08-01",
    recordedAt: "2026-08-01T09:00:00.000Z",
    quantityDeltaMilli: -100,
    valueDeltaMinor: -50,
    note: "اختبار سياق الهدر",
    reason: "اختبار",
    operationKey: "waste-context-characterization",
    wasteContext: wasteContext as never,
  });
}

describe("WasteContext characterization — the two bounded contexts agree on every input class (STR-030)", () => {
  it("accepts every valid context shape in both contexts", () => {
    for (const context of validContexts) {
      expect(isValidWasteContext(context)).toBe(true);
      const movement = wasteMovement(context);
      expect(movement.wasteContext).toEqual(context);
    }
  });

  it("rejects every provided invalid context shape in both contexts", () => {
    for (const context of invalidContexts) {
      expect(isValidWasteContext(context)).toBe(false);
      expect(() => wasteMovement(context)).toThrow(/سياق الهدر/);
    }
  });

  it("treats an absent context (null/undefined) as the general_project default in both contexts", () => {
    /* المدخل الغائب ليس سياقًا غير صالح بل تقصيرًا إلى general_project
     * (عقد ٢٨)؛ المحقق المستقل نفسه يصف null بأنه «غير سياق» لا «سياقًا
     * فاسدًا». */
    expect(isValidWasteContext(null)).toBe(false);
    expect(isValidWasteContext(undefined)).toBe(false);
    expect(wasteMovement(null).wasteContext).toEqual({ kind: "general_project" });
    expect(wasteMovement(undefined).wasteContext).toEqual({ kind: "general_project" });
  });

  it("defaults a missing waste context on a waste movement to general_project (contract 28)", () => {
    const movement = createInventoryMovement({
      id: "movement-default-context",
      materialId: "material-1",
      type: "waste",
      occurredOn: "2026-08-01",
      recordedAt: "2026-08-01T09:00:00.000Z",
      quantityDeltaMilli: -100,
      valueDeltaMinor: -50,
      note: "اختبار سياق الهدر",
      reason: "اختبار",
      operationKey: "waste-context-characterization-default",
    });
    expect(movement.wasteContext).toEqual({ kind: "general_project" });
  });

  it("refuses a waste context on non-waste movement types (the context belongs to waste only)", () => {
    expect(() =>
      createInventoryMovement({
        id: "movement-consumption-context",
        materialId: "material-1",
        type: "consumption",
        occurredOn: "2026-08-01",
        recordedAt: "2026-08-01T09:00:00.000Z",
        quantityDeltaMilli: -100,
        valueDeltaMinor: -50,
        note: "اختبار",
        reason: "استهلاك ببيان",
        operationKey: "waste-context-characterization-consumption",
        wasteContext: { kind: "general_project" },
      }),
    ).toThrow(/سياق الهدر/);
  });
});
