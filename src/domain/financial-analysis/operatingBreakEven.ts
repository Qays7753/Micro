/* REM-007 (المرحلة ب — 2026-09-29): وحدة التعادل التشغيلي — طبقة التشغيل
 * الكاملة فوق قراءة التعادل الكنسية، وقراءة النتيجة التشغيلية المستهدفة
 * (TARGET_OPERATING_RESULT).
 *
 * التقسيم مقصود ومتبع نمط البرنامج المعتمد (بطاقة الإصلاح §٩): أساس
 * التعادل (`calculateBreakEven` في `policies.ts`) يبقى في الحزمة الرئيسية
 * حيث تستهلكه كل الأسطح الحية بحقوله القائمة، وهذه الوحدة لا يستوردها
 * مستدعٍ إنتاجي إلا مسارًا خاملاً (عبر `g5Service.readDecision`) فتعيش خارج
 * الحزمة الرئيسية احترامًا لسقف D-034 — بلا أي معنى منافس: القراءة
 * الكاملة تركيب واحد فوق الأساس نفسه، ومعادلات الوحدات والمبيعات في
 * موضع واحد يستهلكه التعادل والهدف معًا. */
import { addSafe, ceilRatio, roundHalfUp } from "../shared/index.js";
import { breakEvenUnitsFromAggregates } from "./policies.js";
import type {
  BreakEvenResult,
  BreakEvenState,
  OperatingBreakEvenResult,
  TargetOperatingResultReading,
} from "./types.js";

/* REM-007 (المرحلة ب — 2026-09-29، قرار المالك: النموذج الكنوني للتعادل
 * التشغيلي): الأسطر البنيوية لطبقة التشغيل — تُنبعث مع كل قراءة تعادل
 * تشغيلي (امتداد عقد ١٧ §٦.١ لمبدأ F-010: لا رقم بلا سياق أساسه). أساس
 * الهدف موثق في عقد ١٧ §٦.١ وقراءة الهدف نفسها. */
const OPERATING_BREAK_EVEN_ASSUMPTIONS: readonly string[] = [
  "وحدات التعادل أول عتبة صحيحة عند نتيجة صفر أو فوقها؛ النسبة النظرية المستمرة قد تقع بين وحدتين.",
  "قيمة مبيعات التعادل أول قيمة صغرى عند التعادل أو فوقه، من النسبة المجمعّة الدقيقة بلا تقريب مزدوج.",
];

/* REM-007 (المرحلة ب): قيمة مبيعات التعادل من النسبة المجمعّة الدقيقة —
 * ceil(بسط شبيه بالثابتة × إيراد ÷ هامش) بلا تقريب مزدوج؛ أول قيمة صحيحة
 * بالوحدة الصغرى عند التعادل أو فوقه (عقد ١٧ §٦.١). */
function breakEvenSalesValueFromAggregates(
  fixedLikeMinor: number,
  revenueMinor: number,
  marginMinor: number,
): number | null {
  if (revenueMinor <= 0 || marginMinor <= 0) return null;
  if (fixedLikeMinor > Number.MAX_SAFE_INTEGER / revenueMinor) return null;
  return ceilRatio(fixedLikeMinor * revenueMinor, marginMinor);
}

/* REM-007 (المرحلة ب): اكتمال مجمعات القراءة التشغيلية — فشل توحيد
 * الوحدات وحده لا يُسقط القيم المجمعّة (نتيجة التشغيل/قيمة المبيعات/
 * الحالة)؛ ما يُسقطها فجوة التصنيف أو الطلب المستبعد أو القراءة غير
 * الصالحة. */
function aggregateInputsComplete(reading: BreakEvenResult): boolean {
  return (
    reading.status !== "invalid" &&
    !reading.classificationGap &&
    reading.excludedOrderCount === 0 &&
    reading.finalOrderCount > 0 &&
    reading.contributionMarginMinor > 0
  );
}

/* REM-007 (المرحلة ب): القراءة الكاملة — طبقة التشغيل فوق أساس التعادل:
 * نتيجة التشغيل وحالة الموقف والمتبقي والفائض والمبيعات والنسبة، والهدف
 * غائب ما لم يُطلب. الوحدات والقيم المجمعّة مستويان مستقلان، والقراءة غير
 * الصالحة تخصم الأرقام كلها بلا رقم جزئي مضلل (عقد ١٧ §٦.١). */
function withOperatingBreakEven(reading: BreakEvenResult): OperatingBreakEvenResult {
  const complete = aggregateInputsComplete(reading);
  const r = complete ? addSafe(reading.contributionMarginMinor, -reading.fixedExpenseMinor) : null;
  const state: BreakEvenState | null = r === null ? null : r < 0 ? "below" : r === 0 ? "at" : "above";
  return {
    ...reading,
    operatingResultMinor: r,
    breakEvenState: state,
    remainingToBreakEvenMinor: r === null ? null : r < 0 ? -r : 0,
    amountAboveBreakEvenMinor: r !== null && r > 0 ? r : null,
    breakEvenSalesValueMinor: complete
      ? breakEvenSalesValueFromAggregates(
          reading.fixedExpenseMinor,
          reading.totalRevenueMinor,
          reading.contributionMarginMinor,
        )
      : null,
    contributionMarginRatioPermyriad:
      complete && reading.contributionMarginMinor <= Number.MAX_SAFE_INTEGER / 10000
        ? roundHalfUp(reading.contributionMarginMinor * 10000, reading.totalRevenueMinor)
        : null,
    targetOperatingResult: null,
    assumptions: [...reading.assumptions, ...OPERATING_BREAK_EVEN_ASSUMPTIONS],
  };
}

/* REM-007 (المرحلة ب): نقطة الدخول الكنسية الواحدة لطبقة التشغيل — تركّب
 * القراءة الكاملة فوق أساس التعادل، والهدف عند طلبه فقط. الهدف صفر يطابق
 * التعادل العادي بالبناء؛ والهدف الغائب يترك القراءة بلا قراءة هدف. */
export function composeOperatingBreakEven(
  reading: BreakEvenResult,
  targetOperatingResultMinor?: number | null,
): OperatingBreakEvenResult {
  const full = withOperatingBreakEven(reading);
  return targetOperatingResultMinor == null
    ? full
    : {
        ...full,
        targetOperatingResult: calculateTargetOperatingResult(full, targetOperatingResultMinor),
      };
}

/* REM-007 (المرحلة ب): قراءة النتيجة التشغيلية المستهدفة — فوق القراءة
 * الكاملة نفسها بلا معادلة موازية: الهدف يضاف إلى بسط الثابتة فقط، والهدف
 * صفر يطابق التعادل العادي بالبناء. التوافر من إشارات القراءة نفسها:
 * الوحدات تتطلب قراءة متاحة أو موسومة للمراجعة، والمبيعات تتطلب قيمة
 * مبيعات تعادل متاحة. كل null بسبب مسمى؛ والهدف غير الصحيح أو السالب
 * يُرفض بالاسم داخل قراءة الهدف — لا سياسة خسارة مستهدفة تُخترع. */
export function calculateTargetOperatingResult(
  reading: OperatingBreakEvenResult,
  targetOperatingResultMinor: number,
): TargetOperatingResultReading {
  if (!Number.isSafeInteger(targetOperatingResultMinor) || targetOperatingResultMinor < 0)
    return {
      targetOperatingResultMinor,
      targetUnits: null,
      targetSalesValueMinor: null,
      reasons: ["النتيجة التشغيلية المستهدفة المطلوبة غير صالحة: يلزم رقم صحيح غير سالب بالوحدة الصغرى."],
      nextAction: "أدخل نتيجة مستهدفة صحيحة غير سالبة بالوحدة الصغرى.",
    };
  const fixedPlusTarget = addSafe(reading.fixedExpenseMinor, targetOperatingResultMinor);
  const targetUnits =
    fixedPlusTarget !== null && (reading.status === "available" || reading.status === "needs_review")
      ? breakEvenUnitsFromAggregates(
          fixedPlusTarget,
          reading.totalQuantityMilli,
          reading.contributionMarginMinor,
        )
      : null;
  const targetSalesValueMinor =
    fixedPlusTarget !== null && reading.breakEvenSalesValueMinor !== null
      ? breakEvenSalesValueFromAggregates(
          fixedPlusTarget,
          reading.totalRevenueMinor,
          reading.contributionMarginMinor,
        )
      : null;
  const reasons: string[] = [];
  if (targetUnits === null)
    reasons.push("وحدات الهدف غير متاحة: لا وحدة موحدة أو مركبة معلنة بمزيج مستقر، أو تجاوز الدقة الآمنة.");
  if (targetSalesValueMinor === null)
    reasons.push("مبيعات الهدف غير متاحة: مجمعات الفترة ناقصة أو تتجاوز الدقة الآمنة.");
  return {
    targetOperatingResultMinor,
    targetUnits,
    targetSalesValueMinor,
    reasons,
    nextAction:
      targetUnits === null || targetSalesValueMinor === null
        ? "سجّل الناقص قبل الاعتماد على قراءة الهدف."
        : "راجع السعر والتكلفة إذا تغير المزيج أو الافتراض المعلن.",
  };
}
