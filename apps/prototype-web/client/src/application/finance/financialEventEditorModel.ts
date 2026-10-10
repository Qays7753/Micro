/**
 * R7 / R6-F17-P03 (WS-216 — 2026-10-10): نموذج عرض محرر الحدث المالي —
 * القرار النقي للمحرر (اشتقاق سياق المصروف المشترك، أساس/معرفة الحصة من
 * نمط الإدخال، بوابة صلاحية المبلغ الأساسي بفروعها، غرض المصروف المشترك،
 * والإكراه الدفاعي للمسودة المحلية TR-11) خلف سطح تطبيقي مالك. كان هذا
 * المنطق داخل pages/FinancialEventEditor.tsx؛ الصفحة تبقي ربط React ونسخ
 * الواجهة (تعريفات الأنواع الموجهة عقد ٢٧) وقنوات الخدمات.
 *
 * عقد هذه الوحدة:
 *  - لا تخزين ولا React: مدخلات قيم صرفة ومخرجات مشتقات/قرارات.
 *  - لا حساب مال: النسبة تُحوَّل bps عبر النواة الكنسية (percentToBpsExact —
 *    تُرجع null عند دقة أدق من منزلتين: رفض صريح لا تقريبًا صامتًا).
 *  - الأكواد لا النصوص: بوابة الصلاحية تعيد كود مشكلة والنسخة العربية
 *    تبقى عند الصفحة (عقد الإدخال الموجه ٢٧ نصوصه واجهة).
 */

import type {
  OperatingExpenseContext,
  SharedProjectShareBasis,
} from "@micro-domain/financial-event/index.js";
import { isValidLocalDate } from "@micro-domain/shared/index.js";
import { percentToBpsExact } from "@/application/input";
import { todayInAmman } from "@/application/time";

/** نمط إدخال حصة المشروع من المصروف المشترك (مواصفة المحرر الموحدة). */
export type SharedMode = "fixed" | "percentage" | "estimate" | "defer";

/** أساس الحصة المعتمد من نمط الإدخال — نفس خريطة الصفحة حرفيًا. */
export const basisFromMode = (mode: SharedMode): SharedProjectShareBasis =>
  mode === "percentage"
    ? "agreed_percentage"
    : mode === "estimate"
      ? "owner_estimate"
      : mode === "defer"
        ? "needs_review"
        : "agreed_fixed_share";

/** معرفة الحصة من أساسها المعتمد — معرفة السجل تتبع مصدره لا العكس. */
export const knowledgeFromBasis = (basis: SharedProjectShareBasis): OperatingExpenseContext["knowledge"] =>
  basis === "agreed_fixed_share" || basis === "agreed_percentage"
    ? "known"
    : basis === "owner_estimate"
      ? "estimated"
      : "needs_review";

/** مدخلات اشتقاق سياق المصروف — قيم النموذج الحية كما هي. */
export type ExpenseContextInput = {
  isOperatingExpense: boolean;
  relationship: OperatingExpenseContext["relationship"];
  behavior: OperatingExpenseContext["behavior"];
  purpose: OperatingExpenseContext["purpose"];
  knowledge: OperatingExpenseContext["knowledge"];
  sharedMode: SharedMode;
  sharedNote: string;
  categoryLabel: string | null;
};

/** سياق المصروف كما يُرسل مع الحدث — نفس اشتقاق الصفحة حرفيًا. */
export function deriveExpenseContext(input: ExpenseContextInput): OperatingExpenseContext | null {
  if (!input.isOperatingExpense) return null;
  const sharedBasis = basisFromMode(input.sharedMode);
  const sharedKnowledge = knowledgeFromBasis(sharedBasis);
  return input.relationship === "shared"
    ? {
        relationship: input.relationship,
        behavior: input.behavior,
        purpose: input.purpose,
        knowledge: sharedKnowledge,
        sharedProjectShare: { basis: sharedBasis, note: input.sharedNote.trim() || null },
        categoryLabel: input.categoryLabel,
      }
    : {
        relationship: input.relationship,
        behavior: input.behavior,
        purpose: input.purpose,
        knowledge: input.knowledge,
        sharedProjectShare: null,
        categoryLabel: input.categoryLabel,
      };
}

/* المجموعة ١١ (11-0 — سياسة القيم الدقيقة): تحويل النسبة إلى bps دقيقًا فقط؛
 * الدقة الأدق من منزلتين تُرفض (null) فيُمنع الحفظ برسالة آمنة وتعود
 * المعاينة للنص الثابت — لا تقريب صامت أبدًا. */
export function deriveSharedPercentageBps(
  isShared: boolean,
  sharedMode: SharedMode,
  sharedPercentage: number,
): number | null {
  return isShared && sharedMode === "percentage" ? percentToBpsExact(sharedPercentage) : null;
}

/** بوابة صلاحية المبلغ الأساسي — أكواد مشاكل؛ النص عند الصفحة. */
export type PrimaryAmountProblem = "percentage_precision" | "percentage_invalid" | "amount_invalid";

export type PrimaryAmountInput = {
  isShared: boolean;
  sharedMode: SharedMode;
  validSharedTotal: boolean;
  sharedTotalAmountMinor: number;
  validSharedPercentage: boolean;
  sharedPercentage: number;
  sharedPercentageBps: number | null;
  validAmount: boolean;
  amountMinor: number;
};

export function derivePrimaryAmountProblem(input: PrimaryAmountInput): PrimaryAmountProblem | null {
  if (input.isShared && input.sharedMode === "percentage") {
    if (
      input.validSharedPercentage &&
      input.sharedPercentage > 0 &&
      input.sharedPercentage <= 100 &&
      input.sharedPercentageBps === null
    ) {
      return "percentage_precision";
    }
    if (!(
      input.validSharedTotal &&
      input.sharedTotalAmountMinor > 0 &&
      input.validSharedPercentage &&
      input.sharedPercentage > 0 &&
      input.sharedPercentage <= 100 &&
      input.sharedPercentageBps !== null
    )) {
      return "percentage_invalid";
    }
    return null;
  }
  return input.validAmount && input.amountMinor > 0 ? null : "amount_invalid";
}

/** غرض المصروف المشترك كما يُرسل مع الحدث — نفس اشتقاق الصفحة حرفيًا. */
export type SharedExpenseIntent =
  | { mode: "percentage"; sharedTotalAmountMinor: number; sharedPercentageBps: number }
  | { mode: "defer"; sharedTotalAmountMinor: number }
  | { mode: "fixed" | "estimate"; amountMinor: number };

export function deriveSharedExpenseIntent(input: {
  isShared: boolean;
  sharedMode: SharedMode;
  sharedPercentageBps: number | null;
  sharedTotalAmountMinor: number;
  amountMinor: number;
}): SharedExpenseIntent | undefined {
  if (!input.isShared) return undefined;
  if (input.sharedMode === "percentage") {
    return input.sharedPercentageBps === null
      ? undefined
      : {
          mode: "percentage" as const,
          sharedTotalAmountMinor: input.sharedTotalAmountMinor,
          sharedPercentageBps: input.sharedPercentageBps,
        };
  }
  if (input.sharedMode === "defer") {
    return { mode: "defer" as const, sharedTotalAmountMinor: input.amountMinor };
  }
  return { mode: input.sharedMode, amountMinor: input.amountMinor };
}

/* المجموعة ١ (مسودة محفوظة — TR-11): مدخلات فقط لا سجلات؛ تُسترجع بفعل صريح
 * ولا تُحوَّل حدثًا ماليًا أبدًا إلا بزر الحفظ. المفتاح لكل نوع على حدة. */
export type EditorDraft = {
  amountMinor: number;
  sharedTotalAmountMinor: number;
  sharedPercentage: number;
  date: string;
  note: string;
  counterparty: string;
  relationship: OperatingExpenseContext["relationship"];
  behavior: OperatingExpenseContext["behavior"];
  purpose: OperatingExpenseContext["purpose"];
  knowledge: OperatingExpenseContext["knowledge"];
  sharedMode: SharedMode;
  sharedNote: string;
  categoryLabel: string;
  relatedEventId: string;
  walletId: string;
};

/* Conflict I (AV-09): إكراه دفاعي لمسودة محلية تالفة — القيم غير الصالحة تُستبدل
 * بقيم آمنة بدل أن تكسر النموذج أو تصل إلى الحفظ؛ التاريخ المشوّه يرجع لليوم،
 * والمعدّات لا تقبل إلا أعدادًا صحيحة موجبة، والقيم المعدودة تُرشّح على قوائمها. */
/* R2 (M-04/D8، 2026-10-08): إكراه المسودة الدفاعي عبر النواة الكنسية —
 * كان النمط أعمى تقويميًا فيقبل 2023-02-29 إلى مسودة النموذج. */
const RELATIONSHIP_VALUES = ["project", "shared"] as const;
const BEHAVIOR_VALUES = ["fixed", "variable", "mixed", "unknown"] as const;
const PURPOSE_VALUES = ["project_general", "period", "order", "product", "campaign", "unallocated"] as const;
const KNOWLEDGE_VALUES = ["known", "estimated", "needs_review"] as const;
const SHARED_MODE_VALUES = ["fixed", "percentage", "estimate", "defer"] as const;

const safeDraftAmount = (value: unknown): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
const safeDraftString = (value: unknown): string => (typeof value === "string" ? value : "");
const safeDraftEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

export function coerceEditorDraft(value: unknown): EditorDraft | null {
  if (typeof value !== "object" || value === null) return null;
  const draft = value as Record<string, unknown>;
  const amountMinor = safeDraftAmount(draft.amountMinor);
  const note = safeDraftString(draft.note);
  const date = typeof draft.date === "string" && isValidLocalDate(draft.date) ? draft.date : todayInAmman();
  /* لا شيء ذو معنى قابل للترجيع؟ لا نعرض عرض استرجاع فارغًا. */
  if (amountMinor === 0 && note.trim() === "" && date === todayInAmman()) return null;
  return {
    amountMinor,
    sharedTotalAmountMinor: safeDraftAmount(draft.sharedTotalAmountMinor),
    sharedPercentage: safeDraftAmount(draft.sharedPercentage),
    date,
    note,
    counterparty: safeDraftString(draft.counterparty),
    relationship: safeDraftEnum(draft.relationship, RELATIONSHIP_VALUES, "project"),
    behavior: safeDraftEnum(draft.behavior, BEHAVIOR_VALUES, "unknown"),
    purpose: safeDraftEnum(draft.purpose, PURPOSE_VALUES, "project_general"),
    knowledge: safeDraftEnum(draft.knowledge, KNOWLEDGE_VALUES, "known"),
    sharedMode: safeDraftEnum(draft.sharedMode, SHARED_MODE_VALUES, "fixed"),
    sharedNote: safeDraftString(draft.sharedNote),
    /* وسم التصنيف محدود بـ٨٠ حرفًا في النطاق — القص هنا إكراه آمن لا تشويه صامت. */
    categoryLabel: safeDraftString(draft.categoryLabel).slice(0, 80),
    relatedEventId: safeDraftString(draft.relatedEventId),
    walletId: safeDraftString(draft.walletId),
  };
}
