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
import { ProjectFinancialService } from "./projectFinancialService";
import { G5Service } from "@/application/g5/g5Service";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
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
    const g5 = new G5Service(store, finance, now);
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
    const before = await new G5Service(store, finance, now).readDecision("2026-08-01", "2026-08-31");
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
    const after = await new G5Service(store, finance, now).readDecision("2026-08-01", "2026-08-31");
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
      const decision = await new G5Service(store, finance, now).readDecision("2026-08-01", "2026-08-31");
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
    const g5 = new G5Service(store, finance, now);
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
    /* هدف سالب يُرفض بالاسم عبر الخدمة أيضًا. */
    const invalid = await g5.readDecision("2026-08-01", "2026-08-31", -1);
    if (!invalid.ok) throw new Error("invalid reading should still return");
    expect(invalid.value.period.status).toBe("invalid");
    expect(invalid.value.period.targetOperatingResult).toBeNull();
  });
});
