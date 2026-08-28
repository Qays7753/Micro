import { describe, expect, it } from "vitest";
import { G5Service } from "./g5Service";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import {
  calculateCostSnapshot,
  createCraftOrder,
  registerDebt,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import {
  createCatalogItem,
  createDirectConversion,
  createMeasurementUnit,
} from "@micro-domain/catalog/index.js";

const now = () => "2026-08-01T09:00:00.000Z";

function deliveredOrder(id: string, price = 5000) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 120, hourlyRateMinor: 900, confidence: "known" },
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
    customerName: "عميلة اختبار",
    itemName: "صندوق",
    specifications: "مواصفات معلنة",
    quantity: 2,
    agreedPriceMinor: price,
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
  return {
    id: order.id,
    order,
    catalogItemId: null,
    deliveryDate: "2026-08-05",
    agreementSource: "رسالة اختبار",
    createdAt: order.createdAt,
    updatedAt: "2026-08-05T09:00:00.000Z",
  };
}

describe("G5 Application service", () => {
  it("maps final orders and fixed expenses into a break-even reading and uses a dated collection declaration", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    const stored = deliveredOrder("g5-order");
    stored.order = registerDebt(stored.order, "g5-order-debt", "2026-08-06T09:00:00.000Z");
    await store.saveOrder(stored);
    await finance.record({
      type: "operating_expense_cash",
      amountMinor: 1000,
      occurredOn: "2026-08-06",
      note: "اشتراك ثابت",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
      idempotencyKey: "g5-fixed",
    });
    const declaration = await g5.createDeclaration({
      direction: "collection",
      amountMinor: stored.order.receivableMinor,
      dueOn: "2026-08-20",
      source: "عميلة — اتفاق تحصيل",
      knowledge: "known",
      note: "موعد معلن من العميلة",
      relatedOrderId: stored.id,
      relatedEventId: null,
      idempotencyKey: "g5-collection",
    });
    expect(declaration).toMatchObject({
      ok: true,
      value: { kind: "declaration", relatedOrderId: stored.id },
    });
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    expect(decision).toMatchObject({
      ok: true,
      value: {
        period: {
          status: "available",
          fixedExpenseMinor: 1000,
          contributionMarginMinor: 3200,
          breakEvenUnits: 1,
        },
        shortCash: {
          status: "available",
          recordedCashMinor: -1000,
          declaredCollectionsMinor: 5000,
          declaredCommitmentsMinor: 0,
          projectedCashMinor: 4000,
        },
      },
    });
  });

  it("keeps declarations idempotent and reverses without mutating the original or financial records", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    const stored = deliveredOrder("g5-reversal-order");
    stored.order = registerDebt(stored.order, "g5-reversal-debt", "2026-08-06T09:00:00.000Z");
    await store.saveOrder(stored);
    const input = {
      direction: "collection" as const,
      amountMinor: stored.order.receivableMinor,
      dueOn: "2026-08-20",
      source: "عميلة — موعد قديم",
      knowledge: "known" as const,
      note: "إعلان أولي",
      relatedOrderId: stored.id,
      relatedEventId: null,
      idempotencyKey: "same-declaration",
    };
    const first = await g5.createDeclaration(input);
    const retry = await g5.createDeclaration(input);
    if (!first.ok || !retry.ok) throw new Error("declaration should save");
    expect(retry).toMatchObject({ ok: true, reused: true, value: { id: first.value.id } });
    const emptyReason = await g5.reverseDeclaration(first.value.id, "   ", "reverse-empty-reason");
    expect(emptyReason).toMatchObject({ ok: false, code: "validation_error" });
    await expect(g5.listDeclarations()).resolves.toMatchObject({
      ok: true,
      value: [{ kind: "declaration", id: first.value.id }],
    });
    const userReason = "العميلة أكدت موعد تحصيل مختلفًا";
    const reversed = await g5.reverseDeclaration(first.value.id, userReason, "reverse-declaration");
    expect(reversed).toMatchObject({
      ok: true,
      value: { kind: "reversal", reversalOfId: first.value.id, note: userReason },
    });
    const secondReverse = await g5.reverseDeclaration(
      first.value.id,
      "محاولة عكس ثانية",
      "reverse-declaration-2",
    );
    expect(secondReverse).toMatchObject({ ok: false, code: "validation_error" });
    const declarations = await g5.listDeclarations();
    expect(declarations).toMatchObject({ ok: true, value: [{ kind: "declaration" }, { kind: "reversal" }] });
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    expect(decision).toMatchObject({
      ok: true,
      value: {
        shortCash: {
          status: "incomplete",
          projectedCashMinor: null,
          declaredCollectionsMinor: 0,
          undatedReceivablesMinor: stored.order.receivableMinor,
        },
      },
    });
    await expect(store.getOrder(stored.id)).resolves.toMatchObject({
      ok: true,
      value: { order: stored.order },
    });
  });

  it("rejects active linked collection declarations that exceed one order receivable", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    const stored = deliveredOrder("g5-over-allocation-order", 5000);
    stored.order = registerDebt(stored.order, "g5-over-debt", "2026-08-06T09:00:00.000Z");
    await store.saveOrder(stored);
    const input = {
      direction: "collection" as const,
      amountMinor: 3000,
      dueOn: "2026-08-20",
      source: "إعلان أول",
      knowledge: "known" as const,
      note: "تحصيل معلن أول",
      relatedOrderId: stored.id,
      relatedEventId: null,
      idempotencyKey: "g5-over-allocation-first",
    };
    const first = await g5.createDeclaration(input);
    const second = await g5.createDeclaration({
      ...input,
      source: "إعلان ثان",
      note: "تحصيل معلن ثان",
      idempotencyKey: "g5-over-allocation-second",
    });
    expect(first).toMatchObject({ ok: true, value: { amountMinor: 3000, relatedOrderId: stored.id } });
    expect(second).toMatchObject({ ok: false, code: "validation_error" });
    const declarations = await g5.listDeclarations();
    expect(declarations).toMatchObject({
      ok: true,
      value: [{ kind: "declaration", amountMinor: 3000, relatedOrderId: stored.id }],
    });
    await expect(store.getOrder(stored.id)).resolves.toMatchObject({
      ok: true,
      value: { order: { receivableMinor: 5000 } },
    });
  });

  it("includes a supplier due date as a recorded short commitment and leaves the purchase outside contribution cost", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "g5-purchase",
        supplierName: "مورد",
        note: "مواد",
        purchasedOn: "2026-08-01",
        dueOn: "2026-08-18",
        totalMinor: 14000,
        initialPaidMinor: 0,
        recordedAt: now(),
        idempotencyKey: "g5-purchase",
      }),
    );
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    expect(decision).toMatchObject({
      ok: true,
      value: {
        period: { totalVariableCostMinor: 0 },
        shortCash: { status: "available", declaredCommitmentsMinor: 14000, projectedCashMinor: -14000 },
      },
    });
  });

  it("normalizes compatible catalog units through an exact G4-A conversion before G5 aggregation", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    const piece = createMeasurementUnit({
      id: "unit-piece",
      nameAr: "قطعة",
      dimension: "count",
      symbol: null,
      createdAt: now(),
      createdOperationKey: "unit-piece",
    });
    const box = createMeasurementUnit({
      id: "unit-box",
      nameAr: "صندوق",
      dimension: "count",
      symbol: null,
      createdAt: now(),
      createdOperationKey: "unit-box",
    });
    const pieceItem = createCatalogItem({
      id: "item-piece",
      kind: "product",
      name: "قطعة",
      unitLabel: "قطعة",
      unitId: piece.id,
      createdAt: now(),
      createdOperationKey: "item-piece",
    });
    const boxItem = createCatalogItem({
      id: "item-box",
      kind: "product",
      name: "صندوق",
      unitLabel: "صندوق",
      unitId: box.id,
      createdAt: now(),
      createdOperationKey: "item-box",
    });
    const conversion = createDirectConversion({
      id: "box-to-piece",
      fromUnitId: box.id,
      toUnitId: piece.id,
      dimension: "count",
      numerator: 2,
      denominator: 1,
      note: "الصندوق وحدتان",
      createdAt: now(),
      createdOperationKey: "box-to-piece",
    });
    await store.saveMeasurementUnit(piece);
    await store.saveMeasurementUnit(box);
    await store.saveCatalogItem(pieceItem);
    await store.saveCatalogItem(boxItem);
    await store.saveDirectConversion(conversion);
    const pieceOrder = deliveredOrder("g5-piece-order");
    const boxOrder = deliveredOrder("g5-box-order");
    await store.saveOrder({ ...pieceOrder, catalogItemId: pieceItem.id });
    await store.saveOrder({ ...boxOrder, catalogItemId: boxItem.id });
    await finance.record({
      type: "operating_expense_cash",
      amountMinor: 1000,
      occurredOn: "2026-08-06",
      note: "ثابت معروف",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
      idempotencyKey: "g5-conversion-fixed",
    });
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    expect(decision).toMatchObject({
      ok: true,
      value: {
        period: {
          status: "available",
          totalQuantityMilli: 6000,
          quantityUnitKey: "unit-piece",
          breakEvenUnits: 1,
        },
      },
    });
  });

  it("offers only outstanding linkable sources and makes reversal retry idempotent", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    const stored = deliveredOrder("g5-link-options");
    stored.order = registerDebt(stored.order, "g5-link-debt", "2026-08-06T09:00:00.000Z");
    await store.saveOrder(stored);
    const options = await g5.listLinkOptions();
    expect(options).toMatchObject({
      ok: true,
      value: { orders: [{ id: stored.id, amountMinor: stored.order.receivableMinor }], payableEvents: [] },
    });
    const created = await g5.createDeclaration({
      direction: "collection",
      amountMinor: stored.order.receivableMinor,
      dueOn: "2026-08-20",
      source: "عميلة",
      knowledge: "known",
      note: "موعد معلن",
      relatedOrderId: stored.id,
      relatedEventId: null,
      idempotencyKey: "g5-link-declaration",
    });
    if (!created.ok) throw new Error("declaration should save");
    const first = await g5.reverseDeclaration(created.value.id, "تغير الموعد", "g5-link-reversal");
    const retry = await g5.reverseDeclaration(created.value.id, "تغير الموعد", "g5-link-reversal");
    expect(first).toMatchObject({ ok: true, value: { kind: "reversal" } });
    expect(retry).toMatchObject({ ok: true, reused: true, value: { kind: "reversal" } });
  });
});

describe("G5 payable link options after a settlement reversal (A-01)", () => {
  it("shows the full commitment remaining after a mistaken settlement was reversed", async () => {
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
      idempotencyKey: "a01-g5-payable",
    });
    const settlement = await finance.record({
      type: "payable_settlement_cash",
      amountMinor: 6000,
      occurredOn: "2026-08-02",
      note: "دفعة خطأ",
      counterparty: "مورد",
      relatedEventId: payable.ok ? payable.value.id : "",
      idempotencyKey: "a01-g5-settle",
    });
    await finance.reverse({
      sourceEventId: settlement.ok ? settlement.value.id : "",
      reason: "دفعة مسجلة بالخطأ",
      occurredOn: "2026-08-03",
      idempotencyKey: "a01-g5-reverse",
    });
    const g5 = new G5Service(store, finance, now);
    const options = await g5.listLinkOptions();
    expect(options).toMatchObject({
      ok: true,
      value: {
        payableEvents: [{ id: payable.ok ? payable.value.id : "", amountMinor: 10000 }],
      },
    });
  });
});

describe("G5 expense readings after reversals (C-01)", () => {
  async function storeWithReversedFixedExpense(occurredOn: string, reversedOn: string) {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const expense = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 1000,
      occurredOn,
      note: "مصروف ثابت",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
      idempotencyKey: "c01-expense",
    });
    await finance.reverse({
      sourceEventId: expense.ok ? expense.value.id : "",
      reason: "خطأ في الإدخال",
      occurredOn: reversedOn,
      idempotencyKey: "c01-reverse",
    });
    return { store, finance };
  }
  it("drops a fixed expense reversed within the same period, agreeing with the G3 netted reading", async () => {
    const { store, finance } = await storeWithReversedFixedExpense("2026-08-05", "2026-08-06");
    const g5 = new G5Service(store, finance, now);
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    const period = await finance.readRecordedPeriodResult("2026-08-01", "2026-08-31");
    expect(decision).toMatchObject({ ok: true, value: { period: { fixedExpenseMinor: 0 } } });
    expect(period).toMatchObject({ ok: true, value: { recordedOperatingExpenseMinor: 0 } });
  });
  it("keeps the expense in the window where it was recorded when the reversal lands in a later window", async () => {
    const { store, finance } = await storeWithReversedFixedExpense("2026-08-05", "2026-09-02");
    const g5 = new G5Service(store, finance, now);
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    const period = await finance.readRecordedPeriodResult("2026-08-01", "2026-08-31");
    expect(decision).toMatchObject({ ok: true, value: { period: { fixedExpenseMinor: 1000 } } });
    expect(period).toMatchObject({ ok: true, value: { recordedOperatingExpenseMinor: 1000 } });
  });
  it("no longer double-counts an unallocated shared expense when its reversal lands in the same window", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const expense = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 5000,
      occurredOn: "2026-08-05",
      note: "فاتورة بيت",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "shared",
        behavior: "mixed",
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
      idempotencyKey: "c01-unallocated",
      sharedExpense: { mode: "defer", sharedTotalAmountMinor: 5000 },
    });
    await finance.reverse({
      sourceEventId: expense.ok ? expense.value.id : "",
      reason: "فاتورة مكررة",
      occurredOn: "2026-08-06",
      idempotencyKey: "c01-unallocated-reverse",
    });
    const g5 = new G5Service(store, finance, now);
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    expect(decision.ok && decision.value.period.fixedExpenseMinor).toBe(0);
    const gapReasons = decision.ok
      ? decision.value.period.reasons.filter(reason => reason.includes("غير محمل لغياب مصدر الحصة"))
      : [];
    expect(gapReasons).toHaveLength(0);
  });
});

describe("G5 short-cash receivables count only registered debt (A-05)", () => {
  it("excludes a never-agreed draft while including a delivered order whose remainder was registered as debt", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    const draftSnapshot = calculateCostSnapshot("a05-draft-cost", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-10T09:00:00.000Z",
      freshnessDays: null,
    });
    const draft = createCraftOrder({
      id: "a05-draft",
      customerName: "سارة",
      itemName: "إطار",
      specifications: "مسودة",
      quantity: 1,
      agreedPriceMinor: 3000,
      costSnapshot: draftSnapshot,
      createdAt: "2026-08-10T09:00:00.000Z",
    });
    await store.saveOrder({
      id: draft.id,
      order: draft,
      catalogItemId: null,
      deliveryDate: "",
      agreementSource: null,
      createdAt: draft.createdAt,
      updatedAt: draft.createdAt,
    });
    const delivered = deliveredOrder("a05-debt", 5000);
    const debtor = registerDebt(delivered.order, "a05-debt-key", "2026-08-06T09:00:00.000Z");
    await store.saveOrder({ ...delivered, order: debtor });
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    expect(decision).toMatchObject({ ok: true });
    if (decision.ok) {
      expect(decision.value.shortCash.undatedReceivablesMinor).toBe(5000);
      const debtReason = decision.value.shortCash.reasons.find(reason => reason.includes("دين عميل"));
      expect(debtReason).toContain("عميلة اختبار");
      expect(debtReason).not.toContain("سارة");
    }
  });
  it("agrees with the financial pulse on what a registered debt is", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    const pulseService = new FinancialPulseService(store);
    const draftSnapshot = calculateCostSnapshot("a05-agree-cost", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-10T09:00:00.000Z",
      freshnessDays: null,
    });
    const draft = createCraftOrder({
      id: "a05-agree-draft",
      customerName: "ليان",
      itemName: "لوح",
      specifications: "مسودة",
      quantity: 1,
      agreedPriceMinor: 2000,
      costSnapshot: draftSnapshot,
      createdAt: "2026-08-11T09:00:00.000Z",
    });
    await store.saveOrder({
      id: draft.id,
      order: draft,
      catalogItemId: null,
      deliveryDate: "",
      agreementSource: null,
      createdAt: draft.createdAt,
      updatedAt: draft.createdAt,
    });
    const delivered = deliveredOrder("a05-agree-debt", 5000);
    const debtor = registerDebt(delivered.order, "a05-agree-debt-key", "2026-08-06T09:00:00.000Z");
    await store.saveOrder({ ...delivered, order: debtor });
    const pulse = await pulseService.read();
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    expect(pulse.ok && pulse.pulse.registeredDebtMinor).toBe(5000);
    expect(decision.ok && decision.value.shortCash.undatedReceivablesMinor).toBe(5000);
  });
});
