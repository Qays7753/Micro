/**
 * OPS-003 (عقد ٤١): سياسات المصروف المتكرر المحلي — نقية بالكامل.
 *
 * القواعد غير القابلة للتفاوض المطبقة هنا:
 * - مفتاح الفترة من عقد businessTime المجمد (`YYYY-MM` أول سبعة أحرف من تاريخ
 *   الأعمال) — لا خوارزمية شهر مستقلة؛ الحساب على المفاتيح المتعارف عليها
 *   (تقويم صحيح / مقارنة معجمية) لا يشتق مفاتيح من لحظات.
 * - لا كتابة مالية من هذه الوحدة إطلاقًا؛ الحدث المالي ينشأ فقط عبر الكاتب
 *   الكنوني بعد تأكيد صريح (verifyRecordedEventMatchesIntent يحرس الاصطدام).
 * - التخطي لا يكتب صفرًا؛ «متأخر» انتباه مشتق لا دين؛ المجهول لا يصير نجاحًا.
 * - انتقال غير قانوني = رفض صادر قبل أي تعديل (لا كتابة جزئية).
 */
import {
  recurringExpenseAmountModes,
  recurringExpenseFrequencies,
  recurringExpenseMonthEndPolicies,
  recurringExpenseOccurrenceStatuses,
  recurringExpenseSeriesStatuses,
  type CreateRecurringExpenseOccurrenceInput,
  type CreateRecurringExpenseRuleRevisionInput,
  type CreateRecurringExpenseSeriesInput,
  type MarkOccurrenceRecordedInput,
  type ReadOccurrenceOptions,
  type RecurringExpenseAttentionState,
  type RecurringExpenseDueDateResolution,
  type RecurringExpenseFrequency,
  type RecurringExpenseOccurrence,
  type RecurringExpenseOccurrenceAction,
  type RecurringExpenseOccurrenceReading,
  type RecurringExpenseOccurrenceStatus,
  type RecurringExpenseRuleRevision,
  type RecurringExpenseSeries,
  type RecurringExpenseSeriesStatus,
} from "./types.js";
import { isValidLocalDate, isValidTimestamp } from "../shared/index.js";
import type { MoneyMinor } from "../shared/index.js";
import type { FinancialEventType } from "../financial-event/types.js";

/* ─── معينات التحقق (نمط الوحدات القائمة) ─── */

const required = (value: string, message: string) => {
  if (!value.trim()) throw new Error(message);
  return value.trim();
};
const timestamp = (value: string, label: string) => {
  if (!isValidTimestamp(value)) throw new Error(`${label} غير صالح.`);
  return value;
};
const localDate = (value: string, label: string) => {
  if (!isValidLocalDate(value)) throw new Error(`${label} غير صالح.`);
  return value;
};
const positiveIntegerInRange = (value: number, min: number, max: number, label: string) => {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`${label} يجب أن يكون عددًا صحيحًا بين ${min} و${max}.`);
  return value;
};
const positiveMinorOrNull = (value: number | null | undefined, label: string) => {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${label} يجب أن يكون مبلغًا موجبًا بالدينار ضمن الدقة الآمنة.`);
  return value;
};
const optionalLabel = (value: string | null | undefined, label: string) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length > 80) throw new Error(`${label} أطول من ٨٠ حرفًا؛ اختصره بدل البتر الصامت.`);
  return trimmed;
};
const optionalReason = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
};

/* ─── مفاتيح الفترة (YYYY-MM) — حساب صحيح على المفاتيح المتعارف عليها ─── */

const PERIOD_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidRecurringPeriodKey(periodKey: string): boolean {
  return PERIOD_KEY_PATTERN.test(periodKey);
}
const periodKey = (value: string, label: string) => {
  if (!isValidRecurringPeriodKey(value)) throw new Error(`${label} غير صالح (متوقع YYYY-MM).`);
  return value;
};
/** فرق الأشهر الصحيح (قد يكون سالبًا) — حساب صحيح على مفتاحين متعارف عليهما. */
export function recurringPeriodMonthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return ty! * 12 + tm! - (fy! * 12 + fm!);
}
/** الفترة بعد عدد أشهر — عكس monthsBetween (قسمة صحيحة بلا Math.floor). */
export function recurringPeriodAfter(periodKeyToAdvance: string, months: number): string {
  const [y, m] = periodKeyToAdvance.split("-").map(Number);
  const total = y! * 12 + (m! - 1) + months;
  const ny = (total - (total % 12)) / 12;
  const nm = (total % 12) + 1;
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}`;
}
/** عدد أيام الشهر (قاعدة الكبيسة الصحيحة) — لسياسات يوم الاستحقاق فقط. */
export function daysInRecurringPeriod(periodKey: string): number {
  const [y, m] = periodKey.split("-").map(Number);
  if (m === 2) {
    const leap = y! % 4 === 0 && (y! % 100 !== 0 || y! % 400 === 0);
    return leap ? 29 : 28;
  }
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}

/* ─── السلسلة ─── */

export function createRecurringExpenseSeries(
  input: CreateRecurringExpenseSeriesInput,
): RecurringExpenseSeries {
  const id = required(input.id, "معرّف سلسلة المصروف المتكرر مطلوب.");
  const title = required(input.title, "عنوان التذكير مطلوب قبل الحفظ.");
  if (title.length > 80) throw new Error("عنوان التذكير أطول من ٨٠ حرفًا؛ اختصره بدل البتر الصامت.");
  timestamp(input.createdAt, "وقت إنشاء السلسلة");
  return {
    id,
    title,
    status: "draft",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    currentRevision: 0,
    cancelledAt: null,
    cancelReason: null,
    archivedAt: null,
  };
}

const SERIES_TRANSITIONS: Readonly<
  Record<RecurringExpenseSeriesStatus, readonly RecurringExpenseSeriesStatus[]>
> = {
  draft: ["active"],
  active: ["paused", "cancelled", "archived"],
  paused: ["active", "cancelled", "archived"],
  cancelled: ["active", "archived"],
  archived: ["active", "paused"],
};

const seriesTransition = (
  series: RecurringExpenseSeries,
  to: RecurringExpenseSeriesStatus,
  at: string,
): RecurringExpenseSeries => {
  if (!recurringExpenseSeriesStatuses.includes(to)) throw new Error("حالة سلسلة غير مدعومة.");
  if (!SERIES_TRANSITIONS[series.status]!.includes(to))
    throw new Error(`انتقال سلسلة غير قانوني: ${series.status} → ${to}.`);
  timestamp(at, "وقت تغيير حالة السلسلة");
  return { ...series, status: to, updatedAt: at };
};

export function activateRecurringExpenseSeries(
  series: RecurringExpenseSeries,
  at: string,
): RecurringExpenseSeries {
  if (series.currentRevision < 1)
    throw new Error("لا يمكن تفعيل سلسلة بلا قاعدة (مراجعة ١) — أكمل تعريف التذكير أولًا.");
  return seriesTransition(series, "active", at);
}
export function pauseRecurringExpenseSeries(
  series: RecurringExpenseSeries,
  at: string,
): RecurringExpenseSeries {
  return seriesTransition(series, "paused", at);
}
export function resumeRecurringExpenseSeries(
  series: RecurringExpenseSeries,
  at: string,
): RecurringExpenseSeries {
  return seriesTransition(series, "active", at);
}
export function cancelRecurringExpenseSeries(
  series: RecurringExpenseSeries,
  reason: string,
  at: string,
): RecurringExpenseSeries {
  const trimmed = required(reason, "إلغاء التذكير المتكرر يتطلب سببًا موثقًا.");
  const next = seriesTransition(series, "cancelled", at);
  return { ...next, cancelledAt: at, cancelReason: trimmed };
}
export function archiveRecurringExpenseSeries(
  series: RecurringExpenseSeries,
  at: string,
): RecurringExpenseSeries {
  const next = seriesTransition(series, "archived", at);
  return { ...next, archivedAt: at };
}
export function restoreRecurringExpenseSeries(
  series: RecurringExpenseSeries,
  to: "active" | "paused",
  at: string,
): RecurringExpenseSeries {
  const next = seriesTransition(series, to, at);
  return { ...next, archivedAt: null };
}

/* ─── المراجعة (قاعدة مجمدة) ─── */

export type RecurringExpenseRuleDraft = Omit<
  CreateRecurringExpenseRuleRevisionInput,
  "id" | "seriesId" | "revision" | "createdAt"
>;

export function recurringExpenseRevisionId(seriesId: string, revision: number): string {
  return `${seriesId}:r${revision}`;
}

function validateAmountMode(draft: RecurringExpenseRuleDraft) {
  const amountMode = draft.amountMode;
  if (!recurringExpenseAmountModes.includes(amountMode)) throw new Error("نمط المبلغ غير مدعوم.");
  const suggestedAmountMinor = positiveMinorOrNull(draft.suggestedAmountMinor, "المبلغ المقترح");
  if (amountMode === "manual" && suggestedAmountMinor !== null)
    throw new Error("التذكير اليدوي لا يحمل مبلغًا مقترحًا — المبلغ يُدخل عند المراجعة.");
  if (amountMode === "fixed_suggested" && suggestedAmountMinor === null)
    throw new Error("المقترح المتكرر يتطلب مبلغًا مقترحًا عند التعريف.");
  const suggestedWalletId = draft.suggestedWalletId?.trim() || null;
  if (amountMode === "manual" && suggestedWalletId !== null)
    throw new Error("التذكير اليدوي لا يحمل محفظة مقترحة.");
  return { amountMode, suggestedAmountMinor, suggestedWalletId };
}

function validateRuleDraft(draft: RecurringExpenseRuleDraft) {
  const frequency = draft.frequency;
  if (!recurringExpenseFrequencies.includes(frequency))
    throw new Error("نوع التكرار غير مدعوم (الشهري وحده منفذ).");
  const interval = positiveIntegerInRange(draft.interval, 1, 12, "فاصل التكرار (بالأشهر)");
  const anchorDate = localDate(draft.anchorDate, "تاريخ تقويم التذكير");
  const dueDay = positiveIntegerInRange(draft.dueDay, 1, 31, "يوم الاستحقاق");
  const monthEndPolicy = draft.monthEndPolicy;
  if (!recurringExpenseMonthEndPolicies.includes(monthEndPolicy))
    throw new Error("سياسة نهاية الشهر غير مدعومة.");
  if (draft.timezone !== "Asia/Amman")
    throw new Error("المنطقة الزمنية المدعومة في هذه الموجة هي Asia/Amman وحدها.");
  const { amountMode, suggestedAmountMinor, suggestedWalletId } = validateAmountMode(draft);
  const categoryLabel = optionalLabel(draft.categoryLabel, "تصنيف المصروف");
  const changeReason = optionalReason(draft.changeReason);
  return {
    frequency,
    interval,
    anchorDate,
    dueDay,
    monthEndPolicy,
    timezone: draft.timezone,
    amountMode,
    suggestedAmountMinor,
    suggestedWalletId,
    categoryLabel,
    changeReason,
  };
}

export function createRecurringExpenseRuleRevision(
  input: CreateRecurringExpenseRuleRevisionInput,
): RecurringExpenseRuleRevision {
  const seriesId = required(input.seriesId, "معرّف السلسلة مطلوب لقاعدة التذكير.");
  const revision = positiveIntegerInRange(input.revision, 1, 999, "رقم المراجعة");
  const effectiveFromPeriod = periodKey(input.effectiveFromPeriod, "فترة بدء نفاذ المراجعة");
  const createdAt = timestamp(input.createdAt, "وقت إنشاء المراجعة");
  const validated = validateRuleDraft(input);
  return {
    id: recurringExpenseRevisionId(seriesId, revision),
    seriesId,
    revision,
    effectiveFromPeriod,
    ...validated,
    createdAt,
  };
}

/** إنشاء مسودة كاملة: سلسلة (draft) + مراجعتها الأولى (١) في خطوة واحدة صادقة. */
export function createRecurringExpenseDraftSeries(input: {
  id: string;
  title: string;
  createdAt: string;
  rule: RecurringExpenseRuleDraft;
}): { series: RecurringExpenseSeries; revision: RecurringExpenseRuleRevision } {
  const series = createRecurringExpenseSeries({
    id: input.id,
    title: input.title,
    createdAt: input.createdAt,
  });
  const revision = createRecurringExpenseRuleRevision({
    seriesId: series.id,
    revision: 1,
    createdAt: input.createdAt,
    ...input.rule,
  });
  return { series: { ...series, currentRevision: 1 }, revision };
}

/** النفاذ المشتق: المراجعة تنطبق على كل فترة ≥ فترة بدئها (مقارنة معجمية على YYYY-MM). */
export function isRevisionEffective(revision: RecurringExpenseRuleRevision, periodKey: string): boolean {
  return revision.effectiveFromPeriod <= periodKey;
}

/** حارس التعاقب: المراجعة الخلف برقم أعلى وبتواريخ نفاذ مرتبة. */
export function validateRecurringExpenseSuccession(
  current: RecurringExpenseRuleRevision,
  successor: RecurringExpenseRuleRevision,
  strictFuture: boolean,
): void {
  if (successor.seriesId !== current.seriesId) throw new Error("مراجعة الخلف تخص سلسلة مختلفة.");
  if (successor.revision !== current.revision + 1)
    throw new Error("مراجعة الخلف يجب أن تحمل رقم المراجعة الحالية زائد واحد.");
  if (strictFuture && !(successor.effectiveFromPeriod > current.effectiveFromPeriod))
    throw new Error("إعادة تفعيل سلسلة ملغاة تتطلب مراجعة تبدأ من فترة لاحقة صراحةً للمراجعة الحالية.");
  if (successor.effectiveFromPeriod < current.effectiveFromPeriod)
    throw new Error("فترة نفاذ المراجعة الخلف لا تسبق المراجعة الحالية.");
}

/** تعديل مستقبلي (أو إعادة تفعيل سلسلة ملغاة): مراجعة خلف جديدة + تحديث السلسلة ذريًا عند المستوى الأعلى. */
export function succeedRecurringExpenseRuleRevision(
  series: RecurringExpenseSeries,
  current: RecurringExpenseRuleRevision,
  draft: RecurringExpenseRuleDraft,
  at: string,
): { series: RecurringExpenseSeries; successor: RecurringExpenseRuleRevision } {
  if (series.id !== current.seriesId) throw new Error("المراجعة الحالية تخص سلسلة مختلفة.");
  if (series.status === "archived") throw new Error("السلسلة المؤرشفة لا تُعدل — استعدها أولًا.");
  const reactivation = series.status === "cancelled";
  const successor = createRecurringExpenseRuleRevision({
    seriesId: series.id,
    revision: current.revision + 1,
    createdAt: at,
    ...draft,
  });
  validateRecurringExpenseSuccession(current, successor, reactivation);
  const nextSeries = reactivation
    ? { ...series, status: "active" as const, cancelledAt: null, cancelReason: null, updatedAt: at }
    : { ...series, updatedAt: at };
  return { series: { ...nextSeries, currentRevision: successor.revision }, successor };
}

/* ─── الاستحقاق والتقويم ─── */

export function dueDateForPeriod(
  revision: RecurringExpenseRuleRevision,
  periodKeyToCheck: string,
): RecurringExpenseDueDateResolution {
  const pk = periodKey(periodKeyToCheck, "مفتاح الفترة");
  const days = daysInRecurringPeriod(pk);
  if (revision.dueDay <= days)
    return { kind: "due", dueOn: `${pk}-${String(revision.dueDay).padStart(2, "0")}` };
  switch (revision.monthEndPolicy) {
    case "last_valid_day":
      return { kind: "due", dueOn: `${pk}-${String(days).padStart(2, "0")}` };
    case "skip":
      return { kind: "skip" };
    case "ask":
      return { kind: "ask", lastValidDay: days };
  }
}

/** هل الفترة على جدول التقويم (فرق الأشهر عن فترة التقويم من مضاعفات الفاصل وغير سالب)؟ */
export function isPeriodOnSchedule(
  revision: RecurringExpenseRuleRevision,
  periodKeyToCheck: string,
): boolean {
  const anchorPeriod = revision.anchorDate.slice(0, 7);
  if (!isValidRecurringPeriodKey(anchorPeriod)) return false;
  const delta = recurringPeriodMonthsBetween(anchorPeriod, periodKeyToCheck);
  return delta >= 0 && delta % revision.interval === 0;
}

/** أول فترة مجدولة: فترة التقويم إن كان استحقاقها في يوم التقويم نفسه أو بعده؛ وإلا الفترة المجدولة التالية. */
export function firstScheduledPeriod(revision: RecurringExpenseRuleRevision): string {
  const anchorPeriod = revision.anchorDate.slice(0, 7);
  const resolution = dueDateForPeriod(revision, anchorPeriod);
  if (resolution.kind === "due" && resolution.dueOn >= revision.anchorDate) return anchorPeriod;
  return recurringPeriodAfter(anchorPeriod, revision.interval);
}

export function nextScheduledPeriod(revision: RecurringExpenseRuleRevision, fromPeriod: string): string {
  return recurringPeriodAfter(fromPeriod, revision.interval);
}

/* ─── الفترة (occurrence) ─── */

export function recurringExpenseOccurrenceId(seriesId: string, periodKeyToUse: string, slot: number): string {
  return `${seriesId}:${periodKeyToUse}:${slot}`;
}
export function recurringExpenseRecordingIdempotencyKey(
  seriesId: string,
  periodKeyToUse: string,
  slot: number,
): string {
  return `${seriesId}:${periodKeyToUse}:${slot}`;
}

export function createRecurringExpenseOccurrence(
  input: CreateRecurringExpenseOccurrenceInput,
): RecurringExpenseOccurrence {
  const seriesId = required(input.seriesId, "معرّف السلسلة مطلوب للفترة.");
  const pk = periodKey(input.periodKey, "مفتاح فترة التذكير");
  const dueOn = localDate(input.dueOn, "تاريخ استحقاق التذكير");
  if (dueOn.slice(0, 7) !== pk)
    throw new Error("تاريخ الاستحقاق يقع خارج الفترة المفتاحية نفسها — لا يُخمَّن مفتاح مختلف.");
  const slot = input.occurrenceSlot ?? 0;
  positiveIntegerInRange(slot, 0, 99, "خانة الفترة");
  positiveIntegerInRange(input.revision, 1, 999, "رقم مراجعة الفترة");
  timestamp(input.createdAt, "وقت إنشاء الفترة");
  const id = recurringExpenseOccurrenceId(seriesId, pk, slot);
  const key = recurringExpenseRecordingIdempotencyKey(seriesId, pk, slot);
  return {
    id,
    seriesId,
    revision: input.revision,
    periodKey: pk,
    dueOn,
    occurrenceSlot: slot,
    status: "planned",
    snoozedUntil: null,
    skippedAt: null,
    skipReason: null,
    reviewedAmountMinor: null,
    reviewedWalletId: null,
    reviewedOccurredOn: null,
    recordedFinancialEventId: null,
    recordingIdempotencyKey: key,
    actionHistory: [{ kind: "created", at: input.createdAt }],
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

const OCCURRENCE_TRANSITIONS: Readonly<
  Record<RecurringExpenseOccurrenceStatus, readonly RecurringExpenseOccurrenceStatus[]>
> = {
  planned: ["snoozed", "skipped", "cancelled", "recording"],
  snoozed: ["snoozed", "skipped", "cancelled", "recording"],
  skipped: [],
  cancelled: [],
  recording: ["recorded", "record_failed"],
  recorded: [],
  record_failed: ["recording", "skipped", "cancelled"],
};

const occurrenceTransition = (
  occurrence: RecurringExpenseOccurrence,
  to: RecurringExpenseOccurrenceStatus,
): RecurringExpenseOccurrence => {
  if (!recurringExpenseOccurrenceStatuses.includes(to)) throw new Error("حالة فترة غير مدعومة.");
  if (!OCCURRENCE_TRANSITIONS[occurrence.status]!.includes(to))
    throw new Error(`انتقال فترة غير قانوني: ${occurrence.status} → ${to}.`);
  return { ...occurrence, status: to };
};
const appendAction = (
  occurrence: RecurringExpenseOccurrence,
  action: RecurringExpenseOccurrenceAction,
  at: string,
): RecurringExpenseOccurrence => ({
  ...occurrence,
  actionHistory: [...occurrence.actionHistory, action],
  updatedAt: at,
});

/** تأجيل الانتباه فقط — لا يغير dueOn ولا المفتاح؛ الهدف تاريخ لاحق صراحةً لليوم الحالي. */
export function snoozeRecurringExpenseOccurrence(
  occurrence: RecurringExpenseOccurrence,
  snoozedUntil: string,
  today: string,
  at: string,
): RecurringExpenseOccurrence {
  const target = localDate(snoozedUntil, "تاريخ نهاية التأجيل");
  const now = localDate(today, "اليوم الحالي");
  if (target <= now) throw new Error("التأجيل يتطلب تاريخًا لاحقًا لليوم الحالي.");
  const next = occurrenceTransition(occurrence, "snoozed");
  return appendAction({ ...next, snoozedUntil: target }, { kind: "snoozed", at, reason: target }, at);
}

/** تخطي هذه الفترة — قرار محفوظ؛ لا يكتب صفرًا ولا حدثًا ولا أي أثر مالي. */
export function skipRecurringExpenseOccurrence(
  occurrence: RecurringExpenseOccurrence,
  reason: string | null,
  at: string,
): RecurringExpenseOccurrence {
  const next = occurrenceTransition(occurrence, "skipped");
  const trimmed = optionalReason(reason);
  return appendAction(
    { ...next, skippedAt: at, skipReason: trimmed },
    { kind: "skipped", at, reason: trimmed },
    at,
  );
}

/** إلغاء فترة (يستخدمه إلغاء السلسلة للفترات المستقبلية غير المقررة). */
export function cancelRecurringExpenseOccurrence(
  occurrence: RecurringExpenseOccurrence,
  at: string,
): RecurringExpenseOccurrence {
  const next = occurrenceTransition(occurrence, "cancelled");
  return appendAction(next, { kind: "cancelled", at }, at);
}

/** علامة المحاولة قبل الالتزام الذري — أساس اشتقاق «نتيجة غير معروفة» عند القراءة. */
export function markRecurringExpenseConfirmAttempted(
  occurrence: RecurringExpenseOccurrence,
  at: string,
): RecurringExpenseOccurrence {
  const next = occurrenceTransition(occurrence, "recording");
  return appendAction(next, { kind: "confirm_attempted", at, key: occurrence.recordingIdempotencyKey }, at);
}

/** نتيجة محاولة فاشلة معروفة (الحدث لم يُكتب) — تبقى قابلة لإعادة المحاولة بنفس المفتاح. */
export function markRecurringExpenseRecordFailed(
  occurrence: RecurringExpenseOccurrence,
  message: string,
  at: string,
): RecurringExpenseOccurrence {
  const trimmed = required(message, "رسالة فشل التسجيل مطلوبة.");
  const next = occurrenceTransition(occurrence, "record_failed");
  return appendAction(
    next,
    { kind: "record_failed", at, message: trimmed, key: occurrence.recordingIdempotencyKey },
    at,
  );
}

export function markRecurringExpenseRecorded(
  occurrence: RecurringExpenseOccurrence,
  input: MarkOccurrenceRecordedInput,
): RecurringExpenseOccurrence {
  const eventId = required(input.eventId, "معرّف الحدث المالي المسجل مطلوب.");
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
    throw new Error("المبلغ المقَرَّر يجب أن يكون موجبًا ضمن الدقة الآمنة.");
  const occurredOn = localDate(input.occurredOn, "تاريخ حدوث المصروف");
  timestamp(input.at, "وقت إتمام التسجيل");
  const next = occurrenceTransition(occurrence, "recorded");
  const walletId = input.walletId?.trim() || null;
  return appendAction(
    {
      ...next,
      snoozedUntil: null,
      reviewedAmountMinor: input.amountMinor,
      reviewedWalletId: walletId,
      reviewedOccurredOn: occurredOn,
      recordedFinancialEventId: eventId,
    },
    {
      kind: input.reused ? "record_reused" : "recorded",
      at: input.at,
      key: occurrence.recordingIdempotencyKey,
    },
    input.at,
  );
}

/** إعادة اشتقاق فترة planned بلا أي قرار مستخدم (created/revised فقط) عند نفاذ مراجعة جديدة. */
export function replanRecurringExpenseOccurrence(
  occurrence: RecurringExpenseOccurrence,
  revision: number,
  dueOn: string,
  at: string,
): RecurringExpenseOccurrence {
  if (occurrence.status !== "planned")
    throw new Error("لا تُعاد صياغة فترة عليها قرار — التاريخ محمي؛ القرار باقٍ كما هو.");
  if (occurrence.actionHistory.some(action => action.kind !== "created" && action.kind !== "revised"))
    throw new Error("الفترة تحمل قرارات محفوظة — لا تُمس بمراجعة جديدة.");
  const target = localDate(dueOn, "تاريخ الاستحقاق المعاد اشتقاقه");
  if (target.slice(0, 7) !== occurrence.periodKey)
    throw new Error("الاستحقاق المعاد يقع خارج الفترة المفتاحية نفسها.");
  positiveIntegerInRange(revision, 1, 999, "رقم المراجعة الجديدة");
  return appendAction(
    { ...occurrence, revision, dueOn: target },
    { kind: "revised", at, reason: `المراجعة النافذة رقم ${revision}` },
    at,
  );
}

/* ─── نموذج القراءة المشتق ─── */

function occurrenceAttentionOf(
  occurrence: RecurringExpenseOccurrence,
  today: string,
): RecurringExpenseAttentionState | null {
  if (occurrence.status !== "planned" && occurrence.status !== "snoozed") return null;
  const attentionDate = occurrence.snoozedUntil ?? occurrence.dueOn;
  return attentionDate > today ? "upcoming" : attentionDate === today ? "due_today" : "overdue";
}

function occurrenceDisplayStateOf(
  occurrence: RecurringExpenseOccurrence,
  inFlight: boolean,
  reversed: boolean,
): RecurringExpenseOccurrenceReading["displayState"] {
  if (occurrence.status === "recording" && !inFlight) return "result_unknown";
  if (reversed) return "reversed";
  return occurrence.status;
}

export function readRecurringExpenseOccurrence(
  occurrence: RecurringExpenseOccurrence,
  options: ReadOccurrenceOptions,
): RecurringExpenseOccurrenceReading {
  const today = localDate(options.today, "اليوم الحالي");
  const attention = occurrenceAttentionOf(occurrence, today);
  const inFlight = options.inFlightKeys?.has(occurrence.recordingIdempotencyKey) ?? false;
  const resultUnknown = occurrence.status === "recording" && !inFlight;
  const reversed =
    occurrence.status === "recorded" &&
    occurrence.recordedFinancialEventId !== null &&
    (options.reversedEventIds?.has(occurrence.recordedFinancialEventId) ?? false);
  return {
    occurrence,
    attention,
    resultUnknown,
    reversed,
    displayState: occurrenceDisplayStateOf(occurrence, inFlight, reversed),
  };
}

/* ─── حارس اصطدام مفتاح التأكيد عبر الأنواع (عقد ٤١ §٨) ─── */

export type RecurringExpenseRecordedIntent = {
  type: FinancialEventType;
  amountMinor: MoneyMinor;
  idempotencyKey: string;
};

/** الحدث المعاد (جديدًا أو reused) يطابق النية نوعًا ومبلغًا ومفتاحًا قبل وسم الفترة «مقَرَّرة». */
export function verifyRecordedEventMatchesIntent(
  event: RecurringExpenseRecordedIntent,
  intent: RecurringExpenseRecordedIntent,
): boolean {
  return (
    event.type === intent.type &&
    event.amountMinor === intent.amountMinor &&
    event.idempotencyKey === intent.idempotencyKey
  );
}
