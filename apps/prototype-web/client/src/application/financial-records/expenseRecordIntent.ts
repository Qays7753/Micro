/**
 * المجموعة ١ (معاينة الأثر قبل الحفظ): توسيع نية تسجيل المصروف — وحدة نقية واحدة
 * يستهلكها مسار الحفظ نفسه (`ProjectFinancialService.record`) ومعاينة الأثر في
 * المحرر، فلا يوجد حساب أثر ثانٍ مكرر في الواجهة: المعاينة مشتقة من نفس
 * التوسيع الذي سيُحفظ فعليًا (عقد «الأثر مشتق من نية الالتزام»).
 * S06 (CONS-DEC04 المعتمدة / SDF-064): الفرع الشخصي للفاتورة المشتركة —
 * المستخدم يصرّح بما دفعه المشروع فعلًا (paidAmountMinor) وحصة المشروع،
 * والتوسيع يشتق الجزء الشخصي المؤكد (ownerPartMinor = المدفوع − الحصة)
 * الذي يكتبه الكاتب الكنوني سحبًا شخصيًا على المالك بحدث مستقل بمفتاح
 * مشتق من نية الحفظ نفسها؛ دفع المشروع حصته فقط لا يضيف شيئًا (لا سحب
 * ولا دينًا مختلقًا)، ولا يُقبل المدفوع الأقل من الحصة (لا دفع جزئي بلا
 * عقد التزام وسداد مترابطين).
 */
import {
  calculateSharedProjectShareMinor,
  sharedBillOwnerPartMinor,
} from "@micro-domain/financial-event/index.js";
import type { OperatingExpenseContext } from "@micro-domain/financial-event/index.js";

export type SharedExpenseRecordInput =
  | {
      mode?: "fixed";
      amountMinor: number;
      sharedTotalAmountMinor?: never;
      sharedPercentageBps?: never;
      /* S06 (CONS-DEC04): المدفوع فعليًا من صندوق المشروع — اختياري؛
       * الغياب/تساويه مع الحصة = السلوك القائم بلا جزء شخصي. */
      paidAmountMinor?: number;
    }
  | {
      mode: "percentage";
      amountMinor?: never;
      sharedTotalAmountMinor: number;
      sharedPercentageBps: number;
      paidAmountMinor?: number;
    }
  | {
      mode: "estimate";
      amountMinor: number;
      sharedTotalAmountMinor?: never;
      sharedPercentageBps?: never;
      paidAmountMinor?: number;
    }
  | { mode: "defer"; amountMinor?: never; sharedTotalAmountMinor: number; sharedPercentageBps?: never };

export type ExpenseRecordIntentInput = {
  type: "operating_expense_cash" | "operating_expense_payable";
  amountMinor?: number;
  expenseContext: OperatingExpenseContext | null;
  sharedExpense?: SharedExpenseRecordInput;
};

export type ExpenseRecordIntent =
  | {
      ok: true;
      amountMinor: number;
      expenseContext: OperatingExpenseContext | null;
      /* S06: ما دفعه المشروع فعلًا (للمصروف النقدي المشترك) — null = حصته
       * فقط؛ يُحفظ سياقًا صادقًا على الحدث. */
      paidAmountMinor: number | null;
      /* S06: الجزء الشخصي المؤكد فوق الحصة — سحب مالك بمفتاح مشتق؛
       * 0 حين لا ينطبق الفرع (حصة فقط/مستحق/غير مشترك). */
      ownerPartMinor: number;
    }
  | { ok: false; message: string };

const isPositiveSafeMinor = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

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
  /* S06 (CONS-DEC04): المدفوع فعليًا سؤال المصروف النقدي المشترك وحده —
   * المستحق لا يخرج نقدًا الآن، والمؤجل حصته غير معروفة فلا جزء شخصي
   * مؤكدًا. الحصة النقدية فقط هي التي قد يدفع المشروع فوقها فاتورة البيت. */
  /* `in` narrowing: الأنماط المعلومة وحدها تحمل الحقل نمطيًا؛ مستدعٍ JS
   * خارج الأنواع قد يمرره مع المؤجلة فيرد الحارس أدناه صراحة. */
  const paidInput =
    input.sharedExpense && "paidAmountMinor" in input.sharedExpense
      ? input.sharedExpense.paidAmountMinor
      : undefined;
  if (paidInput !== undefined && input.type !== "operating_expense_cash")
    return {
      ok: false,
      message: "«المدفوع فعليًا» يسأل للمصروف النقدي المشترك وحده — غير المدفوع يسجّل ذمة بلا دفع الآن.",
    };
  if (input.sharedExpense?.mode === "defer" && paidInput !== undefined)
    return {
      ok: false,
      message: "لا يُسجل مدفوع فعلي مع حصة مؤجلة — حدد حصة المشروع أولًا ثم سجّل ما دُفع.",
    };
  let paidAmountMinor: number | null = null;
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
      if (amountMinor === undefined) return { ok: false, message: "أدخل حصة المالك التقديرية قبل الحفظ." };
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
      if (amountMinor === undefined) return { ok: false, message: "أدخل مبلغ حصة المشروع قبل الحفظ." };
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
    /* S06 (CONS-DEC04/SDF-064): تصريف المدفوع الفعلي فوق الحصة — بعد اكتمال
     * اشتقاق الحصة بأنماطها كلها. المدفوع لا يقل عن الحصة (لا دفع جزئي)،
     * والفارق جزء شخصي مؤكد يكتبه الكاتب سحب مالك بنيّة واحدة. */
    if (paidInput !== undefined && input.sharedExpense.mode !== "defer") {
      if (!isPositiveSafeMinor(paidInput))
        return { ok: false, message: "أدخل المدفوع فعليًا مبلغًا صحيحًا موجبًا بالأرقام 0–9." };
      if (amountMinor === undefined || paidInput < amountMinor)
        return {
          ok: false,
          message: "المدفوع فعليًا لا يمكن أن يقل عن حصة المشروع — إن لم يُدفع كاملها فسجّل المصروف مستحقًا.",
        };
      paidAmountMinor = paidInput;
      expenseContext = {
        ...expenseContext,
        sharedProjectShare: { ...expenseContext.sharedProjectShare!, paidAmountMinor: paidInput },
      };
    }
  }
  if (expenseContext.relationship === "shared" && !expenseContext.sharedProjectShare)
    return {
      ok: false,
      message: "حدد كيف عرفت حصة المشروع من المصروف المشترك قبل الحفظ.",
    };
  if (amountMinor === undefined) return { ok: false, message: "أدخل مبلغًا صالحًا قبل الحفظ." };
  const ownerPartMinor = sharedBillOwnerPartMinor(paidAmountMinor, amountMinor);
  return { ok: true, amountMinor, expenseContext, paidAmountMinor, ownerPartMinor };
}
