import { describe, expect, it } from "vitest";
import { calculateCostSnapshot } from "../../src/domain/craft-order/index.js";
import { calculateSharedProjectShareMinor } from "../../src/domain/financial-event/index.js";
import { perOutputUnitAmountMinor } from "../../src/domain/recurring-margin/index.js";
import { ceilRatio, floorRatio, roundHalfUp } from "../../src/domain/shared/index.js";

/*
 * المجموعة ١٠ (المرحلة 10-0): تثبيت توصيفي لحدود التقريب الرقمي الحالية.
 *
 * نتيجة تحقيق التقريب (اقرأ تقرير المجموعة ١٠ و§39 من current-state): كل قسم
 * المال المحسوب/المخزن يستخدم أصلًا حسابًا صحيحًا بوحدات minor مع تقريب نهائي
 * واحد «نصف-أعلى بعيدًا عن الصفر» (roundHalfUp)، ولا توجد سياسة بديلة معتمدة
 * من المالك — القرار الموثق: **الإبقاء على السلوك الحالي الآن** (لا رقعة في
 * 10-R). هذه الاختبارات تُثبّت الحدود الحالية كما هي، فأي تغيير مستقبلي في
 * قاعدة التقريب يجب أن يمر بقرار مالك صريح ويكسر هذه الحدود بوعي.
 *
 * كمية 1.001 = 1001 ملي (قراءة) تبقى عقدًا مستقلًا معتمدًا — مثبتة في
 * tests/domain/quantity-characterization.test.ts ولا تُعاد هنا.
 */
describe("Group 10 shared-helper rounding boundaries (Phase 10-0: preserve current behavior)", () => {
  it("roundHalfUp resolves exact halves away from zero on both signs", () => {
    /* النصف الموجب: 0.5 → 1 و1.5 → 2 (نصف-أعلى). */
    expect(roundHalfUp(5, 10)).toBe(1);
    expect(roundHalfUp(15, 10)).toBe(2);
    /* النصف السالب: −0.5 → −1 و−1.5 → −2 — بعيدًا عن الصفر، متناظر
     * مع الموجب (الهامش السالب في g5 يمر من هنا). */
    expect(roundHalfUp(-5, 10)).toBe(-1);
    expect(roundHalfUp(-15, 10)).toBe(-2);
    /* تحت النصف وفوقه: 0.4 → 0، 0.6 → 1، 1.4 → 1، 1.6 → 2. */
    expect(roundHalfUp(4, 10)).toBe(0);
    expect(roundHalfUp(6, 10)).toBe(1);
    expect(roundHalfUp(14, 10)).toBe(1);
    expect(roundHalfUp(16, 10)).toBe(2);
  });

  it("roundHalfUp keeps zero, the safe-integer boundary, and refusal contracts", () => {
    /* الصفر والمقادير الكبيرة داخل النطاق الآمن. */
    expect(roundHalfUp(0, 10)).toBe(0);
    expect(roundHalfUp(Number.MAX_SAFE_INTEGER - 5, 10)).toBe(900719925474099);
    /* المدخلات غير الآمنة تُرفض بلا استثناء صامت: مقام صفر، كسور، خارج النطاق. */
    expect(roundHalfUp(1, 0)).toBeNull();
    expect(roundHalfUp(0.5, 1)).toBeNull();
    expect(roundHalfUp(1, 0.5)).toBeNull();
    expect(roundHalfUp(9007199254740992, 2)).toBeNull();
    /* أكبر عدد آمن مقسومًا على اثنين = نصف صحيح تمامًا عند الحد: (2^53−1)/2
     * = 4503599627370495.5 → النصف-أعلى يعطي 2^52 — داخل النطاق الآمن. */
    expect(roundHalfUp(Number.MAX_SAFE_INTEGER, 2)).toBe(4503599627370496);
  });

  it("floorRatio and ceilRatio keep their directed contracts at the boundaries", () => {
    /* الأرضي يقبل السالب (معنى أرضي)، والسقفي يرفض البسط السالب (عقد موثق:
     * ceilRatio للاستخدامات غير السالبة فقط كسعر الأرضية ووحدات التعادل). */
    expect(floorRatio(-1, 10)).toBe(-1);
    expect(floorRatio(5, 10)).toBe(0);
    expect(floorRatio(100, 3)).toBe(33);
    expect(ceilRatio(-1, 10)).toBeNull();
    expect(ceilRatio(4, 10)).toBe(1);
    expect(ceilRatio(5, 10)).toBe(1);
    /* إهلاك الأصل شهريًا أرضي (الشهر الأخير يجمع الباقي)، والتعادل سقفي
     * (يجب تغطية الوحدة كاملة) — السببان الموثقان للتقريب الموجّه. */
    expect(floorRatio(100, 3)).toBe(33);
    expect(ceilRatio(1000, 3)).toBe(334);
  });
});

describe("Group 10 domain-integration rounding boundaries (Phase 10-0: preserve current behavior)", () => {
  it("shared project share resolves the exact bps half upward once at the boundary", () => {
    /* 100.00 د.أ × 50.50% = 50.50 قرشًا → 51 (نصف-أعلى، تقريب نهائي واحد
     * داخل calculateSharedProjectShareMinor عبر roundHalfUp(x, 10_000). */
    expect(calculateSharedProjectShareMinor(100, 5050)).toBe(51);
    /* 49.50 → 50: النصف دائمًا للأعلى بلا اعتماد على إشارة البسط هنا. */
    expect(calculateSharedProjectShareMinor(100, 4950)).toBe(50);
  });

  it("per-output-unit allocation rounds once, half-up, and declares its computed zero", () => {
    /* 1.500 وحدة × 1.001 د.أ/وحدة = 1501.5 قروش خام → 1502 (نصف-أعلى). */
    expect(perOutputUnitAmountMinor(1500, 1001)).toEqual({ amountMinor: 1502 });
    /* 1.500 × 0.999 = 1498.5 → 1499. */
    expect(perOutputUnitAmountMinor(1500, 999)).toEqual({ amountMinor: 1499 });
    /* 0.001 وحدة × 0.01 د.أ = 0.001 قرش → 0: صفر محسوب معلن في نص المنتج،
     * ليس غياب بيانات — السلوك مثبت كما هو. */
    expect(perOutputUnitAmountMinor(1, 1)).toEqual({ amountMinor: 0 });
  });

  it("craft-order unit cost keeps its ceiling contract, including the documented fractional FP boundary", () => {
    /* المسارات الإنتاجية (DraftEditor/CostCalculator) لا ترسل إلا كميات
     * صحيحة، فالقسمة الصحيحة/الصحيحة دقيقة في الفاصلة العائمة: 21/1 = 21. */
    const integerPath = calculateCostSnapshot("rounding-freeze-int", {
      currency: "JOD",
      materialItems: [],
      time: null,
      packagingMinor: 21,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-09-12T00:00:00Z",
      source: "draft",
    });
    expect(integerPath.unitCostMinor).toBe(21);
    /* المجموعة ١١ (11-0 — سياسة القيم الدقيقة المعتمدة): الحد الكسري
     * 21/0.7 = 30 بالضبط حسابيًا، والاشتقاق بالملي الصحيح
     * ceilRatio(21×1000، 700) يعطي 30 — كانت قسمة الفاصلة العائمة تعطي
     * 30.000000000000004 فترفع السقف إلى 31 فأُزيلت (تقسية M4.1 في
     * مصفوفة قرار المجموعة ١٠ — نفذتها سياسة المالك المعتمدة). */
    const fractionalBoundary = calculateCostSnapshot("rounding-freeze-frac", {
      currency: "JOD",
      materialItems: [],
      time: null,
      packagingMinor: 21,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 0.7,
      createdAt: "2026-09-12T00:00:00Z",
      source: "draft",
    });
    expect(fractionalBoundary.unitCostMinor).toBe(30);
  });
});
