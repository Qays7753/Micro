import { describe, expect, it } from "vitest";
import { createFinancialEvent, createFinancialReversal } from "../../src/domain/financial-event/index.js";
import type { OperatingExpenseContext } from "../../src/domain/financial-event/index.js";

/* المجموعة ١ (تصنيفي للمصاريف): وسم بشري اختياري — بُعد قراءة وتجميع فقط.
 * هذه الاختبارات تحرس العقد الملزم: الوسم لا يغيّر أي دلتا مالية ولا الحصة ولا
 * النتيجة (اختبار التوائم)، ويُطبَّع (قص/دمج/فارغ→null) ويرفض الطول الزائد
 * بعد التطبيع، ويُجمَّد مع الحدث ويُنسخ في التراجع. */

const base = {
  occurredOn: "2026-09-03",
  recordedAt: "2026-09-03T08:00:00.000Z",
  note: "بنزين السيارة",
  counterparty: null,
};
const projectContext = (categoryLabel: string | null): OperatingExpenseContext => ({
  relationship: "project",
  behavior: "variable",
  purpose: "project_general",
  knowledge: "known",
  sharedProjectShare: null,
  categoryLabel,
});
const allocatedSharedContext = (categoryLabel: string | null): OperatingExpenseContext => ({
  relationship: "shared",
  behavior: "variable",
  purpose: "project_general",
  knowledge: "known",
  sharedProjectShare: {
    basis: "agreed_percentage",
    note: null,
    allocation: "allocated",
    totalAmountMinor: 10000,
    percentageBps: 6000,
    calculatedShareMinor: 6000,
  },
  categoryLabel,
});
const unallocatedSharedContext = (categoryLabel: string | null): OperatingExpenseContext => ({
  relationship: "shared",
  behavior: "variable",
  purpose: "project_general",
  knowledge: "needs_review",
  sharedProjectShare: {
    basis: "needs_review",
    note: null,
    allocation: "unallocated",
    totalAmountMinor: 10000,
    percentageBps: null,
    calculatedShareMinor: null,
  },
  categoryLabel,
});
const deltaFields = [
  "cashDeltaMinor",
  "payableDeltaMinor",
  "ownerCapitalDeltaMinor",
  "operatingExpenseDeltaMinor",
  "amanahDeltaMinor",
] as const;
const expense = (id: string, context: OperatingExpenseContext, amountMinor = 2500) =>
  createFinancialEvent({
    ...base,
    id,
    type: "operating_expense_cash",
    amountMinor,
    idempotencyKey: id,
    expenseContext: context,
  });

describe("Group 1 label normalization (تطبيع الوسم)", () => {
  it("trims, collapses internal whitespace, blank becomes null", () => {
    const padded = expense("label-1", projectContext("  بنزين    للمركبة   "));
    expect(padded.expenseContext?.categoryLabel).toBe("بنزين للمركبة");
    expect(expense("label-2", projectContext("   ")).expenseContext?.categoryLabel).toBeNull();
    expect(expense("label-3", projectContext(null)).expenseContext?.categoryLabel).toBeNull();
  });

  it("rejects >80 after normalization — length is measured post-collapse, no silent truncation", () => {
    expect(() => expense("label-long", projectContext("بنزين ".repeat(20).trim()))).toThrowError(/٨٠ حرفًا/);
    /* الفراغات المتتالية تنهار قبل القياس — نفس قاعدة فحص الاستيراد. */
    const collapses = `بنزين${" ".repeat(100)}`;
    expect(collapses.length).toBeGreaterThan(80);
    expect(expense("label-collapse", projectContext(collapses)).expenseContext?.categoryLabel).toBe("بنزين");
  });
});

describe("Group 1 label twins (التوائم: لا أثر على الدلتا)", () => {
  it("paid and payable expenses keep identical deltas with and without the label", () => {
    for (const type of ["operating_expense_cash", "operating_expense_payable"] as const) {
      const bare = createFinancialEvent({
        ...base,
        id: `twin-${type}-a`,
        type,
        amountMinor: 10000,
        idempotencyKey: `twin-${type}-a`,
        expenseContext: projectContext(null),
      });
      const labeled = createFinancialEvent({
        ...base,
        id: `twin-${type}-b`,
        type,
        amountMinor: 10000,
        idempotencyKey: `twin-${type}-b`,
        expenseContext: projectContext("بنزين"),
      });
      for (const field of deltaFields) expect(labeled[field]).toBe(bare[field]);
    }
  });

  it("allocated and unallocated shared shares are identical with and without the label", () => {
    const allocatedBare = expense("twin-shared-a", allocatedSharedContext(null), 6000);
    const allocatedLabeled = expense("twin-shared-b", allocatedSharedContext("كهرباء"), 6000);
    for (const field of deltaFields) expect(allocatedLabeled[field]).toBe(allocatedBare[field]);
    expect(allocatedLabeled.expenseContext?.sharedProjectShare).toEqual(
      allocatedBare.expenseContext?.sharedProjectShare,
    );
    const deferredBare = expense("twin-defer-a", unallocatedSharedContext(null), 10000);
    const deferredLabeled = expense("twin-defer-b", unallocatedSharedContext("مواد"), 10000);
    expect(deferredLabeled.operatingExpenseDeltaMinor).toBe(0);
    expect(deferredBare.operatingExpenseDeltaMinor).toBe(0);
    expect(deferredLabeled.cashDeltaMinor).toBe(deferredBare.cashDeltaMinor);
  });
});

describe("Group 1 label freeze and reversal copy (التجميد والنسخ)", () => {
  it("freezes the label with the context and carries it through a documented reversal", () => {
    const source = createFinancialEvent({
      ...base,
      id: "label-source",
      type: "operating_expense_cash",
      amountMinor: 3000,
      idempotencyKey: "label-source",
      expenseContext: { ...projectContext("إيجار"), behavior: "fixed" },
    });
    expect(Object.isFrozen(source.expenseContext)).toBe(true);
    const reversal = createFinancialReversal({
      id: "label-reversal",
      sourceEvent: source,
      occurredOn: "2026-09-04",
      recordedAt: "2026-09-04T08:00:00.000Z",
      idempotencyKey: "label-reversal",
      reason: "سُجل مرتين",
    });
    expect(reversal.expenseContext?.categoryLabel).toBe("إيجار");
    expect(reversal.cashDeltaMinor).toBe(-source.cashDeltaMinor);
    expect(reversal.operatingExpenseDeltaMinor).toBe(-source.operatingExpenseDeltaMinor);
  });
});
