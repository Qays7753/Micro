/**
 * المجموعة ١١ (المرحلة 11-A): معينات عرض الكتالوج النقية — كان لها بيت
 * واحد داخل صفحة Catalog.tsx؛ انتقلت هنا كي تصل إليها الصفحة ومقاطعها
 * المستخرجة من مصدر واحد (بلا استيراد دائري). نفس السلوك حرفيًا: تحليل
 * الإدخال، تسميات القراءة، معاينات التحويل والتوزيع، ومفاتيح العملية —
 * لا منطق ماليًا جديدًا هنا ولا تخزينًا أبدًا.
 */
import { perOutputUnitAmountMinor } from "@micro-domain/recurring-margin/index.js";
import { parseEnglishNumericText, parseEnglishQuantityText } from "@/application/input";
import {
  daysInMonthOf,
  formatMoneyWithUnit,
  formatQuantityMilliFixed3,
  localDateInAmman,
  localDatePlusDays,
} from "@/presentation/formatters";
import type { CatalogTemplate, UnitDimension } from "@micro-domain/catalog/index.js";
import type { RecurringWorkReading } from "@/application/finance";

const dimensions: readonly { value: UnitDimension; label: string }[] = [
  { value: "count", label: "عدد" },
  { value: "mass", label: "وزن" },
  { value: "volume", label: "حجم" },
  { value: "time", label: "وقت" },
  { value: "distance", label: "مسافة" },
  { value: "area", label: "مساحة" },
];
export const dimensionLabel = (dimension: UnitDimension) =>
  dimensions.find(entry => entry.value === dimension)?.label ?? dimension;
/* المجموعة ١١ (11-0): تنسيق الكمية من المعيّن الكنسي وحده — منزلة الألف
 * الثابتة معلنة هنا كسياسة عرض لعقد الملي، لا حسابًا مستقلًا في الصفحة. */
export const quantityLabel = formatQuantityMilliFixed3;
const parseQuantityMilli = (value: string) => {
  const result = parseEnglishQuantityText(value);
  return result !== null && result > 0 ? result : null;
};
const parsePositiveSafeInteger = (value: string) => {
  const result = parseEnglishNumericText(value.trim(), "integer");
  return result !== null && result > 0 ? result : null;
};
export const catalogDimensionOptions = dimensions;
export const parseCatalogQuantityMilli = parseQuantityMilli;
export const parseCatalogPositiveSafeInteger = parsePositiveSafeInteger;
export const catalogConversionExactnessWarning =
  "لا يمكن تمثيل هذا المثال بدقة؛ صحح العامل بدل التقريب الخفي.";
export const catalogConversionDirectionText = (fromName: string, toName: string) =>
  `المصدر: ${fromName.trim()} | الوجهة: ${toName.trim()}`;
export const buildCatalogConversionPreview = (
  fromName: string,
  toName: string,
  numerator: number,
  denominator: number,
  sampleQuantityMilli = 12_000,
) => {
  if (
    !Number.isSafeInteger(numerator) ||
    numerator <= 0 ||
    !Number.isSafeInteger(denominator) ||
    denominator <= 0 ||
    !Number.isSafeInteger(sampleQuantityMilli) ||
    sampleQuantityMilli <= 0
  )
    return {
      exact: false,
      sourceQuantityMilli: sampleQuantityMilli,
      targetQuantityMilli: null,
      text: null,
      warning: catalogConversionExactnessWarning,
    };
  const scaledNumerator = sampleQuantityMilli * numerator;
  if (!Number.isSafeInteger(scaledNumerator) || scaledNumerator % denominator !== 0)
    return {
      exact: false,
      sourceQuantityMilli: sampleQuantityMilli,
      targetQuantityMilli: null,
      text: null,
      warning: catalogConversionExactnessWarning,
    };
  const targetQuantityMilli = scaledNumerator / denominator;
  if (!Number.isSafeInteger(targetQuantityMilli) || targetQuantityMilli <= 0)
    return {
      exact: false,
      sourceQuantityMilli: sampleQuantityMilli,
      targetQuantityMilli: null,
      text: null,
      warning: catalogConversionExactnessWarning,
    };
  const sourceLabel = fromName.trim() || "وحدة المصدر";
  const targetLabel = toName.trim() || "وحدة الوجهة";
  return {
    exact: true,
    sourceQuantityMilli: sampleQuantityMilli,
    targetQuantityMilli,
    text: `${quantityLabel(sampleQuantityMilli)} ${sourceLabel} × ${numerator} ÷ ${denominator} = ${quantityLabel(targetQuantityMilli)} ${targetLabel}`,
    warning: null,
  };
};
export const catalogYieldReadinessLabel = (value: CatalogTemplate["yieldReadiness"]) =>
  value === "ready" ? "مهيأ" : value === "needs_conversion" ? "يحتاج تحويلًا صريحًا" : "غير مهيأ اختياريًا";
export const isCatalogTemplateDirty = (fingerprint: string, baseline: string | null, hasDraft: boolean) =>
  baseline === null ? hasDraft : fingerprint !== baseline;
/* المجموعة ٨ (STR-007): مفتاح العملية/هوية مكوّن القالب المؤقتة يعملان في
 * السياقات غير الآمنة أيضًا — نفس randomUUID حرفيًا عند توفره (المسار الآمن
 * كما كان بايتًا ببايت)، وبديل حتمي-آمن عند غيابه بنفس عائلة البديل المعتمدة
 * في بقية الصفحات (طابع زمني + عشوائية) — لا يعاد كتابة مفتاح مخزّن أبدًا
 * ولا تتغير دلالة المفتاح. */
export const catalogOperationUuid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `catalog-${Date.now()}-${Math.random().toString(36).slice(2)}`;
/* مفتاح العملية نفسه يُصدَّر لاختبار تركيبه (بادئة:قيمة) كما تُصدَّر بقية
 * معينات الصفحة النقية — لا تغيير للاسم ولا للدلالة (STR-040: لا rename). */
export const operationKey = (prefix: string) => `${prefix}:${catalogOperationUuid()}`;
export const currentMonth = () => {
  /* S5-14: شهر عمان لا شهر الجهاز — نفس مصدر الحقيقة الذي تستعمله مالي والكشف. */
  const today = localDateInAmman();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const lastDay = monthEndDate(year, month);
  return {
    from: `${today.slice(0, 7)}-01`,
    to: `${today.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`,
  };
};
/* R2 (M-02/X1، 2026-10-08 — تصويب المراجعة النهائية FH-2): إزاحة اليوم من
 * نواة الحساب الخالص — كانت مرساة ظهر كاملة (تفويض ناقص في الشريحة
 * الأولى؛ مدخل المستهلك مُتحقق مسبقًا فحد التمثيل بعيد الاحتمال). */
export const nextDay = (value: string) => localDatePlusDays(value, 1) ?? value;
/* R2 (M-02/X1، 2026-10-08): طول الشهر من نواة المجال الخالصة — كانت
 * Date.UTC رقمية تعيد السنوات < 0100 إلى 1900+. */
export const monthEndDate = (year: number, month: number) => daysInMonthOf(year, month);
export const parseCatalogJodMinor = (value: string) => {
  const minor = parseEnglishNumericText(value.trim(), "money");
  return minor !== null && minor > 0 ? minor : null;
};
export const parseCatalogPercentageBps = (value: string) => {
  const bps = parseEnglishNumericText(value.trim(), "percentage");
  return bps !== null && bps >= 1 && bps <= 10_000 ? bps : null;
};
export const catalogAllocationKindLabel = (kind: RecurringWorkReading["policies"][number]["kind"]) =>
  ({
    manual_amount: "مبلغ يدوي للفترة",
    per_output_unit: "معدل لكل 1.000 وحدة كاملة",
    actual_time: "معدل لكل دقيقة فعلية",
    completed_revenue_percentage: "نسبة من الإيراد المكتمل",
  })[kind];
export const catalogPerUnitRateLabel = (unitName: string) =>
  `المعدل لكل 1.000 ${unitName.trim() || "وحدة كاملة"} · د.أ`;
export const catalogPerUnitRoundingNote = "يُقرب مجموع الفترة مرة واحدة إلى أقرب قرش.";
export const buildCatalogPerUnitPreview = (
  quantityMilli: number | null,
  rateMinorPerWholeUnit: number | null,
  unitName: string,
) => {
  const allocation = perOutputUnitAmountMinor(quantityMilli, rateMinorPerWholeUnit);
  if ("problem" in allocation)
    return {
      allocationMinor: null,
      text: null,
      warning:
        allocation.problem === "missing_input"
          ? "تحتاج المعاينة إلى كمية نهائية ومعدل صالحين."
          : allocation.problem === "unsafe_range"
            ? "لا يمكن الحساب بأمان؛ راجع الكمية والمعدل قبل الحفظ."
            : "تجاوز الحساب الدقة الآمنة؛ لم يُقرب الرقم.",
    };
  const allocationMinor = allocation.amountMinor;
  const label = unitName.trim() || "وحدة كاملة";
  return {
    allocationMinor,
    text: `${formatQuantityMilliFixed3(quantityMilli ?? 0)} ${label} × ${formatMoneyWithUnit(rateMinorPerWholeUnit ?? 0)} لكل 1.000 ${label} = ${formatMoneyWithUnit(allocationMinor ?? 0)}`,
    warning: null,
  };
};
export type CatalogConversionPreview = ReturnType<typeof buildCatalogConversionPreview>;
export type CatalogPerUnitPreview = ReturnType<typeof buildCatalogPerUnitPreview>;
export const catalogAllocationStatusLabel = (status: "known" | "needs_review" | "incomplete" | null) =>
  status === "known"
    ? "مكتمل"
    : status === "needs_review"
      ? "يحتاج مراجعة"
      : status === "incomplete"
        ? "ناقص"
        : "غير محسوب";
