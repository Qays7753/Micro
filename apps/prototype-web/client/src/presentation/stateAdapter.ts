/*
 * W1 — المهايئ المركزي للحالات (State Adapter) — عقد Micro Standard v2.
 * (طبقة عرض صرفة: لا تستورد أي وحدة application — حتى نوعيًا — حتى لا
 * تُسحب خدمة تطبيقية إلى عدّاد كثافة النص لأي شاشة تستهلك هذا المهايئ.)
 * ---------------------------------------------------------------------------
 * يربط حالات Micro الموجودة (كلماتها وتسمياتها لا تُمسّ) بعقود العرض في
 * المعيار: كلمة + علامة غير لونية + نغمة دلالية. المهايئ لا يُنتج كلمات
 * أبدًا — الكلمات ملك قواميس Micro القائمة (activityStatusLabel، نصوص
 * الصفحات). ملكية المعنى تبقى في domain/application؛ هذا الملف عرض فقط.
 *
 * قواعد المعيار المطبّقة هنا:
 * - "بالانتظار" ليس نجاحًا أبدًا (pending ≠ success).
 * - "غير معروف" ليس فشلًا ولا نجاحًا (unknown منفصل عن الفشل).
 * - حالات المعرفة (غير مؤكد/غير مكتمل/بحاجة لمراجعة/تقديري) نغمتها محايدة
 *   دائمًا — لا تستعير ألوان النتائج أبدًا (عقد حالات المعرفة).
 * - الفراغات الصادقة ثلاثة مميزة: غير مسجل ≠ غير متاح ≠ صفر مقيس.
 * - العلامة غير اللونية هي حامل المعنى الأساسي؛ اللون تعزيز فقط.
 */

/** أدوار العلامات غير اللونية — تُربط بأيقونات في طبقة المكوّنات فقط. */
export type StateMarkerRole =
  | "check"
  | "clock"
  | "alert"
  | "close"
  | "return"
  | "eye"
  | "question"
  | "tilde"
  | "partial"
  | "dot"
  | "none";

/** نغمة دلالية لونية للعلامة فقط — الكلمة دائمًا بحبر آمن للقراءة. */
export type StateTone = "success" | "error" | "info" | "status" | "neutral";

/** عائلة الحالة — تحدّد قواعد العرض المسموحة. */
export type StateFamily = "outcome" | "knowledge" | "void" | "activity";

export interface StatePresentation {
  /** العلامة غير اللونية (حامل المعنى الأساسي). */
  readonly markerRole: StateMarkerRole;
  /** نغمة العلامة اللونية — تعزيز فقط، لا تحمل المعنى وحدها. */
  readonly tone: StateTone;
  /** عائلة الحالة (نتيجة/معرفة/فراغ/نشاط). */
  readonly family: StateFamily;
  /** هل حالة معرفة؟ (نغمة محايدة إلزامية، لا نجاح ولا فشل). */
  readonly isKnowledge: boolean;
}

/** مفاتيح دلالية عامة — لا كلمات منتجية هنا، الكلمات ملك Micro. */
export type SemanticStateKey =
  // نتائج
  | "success"
  | "error"
  | "unknown"
  | "due"
  | "overdue"
  | "partial"
  | "draft"
  | "reviewed"
  // فراغات صادقة
  | "unrecorded"
  | "unavailable"
  | "measured-zero"
  // فراغات العرض (empty-loading-error-states.md): لا بيانات ≠ لا نتائج — كلاهما ليس فشلًا
  | "no-data"
  | "no-results";

/** مفاتيح حالات المعرفة (جودة المعلومة — ليست نتائج). */
export type KnowledgeStateKey =
  "unconfirmed" | "incomplete" | "needs-review" | "estimated" | "unknown-magnitude";

const OUTCOME_PRESENTATIONS: Record<SemanticStateKey, StatePresentation> = {
  success: { markerRole: "check", tone: "success", family: "outcome", isKnowledge: false },
  error: { markerRole: "alert", tone: "error", family: "outcome", isKnowledge: false },
  unknown: { markerRole: "question", tone: "neutral", family: "outcome", isKnowledge: false },
  due: { markerRole: "clock", tone: "neutral", family: "outcome", isKnowledge: false },
  overdue: { markerRole: "alert", tone: "error", family: "outcome", isKnowledge: false },
  partial: { markerRole: "partial", tone: "info", family: "outcome", isKnowledge: false },
  draft: { markerRole: "dot", tone: "neutral", family: "outcome", isKnowledge: false },
  reviewed: { markerRole: "eye", tone: "status", family: "outcome", isKnowledge: false },
  unrecorded: { markerRole: "dot", tone: "neutral", family: "void", isKnowledge: false },
  unavailable: { markerRole: "none", tone: "neutral", family: "void", isKnowledge: false },
  "measured-zero": { markerRole: "none", tone: "neutral", family: "void", isKnowledge: false },
  "no-data": { markerRole: "none", tone: "neutral", family: "void", isKnowledge: false },
  "no-results": { markerRole: "none", tone: "neutral", family: "void", isKnowledge: false },
};

const KNOWLEDGE_PRESENTATIONS: Record<KnowledgeStateKey, StatePresentation> = {
  unconfirmed: { markerRole: "question", tone: "neutral", family: "knowledge", isKnowledge: true },
  incomplete: { markerRole: "partial", tone: "neutral", family: "knowledge", isKnowledge: true },
  "needs-review": { markerRole: "eye", tone: "neutral", family: "knowledge", isKnowledge: true },
  estimated: { markerRole: "tilde", tone: "neutral", family: "knowledge", isKnowledge: true },
  "unknown-magnitude": { markerRole: "question", tone: "neutral", family: "knowledge", isKnowledge: true },
};

/** حالات النشاط الحية في Micro — نفس مفاتيح ActivityStatus في
 * application/activity/activityService؛ اختبار المطابقة النوعية في ملف
 * الاختبار يمنع انحراف الاتحاد عن المصدر. */
export type MicroActivityStatus = "active" | "pending" | "reversed" | "cancelled";

/** حالات النشاط الحية في Micro (ActivityStatus) — الكلمات في activityStatusLabel. */
const ACTIVITY_PRESENTATIONS: Record<MicroActivityStatus, StatePresentation> = {
  active: { markerRole: "check", tone: "success", family: "activity", isKnowledge: false },
  pending: { markerRole: "clock", tone: "info", family: "activity", isKnowledge: false },
  reversed: { markerRole: "return", tone: "info", family: "activity", isKnowledge: false },
  cancelled: { markerRole: "close", tone: "neutral", family: "activity", isKnowledge: false },
};

/** عرض حالة دلالية عامة. */
export function semanticStatePresentation(key: SemanticStateKey): StatePresentation {
  return OUTCOME_PRESENTATIONS[key];
}

/** عرض حالة معرفة — نغمة محايدة إلزامية (عقد حالات المعرفة). */
export function knowledgeStatePresentation(key: KnowledgeStateKey): StatePresentation {
  return KNOWLEDGE_PRESENTATIONS[key];
}

/** عرض حالة نشاط Micro (بدون إعادة تسمية — الكلمات ملك قاموس Micro). */
export function activityStatePresentation(status: MicroActivityStatus): StatePresentation {
  return ACTIVITY_PRESENTATIONS[status];
}

/**
 * الفراغات الصادقة — عقد العرض لكل فراغ (لا يجوز خلطها):
 * - غير مسجل → شريحة إجراء (action chip) تدعو للتسجيل.
 * - غير متاح → الكلمة وحدها بحبر محايد، لا رقم مخترع ولا زخرفة.
 * - صفر مقيس → "0" في خانته الرقمية مع تسميته — ليست نجاحًا ولا فراغًا.
 */
export type HonestVoidKind = "unrecorded" | "unavailable" | "measured-zero";

export function honestVoidPresentation(kind: HonestVoidKind): StatePresentation {
  if (kind === "unrecorded") return OUTCOME_PRESENTATIONS.unrecorded;
  if (kind === "unavailable") return OUTCOME_PRESENTATIONS.unavailable;
  return OUTCOME_PRESENTATIONS["measured-zero"];
}

/** القيمة المعروضة لفراغ صادق — دائمًا نص قالبٍ ملك الصفحة، ليس رقمًا مخترعًا. */
export function honestVoidDisplayValue(kind: HonestVoidKind): string | null {
  if (kind === "measured-zero") return "0";
  return null; // unrecorded/unavailable: لا رقم — الكلمة/الشريحة ملك الشاشة
}

/**
 * عقد النغمة المسموحة — يستخدمه اختبار الحقيقة (truth check) ويمكن
 * لأي مكوّن التحقق منه قبل العرض.
 */
export function isPermissibleTone(p: StatePresentation): boolean {
  if (p.isKnowledge) return p.tone === "neutral";
  if (p.family === "void") return p.tone === "neutral";
  return true;
}

/** عقد الخط الرقمي: القيم المالية بحبر آمن وخط أحادي المسافات معزول الاتجاه. */
export const NUMERIC_SLOT_CONTRACT = {
  font: "var(--font-numeric)",
  direction: "ltr" as const,
  unicodeBidi: "isolate" as const,
  amountFloorPx: 15,
} as const;
