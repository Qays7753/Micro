/**
 * OPS-003 (عقد ٤١): المصروف المتكرر المحلي — أنواع الدومين النقية.
 *
 * أربعة مفاهيم منفصلة لا تُدمج:
 *   RecurringExpenseSeries        — الهوية المستقرة للتذكير (حالة تشغيلية فقط).
 *   RecurringExpenseRuleRevision  — قاعدة مجمدة تبدأ من فترة؛ التعديل المستقبلي
 *                                  ينشئ مراجعة خلفًا ولا يمس التاريخ.
 *   RecurringExpenseOccurrence    — فترة واحدة وقراراتها المحفوظة (تأجيل/تخطٍ/
 *                                  إلغاء/تسجيل/فشل/محاولة قائمة) — لا يُعاد بناؤها
 *                                  من وجود حدث مالي.
 *   FinancialEvent                — يُنشأ فقط بعد مراجعة وتأكيد صريحين عبر
 *                                  الكاتب الكنوني (دومين financial-event؛ لا يُلمس هنا).
 *
 * حالتا قراءة مشتقتان فقط (لا تُخزنان): result_unknown (محاولة لم تُلاحظ نتيجتها)
 * وreversed (الحدث المقَرَّر عُكِس) — الاشتقاق عند القراءة يمنع نقطة حقيقة ثانية.
 * حالات الانتباه (قادم/مستحق اليوم/متأخر) مشتقة من dueOn مقابل اليوم — «متأخر»
 * انتباه فقط، ليس دينًا ولا حدثًا (عقد ٤١ §٦).
 */
import type { MoneyMinor } from "../shared/index.js";

export const recurringExpenseSeriesStatuses = ["draft", "active", "paused", "cancelled", "archived"] as const;
export type RecurringExpenseSeriesStatus = (typeof recurringExpenseSeriesStatuses)[number];

/** التكرار المدعوم في هذه الموجة: الشهري وحده؛ البنية لا تمنع إضافة لاحقة. */
export const recurringExpenseFrequencies = ["monthly"] as const;
export type RecurringExpenseFrequency = (typeof recurringExpenseFrequencies)[number];

export const recurringExpenseMonthEndPolicies = ["last_valid_day", "skip", "ask"] as const;
export type RecurringExpenseMonthEndPolicy = (typeof recurringExpenseMonthEndPolicies)[number];

export const recurringExpenseAmountModes = ["manual", "suggested", "fixed_suggested"] as const;
export type RecurringExpenseAmountMode = (typeof recurringExpenseAmountModes)[number];

/** الحالة المحفوظة للفترة — بُعد القرار؛ الانتباه والمجهول والمعكوس مشتقة عند القراءة. */
export const recurringExpenseOccurrenceStatuses = [
  "planned",
  "snoozed",
  "skipped",
  "cancelled",
  "recording",
  "recorded",
  "record_failed",
] as const;
export type RecurringExpenseOccurrenceStatus = (typeof recurringExpenseOccurrenceStatuses)[number];

export type RecurringExpenseOccurrenceActionKind =
  | "created"
  | "revised"
  | "snoozed"
  | "skipped"
  | "cancelled"
  | "confirm_attempted"
  | "recorded"
  | "record_reused"
  | "record_failed";

/** سجل أفعال الفترة — إلحاق فقط؛ يحفظ الأسباب والرسائل الصادقة لا أسرارًا. */
export type RecurringExpenseOccurrenceAction = {
  kind: RecurringExpenseOccurrenceActionKind;
  at: string;
  reason?: string | null;
  /** رسالة الفشل الصادقة (بلا أسرار) لأفعال record_failed. */
  message?: string | null;
  /** مفتاح الحتمية لأفعال التأكيد (confirm_attempted/recorded/record_reused/record_failed). */
  key?: string | null;
};

export type RecurringExpenseSeries = {
  id: string;
  /** عنوان التذكير — هوية عرض صادقة؛ لا يصبح معنى ماليًا بذاته (عقد ٤١ §٧). */
  title: string;
  status: RecurringExpenseSeriesStatus;
  createdAt: string;
  updatedAt: string;
  /** رقم آخر مراجعة قاعدة منشأة (١..)؛ النفاذ لكل فترة يُشتق من سلسلة المراجعات. */
  currentRevision: number;
  cancelledAt: string | null;
  cancelReason: string | null;
  archivedAt: string | null;
};

export type RecurringExpenseRuleRevision = {
  /** مفتاح حتمي مركّب: `${seriesId}:r${revision}`. */
  id: string;
  seriesId: string;
  revision: number;
  /** أول فترة YYYY-MM تنطبق عليها المراجعة؛ النفاذ مشتق (أعلى مراجعة ≤ الفترة). */
  effectiveFromPeriod: string;
  frequency: RecurringExpenseFrequency;
  /** كل كم شهر: ١..١٢. */
  interval: number;
  /** تاريخ التقويم الأول YYYY-MM-DD (توقيت عمّان). */
  anchorDate: string;
  dueDay: number;
  monthEndPolicy: RecurringExpenseMonthEndPolicy;
  /** "Asia/Amman" حصرًا في هذه الموجة. */
  timezone: string;
  amountMode: RecurringExpenseAmountMode;
  /** إلزامي لـ fixed_suggested، اختياري لـ suggested، محظور لـ manual. */
  suggestedAmountMinor: MoneyMinor | null;
  suggestedWalletId: string | null;
  categoryLabel: string | null;
  changeReason: string | null;
  createdAt: string;
};

export type RecurringExpenseOccurrence = {
  /** مفتاح حتمي مركّب: `${seriesId}:${periodKey}:${occurrenceSlot}`. */
  id: string;
  seriesId: string;
  /** المراجعة التي اشتُقت منها الفترة عند إنشائها — تحمي التاريخ من التعديل المستقبلي. */
  revision: number;
  /** YYYY-MM من تاريخ الأعمال بتوقيت عمّان (businessTime وحده). */
  periodKey: string;
  dueOn: string;
  /** 0 في هذه الموجة (حدث واحد لكل فترة)؛ البنية تسمح بخانات مشروعة لاحقة. */
  occurrenceSlot: number;
  status: RecurringExpenseOccurrenceStatus;
  snoozedUntil: string | null;
  skippedAt: string | null;
  skipReason: string | null;
  reviewedAmountMinor: MoneyMinor | null;
  reviewedWalletId: string | null;
  reviewedOccurredOn: string | null;
  recordedFinancialEventId: string | null;
  recordingIdempotencyKey: string;
  actionHistory: readonly RecurringExpenseOccurrenceAction[];
  createdAt: string;
  updatedAt: string;
};

/* ─── المدخلات ─── */

export type CreateRecurringExpenseSeriesInput = {
  id: string;
  title: string;
  createdAt: string;
};

export type CreateRecurringExpenseRuleRevisionInput = Omit<RecurringExpenseRuleRevision, "id">;

export type CreateRecurringExpenseOccurrenceInput = {
  seriesId: string;
  revision: number;
  periodKey: string;
  dueOn: string;
  occurrenceSlot?: number;
  createdAt: string;
};

export type MarkOccurrenceRecordedInput = {
  eventId: string;
  amountMinor: MoneyMinor;
  walletId: string | null;
  occurredOn: string;
  reused: boolean;
  at: string;
};

/* ─── نموذج القراءة المشتق ─── */

export type RecurringExpenseAttentionState = "upcoming" | "due_today" | "overdue";

export type RecurringExpenseOccurrenceReading = {
  occurrence: RecurringExpenseOccurrence;
  /** انتباه مشتق للحالات planned|snoozed فقط؛ null لما عداها. */
  attention: RecurringExpenseAttentionState | null;
  /** محاولة تسجيل بدأت ولم تُلاحظ نتيجتها (reading بلا محاولة قائمة). */
  resultUnknown: boolean;
  /** الحدث المقَرَّر عُكِس — الفترة تبقى معولجة (لا تُفتح تلقائيًا). */
  reversed: boolean;
  /** حالة العرض الواحدة الصادقة للواجهة. */
  displayState:
    | "planned"
    | "snoozed"
    | "skipped"
    | "cancelled"
    | "recording"
    | "record_failed"
    | "recorded"
    | "result_unknown"
    | "reversed";
};

export type ReadOccurrenceOptions = {
  /** اليوم بتاريخ الأعمال بتوقيت عمّان (YYYY-MM-DD) — يمرره المستهلك. */
  today: string;
  /** مفاتيح المحاولات القائمة في هذه الجلسة (تمنع قراءة recording قائمة كـ unknown). */
  inFlightKeys?: ReadonlySet<string>;
  /** هويات الأحداث المعكوسة (reversedEventIds من دومين financial-event). */
  reversedEventIds?: ReadonlySet<string>;
};

/** قرار يوم الاستحقاق لفترة — الأشهر القصيرة بالسياسات الثلاث (عقد ٤١ §٥). */
export type RecurringExpenseDueDateResolution =
  { kind: "due"; dueOn: string } | { kind: "skip" } | { kind: "ask"; lastValidDay: number };
