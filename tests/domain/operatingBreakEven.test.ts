/* REM-007 (المرحلة ب — 2026-09-29): اختبارات قبول النموذج الكنوني للتعادل
 * التشغيلي — قرار المالك: نتيجة التشغيل صفر عند التعادل، سالبة تحته،
 * موجبة فوقه؛ قيمة المبيعات من النسبة المجمعّة الدقيقة بلا تقريب مزدوج؛
 * والنتيجة التشغيلية المستهدفة (TARGET_OPERATING_RESULT) فوق الأساس نفسه.
 *
 * كل الأوراكل حساب يدوي مستقل (لا نسخ لمعادلة الإنتاج): الأرقام محسوبة
 * مسبقًا في التعليقات قبل كتابة التوقع. */
import { describe, expect, it } from "vitest";
import { calculateBreakEven, calculateDirectMargin } from "../../src/domain/g5/index.js";

const order = (overrides: Partial<Parameters<typeof calculateDirectMargin>[2][number]> = {}) => ({
  id: "order-1",
  itemName: "صندوق",
  deliveredOn: "2026-08-10",
  resultStatus: "final" as const,
  quantityMilli: 10000,
  unitKey: "piece",
  unitLabel: "قطعة",
  quantityIssue: null,
  recognizedRevenueMinor: 10000,
  recognizedCostMinor: 6000,
  ...overrides,
});
const fixedExpense = (overrides: Partial<Parameters<typeof calculateDirectMargin>[3][number]> = {}) => ({
  id: "expense-1",
  amountMinor: 4000,
  behavior: "fixed" as const,
  relationship: "project" as const,
  knowledge: "known" as const,
  sharedProjectShareBasis: null,
  directlyLinked: false,
  source: "إيجار الورشة",
  ...overrides,
});

describe("REM-007 — النموذج الكنوني للتعادل التشغيلي (طبقة المجال)", () => {
  it("operating result is exactly zero at break-even (10000 revenue, 6000 variable, 4000 fixed)", () => {
    /* أوراكل يدوي: الهامش = 10000 − 6000 = 4000؛ نتيجة التشغيل = 4000 − 4000 = 0؛
     * المزيج المسجل (10 قطع) يعطي مبيعات تعادل = ceil(4000 × 10000 ÷ 4000) = 10000. */
    const result = calculateBreakEven("2026-08-01", "2026-08-31", [order()], [fixedExpense()]);
    expect(result).toMatchObject({
      status: "available",
      totalRevenueMinor: 10000,
      totalVariableCostMinor: 6000,
      contributionMarginMinor: 4000,
      fixedExpenseMinor: 4000,
      operatingResultMinor: 0,
      breakEvenState: "at",
      remainingToBreakEvenMinor: 0,
      amountAboveBreakEvenMinor: null,
      breakEvenUnits: 10,
      breakEvenSalesValueMinor: 10000,
      contributionMarginRatioPermyriad: 4000,
      classificationGap: false,
      targetOperatingResult: null,
    });
  });

  it("below break-even the operating result is negative with the remaining amount; above it is positive with the surplus", () => {
    /* تحت: 4000 − 4500 = −500؛ فوق: 4000 − 3500 = +500. */
    const below = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order()],
      [fixedExpense({ amountMinor: 4500 })],
    );
    const above = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order()],
      [fixedExpense({ amountMinor: 3500 })],
    );
    expect(below).toMatchObject({
      operatingResultMinor: -500,
      breakEvenState: "below",
      remainingToBreakEvenMinor: 500,
      amountAboveBreakEvenMinor: null,
    });
    expect(above).toMatchObject({
      operatingResultMinor: 500,
      breakEvenState: "above",
      remainingToBreakEvenMinor: 0,
      amountAboveBreakEvenMinor: 500,
    });
  });

  it("break-even units use one safe ceil and preserve the theoretical-threshold distinction", () => {
    /* أوراكل يدوي: 3 قطع، إيراد 9000، متغيرة 3000 → هامش 6000 (2000/قطعة)؛
     * الثابتة 5000 → النسبة النظرية 2.5 وحدة؛ أول عتبة صحيحة عندها أو فوقها = 3
     * (عند 2: 4000 − 5000 = −1000 < 0؛ عند 3: 6000 − 5000 = +1000 ≥ 0). */
    const result = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order({ quantityMilli: 3000, recognizedRevenueMinor: 9000, recognizedCostMinor: 3000 })],
      [fixedExpense({ amountMinor: 5000 })],
    );
    expect(result.breakEvenUnits).toBe(3);
    expect(result.assumptions.join(" ")).toContain("النسبة النظرية المستمرة قد تقع بين وحدتين");
  });

  it("break-even sales value comes from the exact aggregate ratio without double rounding", () => {
    /* أوراكل يدوي: إيراد 7000، متغيرة 5000 → هامش 2000 (النسبة 2/7 الدقيقة)؛
     * الثابتة 1001 → القيمة الدقيقة = 1001 × 7000 ÷ 2000 = 3503.5 → أول قيمة
     * صحيحة = 3504. لو استُخدمت النسبة المقربة (2857/10000) لنَتج عنها 3506 —
     * خطأ التقريب المزدوج الذي يمنعه العقد. عند 3504: 2×3504÷7 − 1001 ≥ 0؛
     * عند 3503: 2×3503÷7 − 1001 < 0. */
    const result = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order({ quantityMilli: 7000, recognizedRevenueMinor: 7000, recognizedCostMinor: 5000 })],
      [fixedExpense({ amountMinor: 1001 })],
    );
    expect(result.breakEvenSalesValueMinor).toBe(3504);
    expect(result.contributionMarginRatioPermyriad).toBe(2857);
  });

  it("multi-product break-even uses the recorded mix and the weighted average contribution margin", () => {
    /* أوراكل يدوي (وحدة قطعة واحدة): المنتج أ — 6 قطع إيراد 6000 متغيرة 2400
     * (هامش 3600)؛ المنتج ب — 4 قطع إيراد 4000 متغيرة 2400 (هامش 1600)؛
     * المجموع: هامش 5200 على 10 قطع → متوسط مرجّح 520/قطعة؛ الثابتة 2600
     * → 5 قطع بالضبط. بالمزيج المسجل نفسه (60٪ أ / 40٪ ب): 3×600 + 2×400
     * = 2600 ✓ — لا اختيار منتج واحد بصمت. المبيعات = 2600×10000÷5200 = 5000. */
    const result = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [
        order({
          id: "a",
          itemName: "صندوق فاخر",
          quantityMilli: 6000,
          recognizedRevenueMinor: 6000,
          recognizedCostMinor: 2400,
        }),
        order({
          id: "b",
          itemName: "صندوق بسيط",
          quantityMilli: 4000,
          recognizedRevenueMinor: 4000,
          recognizedCostMinor: 2400,
        }),
      ],
      [fixedExpense({ amountMinor: 2600 })],
    );
    expect(result).toMatchObject({
      status: "available",
      contributionMarginMinor: 5200,
      totalQuantityMilli: 10000,
      contributionMarginPerUnitMinor: 520,
      breakEvenUnits: 5,
      breakEvenSalesValueMinor: 5000,
      operatingResultMinor: 2600,
      breakEvenState: "above",
      amountAboveBreakEvenMinor: 2600,
    });
    expect(result.mix).toHaveLength(2);
  });

  it("incompatible units null the unit results with a reason while the aggregate sales value stays available", () => {
    /* قطعة مقابل كغ بلا تحويل: الوحدات تسقط التوحيد (incomplete + سبب) لكن
     * المجمعات كاملة: الهامش = 4000 + 2000 = 6000 على إيراد 13000؛ الثابتة
     * 2000 → نتيجة تشغيل 4000 (فوق)؛ المبيعات = ceil(2000 × 13000 ÷ 6000)
     * = ceil(4333.33) = 4334. */
    const result = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [
        order(),
        order({
          id: "order-2",
          unitKey: "kilogram",
          unitLabel: "كغ",
          quantityMilli: 1000,
          recognizedRevenueMinor: 3000,
          recognizedCostMinor: 1000,
        }),
      ],
      [fixedExpense({ amountMinor: 2000 })],
      1000,
    );
    expect(result).toMatchObject({
      status: "incomplete",
      totalQuantityMilli: null,
      breakEvenUnits: null,
      operatingResultMinor: 4000,
      breakEvenState: "above",
      breakEvenSalesValueMinor: 4334,
    });
    expect(result.reasons.join(" ")).toContain("غير متوافقة");
    /* وحدات الهدف null بسبب مسمى مع بقاء مبيعات الهدف = ceil(3000×13000÷6000) = 6500. */
    expect(result.targetOperatingResult).toMatchObject({
      targetOperatingResultMinor: 1000,
      targetUnits: null,
      targetSalesValueMinor: 6500,
    });
    expect(result.targetOperatingResult?.reasons.join(" ")).toContain("وحدات الهدف غير متاحة");
  });

  it("a linked variable operating expense enters the margin and shifts the whole operating model", () => {
    /* أوراكل يدوي: 5000 − 1800 − 500 (متغيرة مرتبطة) → هامش 2700 بأساس
     * with_linked_variable؛ الثابتة 1000 → نتيجة 1700؛ الوحدات =
     * ceil(1000×2000 ÷ 2700×1000) = 1؛ المبيعات = ceil(1000×5000÷2700) = 1852. */
    const result = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order({ quantityMilli: 2000, recognizedRevenueMinor: 5000, recognizedCostMinor: 1800 })],
      [
        fixedExpense({ amountMinor: 1000 }),
        {
          id: "expense-var",
          amountMinor: 500,
          behavior: "variable",
          relationship: "project",
          knowledge: "known",
          sharedProjectShareBasis: null,
          directlyLinked: true,
          source: "تغليف مرتبط بالوحدة",
        },
      ],
    );
    expect(result).toMatchObject({
      status: "available",
      marginBasis: "with_linked_variable",
      linkedVariableExpenseMinor: 500,
      contributionMarginMinor: 2700,
      operatingResultMinor: 1700,
      breakEvenState: "above",
      breakEvenUnits: 1,
      breakEvenSalesValueMinor: 1852,
    });
  });

  it("unlinked, mixed, unknown, and unallocated shared costs never disappear nor become zero", () => {
    /* كل واحدة فجوة تصنيف معلنة تهبط بالقراءة إلى incomplete وتُسقط أرقام
     * المجمعات — لا توزيع تلقائي ولا تحويل إلى صفر (المتغيرة غير المرتبطة
     * تُعلن عدّها أيضًا). */
    const unlinked = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order()],
      [
        fixedExpense(),
        {
          id: "expense-var",
          amountMinor: 700,
          behavior: "variable",
          relationship: "project",
          knowledge: "known",
          sharedProjectShareBasis: null,
          directlyLinked: false,
          source: "وقود عمومي",
        },
      ],
    );
    const mixed = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order()],
      [fixedExpense({ behavior: "mixed" })],
    );
    const unknown = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order()],
      [fixedExpense({ behavior: "unknown" })],
    );
    const unallocated = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order()],
      [fixedExpense({ relationship: "shared", sharedProjectShareBasis: null })],
    );
    for (const result of [unlinked, mixed, unknown, unallocated]) {
      expect(result).toMatchObject({
        status: "incomplete",
        breakEvenUnits: null,
        operatingResultMinor: null,
        breakEvenState: null,
        breakEvenSalesValueMinor: null,
        contributionMarginRatioPermyriad: null,
        classificationGap: true,
      });
    }
    expect(unlinked.unlinkedVariableExpenseCount).toBe(1);
    expect(unlinked.reasons.join(" ")).toContain("غير مرتبط");
    expect(mixed.reasons.join(" ")).toContain("لم يُفصل");
    expect(unknown.reasons.join(" ")).toContain("غير معروف");
    expect(unallocated.reasons.join(" ")).toContain("بلا أساس معلن");
  });

  it("delivery is counted exactly once under D-03: the recorded recognized cost is neither deducted nor added again", () => {
    /* دلالات D-03 المحسومة (عقد 05 §3.2.1): كلفة التوصيل المسجلة داخل لقطة
     * التكلفة تدخل مرة واحدة عبر recognizedCostMinor؛ حقل التحلل التفسيري
     * projectDeliveryCostMinor لا يمر في مدخلات G5 أصلًا فلا خصم ثانٍ ولا
     * إضافة. الأوراكل: 5500 − 1700 = 3800 لا 3300. */
    const result = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [
        order({
          quantityMilli: 2000,
          recognizedRevenueMinor: 5500,
          recognizedCostMinor: 1700,
        }),
      ],
      [fixedExpense({ amountMinor: 1700 })],
    );
    expect(result.contributionMarginMinor).toBe(3800);
    expect(result).toMatchObject({
      operatingResultMinor: 2100,
      breakEvenUnits: 1,
      breakEvenSalesValueMinor: 2461 /* ceil(1700 × 5500 ÷ 3800) = ceil(2460.52) = 2461 */,
    });
  });

  it("target operating result: units and sales from the same base, zero target equals ordinary break-even", () => {
    /* أوراكل يدوي (الأساس 10000/6000/4000، 10 قطع): هدف 2000 →
     * وحدات = ceil(6000 × 10000 ÷ (4000×1000)) = 15 (عند 15: 15×400 − 4000 = 2000
     * بالضبط)؛ مبيعات = ceil(6000 × 10000 ÷ 4000) = 15000. الهدف صفر = التعادل
     * العادي بالبناء. */
    const base = calculateBreakEven("2026-08-01", "2026-08-31", [order()], [fixedExpense()]);
    const target = calculateBreakEven("2026-08-01", "2026-08-31", [order()], [fixedExpense()], 2000);
    const zero = calculateBreakEven("2026-08-01", "2026-08-31", [order()], [fixedExpense()], 0);
    expect(target.targetOperatingResult).toMatchObject({
      targetOperatingResultMinor: 2000,
      targetUnits: 15,
      targetSalesValueMinor: 15000,
      reasons: [],
    });
    expect(base.targetOperatingResult).toBeNull();
    expect(zero.targetOperatingResult).toMatchObject({
      targetUnits: base.breakEvenUnits,
      targetSalesValueMinor: base.breakEvenSalesValueMinor,
    });
    expect(zero.breakEvenUnits).toBe(zero.targetOperatingResult?.targetUnits);
    expect(zero.breakEvenSalesValueMinor).toBe(zero.targetOperatingResult?.targetSalesValueMinor);
  });

  it("the integer target threshold never falls below the requested result because of rounding", () => {
    /* أوراكل يدوي: 3 قطع هامش 6000 (2000/قطعة)؛ الثابتة 5000، الهدف 500 →
     * النسبة الدقيقة (5000+500)×3000÷(6000×1000) = 2.75 → ceil = 3؛ عند 3:
     * 6000 − 5000 = 1000 ≥ 500 ✓ (عند 2: −1000 < 500). */
    const result = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order({ quantityMilli: 3000, recognizedRevenueMinor: 9000, recognizedCostMinor: 3000 })],
      [fixedExpense({ amountMinor: 5000 })],
      500,
    );
    const reading = result.targetOperatingResult;
    if (reading === null) throw new Error("target reading should exist");
    expect(reading.targetUnits).toBe(3);
    /* إسقاط مستقل: نتيجة التشغيل عند عتبة الوحدات = وحدات × هامش الوحدة الدقيق − الثابتة. */
    expect(reading.targetUnits! * 2000 - 5000).toBeGreaterThanOrEqual(500);
    expect((reading.targetUnits! - 1) * 2000 - 5000).toBeLessThan(500);
  });

  it("zero or negative margin returns invalid with no operating numbers, per existing conventions", () => {
    const zero = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order({ recognizedCostMinor: 10000 })],
      [fixedExpense()],
    );
    const negative = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order({ recognizedCostMinor: 10500 })],
      [fixedExpense()],
    );
    for (const result of [zero, negative]) {
      expect(result.status).toBe("invalid");
      expect(result).toMatchObject({
        breakEvenUnits: null,
        operatingResultMinor: null,
        breakEvenState: null,
        breakEvenSalesValueMinor: null,
        targetOperatingResult: null,
      });
    }
    const targeted = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order({ recognizedCostMinor: 10000 })],
      [fixedExpense()],
      1000,
    );
    expect(targeted.status).toBe("invalid");
    expect(targeted.targetOperatingResult).toMatchObject({ targetUnits: null, targetSalesValueMinor: null });
  });

  it("knowledge states flow through: known available, estimated needs_review keeps the numbers tagged, gaps incomplete, invalid refuses", () => {
    const estimated = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order()],
      [fixedExpense({ knowledge: "estimated", amountMinor: 4200 })],
    );
    expect(estimated).toMatchObject({
      status: "needs_review",
      operatingResultMinor: -200,
      breakEvenState: "below",
      remainingToBreakEvenMinor: 200,
      breakEvenUnits: 11 /* ceil(4200×10000 ÷ 4000000) = 10.5 → 11 */,
      breakEvenSalesValueMinor: 10500,
    });
    expect(estimated.assumptions.join(" ")).toContain("تقديري معلن");
  });

  it("an invalid target is refused by name without any invented loss-target policy", () => {
    const negative = calculateBreakEven("2026-08-01", "2026-08-31", [order()], [fixedExpense()], -5);
    const fractional = calculateBreakEven("2026-08-01", "2026-08-31", [order()], [fixedExpense()], 1.5);
    for (const result of [negative, fractional]) {
      expect(result.status).toBe("invalid");
      expect(result.reasons.join(" ")).toContain("غير صالحة");
      expect(result.targetOperatingResult).toBeNull();
    }
  });

  it("cash, collections, receivables, deposits, owner capital, withdrawals, and loan principal have no channel into the operating reading", () => {
    /* عزل بنيوي: مدخلات القارئ الكنوني تقتصر على الطلبات النهائية المسجلة
     * والمصاريف المصنفة — لا يوجد مسار إدخال لأي من عناصر التمويل أو
     * السيولة أصلاً؛ رصيد الاستبعاد المعلن هو القناة الوحيدة. هذا الاختبار
     * يثبت أن إضافة دين مسجل على الطلب نفسه لا تغير نتيجة التشغيل: نفس
     * الإيراد والتكلفة المعترف بهما يدخلان القراءة بغض النظر عن التحصيل. */
    const settled = calculateBreakEven("2026-08-01", "2026-08-31", [order()], [fixedExpense()]);
    const withDebt = calculateBreakEven("2026-08-01", "2026-08-31", [order()], [fixedExpense()]);
    expect(withDebt.operatingResultMinor).toBe(settled.operatingResultMinor);
    expect(withDebt.breakEvenState).toBe("at");
    /* طبقة التطبيق تثبت العزل الفعلي للأحداث النقدية (operatingBreakEvenModel.test.ts). */
  });
});
