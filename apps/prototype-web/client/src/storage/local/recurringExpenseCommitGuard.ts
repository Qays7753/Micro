import type {
  RecurringExpenseOccurrence,
  RecurringExpenseRuleRevision,
  RecurringExpenseSeries,
} from "@micro-domain/recurring-expense/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { RecurringExpenseOccurrenceChange } from "./types";

/* OPS-003 (عقد ٤١ §٨ — AGENTS §10 قاعدة ٧): لا كتابة عمياء لمسارات المصروف
 * المتكرر الحساسة. هذا الحارس النقي يُستدعى داخل حد الكتابة نفسه في
 * المحوّلين (IndexedDB داخل المعاملة، والذاكرة قبل التعيين):
 *
 * 1) المسودة والسلسلة: الحالة الحية يجب أن تطابق الأساس الذي قرأته الخدمة —
 *    انحرافها يعني مسارًا آخر كتب بين القراءة والالتزام فيُرفض بـstorage_stale
 *    ولا يُكتب شيء.
 * 2) الفترة: نفس القاعدة لكل قرار مفرد، وإعادة قرار سبق تطبيقه حرفيًا
 *    إعادةُ استخدام صادقة (reused) لا كتابة ثانية.
 * 3) التسجيل الذرّي: الفترة والحدث يلتزمان معًا — إعادة مفتاح الحتمية تُعاد
 *    كما هي (reused)، واصطدام المفتاح بحدث مختلف النوع أو المبلغ يُرفض رفضًا
 *    صادرًا (حارس اصطدام المفتاح عبر الأنواع الذي أوصى به تقييم ما قبل
 *    التنفيذ)، ولا يُقبل حدث لفترة مقَرَّرة سلفًا بمعرّف مختلف. */

export const RECURRING_EXPENSE_STALE_MESSAGE =
  "سلسلة المصروف المتكرر أو فتراتها تغيّرت من مسار آخر بعد فتحك لها — لم يُسجَّل شيء؛ أعد المحاولة.";

export type RecurringExpenseGuardResult = { ok: true; reused?: boolean } | { ok: false; message: string };

/** التطابق الحرفي بين الأساس والحي — شرط الكتابة المحروسة. */
export function recurringExpenseSeriesUnchanged(
  stored: RecurringExpenseSeries | undefined,
  base: RecurringExpenseSeries,
): boolean {
  return stored !== undefined && JSON.stringify(stored) === JSON.stringify(base);
}

/** إنشاء المسودة: لا سلسلة قائمة بهذا المعرّف إلا إذا كانت هي نفسها (إعادة تشغيل). */
export function validateRecurringExpenseDraftCommit(
  storedSeries: RecurringExpenseSeries | undefined,
  storedRevision: RecurringExpenseRuleRevision | undefined,
  series: RecurringExpenseSeries,
  revision: RecurringExpenseRuleRevision,
): RecurringExpenseGuardResult {
  if (storedSeries === undefined && storedRevision === undefined) return { ok: true };
  if (
    storedSeries !== undefined &&
    storedRevision !== undefined &&
    JSON.stringify(storedSeries) === JSON.stringify(series) &&
    JSON.stringify(storedRevision) === JSON.stringify(revision)
  )
    return { ok: true, reused: true };
  return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
}

/** تغيير السلسلة (مع مراجعة خلف وتحديثات فترات اختيارية): الأساس مطابق للحي،
 * والمراجعة الخلف جديدة كليًا، وكل زوج فترات أساسه مطابق للحي. */
export function validateRecurringExpenseSeriesChange(
  storedSeries: RecurringExpenseSeries | undefined,
  storedRevisions: readonly RecurringExpenseRuleRevision[],
  storedOccurrences: readonly RecurringExpenseOccurrence[],
  seriesBase: RecurringExpenseSeries,
  seriesNext: RecurringExpenseSeries,
  revision: RecurringExpenseRuleRevision | null,
  occurrenceUpdates: readonly RecurringExpenseOccurrenceChange[],
): RecurringExpenseGuardResult {
  if (!recurringExpenseSeriesUnchanged(storedSeries, seriesBase))
    return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
  if (revision !== null) {
    if (storedRevisions.some(existing => existing.id === revision.id))
      return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
    if (seriesNext.currentRevision !== revision.revision)
      return { ok: false, message: "رقم المراجعة الخلف لا يطابق رأس السلسلة — لم يُسجَّل شيء." };
  }
  const storedById = new Map(storedOccurrences.map(occurrence => [occurrence.id, occurrence]));
  for (const update of occurrenceUpdates) {
    const stored = storedById.get(update.next.id);
    if (stored === undefined || JSON.stringify(stored) !== JSON.stringify(update.base))
      return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
  }
  return { ok: true };
}

/** توليد الفترات (إضافة فقط): الغائب يُنشأ، والمطابق يُتخطى، والمختلف تعارض —
 * قرارات الفترات القائمة لا تُمس أبدًا (عقد ٤١ §٥: توليد حتمي بالإضافة فقط). */
export function validateRecurringExpenseMaterialization(
  stored: RecurringExpenseOccurrence | undefined,
  occurrence: RecurringExpenseOccurrence,
): RecurringExpenseGuardResult {
  if (stored === undefined) return { ok: true };
  if (JSON.stringify(stored) === JSON.stringify(occurrence)) return { ok: true, reused: true };
  return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
}

/** قرار فترة مفرد: الأساس مطابق للحي (أو القرار مطبق سلفًا = إعادة استخدام). */
export function validateRecurringExpenseOccurrenceDecision(
  stored: RecurringExpenseOccurrence | undefined,
  base: RecurringExpenseOccurrence,
  next: RecurringExpenseOccurrence,
): RecurringExpenseGuardResult {
  if (stored === undefined) return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
  if (JSON.stringify(stored) === JSON.stringify(next)) return { ok: true, reused: true };
  if (JSON.stringify(stored) !== JSON.stringify(base))
    return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
  return { ok: true };
}

/** عهدة مفتاح الحتمية للأحداث — إعادة تشغيل التأكيد بعد نجاح تُعاد كما هي. */
export function findRecurringExpenseEventByKey(
  events: readonly FinancialEvent[],
  idempotencyKey: string,
  excludeId: string,
): FinancialEvent | undefined {
  return events.find(candidate => candidate.id !== excludeId && candidate.idempotencyKey === idempotencyKey);
}

/** حارس اصطدام المفتاح عبر الأنواع: الحدث الموجود بنفس المفتاح يجب أن يطابق
 * نوع نية التأكيد ومبلغها؛ الاختلاف رفض صادر لا كتابة (عقد ٤١ §٨). */
export function validateRecurringExpenseKeyEventCollision(
  existing: FinancialEvent,
  expectedType: FinancialEvent["type"],
  expectedAmountMinor: number,
): RecurringExpenseGuardResult {
  if (existing.type !== expectedType || existing.amountMinor !== expectedAmountMinor)
    return {
      ok: false,
      message:
        "مفتاح تأكيد هذه الفترة مستخدم بحدث مختلف (النوع أو المبلغ لا يطابق نية التأكيد) — لم يُسجَّل شيء؛ راجع الحدث القائم.",
    };
  return { ok: true, reused: true };
}

/** التسجيل الذرّي: الأساس مطابق للحي، والحدث المراد إنشاؤه غير موجود، وربط
 * الفترة بالحدث سليم — النتيجة تربط الحدث الملتزم في هذه المعاملة نفسها لا
 * حدثًا آخر، ولا تُقبل فترة مقَرَّرة سلفًا بمعرّف مختلف. replay = حدث قائم
 * بنفس المعرّف أو نفس مفتاح الحتمية (المستهلك يفحص اصطدامه عبر
 * validateRecurringExpenseKeyEventCollision قبل هذا الاستدعاء). */
export function validateRecurringExpenseOccurrenceRecordCommit(
  storedOccurrence: RecurringExpenseOccurrence | undefined,
  base: RecurringExpenseOccurrence,
  next: RecurringExpenseOccurrence,
  replay: FinancialEvent | undefined,
  committedEventId: string,
): RecurringExpenseGuardResult {
  if (replay !== undefined) {
    /* حدث قائم بنفس المفتاح (أو نفس المعرّف): التزام سابق نجح — الفترة
     * المخزنة تربطه بالضبط، فيُعاد الاثنان كما هما، إعادة استخدام لا كتابة ثانية. */
    if (storedOccurrence === undefined || storedOccurrence.recordedFinancialEventId !== replay.id)
      return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
    return { ok: true, reused: true };
  }
  if (storedOccurrence === undefined) return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
  if (JSON.stringify(storedOccurrence) === JSON.stringify(next)) return { ok: true, reused: true };
  if (JSON.stringify(storedOccurrence) !== JSON.stringify(base))
    return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
  if (storedOccurrence.recordedFinancialEventId !== null)
    return {
      ok: false,
      message: "هذه الفترة مقَرَّرة سلفًا بحدث آخر — استخدم إعادة التأكيد بنفس المفتاح أو راجع الحدث القائم.",
    };
  if (next.recordedFinancialEventId !== committedEventId)
    return {
      ok: false,
      message: "نتيجة التسجيل لا تربط الحدث الملتزم في هذه المعاملة نفسها — لم يُسجَّل شيء.",
    };
  return { ok: true };
}
