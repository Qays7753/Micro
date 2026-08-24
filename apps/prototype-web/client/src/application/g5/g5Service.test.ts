import { describe, expect, it } from "vitest";
import { G5Service } from "./g5Service";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder, transitionOrder } from "@micro-domain/craft-order/index.js";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";

const now = () => "2026-08-01T09:00:00.000Z";

function deliveredOrder(id: string, price = 5000) {
  const cost = calculateCostSnapshot(`${id}-cost`, { currency: "JOD", materialItems: [], time: { minutes: 120, hourlyRateMinor: 900, confidence: "known" }, packagingMinor: 0, deliveryMinor: 0, wasteMinor: 0, safetyBufferMinor: 0, quantity: 2, createdAt: "2026-08-01T09:00:00.000Z", freshnessDays: null });
  let order = createCraftOrder({ id, customerName: "عميلة اختبار", itemName: "صندوق", specifications: "مواصفات معلنة", quantity: 2, agreedPriceMinor: price, costSnapshot: cost, createdAt: "2026-08-01T09:00:00.000Z" });
  for (const [to, stamp] of [["provisional_agreement", "2026-08-01T10:00:00.000Z"], ["confirmed", "2026-08-01T11:00:00.000Z"], ["in_progress", "2026-08-02T09:00:00.000Z"], ["ready", "2026-08-03T09:00:00.000Z"], ["delivered", "2026-08-05T09:00:00.000Z"]] as const) order = transitionOrder(order, { to, idempotencyKey: `${id}-${to}`, createdAt: stamp });
  return { id: order.id, order, catalogItemId: null, deliveryDate: "2026-08-05", agreementSource: "رسالة اختبار", createdAt: order.createdAt, updatedAt: "2026-08-05T09:00:00.000Z" };
}

describe("G5 Application service", () => {
  it("maps final orders and fixed expenses into a break-even reading and uses a dated collection declaration", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    const stored = deliveredOrder("g5-order");
    await store.saveOrder(stored);
    await finance.record({ type: "operating_expense_cash", amountMinor: 1000, occurredOn: "2026-08-06", note: "اشتراك ثابت", counterparty: null, relatedEventId: null, expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" }, idempotencyKey: "g5-fixed" });
    const declaration = await g5.createDeclaration({ direction: "collection", amountMinor: stored.order.receivableMinor, dueOn: "2026-08-20", source: "عميلة — اتفاق تحصيل", knowledge: "known", note: "موعد معلن من العميلة", relatedOrderId: stored.id, relatedEventId: null, idempotencyKey: "g5-collection" });
    expect(declaration).toMatchObject({ ok: true, value: { kind: "declaration", relatedOrderId: stored.id } });
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    expect(decision).toMatchObject({ ok: true, value: { period: { status: "available", fixedExpenseMinor: 1000, contributionMarginMinor: 3200, breakEvenUnits: 1 }, shortCash: { status: "available", recordedCashMinor: -1000, declaredCollectionsMinor: 5000, declaredCommitmentsMinor: 0, projectedCashMinor: 4000 } } });
  });

  it("keeps declarations idempotent and reverses without mutating the original or financial records", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    const stored = deliveredOrder("g5-reversal-order");
    await store.saveOrder(stored);
    const input = { direction: "collection" as const, amountMinor: stored.order.receivableMinor, dueOn: "2026-08-20", source: "عميلة — موعد قديم", knowledge: "known" as const, note: "إعلان أولي", relatedOrderId: stored.id, relatedEventId: null, idempotencyKey: "same-declaration" };
    const first = await g5.createDeclaration(input);
    const retry = await g5.createDeclaration(input);
    if (!first.ok || !retry.ok) throw new Error("declaration should save");
    expect(retry).toMatchObject({ ok: true, reused: true, value: { id: first.value.id } });
    const reversed = await g5.reverseDeclaration(first.value.id, "تغير موعد التحصيل", "reverse-declaration");
    expect(reversed).toMatchObject({ ok: true, value: { kind: "reversal", reversalOfId: first.value.id } });
    const secondReverse = await g5.reverseDeclaration(first.value.id, "محاولة عكس ثانية", "reverse-declaration-2");
    expect(secondReverse).toMatchObject({ ok: false, code: "validation_error" });
    const declarations = await g5.listDeclarations();
    expect(declarations).toMatchObject({ ok: true, value: [{ kind: "declaration" }, { kind: "reversal" }] });
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    expect(decision).toMatchObject({ ok: true, value: { shortCash: { status: "incomplete", projectedCashMinor: null, declaredCollectionsMinor: 0, undatedReceivablesMinor: stored.order.receivableMinor } } });
    await expect(store.getOrder(stored.id)).resolves.toMatchObject({ ok: true, value: { order: stored.order } });
  });

  it("rejects active linked collection declarations that exceed one order receivable", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    const stored = deliveredOrder("g5-over-allocation-order", 5000);
    await store.saveOrder(stored);
    const input = { direction: "collection" as const, amountMinor: 3000, dueOn: "2026-08-20", source: "إعلان أول", knowledge: "known" as const, note: "تحصيل معلن أول", relatedOrderId: stored.id, relatedEventId: null, idempotencyKey: "g5-over-allocation-first" };
    const first = await g5.createDeclaration(input);
    const second = await g5.createDeclaration({ ...input, source: "إعلان ثان", note: "تحصيل معلن ثان", idempotencyKey: "g5-over-allocation-second" });
    expect(first).toMatchObject({ ok: true, value: { amountMinor: 3000, relatedOrderId: stored.id } });
    expect(second).toMatchObject({ ok: false, code: "validation_error" });
    const declarations = await g5.listDeclarations();
    expect(declarations).toMatchObject({ ok: true, value: [{ kind: "declaration", amountMinor: 3000, relatedOrderId: stored.id }] });
    await expect(store.getOrder(stored.id)).resolves.toMatchObject({ ok: true, value: { order: { receivableMinor: 5000 } } });
  });

  it("includes a supplier due date as a recorded short commitment and leaves the purchase outside contribution cost", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, finance, now);
    await store.saveSupplierPurchase(createSupplierPurchase({ id: "g5-purchase", supplierName: "مورد", note: "مواد", purchasedOn: "2026-08-01", dueOn: "2026-08-18", totalMinor: 14000, initialPaidMinor: 0, recordedAt: now(), idempotencyKey: "g5-purchase" }));
    const decision = await g5.readDecision("2026-08-01", "2026-08-31");
    expect(decision).toMatchObject({ ok: true, value: { period: { totalVariableCostMinor: 0 }, shortCash: { status: "available", declaredCommitmentsMinor: 14000, projectedCashMinor: -14000 } } });
  });
});
