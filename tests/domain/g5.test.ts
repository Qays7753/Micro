import { describe, expect, it } from "vitest";
import { calculateBreakEven, calculateContributionMargin, calculateShortCash, createShortCashDeclaration, createShortCashReversal } from "../../src/domain/g5/index.js";

const order = (overrides: Partial<Parameters<typeof calculateContributionMargin>[2][number]> = {}) => ({ id: "order-1", itemName: "صندوق", deliveredOn: "2026-08-10", resultStatus: "final" as const, quantity: 2, recognizedRevenueMinor: 5000, recognizedCostMinor: 1800, ...overrides });
const fixedExpense = (overrides: Partial<Parameters<typeof calculateContributionMargin>[3][number]> = {}) => ({ id: "expense-1", amountMinor: 1000, behavior: "fixed" as const, relationship: "project" as const, knowledge: "known" as const, sharedProjectShareBasis: null, directlyLinked: false, source: "اشتراك معلن", ...overrides });
const declaration = (overrides: Partial<ReturnType<typeof createShortCashDeclaration>> = {}) => createShortCashDeclaration({ id: "decl-1", direction: "collection", amountMinor: 8000, dueOn: "2026-08-20", source: "العميلة — موعد معلن", knowledge: "known", note: "تحصيل متوقع حسب اتفاق معلن", idempotencyKey: "decl-key", createdAt: "2026-08-01T09:00:00.000Z", ...overrides });

describe("G5 pure domain", () => {
  it("calculates contribution margin and break-even from the recorded mix", () => {
    const result = calculateBreakEven("2026-08-01", "2026-08-31", [order()], [fixedExpense()]);
    expect(result).toMatchObject({ status: "available", totalRevenueMinor: 5000, totalVariableCostMinor: 1800, contributionMarginMinor: 3200, contributionMarginPerUnitMinor: 1600, fixedExpenseMinor: 1000, breakEvenUnits: 1, finalOrderCount: 1, excludedOrderCount: 0 });
    expect(result.mix).toEqual([{ itemName: "صندوق", orderCount: 1, quantity: 2, revenueMinor: 5000, variableCostMinor: 1800, contributionMarginMinor: 3200 }]);
  });

  it("withholds break-even units for zero or negative contribution margin", () => {
    const zero = calculateBreakEven("2026-08-01", "2026-08-31", [order({ recognizedCostMinor: 5000 })], [fixedExpense()]);
    const negative = calculateBreakEven("2026-08-01", "2026-08-31", [order({ recognizedCostMinor: 5200 })], [fixedExpense()]);
    expect(zero).toMatchObject({ status: "invalid", contributionMarginMinor: 0, breakEvenUnits: null });
    expect(negative).toMatchObject({ status: "invalid", contributionMarginMinor: -200, breakEvenUnits: null });
    expect(zero.reasons.join(" ")).toContain("غير موجب");
  });

  it("does not use an incomplete delivered order or silently split a mixed expense", () => {
    const result = calculateBreakEven("2026-08-01", "2026-08-31", [order({ resultStatus: "incomplete" })], [fixedExpense({ behavior: "mixed" })]);
    expect(result).toMatchObject({ status: "incomplete", finalOrderCount: 0, excludedOrderCount: 1, breakEvenUnits: null });
    expect(result.reasons.join(" ")).toContain("المختلط");
    expect(result.excluded.join(" ")).toContain("مستبعد");
  });

  it("marks declared estimates as needs_review while preserving the disclosed number", () => {
    const result = calculateBreakEven("2026-08-01", "2026-08-31", [order()], [fixedExpense({ knowledge: "estimated" })]);
    expect(result).toMatchObject({ status: "needs_review", breakEvenUnits: 1, assumptions: ["مبلغ ثابت اشتراك معلن تقديري."] });
  });

  it("builds a short-cash projection only from dated records and declarations", () => {
    const result = calculateShortCash({
      from: "2026-08-01",
      to: "2026-08-31",
      recordedCashMinor: 10000,
      receivables: [{ id: "customer-1", direction: "collection", amountMinor: 8000, dueOn: null, source: "دين عميلة" }, { id: "customer-2", direction: "collection", amountMinor: 5000, dueOn: null, source: "دين ثانٍ بلا تاريخ" }],
      payables: [{ id: "supplier-1", direction: "commitment", amountMinor: 14000, dueOn: null, source: "التزام مورد" }],
      declarations: [declaration({ relatedOrderId: "customer-1", relatedEventId: null }), declaration({ id: "pay-1", direction: "commitment", amountMinor: 14000, dueOn: "2026-08-22", source: "التزام مورد — موعد معلن", idempotencyKey: "pay-key", relatedEventId: "supplier-1", relatedOrderId: null })],
    });
    expect(result).toMatchObject({ status: "incomplete", recordedCashMinor: 10000, declaredCollectionsMinor: 8000, declaredCommitmentsMinor: 14000, projectedCashMinor: null, undatedReceivablesMinor: 5000 });
    expect(result.reasons.join(" ")).toContain("ذمة بلا تاريخ");
  });

  it("allows a complete known projection and marks estimated declarations for review", () => {
    const complete = calculateShortCash({ from: "2026-08-01", to: "2026-08-31", recordedCashMinor: 10000, receivables: [{ id: "customer-1", direction: "collection", amountMinor: 8000, dueOn: null, source: "دين عميلة" }], payables: [], declarations: [declaration({ relatedOrderId: "customer-1", relatedEventId: null })] });
    expect(complete).toMatchObject({ status: "available", declaredCollectionsMinor: 8000, declaredCommitmentsMinor: 0, projectedCashMinor: 18000 });
    const estimated = calculateShortCash({ from: "2026-08-01", to: "2026-08-31", recordedCashMinor: 10000, receivables: [], payables: [], declarations: [declaration({ knowledge: "estimated" })] });
    expect(estimated).toMatchObject({ status: "needs_review", projectedCashMinor: 18000, activeDeclarationCount: 1 });
  });

  it("preserves an original declaration and represents correction as a reversal", () => {
    const original = declaration();
    const reversal = createShortCashReversal({ id: "reverse-1", original, idempotencyKey: "reverse-key", createdAt: "2026-08-02T09:00:00.000Z", note: "أُلغي الموعد المعلن" });
    expect(original).toMatchObject({ kind: "declaration", reversalOfId: null });
    expect(reversal).toMatchObject({ kind: "reversal", reversalOfId: original.id, amountMinor: original.amountMinor, direction: original.direction });
    expect(() => createShortCashReversal({ id: "reverse-2", original: reversal, idempotencyKey: "reverse-key-2", createdAt: "2026-08-02T10:00:00.000Z", note: "عكس ثانٍ" })).toThrow("only an active declaration");
  });
});
