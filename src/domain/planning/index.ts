/**
 * S10 (UNIT-030/031/032 + SH-14 — أمر b56967d8): الباب العام لعائلة «التخطيط» —
 * حسابات أدوات التخطيط الخمس النقية. تصدر القيم والأنواع معًا (شرط الاستيراد
 * الديناميكي للأبواب)؛ الاستهلاك من طبقة التطبيق عبر هذا الباب حصرًا،
 * ولا استيراد عميق من الواجهة (R2/R6 — قرارا المالك المعلقان).
 */
export {
  calculatePlanningResult,
  calculatePlanningProjection,
  isBlankPlanningGroup,
  suggestSellingPrice,
  calculateHourValue,
  calculateSalesQuantity,
  calculateInvoiceShare,
  reviewIdea,
  IDEA_REVIEW_QUESTIONS,
} from "./policies.js";
export type {
  PlanningGroupCostMode,
  PlanningUnitComponent,
  PlanningGroup,
  PlanningExtraRow,
  PlanningTimeInput,
  PlanningDiscount,
  PlanningCommission,
  PlanningCalculationInput,
  PlanningGroupResult,
  PlanningCalculationResult,
  PricingAim,
  HourValueInput,
  HourValueResult,
  SalesQuantityInput,
  SalesQuantityResult,
  InvoiceShareInput,
  InvoiceShareBasis,
  InvoiceShareResult,
  IdeaReviewAnswers,
  IdeaReviewResult,
} from "./types.js";
