/* REM-007 (تصحيح تكافؤ المستهلكين — 2026-09-30): اختبار تكامل D-03 عبر
 * المسار الكانوني الفعلي — لقطة التكلفة (بمكون التوصيل) وشروط النقل
 * المسجلة والانتقال إلى التسليم (الاعتراف) ثم قراءتا G5 والتغطية من
 * التركيب الكنوني نفسه. يثبت الدلالات الخمس المحسومة (عقد 05 §3.2.1):
 * (١) كلفة التوصيل داخل لقطة التكلفة تدخل recognizedCostMinor مرة واحدة
 * وتؤثر في النموذج التشغيلي مرة واحدة؛ (٢) حقل التحلل التفسيري
 * projectDeliveryCostMinor لا يُخصم ثانية أبدًا؛ (٣) دفع الزبون للناقل
 * مباشرة معلومة سياقية فقط — لا كاش مشروع ولا إيرادًا ولا مصروفًا ولا
 * تكلفة؛ (٤) null تعني «غير مسجلة بعد» ولا تُعامل صفرًا بصمت؛ (٥) أجرة
 * التوصيل المقبوضة عبر المشروع تدخل قيمة الطلب/المتبقي مرة واحدة بلا
 * مسار ثانٍ للنموذج.
 *
 * كل الأرقام أوراكل يدوي مستقل محسوب في التعليقات قبل الكتابة. */
import { describe, expect, it } from "vitest";
import { ProjectFinancialService } from "./projectFinancialService";
import { FinancialAnalysisService } from "@/application/financial-analysis/financialAnalysisService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import {
  calculateCostSnapshot,
  collectDeposit,
  createCraftOrder,
  orderResultBreakdown,
  orderValueMinor,
  projectDeliveryCostMinor,
  recordDeliveryTerms,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";

const now = () => "2026-08-23T09:00:00.000Z";

/* الطلب القاعدي: سعر 5500، وقت 60×1000=1000، مكون توصيل لقطة متغير،
 * على كميتين (2000 ملي) — الكلفة المعترف بها = 1000 + مكون التوصيل. */
function d03Order(id: string, snapshotDeliveryMinor: number, priceMinor = 5500) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 1000, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: snapshotDeliveryMinor,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 2,
    createdAt: "2026-08-01T09:00:00.000Z",
    freshnessDays: null,
  });
  return createCraftOrder({
    id,
    customerName: "عميلة",
    itemName: `صندوق ${id}`,
    specifications: "اختبار مسار التوصيل D-03",
    quantity: 2,
    agreedPriceMinor: priceMinor,
    costSnapshot: cost,
    createdAt: "2026-08-01T09:00:00.000Z",
  });
}

/* شروط النقل المسجلة قبل التسليم — null حيثما «غير مسجل». */
type Terms = Parameters<typeof recordDeliveryTerms>[1];

function confirmOrder(order: ReturnType<typeof d03Order>) {
  let next = order;
  for (const [to, stamp] of [
    ["provisional_agreement", "2026-08-01T10:00:00.000Z"],
    ["confirmed", "2026-08-01T11:00:00.000Z"],
  ] as const)
    next = transitionOrder(next, { to, idempotencyKey: `${next.id}-${to}`, createdAt: stamp });
  return next;
}

function deliverConfirmed(
  order: ReturnType<typeof d03Order>,
  terms?: Omit<Terms, "idempotencyKey" | "createdAt">,
  depositMinor?: number,
) {
  let next = order;
  if (terms)
    next = recordDeliveryTerms(next, {
      ...terms,
      idempotencyKey: `${next.id}-terms`,
      createdAt: "2026-08-01T12:00:00.000Z",
    });
  if (depositMinor !== undefined)
    next = collectDeposit(next, depositMinor, `${next.id}-dep`, "2026-08-04T09:00:00.000Z");
  for (const [to, stamp] of [
    ["in_progress", "2026-08-02T09:00:00.000Z"],
    ["ready", "2026-08-03T09:00:00.000Z"],
    ["delivered", "2026-08-05T09:00:00.000Z"],
  ] as const)
    next = transitionOrder(next, { to, idempotencyKey: `${next.id}-${to}`, createdAt: stamp });
  return next;
}

async function saveAndFix(store: MemoryLocalStore, order: ReturnType<typeof d03Order>, fixedKey: string) {
  await store.saveOrder({
    id: order.id,
    order,
    deliveryDate: "2026-08-05",
    agreementSource: "test",
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-05T09:00:00.000Z",
  });
  const finance = new ProjectFinancialService(store, now);
  await finance.record({
    type: "operating_expense_cash",
    amountMinor: 1000,
    occurredOn: "2026-08-06",
    note: "إيجار ثابت معلوم",
    counterparty: null,
    relatedEventId: null,
    expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
    idempotencyKey: fixedKey,
  });
  return finance;
}

describe("D-03 عبر المسار الكانوني الفعلي — لقطة تكلفة وشروط نقل وقراءتان حيّتان (عقد 05 §3.2.1)", () => {
  it("a snapshot delivery cost is counted exactly once: recognized cost carries it once and the model deducts it once", async () => {
    /* مكون التوصيل داخل اللقطة 600 → الكلفة المعترف بها 1600. الشروط:
     * المشروع يدفع والكلفة محتواة داخل تكلفة المنتج (costIncludedInProductCost)
     * → التحلل التفسيري يعلن صفرًا لا خصمًا ثانيًا. الأوراكل: الهامش
     * = 5500 − 1600 = 3900 (لو خُصمت التوصيل مرتين لصار 3300)؛ نتيجة
     * التشغيل = 3900 − 1000 = 2900؛ المبيعات = ceil(1000×5500÷3900)
     * = ceil(1410.25) = 1411؛ الوحدات = ceil(1000×2000÷3,900,000) = 1؛
     * النسبة = roundHalfUp(39,000,000÷5500) = roundHalfUp(7090.90) = 7091. */
    const store = new MemoryLocalStore();
    const order = deliverConfirmed(confirmOrder(d03Order("d03-snapshot", 600)), {
      responsibility: "project_pays",
      feeIncludedInPrice: false,
      costIncludedInProductCost: true,
      feeChargedMinor: null,
      costPaidMinor: 600,
      projectShareMinor: null,
      customerShareMinor: null,
    });
    const finance = await saveAndFix(store, order, "d03-snapshot-fixed");
    /* الكلفة المعترف بها تحمل مكون التوصيل مرة واحدة بالضبط. */
    expect(order.resultStatus).toBe("final");
    expect(order.recognizedCostMinor).toBe(1600);
    expect(order.recognizedRevenueMinor).toBe(5500);
    /* التحلل التفسيري: كلفة توصيل المشروع صفر (محتواة أصلًا في اللقطة) —
     * تكلفة التحلل تبقى 1600 لا 2200. */
    expect(projectDeliveryCostMinor(order)).toBe(0);
    expect(orderResultBreakdown(order)).toMatchObject({
      productCostMinor: 1600,
      projectDeliveryCostMinor: 0,
      costMinor: 1600,
      revenueMinor: 5500,
      incompleteReasons: [],
    });
    const g5 = new FinancialAnalysisService(store, finance, now);
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    const insights = await finance.readFinancialInsights("2026-08-01", "2026-08-31");
    if (!decision.ok || !insights.ok) throw new Error("readers failed");
    expect(decision.value.period).toMatchObject({
      status: "available",
      finalOrderCount: 1,
      totalVariableCostMinor: 1600,
      contributionMarginMinor: 3900,
      operatingResultMinor: 2900,
      breakEvenState: "above",
      breakEvenUnits: 1,
      breakEvenSalesValueMinor: 1411,
      contributionMarginRatioPermyriad: 7091,
    });
    /* القارئ الثاني (التغطية) على المسار نفسه — الرقم نفسه مرة واحدة. */
    expect(insights.value.coverage).toMatchObject({
      status: "recorded_only",
      operatingResultMinor: 2900,
      breakEvenState: "above",
      breakEvenSalesValueMinor: 1411,
      contributionMarginRatioPermyriad: 7091,
      breakEvenUnits: 1,
    });
    /* تركيب المؤشرات يظهر مكون التوصيل مرة واحدة داخل لقطة التكلفة. */
    expect(insights.value.costComposition.deliveryMinor).toBe(600);
  });

  it("a courier-direct customer payment stays contextual: no project cash, revenue, expense, or cost — and the terms guard refuses project cost", async () => {
    /* الطلبان متطابقان تمامًا (سعر 5500، وقت 1000): الأول بلا شروط نقل،
     * والثاني «الزبون يدفع للناقل مباشرة». القراءة التشغيلية واحدة:
     * الهامش 4500، النتيجة 3500، المبيعات ceil(1000×5500÷4500)=1223،
     * الوحدات ceil(1000×2000÷4,500,000)=1، النسبة
     * roundHalfUp(45,000,000÷5500)=roundHalfUp(8181.81)=8182. */
    const readings = [];
    const positions = [];
    const eventCounts = [];
    for (const [withTerms, key] of [
      [false, "d03-courier-plain"],
      [true, "d03-courier-terms"],
    ] as const) {
      const store = new MemoryLocalStore();
      const order = deliverConfirmed(
        confirmOrder(d03Order(key, 0)),
        withTerms
          ? {
              responsibility: "customer_pays_courier",
              feeIncludedInPrice: false,
              costIncludedInProductCost: true,
              feeChargedMinor: null,
              costPaidMinor: null,
              projectShareMinor: null,
              customerShareMinor: null,
            }
          : undefined,
      );
      const finance = await saveAndFix(store, order, `${key}-fixed`);
      const decision = await new FinancialAnalysisService(store, finance, now).readDecision("2026-08-01", "2026-08-31");
      if (!decision.ok) throw new Error("reading failed");
      readings.push(decision.value.period);
      const position = await finance.readPosition();
      if (!position.ok) throw new Error("position failed");
      positions.push(position.value);
      const events = await store.listFinancialEvents();
      if (!events.ok) throw new Error("events failed");
      eventCounts.push(events.value.length);
    }
    /* الدفع المباشر للناقل لا يغيّر أي رقم تشغيلي — معلومة سياقية فقط. */
    expect(readings[0]).toMatchObject({
      status: "available",
      contributionMarginMinor: 4500,
      operatingResultMinor: 3500,
      breakEvenState: "above",
      breakEvenSalesValueMinor: 1223,
      breakEvenUnits: 1,
      contributionMarginRatioPermyriad: 8182,
    });
    expect(readings[1].operatingResultMinor).toBe(readings[0].operatingResultMinor);
    expect(readings[1].breakEvenSalesValueMinor).toBe(readings[0].breakEvenSalesValueMinor);
    expect(readings[1].breakEvenState).toBe(readings[0].breakEvenState);
    expect(readings[1].contributionMarginMinor).toBe(readings[0].contributionMarginMinor);
    /* لا كاش مشروع من دفع الناقل: الكاش المسجل = الثابتة النقدية وحدها
     * (−1000)، والمصروف التشغيلي المسجل = 1000، وحدث مالي واحد في
     * المتجرين — دفع الزبون للناقل لم يصبح كاشًا ولا مصروفًا ولا تكلفة. */
    expect(eventCounts).toEqual([1, 1]);
    expect(positions.map(p => p.operatingExpensesRecordedMinor)).toEqual([1000, 1000]);
    expect(positions.map(p => p.recordedCashMinor)).toEqual([-1000, -1000]);
    /* حارس المجال: تسجيل كلفة على المشروع تحت «يدفع الزبون للناقل مباشرة»
     * مرفوض بالاسم — المعلومة سياقية فقط. */
    const confirmed = confirmOrder(d03Order("d03-courier-guard", 0));
    expect(() =>
      recordDeliveryTerms(confirmed, {
        responsibility: "customer_pays_courier",
        feeIncludedInPrice: false,
        costIncludedInProductCost: true,
        feeChargedMinor: null,
        costPaidMinor: 300,
        projectShareMinor: null,
        customerShareMinor: null,
        idempotencyKey: `${confirmed.id}-bad-terms`,
        createdAt: "2026-08-01T12:00:00.000Z",
      }),
    ).toThrow("معلومة سياقية فقط");
  });

  it("an unrecorded fee (null) is declared incomplete and excluded — never silently zero", async () => {
    /* الطلب نفسه مرتين: مرة بأجرة «غير مسجلة بعد» (null) ومرة بأجرة صفر
     * صريحة (كلفة النقل في الحالتين محتواة داخل تكلفة المنتج فلا يشوب
     * العزل شيء). null: الطلب يبقى ناقصًا معلنًا فيُستبعد من الهامش (لو
     * عوملت صفرًا لدخل النموذج برقم وهمي)؛ الصفر الصريح: قيمة نهائية
     * تامة تقرأ الهامش 4500 والنتيجة 3500. */
    const nullFeeStore = new MemoryLocalStore();
    const nullFeeOrder = deliverConfirmed(confirmOrder(d03Order("d03-fee-null", 0)), {
      responsibility: "customer_pays_project",
      feeIncludedInPrice: false,
      costIncludedInProductCost: true,
      feeChargedMinor: null,
      costPaidMinor: null,
      projectShareMinor: null,
      customerShareMinor: null,
    });
    const nullFeeFinance = await saveAndFix(nullFeeStore, nullFeeOrder, "d03-null-fixed");
    expect(nullFeeOrder.resultStatus).toBe("incomplete");
    expect(orderResultBreakdown(nullFeeOrder).billableDeliveryFeeMinor).toBeNull();
    const decision = await new FinancialAnalysisService(nullFeeStore, nullFeeFinance, now).readDecision(
      "2026-08-01",
      "2026-08-31",
    );
    const insights = await nullFeeFinance.readFinancialInsights("2026-08-01", "2026-08-31");
    if (!decision.ok || !insights.ok) throw new Error("readers failed");
    /* القراءة صادقة: مستبعد معلن، لا رقم جزئي — لو كان null صفرًا لكانت
     * النتيجة 3500 متاحة؛ هي ليست كذلك. */
    expect(decision.value.period).toMatchObject({
      status: "incomplete",
      finalOrderCount: 0,
      excludedOrderCount: 1,
      operatingResultMinor: null,
      breakEvenState: null,
      breakEvenSalesValueMinor: null,
    });
    expect(insights.value.coverage).toMatchObject({
      status: "incomplete",
      operatingResultMinor: null,
      breakEvenState: null,
    });
    /* المقابل: الصفر الصريح قيمة مسجلة صحيحة — الطلب نهائي والقراءة تامة:
     * الهامش 4500 والنتيجة 3500. */
    const zeroFeeStore = new MemoryLocalStore();
    const zeroFeeOrder = deliverConfirmed(confirmOrder(d03Order("d03-fee-zero", 0)), {
      responsibility: "customer_pays_project",
      feeIncludedInPrice: false,
      costIncludedInProductCost: true,
      feeChargedMinor: 0,
      costPaidMinor: null,
      projectShareMinor: null,
      customerShareMinor: null,
    });
    const zeroFeeFinance = await saveAndFix(zeroFeeStore, zeroFeeOrder, "d03-zero-fixed");
    expect(zeroFeeOrder.resultStatus).toBe("final");
    const zeroDecision = await new FinancialAnalysisService(zeroFeeStore, zeroFeeFinance, now).readDecision(
      "2026-08-01",
      "2026-08-31",
    );
    if (!zeroDecision.ok) throw new Error("zero reading failed");
    expect(zeroDecision.value.period).toMatchObject({
      status: "available",
      finalOrderCount: 1,
      operatingResultMinor: 3500,
      breakEvenState: "above",
    });
  });

  it("a project-collected delivery fare enters order value and receivable exactly once with no second model path", async () => {
    /* أجرة مسجلة عبر المشروع 700 فوق سعر 5500 → قيمة الطلب القابلة
     * للتحصيل 6200 مرة واحدة؛ الإيراد المعترف 6200 (لا 6900 باحتساب
     * مزدوج). الأوراكل: الهامش = 6200 − 1000 = 5200؛ النتيجة = 4200؛
     * المبيعات = ceil(1000×6200÷5200) = ceil(1192.31) = 1193؛ الوحدات
     * = ceil(1000×2000÷5,200,000) = 1؛ النسبة
     * = roundHalfUp(52,000,000÷6200) = roundHalfUp(8387.10) = 8387. */
    const store = new MemoryLocalStore();
    const confirmed = confirmOrder(d03Order("d03-fee-project", 0));
    const withTerms = recordDeliveryTerms(confirmed, {
      responsibility: "customer_pays_project",
      feeIncludedInPrice: false,
      costIncludedInProductCost: true,
      feeChargedMinor: 700,
      costPaidMinor: null,
      projectShareMinor: null,
      customerShareMinor: null,
      idempotencyKey: `${confirmed.id}-terms`,
      createdAt: "2026-08-01T12:00:00.000Z",
    });
    /* الأجرة داخل قيمة الطلب مرة واحدة: سقف القبض 6200 بالضبط — قبض
     * كامل 6200 يُسوّي المتبقي، وقبض قرش إضافي مرفوض بسقف القيمة
     * نفسها (لا 5500 بلا أجرة ولا 6900 بأجرة مزدوجة). */
    expect(orderValueMinor(withTerms)).toBe(6200);
    const afterFull = collectDeposit(withTerms, 6200, `${confirmed.id}-dep`, "2026-08-04T09:00:00.000Z");
    expect(() => collectDeposit(afterFull, 1, `${confirmed.id}-over`, "2026-08-04T10:00:00.000Z")).toThrow(
      "لا يمكن أن يتجاوز",
    );
    const order = deliverConfirmed(afterFull);
    expect(order.receivableMinor).toBe(0);
    expect(order.settlementStatus).toBe("paid");
    expect(order.recognizedRevenueMinor).toBe(6200);
    const finance = await saveAndFix(store, order, "d03-fee-project-fixed");
    const decision = await new FinancialAnalysisService(store, finance, now).readDecision("2026-08-01", "2026-08-31");
    const insights = await finance.readFinancialInsights("2026-08-01", "2026-08-31");
    if (!decision.ok || !insights.ok) throw new Error("readers failed");
    expect(decision.value.period).toMatchObject({
      status: "available",
      finalOrderCount: 1,
      totalRevenueMinor: 6200,
      contributionMarginMinor: 5200,
      operatingResultMinor: 4200,
      breakEvenState: "above",
      breakEvenSalesValueMinor: 1193,
      breakEvenUnits: 1,
      contributionMarginRatioPermyriad: 8387,
    });
    expect(insights.value.coverage).toMatchObject({
      status: "recorded_only",
      operatingResultMinor: 4200,
      breakEvenSalesValueMinor: 1193,
      breakEvenState: "above",
    });
  });
});
