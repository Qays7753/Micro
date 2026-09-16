import { describe, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { calculateCostSnapshot, createCraftOrder, transitionOrder, collectDeposit, registerDebt, collectRegisteredDebt } from "@micro-domain/craft-order/index.js";

const now = () => "2026-09-16T09:00:00.000Z";

describe("debug chain components", () => {
  it("prints all stores after the chain", async () => {
    const store = new MemoryLocalStore();
    const cash = new CashContinuityService(store, now);
    const suppliers = new SupplierPurchaseService(store, now);
    const finance = new ProjectFinancialService(store, now);

    const wallet = await cash.openWallet({
      name: "الدرج", kind: "cash_drawer", openingMinor: 20000,
      occurredOn: "2026-09-01", note: "رصيد بداية", operationKey: "chain-wallet",
    });
    if (!wallet.ok) throw new Error(wallet.message);

    const snapshot = calculateCostSnapshot("chain-cost", {
      currency: "JOD",
      materialItems: [
        { name: "خشب", quantity: 1, unit: "قطعة", unitPriceMinor: 1000, priceDate: "2026-08-01", source: "user_input", confidence: "known" },
      ],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0, deliveryMinor: 0, wasteMinor: 0, safetyBufferMinor: 0,
      quantity: 1, createdAt: "2026-09-01T09:00:00.000Z", freshnessDays: null,
    });
    let order = createCraftOrder({
      id: "chain-order", customerName: "عميلة", itemName: "قطعة", specifications: "سلسلة",
      quantity: 1, agreedPriceMinor: 5000, costSnapshot: snapshot, createdAt: "2026-09-01T09:00:00.000Z",
    });
    order = collectDeposit(order, 2000, "chain-deposit", "2026-09-02T09:00:00.000Z");
    for (const [to, stamp] of [
      ["provisional_agreement", "2026-09-01T10:00:00.000Z"],
      ["confirmed", "2026-09-01T11:00:00.000Z"],
      ["in_progress", "2026-09-03T09:00:00.000Z"],
      ["ready", "2026-09-04T09:00:00.000Z"],
      ["delivered", "2026-09-05T09:00:00.000Z"],
    ] as const)
      order = transitionOrder(order, { to, idempotencyKey: `chain-${to}`, createdAt: stamp });
    order = registerDebt(order, "chain-debt", "2026-09-06T09:00:00.000Z");
    order = collectRegisteredDebt(order, 1000, "chain-debt-collect", "2026-09-10T09:00:00.000Z");
    await store.saveOrder({ id: order.id, order, deliveryDate: "2026-09-05", agreementSource: "test", createdAt: order.createdAt, updatedAt: "2026-09-10T09:00:00.000Z" });

    await finance.record({
      type: "operating_expense_cash", amountMinor: 300, occurredOn: "2026-09-06", note: "توصيل",
      counterparty: null, relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
      idempotencyKey: "chain-expense",
    });
    const purchase = await suppliers.recordPurchase({
      supplierName: "مورد", note: "خامات", purchasedOn: "2026-09-07", dueOn: null,
      totalMinor: 1200, initialPaidMinor: 400, idempotencyKey: "chain-purchase",
    });
    if (!purchase.ok) throw new Error(purchase.message);
    await suppliers.recordPayment({
      purchaseId: purchase.value.id, amountMinor: 500, occurredOn: "2026-09-08",
      note: "دفعة", idempotencyKey: "chain-pay", walletId: wallet.value.wallet.id,
    });
    await finance.record({
      type: "owner_investment_cash", amountMinor: 10000, occurredOn: "2026-09-03",
      note: "استثمار", counterparty: null, relatedEventId: null, idempotencyKey: "chain-investment",
    });

    const events = await store.listFinancialEvents();
    console.log("FINANCIAL EVENTS:");
    for (const event of events.value)
      console.log(`  ${event.type} amount=${event.amountMinor} cashDelta=${event.cashDeltaMinor} occurredOn=${event.occurredOn}`);
    const entries = await store.listCashContinuityEntries();
    console.log("CONTINUITY ENTRIES:");
    for (const entry of entries.value)
      console.log(`  ${entry.type} wallet=${entry.walletId} delta=${entry.cashDeltaMinor} opKey=${entry.operationKey} sourceRefKind=${entry.sourceRefKind ?? "-"}`);
    const orders = await store.listOrders();
    console.log("ORDERS:");
    for (const stored of orders.value)
      console.log(`  ${stored.id} status=${stored.order.status} collected=${stored.order.collectedMinor} receivable=${stored.order.receivableMinor} settlement=${stored.order.settlementStatus}`);
    const purchases = await store.listSupplierPurchases();
    console.log("PURCHASES:");
    for (const p of purchases.value)
      console.log(`  ${p.id} total=${p.totalMinor} paid=${p.paidMinor} payable=${p.payableMinor}`);
    const position = await finance.readPosition();
    console.log("POSITION:", JSON.stringify(position.ok ? position.value : position));
  });
});
