/**
 * S10 (UNIT-030/031/032 — أمر b56967d8): خدمة أدوات التخطيط — الباب التطبيقي
 * للحسابات النقية الخمس. لا تخزين هنا إطلاقًا: T02–T05 حسابات لحظية بلا
 * حفظ، وT01 معاينته نقية والحفظ الاختياري له في بيت التقديرات
 * (application/estimates — SH-14). كل دالة تغلف دالة المجال النقية وتترجم
 * أخطاءها إلى رسائل عربية للمستخدم بلا كشف داخلي (عقد رسائل النتائج).
 */
import {
  calculateHourValue,
  calculateInvoiceShare,
  calculatePlanningResult,
  calculateSalesQuantity,
  IDEA_REVIEW_QUESTIONS,
  reviewIdea,
  suggestSellingPrice,
  type HourValueInput,
  type HourValueResult,
  type IdeaReviewAnswers,
  type IdeaReviewResult,
  type InvoiceShareInput,
  type InvoiceShareResult,
  type PlanningCalculationInput,
  type PlanningCalculationResult,
  type PricingAim,
  type SalesQuantityInput,
  type SalesQuantityResult,
} from "@micro-domain/planning/index.js";
import { VALIDATION_ERROR } from "@/application/resultCodes";

export type PlanningToolsResult<T> =
  { ok: true; value: T } | { ok: false; code: "validation_error"; message: string };

function validationFailure(error: unknown): PlanningToolsResult<never> {
  return {
    ok: false,
    code: VALIDATION_ERROR,
    message: error instanceof Error ? error.message : "مدخلات الحساب غير صالحة — راجع الحقول.",
  };
}

/** T01 — معاينة حساب التكلفة والتسعير حية بلا تخزين (النواة الواحدة SH-13). */
export function previewPlanningCalculation(
  input: PlanningCalculationInput,
): PlanningToolsResult<PlanningCalculationResult> {
  try {
    return { ok: true, value: calculatePlanningResult("planning-preview", input) };
  } catch (error) {
    return validationFailure(error);
  }
}

/** T01 — مساعدة اقتراح السعر الاختيارية: مبلغ فوق التكلفة أو هامش من البيع أو زيادة على التكلفة. */
export function suggestPlanningPrice(unitCostMinor: number, aim: PricingAim): PlanningToolsResult<number> {
  try {
    return { ok: true, value: suggestSellingPrice(unitCostMinor, aim) };
  } catch (error) {
    return validationFailure(error);
  }
}

/** T02 — قيمة ساعة العمل التقديرية (لا تثبت سعر ساعة في أي إعداد). */
export function computeHourValue(input: HourValueInput): PlanningToolsResult<HourValueResult> {
  try {
    return { ok: true, value: calculateHourValue(input) };
  } catch (error) {
    return validationFailure(error);
  }
}

/** T03 — كمية البيع المطلوبة لتغطية مصاريف الفترة أو لتحقيق هدف (تقريب لأعلى). */
export function computeSalesQuantity(input: SalesQuantityInput): PlanningToolsResult<SalesQuantityResult> {
  try {
    return { ok: true, value: calculateSalesQuantity(input) };
  } catch (error) {
    return validationFailure(error);
  }
}

/** T04 — نصيب المشروع التقديري من فاتورة مشتركة بأساس صريح (لا تسجيل مصروف). */
export function computeInvoiceShare(input: InvoiceShareInput): PlanningToolsResult<InvoiceShareResult> {
  try {
    return { ok: true, value: calculateInvoiceShare(input) };
  } catch (error) {
    return validationFailure(error);
  }
}

/** T05 — فحص الفكرة الأولي: ثلاثة أقسام بلا درجة ولا حكم جدوى. */
export function computeIdeaReview(answers: IdeaReviewAnswers): PlanningToolsResult<IdeaReviewResult> {
  try {
    return { ok: true, value: reviewIdea(answers) };
  } catch (error) {
    return validationFailure(error);
  }
}

/* T05: أسئلة الفحص الخمسة بترتيبها المعتمد — تُعاد من الباب لأسطح الواجهة. */
export { IDEA_REVIEW_QUESTIONS };
