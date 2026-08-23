import { describe, expect, it } from "vitest";
import { ProjectFinancialService } from "./projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder, transitionOrder } from "@micro-domain/craft-order/index.js";

const now = () => "2026-08-23T09:00:00.000Z";
describe("ProjectFinancialService", () => {
  it("separates cash, payables, owner capital, and operating expense", async () => {
    const store = new MemoryLocalStore(); const finance = new ProjectFinancialService(store, now);
    await finance.record({ type: "owner_investment_cash", amountMinor: 10000, occurredOn: "2026-08-23", note: "رأس مال افتتاحي", counterparty: null, relatedEventId: null, idempotencyKey: "investment" });
    await finance.record({ type: "operating_expense_cash", amountMinor: 1500, occurredOn: "2026-08-23", note: "توصيل", counterparty: "ناقل", relatedEventId: null, expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" }, idempotencyKey: "expense-cash" });
    await finance.record({ type: "operating_expense_payable", amountMinor: 2200, occurredOn: "2026-08-23", note: "مواد مستحقة", counterparty: "مورد", relatedEventId: null, expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" }, idempotencyKey: "expense-payable" });
    await expect(finance.readPosition()).resolves.toMatchObject({ ok: true, value: { recordedCashMinor: 8500, customerReceivablesMinor: 0, supplierPayablesMinor: 2200, ownerCapitalRecordedMinor: 10000, operatingExpensesRecordedMinor: 3700 } });
  });

  it("prevents duplicate writes and prevents settling more than a linked payable", async () => {
    const store = new MemoryLocalStore(); const finance = new ProjectFinancialService(store, now);
    const payable = await finance.record({ type: "operating_expense_payable", amountMinor: 2200, occurredOn: "2026-08-23", note: "مواد مستحقة", counterparty: "مورد", relatedEventId: null, expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" }, idempotencyKey: "payable" }); if (!payable.ok) throw new Error("payable should save");
    await expect(finance.record({ type: "operating_expense_payable", amountMinor: 2200, occurredOn: "2026-08-23", note: "مواد مستحقة", counterparty: "مورد", relatedEventId: null, expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" }, idempotencyKey: "payable" })).resolves.toMatchObject({ ok: true, reused: true, value: { id: payable.value.id } });
    await expect(finance.record({ type: "payable_settlement_cash", amountMinor: 2300, occurredOn: "2026-08-23", note: "تسديد", counterparty: "مورد", relatedEventId: payable.value.id, idempotencyKey: "too-much" })).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(finance.record({ type: "payable_settlement_cash", amountMinor: 2200, occurredOn: "2026-08-23", note: "تسديد", counterparty: "مورد", relatedEventId: payable.value.id, idempotencyKey: "settle" })).resolves.toMatchObject({ ok: true });
    await expect(finance.readPosition()).resolves.toMatchObject({ ok: true, value: { recordedCashMinor: -2200, supplierPayablesMinor: 0, operatingExpensesRecordedMinor: 2200 } });
  });

  it("calculates a recorded period result from final delivered orders and general expenses without counting owner money", async () => {
    const store = new MemoryLocalStore(); const finance = new ProjectFinancialService(store, now);
    const cost = calculateCostSnapshot("cost-period", { currency: "JOD", materialItems: [], time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" }, packagingMinor: 0, deliveryMinor: 0, wasteMinor: 0, safetyBufferMinor: 0, quantity: 1, createdAt: "2026-08-01T09:00:00.000Z", freshnessDays: null });
    let order = createCraftOrder({ id: "period-order", customerName: "عميلة", itemName: "قطعة", specifications: "اختبار", quantity: 1, agreedPriceMinor: 2000, costSnapshot: cost, createdAt: "2026-08-01T09:00:00.000Z" });
    for (const [to, stamp] of [["provisional_agreement", "2026-08-01T10:00:00.000Z"], ["confirmed", "2026-08-01T11:00:00.000Z"], ["in_progress", "2026-08-02T09:00:00.000Z"], ["ready", "2026-08-03T09:00:00.000Z"], ["delivered", "2026-08-05T09:00:00.000Z"]] as const) order = transitionOrder(order, { to, idempotencyKey: `period-${to}`, createdAt: stamp });
    await store.saveOrder({ id: order.id, order, deliveryDate: "2026-08-05", agreementSource: "test", createdAt: "2026-08-01T09:00:00.000Z", updatedAt: "2026-08-05T09:00:00.000Z" });
    await finance.record({ type: "operating_expense_cash", amountMinor: 300, occurredOn: "2026-08-06", note: "توصيل", counterparty: null, relatedEventId: null, expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" }, idempotencyKey: "period-expense" });
    await finance.record({ type: "owner_investment_cash", amountMinor: 5000, occurredOn: "2026-08-06", note: "استثمار", counterparty: null, relatedEventId: null, idempotencyKey: "period-investment" });
    await finance.record({ type: "owner_withdrawal_cash", amountMinor: 200, occurredOn: "2026-08-06", note: "سحب", counterparty: null, relatedEventId: null, idempotencyKey: "period-withdrawal" });
    const payable = await finance.record({ type: "operating_expense_payable", amountMinor: 400, occurredOn: "2026-08-06", note: "مواد مستحقة", counterparty: "مورد", relatedEventId: null, expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" }, idempotencyKey: "period-payable" }); if (!payable.ok) throw new Error("payable should save");
    await finance.record({ type: "payable_settlement_cash", amountMinor: 400, occurredOn: "2026-08-08", note: "تسديد مواد", counterparty: "مورد", relatedEventId: payable.value.id, idempotencyKey: "period-settlement" });
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({ ok: true, value: { recognizedRevenueMinor: 2000, recognizedDirectCostMinor: 500, recordedOperatingExpenseMinor: 700, resultMinor: 800, finalOrderCount: 1, excludedOrderCount: 0, status: "recorded_only" } });
  });

  it("places the delivery in the Asia/Amman period instead of its previous UTC date", async () => {
    const store = new MemoryLocalStore(); const finance = new ProjectFinancialService(store, now);
    const cost = calculateCostSnapshot("cost-boundary", { currency: "JOD", materialItems: [], time: { minutes: 60, hourlyRateMinor: 400, confidence: "known" }, packagingMinor: 0, deliveryMinor: 0, wasteMinor: 0, safetyBufferMinor: 0, quantity: 1, createdAt: "2026-07-30T09:00:00.000Z", freshnessDays: null });
    let order = createCraftOrder({ id: "boundary-order", customerName: "عميلة", itemName: "قطعة", specifications: "اختبار حد الفترة", quantity: 1, agreedPriceMinor: 1500, costSnapshot: cost, createdAt: "2026-07-30T09:00:00.000Z" });
    for (const [to, stamp] of [["provisional_agreement", "2026-07-30T10:00:00.000Z"], ["confirmed", "2026-07-30T11:00:00.000Z"], ["in_progress", "2026-07-31T18:00:00.000Z"], ["ready", "2026-07-31T21:00:00.000Z"], ["delivered", "2026-07-31T22:30:00.000Z"]] as const) order = transitionOrder(order, { to, idempotencyKey: `boundary-${to}`, createdAt: stamp });
    await store.saveOrder({ id: order.id, order, deliveryDate: "2026-08-01", agreementSource: "test", createdAt: "2026-07-30T09:00:00.000Z", updatedAt: "2026-07-31T22:30:00.000Z" });
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({ ok: true, value: { recognizedRevenueMinor: 1500, recognizedDirectCostMinor: 400, finalOrderCount: 1 } });
  });

  it("excludes a delivered order without a final result and marks the period incomplete", async () => {
    const store = new MemoryLocalStore(); const finance = new ProjectFinancialService(store, now);
    const cost = calculateCostSnapshot("cost-incomplete", { currency: "JOD", materialItems: [], time: { minutes: 60, hourlyRateMinor: 300, confidence: "estimated" }, packagingMinor: 0, deliveryMinor: 0, wasteMinor: 0, safetyBufferMinor: 0, quantity: 1, createdAt: "2026-08-01T09:00:00.000Z", freshnessDays: null });
    let order = createCraftOrder({ id: "incomplete-order", customerName: "عميلة", itemName: "قطعة", specifications: "اختبار نقص المعرفة", quantity: 1, agreedPriceMinor: 1200, costSnapshot: cost, createdAt: "2026-08-01T09:00:00.000Z" });
    for (const [to, stamp] of [["provisional_agreement", "2026-08-01T10:00:00.000Z"], ["confirmed", "2026-08-01T11:00:00.000Z"], ["in_progress", "2026-08-02T09:00:00.000Z"], ["ready", "2026-08-03T09:00:00.000Z"], ["delivered", "2026-08-05T09:00:00.000Z"]] as const) order = transitionOrder(order, { to, idempotencyKey: `incomplete-${to}`, createdAt: stamp });
    await store.saveOrder({ id: order.id, order, deliveryDate: "2026-08-05", agreementSource: "test", createdAt: "2026-08-01T09:00:00.000Z", updatedAt: "2026-08-05T09:00:00.000Z" });
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({ ok: true, value: { recognizedRevenueMinor: 0, recognizedDirectCostMinor: 0, resultMinor: 0, finalOrderCount: 0, excludedOrderCount: 1, status: "incomplete" } });
  });

  it("keeps a shared estimated expense recorded once while marking the period for review", async () => {
    const store = new MemoryLocalStore(); const finance = new ProjectFinancialService(store, now);
    const payable = await finance.record({ type: "operating_expense_payable", amountMinor: 900, occurredOn: "2026-08-12", note: "حصة تقديرية من كهرباء", counterparty: "شركة الكهرباء", relatedEventId: null, expenseContext: { relationship: "shared", behavior: "mixed", purpose: "period", knowledge: "estimated" }, idempotencyKey: "shared-payable" }); if (!payable.ok) throw new Error("shared payable should save");
    await finance.record({ type: "payable_settlement_cash", amountMinor: 900, occurredOn: "2026-08-15", note: "تسديد كهرباء", counterparty: "شركة الكهرباء", relatedEventId: payable.value.id, idempotencyKey: "shared-settlement" });
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({ ok: true, value: { recordedOperatingExpenseMinor: 900, resultMinor: -900, expenseNeedsReviewCount: 1, status: "incomplete" } });
  });

  it("rejects a new operating expense without its required classification context", async () => {
    const finance = new ProjectFinancialService(new MemoryLocalStore(), now);
    await expect(finance.record({ type: "operating_expense_cash", amountMinor: 250, occurredOn: "2026-08-23", note: "مصروف بلا سياق", counterparty: null, relatedEventId: null, idempotencyKey: "missing-context" })).resolves.toMatchObject({ ok: false, code: "validation_error" });
  });
});
