import { describe, expect, it } from "vitest";
import { createFinancialEvent, summarizeFinancialEvents } from "../../src/domain/financial-event/index.js";

const base = { occurredOn: "2026-08-23", recordedAt: "2026-08-23T08:00:00.000Z", note: "اختبار مالي", counterparty: null };
describe("financial event domain core", () => {
  it("keeps owner investment and withdrawal separate from sales and operating expense", () => {
    const investment = createFinancialEvent({ ...base, id: "investment", type: "owner_investment_cash", amountMinor: 10000, idempotencyKey: "investment-1" });
    const withdrawal = createFinancialEvent({ ...base, id: "withdrawal", type: "owner_withdrawal_cash", amountMinor: 2500, idempotencyKey: "withdrawal-1" });
    expect(investment).toMatchObject({ cashDeltaMinor: 10000, ownerCapitalDeltaMinor: 10000, operatingExpenseDeltaMinor: 0 });
    expect(withdrawal).toMatchObject({ cashDeltaMinor: -2500, ownerCapitalDeltaMinor: -2500, operatingExpenseDeltaMinor: 0 });
  });

  it("records a payable expense and its cash settlement without recognizing expense twice", () => {
    const expense = createFinancialEvent({ ...base, id: "payable", type: "operating_expense_payable", amountMinor: 4000, idempotencyKey: "expense-1" });
    const settlement = createFinancialEvent({ ...base, id: "settlement", type: "payable_settlement_cash", amountMinor: 4000, idempotencyKey: "settlement-1", relatedEventId: "payable" });
    expect(summarizeFinancialEvents([expense, settlement])).toEqual({ cashMinor: -4000, payableMinor: 0, ownerCapitalMinor: 0, operatingExpenseMinor: 4000, eventCount: 2 });
  });

  it("rejects missing financial invariants instead of inferring zero or an unlinked payment", () => {
    expect(() => createFinancialEvent({ ...base, id: "bad", type: "operating_expense_cash", amountMinor: 0, idempotencyKey: "bad" })).toThrow("amountMinor");
    expect(() => createFinancialEvent({ ...base, id: "bad-settlement", type: "payable_settlement_cash", amountMinor: 1, idempotencyKey: "bad-settlement" })).toThrow("relatedEventId");
  });
});
