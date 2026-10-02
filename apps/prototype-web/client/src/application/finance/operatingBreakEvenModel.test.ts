/* REM-007 (المرحلة ب — 2026-09-29): طبقة التطبيق للنموذج الكنوني للتعادل
 * التشغيلي على متجر حي واحد: (١) عزل عناصر التمويل والسيولة — الكاش
 * المضاف، سحب المالك، رأس المال، أصل القرض، الأمانات، العربون، دين
 * العميل، والتصريحات النقدية — لا تغيّر نتيجة التشغيل/قيمة مبيعات التعادل/
 * الحالة؛ (٢) تمرير الهدف عبر الخدمة إلى القارئ الكنوني نفسه؛ (٣) تكافؤ
 * الحقول بين قراءة قرار G5 وقراءة التغطية (نموذج واحد F-009).
 *
 * الأوراكل حساب يدوي مستقل: الطلب المسلّم النهائي = إيراد 5000 وتكلفة وقت
 * 1000 → هامش 4000؛ الثابتة 1000 → نتيجة تشغيل 3000 (فوق)؛ مبيعات التعادل
 * = ceil(1000 × 5000 ÷ 4000) = 1250. */
import { describe, expect, it } from "vitest";
import { ProjectFinancialService, type CoverageIndicator } from "./projectFinancialService";
import { FinancialAnalysisService } from "@/application/financial-analysis/financialAnalysisService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { OperatingBreakEvenResult } from "@micro-domain/financial-analysis/index.js";
import { createInventoryMovement, createMaterial } from "@micro-domain/inventory-material/index.js";
import {
  calculateCostSnapshot,
  collectDeposit,
  createCraftOrder,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";

const now = () => "2026-08-23T09:00:00.000Z";

function deliveredFinalOrder(id: string, itemName: string, depositMinor: number | null = null) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 1000, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 2,
    createdAt: "2026-08-01T09:00:00.000Z",
    freshnessDays: null,
  });
  let order = createCraftOrder({
    id,
    customerName: "عميلة",
    itemName,
    specifications: "اختبار التعادل التشغيلي",
    quantity: 2,
    agreedPriceMinor: 5000,
    costSnapshot: cost,
    createdAt: "2026-08-01T09:00:00.000Z",
  });
  for (const [to, stamp] of [
    ["provisional_agreement", "2026-08-01T10:00:00.000Z"],
    ["confirmed", "2026-08-01T11:00:00.000Z"],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `${id}-${to}`, createdAt: stamp });
  if (depositMinor !== null)
    order = collectDeposit(order, depositMinor, `${id}-dep`, "2026-08-04T09:00:00.000Z");
  for (const [to, stamp] of [
    ["in_progress", "2026-08-02T09:00:00.000Z"],
    ["ready", "2026-08-03T09:00:00.000Z"],
    ["delivered", "2026-08-05T09:00:00.000Z"],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `${id}-${to}`, createdAt: stamp });
  return order;
}

async function baseStore() {
  const store = new MemoryLocalStore();
  const order = deliveredFinalOrder("operating-order", "صندوق هدية");
  await store.saveOrder({
    id: order.id,
    order,
    deliveryDate: "2026-08-05",
    agreementSource: "test",
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-05T09:00:00.000Z",
  });
  return store;
}

async function storeWithFixedCost() {
  const store = await baseStore();
  const finance = new ProjectFinancialService(store, now);
  await finance.record({
    type: "operating_expense_cash",
    amountMinor: 1000,
    occurredOn: "2026-08-06",
    note: "إيجار ثابت معلوم",
    counterparty: null,
    relatedEventId: null,
    expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
    idempotencyKey: "operating-fixed",
  });
  return store;
}

describe("REM-007 — التعادل التشغيلي عبر طبقة التطبيق (نموذج واحد على متجر حي)", () => {
  it("the canonical operating reading reaches both live consumers with the same aggregates", async () => {
    const store = await storeWithFixedCost();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new FinancialAnalysisService(store, finance, now);
    const insights = await finance.readFinancialInsights("2026-08-01", "2026-08-31");
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    if (!insights.ok || !decision.ok) throw new Error("readers failed");
    /* أوراكل يدوي: هامش 4000، ثابتة 1000 → نتيجة تشغيل 3000 (فوق)؛
     * المبيعات = ceil(1000 × 5000 ÷ 4000) = 1250؛ النسبة 4000/5000 = 80٪. */
    expect(decision.value.period).toMatchObject({
      status: "available",
      contributionMarginMinor: 4000,
      fixedExpenseMinor: 1000,
      operatingResultMinor: 3000,
      breakEvenState: "above",
      remainingToBreakEvenMinor: 0,
      amountAboveBreakEvenMinor: 3000,
      breakEvenUnits: 1,
      breakEvenSalesValueMinor: 1250,
      contributionMarginRatioPermyriad: 8000,
      classificationGap: false,
      targetOperatingResult: null,
    });
    /* التغطية تستهلك القارئ الكنوني نفسه (F-009) فتطابقه على الحقول المشتركة. */
    expect(insights.value.coverage.breakEvenUnits).toBe(decision.value.period.breakEvenUnits);
    expect(insights.value.coverage.fixedExpenseMinor).toBe(decision.value.period.fixedExpenseMinor);
    expect(insights.value.coverage.directMarginMinor).toBe(decision.value.period.directMarginMinor);
  });

  it("financing and liquidity records do not alter the operating break-even reading", async () => {
    const store = await storeWithFixedCost();
    const finance = new ProjectFinancialService(store, now);
    const before = await new FinancialAnalysisService(store, finance, now).readDecision(
      "2026-08-01",
      "2026-08-31",
    );
    if (!before.ok) throw new Error("before reading failed");
    /* عناصر التمويل والسيولة — لا أحد منها مصروف تشغيلي مصنف: رأس مال
     * المالك، سحب نقدي، قبض أصل قرض، أمانة محتجزة، وتصريح قبض متوقع. */
    await finance.record({
      type: "owner_investment_cash",
      amountMinor: 50000,
      occurredOn: "2026-08-07",
      note: "زيادة رأس مال",
      counterparty: "المالك",
      relatedEventId: null,
      idempotencyKey: "iso-capital",
    });
    await finance.record({
      type: "owner_withdrawal_cash",
      amountMinor: 4000,
      occurredOn: "2026-08-08",
      note: "سحب شخصي",
      counterparty: "المالك",
      relatedEventId: null,
      idempotencyKey: "iso-withdrawal",
    });
    await finance.record({
      type: "loan_received_cash",
      amountMinor: 20000,
      occurredOn: "2026-08-09",
      note: "أصل قرض مستلم",
      counterparty: "الممول",
      relatedEventId: null,
      idempotencyKey: "iso-loan",
    });
    await finance.record({
      type: "amanah_held_cash",
      amountMinor: 3000,
      occurredOn: "2026-08-10",
      note: "أمانة محتجزة",
      counterparty: "زبون",
      relatedEventId: null,
      idempotencyKey: "iso-amanah",
    });
    await store.saveShortCashDeclaration({
      id: "iso-decl",
      kind: "declaration",
      direction: "collection",
      amountMinor: 2500,
      dueOn: "2026-08-25",
      source: "قبض متوقع معلن",
      knowledge: "known",
      note: "موعد تحصيل",
      relatedOrderId: null,
      relatedEventId: null,
      idempotencyKey: "iso-decl-key",
      reversalOfId: null,
      createdAt: now(),
    });
    const after = await new FinancialAnalysisService(store, finance, now).readDecision(
      "2026-08-01",
      "2026-08-31",
    );
    if (!after.ok) throw new Error("after reading failed");
    expect(after.value.period.operatingResultMinor).toBe(before.value.period.operatingResultMinor);
    expect(after.value.period.breakEvenState).toBe(before.value.period.breakEvenState);
    expect(after.value.period.breakEvenSalesValueMinor).toBe(before.value.period.breakEvenSalesValueMinor);
    expect(after.value.period.breakEvenUnits).toBe(before.value.period.breakEvenUnits);
    expect(after.value.period.contributionMarginMinor).toBe(before.value.period.contributionMarginMinor);
    expect(after.value.period.fixedExpenseMinor).toBe(before.value.period.fixedExpenseMinor);
  });

  it("customer debt and deposits on the delivered order do not alter the operating reading", async () => {
    /* طلبان متطابقان في الإيراد والتكلفة المعترف بهما: أحدهما بقبض كامل
     * (مسوّى) والآخر بعربون ثم دين مسجل عند التسليم — نتيجة التشغيل واحدة. */
    const paid = new MemoryLocalStore();
    const paidOrder = deliveredFinalOrder("paid-order", "صندوق مسدد", 5000);
    await paid.saveOrder({
      id: paidOrder.id,
      order: paidOrder,
      deliveryDate: "2026-08-05",
      agreementSource: "test",
      createdAt: "2026-08-01T09:00:00.000Z",
      updatedAt: "2026-08-05T09:00:00.000Z",
    });
    const debt = new MemoryLocalStore();
    const debtOrder = deliveredFinalOrder("debt-order", "صندوق بالدين", 1000);
    await debt.saveOrder({
      id: debtOrder.id,
      order: debtOrder,
      deliveryDate: "2026-08-05",
      agreementSource: "test",
      createdAt: "2026-08-01T09:00:00.000Z",
      updatedAt: "2026-08-05T09:00:00.000Z",
    });
    /* عربون جزئي → متبقٍ غير محصّل (partially_paid) والمسدد كاملًا → settled:
     * حالة التحصيل مختلفة والإيراد/التكلفة المعترف بهما واحد — وهذا ما يفحصه الاختبار. */
    expect(debtOrder.settlementStatus).toBe("partially_paid");
    expect(debtOrder.receivableMinor).toBe(4000);
    expect(paidOrder.status).toBe("settled");
    const readings = [];
    for (const store of [paid, debt]) {
      const finance = new ProjectFinancialService(store, now);
      await finance.record({
        type: "operating_expense_cash",
        amountMinor: 1000,
        occurredOn: "2026-08-06",
        note: "إيجار ثابت معلوم",
        counterparty: null,
        relatedEventId: null,
        expenseContext: {
          relationship: "project",
          behavior: "fixed",
          purpose: "period",
          knowledge: "known",
        },
        idempotencyKey: `iso-order-${store === paid ? "paid" : "debt"}`,
      });
      const decision = await new FinancialAnalysisService(store, finance, now).readDecision(
        "2026-08-01",
        "2026-08-31",
      );
      if (!decision.ok) throw new Error("reading failed");
      readings.push(decision.value.period);
    }
    expect(readings[0].operatingResultMinor).toBe(readings[1].operatingResultMinor);
    expect(readings[0].breakEvenSalesValueMinor).toBe(readings[1].breakEvenSalesValueMinor);
    expect(readings[0].breakEvenState).toBe(readings[1].breakEvenState);
  });

  it("the service passes the target operating result through to the same canonical reader", async () => {
    const store = await storeWithFixedCost();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new FinancialAnalysisService(store, finance, now);
    /* أوراكل يدوي: هامش 4000 على وحدتين (2000/وحدة)؛ الثابتة 1000، الهدف
     * 3000 → وحدات = ceil(4000 × 2000 ÷ 4000000) = 2؛ مبيعات الهدف =
     * ceil(4000 × 5000 ÷ 4000) = 5000. عند وحدتين: 2 × 2000 − 1000 = 3000 ✓. */
    const targeted = await g5.readDecision("2026-08-01", "2026-08-31", 3000);
    const plain = await g5.readDecision("2026-08-01", "2026-08-31");
    if (!targeted.ok || !plain.ok) throw new Error("readings failed");
    expect(targeted.value.period.targetOperatingResult).toMatchObject({
      targetOperatingResultMinor: 3000,
      targetUnits: 2,
      targetSalesValueMinor: 5000,
      reasons: [],
    });
    expect(plain.value.period.targetOperatingResult).toBeNull();
    /* الهدف صفر عبر الخدمة = التعادل العادي (تكافؤ بالبناء). */
    const zero = await g5.readDecision("2026-08-01", "2026-08-31", 0);
    if (!zero.ok) throw new Error("zero reading failed");
    expect(zero.value.period.targetOperatingResult).toMatchObject({
      targetUnits: plain.value.period.breakEvenUnits,
      targetSalesValueMinor: plain.value.period.breakEvenSalesValueMinor,
    });
    /* هدف سالب: الرفض داخل قراءة الهدف نفسها بأسباب مسماة — أساس الفترة
     * الصحيح لا يُبطل (لا سياسة خسارة مستهدفة تُخترع). */
    const invalid = await g5.readDecision("2026-08-01", "2026-08-31", -1);
    if (!invalid.ok) throw new Error("invalid reading should still return");
    expect(invalid.value.period.status).toBe("available");
    expect(invalid.value.period.targetOperatingResult).toMatchObject({
      targetOperatingResultMinor: -1,
      targetUnits: null,
      targetSalesValueMinor: null,
    });
    expect(invalid.value.period.targetOperatingResult?.reasons.join(" ")).toContain("غير صالحة");
  });
});

/* REM-007 (تصحيح تكافؤ المستهلكين — 2026-09-30): القراءة الكاملة تصل قراري
 * G5 والتغطية من التركيب الكنوني نفسه. كل حالة بأوراكل رقمي مستقل محسوب
 * يدويًا، ثم مطابقة كاملة للحقول المشتركة بين المستهلكين الحيّين.
 *
 * الأوراكل المشترك: الطلب النهائي إيراد 5000 وتكلفة معترف بها 1000 (وقت
 * 60×1000) على كميتين (2000 ملي) → هامش 4000. الثابتة F متغيرة لكل حالة. */
async function storeWithFixedExpense(fixedMinor: number) {
  const store = await baseStore();
  const finance = new ProjectFinancialService(store, now);
  await finance.record({
    type: "operating_expense_cash",
    amountMinor: fixedMinor,
    occurredOn: "2026-08-06",
    note: "ثابتة الفترة",
    counterparty: null,
    relatedEventId: null,
    expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
    idempotencyKey: `parity-${fixedMinor}`,
  });
  return store;
}

async function bothReadings(store: MemoryLocalStore) {
  const finance = new ProjectFinancialService(store, now);
  const g5 = new FinancialAnalysisService(store, finance, now);
  const insights = await finance.readFinancialInsights("2026-08-01", "2026-08-31");
  const decision = await g5.readDecision("2026-08-01", "2026-08-31");
  if (!insights.ok || !decision.ok) throw new Error("readers failed");
  return { coverage: insights.value.coverage, period: decision.value.period, insights, decision };
}

/* تكافؤ الحقول الكامل بين القارئين الحيّين — كل الحقول المشتركة واحدًا واحدًا. */
function expectFullFieldParity(coverage: CoverageIndicator, period: OperatingBreakEvenResult) {
  expect(coverage.fixedExpenseMinor).toBe(period.fixedExpenseMinor);
  expect(coverage.directMarginMinor).toBe(period.directMarginMinor);
  expect(coverage.breakEvenUnits).toBe(period.breakEvenUnits);
  expect(coverage.operatingResultMinor).toBe(period.operatingResultMinor);
  expect(coverage.breakEvenState).toBe(period.breakEvenState);
  expect(coverage.breakEvenSalesValueMinor).toBe(period.breakEvenSalesValueMinor);
  expect(coverage.contributionMarginRatioPermyriad).toBe(period.contributionMarginRatioPermyriad);
  expect(coverage.remainingToBreakEvenMinor).toBe(period.remainingToBreakEvenMinor);
  expect(coverage.amountAboveBreakEvenMinor).toBe(period.amountAboveBreakEvenMinor);
  expect(coverage.classificationGap).toBe(period.classificationGap);
}

describe("REM-007 — تصحيح تكافؤ المستهلكين: القراءة الكاملة تصل للتغطية والقرار معًا (2026-09-30)", () => {
  it("above break-even: full-field parity with independent oracle (F=1000 → result 3000)", async () => {
    const { coverage, period } = await bothReadings(await storeWithFixedExpense(1000));
    /* أوراكل: هامش 4000، ثابتة 1000 → نتيجة 3000 فوق؛ المتبقي 0، الفائض
     * 3000، وحدات ceil(1000×2000÷4000000)=1، مبيعات ceil(1000×5000÷4000)=1250،
     * النسبة 4000/5000=80% = 8000 من عشرة آلاف. */
    expect(period).toMatchObject({
      status: "available",
      operatingResultMinor: 3000,
      breakEvenState: "above",
      remainingToBreakEvenMinor: 0,
      amountAboveBreakEvenMinor: 3000,
      breakEvenUnits: 1,
      breakEvenSalesValueMinor: 1250,
      contributionMarginRatioPermyriad: 8000,
      classificationGap: false,
    });
    expect(coverage.status).toBe("recorded_only");
    expect(coverage.operatingResultMinor).toBe(3000);
    expect(coverage.breakEvenState).toBe("above");
    expect(coverage.breakEvenSalesValueMinor).toBe(1250);
    expect(coverage.contributionMarginRatioPermyriad).toBe(8000);
    expect(coverage.remainingToBreakEvenMinor).toBe(0);
    expect(coverage.amountAboveBreakEvenMinor).toBe(3000);
    expectFullFieldParity(coverage, period);
  });

  it("at break-even: full-field parity with exact zero result (F=4000 → result 0)", async () => {
    const { coverage, period } = await bothReadings(await storeWithFixedExpense(4000));
    /* أوراكل: هامش 4000، ثابتة 4000 → نتيجة 0 عند التعادل بالضبط؛ المتبقي
     * 0، الفائض null (لا ينطبق)، وحدات ceil(4000×2000÷4000000)=2، مبيعات
     * ceil(4000×5000÷4000)=5000، النسبة 8000. */
    expect(period).toMatchObject({
      status: "available",
      operatingResultMinor: 0,
      breakEvenState: "at",
      remainingToBreakEvenMinor: 0,
      amountAboveBreakEvenMinor: null,
      breakEvenUnits: 2,
      breakEvenSalesValueMinor: 5000,
      contributionMarginRatioPermyriad: 8000,
    });
    expect(coverage.status).toBe("recorded_only");
    expect(coverage.operatingResultMinor).toBe(0);
    expect(coverage.breakEvenState).toBe("at");
    expect(coverage.amountAboveBreakEvenMinor).toBeNull();
    expectFullFieldParity(coverage, period);
  });

  it("below break-even: full-field parity with negative result (F=6000 → result −2000)", async () => {
    const { coverage, period } = await bothReadings(await storeWithFixedExpense(6000));
    /* أوراكل: هامش 4000، ثابتة 6000 → نتيجة −2000 تحت التعادل؛ المتبقي
     * 2000، الفائض null، وحدات ceil(6000×2000÷4000000)=3 (عند 3: صفر)،
     * مبيعات ceil(6000×5000÷4000)=7500، النسبة 8000. */
    expect(period).toMatchObject({
      status: "available",
      operatingResultMinor: -2000,
      breakEvenState: "below",
      remainingToBreakEvenMinor: 2000,
      amountAboveBreakEvenMinor: null,
      breakEvenUnits: 3,
      breakEvenSalesValueMinor: 7500,
      contributionMarginRatioPermyriad: 8000,
    });
    expect(coverage.status).toBe("recorded_only");
    expect(coverage.operatingResultMinor).toBe(-2000);
    expect(coverage.breakEvenState).toBe("below");
    expect(coverage.remainingToBreakEvenMinor).toBe(2000);
    expectFullFieldParity(coverage, period);
  });

  it("classification gap: both readers null the aggregates honestly and stay in parity (incomplete)", async () => {
    const store = await storeWithFixedExpense(1000);
    const finance = new ProjectFinancialService(store, now);
    await finance.record({
      type: "operating_expense_cash",
      amountMinor: 5000,
      occurredOn: "2026-08-06",
      note: "فاتورة بيت غير موزعة",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "shared",
        behavior: "fixed",
        purpose: "unallocated",
        knowledge: "needs_review",
        sharedProjectShare: {
          basis: "needs_review",
          note: null,
          allocation: "unallocated",
          totalAmountMinor: 5000,
          percentageBps: null,
          calculatedShareMinor: null,
        },
      },
      idempotencyKey: "parity-gap",
      sharedExpense: { mode: "defer", sharedTotalAmountMinor: 5000 },
    });
    const { coverage, period } = await bothReadings(store);
    /* فجوة التصنيف تُسقط المجمعات كلها في القارئين — لا رقم جزئي مضلل،
     * والتغطية تعلن الحالة نفسها (incomplete) بلا إعادة تفسير. */
    expect(period.status).toBe("incomplete");
    expect(period.classificationGap).toBe(true);
    expect(period.operatingResultMinor).toBeNull();
    expect(period.breakEvenState).toBeNull();
    expect(period.breakEvenSalesValueMinor).toBeNull();
    expect(period.contributionMarginRatioPermyriad).toBeNull();
    expect(period.remainingToBreakEvenMinor).toBeNull();
    expect(period.amountAboveBreakEvenMinor).toBeNull();
    expect(coverage.status).toBe("incomplete");
    expect(coverage.operatingResultMinor).toBeNull();
    expect(coverage.breakEvenState).toBeNull();
    expect(coverage.breakEvenSalesValueMinor).toBeNull();
    expect(coverage.contributionMarginRatioPermyriad).toBeNull();
    expect(coverage.remainingToBreakEvenMinor).toBeNull();
    expect(coverage.amountAboveBreakEvenMinor).toBeNull();
    expectFullFieldParity(coverage, period);
  });

  it("inventory movements downgrade only the coverage status while canonical numerics and reasons stay exact", async () => {
    const store = await storeWithFixedExpense(1000);
    const material = createMaterial({
      id: "gap-material",
      name: "خشب",
      unit: "piece",
      createdAt: "2026-08-01T09:00:00.000Z",
      createdOperationKey: "gap-material-create",
    });
    await store.commitInventory(material, [
      createInventoryMovement({
        id: "gap-opening",
        materialId: material.id,
        type: "opening",
        occurredOn: "2026-08-01",
        recordedAt: now(),
        quantityDeltaMilli: 10000,
        valueDeltaMinor: 10000,
        note: "افتتاح مادة",
        operationKey: "gap-opening",
      }),
      createInventoryMovement({
        id: "gap-consumption",
        materialId: material.id,
        type: "consumption",
        occurredOn: "2026-08-05",
        recordedAt: now(),
        quantityDeltaMilli: -1000,
        valueDeltaMinor: -1200,
        note: "استهلاك فعلي",
        operationKey: "gap-consumption",
        orderId: "operating-order",
      }),
    ]);
    const { coverage, period } = await bothReadings(store);
    /* الحركات تخفض حالة التغطية فقط وتضيف سببها الموجود — الأرقام الكنسية
     * تبقى كما هي بلا إعادة حساب أو محو، وقراءة G5 نفسها لا تتأثر أصلًا. */
    expect(period.status).toBe("available");
    expect(period.operatingResultMinor).toBe(3000);
    expect(coverage.status).toBe("incomplete");
    expect(coverage.reasons).toContain("حركات مخزون فعلية");
    expect(coverage.operatingResultMinor).toBe(3000);
    expect(coverage.breakEvenState).toBe("above");
    expect(coverage.breakEvenSalesValueMinor).toBe(1250);
    expect(coverage.contributionMarginRatioPermyriad).toBe(8000);
    expect(coverage.remainingToBreakEvenMinor).toBe(0);
    expect(coverage.amountAboveBreakEvenMinor).toBe(3000);
    expectFullFieldParity(coverage, period);
  });

  it("financing and liquidity records leave the coverage operating reading unchanged too", async () => {
    const store = await storeWithFixedExpense(1000);
    const finance = new ProjectFinancialService(store, now);
    const before = await finance.readFinancialInsights("2026-08-01", "2026-08-31");
    if (!before.ok) throw new Error("before failed");
    await finance.record({
      type: "owner_investment_cash",
      amountMinor: 50000,
      occurredOn: "2026-08-07",
      note: "رأس مال إضافي",
      counterparty: "المالك",
      relatedEventId: null,
      idempotencyKey: "cov-iso-capital",
    });
    await finance.record({
      type: "loan_received_cash",
      amountMinor: 20000,
      occurredOn: "2026-08-08",
      note: "أصل قرض مستلم",
      counterparty: "الممول",
      relatedEventId: null,
      idempotencyKey: "cov-iso-loan",
    });
    const after = await finance.readFinancialInsights("2026-08-01", "2026-08-31");
    if (!after.ok) throw new Error("after failed");
    expect(after.value.coverage.operatingResultMinor).toBe(before.value.coverage.operatingResultMinor);
    expect(after.value.coverage.breakEvenSalesValueMinor).toBe(
      before.value.coverage.breakEvenSalesValueMinor,
    );
    expect(after.value.coverage.breakEvenState).toBe(before.value.coverage.breakEvenState);
    /* رأس المال وأصل القرض كاش حقيقي — لا إيرادًا ولا تكلفة تشغيلية. */
    expect(after.value.coverage.operatingResultMinor).toBe(3000);
  });

  it("no target surface in FinancialInsights: no third argument, no declared field, no carried reading", async () => {
    const store = await storeWithFixedExpense(1000);
    const finance = new ProjectFinancialService(store, now);
    const g5 = new FinancialAnalysisService(store, finance, now);
    /* G5 مع هدف صريح: قراءة الهدف موجودة (وحدات 2). */
    const targeted = await g5.readDecision("2026-08-01", "2026-08-31", 3000);
    if (!targeted.ok) throw new Error("targeted failed");
    expect(targeted.value.period.targetOperatingResult).toMatchObject({
      targetOperatingResultMinor: 3000,
      targetUnits: 2,
      targetSalesValueMinor: 5000,
    });
    const insights = await finance.readFinancialInsights("2026-08-01", "2026-08-31");
    if (!insights.ok) throw new Error("insights failed");
    /* التغطية لا تحمل قراءة هدف أصلًا — الهدف قراءة G5 اختيارية فقط. */
    expect(insights.value.coverage).not.toHaveProperty("targetOperatingResult");
    /* حارسا التجميع السلبيان (لا حقل هدف في عقد التغطية ولا وسيط هدف في
     * قراءة المؤشرات) يعيشان في ملف الخدمة نفسه حيث يفرضهما tsc — ملفات
     * الاختبار مستبعدة من فحص الأنواع بموجب tsconfig التطبيق، فلا يعاد
     * إعلانهما هنا (انظر projectFinancialService.ts عند CoverageIndicator). */
  });
});
