import { describe, expect, it } from "vitest";
import {
  EXPENSE_BUDGET_BROKEN_PAIR_MESSAGE,
  EXPENSE_BUDGET_STALE_MESSAGE,
  validateExpenseBudgetRevisionPair,
  validateExpenseBudgetSave,
} from "./expenseBudgetCommitGuard";
import { createExpenseBudget, reviseExpenseBudget } from "@micro-domain/budget/index.js";
import type { ExpenseBudgetRecord } from "@micro-domain/budget/index.js";

/* R4-A3 (إغلاق R3-N3 — التزام موثق في بطاقات R3): اختبار وحدة مباشر لحارس
 * الميزانيات النقي. الحارس مشترك بين المحوّلين بالتصميم (يُستدعى داخل حد
 * الكتابة نفسه في IndexedDb داخل المعاملة وفي الذاكرة قبل التعيين) —
 * الاختبار هنا يثبت سلوكه هو: القرار (قبول/رفض/إعادة استخدام) بلا أي أثر
 * كتابة، وهو نفس الدليل الذي تستهلكه أجنحة المطابقة للطرفين معًا.
 * السلوك المثبت: عقد ٤٢ §٥/§٨ — لا كتابة عمياء لخطة مالية موثقة. */

const AT = "2026-10-08T08:00:00.000Z";

function makeBudget(id: string, periodKey: string, operationKey: string): ExpenseBudgetRecord {
  return createExpenseBudget(
    {
      id,
      periodKind: "month",
      periodKey,
      scope: { kind: "general_expense" },
      amountMinor: 20_000,
      knowledge: "known",
      note: "خطة شهرية صريحة",
      operationKey,
      createdAt: AT,
    },
    [],
  );
}

describe("R4-A3 — حارس حفظ الميزانية (validateExpenseBudgetSave)", () => {
  it("الغياب التام: إنشاء جديد مقبول", () => {
    const budget = makeBudget("budget-1", "2026-10", "op-1");
    expect(validateExpenseBudgetSave(undefined, budget)).toEqual({ ok: true });
  });

  it("التطابق الحرفي: إعادة تشغيل ناجحة = إعادة استخدام صادقة بلا كتابة ثانية", () => {
    const budget = makeBudget("budget-2", "2026-10", "op-2");
    const result = validateExpenseBudgetSave(budget, budget);
    expect(result).toEqual({ ok: true, reused: true });
  });

  it("الانتقال الموثق في المكان: الحالة المقروءة expected تطابق المخزون = CAS صادق مقبول", () => {
    const stored = makeBudget("budget-3", "2026-10", "op-3");
    const expected = makeBudget("budget-3", "2026-10", "op-3");
    const changed: ExpenseBudgetRecord = { ...stored, amountMinor: 25_000 };
    expect(validateExpenseBudgetSave(stored, changed, expected)).toEqual({ ok: true });
  });

  it("التعارض: سجل مختلف على المعرّف نفسه بلا expected = رفض صادر storage_stale", () => {
    const stored = makeBudget("budget-4", "2026-10", "op-4");
    const conflicting = makeBudget("budget-4", "2026-11", "op-4");
    const result = validateExpenseBudgetSave(stored, conflicting);
    expect(result).toEqual({ ok: false, message: EXPENSE_BUDGET_STALE_MESSAGE });
  });

  it("التعارض رغم وجود expected: المخزون تغيّر عن الحالة المقروءة = رفض لا كتابة عمياء", () => {
    const stored = makeBudget("budget-5", "2026-10", "op-5");
    /* الحالة المقروءة قديمة (فترة مختلفة عما صار مخزونًا) — CAS يكشف الانحراف. */
    const staleExpected = makeBudget("budget-5", "2026-09", "op-5");
    const incoming: ExpenseBudgetRecord = { ...stored, amountMinor: 25_000 };
    const result = validateExpenseBudgetSave(stored, incoming, staleExpected);
    expect(result).toEqual({ ok: false, message: EXPENSE_BUDGET_STALE_MESSAGE });
  });
});

describe("R4-A3 — زوج مراجعة الميزانية الذرّي (validateExpenseBudgetRevisionPair)", () => {
  it("الرابط المكسور: السابقة لا تشير للخلف (supersededById) = رفض قبل أي فحص آخر", () => {
    const previous = makeBudget("budget-p", "2026-10", "op-p");
    const successor = makeBudget("budget-s", "2026-10", "op-s");
    const result = validateExpenseBudgetRevisionPair(undefined, previous, successor, previous);
    expect(result).toEqual({ ok: false, message: EXPENSE_BUDGET_BROKEN_PAIR_MESSAGE });
  });

  it("إعادة تشغيل الزوج كاملًا: الخلف والسابقة قائمان مطابقان = إعادة استخدام صادقة", () => {
    const original = makeBudget("budget-6", "2026-10", "op-6");
    const { successor, supersededPrevious } = reviseExpenseBudget(original, {
      successorId: "budget-6-s",
      amountMinor: 22_000,
      knowledge: "known",
      operationKey: "op-6-rev",
      at: AT,
    });
    const result = validateExpenseBudgetRevisionPair(
      successor,
      supersededPrevious,
      successor,
      supersededPrevious,
    );
    expect(result).toEqual({ ok: true, reused: true });
  });

  it("نصف الزوج منحرف: الخلف قائم مختلف = رفض صادر", () => {
    const original = makeBudget("budget-7", "2026-10", "op-7");
    const { successor, supersededPrevious } = reviseExpenseBudget(original, {
      successorId: "budget-7-s",
      amountMinor: 22_000,
      knowledge: "known",
      operationKey: "op-7-rev",
      at: AT,
    });
    const drifted: ExpenseBudgetRecord = { ...successor, amountMinor: 99_999 };
    const result = validateExpenseBudgetRevisionPair(
      drifted,
      supersededPrevious,
      successor,
      supersededPrevious,
    );
    expect(result).toEqual({ ok: false, message: EXPENSE_BUDGET_STALE_MESSAGE });
  });

  it("أول مراجعة صادقة: السابقة النافذة مطابقة لصيغتها قبل المراجعة = الزوج مقبول", () => {
    const original = makeBudget("budget-8", "2026-10", "op-8");
    const { successor, supersededPrevious } = reviseExpenseBudget(original, {
      successorId: "budget-8-s",
      amountMinor: 21_000,
      knowledge: "known",
      operationKey: "op-8-rev",
      at: AT,
    });
    /* المخزون الحي: السابقة النافذة كما قُرئت قبل المراجعة (activeFormOf). */
    const result = validateExpenseBudgetRevisionPair(undefined, original, successor, supersededPrevious);
    expect(result).toEqual({ ok: true });
  });

  it("السابقة المخزونة انحرفت عن الأساس المقروء = رفض، لا حالة بينية", () => {
    const original = makeBudget("budget-9", "2026-10", "op-9");
    const { successor, supersededPrevious } = reviseExpenseBudget(original, {
      successorId: "budget-9-s",
      amountMinor: 21_000,
      knowledge: "known",
      operationKey: "op-9-rev",
      at: AT,
    });
    const storedDrifted: ExpenseBudgetRecord = { ...original, amountMinor: 55_555 };
    const result = validateExpenseBudgetRevisionPair(undefined, storedDrifted, successor, supersededPrevious);
    expect(result).toEqual({ ok: false, message: EXPENSE_BUDGET_STALE_MESSAGE });
  });

  it("لا زوج مراجعة بلا أصل: السابقة غير قائمة محليًا = رفض (ملف مكسور)", () => {
    const original = makeBudget("budget-10", "2026-10", "op-10");
    const { successor, supersededPrevious } = reviseExpenseBudget(original, {
      successorId: "budget-10-s",
      amountMinor: 21_000,
      knowledge: "known",
      operationKey: "op-10-rev",
      at: AT,
    });
    const result = validateExpenseBudgetRevisionPair(successor, undefined, successor, supersededPrevious);
    expect(result).toEqual({ ok: false, message: EXPENSE_BUDGET_STALE_MESSAGE });
  });
});
