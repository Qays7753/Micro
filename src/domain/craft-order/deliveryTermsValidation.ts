import type { MoneyMinor } from "../shared/index.js";

/* Group 1 (الميثاق الرئيسي للإصلاح 2026-09-28 — F-007): القيم القانونية
 * لحقول شروط التوصيل وتسوية العربون ومعاني الاحتفاظ — يملكها الدومين فلا
 * تنسخ طبقات النقل قوائم تنحرف عنها (سابقة SOURCE_REF_KINDS في EXE-003).
 * مدققو الاستيراد يستهلكونها قبل الكتابة الذرية: ملف معدل يزرع أجرة غير
 * معقولة أو مسؤولية بلا معنى يُرفض قبل أي استبدال. القواعد نفسها التي
 * يفرضها buildDeliveryTerms عند الكتابة — لا قاعدة جديدة تُخترع هنا. */

export const DELIVERY_RESPONSIBILITIES: readonly string[] = [
  "project_pays",
  "customer_pays_project",
  "customer_pays_courier",
  "shared",
] as const;

export const DEPOSIT_SETTLEMENT_DECISIONS: readonly string[] = [
  "refund_deposit",
  "retain_deposit",
  "needs_review",
] as const;

export const RETAINED_DEPOSIT_MEANINGS: readonly string[] = ["owner", "revenue", "mixed"] as const;

/* الأنواع التي تحرك مالًا — حدثها بلا مبلغ موجب صحيح سجل مالي أعمى:
 * قبض العربون/المتبقي/الدين، وعكس التحصيل/العربون النشط، ورد/احتفاظ عربون
 * الملغى. (debt_registered يحمل متبقي الدين؛ delivery_terms_recorded يحمل
 * الأجرة أو الكلفة إن وُجدت — كلاهما اختياري الوجود لا المبلغ.) */
export const MONEY_MOVING_EVENT_TYPES: readonly string[] = [
  "deposit_collected",
  "collection_recorded",
  "collection_reversed",
  "deposit_reversed",
  "deposit_refunded",
  "deposit_retained",
] as const;

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNullOrPositiveMinor(value: unknown): value is MoneyMinor | null {
  return value === null || isPositiveInteger(value);
}

/** هل حقول شروط التوصيل سليمة الشكل (أنواع ومبالغ غير سالبة)؟ */
function isValidDeliveryTermsShape(terms: Record<string, unknown>): boolean {
  if (typeof terms.responsibility !== "string" || !DELIVERY_RESPONSIBILITIES.includes(terms.responsibility))
    return false;
  if (typeof terms.feeIncludedInPrice !== "boolean") return false;
  if (typeof terms.costIncludedInProductCost !== "boolean") return false;
  return (
    isNullOrPositiveMinor(terms.feeChargedMinor) &&
    isNullOrPositiveMinor(terms.costPaidMinor) &&
    isNullOrPositiveMinor(terms.projectShareMinor) &&
    isNullOrPositiveMinor(terms.customerShareMinor)
  );
}

/** هل العلاقات المتقاطعة بين المسؤولية والمبالغ سليمة — عقد buildDeliveryTerms؟
 * ١) الأجرة عبر المشروع تُسجَّل فقط عند customer_pays_project/shared.
 * ٢) الدفع المباشر للناقل معلومة سياقية: لا كلفة ولا حصص على المشروع.
 * ٣) الحصص المشتركة تُسجَّل فقط عند shared. */
function hasValidDeliveryTermsRelations(terms: Record<string, unknown>): boolean {
  const responsibility = terms.responsibility as string;
  const feeAppliesToProject = responsibility === "customer_pays_project" || responsibility === "shared";
  if (!feeAppliesToProject && terms.feeChargedMinor !== null) return false;
  if (
    responsibility === "customer_pays_courier" &&
    (terms.costPaidMinor !== null || terms.projectShareMinor !== null)
  )
    return false;
  if (responsibility !== "shared" && (terms.projectShareMinor !== null || terms.customerShareMinor !== null))
    return false;
  return true;
}

/** هل القيمة شروط توصيل صحيحة الشكل والمعنى — نفس قبول buildDeliveryTerms؟
 * قراءة فقط، بلا كتابة، تُستهلك من مدققي الاستيراد قبل أي استبدال. */
export function isValidOrderDeliveryTerms(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  const terms = value as Record<string, unknown>;
  return isValidDeliveryTermsShape(terms) && hasValidDeliveryTermsRelations(terms);
}

/** هل حدث الطلب سليم الحقل المالي — الأنواع المحركة للمال تتطلب مبلغًا موجبًا صحيحًا؟ */
export function isValidOrderEventMoney(event: { type: unknown; amountMinor?: unknown }): boolean {
  if (typeof event.type !== "string") return true;
  if (!MONEY_MOVING_EVENT_TYPES.includes(event.type)) return true;
  return isPositiveInteger(event.amountMinor);
}
