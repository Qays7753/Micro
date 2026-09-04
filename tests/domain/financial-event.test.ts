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
      amanahMinor: 0,
      /* المجموعة ٤: الطبقات الجديدة تُقرأ صفرًا للأحداث القديمة — سابقة الأمانات. */
      assetMinor: 0,
      loanMinor: 0,
      retainedDepositRevenueMinor: 0,
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
    ).toThrow("سياق المصروف يخص المصروفات التشغيلية فقط.");
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
    ).toThrow("حصة المصروف المشترك لا تطابق درجة المعرفة المعلنة.");
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
    ).toThrow("حصة المشروع المشتركة تخص المصروفات المشتركة فقط.");
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
    ).toThrow("المبلغ");
    expect(() =>
      createFinancialEvent({
        ...base,
        id: "bad-settlement",
        type: "payable_settlement_cash",
        amountMinor: 1,
        idempotencyKey: "bad-settlement",
      }),
    ).toThrow("تسديد الالتزام يتطلب التزامًا مرتبطًا.");
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
    ).toThrow("السبب");
    expect(() =>
      createFinancialReversal({
        id: "bad-date",
        sourceEvent: source,
        occurredOn: "2026-02-30",
        recordedAt: "2026-08-24T08:00:00.000Z",
        idempotencyKey: "bad-date",
        reason: "سبب",
      }),
    ).toThrow("تاريخ الحركة");
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
    ).toThrow("لا يمكن التراجع عن سجل تراجع سابق.");
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
    ).toThrow("المبلغ");
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
    ).toThrow("المبلغ");
  });

  /* المجموعة ٤ (عقد ٢٩): الأصول والقروض والعربون المحتفظ به — طبقات مستقلة
   * بدلتات معلنة، وسلوك تبعية سياق صريح، وعكس كامل للأعمدة الجديدة — داخل
   * الوصف الأول (تحذير أسطره القائم مُمتص، لا يُضاعف). */
  /* المجموعة ٤ (عقد ٢٩): الأصول والقروض والعربون المحتفظ به — طبقات مستقلة
   * بدلتات معلنة، وسلوك تبعية سياق صريح، وعكس كامل للأعمدة الجديدة.
   * داخل الوصف الأول نفسه (تحذير الأسطر القائم مُمتص لا يُضاعف). */
  const contextBase = {
    occurredOn: "2026-09-01",
    recordedAt: "2026-09-01T08:00:00.000Z",
    note: "اختبار المجموعة ٤",
    counterparty: null,
  };
  it("records an asset purchase as cash out and book value up, never as operating expense", () => {
    const event = createFinancialEvent({
      ...contextBase,
      id: "asset-cash",
      type: "asset_purchase_cash",
      amountMinor: 60000,
      idempotencyKey: "asset-cash-1",
      assetContext: { assetId: "asset-1", name: "ثلاجة" },
    });
    expect(event.cashDeltaMinor).toBe(-60000);
    expect(event.assetDeltaMinor).toBe(60000);
    expect(event.operatingExpenseDeltaMinor).toBe(0);
    expect(event.ownerCapitalDeltaMinor).toBe(0);
  });
  it("records an asset purchase on payables without touching cash or expense", () => {
    const event = createFinancialEvent({
      ...contextBase,
      id: "asset-payable",
      type: "asset_purchase_payable",
      amountMinor: 60000,
      idempotencyKey: "asset-payable-1",
      assetContext: { assetId: "asset-1", name: "ثلاجة" },
    });
    expect(event.cashDeltaMinor).toBe(0);
    expect(event.payableDeltaMinor).toBe(60000);
    expect(event.assetDeltaMinor).toBe(60000);
  });
  it("records depreciation, write-off, and disposal with non-cash clarity", () => {
    const depreciation = createFinancialEvent({
      ...contextBase,
      id: "dep",
      type: "asset_depreciation",
      amountMinor: 2500,
      idempotencyKey: "dep-1",
      assetContext: { assetId: "asset-1", name: "ثلاجة" },
    });
    expect(depreciation.cashDeltaMinor).toBe(0);
    expect(depreciation.assetDeltaMinor).toBe(-2500);
    expect(depreciation.operatingExpenseDeltaMinor).toBe(0);
    const writeOff = createFinancialEvent({
      ...contextBase,
      id: "writeoff",
      type: "asset_writeoff",
      amountMinor: 57500,
      idempotencyKey: "writeoff-1",
      assetContext: { assetId: "asset-1", name: "ثلاجة" },
    });
    expect(writeOff.assetDeltaMinor).toBe(-57500);
    expect(writeOff.cashDeltaMinor).toBe(0);
    const disposal = createFinancialEvent({
      ...contextBase,
      id: "disposal",
      type: "asset_disposal_cash",
      amountMinor: 30000,
      idempotencyKey: "disposal-1",
      assetContext: { assetId: "asset-1", name: "ثلاجة", bookValueMinor: 57500 },
    });
    expect(disposal.cashDeltaMinor).toBe(30000);
    expect(disposal.assetDeltaMinor).toBe(-57500);
  });
  it("keeps loans separate from expense, owner money, and revenue", () => {
    const loan = createFinancialEvent({
      ...contextBase,
      id: "loan-out",
      type: "loan_outgoing_cash",
      amountMinor: 15000,
      idempotencyKey: "loan-out-1",
      loanContext: { loanId: "loan-1", borrower: "أحمد" },
    });
    expect(loan.cashDeltaMinor).toBe(-15000);
    expect(loan.loanDeltaMinor).toBe(15000);
    expect(loan.operatingExpenseDeltaMinor).toBe(0);
    expect(loan.ownerCapitalDeltaMinor).toBe(0);
    const repayment = createFinancialEvent({
      ...contextBase,
      id: "loan-rep",
      type: "loan_repayment_cash",
      amountMinor: 5000,
      idempotencyKey: "loan-rep-1",
      loanContext: { loanId: "loan-1", borrower: "أحمد" },
    });
    expect(repayment.cashDeltaMinor).toBe(5000);
    expect(repayment.loanDeltaMinor).toBe(-5000);
    expect(repayment.revenueDeltaMinor ?? 0).toBe(0);
  });
  it("classifies a retained deposit as revenue or owner money without new cash", () => {
    const revenue = createFinancialEvent({
      ...contextBase,
      id: "dep-rev",
      type: "deposit_retained_revenue",
      amountMinor: 5000,
      idempotencyKey: "dep-rev-1",
      depositContext: { orderId: "order-1" },
    });
    expect(revenue.revenueDeltaMinor).toBe(5000);
    expect(revenue.cashDeltaMinor).toBe(0);
    const owner = createFinancialEvent({
      ...contextBase,
      id: "dep-owner",
      type: "deposit_retained_owner",
      amountMinor: 5000,
      idempotencyKey: "dep-owner-1",
      depositContext: { orderId: "order-1" },
    });
    expect(owner.ownerCapitalDeltaMinor).toBe(5000);
    expect(owner.cashDeltaMinor).toBe(0);
    expect(owner.revenueDeltaMinor ?? 0).toBe(0);
  });
  it("rejects missing or misplaced linked contexts", () => {
    expect(() =>
      createFinancialEvent({
        ...contextBase,
        id: "asset-ctx",
        type: "asset_depreciation",
        amountMinor: 2500,
        idempotencyKey: "asset-ctx-1",
      }),
    ).toThrow(/سياق الأصل/);
    expect(() =>
      createFinancialEvent({
        ...contextBase,
        id: "loan-ctx",
        type: "loan_outgoing_cash",
        amountMinor: 1500,
        idempotencyKey: "loan-ctx-1",
        assetContext: { assetId: "asset-1", name: "ثلاجة" },
      }),
    ).toThrow(/سياق الأصل يخص أحداث الأصول فقط/);
    expect(() =>
      createFinancialEvent({
        ...contextBase,
        id: "dep-ctx",
        type: "deposit_retained_revenue",
        amountMinor: 1500,
        idempotencyKey: "dep-ctx-1",
        depositContext: { orderId: " " },
      }),
    ).toThrow(/معرف الطلب/);
    expect(() =>
      createFinancialEvent({
        ...contextBase,
        id: "misplaced",
        type: "operating_expense_cash",
        amountMinor: 1500,
        idempotencyKey: "misplaced-1",
        loanContext: { loanId: "loan-1", borrower: "أحمد" },
      }),
    ).toThrow(/سياق القرض يخص أحداث القروض فقط/);
    expect(() =>
      createFinancialEvent({
        ...contextBase,
        id: "disposal-nbv",
        type: "asset_disposal_cash",
        amountMinor: 1500,
        idempotencyKey: "disposal-nbv-1",
        assetContext: { assetId: "asset-1", name: "ثلاجة" },
      }),
    ).toThrow(/الرصيد الدفتري/);
  });
  it("reverses a group 4 event by negating every new column and carrying its context", () => {
    const disposal = createFinancialEvent({
      ...contextBase,
      id: "disposal-rev",
      type: "asset_disposal_cash",
      amountMinor: 30000,
      idempotencyKey: "disposal-rev-1",
      assetContext: { assetId: "asset-1", name: "ثلاجة", bookValueMinor: 57500 },
    });
    const reversal = createFinancialReversal({
      id: "disposal-reversal",
      sourceEvent: disposal,
      occurredOn: "2026-09-05",
      recordedAt: "2026-09-05T08:00:00.000Z",
      idempotencyKey: "disposal-reversal-1",
      reason: "تصحيح تخلص",
    });
    expect(reversal.cashDeltaMinor).toBe(-30000);
    expect(reversal.assetDeltaMinor).toBe(57500);
    expect(reversal.assetContext?.assetId).toBe("asset-1");
    expect(reversal.correctionOfEventId).toBe("disposal-rev");
    const revenue = createFinancialEvent({
      ...contextBase,
      id: "rev",
      type: "deposit_retained_revenue",
      amountMinor: 5000,
      idempotencyKey: "rev-1",
      depositContext: { orderId: "order-1" },
    });
    const revenueReversal = createFinancialReversal({
      id: "rev-reversal",
      sourceEvent: revenue,
      occurredOn: "2026-09-05",
      recordedAt: "2026-09-05T08:00:00.000Z",
      idempotencyKey: "rev-reversal-1",
      reason: "إعادة تصنيف",
    });
    expect(revenueReversal.revenueDeltaMinor).toBe(-5000);
    expect(revenueReversal.depositContext?.orderId).toBe("order-1");
  });
  it("summarizes the new layers in totals including reversal netting", () => {
    const loanOut = createFinancialEvent({
      ...contextBase,
      id: "loan-sum",
      type: "loan_outgoing_cash",
      amountMinor: 15000,
      idempotencyKey: "loan-sum-1",
      loanContext: { loanId: "loan-1", borrower: "أحمد" },
    });
    const loanReversal = createFinancialReversal({
      id: "loan-sum-rev",
      sourceEvent: loanOut,
      occurredOn: "2026-09-02",
      recordedAt: "2026-09-02T08:00:00.000Z",
      idempotencyKey: "loan-sum-rev-1",
      reason: "إلغاء قرض خاطئ",
    });
    const totals = summarizeFinancialEvents([loanOut, loanReversal]);
    expect(totals.loanMinor).toBe(0);
    expect(totals.cashMinor).toBe(0);
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
