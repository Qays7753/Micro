import { describe, expect, it } from "vitest";
import * as budgetBarrel from "../../src/domain/budget/index.js";
import {
  closeExpenseBudget,
  createExpenseBudget,
  dismissGoal,
  evaluateBudgetStatus,
  findOverlappingBudgets,
  isValidBudgetPeriodKey,
  restoreGoal,
  reviseExpenseBudget,
  type CreateExpenseBudgetInput,
  type ReviseExpenseBudgetInput,
} from "../../src/domain/budget/index.js";

const AT = "2026-09-22T09:30:00.000Z";
const REVISE_AT = "2026-09-23T10:00:00.000Z";

const baseInput = (overrides: Partial<CreateExpenseBudgetInput> = {}): CreateExpenseBudgetInput => ({
  id: "budget-1",
  periodKind: "month",
  periodKey: "2026-10",
  scope: { kind: "category", categoryLabel: "إيجار" },
  amountMinor: 250_000,
  knowledge: "known",
  note: null,
  operationKey: "op-budget-1",
  createdAt: AT,
  ...overrides,
});

describe("FIN-002 — الإنشاء: خطة نافذة بلا أي أثر مالي", () => {
  it("الميزانية تُنشأ نافذة مجمّدة بمضمون كامل — لا كاش ولا نتيجة ولا دين يتحرك", () => {
    const budget = createExpenseBudget(baseInput({ note: "خطة الإيجار الشهرية" }), []);
    expect(budget.id).toBe("budget-1");
    expect(budget.periodKind).toBe("month");
    expect(budget.periodKey).toBe("2026-10");
    expect(budget.scope).toEqual({ kind: "category", categoryLabel: "إيجار" });
    expect(budget.amountMinor).toBe(250_000);
    expect(budget.knowledge).toBe("known");
    expect(budget.note).toBe("خطة الإيجار الشهرية");
    expect(budget.operationKey).toBe("op-budget-1");
    expect(budget.status).toBe("active");
    expect(budget.supersededById).toBeNull();
    expect(budget.closedAt).toBeNull();
    expect(budget.closeReason).toBeNull();
    expect(budget.goalDismissed).toBe(false);
    expect(Object.isFrozen(budget)).toBe(true);
    expect(Object.isFrozen(budget.scope)).toBe(true);
  });
  it("مفتاح فترة غير صالح أو مبلغ غير صحيح موجب أو مفتاح عملية فارغ — رفض صادر", () => {
    expect(() => createExpenseBudget(baseInput({ periodKey: "2026-1" }), [])).toThrow("YYYY-MM");
    expect(() => createExpenseBudget(baseInput({ periodKey: "2026-13" }), [])).toThrow("YYYY-MM");
    expect(() => createExpenseBudget(baseInput({ periodKey: "26-10" }), [])).toThrow("YYYY-MM");
    expect(() => createExpenseBudget(baseInput({ amountMinor: 0 }), [])).toThrow("موجبًا");
    expect(() => createExpenseBudget(baseInput({ amountMinor: -100 }), [])).toThrow("موجبًا");
    expect(() => createExpenseBudget(baseInput({ amountMinor: 250.5 }), [])).toThrow("موجبًا");
    expect(() => createExpenseBudget(baseInput({ operationKey: "   " }), [])).toThrow("مفتاح عملية");
    expect(isValidBudgetPeriodKey("2026-10")).toBe(true);
    expect(isValidBudgetPeriodKey("2026-02")).toBe(true);
    expect(isValidBudgetPeriodKey("2026-00")).toBe(false);
    expect(isValidBudgetPeriodKey("2026-1")).toBe(false);
  });
  it("نوع فترة غير شهري غير منفذ؛ والنطاق فئة صريحة أو مصروف عام فقط — لا ضبابية", () => {
    expect(() => createExpenseBudget(baseInput({ periodKind: "week" as "month" }), [])).toThrow(
      "الشهري وحده",
    );
    expect(() =>
      createExpenseBudget(baseInput({ scope: { kind: "category", categoryLabel: "   " } }), []),
    ).toThrow("فئة الميزانية");
    expect(() =>
      createExpenseBudget(baseInput({ scope: { kind: "category", categoryLabel: "ي".repeat(81) } }), []),
    ).toThrow("٨٠ حرفًا");
    expect(() => createExpenseBudget(baseInput({ scope: { kind: "team" } as never }), [])).toThrow(
      "نطاق الميزانية",
    );
    const general = createExpenseBudget(baseInput({ scope: { kind: "general_expense" } }), []);
    expect(general.scope).toEqual({ kind: "general_expense" });
  });
});

describe("FIN-002 — منع العدّ المزدوج: حدود لا تتداخل", () => {
  it("عام + فئة في الفترة نفسها عدّ مزدوج — يُرفض في الاتجاهين قبل أي كتابة", () => {
    const general = createExpenseBudget(
      baseInput({ id: "b-general", scope: { kind: "general_expense" }, operationKey: "op-general" }),
      [],
    );
    expect(() => createExpenseBudget(baseInput({ id: "b-cat" }), [general])).toThrow("العدّ المزدوج");
    const category = createExpenseBudget(baseInput(), []);
    expect(() =>
      createExpenseBudget(
        baseInput({ id: "b-general", scope: { kind: "general_expense" }, operationKey: "op-general" }),
        [category],
      ),
    ).toThrow("العدّ المزدوج");
  });
  it("الفئة نفسها في الفترة نفسها ترفض؛ فئة أخرى أو شهر آخر مسموح — حدود منفصلة", () => {
    const rent = createExpenseBudget(baseInput(), []);
    expect(() => createExpenseBudget(baseInput({ id: "b-2", operationKey: "op-2" }), [rent])).toThrow(
      "العدّ المزدوج",
    );
    expect(() =>
      createExpenseBudget(
        baseInput({ id: "b-2", operationKey: "op-2", scope: { kind: "category", categoryLabel: "مواصلات" } }),
        [rent],
      ),
    ).not.toThrow();
    expect(() =>
      createExpenseBudget(baseInput({ id: "b-3", operationKey: "op-3", periodKey: "2026-11" }), [rent]),
    ).not.toThrow();
  });
});

describe("FIN-002 — تحرر الحد وكشف التداخل الصريح", () => {
  it("المستبدلة والمغلقة لا تحتل حدًّا — النطاق يتحرر بالاستبدال أو الإغلاق", () => {
    const rent = createExpenseBudget(baseInput(), []);
    const { supersededPrevious } = reviseExpenseBudget(rent, {
      successorId: "budget-2",
      amountMinor: 300_000,
      knowledge: "known",
      note: null,
      operationKey: "op-revise",
      at: AT,
    });
    expect(() =>
      createExpenseBudget(baseInput({ id: "b-new", operationKey: "op-new" }), [supersededPrevious]),
    ).not.toThrow();
    const closed = closeExpenseBudget(rent, { reason: "أغلقت المحل", at: AT });
    expect(() =>
      createExpenseBudget(baseInput({ id: "b-new-2", operationKey: "op-new-2" }), [closed]),
    ).not.toThrow();
  });
  it("findOverlappingBudgets يعيد النافذة المتداخلة فقط — كشف صريح بلا أي كتابة", () => {
    const rent = createExpenseBudget(baseInput(), []);
    const transport = createExpenseBudget(
      baseInput({ id: "b-t", operationKey: "op-t", scope: { kind: "category", categoryLabel: "مواصلات" } }),
      [rent],
    );
    const overlapping = findOverlappingBudgets([rent, transport], {
      periodKind: "month",
      periodKey: "2026-10",
      scope: { kind: "category", categoryLabel: "إيجار" },
    });
    expect(overlapping.map(budget => budget.id)).toEqual(["budget-1"]);
    expect(
      findOverlappingBudgets([rent], {
        periodKind: "month",
        periodKey: "2026-11",
        scope: { kind: "category", categoryLabel: "إيجار" },
      }),
    ).toHaveLength(0);
    expect(
      findOverlappingBudgets([rent], {
        periodKind: "month",
        periodKey: "2026-10",
        scope: { kind: "category", categoryLabel: "مواصلات" },
      }),
    ).toHaveLength(0);
    expect(
      findOverlappingBudgets([rent], {
        periodKind: "month",
        periodKey: "2026-10",
        scope: { kind: "general_expense" },
      }).map(budget => budget.id),
    ).toEqual(["budget-1"]);
  });
});

describe("FIN-002 — المراجعة: نسخة خلف تحفظ التاريخ", () => {
  const reviseInput = (overrides: Partial<ReviseExpenseBudgetInput> = {}): ReviseExpenseBudgetInput => ({
    successorId: "budget-2",
    amountMinor: 300_000,
    knowledge: "estimated",
    note: "ارتفاع متوقع",
    operationKey: "op-revise-1",
    at: REVISE_AT,
    ...overrides,
  });
  it("الزوج: خلف نافذ بحد سابقه نفسه، وسابقة مستبدلة بمضمونها الأصلي حرفيًا", () => {
    const previous = createExpenseBudget(baseInput({ note: "خطة الإيجار الأولية" }), []);
    const { successor, supersededPrevious } = reviseExpenseBudget(previous, reviseInput());
    expect(successor.id).toBe("budget-2");
    expect(successor.status).toBe("active");
    expect(successor.amountMinor).toBe(300_000);
    expect(successor.knowledge).toBe("estimated");
    expect(successor.note).toBe("ارتفاع متوقع");
    expect(successor.operationKey).toBe("op-revise-1");
    expect(successor.createdAt).toBe(REVISE_AT);
    expect(successor.periodKind).toBe(previous.periodKind);
    expect(successor.periodKey).toBe(previous.periodKey);
    expect(successor.scope).toEqual(previous.scope);
    expect(successor.supersededById).toBeNull();
    expect(supersededPrevious.status).toBe("superseded");
    expect(supersededPrevious.supersededById).toBe("budget-2");
    expect(supersededPrevious.amountMinor).toBe(previous.amountMinor);
    expect(supersededPrevious.note).toBe("خطة الإيجار الأولية");
    expect(supersededPrevious.operationKey).toBe(previous.operationKey);
    expect(supersededPrevious.createdAt).toBe(previous.createdAt);
    expect(Object.isFrozen(successor)).toBe(true);
    expect(Object.isFrozen(supersededPrevious)).toBe(true);
  });
  it("لا تُراجَع مستبدلة أو مغلقة؛ والخلف يحمل علم الهدف كما كان", () => {
    const active = createExpenseBudget(baseInput(), []);
    const { supersededPrevious } = reviseExpenseBudget(active, reviseInput());
    expect(() => reviseExpenseBudget(supersededPrevious, reviseInput({ successorId: "budget-3" }))).toThrow(
      "نافذة",
    );
    const closed = closeExpenseBudget(active, { reason: "سبب موثق", at: AT });
    expect(() => reviseExpenseBudget(closed, reviseInput())).toThrow("نافذة");
    const dismissed = dismissGoal(createExpenseBudget(baseInput(), []));
    const { successor } = reviseExpenseBudget(dismissed, reviseInput());
    expect(successor.goalDismissed).toBe(true);
  });
  it("مدخلات المراجعة تُرفض صادرة: معرّف مكرر أو فارغ، مبلغ غير موجب، مفتاح فارغ", () => {
    const active = createExpenseBudget(baseInput(), []);
    expect(() => reviseExpenseBudget(active, reviseInput({ successorId: "budget-1" }))).toThrow(
      "معرّف النسخة الخلف",
    );
    expect(() => reviseExpenseBudget(active, reviseInput({ successorId: "   " }))).toThrow("المعرّف");
    expect(() => reviseExpenseBudget(active, reviseInput({ amountMinor: 0 }))).toThrow("موجبًا");
    expect(() => reviseExpenseBudget(active, reviseInput({ operationKey: " " }))).toThrow("مفتاح عملية");
  });
});

describe("FIN-002 — الإغلاق الموثق: علة إلزامية ولا حذف صامت", () => {
  it("الإغلاق يتطلب علة ويحفظ مضمون السجل كما هو", () => {
    const budget = createExpenseBudget(baseInput(), []);
    expect(() => closeExpenseBudget(budget, { reason: "   ", at: AT })).toThrow("علة");
    const closed = closeExpenseBudget(budget, { reason: "أغلقت المحل هذا الشهر", at: AT });
    expect(closed.status).toBe("closed");
    expect(closed.closedAt).toBe(AT);
    expect(closed.closeReason).toBe("أغلقت المحل هذا الشهر");
    expect(closed.amountMinor).toBe(250_000);
    expect(closed.scope).toEqual({ kind: "category", categoryLabel: "إيجار" });
    expect(closed.operationKey).toBe("op-budget-1");
    expect(closed.supersededById).toBeNull();
    expect(closed.goalDismissed).toBe(false);
    expect(Object.isFrozen(closed)).toBe(true);
  });
  it("إعادة إرسال الإغلاق تعيد السجل نفسه — علة الإغلاق الموثقة لا تُعاد كتابتها", () => {
    const budget = createExpenseBudget(baseInput(), []);
    const closed = closeExpenseBudget(budget, { reason: "علة أولى", at: AT });
    const replay = closeExpenseBudget(closed, { reason: "علة أخرى", at: "2026-09-24T00:00:00.000Z" });
    expect(replay).toBe(closed);
    expect(replay.closeReason).toBe("علة أولى");
  });
  it("لا يُغلق إلا ميزانية نافذة — المستبدلة مسجَّلة بخلفها ولا تُلمس", () => {
    const active = createExpenseBudget(baseInput(), []);
    const { supersededPrevious } = reviseExpenseBudget(active, {
      successorId: "budget-2",
      amountMinor: 1_000,
      knowledge: "known",
      note: null,
      operationKey: "op-revise",
      at: AT,
    });
    expect(() => closeExpenseBudget(supersededPrevious, { reason: "سبب", at: AT })).toThrow("نافذة");
  });
});

describe("FIN-002 — الأهداف: اختيارية قابلة للإخفاء والاستعادة", () => {
  it("إخفاء الهدف واستعادته انقلاب علم خالص — بلا أي أثر ولا ضغط عودة", () => {
    const budget = createExpenseBudget(baseInput(), []);
    const dismissed = dismissGoal(budget);
    expect(dismissed.goalDismissed).toBe(true);
    expect(dismissed.status).toBe("active");
    expect(dismissed.amountMinor).toBe(budget.amountMinor);
    expect(dismissed.operationKey).toBe(budget.operationKey);
    const restored = restoreGoal(dismissed);
    expect(restored.goalDismissed).toBe(false);
    expect(Object.isFrozen(restored)).toBe(true);
    expect(dismissGoal(dismissGoal(budget)).goalDismissed).toBe(true);
  });
  it("التاريخ المحفوظ لا يُلمس: إخفاء أو استعادة مستبدلة/مغلقة يُرفض", () => {
    const active = createExpenseBudget(baseInput(), []);
    const { supersededPrevious } = reviseExpenseBudget(active, {
      successorId: "budget-2",
      amountMinor: 1_000,
      knowledge: "known",
      note: null,
      operationKey: "op-revise",
      at: AT,
    });
    const closed = closeExpenseBudget(
      createExpenseBudget(baseInput({ id: "budget-9", operationKey: "op-9" }), []),
      { reason: "سبب", at: AT },
    );
    expect(() => dismissGoal(supersededPrevious)).toThrow("نافذة");
    expect(() => restoreGoal(supersededPrevious)).toThrow("نافذة");
    expect(() => dismissGoal(closed)).toThrow("نافذة");
    expect(() => restoreGoal(closed)).toThrow("نافذة");
  });
});

describe("FIN-002 — حالة القراءة المشتقة: ضمن/تجاوز/تحت المراجعة", () => {
  it("حساب صحيح بالوحدات الصغرى: المتبقي والتجاوز — لا فواصل عشرية", () => {
    const budget = createExpenseBudget(baseInput({ amountMinor: 100_000 }), []);
    const within = evaluateBudgetStatus(budget, 40_000);
    expect(within.state).toBe("within");
    expect(within.remainingMinor).toBe(60_000);
    expect(within.overrunMinor).toBeNull();
    expect(within.notes).toEqual([]);
    const edge = evaluateBudgetStatus(budget, 100_000);
    expect(edge.state).toBe("within");
    expect(edge.remainingMinor).toBe(0);
    const exceeded = evaluateBudgetStatus(budget, 120_500);
    expect(exceeded.state).toBe("exceeded");
    expect(exceeded.overrunMinor).toBe(20_500);
    expect(exceeded.remainingMinor).toBeNull();
    const oneOver = evaluateBudgetStatus(createExpenseBudget(baseInput({ amountMinor: 25_000 }), []), 25_001);
    expect(oneOver.state).toBe("exceeded");
    expect(oneOver.overrunMinor).toBe(1);
    const zeroSpent = evaluateBudgetStatus(budget, 0);
    expect(zeroSpent.state).toBe("within");
    expect(zeroSpent.remainingMinor).toBe(100_000);
  });
  it("المنصرف غير المعلوم تحت المراجعة — المجهول لا يصير صفرًا ولا انحرافًا زائفًا", () => {
    const budget = createExpenseBudget(baseInput({ amountMinor: 100_000 }), []);
    const unknown = evaluateBudgetStatus(budget, null);
    expect(unknown.state).toBe("under_review");
    expect(unknown.remainingMinor).toBeNull();
    expect(unknown.overrunMinor).toBeNull();
    expect(unknown.notes).toContain("spent_unknown");
    expect(unknown.notes).not.toContain("budget_estimated");
    const estimated = evaluateBudgetStatus(
      createExpenseBudget(baseInput({ knowledge: "estimated" }), []),
      10_000,
    );
    expect(estimated.state).toBe("within");
    expect(estimated.remainingMinor).toBe(240_000);
    expect(estimated.notes).toContain("budget_estimated");
    expect(estimated.notes).not.toContain("spent_unknown");
  });
  it("منصرف سالب أو غير صحيح يُرفض صادرًا — الأرقام الصحيحة حصرًا", () => {
    const budget = createExpenseBudget(baseInput(), []);
    expect(() => evaluateBudgetStatus(budget, -1)).toThrow("غير سالب");
    expect(() => evaluateBudgetStatus(budget, 10.5)).toThrow("غير سالب");
    expect(() => evaluateBudgetStatus(budget, Number.MAX_SAFE_INTEGER + 1)).toThrow("غير سالب");
  });
});

describe("FIN-002 — نقاء الخطة: لا حدث مالي ولا تعديل مدخلات", () => {
  it("سطح وحدة الميزانية مقفل: دوالها وعواها حصرًا — لا رمز واحد من دومين الحدث المالي", () => {
    /* الخطة ليست حدثًا ماليًا: أي تسرب لرموز الأحداث إلى برميل الميزانية
     * يظهر هنا كمفتاح زائد فيُرفض قبل أن يصل المستهلك (نمط قفل السطح). */
    expect(Object.keys(budgetBarrel).sort()).toEqual([
      "budgetPeriodKinds",
      "closeExpenseBudget",
      "createExpenseBudget",
      "dismissGoal",
      "evaluateBudgetStatus",
      "expenseBudgetKnowledgeLevels",
      "expenseBudgetStatuses",
      "findOverlappingBudgets",
      "isValidBudgetPeriodKey",
      "restoreGoal",
      "reviseExpenseBudget",
    ]);
  });
  it("المدخلات لا تُمس: مراجعة وإغلاق وإخفاء على مدخلات مجمدة بلا كتابة جزئية", () => {
    const frozenInput = Object.freeze({ ...baseInput() });
    const budget = createExpenseBudget(frozenInput, []);
    const frozenRevision = Object.freeze({
      successorId: "budget-2",
      amountMinor: 300_000,
      knowledge: "known",
      note: null,
      operationKey: "op-revise",
      at: AT,
    });
    expect(() => reviseExpenseBudget(budget, frozenRevision)).not.toThrow();
    expect(budget.status).toBe("active");
    expect(budget.supersededById).toBeNull();
    expect(() => closeExpenseBudget(budget, Object.freeze({ reason: "سبب موثق", at: AT }))).not.toThrow();
    expect(() => dismissGoal(budget)).not.toThrow();
    expect(budget.goalDismissed).toBe(false);
    expect(budget.amountMinor).toBe(250_000);
    expect(frozenInput.amountMinor).toBe(250_000);
    expect(frozenInput.scope).toEqual({ kind: "category", categoryLabel: "إيجار" });
  });
});
