/** المجموعة ٩ (STR-032): اختبار مباشر لمعين التوسيع النقي «نية تسجيل
 * المصروف» — نفس الوحدة التي يستهلكها مسار الحفظ ومعاينة الأثر، بلا وسيط
 * خدمة. السلوك عام وموثق: القبول والرفض وحدود كل فرع حصة، كما هي حية. */
import { describe, expect, it } from "vitest";
import { expandExpenseRecordIntent, type ExpenseRecordIntentInput } from "./expenseRecordIntent";
import type { OperatingExpenseContext } from "@micro-domain/financial-event/index.js";

const sharedContext: OperatingExpenseContext = {
  relationship: "shared",
  behavior: "variable",
  purpose: "project_general",
  knowledge: "known",
};

const projectContext: OperatingExpenseContext = {
  relationship: "project",
  behavior: "fixed",
  purpose: "period",
  knowledge: "known",
};

describe("expandExpenseRecordIntent (pure helper, STR-032)", () => {
  it("refuses an expense without a context", () => {
    const result = expandExpenseRecordIntent({ type: "operating_expense_cash", amountMinor: 1000 });
    expect(result).toEqual({ ok: false, message: "حدد سياق المصروف ودرجة معرفته قبل الحفظ." });
  });

  it("refuses shared-expense options on a non-shared context", () => {
    const result = expandExpenseRecordIntent({
      type: "operating_expense_cash",
      amountMinor: 1000,
      expenseContext: projectContext,
      sharedExpense: { mode: "fixed", amountMinor: 500 },
    });
    expect(result).toEqual({ ok: false, message: "خيارات حصة المصروف لا تستخدم إلا مع مصروف مشترك." });
  });

  it("passes a plain project expense through with its amount", () => {
    const result = expandExpenseRecordIntent({
      type: "operating_expense_payable",
      amountMinor: 1250,
      expenseContext: projectContext,
    });
    expect(result).toEqual({ ok: true, amountMinor: 1250, expenseContext: projectContext });
  });

  it("refuses an undefined amount when nothing expands it", () => {
    const result = expandExpenseRecordIntent({
      type: "operating_expense_cash",
      expenseContext: projectContext,
    });
    expect(result).toEqual({ ok: false, message: "أدخل مبلغًا صالحًا قبل الحفظ." });
  });

  it("expands an agreed-percentage share: amount becomes the calculated share and the basis is recorded", () => {
    const result = expandExpenseRecordIntent({
      type: "operating_expense_cash",
      expenseContext: sharedContext,
      sharedExpense: { mode: "percentage", sharedTotalAmountMinor: 10_000, sharedPercentageBps: 2_500 },
    });
    expect(result).toMatchObject({
      ok: true,
      amountMinor: 2_500,
      expenseContext: {
        knowledge: "known",
        sharedProjectShare: {
          basis: "agreed_percentage",
          allocation: "allocated",
          totalAmountMinor: 10_000,
          percentageBps: 2_500,
          calculatedShareMinor: 2_500,
        },
      },
    });
  });

  it("expands a deferred share: full total, needs-review knowledge, unallocated with no calculated share", () => {
    const result = expandExpenseRecordIntent({
      type: "operating_expense_cash",
      expenseContext: sharedContext,
      sharedExpense: { mode: "defer", sharedTotalAmountMinor: 7_500 },
    });
    expect(result).toMatchObject({
      ok: true,
      amountMinor: 7_500,
      expenseContext: {
        knowledge: "needs_review",
        sharedProjectShare: {
          basis: "needs_review",
          allocation: "unallocated",
          totalAmountMinor: 7_500,
          percentageBps: null,
          calculatedShareMinor: null,
        },
      },
    });
  });

  it("refuses an owner estimate without an amount", () => {
    const result = expandExpenseRecordIntent({
      type: "operating_expense_cash",
      expenseContext: sharedContext,
      sharedExpense: { mode: "estimate" },
    } as ExpenseRecordIntentInput);
    expect(result).toEqual({ ok: false, message: "أدخل حصة المالك التقديرية قبل الحفظ." });
  });

  it("expands an owner estimate with the given amount and estimated knowledge", () => {
    const result = expandExpenseRecordIntent({
      type: "operating_expense_cash",
      amountMinor: 3_000,
      expenseContext: sharedContext,
      sharedExpense: { mode: "estimate", amountMinor: 3_000 },
    });
    expect(result).toMatchObject({
      ok: true,
      amountMinor: 3_000,
      expenseContext: {
        knowledge: "estimated",
        sharedProjectShare: { basis: "owner_estimate", allocation: "allocated", calculatedShareMinor: null },
      },
    });
  });

  it("expands an agreed fixed share and refuses it without an amount", () => {
    const fixed = expandExpenseRecordIntent({
      type: "operating_expense_cash",
      amountMinor: 4_000,
      expenseContext: sharedContext,
      sharedExpense: { mode: "fixed", amountMinor: 4_000 },
    });
    expect(fixed).toMatchObject({
      ok: true,
      amountMinor: 4_000,
      expenseContext: {
        knowledge: "known",
        sharedProjectShare: { basis: "agreed_fixed_share", allocation: "allocated" },
      },
    });
    const missing = expandExpenseRecordIntent({
      type: "operating_expense_cash",
      expenseContext: sharedContext,
      sharedExpense: { mode: "fixed" },
    } as ExpenseRecordIntentInput);
    expect(missing).toEqual({ ok: false, message: "أدخل مبلغ حصة المشروع قبل الحفظ." });
  });

  it("refuses a shared context that ends without any share basis", () => {
    const result = expandExpenseRecordIntent({
      type: "operating_expense_cash",
      amountMinor: 2_000,
      expenseContext: sharedContext,
    });
    expect(result).toEqual({ ok: false, message: "حدد كيف عرفت حصة المشروع من المصروف المشترك قبل الحفظ." });
  });
});
