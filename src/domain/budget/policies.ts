/**
 * FIN-002 (عقد ٤٢): سياسات الميزانيات الاختيارية وأهداف المصروف — نقية بالكامل.
 *
 * القواعد غير القابلة للتفاوض المطبقة هنا:
 * - الخطة ليست حدثًا ماليًا: لا استيراد لأي دومين مالي ولا حساب دلتا في هذه
 *   الوحدة؛ المنصرف يمرره المستدعي (القارئ الكنوني) وقت القراءة وحده.
 * - أرقام صحيحة فقط: المبالغ والفروق بالوحدات الصغرى الصحيحة — لا فواصل عشرية.
 * - المجهول لا يصير صفرًا: المنصرف غير المعروف null → under_review مع ملاحظة
 *   صادقة، لا التزامًا زائفًا ولا انحرافًا مفبركًا.
 * - منع العدّ المزدوج: حدود (نوع الفترة + مفتاحها + النطاق) النافذة لا تتداخل —
 *   «مصروف عام» يغطي أي فئة في الفترة نفسها؛ الرفض صادر قبل أي كتابة.
 * - التاريخ لا يُعاد كتابته: المراجعة نسخة خلف (زوج ذري)، والإغلاق موثق بعلة
 *   إلزامية؛ إعادة إرسال الإغلاق تعيد السجل نفسه ولا تلمس التوثيق.
 */
import { assertId, assertPositiveMinor, isValidTimestamp } from "../shared/index.js";
import {
  budgetPeriodKinds,
  expenseBudgetKnowledgeLevels,
  type BudgetOverlapCandidate,
  type BudgetPeriodKind,
  type BudgetScope,
  type CloseExpenseBudgetInput,
  type CreateExpenseBudgetInput,
  type ExpenseBudgetKnowledge,
  type ExpenseBudgetRecord,
  type ExpenseBudgetReadingNoteKey,
  type ExpenseBudgetRevisionPair,
  type ExpenseBudgetStatusReading,
  type ReviseExpenseBudgetInput,
} from "./types.js";

/* ─── معينات التحقق (نمط الوحدات القائمة) ─── */

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** مفتاح فترة الشهر YYYY-MM صالح الشكل — التقويم نفسه بتوقيت عمّان على المستهلك (عقد ٤١ §٥). */
export function isValidBudgetPeriodKey(periodKey: string): boolean {
  return MONTH_KEY_PATTERN.test(periodKey);
}
const periodKeyOrThrow = (value: string, label: string) => {
  if (!isValidBudgetPeriodKey(value)) throw new Error(`${label} غير صالح (متوقع YYYY-MM).`);
  return value;
};
const periodKindOrThrow = (kind: BudgetPeriodKind) => {
  if (!budgetPeriodKinds.includes(kind))
    throw new Error("نوع فترة الميزانية غير مدعوم — الشهري وحده منفذ في هذا الإصدار.");
  return kind;
};
const knowledgeOrThrow = (value: ExpenseBudgetKnowledge) => {
  if (!expenseBudgetKnowledgeLevels.includes(value)) throw new Error("درجة معرفة الميزانية غير مدعومة.");
  return value;
};
const operationKeyOrThrow = (value: string) => {
  if (!value.trim()) throw new Error("مفتاح عملية الميزانية مطلوب.");
  return value;
};
const timestampOrThrow = (value: string, label: string) => {
  if (!isValidTimestamp(value)) throw new Error(`${label} غير صالح.`);
  return value;
};
const noteOrNull = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) throw new Error("ملاحظة الميزانية تتجاوز 500 حرف؛ اختصرها.");
  return trimmed;
};
/** تطبيع النطاق وتجميده: فئة صريحة (١..٨٠ حرفًا بعد التشذيب) أو مصروف عام — لا نطاق ضبابي. */
const normalizeScope = (scope: BudgetScope): BudgetScope => {
  if (scope.kind === "general_expense") return Object.freeze({ kind: "general_expense" });
  if (scope.kind !== "category") throw new Error("نطاق الميزانية غير مدعوم.");
  const categoryLabel = scope.categoryLabel.trim();
  if (!categoryLabel) throw new Error("فئة الميزانية مطلوبة صراحةً — لا نطاق فئة فارغ.");
  if (categoryLabel.length > 80) throw new Error("فئة الميزانية أطول من ٨٠ حرفًا؛ اختصرها بدل البتر الصامت.");
  return Object.freeze({ kind: "category", categoryLabel });
};

/* ─── منع العدّ المزدوج (عقد ٤٢ §٤) ─── */

/** هل يحتل نطاقان الحد نفسه؟ «مصروف عام» يغطي أي فئة (عدّ مزدوج)، والفئة تقابل فئتها نصًّا صريحًا فقط. */
const scopesOverlap = (left: BudgetScope, right: BudgetScope): boolean => {
  if (left.kind === "general_expense" || right.kind === "general_expense") return true;
  return left.categoryLabel === right.categoryLabel;
};

/**
 * الميزانيات النافذة التي يتداخل حدّها مع المرشح (نوع الفترة + مفتاحها + النطاق).
 * المستبدلة والمغلقة لا تحتل حدًّا — الاستبدال والإغلاق يحرران النطاق للإنشاء بعده.
 */
export function findOverlappingBudgets(
  active: readonly ExpenseBudgetRecord[],
  candidate: BudgetOverlapCandidate,
): readonly ExpenseBudgetRecord[] {
  const periodKind = periodKindOrThrow(candidate.periodKind);
  const periodKey = periodKeyOrThrow(candidate.periodKey, "مفتاح فترة الميزانية");
  const scope = normalizeScope(candidate.scope);
  return Object.freeze(
    active.filter(
      budget =>
        budget.status === "active" &&
        budget.periodKind === periodKind &&
        budget.periodKey === periodKey &&
        scopesOverlap(budget.scope, scope),
    ),
  );
}

/* ─── الإنشاء ─── */

/**
 * إنشاء ميزانية نافذة — خطة لا حدثًا ماليًا: لا كاش ولا نتيجة ولا دين يتحرك.
 * التحقق (الشكل، المبلغ، النطاق، مفتاح العملية) والتداخل يُرفضان صادرين قبل
 * أي كتابة؛ القائمة النافذة يمررها المستدعي (المخزن) — الحدود تمنع العدّ المزدوج.
 */
export function createExpenseBudget(
  input: CreateExpenseBudgetInput,
  activeBudgets: readonly ExpenseBudgetRecord[],
): ExpenseBudgetRecord {
  assertId(input.id, "id");
  const periodKind = periodKindOrThrow(input.periodKind);
  const periodKey = periodKeyOrThrow(input.periodKey, "مفتاح فترة الميزانية");
  const scope = normalizeScope(input.scope);
  assertPositiveMinor(input.amountMinor, "amountMinor");
  const knowledge = knowledgeOrThrow(input.knowledge);
  const note = noteOrNull(input.note);
  const operationKey = operationKeyOrThrow(input.operationKey);
  const createdAt = timestampOrThrow(input.createdAt, "وقت إنشاء الميزانية");
  const overlapping = findOverlappingBudgets(activeBudgets, { periodKind, periodKey, scope });
  if (overlapping.length > 0) {
    const blocker = overlapping[0]?.id ?? "غير معلوم";
    throw new Error(
      `تداخل حدود الميزانيات (${periodKey}): الميزانية النافذة «${blocker}» تحتل الحد نفسه أو تحيطه — الحدود تمنع العدّ المزدوج.`,
    );
  }
  return Object.freeze({
    id: input.id,
    periodKind,
    periodKey,
    scope,
    amountMinor: input.amountMinor,
    knowledge,
    note,
    createdAt,
    operationKey,
    status: "active",
    supersededById: null,
    closedAt: null,
    closeReason: null,
    goalDismissed: false,
  });
}

/* ─── المراجعة: نسخة خلف تحفظ التاريخ (عقد ٤٢ §٢/§٥) ─── */

/**
 * مراجعة الميزانية: زوج ذري — خلف نافذ بمعرف ومفتاح عملية خاصين، وسابقة تقلب
 * superseded بمضمونها الأصلي حرفيًا (التاريخ لا يُعاد كتابته أبدًا). المراجعة
 * تحفظ الحد (الفترة × النطاق): الخلف يحتل حد سابقتها النافذة نفسه فلا تدخل
 * مراجعةٌ تداخلًا جديدًا؛ تغيير الحد إغلاق موثق + إنشاء جديد.
 */
export function reviseExpenseBudget(
  previous: ExpenseBudgetRecord,
  input: ReviseExpenseBudgetInput,
): ExpenseBudgetRevisionPair {
  if (previous.status !== "active")
    throw new Error(
      "لا تُراجَع إلا ميزانية نافذة — المستبدلة تاريخ محفوظ، والمغلقة يُنشأ لها ميزانية جديدة إن لزم.",
    );
  assertId(input.successorId, "id");
  if (input.successorId === previous.id)
    throw new Error("معرّف النسخة الخلف يجب أن يكون جديدًا — لا يحل محل السابقة بالمعرّف نفسه.");
  assertPositiveMinor(input.amountMinor, "amountMinor");
  const knowledge = knowledgeOrThrow(input.knowledge);
  const note = noteOrNull(input.note);
  const operationKey = operationKeyOrThrow(input.operationKey);
  const at = timestampOrThrow(input.at, "وقت مراجعة الميزانية");
  const successor: ExpenseBudgetRecord = Object.freeze({
    id: input.successorId,
    periodKind: previous.periodKind,
    periodKey: previous.periodKey,
    scope: previous.scope,
    amountMinor: input.amountMinor,
    knowledge,
    note,
    createdAt: at,
    operationKey,
    status: "active",
    supersededById: null,
    closedAt: null,
    closeReason: null,
    goalDismissed: previous.goalDismissed,
  });
  const supersededPrevious: ExpenseBudgetRecord = Object.freeze({
    ...previous,
    status: "superseded",
    supersededById: successor.id,
  });
  return Object.freeze({ successor, supersededPrevious });
}

/* ─── الإغلاق الموثق (عقد ٤٢ §٢/§٥) ─── */

/**
 * إغلاق موثق بعلة إلزامية — لا حذف صامت أبدًا؛ الإغلاق يحرر الحد للإنشاء بعده.
 * إعادة إرسال الإغلاق على سجل مغلق تعيد السجل نفسه كما هو: علة الإغلاق الموثقة
 * لا تُعاد كتابتها (إعادة الإرسال = نفس السجل).
 */
export function closeExpenseBudget(
  record: ExpenseBudgetRecord,
  input: CloseExpenseBudgetInput,
): ExpenseBudgetRecord {
  const reason = input.reason.trim();
  if (!reason) throw new Error("إغلاق الميزانية يتطلب علة موثقة.");
  const at = timestampOrThrow(input.at, "وقت إغلاق الميزانية");
  if (record.status === "closed") return record;
  if (record.status !== "active")
    throw new Error("لا يُغلق إلا ميزانية نافذة — المستبدلة مسجَّلة بخلفها ولا تُلمس.");
  return Object.freeze({
    ...record,
    status: "closed",
    closedAt: at,
    closeReason: reason,
  });
}

/* ─── الأهداف الاختيارية (عقد ٤٢ §٧) ─── */

/** إخفاء الهدف الاختياري — انقلاب علم خالص بدلالة خطة: لا أثر مالي ولا ضغط عودة. */
export function dismissGoal(record: ExpenseBudgetRecord): ExpenseBudgetRecord {
  if (record.status !== "active")
    throw new Error("إخفاء الهدف يخص الميزانية النافذة — التاريخ المحفوظ لا يُلمس.");
  return Object.freeze({ ...record, goalDismissed: true });
}

/** استعادة الهدف المخفي — الانقلاب الصريح نفسه في الاتجاه المعاكس، بلا كلفة. */
export function restoreGoal(record: ExpenseBudgetRecord): ExpenseBudgetRecord {
  if (record.status !== "active")
    throw new Error("استعادة الهدف تخص الميزانية النافذة — التاريخ المحفوظ لا يُلمس.");
  return Object.freeze({ ...record, goalDismissed: false });
}

/* ─── نموذج القراءة المشتق (عقد ٤٢ §٦) ─── */

/**
 * حالة القراءة المشتقة — نقية: المنصرف يمرره المستدعي (القارئ الكنوني وقت
 * القراءة) ولا يُشتق هنا أبدًا. null = غير معلوم → under_review (المجهول لا
 * يصير صفرًا ولا التزامًا زائفًا). التجاوز تفسير ظاهر: لا حظر ولا أي أثر.
 */
export function evaluateBudgetStatus(
  budget: ExpenseBudgetRecord,
  spentMinor: number | null,
): ExpenseBudgetStatusReading {
  if (spentMinor !== null && (!Number.isSafeInteger(spentMinor) || spentMinor < 0))
    throw new Error("المنصرف يجب أن يكون رقمًا صحيحًا غير سالب ضمن الدقة الآمنة، أو غير معلوم (null).");
  const notes: ExpenseBudgetReadingNoteKey[] = [];
  if (budget.knowledge === "estimated") notes.push("budget_estimated");
  if (spentMinor === null) {
    notes.push("spent_unknown");
    return Object.freeze({
      state: "under_review",
      remainingMinor: null,
      overrunMinor: null,
      notes: Object.freeze(notes),
    });
  }
  if (spentMinor <= budget.amountMinor)
    return Object.freeze({
      state: "within",
      remainingMinor: budget.amountMinor - spentMinor,
      overrunMinor: null,
      notes: Object.freeze(notes),
    });
  return Object.freeze({
    state: "exceeded",
    remainingMinor: null,
    overrunMinor: spentMinor - budget.amountMinor,
    notes: Object.freeze(notes),
  });
}
