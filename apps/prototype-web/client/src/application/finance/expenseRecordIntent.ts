/**
 * المجموعة ١ (معاينة الأثر قبل الحفظ): توسيع نية تسجيل المصروف — وحدة نقية واحدة
 * يستهلكها مسار الحفظ نفسه (`ProjectFinancialService.record`) ومعاينة الأثر في
 * المحرر، فلا يوجد حساب أثر ثانٍ مكرر في الواجهة: المعاينة مشتقة من نفس
 * التوسيع الذي سيُحفظ فعليًا (عقد «الأثر مشتق من نية الالتزام»).
 */
import { calculateSharedProjectShareMinor } from "@micro-domain/financial-event/index.js";
import type { OperatingExpenseContext } from "@micro-domain/financial-event/index.js";

export type SharedExpenseRecordInput =
  | { mode?: "fixed"; amountMinor: number; sharedTotalAmountMinor?: never; sharedPercentageBps?: never }
  | { mode: "percentage"; amountMinor?: never; sharedTotalAmountMinor: number; sharedPercentageBps: number }
  | { mode: "estimate"; amountMinor: number; sharedTotalAmountMinor?: never; sharedPercentageBps?: never }
  | { mode: "defer"; amountMinor?: never; sharedTotalAmountMinor: number; sharedPercentageBps?: never };

export type ExpenseRecordIntentInput = {
  type: "operating_expense_cash" | "operating_expense_payable";
  amountMinor?: number;
  expenseContext: OperatingExpenseContext | null;
  sharedExpense?: SharedExpenseRecordInput;
};

export type ExpenseRecordIntent =
  | { ok: true; amountMinor: number; expenseContext: OperatingExpenseContext | null }
  | { ok: false; message: string };

/** نفس توسيع `record` التاريخي حرفيًا — نقل لا إعادة كتابة، والاختبارات القائمة تحرسه. */
export function expandExpenseRecordIntent(input: ExpenseRecordIntentInput): ExpenseRecordIntent {
  let amountMinor = input.amountMinor;
  let expenseContext = input.expenseContext ?? null;
  if (input.sharedExpense && expenseContext?.relationship !== "shared")
    return {
      ok: false,
      message: "خيارات حصة المصروف لا تستخدم إلا مع مصروف مشترك.",
    };
  if (!expenseContext)
    return {
      ok: false,
      message: "حدد سياق المصروف ودرجة معرفته قبل الحفظ.",
    };
  if (expenseContext.relationship === "shared" && input.sharedExpense) {
    const note = expenseContext.sharedProjectShare?.note ?? null;
    if (input.sharedExpense.mode === "percentage") {
      const calculatedShareMinor = calculateSharedProjectShareMinor(
        input.sharedExpense.sharedTotalAmountMinor,
        input.sharedExpense.sharedPercentageBps,
      );
      amountMinor = calculatedShareMinor;
      expenseContext = {
        ...expenseContext,
        knowledge: "known",
        sharedProjectShare: {
          basis: "agreed_percentage",
          note,
          allocation: "allocated",
          totalAmountMinor: input.sharedExpense.sharedTotalAmountMinor,
          percentageBps: input.sharedExpense.sharedPercentageBps,
          calculatedShareMinor,
        },
      };
    } else if (input.sharedExpense.mode === "defer") {
      amountMinor = input.sharedExpense.sharedTotalAmountMinor;
      expenseContext = {
        ...expenseContext,
        knowledge: "needs_review",
        sharedProjectShare: {
          basis: "needs_review",
          note,
          allocation: "unallocated",
          totalAmountMinor: input.sharedExpense.sharedTotalAmountMinor,
          percentageBps: null,
          calculatedShareMinor: null,
        },
      };
    } else if (input.sharedExpense.mode === "estimate") {
      if (amountMinor === undefined)
        return { ok: false, message: "أدخل حصة المالك التقديرية قبل الحفظ." };
      expenseContext = {
        ...expenseContext,
        knowledge: "estimated",
        sharedProjectShare: {
          basis: "owner_estimate",
          note,
          allocation: "allocated",
          totalAmountMinor: null,
          percentageBps: null,
          calculatedShareMinor: null,
        },
      };
    } else {
      if (amountMinor === undefined)
        return { ok: false, message: "أدخل مبلغ حصة المشروع قبل الحفظ." };
      expenseContext = {
        ...expenseContext,
        knowledge: "known",
        sharedProjectShare: {
          basis: "agreed_fixed_share",
          note,
          allocation: "allocated",
          totalAmountMinor: null,
          percentageBps: null,
          calculatedShareMinor: null,
        },
      };
    }
  }
  if (expenseContext.relationship === "shared" && !expenseContext.sharedProjectShare)
    return {
      ok: false,
      message: "حدد كيف عرفت حصة المشروع من المصروف المشترك قبل الحفظ.",
    };
  if (amountMinor === undefined)
    return { ok: false, message: "أدخل مبلغًا صالحًا قبل الحفظ." };
  return { ok: true, amountMinor, expenseContext };
}
