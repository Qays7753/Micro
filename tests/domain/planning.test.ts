/**
 * S10 (UNIT-030/031/032 + SH-14 — أمر b56967d8): اختبارات عائلة التخطيط النقية.
 *
 * تغطي أمثلة القبول المعتمدة حرفيًا:
 *  - مثال المالك (10 صناديق بمكونات 7 وسعر 10): CP 70 / SP 100 / G 30 / هامش 30%
 *    «بحسب التكاليف المدرجة» (U031-AC03)؛
 *  - المثال الشامل (بيع 100 وتكلفة 70 وإيراد 5 ومصروف 2 وتوصيل 3):
 *    T 105 / CT 75 / G 30 / هامش 28.57% (U031-AC17)؛
 *  - المنتج الثاني (2×8 و2×12): T 129 / CT 91 / G 38 / هامش 29.46% بلا متوسط
 *    نسب (U031-AC18)؛
 *  - SDF-002: إجمالي 10.00 لكمية 3 يبقى 1000 minor — حصة الوحدة عرض لا يعاد
 *    ضربه؛
 *  - هامش البيع ≠ زيادة التكلفة: تكلفة 9 → هامش 25% يعطي 12 وزيادة 25% تعطي
 *    11.25 (U031-AC11)؛
 *  - T02: 300 ÷ (20×5) = 3 (U030-AC03) وحالات الصفر/غير الصالح (U030-AC04)؛
 *  - T03: 10/6/200 ⇒ 50 وهدف 100 ⇒ 75 (U030-AC05)؛ 50.1 ⇒ 51 (U030-AC06)؛
 *    السعر ≤ التكلفة غير قابل للتغطية (U030-AC07)؛ الثابت 0 (U030-AC08)؛
 *  - T04: 80×25% = 20 و2/8 من 80 = 20 و0/100/>100/إجمالي 0 (U030-AC10..12)؛
 *  - T05: ثلاثة أقسام بلا درجة والإجابات الفارغة دعوة لسؤال أول (U030-AC14/15).
 */
import { describe, expect, it } from "vitest";
import {
  calculateHourValue,
  calculateInvoiceShare,
  calculatePlanningResult,
  calculateSalesQuantity,
  reviewIdea,
  suggestSellingPrice,
  type PlanningCalculationInput,
  type PlanningGroup,
} from "../../src/domain/planning/index.js";

const CREATED_AT = "2026-10-31T09:00:00.000Z";

function detailsGroup(overrides: Partial<PlanningGroup> = {}): PlanningGroup {
  return {
    id: "g-1",
    label: "صندوق هدايا",
    offeringType: "product",
    repeatQuantity: 10,
    costMode: "details",
    unitComponents: [
      { name: "صندوق خشب", quantity: 1, unit: "قطعة", unitPriceMinor: 200, confidence: "known" },
      { name: "شوكولاتة", quantity: 2, unit: "حبة", unitPriceMinor: 50, confidence: "known" },
      { name: "لعبة", quantity: 1, unit: "قطعة", unitPriceMinor: 300, confidence: "known" },
      { name: "وردة", quantity: 1, unit: "قطعة", unitPriceMinor: 100, confidence: "known" },
    ],
    totalCostMinor: null,
    sellingPriceMinor: 1000,
    ...overrides,
  };
}

function baseInput(
  groups: readonly PlanningGroup[],
  overrides: Partial<PlanningCalculationInput> = {},
): PlanningCalculationInput {
  return {
    title: "صناديق المناسبة",
    groups,
    time: null,
    packagingMinor: 0,
    wasteMinor: 0,
    deliveryMinor: 0,
    otherRevenues: [],
    otherExpenses: [],
    discount: null,
    commission: null,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

describe("S10 T01 — حساب التخطيط عبر النواة الواحدة", () => {
  it("مثال المالك: 10 صناديق بمكونات 7 وسعر 10 ⇒ CP 7000 وSP 10000 وربح 3000 وهامش 30% (U031-AC03)", () => {
    const result = calculatePlanningResult("planning-1", baseInput([detailsGroup()]));
    expect(result.productsCostMinor).toBe(7000);
    expect(result.sellingTotalMinor).toBe(10000);
    expect(result.expectedTotalMinor).toBe(10000);
    expect(result.pricingCostMinor).toBe(7000);
    expect(result.expectedProfitMinor).toBe(3000);
    expect(result.marginPercentCenti).toBe(3000);
    /* الوقت غير مُدخل ⇒ معرفة النواة «ناقصة» بصدق (وقتك غير مشمول) — الأرقام
     * صحيحة «بحسب التكاليف المدرجة» كما في عقد 031. */
    expect(result.knowledgeState).toBe("incomplete");
    expect(result.knowledgeGaps.some(gap => gap.id === "time_incomplete" && gap.mandatory)).toBe(true);
    expect(result.unitCostMinor).toBe(700);
  });

  it("مع وقت كامل معلوم ⇒ معرفة «معروفة» كاملة عبر النواة نفسها", () => {
    const result = calculatePlanningResult(
      "planning-1b",
      baseInput([detailsGroup()], {
        time: { minutes: 120, hourlyRateMinor: 3000, confidence: "known" },
      }),
    );
    expect(result.knowledgeState).toBe("known");
    expect(result.pricingCostMinor).toBe(7000 + 6000);
  });
});

describe("S10 T01 — الأمثلة الشاملة والمستويات", () => {
  it("المثال الشامل: توصيل 3 وإيراد 5 ومصروف 2 ⇒ T 10500 وCT 7500 وربح 3000 وهامش 28.57% (U031-AC17)", () => {
    const result = calculatePlanningResult(
      "planning-2",
      baseInput([detailsGroup()], {
        deliveryMinor: 300,
        otherRevenues: [{ id: "r-1", amountMinor: 500, description: "خدمة إضافية" }],
        otherExpenses: [{ id: "e-1", amountMinor: 200, description: " تغليف خاص" }],
      }),
    );
    expect(result.expectedTotalMinor).toBe(10500);
    expect(result.pricingCostMinor).toBe(7500);
    expect(result.expectedProfitMinor).toBe(3000);
    expect(result.marginPercentCenti).toBe(2857);
  });
});

describe("S10 T01 — مثال المنتج الثاني", () => {
  it("المنتج الثاني 2×8 و2×12 ⇒ T 12900 وCT 9100 وربح 3800 وهامش 29.46% بلا متوسط نسب (U031-AC18)", () => {
    const second: PlanningGroup = {
      id: "g-2",
      label: "صندوق فخم",
      offeringType: "product",
      repeatQuantity: 2,
      costMode: "total",
      unitComponents: [],
      totalCostMinor: 1600,
      sellingPriceMinor: 1200,
    };
    const result = calculatePlanningResult(
      "planning-3",
      baseInput([detailsGroup(), second], {
        deliveryMinor: 300,
        otherRevenues: [{ id: "r-1", amountMinor: 500, description: null }],
        otherExpenses: [{ id: "e-1", amountMinor: 200, description: null }],
      }),
    );
    expect(result.productsCostMinor).toBe(8600);
    expect(result.sellingTotalMinor).toBe(12400);
    expect(result.expectedTotalMinor).toBe(12900);
    expect(result.pricingCostMinor).toBe(9100);
    expect(result.expectedProfitMinor).toBe(3800);
    expect(result.marginPercentCenti).toBe(2946);
    /* لا متوسط لنسب المجموعتين: النسبة من الإجماليين لا (30%+50%)/2 */
    expect(result.groupResults.map(group => group.groupCostMinor)).toEqual([7000, 1600]);
    expect(result.groupResults.map(group => group.groupSellingMinor)).toEqual([10000, 2400]);
  });

  it("SDF-002: إجمالي 10.00 لكمية 3 يبقى 1000 minor — حصة الوحدة عرض لا يعاد ضربه", () => {
    const totalGroup: PlanningGroup = {
      id: "g-1",
      label: "دفعات عجينة",
      offeringType: "product",
      repeatQuantity: 3,
      costMode: "total",
      unitComponents: [],
      totalCostMinor: 1000,
      sellingPriceMinor: null,
    };
    const result = calculatePlanningResult("planning-sdf002", baseInput([totalGroup]));
    expect(result.productsCostMinor).toBe(1000);
    expect(result.pricingCostMinor).toBe(1000);
    /* حصة الوحدة 1000/3 = 3.34 بحد السقف — عرض فقط؛ الأصل 1000 لا 1002 */
    expect(result.unitCostMinor).toBe(334);
    expect(result.groupResults[0]?.groupCostMinor).toBe(1000);
    /* السعر غير محدد ⇒ لا إجمالي متوقع ولا ربح ولا هامش — لا صفر مضلل */
    expect(result.sellingTotalMinor).toBeNull();
    expect(result.expectedTotalMinor).toBeNull();
    expect(result.expectedProfitMinor).toBeNull();
    expect(result.marginPercentCenti).toBeNull();
  });
});

describe("S10 T01 — سلوك المجموعات والمعرفة", () => {
  it("تكرار المجموعة يطبق مرة واحدة: 2 شوكولاتة ×0.50 للوحدة ×10 صناديق ⇒ 1000 minor للشوكولاتة (U031-AC06)", () => {
    const result = calculatePlanningResult("planning-4", baseInput([detailsGroup()]));
    /* المكونات: خشب 10×200=2000 + شوكولاتة 20×50=1000 + لعبة 10×300=3000 + وردة 10×100=1000 = 7000 */
    expect(result.productsCostMinor).toBe(7000);
  });

  it("تغيير العدد لا يضرب مستويات الحساب: توصيل 3 يبقى 3 عند أي تكرار (U031-AC05)", () => {
    const result = calculatePlanningResult(
      "planning-5",
      baseInput([detailsGroup({ repeatQuantity: 100 })], {
        deliveryMinor: 300,
      }),
    );
    expect(result.deliveryMinor).toBe(300);
    expect(result.pricingCostMinor).toBe(70000 + 300);
  });
});

describe("S10 T01 — اقتراح السعر والخصم والعمولة", () => {
  it("هامش البيع ≠ زيادة التكلفة: تكلفة 900 مع هدف مبلغ 300 ⇒ 1200؛ هامش 25% ⇒ 1200؛ زيادة 25% ⇒ 1125 (U031-AC11)", () => {
    expect(suggestSellingPrice(900, { kind: "amount", amountMinor: 300 })).toBe(1200);
    expect(suggestSellingPrice(900, { kind: "margin", marginPercentCenti: 2500 })).toBe(1200);
    expect(suggestSellingPrice(900, { kind: "markup", markupPercentCenti: 2500 })).toBe(1125);
  });

  it("هامش 100% أو أكثر يرفض بلا قسمة صفر — يطلب التصحيح (U031-AC12)", () => {
    expect(() => suggestSellingPrice(900, { kind: "margin", marginPercentCenti: 10000 })).toThrow(
      "لا يمكن حساب سعر بهامش 100% أو أكثر",
    );
  });

  it("الخصم على قيمة المنتجات قبل الإضافات: خصم 10% على بيع 100 وإيراد 5 ⇒ منتجات 90 وإجمالي 95 (U031-AC24)", () => {
    const result = calculatePlanningResult(
      "planning-6",
      baseInput([detailsGroup()], {
        otherRevenues: [{ id: "r-1", amountMinor: 500, description: null }],
        discount: { mode: "percent", percentCenti: 1000 },
      }),
    );
    expect(result.discountMinor).toBe(1000);
    expect(result.productsSellingMinor).toBe(9000);
    expect(result.expectedTotalMinor).toBe(9500);
  });
});

describe("S10 T01 — تجربة السعر والحدود الصادقة", () => {
  it("خصم أكبر من قيمة المنتجات يُرفض — لا مبلغ أكبر من الأصل", () => {
    expect(() =>
      calculatePlanningResult(
        "planning-7",
        baseInput([detailsGroup()], {
          discount: { mode: "amount", amountMinor: 10001 },
        }),
      ),
    ).toThrow("أكبر من قيمة المنتجات");
  });

  it("العمولة بأساس معلن: 5% على أساس المنتجات 100 ⇒ 5 وعلى أساس الإجمالي 105 ⇒ 5.25 — ولا تتكرر ضمن E (U031-AC25)", () => {
    const products = calculatePlanningResult(
      "planning-8",
      baseInput([detailsGroup()], {
        otherRevenues: [{ id: "r-1", amountMinor: 500, description: null }],
        commission: { mode: "percent", percentCenti: 500, basis: "products_after_discount" },
      }),
    );
    expect(products.commissionMinor).toBe(500);
    /* CT = 7000 تكلفة + 500 عمولة (مرة واحدة) — لا مصاريف إضافية */
    expect(products.pricingCostMinor).toBe(7500);

    const orderTotal = calculatePlanningResult(
      "planning-9",
      baseInput([detailsGroup()], {
        otherRevenues: [{ id: "r-1", amountMinor: 500, description: null }],
        commission: { mode: "percent", percentCenti: 500, basis: "order_total" },
      }),
    );
    expect(orderTotal.commissionMinor).toBe(525);
    expect(orderTotal.pricingCostMinor).toBe(7525);
  });

  it("T = 0 لا يعطي نسبة: بيع 0 مع تكلفة معلومة ⇒ ربح سالب معلون وهامش null (U031-AC23)", () => {
    const result = calculatePlanningResult(
      "planning-10",
      baseInput([detailsGroup({ sellingPriceMinor: 0 })]),
    );
    expect(result.expectedTotalMinor).toBe(0);
    expect(result.expectedProfitMinor).toBe(-7000);
    expect(result.marginPercentCenti).toBeNull();
  });
});

describe("S10 T01 — المعرفة الصادقة والمدخلات الناقصة", () => {
  it("مكوّن مسمى بلا سعر يظل «غير محدد بعد» مستبعدًا — لا صفر ولا إسقاط صامت (B1)", () => {
    const group = detailsGroup({
      unitComponents: [
        ...detailsGroup().unitComponents,
        { name: "شريط ساتان", quantity: 1, unit: "متر", unitPriceMinor: 0, confidence: "known" },
      ],
    });
    const result = calculatePlanningResult("planning-11", baseInput([group]));
    expect(result.productsCostMinor).toBe(7000);
    expect(result.excludedComponentNames).toEqual(["شريط ساتان"]);
  });

  it("لا مجموعات ⇒ خطأ صريح؛ ومجموعات بلا أي تكلفة معلومة ⇒ معرفة ناقصة صادقة", () => {
    expect(() => calculatePlanningResult("planning-12", baseInput([]))).toThrow("مجموعة واحدة على الأقل");
    const empty = calculatePlanningResult(
      "planning-13",
      baseInput([detailsGroup({ unitComponents: [], sellingPriceMinor: null })]),
    );
    expect(empty.knowledgeState).toBe("incomplete");
    expect(empty.knowledgeGaps.some(gap => gap.id === "no_cost_components")).toBe(true);
  });

  it("هوية مجموعة مكررة ترفض — لا تكرار صامت للمعرف", () => {
    expect(() => calculatePlanningResult("planning-14", baseInput([detailsGroup(), detailsGroup()]))).toThrow(
      "مكررة",
    );
  });

  it("وقت المالك تقدير تسعيري فقط: 30 دقيقة بأجر 400 ⇒ 200 ضمن CT ولا أي أثر آخر (U031-AC07)", () => {
    const result = calculatePlanningResult(
      "planning-15",
      baseInput([detailsGroup()], {
        time: { minutes: 30, hourlyRateMinor: 400, confidence: "estimated" },
      }),
    );
    expect(result.pricingCostMinor).toBe(7200);
    expect(result.knowledgeState).toBe("estimated");
  });
});

describe("S10 T02 — قيمة ساعة العمل", () => {
  it("300 ÷ (20×5) = 3 د.أ للساعة (U030-AC03)", () => {
    const result = calculateHourValue({
      monthlyCompensationMinor: 300000,
      workDaysPerMonth: 20,
      productiveHoursPerDay: 5,
    });
    expect(result.monthlyHours).toBe(100);
    expect(result.hourValueMinor).toBe(3000);
  });

  it("المقابل 0 يعطي 0 مع بقاء الحساب صالحًا — لا مجهولًا", () => {
    const result = calculateHourValue({
      monthlyCompensationMinor: 0,
      workDaysPerMonth: 20,
      productiveHoursPerDay: 5,
    });
    expect(result.hourValueMinor).toBe(0);
  });

  it("أيام 0 أو ساعات 0 أو مدخلات سالبة ترفض — لا قسمة صفر ولا تحويل الفراغ لصفر (U030-AC04)", () => {
    expect(() =>
      calculateHourValue({ monthlyCompensationMinor: 300000, workDaysPerMonth: 0, productiveHoursPerDay: 5 }),
    ).toThrow();
    expect(() =>
      calculateHourValue({
        monthlyCompensationMinor: 300000,
        workDaysPerMonth: 20,
        productiveHoursPerDay: 0,
      }),
    ).toThrow();
    expect(() =>
      calculateHourValue({ monthlyCompensationMinor: -1, workDaysPerMonth: 20, productiveHoursPerDay: 5 }),
    ).toThrow();
    expect(() =>
      calculateHourValue({
        monthlyCompensationMinor: 300000,
        workDaysPerMonth: 20,
        productiveHoursPerDay: 25,
      }),
    ).toThrow();
  });
});

describe("S10 T02 — حالات حدود قيمة الساعة", () => {
  it("ساعات كسرية مدعومة بدقة أجزاء الألف: 300 على (15×4.5=67.5) ⇒ 4.44", () => {
    const result = calculateHourValue({
      monthlyCompensationMinor: 300000,
      workDaysPerMonth: 15,
      productiveHoursPerDay: 4.5,
    });
    expect(result.monthlyHours).toBe(67.5);
    /* 300000×1000/67500 = 4444.4 ⇒ 4444 minor = 4.44 */
    expect(result.hourValueMinor).toBe(4444);
  });
});

describe("S10 T03 — كمية البيع المطلوبة", () => {
  it("سعر 10 وتكلفة 6 وثابت 200 ⇒ 50 وحدة؛ هدف 100 ⇒ 75 وحدة (U030-AC05)", () => {
    const result = calculateSalesQuantity({
      periodLabel: "شهر",
      unitSellingPriceMinor: 1000,
      unitVariableCostMinor: 600,
      fixedExpensesMinor: 20000,
      targetProfitMinor: 10000,
    });
    expect(result.computable).toBe(true);
    if (!result.computable) return;
    expect(result.unitContributionMinor).toBe(400);
    expect(result.coverageQuantity).toBe(50);
    expect(result.targetQuantity).toBe(75);
    expect(result.coverageRoundedUp).toBe(false);
  });

  it("نتيجة كسرية 50.1 ⇒ 51 وحدة مع بيان التقريب لأعلى (U030-AC06)", () => {
    const result = calculateSalesQuantity({
      periodLabel: "شهر",
      unitSellingPriceMinor: 1000,
      unitVariableCostMinor: 600,
      fixedExpensesMinor: 20040,
      targetProfitMinor: null,
    });
    expect(result.computable).toBe(true);
    if (!result.computable) return;
    expect(result.coverageQuantity).toBe(51);
    expect(result.coverageRoundedUp).toBe(true);
  });

  it("السعر ≤ تكلفة الوحدة ⇒ غير قابل للتغطية بهذه المدخلات — لا عدد مضلل (U030-AC07)", () => {
    const equal = calculateSalesQuantity({
      periodLabel: "شهر",
      unitSellingPriceMinor: 600,
      unitVariableCostMinor: 600,
      fixedExpensesMinor: 2000,
      targetProfitMinor: null,
    });
    expect(equal).toEqual({ computable: false, reason: "non_positive_contribution" });
    const below = calculateSalesQuantity({
      periodLabel: "شهر",
      unitSellingPriceMinor: 500,
      unitVariableCostMinor: 600,
      fixedExpensesMinor: 2000,
      targetProfitMinor: null,
    });
    expect(below).toEqual({ computable: false, reason: "non_positive_contribution" });
  });
});

describe("S10 T03 — حالات حدود الكمية", () => {
  it("ثابت 0 ومساهمة موجبة ⇒ تغطية 0 والهدف يحسب مستقلًا (U030-AC08)", () => {
    const result = calculateSalesQuantity({
      periodLabel: "شهر",
      unitSellingPriceMinor: 1000,
      unitVariableCostMinor: 600,
      fixedExpensesMinor: 0,
      targetProfitMinor: 12000,
    });
    expect(result.computable).toBe(true);
    if (!result.computable) return;
    expect(result.coverageQuantity).toBe(0);
    expect(result.targetQuantity).toBe(30);
  });

  it("سعر 0 أو سالب يرفض — لا قسمة على صفر", () => {
    expect(() =>
      calculateSalesQuantity({
        periodLabel: "شهر",
        unitSellingPriceMinor: 0,
        unitVariableCostMinor: 600,
        fixedExpensesMinor: 2000,
        targetProfitMinor: null,
      }),
    ).toThrow("أكبر من صفر");
  });
});

describe("S10 T04 — نصيب المشروع من فاتورة مشتركة", () => {
  it("فاتورة 80 ونسبة 25% ⇒ نصيب 20 ومتبقي 60 بأساس ظاهر (U030-AC10)", () => {
    const result = calculateInvoiceShare({ method: "percent", billTotalMinor: 8000, percentCenti: 2500 });
    expect(result.shareMinor).toBe(2000);
    expect(result.remainingMinor).toBe(6000);
    expect(result.basis).toEqual({ kind: "percent", billTotalMinor: 8000, percentCenti: 2500 });
  });

  it("جزء 2 من إجمالي 8 لفاتورة 80 ⇒ 20 (U030-AC11)", () => {
    const result = calculateInvoiceShare({
      method: "usage",
      billTotalMinor: 8000,
      projectUsage: 2,
      totalUsage: 8,
    });
    expect(result.shareMinor).toBe(2000);
    expect(result.basis).toEqual({ kind: "usage", billTotalMinor: 8000, projectUsage: 2, totalUsage: 8 });
  });

  it("نسبة 0 تعطي 0 ونسبة 100 تعطي كامل الفاتورة (U030-AC12)", () => {
    expect(
      calculateInvoiceShare({ method: "percent", billTotalMinor: 8000, percentCenti: 0 }).shareMinor,
    ).toBe(0);
    expect(
      calculateInvoiceShare({ method: "percent", billTotalMinor: 8000, percentCenti: 10000 }).shareMinor,
    ).toBe(8000);
  });

  it("نسبة فوق 100 أو إجمالي استخدام 0 أو مشروع أكبر من الإجمالي ترفض (U030-AC12)", () => {
    expect(() =>
      calculateInvoiceShare({ method: "percent", billTotalMinor: 8000, percentCenti: 10001 }),
    ).toThrow();
    expect(() =>
      calculateInvoiceShare({ method: "usage", billTotalMinor: 8000, projectUsage: 2, totalUsage: 0 }),
    ).toThrow();
    expect(() =>
      calculateInvoiceShare({ method: "usage", billTotalMinor: 8000, projectUsage: 9, totalUsage: 8 }),
    ).toThrow();
  });
});

describe("S10 T05 — فحص الفكرة الأولي", () => {
  it("إجابات ناقصة: تعرض المحدد والناقص وخطوة تحقق — بلا تقييم نجاح (U030-AC14)", () => {
    const result = reviewIdea({
      whatToSell: "صناديق هدايا مخصصة",
      whoBuys: null,
      costAndPrice: null,
      firstCustomerReach: "إنستغرام",
      whatToVerify: null,
    });
    expect(result.defined).toEqual([
      { question: "ماذا ستبيع أو تقدم؟", answer: "صناديق هدايا مخصصة" },
      { question: "كيف ستصل لأول عميل؟", answer: "إنستغرام" },
    ]);
    expect(result.needsClarification).toEqual([
      "من سيشتري؟",
      "كم تتوقع تكلفة الوحدة وسعرها؟",
      "ما الذي تحتاج التأكد منه قبل البدء؟",
    ]);
    /* خطوة التحقق وفق الناقص: سؤال عميل محتمل */
    expect(result.nextStep).toContain("عميل");
  });

  it("كل الإجابات فارغة ⇒ دعوة لسؤال أول لا ملخص مصطنع (U030-AC15)", () => {
    const result = reviewIdea({
      whatToSell: null,
      whoBuys: null,
      costAndPrice: null,
      firstCustomerReach: null,
      whatToVerify: null,
    });
    expect(result.defined).toEqual([]);
    expect(result.needsClarification).toHaveLength(5);
    expect(result.nextStep).toContain("ماذا ستبيع أو تقدم؟");
  });

  it("الإجابات الكاملة تعطي خطوة تحقق تالية وليس حكم جدوى", () => {
    const result = reviewIdea({
      whatToSell: "صناديق هدايا",
      whoBuys: "أهالي المدرسة",
      costAndPrice: "تكلفة 7 وسعر 10",
      firstCustomerReach: "إنستغرام",
      whatToVerify: "تكلفة التغليف الفعلية",
    });
    expect(result.defined).toHaveLength(5);
    expect(result.needsClarification).toEqual([]);
    expect(result.nextStep).toContain("أول نسخة فعلية");
    /* لا درجة ولا نسبة نجاح في البنية */
    expect("score" in result || "feasibility" in result).toBe(false);
  });
});
