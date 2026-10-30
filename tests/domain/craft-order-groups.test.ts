import { describe, expect, it } from "vitest";
import {
  calculateCostSnapshot,
  expandGroupedCostBasis,
  type GroupedCostBasisInput,
  type MaterialCostItem,
} from "../../src/domain/craft-order/index.js";

/* S09 (UNIT-007/008 + SH-13 — أمر التنفيذ المتصل ad133bae القسم ٢): توسيع
 * أساس المجموعات إلى مدخل قياسي للنواة الواحدة — مكونات الوحدة الواحدة
 * تُضرب في تكرار المجموعة مرة واحدة فقط (SDF-034)، والتوصيل على نطاق الطلب
 * مرة واحدة، والكمية = مجموع التكرارات مشتقة. الضرب يسبق تقريب النواة
 * (تقريب واحد للبند على مستوى الطلب كله)، وإجمالي 1000 minor لكمية 3 يبقى
 * 1000 (SDF-002). لا محرك ثانٍ: الناتج يدخل calculateCostSnapshot وحدها. */

const CREATED_AT = "2026-10-30T15:00:00.000Z";

function unitItem(name: string, quantity: number, unitPriceMinor: number): MaterialCostItem {
  return {
    name,
    quantity,
    unit: "قطعة",
    unitPriceMinor,
    priceDate: "2026-10-28",
    source: "user_input",
    confidence: "known",
  };
}

function groupedInput(): GroupedCostBasisInput {
  return {
    currency: "JOD",
    groups: [
      {
        id: "group-box",
        label: "صندوق هدايا",
        repeatQuantity: 10,
        unitMaterialItems: [unitItem("شوكولاتة فاخرة", 0.2, 150), unitItem("شوكولاتة عادية", 0.1, 250)],
      },
      {
        id: "group-second",
        label: "مجموعة ثانية مختلفة",
        repeatQuantity: 3,
        unitMaterialItems: [unitItem("كيس مكسرات", 0.5, 400)],
      },
    ],
    /* F11/F12: الوقت والتغليف والهدر والتوصيل على نطاق الطلب كما في العقد القائم. */
    time: { minutes: 30, hourlyRateMinor: 600, confidence: "known" },
    packagingMinor: 200,
    deliveryMinor: 300,
    wasteMinor: 100,
    safetyBufferMinor: 50,
    createdAt: CREATED_AT,
  };
}

/* نفس المدخل كما لو أدخله المستخدم كاملًا مباشرة — لإثبات التكافؤ مع النواة الواحدة. */
function directWholeOrderInput() {
  return {
    currency: "JOD" as const,
    materialItems: [
      unitItem("شوكولاتة فاخرة", 2, 150),
      unitItem("شوكولاتة عادية", 1, 250),
      unitItem("كيس مكسرات", 1.5, 400),
    ],
    time: { minutes: 30, hourlyRateMinor: 600, confidence: "known" as const },
    packagingMinor: 200,
    deliveryMinor: 300,
    wasteMinor: 100,
    safetyBufferMinor: 50,
    quantity: 13,
    createdAt: CREATED_AT,
    source: "draft" as const,
  };
}

function singleGroupInput(
  id: string,
  label: string,
  repeatQuantity: number,
  unitMaterialItems: readonly MaterialCostItem[],
  deliveryMinor = 0,
): GroupedCostBasisInput {
  return {
    currency: "JOD",
    groups: [{ id, label, repeatQuantity, unitMaterialItems }],
    time: null,
    packagingMinor: 0,
    deliveryMinor,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    createdAt: CREATED_AT,
  };
}

describe("expandGroupedCostBasis — S09/SH-13 (SDF-034 + SDF-002): expansion semantics", () => {
  it("multiplies each group's unit basis by its repeat exactly once and derives the order quantity", () => {
    const expanded = expandGroupedCostBasis(groupedInput());
    /* المجموعة الأولى ×10 مرة واحدة: 0.2→2 و0.1→1؛ والثانية ×3: 0.5→1.5. */
    expect(expanded.materialItems.map(item => [item.name, item.quantity])).toEqual([
      ["شوكولاتة فاخرة", 2],
      ["شوكولاتة عادية", 1],
      ["كيس مكسرات", 1.5],
    ]);
    /* كمية الطلب = مجموع التكرارات مشتقة لا مدخلة: 10 + 3 = 13. */
    expect(expanded.quantity).toBe(13);
    /* المستويات على نطاق الطلب تمر كما دخلت — التوصيل مرة واحدة. */
    expect(expanded.deliveryMinor).toBe(300);
    expect(expanded.time).toEqual({ minutes: 30, hourlyRateMinor: 600, confidence: "known" });
    expect(expanded.source).toBe("draft");
  });

  it("is exactly equivalent to entering the whole-order basis directly (one kernel, no second engine)", () => {
    const fromGroups = expandGroupedCostBasis(groupedInput());
    const direct = directWholeOrderInput();
    expect(fromGroups).toEqual(direct);
    /* والنواة الواحدة تعطي اللقطة نفسها من المدخلين — لا محرك ثانٍ. */
    expect(calculateCostSnapshot("cost-equivalence", fromGroups)).toEqual(
      calculateCostSnapshot("cost-equivalence", direct),
    );
  });

  it("counts project delivery once at order scope and never double-multiplies it", () => {
    const snapshot = calculateCostSnapshot("cost-sdf034", expandGroupedCostBasis(groupedInput()));
    /* مواد: 300 + 250 + 600 = 1150؛ وقت 300؛ تغليف 200؛ توصيل 300 مرة واحدة؛ هدر 100. */
    expect(snapshot.materialCostMinor).toBe(1150);
    expect(snapshot.timeCostMinor).toBe(300);
    expect(snapshot.plannedCostMinor).toBe(2050);
    expect(snapshot.unitCostMinor).toBe(158);
    expect(snapshot.priceFloorMinor).toBe(208);
    expect(snapshot.quantity).toBe(13);
  });

  it("multiplies before the kernel's per-item rounding — never rounds per unit then multiplies", () => {
    /* 0.333 وحدة بسعر 1001: تقريب الوحدة الواحدة 333 minor؛ ×3 بعد التقريب 999.
     * التوسيع الصادق يضرب أولًا: 0.999 → 999 ملي × 1001 = 999999 → 1000 minor
     * بتقريب واحد على مستوى الطلب كله — كما لو أدخل المستخدم كمية الطلب مباشرة. */
    const input = singleGroupInput("group-rounding", "مجموعة التقريب", 3, [
      unitItem("مادة الاختبار", 0.333, 1001),
    ]);
    const snapshot = calculateCostSnapshot("cost-rounding", expandGroupedCostBasis(input));
    expect(snapshot.materialCostMinor).toBe(1000);
    expect(snapshot.materialCostMinor).not.toBe(999);
  });
});

describe("expandGroupedCostBasis — S09/SH-13: honest states and rejections", () => {
  it("SDF-002: a total of 10.00 for 3 units stays 1000 minor — display rounding never recomputes it", () => {
    const input = singleGroupInput("group-ten", "مجموعة العشرة", 3, [unitItem("قطعة العمل", 1, 300)], 100);
    const snapshot = calculateCostSnapshot("cost-sdf002", expandGroupedCostBasis(input));
    /* الإجمالي 1000 minor لكمية 3 يبقى 1000؛ وحدة العرض 334 ولا يعاد حسابه 334×3=1002. */
    expect(snapshot.plannedCostMinor).toBe(1000);
    expect(snapshot.unitCostMinor).toBe(334);
    expect(snapshot.unitCostMinor * snapshot.quantity).not.toBe(snapshot.plannedCostMinor);
  });

  it("keeps unknown cost honest — a group with no components stays incomplete, never zero-cost", () => {
    const input = singleGroupInput("group-empty", "مجموعة بلا مكونات", 2, []);
    const snapshot = calculateCostSnapshot("cost-unknown", expandGroupedCostBasis(input));
    expect(snapshot.knowledgeState).toBe("incomplete");
    expect(snapshot.knowledgeGaps?.some(gap => gap.id === "no_cost_components" && gap.mandatory)).toBe(true);
  });

  it("rejects invalid groups and unsafe expansion honestly", () => {
    const base = groupedInput();
    expect(() => expandGroupedCostBasis({ ...base, groups: [] })).toThrow();
    expect(() =>
      expandGroupedCostBasis({ ...base, groups: [{ ...base.groups[0]!, repeatQuantity: 0 }] }),
    ).toThrow();
    expect(() =>
      expandGroupedCostBasis({ ...base, groups: [{ ...base.groups[0]!, repeatQuantity: 1.5 }] }),
    ).toThrow();
    expect(() => expandGroupedCostBasis({ ...base, groups: [{ ...base.groups[0]!, id: "   " }] })).toThrow();
    expect(() => expandGroupedCostBasis({ ...base, groups: [{ ...base.groups[0]!, label: "" }] })).toThrow();
    expect(() =>
      expandGroupedCostBasis({
        ...base,
        groups: [
          {
            id: "group-overflow",
            label: "تجاوز الدقة",
            repeatQuantity: 10,
            unitMaterialItems: [unitItem("مادة فائضة", 1.7e308, 1)],
          },
        ],
      }),
    ).toThrow();
  });
});
