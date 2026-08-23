import { describe, expect, it } from "vitest";
import { ProjectFinancialService } from "./projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const now = () => "2026-08-23T09:00:00.000Z";
describe("ProjectFinancialService", () => {
  it("separates cash, payables, owner capital, and operating expense", async () => {
    const store = new MemoryLocalStore(); const finance = new ProjectFinancialService(store, now);
    await finance.record({ type: "owner_investment_cash", amountMinor: 10000, occurredOn: "2026-08-23", note: "رأس مال افتتاحي", counterparty: null, relatedEventId: null, idempotencyKey: "investment" });
    await finance.record({ type: "operating_expense_cash", amountMinor: 1500, occurredOn: "2026-08-23", note: "توصيل", counterparty: "ناقل", relatedEventId: null, idempotencyKey: "expense-cash" });
    await finance.record({ type: "operating_expense_payable", amountMinor: 2200, occurredOn: "2026-08-23", note: "مواد مستحقة", counterparty: "مورد", relatedEventId: null, idempotencyKey: "expense-payable" });
    await expect(finance.readPosition()).resolves.toMatchObject({ ok: true, value: { recordedCashMinor: 8500, customerReceivablesMinor: 0, supplierPayablesMinor: 2200, ownerCapitalRecordedMinor: 10000, operatingExpensesRecordedMinor: 3700 } });
  });

  it("prevents duplicate writes and prevents settling more than a linked payable", async () => {
    const store = new MemoryLocalStore(); const finance = new ProjectFinancialService(store, now);
    const payable = await finance.record({ type: "operating_expense_payable", amountMinor: 2200, occurredOn: "2026-08-23", note: "مواد مستحقة", counterparty: "مورد", relatedEventId: null, idempotencyKey: "payable" }); if (!payable.ok) throw new Error("payable should save");
    await expect(finance.record({ type: "operating_expense_payable", amountMinor: 2200, occurredOn: "2026-08-23", note: "مواد مستحقة", counterparty: "مورد", relatedEventId: null, idempotencyKey: "payable" })).resolves.toMatchObject({ ok: true, reused: true, value: { id: payable.value.id } });
    await expect(finance.record({ type: "payable_settlement_cash", amountMinor: 2300, occurredOn: "2026-08-23", note: "تسديد", counterparty: "مورد", relatedEventId: payable.value.id, idempotencyKey: "too-much" })).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(finance.record({ type: "payable_settlement_cash", amountMinor: 2200, occurredOn: "2026-08-23", note: "تسديد", counterparty: "مورد", relatedEventId: payable.value.id, idempotencyKey: "settle" })).resolves.toMatchObject({ ok: true });
    await expect(finance.readPosition()).resolves.toMatchObject({ ok: true, value: { recordedCashMinor: -2200, supplierPayablesMinor: 0, operatingExpensesRecordedMinor: 2200 } });
  });
});
