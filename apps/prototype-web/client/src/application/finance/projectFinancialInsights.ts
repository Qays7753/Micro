/* Wave F (ADR-013 عنقود ٣ — تقسيم مسؤولية داخلي، 2026-10-04): قراءة المؤشرات
 * المالية — تركب نتيجة الفترة والمركز في مؤشرات الأعمال والتركيب المعياري
 * والتغطية والسيولة — انتقلت حرفيًا من projectFinancialService.ts إلى هذا
 * البيت الشقيق؛ الاستيراد العميق الموثق D-034 (operatingBreakEven — يُحمَّل
 * عند القراءة فقط فلا يدخل حزبة الدخول) انتقل معها كما هو؛ القارئ الكنوني
 * (عقد ٤٠ §8) يبقى الواجهة والهوية في الخدمة. لا صيغة تُحرّك — نقل نصّي. */
import { localDateInAmman as ammanDate } from "@micro-domain/shared/index.js";
/* F-009 (W2-B): نموذج تعادل واحد — قراءة التغطية تستهلك الأساس الكنوني
 * calculateBreakEven بمدخلات g5Service الموحدة نفسها، بلا اشتقاق خاص بعد اليوم.
 * REM-007 (تصحيح تكافؤ المستهلكين — 2026-09-30): والقراءة الكاملة تركّبها
 * الوحدة الكنسية نفسها التي يستهلكها G5 — انظر داخل readFinancialInsights. */
import { calculateBreakEven } from "@micro-domain/financial-analysis/index.js";
import { expenseInputs, orderInputs } from "@/application/financial-analysis/financialAnalysisService";
import { lastEffectiveDeliveryEvent } from "@/application/fulfillment/deliveryAttribution";
import { STORAGE_ERROR, storageFailure } from "@/application/resultCodes";
import type { PrototypeLocalStore } from "@/storage/local/types";

/** R3 (بطاقة R3-SC-01/11): عدسة الخدمة — قراءات المؤشرات الست بالضبط. */
export type ProjectFinancialInsightsStore = Pick<
    PrototypeLocalStore,
    "listOrders" | "listFinancialEvents" | "listInventoryMovements" | "listCatalogItems" |
    "listMeasurementUnits" | "listDirectConversions"
  >;
import type {
  CoverageIndicator,
  FinanceResult,
  FinancialInsightStatus,
  FinancialInsights,
  ProjectFinancialPosition,
  RecordedLiquidity,
  RecordedPeriodResult,
  WorkNameProfitability,
} from "./projectFinancialTypes";

/* سطح القارئ الكنوني الذي تستهلكه المؤشرات (TR-01: «لا تنفيذ ثانٍ منافس») —
 * الصنف ProjectFinancialService يحققه بنيويًا، فتمرير الخدمة نفسها يحفظ
 * الاستدعاء عبر مسار القارئ الواحد (المسار الذي يحرسه اختبار التجسس
 * periodResultCanonical) كما كان قبل التقسيم تمامًا. */
export type PeriodReadSurface = {
  readRecordedPeriodResult(from: string, to: string): Promise<FinanceResult<RecordedPeriodResult>>;
  readPosition(): Promise<FinanceResult<ProjectFinancialPosition>>;
};

export async function readFinancialInsights(
  store: ProjectFinancialInsightsStore,
  reader: PeriodReadSurface,
  from: string,
  to: string,
): Promise<FinanceResult<FinancialInsights>> {
  const [
    periodResult,
    ordersResult,
    eventsResult,
    movementsResult,
    positionResult,
    catalogResult,
    unitsResult,
    conversionsResult,
  ] = await Promise.all([
    reader.readRecordedPeriodResult(from, to),
    store.listOrders(),
    store.listFinancialEvents(),
    store.listInventoryMovements(),
    reader.readPosition(),
    store.listCatalogItems(),
    store.listMeasurementUnits(),
    store.listDirectConversions(),
  ]);
  if (
    !periodResult.ok ||
    !ordersResult.ok ||
    !eventsResult.ok ||
    !movementsResult.ok ||
    !positionResult.ok ||
    !catalogResult.ok ||
    !unitsResult.ok ||
    !conversionsResult.ok
  )
    return storageFailure("تعذر قراءة مؤشرات الفترة المحلية.");
  const inPeriod = (date: string) => date >= from && date <= to;
  /* FT-01 (المجموعة ٦): آخر تسليم ساري — انظر أعلاه. */
  const delivered = ordersResult.value
    .map(stored => {
      const event = lastEffectiveDeliveryEvent(stored.order);
      return { order: stored.order, deliveredAt: event ? ammanDate(event.createdAt) : null };
    })
    .filter(item => item.deliveredAt !== null && inPeriod(item.deliveredAt));
  const finals = delivered.filter(item => item.order.resultStatus === "final");
  const grouped = new Map<string, WorkNameProfitability>();
  let materialMinor = 0;
  let timeMinor = 0;
  let packagingMinor = 0;
  let deliveryMinor = 0;
  let wasteMinor = 0;
  for (const { order } of finals) {
    const prior = grouped.get(order.itemName) ?? {
      itemName: order.itemName,
      finalOrderCount: 0,
      deliveredQuantity: 0,
      recognizedRevenueMinor: 0,
      recognizedDirectCostMinor: 0,
      directMarginMinor: 0,
    };
    const next = {
      ...prior,
      finalOrderCount: prior.finalOrderCount + 1,
      deliveredQuantity: prior.deliveredQuantity + order.quantity,
      recognizedRevenueMinor: prior.recognizedRevenueMinor + order.recognizedRevenueMinor,
      recognizedDirectCostMinor: prior.recognizedDirectCostMinor + order.recognizedCostMinor,
      directMarginMinor: prior.directMarginMinor + order.recognizedRevenueMinor - order.recognizedCostMinor,
    };
    grouped.set(order.itemName, next);
    materialMinor += order.costSnapshot.materialCostMinor;
    timeMinor += order.costSnapshot.timeCostMinor;
    packagingMinor += order.costSnapshot.packagingMinor;
    deliveryMinor += order.costSnapshot.deliveryMinor;
    wasteMinor += order.costSnapshot.wasteMinor;
  }
  /* F-019 (W2-D): التركيب المعياري يعيد استخدام حقلي القارئ الكنوني نفسه
   * (recordedOperatingExpenseMinor بلا الخسارة وnonCashLossMinor) — لا
   * اشتقاق ثانٍ ولا إعادة حساب في طبقة المؤشرات. */
  const operatingExpenseMinor = periodResult.value.recordedOperatingExpenseMinor;
  const nonCashLossMinor = periodResult.value.nonCashLossMinor;
  const movementCount = movementsResult.value.filter(movement => inPeriod(movement.occurredOn)).length;
  /* F-009 (W2-B) + REM-007 (تصحيح تكافؤ المستهلكين — 2026-09-30): نموذج
   * التعادل الكنوني الواحد — نفس مدخلات g5Service ونفس الأساس
   * calculateBreakEven، ثم القراءة الكاملة تركّبها الوحدة الكنسية نفسها
   * التي يستهلكها G5 (composeOperatingBreakEven عبر المسار الخامل المعتمد
   * كما في g5Service.readDecision — سقف D-034 محفوظ)، فلا يمكن لسطحين أن
   * يعرضا رقمين مختلفين لسؤال واحد. التغطية مهايئ عرض فوق القراءة نفسها:
   * الحقول الكنسية تمر كما هي (spread) ويكيَّف ثلاثة فقط — الحالة (بقاعدة
   * الحالة القائمة دون تغيير) والكمية المعروضة والأسباب؛ وتراكيب حركات
   * المخزون تخفض الحالة فقط (لا ترفعها أبدًا) والأرقام الكنسية تبقى كما
   * هي بلا إعادة حساب أو محو: أساس الهامش معلن على التكلفة المعترف بها لا
   * على COGS المؤهلة (عقد ١٤ §٤)، والحركات تعلن الفرق لا تخفيه. */
  const operating = await import("@micro-domain/financial-analysis/operatingBreakEven.js");
  const coverageReading = operating.composeOperatingBreakEven(
    calculateBreakEven(
      from,
      to,
      orderInputs(
        ordersResult.value,
        catalogResult.value,
        unitsResult.value,
        conversionsResult.value,
        from,
        to,
      ),
      expenseInputs(eventsResult.value, from, to),
    ),
  );
  const coverageStatus: FinancialInsightStatus =
    coverageReading.status === "available"
      ? "recorded_only"
      : coverageReading.status === "invalid"
        ? "not_available"
        : "incomplete";
  const coverageReasons: string[] = [...coverageReading.reasons];
  if (movementCount > 0) {
    coverageReasons.push("حركات مخزون فعلية");
  }
  /* REM-007 (تصحيح تكافؤ المستهلكين — 2026-09-30): قراءة الهدف لا تمر إلى
   * التغطية أصلًا — لا سطح إدخال هدف في المؤشرات المالية؛ الهدف قراءة G5
   * اختيارية فقط (لا وسيط هدف في هذه الدالة). */
  const { targetOperatingResult: _coverageTarget, ...coverageFields } = coverageReading;
  const coverage: CoverageIndicator = {
    ...coverageFields,
    status: movementCount > 0 && coverageStatus === "recorded_only" ? "incomplete" : coverageStatus,
    finalDeliveredQuantity:
      coverageReading.totalQuantityMilli === null ? null : coverageReading.totalQuantityMilli / 1000,
    reasons: coverageReasons,
  };
  /* S2-05: الأمانات ضمن الكاش المسجل لكنها محتجزة لغير المالك — التغطية
   * تعلن ذلك بدل عدّها مالًا قابلًا للصرف بصمت. */
  const amanahHeldMinor = positionResult.value.amanahHeldMinor;
  const liquidityIncomplete =
    positionResult.value.customerReceivablesMinor > 0 ||
    positionResult.value.supplierPayablesMinor > 0 ||
    amanahHeldMinor > 0;
  const liquidity: RecordedLiquidity = {
    status: liquidityIncomplete ? "incomplete" : "recorded_only",
    recordedCashMinor: positionResult.value.recordedCashMinor,
    customerReceivablesMinor: positionResult.value.customerReceivablesMinor,
    supplierPayablesMinor: positionResult.value.supplierPayablesMinor,
    cashCoverageAfterLiabilitiesMinor:
      positionResult.value.recordedCashMinor - positionResult.value.supplierPayablesMinor,
    amanahHeldMinor,
    amanahNotice:
      amanahHeldMinor > 0
        ? "من الكاش المسجل أمانات محتجزة ليست مالكًا — راجعها قبل الاعتماد على التغطية."
        : null,
  };
  return {
    ok: true,
    value: {
      period: periodResult.value,
      workNames: [...grouped.values()].sort(
        (left, right) =>
          right.directMarginMinor - left.directMarginMinor ||
          left.itemName.localeCompare(right.itemName, "ar"),
      ),
      costComposition: {
        materialMinor,
        timeMinor,
        packagingMinor,
        deliveryMinor,
        wasteMinor,
        operatingExpenseMinor,
        nonCashLossMinor,
      },
      inventoryMovementCount: movementCount,
      coverage,
      liquidity,
    },
  };
}
