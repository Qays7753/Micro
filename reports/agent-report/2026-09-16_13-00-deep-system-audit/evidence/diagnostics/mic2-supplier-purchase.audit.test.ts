import { describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";

const now = () => "2026-09-16T09:00:00.000Z";

/* AUDIT DIAGNOSTIC (2-b): does a wallet-attributed supplier payment (FIN-003 fix,
 * sourceRefKind "supplier_purchase") make MIC-2 fail because the integrity
 * service keeps a stale SOURCE_REF_KINDS list without "supplier_purchase"? */

describe("MIC-2 vs supplier_purchase source ref (audit diagnostic)", () => {
  it("supplier wallet payment keeps cash equation intact — check what MIC-2 reports", async () => {
    const store = new MemoryLocalStore();
    const cash = new CashContinuityService(store, now);
    const suppliers = new SupplierPurchaseService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const statement = new StatementService(store, finance);
    const integrity = new IntegrityCheckService(store, finance, statement, cash, now);

    const wallet = await cash.openWallet({
      name: "درج-التشخيص",
      kind: "cash_drawer",
      openingMinor: 10000,
      occurredOn: "2026-09-01",
      note: "رصيد بداية",
      operationKey: "audit-wallet-1",
    });
    if (!wallet.ok) throw new Error(wallet.message);

    const purchase = await suppliers.recordPurchase({
      supplierName: "مورد-التشخيص",
      note: "خامات",
      purchasedOn: "2026-09-10",
      dueOn: null,
      totalMinor: 5000,
      initialPaidMinor: 0,
      idempotencyKey: "audit-purchase-1",
    });
    if (!purchase.ok) throw new Error(purchase.message);

    const payment = await suppliers.recordPayment({
      purchaseId: purchase.value.id,
      amountMinor: 2000,
      occurredOn: "2026-09-12",
      note: "دفعة من المحفظة",
      idempotencyKey: "audit-pay-1",
      walletId: wallet.value.wallet.id,
    });
    if (!payment.ok) throw new Error(payment.message);

    /* The accounting equation itself: recorded cash = wallets + unallocated. */
    const position = await finance.readPosition();
    if (!position.ok) throw new Error(position.message);
    const cashOverview = await cash.overview();
    if (!cashOverview.ok) throw new Error(cashOverview.message);
    expect(position.value.recordedCashMinor).toBe(
      cashOverview.value.totalWalletCashMinor + position.value.unallocatedCashMinor,
    );
    /* wallet 10000 - 2000 = 8000; unallocated = 0 (payment covered from wallet) */
    expect(cashOverview.value.totalWalletCashMinor).toBe(8000);
    expect(position.value.unallocatedCashMinor).toBe(0);
    expect(position.value.recordedCashMinor).toBe(8000);

    /* What does the integrity service report? */
    const report = await integrity.run();
    const mic2 = report.checks.find(check => check.id === "MIC-2");
    console.log("MIC-2 status:", mic2?.status, "| detail:", mic2?.detailAr);
    console.log(
      "overall:",
      report.overall,
      "| all:",
      report.checks.map(check => `${check.id}=${check.status}`).join(" "),
    );
  });
});
