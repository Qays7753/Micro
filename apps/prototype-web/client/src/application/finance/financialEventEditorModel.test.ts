/** R7 / R6-F17-P03 (2026-10-10): عقد نموذج عرض محرر الحدث المالي — سياق
 * المصروف المشترك، بوابة صلاحية المبلغ بفروعها، غرض المصروف، والإكراه
 * الدفاعي للمسودة. نفس شروط القرار التي كانت الصفحة تنفذها. */
import { describe, expect, it } from "vitest";
import {
  basisFromMode,
  coerceEditorDraft,
  deriveExpenseContext,
  derivePrimaryAmountProblem,
  deriveSharedExpenseIntent,
  deriveSharedPercentageBps,
  knowledgeFromBasis,
} from "./financialEventEditorModel";

describe("R7/P03 — أساس ومعرفة الحصة", () => {
  it("خريطة النمط إلى الأساس كما كانت الصفحة", () => {
    expect(basisFromMode("fixed")).toBe("agreed_fixed_share");
    expect(basisFromMode("percentage")).toBe("agreed_percentage");
    expect(basisFromMode("estimate")).toBe("owner_estimate");
    expect(basisFromMode("defer")).toBe("needs_review");
  });

  it("المعرفة تتبع الأساس المعتمد", () => {
    expect(knowledgeFromBasis("agreed_fixed_share")).toBe("known");
    expect(knowledgeFromBasis("agreed_percentage")).toBe("known");
    expect(knowledgeFromBasis("owner_estimate")).toBe("estimated");
    expect(knowledgeFromBasis("needs_review")).toBe("needs_review");
  });
});

describe("R7/P03 — سياق المصروف", () => {
  const base = {
    isOperatingExpense: true,
    relationship: "shared" as const,
    behavior: "variable" as const,
    purpose: "period" as const,
    knowledge: "known" as const,
    sharedMode: "percentage" as const,
    sharedNote: "  ملاحظة الحصة  ",
    categoryLabel: "بنزين",
  };

  it("المصروف المشترك: معرفته من أساس حصته وملاحظتها مقصوصة أو null", () => {
    const context = deriveExpenseContext(base)!;
    expect(context.relationship).toBe("shared");
    expect(context.knowledge).toBe("known");
    expect(context.sharedProjectShare).toEqual({ basis: "agreed_percentage", note: "ملاحظة الحصة" });
    expect(context.categoryLabel).toBe("بنزين");
  });

  it("مصروف المشروع: لا حصة مشتركة ومعرفته من إدخال المستخدم", () => {
    const context = deriveExpenseContext({ ...base, relationship: "project", knowledge: "estimated" })!;
    expect(context.sharedProjectShare).toBeNull();
    expect(context.knowledge).toBe("estimated");
  });

  it("غير المصروف التشغيلي: لا سياق أبدًا (null)", () => {
    expect(deriveExpenseContext({ ...base, isOperatingExpense: false })).toBeNull();
  });
});

describe("R7/P03 — بوابة صلاحية المبلغ الأساسي", () => {
  const sharedPct = {
    isShared: true,
    sharedMode: "percentage" as const,
    validSharedTotal: true,
    sharedTotalAmountMinor: 10000,
    validSharedPercentage: true,
    sharedPercentage: 25,
    sharedPercentageBps: 2500,
    validAmount: false,
    amountMinor: 0,
  };

  it("النسبة الصحيحة تمر", () => {
    expect(derivePrimaryAmountProblem(sharedPct)).toBeNull();
  });

  it("دقة أعلى من منزلتين = percentage_precision (رفض صريح لا تقريبًا)", () => {
    expect(
      derivePrimaryAmountProblem({ ...sharedPct, sharedPercentage: 25.005, sharedPercentageBps: null }),
    ).toBe("percentage_precision");
  });

  it("إجمالي أو نسبة غير صالحة = percentage_invalid", () => {
    expect(derivePrimaryAmountProblem({ ...sharedPct, sharedTotalAmountMinor: 0 })).toBe(
      "percentage_invalid",
    );
    expect(derivePrimaryAmountProblem({ ...sharedPct, sharedPercentage: 0, sharedPercentageBps: 0 })).toBe(
      "percentage_invalid",
    );
    expect(
      derivePrimaryAmountProblem({ ...sharedPct, sharedPercentage: 101, sharedPercentageBps: 10100 }),
    ).toBe("percentage_invalid");
    expect(derivePrimaryAmountProblem({ ...sharedPct, validSharedTotal: false })).toBe("percentage_invalid");
  });

  it("المبلغ المباشر: صالح أو amount_invalid", () => {
    const plain = {
      isShared: false,
      sharedMode: "fixed" as const,
      validSharedTotal: false,
      sharedTotalAmountMinor: 0,
      validSharedPercentage: false,
      sharedPercentage: 0,
      sharedPercentageBps: null,
      validAmount: true,
      amountMinor: 500,
    };
    expect(derivePrimaryAmountProblem(plain)).toBeNull();
    expect(derivePrimaryAmountProblem({ ...plain, amountMinor: 0 })).toBe("amount_invalid");
    expect(derivePrimaryAmountProblem({ ...plain, validAmount: false })).toBe("amount_invalid");
  });
});

describe("R7/P03 — غرض المصروف المشترك", () => {
  it("النسبة تحتاج bps دقيقًا وإلا فلا غرض (undefined)", () => {
    expect(
      deriveSharedExpenseIntent({
        isShared: true,
        sharedMode: "percentage",
        sharedPercentageBps: 2500,
        sharedTotalAmountMinor: 10000,
        amountMinor: 2500,
      }),
    ).toEqual({ mode: "percentage", sharedTotalAmountMinor: 10000, sharedPercentageBps: 2500 });
    expect(
      deriveSharedExpenseIntent({
        isShared: true,
        sharedMode: "percentage",
        sharedPercentageBps: null,
        sharedTotalAmountMinor: 10000,
        amountMinor: 2500,
      }),
    ).toBeUndefined();
  });

  it("التأجيل يحمل الإجمالي؛ الثابت/التقدير يحملان الحصة؛ وغير المشترك بلا غرض", () => {
    expect(
      deriveSharedExpenseIntent({
        isShared: true,
        sharedMode: "defer",
        sharedPercentageBps: null,
        sharedTotalAmountMinor: 0,
        amountMinor: 7000,
      }),
    ).toEqual({ mode: "defer", sharedTotalAmountMinor: 7000 });
    expect(
      deriveSharedExpenseIntent({
        isShared: true,
        sharedMode: "estimate",
        sharedPercentageBps: null,
        sharedTotalAmountMinor: 0,
        amountMinor: 7000,
      }),
    ).toEqual({ mode: "estimate", amountMinor: 7000 });
    expect(
      deriveSharedExpenseIntent({
        isShared: false,
        sharedMode: "fixed",
        sharedPercentageBps: null,
        sharedTotalAmountMinor: 0,
        amountMinor: 7000,
      }),
    ).toBeUndefined();
  });
});

describe("R7/P03 — الإكراه الدفاعي للمسودة (TR-11/AV-09/M-04)", () => {
  it("القيمة غير الكائن أو الفارغة المعنوية = null (لا عرض استرجاع فارغًا)", () => {
    expect(coerceEditorDraft(null)).toBeNull();
    expect(coerceEditorDraft("x")).toBeNull();
    expect(coerceEditorDraft({})).toBeNull();
    expect(coerceEditorDraft({ note: "   ", amountMinor: 0 })).toBeNull();
  });

  it("القيم التالفة تُستبدل بالآمنة والتواريخ غير الصالحة ترجع لليوم", () => {
    const draft = coerceEditorDraft({
      amountMinor: 1234,
      sharedPercentage: -5,
      date: "2023-02-29",
      note: "ملاحظة",
      relationship: "garbage",
      behavior: 7,
      categoryLabel: "x".repeat(120),
    })!;
    expect(draft.amountMinor).toBe(1234);
    expect(draft.sharedPercentage).toBe(0);
    expect(draft.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(draft.relationship).toBe("project");
    expect(draft.behavior).toBe("unknown");
    expect(draft.categoryLabel).toHaveLength(80);
  });

  it("النسبة bps تُشتق فقط في نمط النسبة المشتركة", () => {
    expect(deriveSharedPercentageBps(true, "percentage", 12.5)).toBe(1250);
    expect(deriveSharedPercentageBps(true, "fixed", 12.5)).toBeNull();
    expect(deriveSharedPercentageBps(false, "percentage", 12.5)).toBeNull();
  });
});
