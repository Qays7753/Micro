/**
 * FIN-002 (عقد ٤٢): الميزانيات الاختيارية وأهداف المصروف — أنواع الدومين النقية.
 *
 * أربعة مفاهيم منفصلة لا تُدمج (عقد ٤٢ §٢):
 *   ExpenseBudgetRecord — خطة مبلغ مصروف لفترة ونطاق: «كم أسمح لنفسي أن
 *                          أصرف في هذا الشهر لهذه الفئة». ليست مالًا: إنشاؤها
 *                          وتعديلها وتجاوزها لا يغيّر الكاش ولا النتيجة ولا الدين.
 *   النسخة الخلف        — المراجعة إصدار جديد (معرف جديد + supersededById
 *                          يربط للأمام)؛ القديمة تقلب superseded بمضمونها
 *                          الأصلي — التاريخ لا يُعاد كتابته أبدًا.
 *   الإغلاق الموثق      — إنهاء الخطة بعلة إلزامية؛ لا حذف صامت، والحد يتحرر.
 *   حالة القراءة المشتقة — within/exceeded/under_review تُشتق وقت القراءة من
 *                          spentMinor الذي يمرره القارئ الكنوني — لا تُخزن أبدًا.
 *
 * لا يستورد هذا الدومين دومين الحدث المالي ولا يحسب أي دلتا: الخطة ليست حدثًا
 * ماليًا، والتجاوز تفسير ظاهر لا حظر (عقد ٤٢ §١/§٦).
 */
import type { MoneyMinor } from "../shared/index.js";

/** أنواع فترات الميزانية: الشهر وحده منفذ؛ periodKind حقل صريح فإضافة week/custom لاحقًا لا تكسر التاريخ. */
export const budgetPeriodKinds = ["month"] as const;
export type BudgetPeriodKind = (typeof budgetPeriodKinds)[number];

/** نطاق الميزانية: «مصروف عام» أو فئة واحدة صريحة — مطابقة نصية صريحة لا ضبابية (عقد ٤٢ §٤). */
export type BudgetScope = { kind: "general_expense" } | { kind: "category"; categoryLabel: string };

/** حالة السجل المحفوظة: نافذة، أو مستبدلة بنسخة خلف، أو مغلقة بعلة موثقة. */
export const expenseBudgetStatuses = ["active", "superseded", "closed"] as const;
export type ExpenseBudgetStatus = (typeof expenseBudgetStatuses)[number];

/** درجة معرفة الخطة: معلومة (قرار مالك صريح) أو تقديرية (تُعلن «تقديرية» عند العرض بلا وهم دقة). */
export const expenseBudgetKnowledgeLevels = ["known", "estimated"] as const;
export type ExpenseBudgetKnowledge = (typeof expenseBudgetKnowledgeLevels)[number];

export type ExpenseBudgetRecord = {
  id: string;
  /** نوع الفترة — حقل صريح يسمح بإضافة week/custom لاحقًا دون كسر السجلات القديمة. */
  periodKind: BudgetPeriodKind;
  /** مفتاح الفترة YYYY-MM بتوقيت عمّان — يُشتقه المستهلك من businessTime؛ الدومين يتحقق من الشكل حصرًا. */
  periodKey: string;
  /** حد الخطة: مصروف عام أو فئة واحدة — هوية منع العدّ المزدوج (فترة × نطاق). */
  scope: BudgetScope;
  /** مبلغ الخطة بالوحدات الصغرى — عدد صحيح موجب حصرًا، لا فواصل عشرية أبدًا. */
  amountMinor: MoneyMinor;
  knowledge: ExpenseBudgetKnowledge;
  note: string | null;
  createdAt: string;
  /** مفتاح عملية الإنشاء (أو النسخة الخلف عند المراجعة) — غير فارغ؛ إعادة الإرسال تعيد السجل نفسه. */
  operationKey: string;
  status: ExpenseBudgetStatus;
  /** النسخة الخلف التي حلّت محل هذا السجل (سهم للأمام) — null على النافذة وغير المستبدلة. */
  supersededById: string | null;
  closedAt: string | null;
  /** علة الإغلاق — إلزامية على كل سجل مغلق؛ لا حذف صامت. */
  closeReason: string | null;
  /** هدف اختياري قابل للإخفاء والاستعادة — انقلاب علم خالص بدلالة خطة بلا أي أثر مالي (عقد ٤٢ §٧). */
  goalDismissed: boolean;
};

/* ─── المدخلات ─── */

export type CreateExpenseBudgetInput = {
  id: string;
  periodKind: BudgetPeriodKind;
  /** YYYY-MM — يُرفض شكله غير الصالح صادرًا قبل أي كتابة. */
  periodKey: string;
  scope: BudgetScope;
  amountMinor: MoneyMinor;
  knowledge: ExpenseBudgetKnowledge;
  note?: string | null;
  operationKey: string;
  createdAt: string;
};

/** مراجعة الميزانية: خلف جديد بمضمون جديد — الحد (الفترة × النطاق) محفوظ من السابقة (عقد ٤٢ §٤). */
export type ReviseExpenseBudgetInput = {
  successorId: string;
  amountMinor: MoneyMinor;
  knowledge: ExpenseBudgetKnowledge;
  note?: string | null;
  operationKey: string;
  at: string;
};

/** إغلاق موثق — العلة إلزامية؛ إعادة الإرسال على سجل مغلق تعيد السجل نفسه. */
export type CloseExpenseBudgetInput = {
  reason: string;
  at: string;
};

/* ─── نموذج القراءة المشتق (لا يُخزن أبدًا) ─── */

export type ExpenseBudgetStatusState = "within" | "exceeded" | "under_review";

/** مفاتيح ملاحظات صادقة للعرض — نصوص الواجهة تُشتق منها، لا شيء يُخزن. */
export type ExpenseBudgetReadingNoteKey = "spent_unknown" | "budget_estimated";

export type ExpenseBudgetStatusReading = {
  state: ExpenseBudgetStatusState;
  /** within فقط: الخطة ناقص المنصرف (صحيح غير سالب). */
  remainingMinor: number | null;
  /** exceeded فقط: المنصرف ناقص الخطة (صحيح موجب) — تجاوز ظاهر لا حظر. */
  overrunMinor: number | null;
  notes: readonly ExpenseBudgetReadingNoteKey[];
};

/** زوج المراجعة الذري: الخلف النافذ + السابقة المستبدلة — يُكتبان في معاملة تخزين واحدة (عقد ٤٢ §٥). */
export type ExpenseBudgetRevisionPair = {
  successor: ExpenseBudgetRecord;
  supersededPrevious: ExpenseBudgetRecord;
};

/** مرشح فحص التداخل: الحد (نوع الفترة + مفتاحها + النطاق) الذي يطرح سؤال العدّ المزدوج. */
export type BudgetOverlapCandidate = {
  periodKind: BudgetPeriodKind;
  periodKey: string;
  scope: BudgetScope;
};
