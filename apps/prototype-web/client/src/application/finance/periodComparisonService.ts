/**
 * FIN-003 (WS-173 — Wave 1): مقارنة فترتين فوق القارئ الكنوني نفسه — قراءة
 * فقط بلا Writer ولا كتابة عند الفتح إطلاقًا. تستدعي `readRecordedPeriodResult`
 * مرتين (مسار حساب واحد: لا يُعاد اشتقاق أي رقم فترة هنا) وتعرض كل بند كانوني
 * جانبًا إلى جانب مع فرق الإشارة (الحالية − الأساس) وبيان تغيّر آمن النسب
 * (null عند أساس فارغ أو مجهول — لا قسمة على صفر).
 *
 * F-017 (W2-C — إشارة صادقة): الوسيطان مسميان بدلالتهما — `current` ثم
 * `baseline` — والدلتا = الحالية − الأساس، فالتحسن يظهر بإشارة موجبة تحت
 * ترتيب الاستدعاء الإنتاجي (Statement يمرر الحالية أولًا). أساس نقاط الأساس
 * هو الفترة الأساس لا الحالية.
 *
 * قواعد العرض الصادقة (عقد 05 §3.2.1 + عقد 31):
 * • الحالة أسوأ الحالتين: invalid > incomplete > recorded_only؛ وطرف بنطاق
 *   غير صالح يجعل المقارنة كلها invalid ونتيجته null (القارئ الكنوني يفعل
 *   ذلك بنفسه — نُقل كما هو).
 * • الفترة الجارية (تحتوي اليوم) تُوسم partial بملاحظة عربية — لا تُعامل
 *   بصمت كمكتملة، ولا يُخترع لها رقم.
 * • الفترة الفارغة أصفار موثقة مع علم `hasNoData` — لا سرد مُختلق.
 * • تداخل الفترتين مسموح (خيار المستخدم) لكنه يُعلَم بملاحظة ظاهرة.
 * • كل سطر يحمل مصدره (عائلة/اشتقاق) بأسلوب الكشف الحي.
 */
import { localDateInAmman } from "@micro-domain/shared/index.js";
import { roundHalfUp } from "@micro-domain/shared/index.js";
import { isPeriodActive } from "@/application/finance/periodPresets";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import type {
  CogsStatus,
  FinanceResult,
  RecordedPeriodResult,
} from "@/application/finance/projectFinancialService";
import type { PrototypeLocalStore } from "@/storage/local/types";
import type { ProjectFinancialServiceStore } from "./projectFinancialService";

/** R3 (بطاقة R3-SC-01/11): عدسة الخدمة — منسّق مقارنة الفترات — يفوّض للقارئ الكنوني نفسه. */
export type PeriodComparisonServiceStore = ProjectFinancialServiceStore;
import { STORAGE_ERROR, storageFailure } from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";

/* STR-620/608 (Wave F — تكثيف الهامش): الحرفية نفسها كانت تتكرر في هذا الملف
 * عدّة مرات؛ ثابت واحد بلا أي تغيير رسالة. */
const CANONICAL_READER_COUNTER_LABEL = "القارئ الكنوني — عدّاد";

export type PeriodComparisonStatus = "recorded_only" | "incomplete" | "invalid";

export type PeriodComparisonSide = {
  from: string;
  to: string;
  /** حالة القارئ الكنوني لهذا الطرف كما هي — لا إعادة تصنيف هنا. */
  status: PeriodComparisonStatus;
  reasons: readonly string[];
  cogsStatus: CogsStatus;
  cogsReasons: readonly string[];
  inventoryManagedFrom: string | null;
  resultMinor: number | null;
  /** لا مساهمة مسجلة إطلاقًا داخل هذه الفترة — أصفار موثقة لا سرد مُختلق. */
  hasNoData: boolean;
};

export type PeriodComparisonLineKind = "money" | "count";

export type PeriodComparisonLine = {
  id: string;
  /** تسمية العرض العربية للبند. */
  label: string;
  /** مصدر البند/عائلته — بأسلوب الكشف الحي («كل سطر يصل بمصدره»). */
  source: string;
  kind: PeriodComparisonLineKind;
  /** قيمة الفترة الحالية (طرف a؛ null فقط حين تكون المعرفة نفسها غير متاحة: نطاق غير صالح أو نتيجة غير متاحة). */
  a: number | null;
  /** قيمة فترة الأساس (طرف b) بنفس الدلالة. */
  b: number | null;
  /* F-017 (W2-C): الدلتا = الحالية − الأساس (a − b)؛ null عند غياب أي طرف —
   * التحسن موجب والتراجع سالب، بلا كلمة اتجاه مفبركة. */
  delta: number | null;
  /** التغيّر بنقاط الأساس على أساس فترة الأساس (١٠٠ = 1%)؛ null عند أساس null/صفر أو طرف غائب — لا قسمة على صفر. */
  changeBps: number | null;
};

export type PeriodComparisonReading = {
  sides: { a: PeriodComparisonSide; b: PeriodComparisonSide };
  lines: readonly PeriodComparisonLine[];
  status: PeriodComparisonStatus;
  /** فترة جارية تحتوي اليوم — مؤهل صادق لا تغيير صامت للحالة. */
  partial: boolean;
  partialNote: string | null;
  overlapping: boolean;
  overlappingNote: string | null;
  deltaResultMinor: number | null;
  changeResultBps: number | null;
};

type LineSpec = {
  id: string;
  label: string;
  source: string;
  kind: PeriodComparisonLineKind;
  read: (period: RecordedPeriodResult) => number | null;
  countsTowardData: boolean;
};

/* كل حقل رقمي في `RecordedPeriodResult` يصبح سطرًا — لا بند كانوني يُختصر
 * ولا يُدمج: إيراد وتكلفة ومصاريف المشروع/المشترك/القديم وبنود عقد 31 غير
 * النقدية وقيم المخزون غير المحملة والنتيجة، ثم العدّادات. */
const LINE_SPECS: readonly LineSpec[] = [
  {
    id: "recognizedRevenue",
    label: "إيراد طلبات مسلّمة نهائية",
    source: "القارئ الكنوني — طلبات مسلّمة بنتيجة final بتاريخ حدث التسليم بتوقيت عمّان",
    kind: "money",
    read: period => period.recognizedRevenueMinor,
    countsTowardData: true,
  },
  {
    id: "directSaleRevenue",
    label: "إيراد بيع مباشر",
    source: "القارئ الكنوني — بيع مباشر فعّال بتاريخ البيع نفسه (سياسة F-005)",
    kind: "money",
    read: period => period.directSaleRevenueMinor,
    countsTowardData: true,
  },
  {
    id: "recognizedDirectCost",
    label: "تكلفة مباشرة من نسخة التكلفة",
    source: "القارئ الكنوني — مجموع recognizedCostMinor للطلبات النهائية",
    kind: "money",
    read: period => period.recognizedDirectCostMinor,
    countsTowardData: true,
  },
  {
    id: "snapshotDirectCost",
    label: "تكلفة نسخة مباشرة (Snapshot)",
    source: "القارئ الكنوني — Snapshot كاملة قبل سياسة COGS",
    kind: "money",
    read: period => period.snapshotDirectCostMinor,
    countsTowardData: true,
  },
  {
    id: "recordedCogs",
    label: "COGS مسجلة من الاستهلاك المثبت",
    source: "القارئ الكنوني — استهلاك مثبت مرتبط بالطلبات النهائية (عقد 14 §4)",
    kind: "money",
    read: period => period.recordedCogsMinor,
    countsTowardData: true,
  },
  {
    id: "effectiveDirectCost",
    label: "التكلفة المباشرة المستخدمة في المعادلة",
    source: "القارئ الكنوني — سياسة المصدر الواحدة: COGS أو نسخة التكلفة",
    kind: "money",
    read: period => period.effectiveDirectCostMinor,
    countsTowardData: true,
  },
  {
    id: "directSaleCostKnown",
    label: "تكلفة بيع مباشر معروفة",
    source: "القارئ الكنوني — مجموع المعروف من تكلفة البيع المباشر",
    kind: "money",
    read: period => period.directSaleCostKnownMinor,
    countsTowardData: true,
  },
  {
    id: "recordedOperatingExpense",
    label: "مصروف تشغيلي مسجل (دفع + استحقاق)",
    source: "القارئ الكنوني — أحداث المصروف التشغيلي مرة واحدة بتاريخ occurredOn",
    kind: "money",
    read: period => period.recordedOperatingExpenseMinor,
    countsTowardData: true,
  },
  {
    id: "projectOperatingExpense",
    label: "مصروف مشروع مباشر",
    source: "القارئ الكنوني — مصاريف relationship: project",
    kind: "money",
    read: period => period.projectOperatingExpenseMinor,
    countsTowardData: true,
  },
  {
    id: "sharedProjectExpense",
    label: "حصة مشروع من مصروف مشترك",
    source: "القارئ الكنوني — الحصة المسجلة فقط، لا إجمالي مصدر البيت",
    kind: "money",
    read: period => period.sharedProjectExpenseMinor,
    countsTowardData: true,
  },
  {
    id: "legacyUnclassifiedExpense",
    label: "مصروفات قديمة غير مصنفة",
    source: "القارئ الكنوني — أحداث بلا سياق مصروف؛ تُعرض منفصلة ولا تختفي",
    kind: "money",
    read: period => period.legacyUnclassifiedExpenseMinor,
    countsTowardData: true,
  },
  {
    id: "sharedUnallocatedExpense",
    label: "مصادر مشتركة غير محملة (خارج النتيجة)",
    source: "القارئ الكنوني — إجماليات محفوظة بلا حصة معلنة؛ لا تدخل النتيجة ولا تصبح صفرًا",
    kind: "money",
    read: period => period.sharedUnallocatedExpenseMinor,
    countsTowardData: true,
  },
  {
    id: "unallocatedInventoryCost",
    label: "استهلاك مخزون غير موزع (خارج النتيجة)",
    source: "القارئ الكنوني — استهلاك عام بلا طلب؛ ظاهر بلا توزيع تلقائي",
    kind: "money",
    read: period => period.unallocatedInventoryCostMinor,
    countsTowardData: true,
  },
  {
    id: "generalInventoryWaste",
    label: "هدر عام (خارج النتيجة)",
    source: "القارئ الكنوني — هدر عام؛ لا يسمى COGS ولا يُحمّل تلقائيًا",
    kind: "money",
    read: period => period.generalInventoryWasteMinor,
    countsTowardData: true,
  },
  {
    id: "assetDepreciation",
    label: "إهلاك مسجّل (بند غير نقدي)",
    source: "القارئ الكنوني — عقد 31/29: بند مستقل يخفض النتيجة ولا يمر بالكاش",
    kind: "money",
    read: period => period.assetDepreciationMinor,
    countsTowardData: true,
  },
  {
    id: "assetWriteOffLoss",
    label: "خسارة شطب أصل (بند غير نقدي)",
    source: "القارئ الكنوني — عقد 31/29: مبلغ دفتري مفقود صراحةً",
    kind: "money",
    read: period => period.assetWriteOffLossMinor,
    countsTowardData: true,
  },
  {
    id: "assetDisposalResult",
    label: "نتيجة تخلص من أصل (بند غير نقدي)",
    source: "القارئ الكنوني — المقابل ناقص الدفتري، بإشارته",
    kind: "money",
    read: period => period.assetDisposalResultMinor,
    countsTowardData: true,
  },
  {
    id: "retainedDepositRevenue",
    label: "إيراد عربون محتفظ مصنّف",
    source: "القارئ الكنوني — يُعترف مرة واحدة بتاريخ التصنيف؛ كاشه دخل سابقًا",
    kind: "money",
    read: period => period.retainedDepositRevenueMinor,
    countsTowardData: true,
  },
  {
    id: "resultMinor",
    label: "نتيجة الفترة المسجلة",
    source: "القارئ الكنوني readRecordedPeriodResult — عقد 05 §3.2.1؛ null = غير متاحة",
    kind: "money",
    read: period => period.resultMinor,
    countsTowardData: true,
  },
  {
    id: "finalOrderCount",
    label: "طلبات نهائية مسجلة",
    source: CANONICAL_READER_COUNTER_LABEL,
    kind: "count",
    read: period => period.finalOrderCount,
    countsTowardData: true,
  },
  {
    id: "excludedOrderCount",
    label: "طلبات مسلّمة مستبعدة",
    source: "القارئ الكنوني — مسلّم بنتيجة غير نهائية؛ مستبعد ومعلَن",
    kind: "count",
    read: period => period.excludedOrderCount,
    countsTowardData: true,
  },
  {
    id: "directSaleCount",
    label: "مبيعات مباشرة فعّالة",
    source: CANONICAL_READER_COUNTER_LABEL,
    kind: "count",
    read: period => period.directSaleCount,
    countsTowardData: true,
  },
  {
    id: "directSaleCancelledCount",
    label: "مبيعات مباشرة ملغاة",
    source: "القارئ الكنوني — ملغى داخل الفترة؛ مستبعد ومعلَن",
    kind: "count",
    read: period => period.directSaleCancelledCount,
    countsTowardData: true,
  },
  {
    id: "directSaleCostUnknownCount",
    label: "بيوع بتكلفة غير معروفة",
    source: "القارئ الكنوني — تمنع رقم النتيجة النهائي؛ لا تُقرأ صفرًا",
    kind: "count",
    read: period => period.directSaleCostUnknownCount,
    countsTowardData: true,
  },
  {
    id: "sharedEstimatedExpenseCount",
    label: "حصص مشتركة تقديرية",
    source: CANONICAL_READER_COUNTER_LABEL,
    kind: "count",
    read: period => period.sharedEstimatedExpenseCount,
    countsTowardData: true,
  },
  {
    id: "sharedMissingBasisCount",
    label: "حصص بلا مصدر موثق",
    source: CANONICAL_READER_COUNTER_LABEL,
    kind: "count",
    read: period => period.sharedMissingBasisCount,
    countsTowardData: true,
  },
  {
    id: "sharedUnallocatedExpenseCount",
    label: "مصادر مشتركة غير محملة",
    source: CANONICAL_READER_COUNTER_LABEL,
    kind: "count",
    read: period => period.sharedUnallocatedExpenseCount,
    countsTowardData: true,
  },
  {
    id: "legacyUnclassifiedExpenseCount",
    label: "مصروفات غير مصنفة",
    source: CANONICAL_READER_COUNTER_LABEL,
    kind: "count",
    read: period => period.legacyUnclassifiedExpenseCount,
    countsTowardData: true,
  },
  {
    id: "expenseNeedsReviewCount",
    label: "مصاريف تحتاج مراجعة",
    source: CANONICAL_READER_COUNTER_LABEL,
    kind: "count",
    read: period => period.expenseNeedsReviewCount,
    countsTowardData: true,
  },
  {
    id: "cogsMissingOrderCount",
    label: "طلبات بلا تكلفة مواد مكتملة",
    source: "القارئ الكنوني — رجعت لنسخة التكلفة لغياب استهلاك مؤهل",
    kind: "count",
    read: period => period.cogsMissingOrderCount,
    countsTowardData: true,
  },
];

const PARTIAL_NOTE = "فترة جارية غير مكتملة — أحد هذه الفترات ما زالت مستمرة، فأرقامها جزئية حتى تكتمل.";
const OVERLAPPING_NOTE = "الفترتان متداخلتان — مقارنة بخيارك الصريح، فبعض الأحداث تدخل الطرفين معًا.";

function worstStatus(left: PeriodComparisonStatus, right: PeriodComparisonStatus): PeriodComparisonStatus {
  const rank: Record<PeriodComparisonStatus, number> = { invalid: 3, incomplete: 2, recorded_only: 1 };
  return rank[left] >= rank[right] ? left : right;
}

function sideOf(period: RecordedPeriodResult): PeriodComparisonSide {
  const hasNoData = LINE_SPECS.every(spec => {
    const value = spec.read(period);
    return value === null || value === 0;
  });
  return {
    from: period.from,
    to: period.to,
    status: period.status,
    reasons: period.reasons,
    cogsStatus: period.cogsStatus,
    cogsReasons: period.cogsReasons,
    inventoryManagedFrom: period.inventoryManagedFrom,
    resultMinor: period.resultMinor,
    hasNoData,
  };
}

function lineOf(
  spec: LineSpec,
  current: RecordedPeriodResult,
  baseline: RecordedPeriodResult,
): PeriodComparisonLine {
  const valueA = spec.read(current);
  const valueB = spec.read(baseline);
  /* F-017 (W2-C): الحالية − الأساس — التحسن موجب. */
  const delta = valueA !== null && valueB !== null ? valueA - valueB : null;
  const changeBps =
    delta !== null && valueB !== null && valueB !== 0 ? roundHalfUp(delta * 10_000, valueB) : null;
  return {
    id: spec.id,
    label: spec.label,
    source: spec.source,
    kind: spec.kind,
    a: valueA,
    b: valueB,
    delta,
    changeBps,
  };
}

export class PeriodComparisonService {
  private readonly finance: ProjectFinancialService;

  constructor(
    private readonly store: PeriodComparisonServiceStore,
    private readonly now: Clock = systemClock,
  ) {
    /* مسار حساب واحد: القارئ الكنوني نفسه الذي تستهلكه الكشوف والمؤشرات —
     * لا تُشتق هنا أي معادلة فترة، ولا يُلمس المخزن إلا قراءةً. */
    this.finance = new ProjectFinancialService(store, now);
  }

  async readPeriodComparison(
    current: { from: string; to: string },
    baseline: { from: string; to: string },
  ): Promise<FinanceResult<PeriodComparisonReading>> {
    const [readingA, readingB] = await Promise.all([
      this.finance.readRecordedPeriodResult(current.from, current.to),
      this.finance.readRecordedPeriodResult(baseline.from, baseline.to),
    ]);
    if (!readingA.ok || !readingB.ok) return storageFailure("تعذر قراءة نتيجتي الفترتين المحليتين.");
    const a = readingA.value;
    const b = readingB.value;
    const todayLocal = localDateInAmman(this.now());
    const partial =
      isPeriodActive({ from: a.from, to: a.to }, todayLocal) ||
      isPeriodActive({ from: b.from, to: b.to }, todayLocal);
    const overlapping = a.from <= b.to && b.from <= a.to;
    const resultLine = lineOf(
      LINE_SPECS.find(spec => spec.id === "resultMinor")!,
      a,
      b,
    );
    return {
      ok: true,
      value: {
        sides: { a: sideOf(a), b: sideOf(b) },
        lines: LINE_SPECS.map(spec => lineOf(spec, a, b)),
        status: worstStatus(a.status, b.status),
        partial,
        partialNote: partial ? PARTIAL_NOTE : null,
        overlapping,
        overlappingNote: overlapping ? OVERLAPPING_NOTE : null,
        deltaResultMinor: resultLine.delta,
        changeResultBps: resultLine.changeBps,
      },
    };
  }
}
