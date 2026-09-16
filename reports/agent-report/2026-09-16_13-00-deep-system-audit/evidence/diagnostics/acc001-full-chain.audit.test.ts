import { describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { LoanService } from "@/application/loans/loanService";
import { AssetService } from "@/application/assets/assetService";
import { calculateCostSnapshot, createCraftOrder, transitionOrder, collectDeposit, registerDebt, collectRegisteredDebt } from "@micro-domain/craft-order/index.js";
import { createInventoryMovement, createMaterial } from "@micro-domain/inventory-material/index.js";

const now = () => "2026-09-16T09:00:00.000Z";

/* AUDIT DIAGNOSTIC (2-b / ACC-001): full end-to-end reconciliation chain.
 * opening balance → sale(order)+collection+debt → expense → supplier purchase+debt
 * → supplier payment → owner capital + owner withdrawal → loan + repayment
 * → material consumption → asset + depreciation.
 * Then compare: cash, receivables, payables, assets, owner funds, period result,
 * and run the integrity checks. Written OUTSIDE the repo (read-only audit). */

describe("ACC-001 full-chain reconciliation diagnostic", () => {
  it("walks the whole chain and compares every balance", async () => {
    const store = new MemoryLocalStore();
    const cash = new CashContinuityService(store, now);
    const suppliers = new SupplierPurchaseService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const statement = new StatementService(store, finance);
    const owner = new OwnerEntitlementService(store, now);
    const loans = new LoanService(store, now);
    const assets = new AssetService(store, now);
    const integrity = new IntegrityCheckService(store, finance, statement, cash, now);

    /* 1. Opening balance: wallet drawer 200.00 */
    const wallet = await cash.openWallet({
      name: "الدرج",
      kind: "cash_drawer",
      openingMinor: 20000,
      occurredOn: "2026-09-01",
      note: "رصيد بداية",
      operationKey: "chain-wallet",
    });
    if (!wallet.ok) throw new Error(wallet.message);

    /* 2. Sale (craft order) price 50.00, snapshot cost: material 10 + time 5 = 15 */
    const snapshot = calculateCostSnapshot("chain-cost", {
      currency: "JOD",
      materialItems: [
        { name: "خشب", quantity: 1, unit: "قطعة", unitPriceMinor: 1000, priceDate: "2026-08-01", source: "user_input", confidence: "known" },
      ],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-09-01T09:00:00.000Z",
      freshnessDays: null,
    });
    let order = createCraftOrder({
      id: "chain-order",
      customerName: "عميلة",
      itemName: "قطعة",
      specifications: "سلسلة التسوية",
      quantity: 1,
      agreedPriceMinor: 5000,
      costSnapshot: snapshot,
      createdAt: "2026-09-01T09:00:00.000Z",
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
    await store.saveOrder({
      id: order.id,
      order,
      deliveryDate: "2026-09-05",
      agreementSource: "test",
      createdAt: order.createdAt,
      updatedAt: "2026-09-10T09:00:00.000Z",
    });

    /* 3. Operating expense cash 3.00 (unallocated) */
    const expense = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 300,
      occurredOn: "2026-09-06",
      note: "توصيل",
      counterparty: null,
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
      idempotencyKey: "chain-expense",
    });
    if (!expense.ok) throw new Error(expense.message);

    /* 4. Supplier purchase 12.00, paid now 4.00 → payable 8.00 */
    const purchase = await suppliers.recordPurchase({
      supplierName: "مورد السلسلة",
      note: "خامات",
      purchasedOn: "2026-09-07",
      dueOn: null,
      totalMinor: 1200,
      initialPaidMinor: 400,
      idempotencyKey: "chain-purchase",
    });
    if (!purchase.ok) throw new Error(purchase.message);

    /* 5. Supplier payment 5.00 FROM WALLET (FIN-003 path) → payable 3.00 */
    const payment = await suppliers.recordPayment({
      purchaseId: purchase.value.id,
      amountMinor: 500,
      occurredOn: "2026-09-08",
      note: "دفعة من المحفظة",
      idempotencyKey: "chain-pay",
      walletId: wallet.value.wallet.id,
    });
    if (!payment.ok) throw new Error(payment.message);

    /* 6. Owner capital injection 100.00 (financial event) + owner withdrawal 15.00 (ledger movement, wallet-sourced) */
    const investment = await finance.record({
      type: "owner_investment_cash",
      amountMinor: 10000,
      occurredOn: "2026-09-03",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "chain-investment",
    });
    if (!investment.ok) throw new Error(investment.message);
    const draw = await owner.recordMovement({
      kind: "draw",
      amountMinor: 1500,
      walletId: wallet.value.wallet.id,
      occurredOn: "2026-09-09",
      note: "سحب شخصي من المحفظة",
      reason: "owner_draw",
      idempotencyKey: "chain-owner-draw",
    });
    if (!draw.ok) throw new Error(draw.message);

    /* 7. Loan out 20.00 + repayment 8.00 */
    const loan = await loans.create({
      borrowerName: "سليم",
      principalMinor: 2000,
      loanDate: "2026-09-08",
      purposeNote: "قرض اختبار",
    });
    if (!loan.ok) throw new Error(loan.message);
    const repayment = await loans.recordRepayment(loan.value.loan.id, {
      amountMinor: 800,
      date: "2026-09-14",
      note: "دفعة سداد",
    });
    if (!repayment.ok) throw new Error(repayment.message);

    /* 8. Material consumption for the order: value 9.00 */
    const material = createMaterial({
      id: "chain-material",
      name: "خشب",
      unit: "piece",
      createdAt: "2026-09-01T09:00:00.000Z",
      createdOperationKey: "chain-material-create",
    });
    const materialOpening = createInventoryMovement({
      id: "chain-mat-opening",
      materialId: material.id,
      type: "opening",
      occurredOn: "2026-09-01",
      recordedAt: now(),
      quantityDeltaMilli: 10000,
      valueDeltaMinor: 10000,
      note: "افتتاح مادة",
      operationKey: "chain-mat-opening",
    });
    const consumption = createInventoryMovement({
      id: "chain-mat-consumption",
      materialId: material.id,
      type: "consumption",
      occurredOn: "2026-09-05",
      recordedAt: now(),
      quantityDeltaMilli: -1000,
      valueDeltaMinor: -900,
      note: "استهلاك مثبت للطلب",
      operationKey: "chain-mat-consumption",
      orderId: order.id,
    });
    const inventory = await store.commitInventory(material, [materialOpening, consumption]);
    if (!inventory.ok) throw new Error("inventory should commit");

    /* 9. Asset 60.00 cash, life 12m from 2026-08-01 + depreciation as of 2026-09-16 (1 month × 5.00) */
    const asset = await assets.create({
      name: "ماكينة",
      acquisitionAmountMinor: 6000,
      acquisitionKind: "cash",
      purchaseDate: "2026-08-01",
      lifeMonths: 12,
      depreciationStartOn: "2026-08-01",
      note: "ماكينة الإنتاج",
    });
    if (!asset.ok) throw new Error(asset.message);
    const depreciation = await assets.recordDepreciation(asset.value.asset.id, { asOf: "2026-09-16" });
    if (!depreciation.ok) throw new Error(depreciation.message);

    /* ── The reconciliation assertions ── */
    const position = await finance.readPosition();
    if (!position.ok) throw new Error(position.message);
    const cashOverview = await cash.overview();
    if (!cashOverview.ok) throw new Error(cashOverview.message);
    const period = await finance.readRecordedPeriodResult("2026-09-01", "2026-09-30");
    if (!period.ok) throw new Error(period.message);

    console.log("position:", JSON.stringify({
      recordedCash: position.value.recordedCashMinor,
      wallets: position.value.walletCashMinor,
      unallocated: position.value.unallocatedCashMinor,
      receivables: position.value.customerReceivablesMinor,
      payables: position.value.supplierPayablesMinor,
      ownerCapital: position.value.ownerCapitalRecordedMinor,
      assets: position.value.assetBookValueMinor,
      loans: position.value.loansOutstandingMinor,
      amanah: position.value.amanahHeldMinor,
    }));
    console.log("period:", JSON.stringify({
      revenue: period.value.recognizedRevenueMinor,
      effectiveCost: period.value.effectiveDirectCostMinor,
      cogs: period.value.recordedCogsMinor,
      opex: period.value.recordedOperatingExpenseMinor,
      depreciation: period.value.assetDepreciationMinor,
      result: period.value.resultMinor,
      status: period.value.status,
    }));

    /* Equation 1: recorded cash = wallets + unallocated */
    expect(position.value.recordedCashMinor).toBe(
      cashOverview.value.totalWalletCashMinor + position.value.unallocatedCashMinor,
    );
    /* Sources walk: 20000 opening + 3000 collections + 10000 investment − 300 expense
     * − 900 supplier paid − 2000 loan + 800 repayment − 6000 asset − 1500 draw = 22100 */
    expect(position.value.recordedCashMinor).toBe(23100);
    expect(cashOverview.value.totalWalletCashMinor).toBe(18000);
    expect(position.value.unallocatedCashMinor).toBe(5100);
    /* Equation 2: receivables = order debt remaining (5000 − 3000 collected) */
    expect(position.value.customerReceivablesMinor).toBe(2000);
    /* Equation 3: payables = supplier remaining (1200 − 400 − 500) */
    expect(position.value.supplierPayablesMinor).toBe(300);
    /* Equation 4: owner funds = investment − draw (both models summed) */
    expect(position.value.ownerCapitalRecordedMinor).toBe(8500);
    /* Equation 5: assets = 6000 − 500 depreciation */
    expect(position.value.assetBookValueMinor).toBe(5500);
    /* Equation 6: loans = 2000 − 800 */
    expect(position.value.loansOutstandingMinor).toBe(1200);
    /* Equation 7: amanah untouched */
    expect(position.value.amanahHeldMinor).toBe(0);
    /* Equation 8: period result = 5000 − (1500−1000+900) − 300 − 500 = 2800 */
    expect(period.value.recognizedRevenueMinor).toBe(5000);
    expect(period.value.effectiveDirectCostMinor).toBe(1400);
    expect(period.value.recordedCogsMinor).toBe(900);
    expect(period.value.recordedOperatingExpenseMinor).toBe(300);
    expect(period.value.assetDepreciationMinor).toBe(500);
    expect(period.value.resultMinor).toBe(2800);
    console.log("period reasons:", JSON.stringify(period.value.reasons));
    expect(period.value.status).toBe("incomplete");
    expect(period.value.reasons).toEqual(["إهلاك مسجّل"]);

    /* The integrity gate over the whole chain */
    const report = await integrity.run();
    console.log("overall:", report.overall);
    console.log("checks:", report.checks.map(check => `${check.id}=${check.status}`).join(" "));
    for (const check of report.checks)
      if (check.status === "FAIL") console.log("FAIL detail:", check.id, check.detailAr);
  });
});
