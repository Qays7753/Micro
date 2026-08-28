import { describe, expect, it } from "vitest";
import { ProjectFinancialService } from "./projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder, transitionOrder } from "@micro-domain/craft-order/index.js";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import { createInventoryMovement, createMaterial } from "@micro-domain/inventory-material/index.js";

const now = () => "2026-08-23T09:00:00.000Z";
function completedMaterialOrder(id: string) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [
      {
        name: "خشب",
        quantity: 1,
        unit: "قطعة",
        unitPriceMinor: 1000,
        priceDate: "2026-08-01",
        source: "user_input",
        confidence: "known",
      },
    ],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 100,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-01T09:00:00.000Z",
    freshnessDays: null,
  });
  let order = createCraftOrder({
    id,
    customerName: "عميلة",
    itemName: "قطعة خشب",
    specifications: "اختبار COGS",
    quantity: 1,
    agreedPriceMinor: 3000,
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
function inventoryFixture(orderId: string) {
  const material = createMaterial({
    id: `${orderId}-material`,
    name: "خشب",
    unit: "piece",
    createdAt: "2026-08-01T09:00:00.000Z",
    createdOperationKey: `${orderId}-material-create`,
  });
  const opening = createInventoryMovement({
    id: `${orderId}-opening`,
    materialId: material.id,
    type: "opening",
    occurredOn: "2026-08-01",
    recordedAt: now(),
    quantityDeltaMilli: 10000,
    valueDeltaMinor: 10000,
    note: "افتتاح مادة",
    operationKey: `${orderId}-opening`,
  });
  const consumption = createInventoryMovement({
    id: `${orderId}-consumption`,
    materialId: material.id,
    type: "consumption",
    occurredOn: "2026-08-05",
    recordedAt: now(),
    quantityDeltaMilli: -1000,
    valueDeltaMinor: -1200,
    note: "استهلاك مثبت",
    operationKey: `${orderId}-consumption`,
    orderId,
  });
  return { material, opening, consumption };
}
describe("ProjectFinancialService", () => {
  it("separates cash, payables, owner capital, and operating expense", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    await finance.record({
      type: "owner_investment_cash",
      amountMinor: 10000,
      occurredOn: "2026-08-23",
      note: "رأس مال افتتاحي",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "investment",
    });
    await finance.record({
      type: "operating_expense_cash",
      amountMinor: 1500,
      occurredOn: "2026-08-23",
      note: "توصيل",
      counterparty: "ناقل",
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
      idempotencyKey: "expense-cash",
    });
    await finance.record({
      type: "operating_expense_payable",
      amountMinor: 2200,
      occurredOn: "2026-08-23",
      note: "مواد مستحقة",
      counterparty: "مورد",
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
      idempotencyKey: "expense-payable",
    });
    await expect(finance.readPosition()).resolves.toMatchObject({
      ok: true,
      value: {
        recordedCashMinor: 8500,
        customerReceivablesMinor: 0,
        supplierPayablesMinor: 2200,
        ownerCapitalRecordedMinor: 10000,
        operatingExpensesRecordedMinor: 3700,
      },
    });
  });

  it("prevents duplicate writes and prevents settling more than a linked payable", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const payable = await finance.record({
      type: "operating_expense_payable",
      amountMinor: 2200,
      occurredOn: "2026-08-23",
      note: "مواد مستحقة",
      counterparty: "مورد",
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
      idempotencyKey: "payable",
    });
    if (!payable.ok) throw new Error("payable should save");
    await expect(
      finance.record({
        type: "operating_expense_payable",
        amountMinor: 2200,
        occurredOn: "2026-08-23",
        note: "مواد مستحقة",
        counterparty: "مورد",
        relatedEventId: null,
        expenseContext: {
          relationship: "project",
          behavior: "variable",
          purpose: "order",
          knowledge: "known",
        },
        idempotencyKey: "payable",
      }),
    ).resolves.toMatchObject({ ok: true, reused: true, value: { id: payable.value.id } });
    await expect(
      finance.record({
        type: "payable_settlement_cash",
        amountMinor: 2300,
        occurredOn: "2026-08-23",
        note: "تسديد",
        counterparty: "مورد",
        relatedEventId: payable.value.id,
        idempotencyKey: "too-much",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(
      finance.record({
        type: "payable_settlement_cash",
        amountMinor: 2200,
        occurredOn: "2026-08-23",
        note: "تسديد",
        counterparty: "مورد",
        relatedEventId: payable.value.id,
        idempotencyKey: "settle",
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(finance.readPosition()).resolves.toMatchObject({
      ok: true,
      value: { recordedCashMinor: -2200, supplierPayablesMinor: 0, operatingExpensesRecordedMinor: 2200 },
    });
  });

  it("calculates a recorded period result from final delivered orders and general expenses without counting owner money", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const cost = calculateCostSnapshot("cost-period", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-01T09:00:00.000Z",
      freshnessDays: null,
    });
    let order = createCraftOrder({
      id: "period-order",
      customerName: "عميلة",
      itemName: "قطعة",
      specifications: "اختبار",
      quantity: 1,
      agreedPriceMinor: 2000,
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
      order = transitionOrder(order, { to, idempotencyKey: `period-${to}`, createdAt: stamp });
    await store.saveOrder({
      id: order.id,
      order,
      deliveryDate: "2026-08-05",
      agreementSource: "test",
      createdAt: "2026-08-01T09:00:00.000Z",
      updatedAt: "2026-08-05T09:00:00.000Z",
    });
    await finance.record({
      type: "operating_expense_cash",
      amountMinor: 300,
      occurredOn: "2026-08-06",
      note: "توصيل",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
      idempotencyKey: "period-expense",
    });
    await finance.record({
      type: "owner_investment_cash",
      amountMinor: 5000,
      occurredOn: "2026-08-06",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "period-investment",
    });
    await finance.record({
      type: "owner_withdrawal_cash",
      amountMinor: 200,
      occurredOn: "2026-08-06",
      note: "سحب",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "period-withdrawal",
    });
    const payable = await finance.record({
      type: "operating_expense_payable",
      amountMinor: 400,
      occurredOn: "2026-08-06",
      note: "مواد مستحقة",
      counterparty: "مورد",
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
      idempotencyKey: "period-payable",
    });
    if (!payable.ok) throw new Error("payable should save");
    await finance.record({
      type: "payable_settlement_cash",
      amountMinor: 400,
      occurredOn: "2026-08-08",
      note: "تسديد مواد",
      counterparty: "مورد",
      relatedEventId: payable.value.id,
      idempotencyKey: "period-settlement",
    });
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: {
        recognizedRevenueMinor: 2000,
        recognizedDirectCostMinor: 500,
        recordedOperatingExpenseMinor: 700,
        resultMinor: 800,
        finalOrderCount: 1,
        excludedOrderCount: 0,
        status: "recorded_only",
      },
    });
  });

  it("recognizes an expense reversal in its correction period without restating the original period or touching orders and inventory", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const source = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 700,
      occurredOn: "2026-08-10",
      note: "مصروف اختبار",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
      idempotencyKey: "period-reversal-source",
    });
    if (!source.ok) throw new Error("source should save");
    await expect(
      finance.reverse({
        sourceEventId: source.value.id,
        occurredOn: "2026-08-20",
        reason: "تصحيح تاريخي موثق",
        idempotencyKey: "period-reversal",
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-15")).resolves.toMatchObject({
      ok: true,
      value: {
        recordedOperatingExpenseMinor: 700,
        projectOperatingExpenseMinor: 700,
        resultMinor: -700,
        expenseNeedsReviewCount: 0,
        status: "recorded_only",
      },
    });
    await expect(finance.readRecordedPeriodResult("2026-08-16", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: {
        recordedOperatingExpenseMinor: -700,
        projectOperatingExpenseMinor: -700,
        resultMinor: 700,
        expenseNeedsReviewCount: 0,
        status: "recorded_only",
      },
    });
    await expect(finance.readFinancialInsights("2026-08-16", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: { costComposition: { operatingExpenseMinor: -700 }, coverage: { fixedExpenseMinor: -700 } },
    });
    await expect(finance.readPosition()).resolves.toMatchObject({
      ok: true,
      value: { recordedCashMinor: 0, operatingExpensesRecordedMinor: 0, projectEventCount: 2 },
    });
    await expect(store.listOrders()).resolves.toMatchObject({ ok: true, value: [] });
    await expect(store.listInventoryMovements()).resolves.toMatchObject({ ok: true, value: [] });
  });

  it("places the delivery in the Asia/Amman period instead of its previous UTC date", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const cost = calculateCostSnapshot("cost-boundary", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 400, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-07-30T09:00:00.000Z",
      freshnessDays: null,
    });
    let order = createCraftOrder({
      id: "boundary-order",
      customerName: "عميلة",
      itemName: "قطعة",
      specifications: "اختبار حد الفترة",
      quantity: 1,
      agreedPriceMinor: 1500,
      costSnapshot: cost,
      createdAt: "2026-07-30T09:00:00.000Z",
    });
    for (const [to, stamp] of [
      ["provisional_agreement", "2026-07-30T10:00:00.000Z"],
      ["confirmed", "2026-07-30T11:00:00.000Z"],
      ["in_progress", "2026-07-31T18:00:00.000Z"],
      ["ready", "2026-07-31T21:00:00.000Z"],
      ["delivered", "2026-07-31T22:30:00.000Z"],
    ] as const)
      order = transitionOrder(order, { to, idempotencyKey: `boundary-${to}`, createdAt: stamp });
    await store.saveOrder({
      id: order.id,
      order,
      deliveryDate: "2026-08-01",
      agreementSource: "test",
      createdAt: "2026-07-30T09:00:00.000Z",
      updatedAt: "2026-07-31T22:30:00.000Z",
    });
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: { recognizedRevenueMinor: 1500, recognizedDirectCostMinor: 400, finalOrderCount: 1 },
    });
  });

  it("keeps an empty period as a known numeric zero", async () => {
    const finance = new ProjectFinancialService(new MemoryLocalStore(), now);
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: {
        recognizedRevenueMinor: 0,
        recognizedDirectCostMinor: 0,
        recordedOperatingExpenseMinor: 0,
        resultMinor: 0,
        finalOrderCount: 0,
        excludedOrderCount: 0,
        status: "recorded_only",
      },
    });
  });

  it("returns an unavailable overall result for invalid period bounds", async () => {
    const finance = new ProjectFinancialService(new MemoryLocalStore(), now);
    await expect(finance.readRecordedPeriodResult("2026-02-30", "2026-02-31")).resolves.toMatchObject({
      ok: true,
      value: {
        resultMinor: null,
        status: "invalid",
        reasons: ["الفترة المحلية غير صالحة؛ لا يمكن بناء نتيجة قابلة للقراءة."],
      },
    });
  });

  it("excludes a delivered order without a final result and marks the period incomplete", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const cost = calculateCostSnapshot("cost-incomplete", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 300, confidence: "estimated" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-01T09:00:00.000Z",
      freshnessDays: null,
    });
    let order = createCraftOrder({
      id: "incomplete-order",
      customerName: "عميلة",
      itemName: "قطعة",
      specifications: "اختبار نقص المعرفة",
      quantity: 1,
      agreedPriceMinor: 1200,
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
      order = transitionOrder(order, { to, idempotencyKey: `incomplete-${to}`, createdAt: stamp });
    await store.saveOrder({
      id: order.id,
      order,
      deliveryDate: "2026-08-05",
      agreementSource: "test",
      createdAt: "2026-08-01T09:00:00.000Z",
      updatedAt: "2026-08-05T09:00:00.000Z",
    });
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: {
        recognizedRevenueMinor: 0,
        recognizedDirectCostMinor: 0,
        resultMinor: 0,
        finalOrderCount: 0,
        excludedOrderCount: 1,
        status: "incomplete",
      },
    });
  });

  it("keeps a shared estimated expense recorded once while marking the period for review", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const payable = await finance.record({
      type: "operating_expense_payable",
      amountMinor: 900,
      occurredOn: "2026-08-12",
      note: "حصة تقديرية من كهرباء",
      counterparty: "شركة الكهرباء",
      relatedEventId: null,
      expenseContext: {
        relationship: "shared",
        behavior: "mixed",
        purpose: "period",
        knowledge: "estimated",
        sharedProjectShare: { basis: "owner_estimate", note: "تقدير المالك" },
      },
      idempotencyKey: "shared-payable",
    });
    if (!payable.ok) throw new Error("shared payable should save");
    await finance.record({
      type: "payable_settlement_cash",
      amountMinor: 900,
      occurredOn: "2026-08-15",
      note: "تسديد كهرباء",
      counterparty: "شركة الكهرباء",
      relatedEventId: payable.value.id,
      idempotencyKey: "shared-settlement",
    });
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: {
        recordedOperatingExpenseMinor: 900,
        resultMinor: -900,
        expenseNeedsReviewCount: 1,
        status: "incomplete",
      },
    });
  });

  it("separates shared project shares from legacy expense context while keeping each expense in the period exactly once", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    await expect(
      finance.record({
        type: "operating_expense_cash",
        amountMinor: 1500,
        occurredOn: "2026-08-12",
        note: "حصة كهرباء ثابتة",
        counterparty: "شركة الكهرباء",
        relatedEventId: null,
        expenseContext: {
          relationship: "shared",
          behavior: "fixed",
          purpose: "period",
          knowledge: "known",
          sharedProjectShare: { basis: "agreed_fixed_share", note: "النسبة المتفق عليها للمشروع" },
        },
        idempotencyKey: "shared-known",
      }),
    ).resolves.toMatchObject({ ok: true });
    const payable = await finance.record({
      type: "operating_expense_payable",
      amountMinor: 800,
      occurredOn: "2026-08-12",
      note: "حصة إنترنت تقديرية",
      counterparty: "شركة الإنترنت",
      relatedEventId: null,
      expenseContext: {
        relationship: "shared",
        behavior: "fixed",
        purpose: "period",
        knowledge: "estimated",
        sharedProjectShare: { basis: "owner_estimate", note: null },
      },
      idempotencyKey: "shared-estimated",
    });
    if (!payable.ok) throw new Error("shared payable should save");
    await finance.record({
      type: "payable_settlement_cash",
      amountMinor: 800,
      occurredOn: "2026-08-15",
      note: "تسديد إنترنت",
      counterparty: "شركة الإنترنت",
      relatedEventId: payable.value.id,
      idempotencyKey: "shared-settlement",
    });
    await store.saveFinancialEvent(
      createFinancialEvent({
        id: "legacy-shared",
        type: "operating_expense_cash",
        amountMinor: 400,
        occurredOn: "2026-08-13",
        recordedAt: now(),
        idempotencyKey: "legacy-shared",
        note: "حصة قديمة بلا مصدر",
        counterparty: null,
        expenseContext: { relationship: "shared", behavior: "fixed", purpose: "period", knowledge: "known" },
      }),
    );
    await store.saveFinancialEvent(
      createFinancialEvent({
        id: "legacy-unclassified",
        type: "operating_expense_cash",
        amountMinor: 300,
        occurredOn: "2026-08-13",
        recordedAt: now(),
        idempotencyKey: "legacy-unclassified",
        note: "مصروف قديم بلا سياق",
        counterparty: null,
      }),
    );
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: {
        recordedOperatingExpenseMinor: 3000,
        projectOperatingExpenseMinor: 0,
        sharedProjectExpenseMinor: 2700,
        legacyUnclassifiedExpenseMinor: 300,
        sharedEstimatedExpenseCount: 1,
        sharedMissingBasisCount: 1,
        legacyUnclassifiedExpenseCount: 1,
        expenseNeedsReviewCount: 3,
        resultMinor: -3000,
        status: "incomplete",
      },
    });
  });

  it("rejects a newly recorded shared expense that does not declare how the project share is known", async () => {
    const finance = new ProjectFinancialService(new MemoryLocalStore(), now);
    await expect(
      finance.record({
        type: "operating_expense_cash",
        amountMinor: 250,
        occurredOn: "2026-08-23",
        note: "حصة بلا مصدر",
        counterparty: null,
        relatedEventId: null,
        expenseContext: { relationship: "shared", behavior: "fixed", purpose: "period", knowledge: "known" },
        idempotencyKey: "shared-missing-basis",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
  });

  it("derives work-name profitability, recorded cost composition, and a conservative coverage indicator", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const cost = calculateCostSnapshot("cost-insight", {
      currency: "JOD",
      materialItems: [
        {
          name: "خشب",
          quantity: 2,
          unit: "قطعة",
          unitPriceMinor: 400,
          priceDate: "2026-08-01",
          source: "user_input",
          confidence: "known",
        },
      ],
      time: { minutes: 60, hourlyRateMinor: 600, confidence: "known" },
      packagingMinor: 100,
      deliveryMinor: 200,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 2,
      createdAt: "2026-08-01T09:00:00.000Z",
      freshnessDays: null,
    });
    let order = createCraftOrder({
      id: "insight-order",
      customerName: "عميلة",
      itemName: "صندوق هدية",
      specifications: "اختبار",
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
      order = transitionOrder(order, { to, idempotencyKey: `insight-${to}`, createdAt: stamp });
    await store.saveOrder({
      id: order.id,
      order,
      deliveryDate: "2026-08-05",
      agreementSource: "test",
      createdAt: "2026-08-01T09:00:00.000Z",
      updatedAt: "2026-08-05T09:00:00.000Z",
    });
    await finance.record({
      type: "operating_expense_cash",
      amountMinor: 1000,
      occurredOn: "2026-08-06",
      note: "اشتراك ثابت",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
      idempotencyKey: "insight-fixed",
    });
    await expect(finance.readFinancialInsights("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: {
        workNames: [
          {
            itemName: "صندوق هدية",
            finalOrderCount: 1,
            deliveredQuantity: 2,
            recognizedRevenueMinor: 5000,
            recognizedDirectCostMinor: 1700,
            directMarginMinor: 3300,
          },
        ],
        costComposition: {
          materialMinor: 800,
          timeMinor: 600,
          packagingMinor: 100,
          deliveryMinor: 200,
          wasteMinor: 0,
          operatingExpenseMinor: 1000,
        },
        coverage: {
          status: "recorded_only",
          fixedExpenseMinor: 1000,
          finalDeliveredQuantity: 2,
          directMarginMinor: 3300,
          breakEvenUnits: 1,
        },
      },
    });
  });

  it("withholds coverage units for variable expenses and keeps liquidity debt separate from cash", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const cost = calculateCostSnapshot("cost-guard", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-01T09:00:00.000Z",
      freshnessDays: null,
    });
    let order = createCraftOrder({
      id: "guard-order",
      customerName: "عميلة",
      itemName: "تعديل",
      specifications: "اختبار",
      quantity: 1,
      agreedPriceMinor: 2000,
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
      order = transitionOrder(order, { to, idempotencyKey: `guard-${to}`, createdAt: stamp });
    await store.saveOrder({
      id: order.id,
      order,
      deliveryDate: "2026-08-05",
      agreementSource: "test",
      createdAt: "2026-08-01T09:00:00.000Z",
      updatedAt: "2026-08-05T09:00:00.000Z",
    });
    await finance.record({
      type: "owner_investment_cash",
      amountMinor: 5000,
      occurredOn: "2026-08-01",
      note: "تمويل",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "guard-investment",
    });
    await finance.record({
      type: "operating_expense_cash",
      amountMinor: 1000,
      occurredOn: "2026-08-06",
      note: "اشتراك ثابت",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
      idempotencyKey: "guard-fixed",
    });
    await finance.record({
      type: "operating_expense_payable",
      amountMinor: 300,
      occurredOn: "2026-08-06",
      note: "توصيل متغير",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
      idempotencyKey: "guard-variable",
    });
    await expect(finance.readFinancialInsights("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: {
        coverage: { status: "incomplete", breakEvenUnits: null },
        liquidity: {
          status: "incomplete",
          recordedCashMinor: 4000,
          supplierPayablesMinor: 300,
          cashCoverageAfterLiabilitiesMinor: 3700,
        },
      },
    });
  });

  it("rejects a new operating expense without its required classification context", async () => {
    const finance = new ProjectFinancialService(new MemoryLocalStore(), now);
    await expect(
      finance.record({
        type: "operating_expense_cash",
        amountMinor: 250,
        occurredOn: "2026-08-23",
        note: "مصروف بلا سياق",
        counterparty: null,
        relatedEventId: null,
        idempotencyKey: "missing-context",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
  });

  it("reverses each supported general event with the opposite financial effect and preserves the original", async () => {
    const cases = [
      {
        type: "owner_investment_cash",
        expected: {
          recordedCashMinor: 0,
          supplierPayablesMinor: 0,
          ownerCapitalRecordedMinor: 0,
          operatingExpensesRecordedMinor: 0,
        },
      },
      {
        type: "owner_withdrawal_cash",
        expected: {
          recordedCashMinor: 0,
          supplierPayablesMinor: 0,
          ownerCapitalRecordedMinor: 0,
          operatingExpensesRecordedMinor: 0,
        },
      },
      {
        type: "operating_expense_cash",
        expected: {
          recordedCashMinor: 0,
          supplierPayablesMinor: 0,
          ownerCapitalRecordedMinor: 0,
          operatingExpensesRecordedMinor: 0,
        },
      },
      {
        type: "operating_expense_payable",
        expected: {
          recordedCashMinor: 0,
          supplierPayablesMinor: 0,
          ownerCapitalRecordedMinor: 0,
          operatingExpensesRecordedMinor: 0,
        },
      },
    ] as const;
    for (const [index, entry] of cases.entries()) {
      const store = new MemoryLocalStore();
      const finance = new ProjectFinancialService(store, now);
      const source = await finance.record({
        type: entry.type,
        amountMinor: 1000,
        occurredOn: "2026-08-23",
        note: `واقعة ${index}`,
        counterparty: null,
        relatedEventId: null,
        expenseContext: entry.type.startsWith("operating_expense")
          ? { relationship: "project", behavior: "variable", purpose: "period", knowledge: "known" }
          : null,
        idempotencyKey: `source-${index}`,
      });
      if (!source.ok) throw new Error("source should save");
      const original = structuredClone(source.value);
      const reversal = await finance.reverse({
        sourceEventId: source.value.id,
        occurredOn: "2026-08-24",
        reason: "تصحيح موثق",
        idempotencyKey: `reverse-${index}`,
      });
      expect(reversal).toMatchObject({
        ok: true,
        value: {
          correctionType: "reverse",
          correctionOfEventId: source.value.id,
          correctionReason: "تصحيح موثق",
          amountMinor: 1000,
          occurredOn: "2026-08-24",
          cashDeltaMinor: -source.value.cashDeltaMinor,
          payableDeltaMinor: -source.value.payableDeltaMinor,
          ownerCapitalDeltaMinor: -source.value.ownerCapitalDeltaMinor,
          operatingExpenseDeltaMinor: -source.value.operatingExpenseDeltaMinor,
        },
      });
      const events = await finance.listEvents();
      if (!events.ok) throw new Error("events should read");
      expect(events.value).toHaveLength(2);
      expect(events.value.find(event => event.id === source.value.id)).toEqual(original);
      await expect(finance.readPosition()).resolves.toMatchObject({ ok: true, value: entry.expected });
    }
    const settlementStore = new MemoryLocalStore();
    const settlementFinance = new ProjectFinancialService(settlementStore, now);
    const payable = await settlementFinance.record({
      type: "operating_expense_payable",
      amountMinor: 1000,
      occurredOn: "2026-08-23",
      note: "التزام",
      counterparty: "مورد",
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "variable",
        purpose: "period",
        knowledge: "known",
      },
      idempotencyKey: "settlement-payable",
    });
    if (!payable.ok) throw new Error("payable should save");
    const settlement = await settlementFinance.record({
      type: "payable_settlement_cash",
      amountMinor: 1000,
      occurredOn: "2026-08-23",
      note: "تسديد",
      counterparty: "مورد",
      relatedEventId: payable.value.id,
      idempotencyKey: "settlement-source",
    });
    if (!settlement.ok) throw new Error("settlement should save");
    await expect(
      settlementFinance.reverse({
        sourceEventId: settlement.value.id,
        occurredOn: "2026-08-24",
        reason: "عكس تسديد موثق",
        idempotencyKey: "settlement-reversal",
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        type: "payable_settlement_cash",
        relatedEventId: payable.value.id,
        cashDeltaMinor: 1000,
        payableDeltaMinor: 1000,
      },
    });
    await expect(settlementFinance.readPosition()).resolves.toMatchObject({
      ok: true,
      value: { recordedCashMinor: 0, supplierPayablesMinor: 1000, operatingExpensesRecordedMinor: 1000 },
    });
  });

  it("makes reversal idempotency safe for repeated calls and rejects a second reversal or key collision", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const source = await finance.record({
      type: "owner_investment_cash",
      amountMinor: 2000,
      occurredOn: "2026-08-23",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "idempotent-source",
    });
    if (!source.ok) throw new Error("source should save");
    const [first, second] = await Promise.all([
      finance.reverse({
        sourceEventId: source.value.id,
        occurredOn: "2026-08-24",
        reason: "تصحيح واحد",
        idempotencyKey: "idempotent-reversal",
      }),
      finance.reverse({
        sourceEventId: source.value.id,
        occurredOn: "2026-08-24",
        reason: "تصحيح واحد",
        idempotencyKey: "idempotent-reversal",
      }),
    ]);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error("reversal should save");
    expect(first.value.id).toBe(second.value.id);
    expect(first.reused || second.reused).toBe(true);
    await expect(
      finance.reverse({
        sourceEventId: source.value.id,
        occurredOn: "2026-08-24",
        reason: "محاولة ثانية",
        idempotencyKey: "different-reversal",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(
      finance.reverse({
        sourceEventId: source.value.id,
        occurredOn: "2026-08-24",
        reason: "تصحيح",
        idempotencyKey: "idempotent-source",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    const events = await finance.listEvents();
    if (!events.ok) throw new Error("events should read");
    expect(events.value).toHaveLength(2);
  });

  it("rejects missing sources, blank reasons, invalid dates, and reversing a reversal without changing history", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    await expect(
      finance.reverse({
        sourceEventId: "missing",
        occurredOn: "2026-08-24",
        reason: "سبب",
        idempotencyKey: "missing-source",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(
      finance.reverse({
        sourceEventId: "",
        occurredOn: "2026-08-24",
        reason: "سبب",
        idempotencyKey: "blank-source",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    const source = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 500,
      occurredOn: "2026-08-23",
      note: "مصروف",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "variable",
        purpose: "period",
        knowledge: "known",
      },
      idempotencyKey: "guard-source",
    });
    if (!source.ok) throw new Error("source should save");
    await expect(
      finance.reverse({
        sourceEventId: source.value.id,
        occurredOn: "2026-08-24",
        reason: " ",
        idempotencyKey: "blank-reason",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(
      finance.reverse({
        sourceEventId: source.value.id,
        occurredOn: "2026-02-30",
        reason: "سبب",
        idempotencyKey: "bad-date",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    const reversal = await finance.reverse({
      sourceEventId: source.value.id,
      occurredOn: "2026-08-24",
      reason: "سبب",
      idempotencyKey: "guard-reversal",
    });
    if (!reversal.ok) throw new Error("reversal should save");
    await expect(
      finance.reverse({
        sourceEventId: reversal.value.id,
        occurredOn: "2026-08-25",
        reason: "عكس العكس",
        idempotencyKey: "double-reversal",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    const events = await finance.listEvents();
    if (!events.ok) throw new Error("events should read");
    expect(events.value).toHaveLength(2);
  });

  it("does not leave an orphan reversal when the atomic correction write fails", async () => {
    class FailingCorrectionStore extends MemoryLocalStore {
      override async commitFinancialEventCorrection() {
        return { ok: false as const, code: "storage_error" as const, message: "simulated write failure" };
      }
    }
    const store = new FailingCorrectionStore();
    const finance = new ProjectFinancialService(store, now);
    const source = await finance.record({
      type: "owner_withdrawal_cash",
      amountMinor: 700,
      occurredOn: "2026-08-23",
      note: "سحب",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "atomic-source",
    });
    if (!source.ok) throw new Error("source should save");
    await expect(
      finance.reverse({
        sourceEventId: source.value.id,
        occurredOn: "2026-08-24",
        reason: "فشل اختبار ذرية",
        idempotencyKey: "atomic-reversal",
      }),
    ).resolves.toMatchObject({ ok: false, code: "storage_error" });
    const events = await finance.listEvents();
    if (!events.ok) throw new Error("events should read");
    expect(events.value).toHaveLength(1);
    expect(events.value[0]?.id).toBe(source.value.id);
  });

  it("derives a percentage share in minor units and includes only the derived share once", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const saved = await finance.record({
      type: "operating_expense_cash",
      occurredOn: "2026-08-23",
      note: "كهرباء مشتركة",
      counterparty: "البيت",
      relatedEventId: null,
      expenseContext: {
        relationship: "shared",
        behavior: "mixed",
        purpose: "period",
        knowledge: "known",
        sharedProjectShare: {
          basis: "agreed_percentage",
          note: "20%",
          allocation: "allocated",
          totalAmountMinor: null,
          percentageBps: null,
          calculatedShareMinor: null,
        },
      },
      sharedExpense: { mode: "percentage", sharedTotalAmountMinor: 333, sharedPercentageBps: 2000 },
      idempotencyKey: "percentage-share",
    });
    expect(saved).toMatchObject({
      ok: true,
      value: {
        amountMinor: 67,
        cashDeltaMinor: -67,
        operatingExpenseDeltaMinor: 67,
        expenseContext: {
          sharedProjectShare: {
            basis: "agreed_percentage",
            totalAmountMinor: 333,
            percentageBps: 2000,
            calculatedShareMinor: 67,
          },
        },
      },
    });
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: {
        sharedProjectExpenseMinor: 67,
        sharedUnallocatedExpenseMinor: 0,
        recordedOperatingExpenseMinor: 67,
        resultMinor: -67,
        status: "recorded_only",
      },
    });
  });

  it("keeps a deferred shared total visible and in cash without treating it as a result expense", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const saved = await finance.record({
      type: "operating_expense_cash",
      occurredOn: "2026-08-23",
      note: "فاتورة منزلية مشتركة",
      counterparty: "البيت",
      relatedEventId: null,
      expenseContext: {
        relationship: "shared",
        behavior: "mixed",
        purpose: "period",
        knowledge: "needs_review",
        sharedProjectShare: {
          basis: "needs_review",
          note: "أحدد الحصة لاحقًا",
          allocation: "unallocated",
          totalAmountMinor: null,
          percentageBps: null,
          calculatedShareMinor: null,
        },
      },
      sharedExpense: { mode: "defer", sharedTotalAmountMinor: 500 },
      idempotencyKey: "deferred-share",
    });
    expect(saved).toMatchObject({
      ok: true,
      value: {
        amountMinor: 500,
        cashDeltaMinor: -500,
        operatingExpenseDeltaMinor: 0,
        expenseContext: { sharedProjectShare: { allocation: "unallocated", totalAmountMinor: 500 } },
      },
    });
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: {
        recordedOperatingExpenseMinor: 0,
        sharedProjectExpenseMinor: 0,
        sharedUnallocatedExpenseMinor: 500,
        sharedUnallocatedExpenseCount: 1,
        expenseNeedsReviewCount: 1,
        resultMinor: 0,
        status: "incomplete",
      },
    });
    await expect(finance.readPosition()).resolves.toMatchObject({
      ok: true,
      value: { recordedCashMinor: -500, operatingExpensesRecordedMinor: 0 },
    });
    if (!saved.ok) throw new Error("deferred share should save");
    await expect(
      finance.reverse({
        sourceEventId: saved.value.id,
        occurredOn: "2026-08-24",
        reason: "حصة تحددت خارج هذا الحدث",
        idempotencyKey: "deferred-reversal",
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(finance.readRecordedPeriodResult("2026-08-23", "2026-08-23")).resolves.toMatchObject({
      ok: true,
      value: {
        sharedUnallocatedExpenseMinor: 500,
        sharedUnallocatedExpenseCount: 1,
        resultMinor: 0,
        status: "incomplete",
      },
    });
    await expect(finance.readRecordedPeriodResult("2026-08-24", "2026-08-24")).resolves.toMatchObject({
      ok: true,
      value: {
        sharedUnallocatedExpenseMinor: -500,
        sharedUnallocatedExpenseCount: 0,
        resultMinor: 0,
        status: "recorded_only",
      },
    });
  });

  it("uses valued consumption for the material component once while retaining non-material Snapshot costs", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const order = completedMaterialOrder("cogs-order");
    const fixture = inventoryFixture(order.id);
    await store.saveOrder({
      id: order.id,
      order,
      deliveryDate: "2026-08-05",
      agreementSource: "test",
      createdAt: order.createdAt,
      updatedAt: "2026-08-05T09:00:00.000Z",
    });
    await store.commitInventory(fixture.material, [fixture.opening, fixture.consumption]);
    const result = await finance.readRecordedPeriodResult("2026-08-01", "2026-08-31");
    expect(result).toMatchObject({
      ok: true,
      value: {
        recognizedRevenueMinor: 3000,
        recognizedDirectCostMinor: 1600,
        snapshotDirectCostMinor: 1600,
        recordedCogsMinor: 1200,
        effectiveDirectCostMinor: 1800,
        cogsStatus: "recorded",
        cogsMissingOrderCount: 0,
        resultMinor: 1200,
        status: "recorded_only",
      },
    });
    if (!result.ok) throw new Error("period result should read");
    expect(result.value.cogsReasons).toEqual([]);
  });

  it("keeps Snapshot as the explicit fallback when consumption is absent and does not call purchase receipt COGS", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const order = completedMaterialOrder("snapshot-order");
    const material = createMaterial({
      id: "snapshot-material",
      name: "خشب",
      unit: "piece",
      createdAt: "2026-08-01T09:00:00.000Z",
      createdOperationKey: "snapshot-material-create",
    });
    const receipt = createInventoryMovement({
      id: "snapshot-receipt",
      materialId: material.id,
      type: "purchase_receipt",
      occurredOn: "2026-08-04",
      recordedAt: now(),
      quantityDeltaMilli: 1000,
      valueDeltaMinor: 1000,
      note: "استلام شراء",
      operationKey: "snapshot-receipt",
      purchaseId: "purchase-1",
    });
    await store.saveOrder({
      id: order.id,
      order,
      deliveryDate: "2026-08-05",
      agreementSource: "test",
      createdAt: order.createdAt,
      updatedAt: "2026-08-05T09:00:00.000Z",
    });
    await store.commitInventory(material, [receipt]);
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: {
        snapshotDirectCostMinor: 1600,
        recordedCogsMinor: 0,
        effectiveDirectCostMinor: 1600,
        cogsStatus: "not_available",
        cogsMissingOrderCount: 1,
        resultMinor: 1400,
        status: "recorded_only",
      },
    });
  });

  it("excludes reversed consumption and unlinked or non-final consumption from COGS without changing the order Snapshot", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const order = completedMaterialOrder("reversal-order");
    const fixture = inventoryFixture(order.id);
    const reversal = createInventoryMovement({
      id: "reversal-consumption",
      materialId: fixture.material.id,
      type: "reversal",
      occurredOn: "2026-08-06",
      recordedAt: now(),
      quantityDeltaMilli: 1000,
      valueDeltaMinor: 1200,
      note: "عكس استهلاك",
      reason: "تصحيح اختبار",
      operationKey: "reversal-consumption",
      reversesMovementId: fixture.consumption.id,
    });
    const unlinked = {
      ...fixture.consumption,
      id: "unlinked-consumption",
      orderId: null,
      operationKey: "unlinked-consumption",
      valueDeltaMinor: -500,
    } as typeof fixture.consumption;
    const nonFinalOrder = completedMaterialOrder("future-order");
    nonFinalOrder.status = "in_progress";
    nonFinalOrder.resultStatus = "incomplete";
    await store.saveOrder({
      id: order.id,
      order,
      deliveryDate: "2026-08-05",
      agreementSource: "test",
      createdAt: order.createdAt,
      updatedAt: "2026-08-05T09:00:00.000Z",
    });
    await store.saveOrder({
      id: nonFinalOrder.id,
      order: nonFinalOrder,
      deliveryDate: "2026-08-05",
      agreementSource: "test",
      createdAt: nonFinalOrder.createdAt,
      updatedAt: "2026-08-05T09:00:00.000Z",
    });
    await store.commitInventory(fixture.material, [fixture.opening, fixture.consumption, reversal, unlinked]);
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: {
        recordedCogsMinor: 0,
        effectiveDirectCostMinor: 1600,
        cogsStatus: "not_available",
        cogsMissingOrderCount: 1,
        resultMinor: 1400,
        status: "incomplete",
      },
    });
  });
});

describe("ProjectFinancialService payable settlements after a reversal (A-01)", () => {
  async function commitmentWithMistakenSettlement() {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const payable = await finance.record({
      type: "operating_expense_payable",
      amountMinor: 10000,
      occurredOn: "2026-08-01",
      note: "التزام مورد",
      counterparty: "مورد",
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
      idempotencyKey: "a01-payable",
    });
    const settlement = await finance.record({
      type: "payable_settlement_cash",
      amountMinor: 6000,
      occurredOn: "2026-08-02",
      note: "دفعة خطأ",
      counterparty: "مورد",
      relatedEventId: payable.ok ? payable.value.id : "",
      idempotencyKey: "a01-settle",
    });
    const reversal = await finance.reverse({
      sourceEventId: settlement.ok ? settlement.value.id : "",
      reason: "دفعة مسجلة بالخطأ",
      occurredOn: "2026-08-03",
      idempotencyKey: "a01-reverse",
    });
    return { store, finance, payable, settlement, reversal };
  }
  it("keeps all three surfaces at the full remaining 10000 after a settlement reversal", async () => {
    const { finance, payable } = await commitmentWithMistakenSettlement();
    const payables = await finance.listSettleablePayables();
    expect(payables.ok).toBe(true);
    const listed = payables.ok
      ? payables.value.find(item => item.event.id === (payable.ok ? payable.value.id : ""))
      : undefined;
    expect(listed?.remainingMinor).toBe(10000);
    const retry = await finance.record({
      type: "payable_settlement_cash",
      amountMinor: 10000,
      occurredOn: "2026-08-04",
      note: "الدفعة الصحيحة",
      counterparty: "مورد",
      relatedEventId: payable.ok ? payable.value.id : "",
      idempotencyKey: "a01-retry",
    });
    expect(retry.ok).toBe(true);
    const afterFullSettlement = await finance.listSettleablePayables();
    expect(
      afterFullSettlement.ok
        ? afterFullSettlement.value.some(item => item.event.id === (payable.ok ? payable.value.id : ""))
        : true,
    ).toBe(false);
  });
  it("still rejects settlements beyond the remaining when a real settlement stands", async () => {
    const { finance, payable } = await commitmentWithMistakenSettlement();
    await finance.record({
      type: "payable_settlement_cash",
      amountMinor: 4000,
      occurredOn: "2026-08-04",
      note: "دفعة جزئية",
      counterparty: "مورد",
      relatedEventId: payable.ok ? payable.value.id : "",
      idempotencyKey: "a01-partial",
    });
    const beyond = await finance.record({
      type: "payable_settlement_cash",
      amountMinor: 6001,
      occurredOn: "2026-08-05",
      note: "تجاوز",
      counterparty: "مورد",
      relatedEventId: payable.ok ? payable.value.id : "",
      idempotencyKey: "a01-beyond",
    });
    expect(beyond.ok).toBe(false);
    if (!beyond.ok) expect(beyond.code).toBe("validation_error");
  });
});

describe("ProjectFinancialService settlement source liveness (A-03)", () => {
  it("rejects settling a reversal record and keeps the ledger at zero net effect", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const payable = await finance.record({
      type: "operating_expense_payable",
      amountMinor: 10000,
      occurredOn: "2026-08-01",
      note: "التزام خطأ",
      counterparty: "مورد",
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
      idempotencyKey: "a03-payable",
    });
    const reversal = await finance.reverse({
      sourceEventId: payable.ok ? payable.value.id : "",
      reason: "سجل بالخطأ",
      occurredOn: "2026-08-02",
      idempotencyKey: "a03-reverse-payable",
    });
    const settleReversal = await finance.record({
      type: "payable_settlement_cash",
      amountMinor: 10000,
      occurredOn: "2026-08-03",
      note: "تسديد على السجل المعكوس",
      counterparty: "مورد",
      relatedEventId: reversal.ok ? reversal.value.id : "",
      idempotencyKey: "a03-settle-reversal",
    });
    expect(settleReversal).toMatchObject({ ok: false, code: "validation_error" });
    const events = await finance.listEvents();
    const totals = events.ok
      ? events.value.reduce(
          (acc, event) => ({
            cash: acc.cash + event.cashDeltaMinor,
            payable: acc.payable + event.payableDeltaMinor,
          }),
          { cash: 0, payable: 0 },
        )
      : null;
    expect(totals).toEqual({ cash: 0, payable: 0 });
  });
  it("rejects settling an already-reversed payable and lists neither it nor its reversal as settleable", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const payable = await finance.record({
      type: "operating_expense_payable",
      amountMinor: 10000,
      occurredOn: "2026-08-01",
      note: "التزام سيعكس",
      counterparty: "مورد",
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
      idempotencyKey: "a03-payable-2",
    });
    const reversal = await finance.reverse({
      sourceEventId: payable.ok ? payable.value.id : "",
      reason: "سجل بالخطأ",
      occurredOn: "2026-08-02",
      idempotencyKey: "a03-reverse-payable-2",
    });
    const settleReversed = await finance.record({
      type: "payable_settlement_cash",
      amountMinor: 5000,
      occurredOn: "2026-08-03",
      note: "تسديد على التزام معكوس",
      counterparty: "مورد",
      relatedEventId: payable.ok ? payable.value.id : "",
      idempotencyKey: "a03-settle-reversed",
    });
    expect(settleReversed).toMatchObject({ ok: false, code: "validation_error" });
    const options = await finance.listSettleablePayables();
    const ids = options.ok ? options.value.map(item => item.event.id) : [];
    expect(ids).not.toContain(payable.ok ? payable.value.id : "");
    expect(ids).not.toContain(reversal.ok ? reversal.value.id : "");
  });
});
