import { describe, expect, it } from "vitest";
import { ProjectFinancialService } from "./projectFinancialService";
import { G5Service } from "@/application/g5/g5Service";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder, transitionOrder } from "@micro-domain/craft-order/index.js";
import { createInventoryMovement, createMaterial } from "@micro-domain/inventory-material/index.js";

const now = () => "2026-08-23T09:00:00.000Z";

/* F-009 (W2-B): نموذج تعادل واحد — قارئان حيّان على متجر واحد يعطيان الرقم
 * نفسه لكل سؤال تعادل. الأوراكل حساب يدوي مستقل (لا نسخ معادلة إنتاج):
 * التكلفة المعترف بها = وقت ٦٠ دقيقة × 1000/ساعة = 1000 قرش؛ الهامش المباشر
 * = 5000 − 1000 = 4000؛ وحدات التعادل = ceil(1000 × 2000 ÷ (4000 × 1000)) = 1. */
function deliveredFinalOrder(id: string, itemName: string) {
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
    specifications: "اختبار التعادل الموحد",
    quantity: 2,
    agreedPriceMinor: 5000,
    costSnapshot: cost,
    createdAt: "2026-08-01T09:00:00.000Z",
  });
  for (const [to, stamp] of [
    ["provisional_agreement", "2026-08-01T10:00:00.000Z"],
    ["confirmed", "2026-08-01T11:00:00.000Z"],
    ["in_progress", "2026-08-02T09:00:00.000Z"],
    ["ready", "2026-08-03T09:00:00.000Z"],
    ["delivered", "2026-08-05T09:00:00.000Z"],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `${id}-${to}`, createdAt: stamp });
  return order;
}

async function baseStore() {
  const store = new MemoryLocalStore();
  const order = deliveredFinalOrder("parity-order", "صندوق هدية");
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

async function readers(store: MemoryLocalStore) {
  const finance = new ProjectFinancialService(store, now);
  const g5 = new G5Service(store, finance, now);
  return { finance, g5 };
}

describe("unified break-even model (F-009/F-010/F-011)", () => {
  it("serves the same numbers to the coverage indicator and the G5 decision on one store", async () => {
    const store = await baseStore();
    const finance0 = new ProjectFinancialService(store, now);
    await finance0.record({
      type: "operating_expense_cash",
      amountMinor: 1000,
      occurredOn: "2026-08-06",
      note: "اشتراك ثابت معلوم",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
      idempotencyKey: "parity-fixed",
    });
    const { finance, g5 } = await readers(store);
    const insights = await finance.readFinancialInsights("2026-08-01", "2026-08-31");
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    if (!insights.ok || !decision.ok) throw new Error("readers failed");

    /* الحساب اليدوي المستقل: هامش 4000 قرشًا ووحدة تعادل واحدة. */
    expect(insights.value.coverage.fixedExpenseMinor).toBe(1000);
    expect(insights.value.coverage.directMarginMinor).toBe(4000);
    expect(insights.value.coverage.breakEvenUnits).toBe(1);
    expect(insights.value.coverage.status).toBe("recorded_only");
    expect(decision.value.period.fixedExpenseMinor).toBe(1000);
    expect(decision.value.period.contributionMarginMinor).toBe(4000);
    expect(decision.value.period.directMarginMinor).toBe(4000);
    expect(decision.value.period.breakEvenUnits).toBe(1);
    expect(decision.value.period.status).toBe("available");
    /* الاسم الصادق (F-011): هامش مباشر على أساس التكاليف المباشرة فقط. */
    expect(decision.value.period.marginBasis).toBe("direct_costs_only");
    expect(decision.value.period.linkedVariableExpenseMinor).toBe(0);
    expect(insights.value.coverage.breakEvenUnits).toBe(decision.value.period.breakEvenUnits);
    expect(insights.value.coverage.directMarginMinor).toBe(decision.value.period.directMarginMinor);
  });

  it("keeps the estimated-fixed number in both readers with its review status and declared assumptions", async () => {
    const store = await baseStore();
    const finance0 = new ProjectFinancialService(store, now);
    await finance0.record({
      type: "operating_expense_cash",
      amountMinor: 1000,
      occurredOn: "2026-08-06",
      note: "إيجار تقديري",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "fixed",
        purpose: "period",
        knowledge: "estimated",
      },
      idempotencyKey: "parity-estimated",
    });
    const { finance, g5 } = await readers(store);
    const insights = await finance.readFinancialInsights("2026-08-01", "2026-08-31");
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    if (!insights.ok || !decision.ok) throw new Error("readers failed");
    /* الرقم موجود وموسوم في القارئين — لا إخفاء في أحدهما. */
    expect(decision.value.period.breakEvenUnits).toBe(1);
    expect(insights.value.coverage.breakEvenUnits).toBe(1);
    expect(decision.value.period.status).toBe("needs_review");
    expect(insights.value.coverage.status).toBe("incomplete");
    /* F-010: الافتراضات دائمًا — الهيكلية الأربع + سطر التقدير المشروط. */
    expect(decision.value.period.assumptions.length).toBeGreaterThanOrEqual(5);
    expect(decision.value.period.assumptions.some(line => line.includes("تقديري"))).toBe(true);
  });

  it("excludes an unallocated shared expense from fixed costs in both readers, with the gap declared", async () => {
    const store = await baseStore();
    const finance0 = new ProjectFinancialService(store, now);
    await finance0.record({
      type: "operating_expense_cash",
      amountMinor: 5000,
      occurredOn: "2026-08-06",
      note: "فاتورة بيت",
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
      idempotencyKey: "parity-shared",
      sharedExpense: { mode: "defer", sharedTotalAmountMinor: 5000 },
    });
    const { finance, g5 } = await readers(store);
    const insights = await finance.readFinancialInsights("2026-08-01", "2026-08-31");
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    if (!insights.ok || !decision.ok) throw new Error("readers failed");
    /* الإجمالي المشترك غير الموزع لا يدخل الثابتة في أي من القارئين (F-061). */
    expect(decision.value.period.fixedExpenseMinor).toBe(0);
    expect(insights.value.coverage.fixedExpenseMinor).toBe(0);
    expect(insights.value.coverage.breakEvenUnits).toBeNull();
    expect(decision.value.period.status).not.toBe("available");
  });

  it("degrades the coverage status for real inventory movements while keeping the unified number and its reason", async () => {
    const store = await baseStore();
    const finance0 = new ProjectFinancialService(store, now);
    await finance0.record({
      type: "operating_expense_cash",
      amountMinor: 1000,
      occurredOn: "2026-08-06",
      note: "اشتراك ثابت معلوم",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
      idempotencyKey: "parity-movements-fixed",
    });
    const material = createMaterial({
      id: "parity-material",
      name: "خشب",
      unit: "piece",
      createdAt: "2026-08-01T09:00:00.000Z",
      createdOperationKey: "parity-material-create",
    });
    await store.commitInventory(material, [
      createInventoryMovement({
        id: "parity-opening",
        materialId: material.id,
        type: "opening",
        occurredOn: "2026-08-01",
        recordedAt: now(),
        quantityDeltaMilli: 10000,
        valueDeltaMinor: 10000,
        note: "افتتاح مادة",
        operationKey: "parity-opening",
      }),
      createInventoryMovement({
        id: "parity-consumption",
        materialId: material.id,
        type: "consumption",
        occurredOn: "2026-08-05",
        recordedAt: now(),
        quantityDeltaMilli: -1000,
        valueDeltaMinor: -1200,
        note: "استهلاك فعلي",
        operationKey: "parity-consumption",
        orderId: "parity-order",
      }),
    ]);
    const { finance, g5 } = await readers(store);
    const insights = await finance.readFinancialInsights("2026-08-01", "2026-08-31");
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    if (!insights.ok || !decision.ok) throw new Error("readers failed");
    /* التراكيب: الحركات تخفض حالة التغطية فقط — الرقم الموحد يبقى معلنًا مع سببه
     * (أساس الهامش تكلفة معترف بها لا COGS — الفرق معلن لا مخفي). */
    expect(insights.value.coverage.status).toBe("incomplete");
    expect(insights.value.coverage.reasons).toContain("حركات مخزون فعلية");
    expect(insights.value.coverage.breakEvenUnits).toBe(1);
    expect(decision.value.period.breakEvenUnits).toBe(1);
    expect(decision.value.period.status).toBe("available");
    expect(insights.value.coverage.breakEvenUnits).toBe(decision.value.period.breakEvenUnits);
  });
});
