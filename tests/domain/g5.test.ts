import { describe, expect, it } from "vitest";
import {
  calculateBreakEven,
  calculateContributionMargin,
  calculateShortCash,
  createShortCashDeclaration,
  createShortCashReversal,
} from "../../src/domain/g5/index.js";

const order = (overrides: Partial<Parameters<typeof calculateContributionMargin>[2][number]> = {}) => ({
  id: "order-1",
  itemName: "صندوق",
  deliveredOn: "2026-08-10",
  resultStatus: "final" as const,
  quantityMilli: 2000,
  unitKey: "piece",
  unitLabel: "قطعة",
  quantityIssue: null,
  recognizedRevenueMinor: 5000,
  recognizedCostMinor: 1800,
  ...overrides,
});
const fixedExpense = (
  overrides: Partial<Parameters<typeof calculateContributionMargin>[3][number]> = {},
) => ({
  id: "expense-1",
  amountMinor: 1000,
  behavior: "fixed" as const,
  relationship: "project" as const,
  knowledge: "known" as const,
  sharedProjectShareBasis: null,
  directlyLinked: false,
  source: "اشتراك معلن",
  ...overrides,
});
const declaration = (overrides: Partial<ReturnType<typeof createShortCashDeclaration>> = {}) =>
  createShortCashDeclaration({
    id: "decl-1",
    direction: "collection",
    amountMinor: 8000,
    dueOn: "2026-08-20",
    source: "العميلة — موعد معلن",
    knowledge: "known",
    note: "تحصيل متوقع حسب اتفاق معلن",
    idempotencyKey: "decl-key",
    createdAt: "2026-08-01T09:00:00.000Z",
    ...overrides,
  });

const shortCash = (overrides: Partial<Parameters<typeof calculateShortCash>[0]> = {}) => ({
  from: "2026-08-01",
  to: "2026-08-31",
  recordedCashMinor: 10000,
  receivables: [],
  payables: [],
  declarations: [],
  ...overrides,
});

describe("G5 pure domain", () => {
  it("calculates recorded contribution margin and break-even from final orders only", () => {
    const result = calculateBreakEven("2026-08-01", "2026-08-31", [order()], [fixedExpense()]);
    expect(result).toMatchObject({
      status: "available",
      totalRevenueMinor: 5000,
      totalVariableCostMinor: 1800,
      contributionMarginMinor: 3200,
      contributionMarginPerUnitMinor: 1600,
      totalQuantityMilli: 2000,
      quantityUnitKey: "piece",
      fixedExpenseMinor: 1000,
      breakEvenUnits: 1,
      finalOrderCount: 1,
      excludedOrderCount: 0,
    });
    expect(result.mix).toEqual([
      {
        itemName: "صندوق",
        orderCount: 1,
        quantityMilli: 2000,
        unitKey: "piece",
        unitLabel: "قطعة",
        revenueMinor: 5000,
        variableCostMinor: 1800,
        contributionMarginMinor: 3200,
      },
    ]);
  });

  it("uses JOD minor units and excludes deposits, collections, debt, purchases, and owner movements", () => {
    const result = calculateContributionMargin(
      "2026-08-01",
      "2026-08-31",
      [order({ recognizedRevenueMinor: 10000, recognizedCostMinor: 6000 })],
      [fixedExpense({ amountMinor: 2000 })],
    );
    expect(result.contributionMarginMinor).toBe(4000);
    expect(result.totalVariableCostMinor).toBe(6000);
  });

  it("excludes a delivered non-final order with an explicit reason", () => {
    const result = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order({ resultStatus: "incomplete" })],
      [fixedExpense()],
    );
    expect(result).toMatchObject({
      status: "incomplete",
      finalOrderCount: 0,
      excludedOrderCount: 1,
      breakEvenUnits: null,
    });
    expect(result.reasons.join(" ")).toContain("مستبعدة");
    expect(result.excluded.join(" ")).toContain("مستبعد");
  });

  it("marks estimated fixed cost as needs_review while preserving the number", () => {
    const result = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order()],
      [fixedExpense({ knowledge: "estimated" })],
    );
    expect(result).toMatchObject({
      status: "needs_review",
      breakEvenUnits: 1,
      assumptions: ["مبلغ ثابت اشتراك معلن تقديري معلن."],
    });
  });

  it("returns incomplete for mixed, unknown, or unlinked general variable expenses", () => {
    const mixed = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order()],
      [fixedExpense({ behavior: "mixed" })],
    );
    const unknown = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order()],
      [fixedExpense({ behavior: "unknown" })],
    );
    const variable = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order()],
      [fixedExpense({ behavior: "variable" })],
    );
    expect(mixed).toMatchObject({ status: "incomplete", breakEvenUnits: null });
    expect(unknown).toMatchObject({ status: "incomplete", breakEvenUnits: null });
    expect(variable).toMatchObject({ status: "incomplete", breakEvenUnits: null });
  });

  it("returns incomplete for a shared expense without a declared basis", () => {
    const result = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order()],
      [fixedExpense({ relationship: "shared", sharedProjectShareBasis: null })],
    );
    expect(result).toMatchObject({ status: "incomplete", fixedExpenseMinor: 0, breakEvenUnits: null });
    expect(result.reasons.join(" ")).toContain("بلا أساس معلن");
  });

  it("withholds break-even units for zero or negative margin or missing fixed cost", () => {
    const zero = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order({ recognizedCostMinor: 5000 })],
      [fixedExpense()],
    );
    const negative = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order({ recognizedCostMinor: 5200 })],
      [fixedExpense()],
    );
    const noFixed = calculateBreakEven("2026-08-01", "2026-08-31", [order()], []);
    expect(zero).toMatchObject({ status: "invalid", contributionMarginMinor: 0, breakEvenUnits: null });
    expect(negative).toMatchObject({
      status: "invalid",
      contributionMarginMinor: -200,
      breakEvenUnits: null,
    });
    expect(noFixed).toMatchObject({ status: "invalid", fixedExpenseMinor: 0, breakEvenUnits: null });
    expect(zero.reasons.join(" ")).toContain("غير موجب");
  });

  it("prevents the quantity-thousandths x1000 error", () => {
    const oneUnit = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order({ quantityMilli: 1000, recognizedRevenueMinor: 1000, recognizedCostMinor: 500 })],
      [fixedExpense({ amountMinor: 500 })],
    );
    const twelveUnits = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order({ quantityMilli: 12000, recognizedRevenueMinor: 12000, recognizedCostMinor: 6000 })],
      [fixedExpense({ amountMinor: 600 })],
    );
    expect(oneUnit).toMatchObject({ contributionMarginPerUnitMinor: 500, breakEvenUnits: 1 });
    expect(twelveUnits).toMatchObject({ contributionMarginPerUnitMinor: 500, breakEvenUnits: 2 });
    expect(oneUnit.breakEvenUnits).not.toBe(1000);
  });

  it("does not combine incompatible quantity units into one break-even scale", () => {
    const result = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [
        order(),
        order({
          id: "order-2",
          unitKey: "kilogram",
          unitLabel: "كغ",
          quantityMilli: 1000,
          recognizedRevenueMinor: 3000,
          recognizedCostMinor: 1000,
        }),
      ],
      [fixedExpense()],
    );
    expect(result).toMatchObject({
      status: "incomplete",
      totalQuantityMilli: null,
      contributionMarginPerUnitMinor: null,
      breakEvenUnits: null,
    });
    expect(result.reasons.join(" ")).toContain("غير متوافقة");
  });

  it("rejects invalid quantity rather than treating it as zero", () => {
    const result = calculateBreakEven(
      "2026-08-01",
      "2026-08-31",
      [order({ quantityMilli: null, quantityIssue: "invalid" })],
      [fixedExpense()],
    );
    expect(result).toMatchObject({ status: "invalid", totalQuantityMilli: null, breakEvenUnits: null });
    expect(result.reasons.join(" ")).toContain("لا تحوّل إلى صفر");
  });

  it("builds short cash only from dated evidence and active declarations", () => {
    const result = calculateShortCash(
      shortCash({
        receivables: [
          { id: "customer-1", direction: "collection", amountMinor: 8000, dueOn: null, source: "دين عميلة" },
          {
            id: "customer-2",
            direction: "collection",
            amountMinor: 5000,
            dueOn: null,
            source: "دين ثانٍ بلا تاريخ",
          },
        ],
        payables: [
          {
            id: "supplier-1",
            direction: "commitment",
            amountMinor: 14000,
            dueOn: null,
            source: "التزام مورد",
          },
        ],
        declarations: [
          declaration({ relatedOrderId: "customer-1", relatedEventId: null }),
          declaration({
            id: "pay-1",
            direction: "commitment",
            amountMinor: 14000,
            dueOn: "2026-08-22",
            source: "التزام مورد — موعد معلن",
            idempotencyKey: "pay-key",
            relatedEventId: "supplier-1",
            relatedOrderId: null,
          }),
        ],
      }),
    );
    expect(result).toMatchObject({
      status: "incomplete",
      recordedCashMinor: 10000,
      declaredCollectionsMinor: 8000,
      declaredCommitmentsMinor: 14000,
      projectedCashMinor: null,
      undatedReceivablesMinor: 5000,
    });
    expect(result.reasons.join(" ")).toContain("ذمة بلا تاريخ");
  });

  it("allows a complete known projection and marks estimated declarations for review", () => {
    const complete = calculateShortCash(
      shortCash({
        receivables: [
          { id: "customer-1", direction: "collection", amountMinor: 8000, dueOn: null, source: "دين عميلة" },
        ],
        declarations: [declaration({ relatedOrderId: "customer-1", relatedEventId: null })],
      }),
    );
    const estimated = calculateShortCash(
      shortCash({ declarations: [declaration({ knowledge: "estimated" })] }),
    );
    expect(complete).toMatchObject({
      status: "available",
      declaredCollectionsMinor: 8000,
      declaredCommitmentsMinor: 0,
      projectedCashMinor: 18000,
    });
    expect(estimated).toMatchObject({
      status: "needs_review",
      projectedCashMinor: 18000,
      activeDeclarationCount: 1,
    });
  });

  it("keeps dated supplier purchase commitments separate from contribution margin", () => {
    const result = calculateShortCash(
      shortCash({
        payables: [
          {
            id: "purchase-1",
            direction: "commitment",
            amountMinor: 14000,
            dueOn: "2026-08-22",
            source: "مشتريات مورد",
          },
        ],
      }),
    );
    expect(result).toMatchObject({
      status: "available",
      declaredCommitmentsMinor: 14000,
      projectedCashMinor: -4000,
    });
  });

  it("returns incomplete when there is no short-horizon evidence even if cash is known", () => {
    const result = calculateShortCash(shortCash());
    expect(result).toMatchObject({
      status: "incomplete",
      recordedCashMinor: 10000,
      projectedCashMinor: null,
    });
    expect(result.reasons.join(" ")).toContain("غياب المتوقع لا يعني");
  });

  it("invalidates a linked declaration that exceeds the known balance", () => {
    const result = calculateShortCash(
      shortCash({
        receivables: [
          { id: "customer-1", direction: "collection", amountMinor: 1000, dueOn: null, source: "دين عميلة" },
        ],
        declarations: [
          declaration({ amountMinor: 1001, relatedOrderId: "customer-1", relatedEventId: null }),
        ],
      }),
    );
    expect(result).toMatchObject({ status: "invalid", projectedCashMinor: null });
    expect(result.reasons.join(" ")).toContain("يتجاوز الرصيد");
  });

  it("preserves an original declaration and represents correction as a single reversal", () => {
    const original = declaration();
    const reversal = createShortCashReversal({
      id: "reverse-1",
      original,
      idempotencyKey: "reverse-key",
      createdAt: "2026-08-02T09:00:00.000Z",
      note: "أُلغي الموعد المعلن",
    });
    expect(original).toMatchObject({ kind: "declaration", reversalOfId: null });
    expect(reversal).toMatchObject({
      kind: "reversal",
      reversalOfId: original.id,
      amountMinor: original.amountMinor,
      direction: original.direction,
    });
    expect(() =>
      createShortCashReversal({
        id: "reverse-2",
        original: reversal,
        idempotencyKey: "reverse-key-2",
        createdAt: "2026-08-02T10:00:00.000Z",
        note: "عكس ثانٍ",
      }),
    ).toThrow("only an active declaration");
    const reversed = calculateShortCash(shortCash({ declarations: [reversal, original] }));
    expect(reversed.activeDeclarationCount).toBe(0);
  });
});
