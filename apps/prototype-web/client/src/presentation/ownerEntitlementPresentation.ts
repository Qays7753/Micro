/**
 * المجموعة ١١ (المرحلة 11-C): معينات عرض حق المالك النقية — بيت واحد
 * للصفحة ومقاطعها المستخرجة (بلا استيراد دائري). نفس السلوك حرفيًا.
 */
import {
  ownerEntitlementPolicyFamilyForKind,
  type OwnerEntitlementPolicy,
  type OwnerMovementReason,
} from "@micro-domain/owner-entitlement/index.js";

export const amountPolicyKinds = new Set([
  "monthly",
  "weekly",
  "daily",
  "hourly",
  "fixed_period",
  "fixed_shift",
  "per_completed_work",
  "per_unit",
]);
export const percentagePolicyKinds = new Set(["profit_share", "sale_percentage"]);
export const policyLabels: Record<OwnerEntitlementPolicy["kind"], string> = {
  monthly: "مبلغ شهري",
  weekly: "مبلغ أسبوعي",
  daily: "مبلغ يومي",
  hourly: "مبلغ بالساعة",
  fixed_period: "مبلغ ثابت للفترة",
  fixed_shift: "مبلغ ثابت للوردية (غير متاح بلا دليل وردية)",
  per_completed_work: "مبلغ لكل عمل مكتمل",
  profit_share: "نسبة من نتيجة الفترة المسجلة",
  sale_percentage: "نسبة من بيع مكتمل",
  per_unit: "مبلغ لكل وحدة مكتملة",
};
export const policyFamilyLabels: Record<OwnerEntitlementPolicy["family"], string> = {
  time_period: "زمن/فترة",
  fixed_amount: "مبلغ ثابت",
  completed_work: "عمل مكتمل",
  profit_share: "مشاركة نتيجة",
  completed_sale_percentage: "نسبة بيع مكتمل",
  unit: "وحدة",
};
export const movementReasonLabels: Record<OwnerMovementReason, string> = {
  entitlement_settlement: "تسوية حق مسجل",
  opening_balance_settlement: "تسوية رصيد افتتاحي",
  pre_entitlement_draw: "سحب قبل تسجيل الحق",
  owner_draw: "سحب مالك غير مرتبط بسياسة",
  settlement_of_prior_draw: "إرجاع لتسوية سحب سابق",
  new_capital_investment: "إرجاع/حقن كرأس مال جديد",
};
export const supportedOwnerEntitlementPolicyKinds = [
  "monthly",
  "weekly",
  "daily",
  "hourly",
  "fixed_period",
  "per_completed_work",
  "profit_share",
  "sale_percentage",
  "per_unit",
] as const;
/* X-05 (و٣): السحب الشخصي العادي له مدخل واحد من «مالي» يسأل «سحب من المشروع لنفسك؟»
 * ويوجه إلى المسار الصحيح. طبقة الدفتر تبقى للعمليات المرتبطة بسجلاته: تسوية حق
 * مسجل أو رصيد افتتاحي، وإرجاع السحب السابق، وحقن رأس مال جديد — لا للسحب الحر. */
export const ownerMovementReasonsForKind = (kind: "draw" | "return"): readonly OwnerMovementReason[] =>
  kind === "draw"
    ? ["entitlement_settlement", "opening_balance_settlement"]
    : ["opening_balance_settlement", "settlement_of_prior_draw", "new_capital_investment"];
export const successorPolicyFormRequirements = (kind: OwnerEntitlementPolicy["kind"]) => ({
  family: ownerEntitlementPolicyFamilyForKind(kind),
  valueKind: percentagePolicyKinds.has(kind) ? ("percentage" as const) : ("amount" as const),
  requiresUnit: kind === "per_unit" || kind === "per_completed_work",
  requiresEndDate: kind === "fixed_period",
  supported: (supportedOwnerEntitlementPolicyKinds as readonly string[]).includes(kind),
});
