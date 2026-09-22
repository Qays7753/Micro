import type { ExpenseBudgetRecord } from "@micro-domain/budget/index.js";

/* FIN-002 (عقد ٤٢ §٥/§٨ — نمط حراس المجموعة ٦): لا كتابة عمياء لسجلات
 * الميزانية. هذا الحارس النقي يُستدعى داخل حد الكتابة نفسه في المحوّلين
 * (IndexedDB داخل المعاملة، والذاكرة قبل التعيين):
 *
 * 1) حفظ سجل واحد: الغائب يُنشأ، والمطابق حرفيًا إعادةُ استخدام صادقة (reused)
 *    بلا كتابة ثانية، والمختلف على المعرّف نفسه رفض صادر (storage_stale) —
 *    لا آخر-كاتب-يفوز على خطة مالية موثقة.
 * 2) زوج المراجعة الذرّي: الخلف والسابقة يلتزمان معًا — إعادة تشغيل الزوج
 *    كاملًا إعادةُ استخدام، وأي نصف أو انحراف رفض صادر بلا كتابة؛ وربط
 *    السابقة بخلفها (supersededById) شرط صريح — الرابط المكسور ملف مكسور.
 *
 * المخزن يحفظ سجلات الدومين حرفيًا؛ لا منطق دومين هنا — هوية ومضمون فقط. */

export const EXPENSE_BUDGET_STALE_MESSAGE =
  "سجل الميزانية تغيّر من مسار آخر بعد فتحك له — لم يُسجَّل شيء؛ أعد المحاولة.";

export const EXPENSE_BUDGET_BROKEN_PAIR_MESSAGE =
  "زوج مراجعة الميزانية مكسور: السابقة لا تربط بخلفها (supersededById) — لم يُسجَّل شيء.";

export type ExpenseBudgetGuardResult = { ok: true; reused?: boolean } | { ok: false; message: string };

/** التطابق الحرفي بين سجلين — أساس إعادة الاستخدام الصادقة. */
const identical = (left: ExpenseBudgetRecord, right: ExpenseBudgetRecord): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/** حفظ سجل واحد: لا سجل قائم بهذا المعرّف إلا إذا كان هو نفسه (إعادة تشغيل). */
export function validateExpenseBudgetSave(
  stored: ExpenseBudgetRecord | undefined,
  record: ExpenseBudgetRecord,
): ExpenseBudgetGuardResult {
  if (stored === undefined) return { ok: true };
  if (identical(stored, record)) return { ok: true, reused: true };
  return { ok: false, message: EXPENSE_BUDGET_STALE_MESSAGE };
}

/** زوج المراجعة: ربط السابقة بخلفها شرط صريح قبل أي فحص آخر. */
export function expenseBudgetPairLinksForward(
  successor: ExpenseBudgetRecord,
  supersededPrevious: ExpenseBudgetRecord,
): boolean {
  return supersededPrevious.supersededById === successor.id && successor.id !== supersededPrevious.id;
}

/** الصيغة النافذة المتوقعة للسابقة قبل المراجعة — الأساس الذي قرأته الخدمة. */
const activeFormOf = (supersededPrevious: ExpenseBudgetRecord): ExpenseBudgetRecord => ({
  ...supersededPrevious,
  status: "active",
  supersededById: null,
});

/** زوج المراجعة الذرّي: السابقة قائمة بصيغتها النافذة (الأساس) والخلف جديد —
 * أو الزوج كاملًا قائمًا مطابقًا (إعادة تشغيل)؛ أي نصف أو انحراف رفض صادر
 * لا حالة بينية أبدًا. */
export function validateExpenseBudgetRevisionPair(
  storedSuccessor: ExpenseBudgetRecord | undefined,
  storedPrevious: ExpenseBudgetRecord | undefined,
  successor: ExpenseBudgetRecord,
  supersededPrevious: ExpenseBudgetRecord,
): ExpenseBudgetGuardResult {
  if (!expenseBudgetPairLinksForward(successor, supersededPrevious))
    return { ok: false, message: EXPENSE_BUDGET_BROKEN_PAIR_MESSAGE };
  if (storedSuccessor !== undefined && storedPrevious !== undefined) {
    if (identical(storedSuccessor, successor) && identical(storedPrevious, supersededPrevious))
      return { ok: true, reused: true };
    return { ok: false, message: EXPENSE_BUDGET_STALE_MESSAGE };
  }
  if (storedSuccessor === undefined && storedPrevious !== undefined) {
    if (identical(storedPrevious, activeFormOf(supersededPrevious))) return { ok: true };
    return { ok: false, message: EXPENSE_BUDGET_STALE_MESSAGE };
  }
  /* لا زوج مراجعة بلا أصل: السابقة النافذة غير قائمة محليًا — مسار مكسور. */
  return { ok: false, message: EXPENSE_BUDGET_STALE_MESSAGE };
}
