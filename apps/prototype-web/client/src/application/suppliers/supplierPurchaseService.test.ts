import { describe, expect, it } from "vitest";
import { SupplierPurchaseService } from "./supplierPurchaseService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const now = () => "2026-08-23T09:00:00.000Z";
describe("SupplierPurchaseService", () => {
  it("records a partly paid material purchase in cash and payables without operating expense", async () => {
    const store = new MemoryLocalStore();
    const purchases = new SupplierPurchaseService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const purchase = await purchases.recordPurchase({
      supplierName: "مورد الخشب",
      note: "مواد لطلبات قادمة",
      purchasedOn: "2026-08-23",
      dueOn: "2026-08-30",
      totalMinor: 4000,
      initialPaidMinor: 1500,
      idempotencyKey: "purchase-1",
    });
    if (!purchase.ok) throw new Error("purchase should save");
    expect(purchase.value).toMatchObject({ paidMinor: 1500, payableMinor: 2500, status: "partially_paid" });
    await expect(finance.readPosition()).resolves.toMatchObject({
      ok: true,
      value: { recordedCashMinor: -1500, supplierPayablesMinor: 2500, operatingExpensesRecordedMinor: 0 },
    });
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: { recordedOperatingExpenseMinor: 0, resultMinor: 0, status: "recorded_only" },
    });
  });

  it("settles a purchase by partial payments once and rejects overpayment", async () => {
    const store = new MemoryLocalStore();
    const purchases = new SupplierPurchaseService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const purchase = await purchases.recordPurchase({
      supplierName: "مورد القماش",
      note: "مواد",
      purchasedOn: "2026-08-20",
      dueOn: null,
      totalMinor: 2500,
      initialPaidMinor: 0,
      idempotencyKey: "purchase-2",
    });
    if (!purchase.ok) throw new Error("purchase should save");
    await expect(
      purchases.recordPayment({
        purchaseId: purchase.value.id,
        amountMinor: 1000,
        occurredOn: "2026-08-21",
        note: "دفعة أولى",
        idempotencyKey: "payment-1",
      }),
    ).resolves.toMatchObject({ ok: true, value: { payableMinor: 1500, status: "partially_paid" } });
    await expect(
      purchases.recordPayment({
        purchaseId: purchase.value.id,
        amountMinor: 1000,
        occurredOn: "2026-08-21",
        note: "إعادة",
        idempotencyKey: "payment-1",
      }),
    ).resolves.toMatchObject({ ok: true, reused: true });
    await expect(
      purchases.recordPayment({
        purchaseId: purchase.value.id,
        amountMinor: 1600,
        occurredOn: "2026-08-22",
        note: "زائد",
        idempotencyKey: "payment-too-much",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(
      purchases.recordPayment({
        purchaseId: purchase.value.id,
        amountMinor: 1500,
        occurredOn: "2026-08-22",
        note: "الدفعة الأخيرة",
        idempotencyKey: "payment-2",
      }),
    ).resolves.toMatchObject({ ok: true, value: { payableMinor: 0, status: "paid" } });
    await expect(finance.readPosition()).resolves.toMatchObject({
      ok: true,
      value: { recordedCashMinor: -2500, supplierPayablesMinor: 0, operatingExpensesRecordedMinor: 0 },
    });
  });
});
