/** R7 / R6-F17-P03 (2026-10-10): عقد نموذج عرض محرر الحدث المالي — سياق
 * المصروف المشترك، بوابة صلاحية المبلغ بفروعها، غرض المصروف، والإكراه
 * الدفاعي للمسودة. نفس شروط القرار التي كانت الصفحة تنفذها. */
import { describe, expect, it } from "vitest";
import {
  basisFromMode,
  coerceEditorDraft,
  defaultNextReminderDate,
  defaultNextReminderDateForExpense,
  deriveExpenseContext,
  deriveOwnerPartMinor,
  derivePrimaryAmountProblem,
  deriveRecurrenceProblem,
  deriveSharedExpenseIntent,
  deriveSharedPaidProblem,
  deriveSharedPercentageBps,
  deriveSharedShareMinorPreview,
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

describe("S06 — مشتقات الفاتورة المشتركة وخيار التكرار (CONS-DEC04 / ORG-011)", () => {
  it("معاينة الحصة: من المبلغ للنمطين المعروفين، ومن النواة للنسبة، وnull للمؤجلة/الناقصة", () => {
    expect(
      deriveSharedShareMinorPreview({
        isShared: true,
        sharedMode: "fixed",
        amountMinor: 3_000,
        sharedTotalAmountMinor: 0,
        sharedPercentageBps: null,
      }),
    ).toBe(3_000);
    expect(
      deriveSharedShareMinorPreview({
        isShared: true,
        sharedMode: "estimate",
        amountMinor: 2_500,
        sharedTotalAmountMinor: 0,
        sharedPercentageBps: null,
      }),
    ).toBe(2_500);
    expect(
      deriveSharedShareMinorPreview({
        isShared: true,
        sharedMode: "percentage",
        amountMinor: 0,
        sharedTotalAmountMinor: 10_000,
        sharedPercentageBps: 5_000,
      }),
    ).toBe(5_000);
    /* النسبة الفارغة/الصفرية أثناء الكتابة ليست 0.01% — لا قسمة على مدخلات ناقصة. */
    expect(
      deriveSharedShareMinorPreview({
        isShared: true,
        sharedMode: "percentage",
        amountMinor: 0,
        sharedTotalAmountMinor: 10_000,
        sharedPercentageBps: 0,
      }),
    ).toBeNull();
    expect(
      deriveSharedShareMinorPreview({
        isShared: true,
        sharedMode: "defer",
        amountMinor: 6_000,
        sharedTotalAmountMinor: 0,
        sharedPercentageBps: null,
      }),
    ).toBeNull();
  });

  it("الفارق الشخصي من دالة المجال: فوق الحصة فقط وحيث ينطبق الفرع، وصفر دون ذلك", () => {
    expect(deriveOwnerPartMinor({ paidAmountMinor: 6_000, shareAmountMinor: 3_000, applies: true })).toBe(
      3_000,
    );
    expect(deriveOwnerPartMinor({ paidAmountMinor: 3_000, shareAmountMinor: 3_000, applies: true })).toBe(0);
    expect(deriveOwnerPartMinor({ paidAmountMinor: 6_000, shareAmountMinor: 3_000, applies: false })).toBe(0);
    expect(deriveOwnerPartMinor({ paidAmountMinor: 6_000, shareAmountMinor: null, applies: true })).toBe(0);
  });

  it("بوابة المدفوع: غير صحيح أو أقل من الحصة، وغائبة/مكتملة تمر", () => {
    expect(
      deriveSharedPaidProblem({ paidAmountMinor: 0, validPaid: true, shareAmountMinor: 3_000 }),
    ).toBeNull();
    /* نص غير صالح بعد قيمة مكتوبة: الرفض بالصلاحية لا بالقيمة. */
    expect(
      deriveSharedPaidProblem({ paidAmountMinor: 3_000, validPaid: false, shareAmountMinor: 3_000 }),
    ).toBe("paid_invalid");
    /* القيمة غير الموجبة تعني «غير مدخلة» — بوابة الغياب لا بوابة الرفض. */
    expect(
      deriveSharedPaidProblem({ paidAmountMinor: -5, validPaid: true, shareAmountMinor: 3_000 }),
    ).toBeNull();
    expect(
      deriveSharedPaidProblem({ paidAmountMinor: 2_000, validPaid: true, shareAmountMinor: 3_000 }),
    ).toBe("paid_below_share");
    expect(
      deriveSharedPaidProblem({ paidAmountMinor: 6_000, validPaid: true, shareAmountMinor: 3_000 }),
    ).toBeNull();
  });

  it("نية الحصة تحمل المدفوع للأنماط المعلومة دون المؤجلة", () => {
    const withPaid = deriveSharedExpenseIntent({
      isShared: true,
      sharedMode: "fixed",
      sharedPercentageBps: null,
      sharedTotalAmountMinor: 0,
      amountMinor: 3_000,
      paidAmountMinor: 6_000,
    });
    expect(withPaid).toMatchObject({ mode: "fixed", amountMinor: 3_000, paidAmountMinor: 6_000 });
    const deferred = deriveSharedExpenseIntent({
      isShared: true,
      sharedMode: "defer",
      sharedPercentageBps: null,
      sharedTotalAmountMinor: 6_000,
      amountMinor: 6_000,
      paidAmountMinor: 6_000,
    });
    expect(deferred).toEqual({ mode: "defer", sharedTotalAmountMinor: 6_000 });
  });

  it("التذكير القادم الافتراضي: الشهر القادم باليوم نفسه مثبتًا على آخر يوم صالح", () => {
    expect(defaultNextReminderDate("2026-10-15")).toBe("2026-11-15");
    expect(defaultNextReminderDate("2026-01-31")).toBe("2026-02-28");
    expect(defaultNextReminderDate("2024-01-30")).toBe("2024-02-29");
  });

  /* R3-F01 (مراجعة S06 القرائية ٣): مرجع الافتراضي داخل المصروف هو الأحدث
   * بين تاريخ الحدث واليوم الحقيقي — بوابة الخدمة الكنسية (setupFromExpense)
   * تقارن باليوم الحقيقي وحده، فمصروف مؤرّخ سابقًا يجب ألا يقترح تذكيرًا
   * في شهر الحدث الماضي/الحالي وترفضه الخدمة بعد ثبوت المصروف. */
  it("افتراضي التذكير داخل المصروف: الأحدث بين تاريخ الحدث واليوم الحقيقي (R3-F01)", () => {
    /* مصروف مؤرّخ سابقًا: المرجع اليوم الحقيقي — الافتراضي يرضي بوابة الخدمة. */
    expect(defaultNextReminderDateForExpense("2026-09-15", "2026-10-30")).toBe("2026-11-30");
    /* نفس اليوم: الشهر القادم باليوم نفسه. */
    expect(defaultNextReminderDateForExpense("2026-10-30", "2026-10-30")).toBe("2026-11-30");
    /* مصروف مستقبلي: المرجع تاريخ الحدث — أول تذكير بعد واقعة المصروف. */
    expect(defaultNextReminderDateForExpense("2026-12-15", "2026-10-30")).toBe("2027-01-15");
    /* التثبيت على آخر يوم صالح مع أحدث مرجع. */
    expect(defaultNextReminderDateForExpense("2026-01-31", "2026-01-15")).toBe("2026-02-28");
    expect(defaultNextReminderDateForExpense("2026-01-15", "2026-01-31")).toBe("2026-02-28");
  });

  it("بوابة التكرار: تاريخ صالح في فترة لاحقة حصرًا", () => {
    expect(deriveRecurrenceProblem({ enabled: false, nextDate: "", today: "2026-10-15" })).toBeNull();
    expect(
      deriveRecurrenceProblem({ enabled: true, nextDate: "2026-11-15", today: "2026-10-15" }),
    ).toBeNull();
    expect(deriveRecurrenceProblem({ enabled: true, nextDate: "2026-13-40", today: "2026-10-15" })).toBe(
      "recurrence_date_invalid",
    );
    expect(deriveRecurrenceProblem({ enabled: true, nextDate: "2026-10-25", today: "2026-10-15" })).toBe(
      "recurrence_not_future_period",
    );
    expect(deriveRecurrenceProblem({ enabled: true, nextDate: "2026-09-25", today: "2026-10-15" })).toBe(
      "recurrence_not_future_period",
    );
  });
});
