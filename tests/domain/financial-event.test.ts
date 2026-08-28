import { describe, expect, it } from "vitest";
import {
  activeSettlementsMinor,
  createFinancialEvent,
  createFinancialReversal,
  reversedEventIds,
  summarizeFinancialEvents,
} from "../../src/domain/financial-event/index.js";

const base = {
  occurredOn: "2026-08-23",
  recordedAt: "2026-08-23T08:00:00.000Z",
  note: "اختبار مالي",
  counterparty: null,
};
describe("financial event domain core", () => {
  it("keeps owner investment and withdrawal separate from sales and operating expense", () => {
    const investment = createFinancialEvent({
      ...base,
      id: "investment",
      type: "owner_investment_cash",
      amountMinor: 10000,
      idempotencyKey: "investment-1",
    });
    const withdrawal = createFinancialEvent({
      ...base,
      id: "withdrawal",
      type: "owner_withdrawal_cash",
      amountMinor: 2500,
      idempotencyKey: "withdrawal-1",
    });
    expect(investment).toMatchObject({
      cashDeltaMinor: 10000,
      ownerCapitalDeltaMinor: 10000,
      operatingExpenseDeltaMinor: 0,
    });
    expect(withdrawal).toMatchObject({
      cashDeltaMinor: -2500,
      ownerCapitalDeltaMinor: -2500,
      operatingExpenseDeltaMinor: 0,
    });
  });

  it("records a payable expense and its cash settlement without recognizing expense twice", () => {
    const expense = createFinancialEvent({
      ...base,
      id: "payable",
      type: "operating_expense_payable",
      amountMinor: 4000,
      idempotencyKey: "expense-1",
    });
    const settlement = createFinancialEvent({
      ...base,
      id: "settlement",
      type: "payable_settlement_cash",
      amountMinor: 4000,
      idempotencyKey: "settlement-1",
      relatedEventId: "payable",
    });
    expect(summarizeFinancialEvents([expense, settlement])).toEqual({
      cashMinor: -4000,
      payableMinor: 0,
      ownerCapitalMinor: 0,
      operatingExpenseMinor: 4000,
      eventCount: 2,
    });
  });

  it("preserves a sourced shared project share without changing its financial deltas", () => {
    const expense = createFinancialEvent({
      ...base,
      id: "shared",
      type: "operating_expense_cash",
      amountMinor: 1250,
      idempotencyKey: "shared-1",
      expenseContext: {
        relationship: "shared",
        behavior: "mixed",
        purpose: "period",
        knowledge: "estimated",
        sharedProjectShare: { basis: "owner_estimate", note: "نصف فاتورة الإنترنت" },
      },
    });
    expect(expense).toMatchObject({
      expenseContext: {
        relationship: "shared",
        behavior: "mixed",
        purpose: "period",
        knowledge: "estimated",
        sharedProjectShare: { basis: "owner_estimate", note: "نصف فاتورة الإنترنت" },
      },
      cashDeltaMinor: -1250,
      payableDeltaMinor: 0,
      operatingExpenseDeltaMinor: 1250,
    });
    expect(() =>
      createFinancialEvent({
        ...base,
        id: "bad-context",
        type: "owner_withdrawal_cash",
        amountMinor: 1,
        idempotencyKey: "bad-context",
        expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
      }),
    ).toThrow("expenseContext");
  });

  it("rejects a shared-share basis that disagrees with knowledge or belongs to a project-only expense", () => {
    expect(() =>
      createFinancialEvent({
        ...base,
        id: "bad-shared-knowledge",
        type: "operating_expense_cash",
        amountMinor: 100,
        idempotencyKey: "bad-shared-knowledge",
        expenseContext: {
          relationship: "shared",
          behavior: "fixed",
          purpose: "period",
          knowledge: "known",
          sharedProjectShare: { basis: "owner_estimate", note: null },
        },
      }),
    ).toThrow("sharedProjectShare");
    expect(() =>
      createFinancialEvent({
        ...base,
        id: "bad-project-share",
        type: "operating_expense_cash",
        amountMinor: 100,
        idempotencyKey: "bad-project-share",
        expenseContext: {
          relationship: "project",
          behavior: "fixed",
          purpose: "period",
          knowledge: "known",
          sharedProjectShare: { basis: "agreed_fixed_share", note: null },
        },
      }),
    ).toThrow("sharedProjectShare");
  });

  it("rejects missing financial invariants instead of inferring zero or an unlinked payment", () => {
    expect(() =>
      createFinancialEvent({
        ...base,
        id: "bad",
        type: "operating_expense_cash",
        amountMinor: 0,
        idempotencyKey: "bad",
      }),
    ).toThrow("amountMinor");
    expect(() =>
      createFinancialEvent({
        ...base,
        id: "bad-settlement",
        type: "payable_settlement_cash",
        amountMinor: 1,
        idempotencyKey: "bad-settlement",
      }),
    ).toThrow("relatedEventId");
  });

  it("creates one full, linked reversal for every supported general event type without mutating the original", () => {
    const cases = [
      ["owner_investment_cash", null],
      ["owner_withdrawal_cash", null],
      ["operating_expense_cash", null],
      ["operating_expense_payable", null],
      ["payable_settlement_cash", "payable-source"],
    ] as const;
    for (const [type, relatedEventId] of cases) {
      const source = createFinancialEvent({
        ...base,
        id: `source-${type}`,
        type,
        amountMinor: 1250,
        idempotencyKey: `source-${type}`,
        relatedEventId,
      });
      const original = structuredClone(source);
      const reversal = createFinancialReversal({
        id: `reversal-${type}`,
        sourceEvent: source,
        occurredOn: "2026-08-24",
        recordedAt: "2026-08-24T08:00:00.000Z",
        idempotencyKey: `reversal-${type}`,
        reason: "  سبب موثق  ",
      });
      expect(reversal).toMatchObject({
        type,
        amountMinor: source.amountMinor,
        occurredOn: "2026-08-24",
        correctionType: "reverse",
        correctionOfEventId: source.id,
        correctionReason: "سبب موثق",
        relatedEventId,
        cashDeltaMinor: -source.cashDeltaMinor,
        payableDeltaMinor: -source.payableDeltaMinor,
        ownerCapitalDeltaMinor: -source.ownerCapitalDeltaMinor,
        operatingExpenseDeltaMinor: -source.operatingExpenseDeltaMinor,
      });
      expect(source).toEqual(original);
    }
  });

  it("rejects blank reversal reasons, invalid dates, and reversing an already reversed source", () => {
    const source = createFinancialEvent({
      ...base,
      id: "source",
      type: "operating_expense_cash",
      amountMinor: 500,
      idempotencyKey: "source",
    });
    expect(() =>
      createFinancialReversal({
        id: "blank-reason",
        sourceEvent: source,
        occurredOn: "2026-08-24",
        recordedAt: "2026-08-24T08:00:00.000Z",
        idempotencyKey: "blank-reason",
        reason: " ",
      }),
    ).toThrow("reason");
    expect(() =>
      createFinancialReversal({
        id: "bad-date",
        sourceEvent: source,
        occurredOn: "2026-02-30",
        recordedAt: "2026-08-24T08:00:00.000Z",
        idempotencyKey: "bad-date",
        reason: "سبب",
      }),
    ).toThrow("occurredOn");
    const reversal = createFinancialReversal({
      id: "reversal",
      sourceEvent: source,
      occurredOn: "2026-08-24",
      recordedAt: "2026-08-24T08:00:00.000Z",
      idempotencyKey: "reversal",
      reason: "سبب",
    });
    expect(() =>
      createFinancialReversal({
        id: "double",
        sourceEvent: reversal,
        occurredOn: "2026-08-25",
        recordedAt: "2026-08-25T08:00:00.000Z",
        idempotencyKey: "double",
        reason: "سبب ثان",
      }),
    ).toThrow("reversal");
  });

  it("calculates and preserves a shared percentage in minor JOD units", () => {
    const expense = createFinancialEvent({
      ...base,
      id: "shared-percentage",
      type: "operating_expense_cash",
      amountMinor: 617,
      idempotencyKey: "shared-percentage",
      expenseContext: {
        relationship: "shared",
        behavior: "mixed",
        purpose: "period",
        knowledge: "known",
        sharedProjectShare: {
          basis: "agreed_percentage",
          note: "20% للمشروع",
          allocation: "allocated",
          totalAmountMinor: 3083,
          percentageBps: 2000,
          calculatedShareMinor: 617,
        },
      },
    });
    expect(expense).toMatchObject({
      amountMinor: 617,
      operatingExpenseDeltaMinor: 617,
      expenseContext: {
        sharedProjectShare: {
          basis: "agreed_percentage",
          totalAmountMinor: 3083,
          percentageBps: 2000,
          calculatedShareMinor: 617,
        },
      },
    });
    expect(() =>
      createFinancialEvent({
        ...base,
        id: "wrong-percentage",
        type: "operating_expense_cash",
        amountMinor: 616,
        idempotencyKey: "wrong-percentage",
        expenseContext: {
          relationship: "shared",
          behavior: "mixed",
          purpose: "period",
          knowledge: "known",
          sharedProjectShare: {
            basis: "agreed_percentage",
            note: null,
            allocation: "allocated",
            totalAmountMinor: 3083,
            percentageBps: 2000,
            calculatedShareMinor: 617,
          },
        },
      }),
    ).toThrow("amountMinor");
  });

  it("keeps an explicitly deferred shared total in cash/payables but out of operating result", () => {
    const deferredCash = createFinancialEvent({
      ...base,
      id: "deferred-cash",
      type: "operating_expense_cash",
      amountMinor: 5000,
      idempotencyKey: "deferred-cash",
      expenseContext: {
        relationship: "shared",
        behavior: "mixed",
        purpose: "period",
        knowledge: "needs_review",
        sharedProjectShare: {
          basis: "needs_review",
          note: "لم أحدد حصة المشروع",
          allocation: "unallocated",
          totalAmountMinor: 5000,
          percentageBps: null,
          calculatedShareMinor: null,
        },
      },
    });
    const deferredPayable = createFinancialEvent({
      ...base,
      id: "deferred-payable",
      type: "operating_expense_payable",
      amountMinor: 5000,
      idempotencyKey: "deferred-payable",
      expenseContext: {
        relationship: "shared",
        behavior: "mixed",
        purpose: "period",
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
    });
    expect(deferredCash).toMatchObject({ cashDeltaMinor: -5000, operatingExpenseDeltaMinor: 0 });
    expect(deferredPayable).toMatchObject({ payableDeltaMinor: 5000, operatingExpenseDeltaMinor: 0 });
    expect(() =>
      createFinancialEvent({
        ...base,
        id: "bad-deferred",
        type: "operating_expense_cash",
        amountMinor: 0,
        idempotencyKey: "bad-deferred",
        expenseContext: {
          relationship: "shared",
          behavior: "mixed",
          purpose: "period",
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
      }),
    ).toThrow("amountMinor");
  });
});

describe("active settlements against a payable", () => {
  const payable = createFinancialEvent({
    ...base,
    id: "payable",
    type: "operating_expense_payable",
    amountMinor: 10000,
    idempotencyKey: "payable-1",
  });
  const settlement = createFinancialEvent({
    ...base,
    id: "settlement",
    type: "payable_settlement_cash",
    amountMinor: 6000,
    idempotencyKey: "settlement-1",
    relatedEventId: payable.id,
  });
  const settlementReversal = createFinancialReversal({
    id: "settlement-reversal",
    idempotencyKey: "settlement-reversal-1",
    reason: "دفعة مسجلة بالخطأ",
    occurredOn: "2026-08-24",
    recordedAt: "2026-08-24T08:00:00.000Z",
    sourceEvent: settlement,
  });
  it("counts a live settlement and excludes the reversal record itself", () => {
    expect(activeSettlementsMinor([payable, settlement], payable.id)).toBe(6000);
    expect(activeSettlementsMinor([payable, settlement, settlementReversal], payable.id)).toBe(0);
    expect(reversedEventIds([payable, settlement, settlementReversal])).toEqual(new Set([settlement.id]));
  });
  it("restores the full commitment after a settlement reversal and counts a replacement settlement", () => {
    const replacement = createFinancialEvent({
      ...base,
      id: "replacement-settlement",
      type: "payable_settlement_cash",
      amountMinor: 4000,
      idempotencyKey: "replacement-1",
      relatedEventId: payable.id,
    });
    const events = [payable, settlement, settlementReversal, replacement];
    expect(activeSettlementsMinor(events, payable.id)).toBe(4000);
    expect(payable.amountMinor - activeSettlementsMinor(events, payable.id)).toBe(6000);
  });
  it("never mixes settlements across commitments", () => {
    const otherPayable = createFinancialEvent({
      ...base,
      id: "other-payable",
      type: "operating_expense_payable",
      amountMinor: 3000,
      idempotencyKey: "other-payable-1",
    });
    expect(activeSettlementsMinor([payable, otherPayable, settlement], otherPayable.id)).toBe(0);
  });
});
