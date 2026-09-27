/**
 * D-15 (FIN-009) — نموذج صندوقي مساهمة التوصيل المعتمد من المالك:
 * «مساهمة المشروع في التوصيل» (الكلفة التي يتحملها المشروع — `costPaidMinor`)
 * و«مساهمة العميل في التوصيل» (ما يدفعه العميل للمشروع — `feeChargedMinor`،
 * وهو وحده ما يدخل قيمة الطلب القابلة للتحصيل مرة واحدة).
 *
 * هذا مصدر واحد لنموذج الإدخال وللوصف الظاهر فقط — لا حساب مال هنا: كل
 * المبالغ تمر كما هي إلى حقول الدومين الكنسية، والمسؤولية تُستنتج من
 * الصندوقين (لا خيار `shared` مستقل للمستخدم)، والزبون يدفع للناقل مباشرة
 * اختيار صريح مستقل بلا أي مبلغ عبر المشروع.
 *
 * null تعني «غير مسجل بعد» وتبقى null؛ الصفر قيمة صريحة صحيحة.
 */
import type { DeliveryResponsibility } from "@micro-domain/craft-order/index.js";

export type DeliveryContributionInput = {
  /** مساهمة المشروع في التوصيل — الكلفة التي يتحملها المشروع (minor). */
  projectMinor: number | null;
  /** مساهمة العميل في التوصيل — ما يدفعه العميل للمشروع (minor). */
  customerMinor: number | null;
  /** الزبون يدفع لشركة التوصيل مباشرة — معلومة سياقية فقط، لا مبلغ عبر المشروع. */
  customerPaysCourierDirect: boolean;
  /** الأجرة محتواة أصلًا داخل سعر البيع — لا تُضاف مرة ثانية. */
  feeIncludedInPrice: boolean;
  /** كلفة النقل محتواة أصلًا داخل تكلفة المنتج — لا تُطرح مرة ثانية. */
  costIncludedInProductCost: boolean;
};

export type DeliveryContributionTerms = {
  responsibility: DeliveryResponsibility;
  feeIncludedInPrice: boolean;
  costIncludedInProductCost: boolean;
  feeChargedMinor: number | null;
  costPaidMinor: number | null;
  projectShareMinor: number | null;
  customerShareMinor: number | null;
};

/* حصص التكلفة المشتركة حقول توافق قديمة: النموذج المعتمد يستنتج «مشترك»
 * من الصندوقين ولا يطلب حصصًا؛ تُمرر القيم المسجلة كما هي عند تحرير سجل
 * قائم كي لا تُمسح بصمت (إصلاح المتابعة ORD-003). */
export type LegacyDeliveryShares = {
  projectShareMinor: number | null;
  customerShareMinor: number | null;
};

/** هل دخل المستخدم أي قيمة صريحة في الصندوقين؟ (null = لم يُسجل بعد) */
export function deliveryContributionSpecified(input: DeliveryContributionInput): boolean {
  return input.projectMinor !== null || input.customerMinor !== null;
}

/**
 * اشتقاق شروط النقل من الصندوقين — يستنتج المسؤولية من القيم لا العكس:
 *
 * - الزبون يدفع للناقل مباشرة (اختيار صريح): كل المبالغ null — لا مستحق للمشروع.
 * - الصندوقان فارغان: لا شروط نقل (null) — توافق رجعي كامل مع الطلبات البسيطة.
 * - مساهمة العميل موجبة: تدخل `feeChargedMinor` كما هي (مرة واحدة في قيمة الطلب).
 * - مساهمة المشروع: تُسجل في `costPaidMinor` ولا تدخل دين العميل أبدًا.
 * - `shared` تُستنتج فقط عندما تكون المساهمتان موجبتين معًا.
 * - project_pays تتطلب من الدومين ألا أجرة على الزبون (feeChargedMinor=null)
 *   فتُحمل «مساهمة العميل صفر/غير مسجلة» في معنى المسؤولية نفسها.
 */
export function deriveDeliveryContributionTerms(
  input: DeliveryContributionInput,
  legacyShares?: LegacyDeliveryShares | null,
): DeliveryContributionTerms | null {
  if (input.customerPaysCourierDirect) {
    return {
      responsibility: "customer_pays_courier",
      feeIncludedInPrice: false,
      costIncludedInProductCost: false,
      feeChargedMinor: null,
      costPaidMinor: null,
      projectShareMinor: null,
      customerShareMinor: null,
    };
  }
  if (!deliveryContributionSpecified(input)) return null;

  const customerPays = (input.customerMinor ?? 0) > 0;
  const projectPays = (input.projectMinor ?? 0) > 0;

  let responsibility: DeliveryResponsibility;
  if (customerPays && projectPays) responsibility = "shared";
  else if (customerPays) responsibility = "customer_pays_project";
  else responsibility = "project_pays";

  const shares =
    responsibility === "shared" && legacyShares
      ? {
          projectShareMinor: legacyShares.projectShareMinor,
          customerShareMinor: legacyShares.customerShareMinor,
        }
      : { projectShareMinor: null, customerShareMinor: null };

  return {
    responsibility,
    feeIncludedInPrice: input.feeIncludedInPrice,
    costIncludedInProductCost: input.costIncludedInProductCost,
    /* project_pays لا يحمل أجرة على الزبون — عقد الدومين (buildDeliveryTerms). */
    feeChargedMinor: responsibility === "project_pays" ? null : input.customerMinor,
    costPaidMinor: input.projectMinor,
    ...shares,
  };
}

/**
 * الوصف البسيط لمن يدفع التوصيل — من القيم المحفوظة نفسها، بالمصطلحات
 * المعتمدة للمالك، بلا معادلات ولا مصطلحات محاسبية:
 * مشروع موجب وعميل صفر/غير مسجل → «على المشروع»؛ العكس → «على العميل»؛
 * الموجبان معًا → «مشترك»؛ الصريحان صفرًا → «لا توجد مساهمة توصيل».
 */
export function describeDeliveryContribution(input: {
  projectMinor: number | null;
  customerMinor: number | null;
  customerPaysCourierDirect: boolean;
}): string {
  if (input.customerPaysCourierDirect) {
    return "الزبون يدفع لشركة التوصيل مباشرة — لا مستحق للمشروع من التوصيل.";
  }
  const project = input.projectMinor;
  const customer = input.customerMinor;
  if (project === null && customer === null) return "لم تُسجَّل مساهمة توصيل بعد.";
  if (project !== null && project > 0 && (customer === null || customer === 0)) {
    return "التوصيل على المشروع.";
  }
  if (customer !== null && customer > 0 && (project === null || project === 0)) {
    return "التوصيل على العميل.";
  }
  if ((project ?? 0) > 0 && (customer ?? 0) > 0) return "التوصيل مشترك بين المشروع والعميل.";
  if (project === 0 && customer === 0) return "لا توجد مساهمة توصيل — التوصيل مجاني.";
  /* حالة مختلطة: قيمة صريحة صفر مع قيمة غير مسجلة — معرفة ناقصة معلنة. */
  return "مساهمة التوصيل غير محددة بالكامل بعد.";
}

/** إعادة بناء صندوقي المساهمة من شروط مخزنة — لعرض الوصف والتحرير من السجل نفسه.
 * تحت project_pays لا يحمل الدومين أجرة على الزبون (feeChargedMinor=null) —
 * فالصفر هنا دلالة المسؤولية نفسها (العميل لا يساهم عبر المشروع) لا اختراع قيمة. */
export function deliveryContributionFromTerms(terms: {
  responsibility: DeliveryResponsibility;
  feeChargedMinor: number | null;
  costPaidMinor: number | null;
}): {
  projectMinor: number | null;
  customerMinor: number | null;
  customerPaysCourierDirect: boolean;
} {
  if (terms.responsibility === "customer_pays_courier") {
    return { projectMinor: null, customerMinor: null, customerPaysCourierDirect: true };
  }
  return {
    projectMinor: terms.costPaidMinor,
    customerMinor: terms.responsibility === "project_pays" ? 0 : terms.feeChargedMinor,
    customerPaysCourierDirect: false,
  };
}
