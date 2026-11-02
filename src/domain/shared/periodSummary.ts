/**
 * S14 (DOC-023 / UNIT-002 + العقد المشترك §3.2/§7.1 — أمر ba2ce7b4 §5):
 * ملخص الفترة بمعرفة مستقلة وتغطية — سجل ذو نوع يملكه صاحب معناه عبر
 * ownerDomain، لا دفتر 002 موازٍ ولا حدث بيع/شراء مفصل بتاريخ اليوم.
 *
 *  • المعرفة ليست صفرًا (§3.2): كل بعد بحالته المستقلة — entered (known/
 *    estimated) / none / unknown / skipped / not_applicable — ولا تسقط حالة
 *    أبدًا إلى رقم أو العكس؛ غياب الجواب skipped لا none، والمجهول unknown
 *    معلومة ناقصة محفوظة لا حركة بمبلغ null.
 *  • التغطية (§7.1): التفصيل يغطي كل أبعاده من الملخص — البعد يُخصم من
 *    المتبقي لا يُجمع فوق الإجمالي (مجموع 200 ثم تفصيل 80 يبقي 120 لا 280)،
 *    ومجموع المغطى لا يتجاوز المعلوم بلا تعديل صريح للأصل، والتكلفة/القبض
 *    المجهولان لا يُستنتجان تناسبًا أبدًا (SDF-023/024/025).
 *  • الأبعاد حسب النوع (§7.1): لكل نوع ملخص أبعاده المنطبقة فقط؛ لا بعد
 *    بلا معنى ولا إجمالي حر متعدد المعاني.
 */
export const periodSummaryKinds = [
  "direct_sales",
  "purchases",
  "expenses",
  "owner_transfer",
  "opening_commercial_right",
] as const;
export type PeriodSummaryKind = (typeof periodSummaryKinds)[number];

/** أبعاد الملخص — كل بعد مستقل المعرفة والتغطية (العقد §7.1). */
export const summaryDimensions = [
  "revenue",
  "received",
  "paid",
  "cost",
  "quantity",
  "remainingClaim",
] as const;
export type SummaryDimension = (typeof summaryDimensions)[number];

/** الأبعاد المنطبقة لكل نوع — لا بعد بلا معنى لنوعه. */
export const dimensionsOfKind: Readonly<Record<PeriodSummaryKind, readonly SummaryDimension[]>> = {
  direct_sales: ["revenue", "received", "cost", "remainingClaim"],
  purchases: ["paid", "cost", "remainingClaim"],
  expenses: ["paid"],
  owner_transfer: ["revenue", "paid"],
  opening_commercial_right: ["remainingClaim"],
};

/**
 * قيمة بعد بمعرفته — اتحاد واضح لا مجموعة أعلام متناقضة (العقد §3.2):
 *  • entered: رقم صريح معلوم أو تقديري — الصفر حيث يسمح المعنى قيمة فعلية.
 *  • none: جواب «لا توجد عمليات» في السؤال والنطاق — لا سجل بيع 0.
 *  • unknown: معلومة ناقصة محفوظة — لا حركة مالية بمبلغ null ولا 0 وهمي.
 *  • skipped: السؤال لم يستكمل — لا يساوي none.
 *  • not_applicable: غير منطبق بسبب صالح — ليس وسيلة إخفاء تكلفة مؤثرة.
 */
export type DimensionValue =
  | { state: "entered"; amountMinor: number; knowledge: "known" | "estimated" }
  | { state: "none" }
  | { state: "unknown" }
  | { state: "skipped" }
  | { state: "not_applicable"; reason: string };

/** رابطة تغطية — التفصيل يغطي بُعده من الملخص بمبلغه لا بإجمالي الملخص. */
export type CoverageLink = {
  /** مرجع السجل المفصل (family+id) — لا اسم كمعرف. */
  detailRef: string;
  dimension: SummaryDimension;
  amountMinor: number;
  revision: number;
};

export type PeriodSummary = {
  id: string;
  kind: PeriodSummaryKind;
  /** بيت صاحب المعنى (005/015/027/020…) — 002 منسق لا مالك المحتوى. */
  ownerDomain: string;
  /** مدة يختارها المستخدم — ليست آخر زيارة ولا يومًا مختلقًا. */
  from: string;
  to: string;
  currency: "JOD";
  revision: number;
  recordedAt: string;
  /** «غير المسجل» ظاهرة التغطية — إن شملت مبلغًا مسجلًا يصحح النطاق صراحة. */
  coverageMode: "unrecorded_only" | "completion_batch";
  dimensions: Readonly<Partial<Record<SummaryDimension, DimensionValue>>>;
  coverageLinks: readonly CoverageLink[];
  supersedesRef: string | null;
  supersedesReason: string | null;
  /** مفتاح حتمية الأمر — الإرسال نفسه يعيد الملخص نفسه لا نسخة ثانية. */
  operationKey: string;
};

export type PeriodSummaryDraft = Omit<PeriodSummary, "id" | "revision" | "recordedAt">;

/** إنشاء الملخص النقي — التحقق البنيوي: مدة صالحة معكوسة مرفوضة، والأبعاد
 * من طاقم نوعها، وnone/unknown/skipped لا تحمل مبلغًا أبدًا. */
export function createPeriodSummary(
  id: string,
  draft: PeriodSummaryDraft,
  recordedAt: string,
): PeriodSummary {
  if (draft.from > draft.to) throw new Error("مدة الملخص معكوسة — «من» قبل «إلى» إلزامي.");
  const allowed = new Set<string>(dimensionsOfKind[draft.kind]);
  for (const dimension of Object.keys(draft.dimensions) as SummaryDimension[]) {
    if (!allowed.has(dimension)) throw new Error(`البعد ${dimension} لا ينطبق على ملخص ${draft.kind}.`);
    const value = draft.dimensions[dimension]!;
    if (value.state === "entered" && (!Number.isSafeInteger(value.amountMinor) || value.amountMinor < 0))
      throw new Error(`مبلغ البعد ${dimension} يجب عددًا صحيحًا آمنًا غير سالب.`);
    if (value.state === "not_applicable" && !value.reason.trim())
      throw new Error(`البعد ${dimension} غير المنطبق يحتاج سببًا صالحًا.`);
  }
  if (!draft.operationKey.trim()) throw new Error("مفتاح حتمية الملخص إلزامي.");
  return { ...draft, id, revision: 1, recordedAt };
}

/* ─── حساب التغطية — خصم من المتبقي لا جمع فوق الإجمالي ─── */

export type CoverageRemaining =
  | { state: "not_entered" }
  | { state: "uncovered"; amountMinor: number }
  | { state: "partial"; amountMinor: number }
  | { state: "fully_covered" }
  | { state: "over_covered"; amountMinor: number };

/** المتبقي من بعد داخل ملخصه — مجموع روابط تغطيته يُخصم من المعلوم؛
 * البعد غير المدخل (none/unknown/skipped/not_applicable) لا متبقي له رقميًا
 * أبدًا (SDF-024: لا افتراض 48/32 بالتناسب). */
export function remainingOf(summary: PeriodSummary, dimension: SummaryDimension): CoverageRemaining {
  const value = summary.dimensions[dimension];
  if (value === undefined || value.state !== "entered") return { state: "not_entered" };
  const covered = summary.coverageLinks
    .filter(link => link.dimension === dimension)
    .reduce((sum, link) => sum + link.amountMinor, 0);
  const remaining = value.amountMinor - covered;
  if (remaining > 0) return { state: covered > 0 ? "partial" : "uncovered", amountMinor: remaining };
  if (remaining === 0) return { state: "fully_covered" };
  return { state: "over_covered", amountMinor: remaining };
}

export type CoverageApplication =
  | { ok: true; value: PeriodSummary }
  | {
      ok: false;
      code: "over_coverage" | "dimension_not_entered" | "dimension_not_applicable";
      message: string;
    };

/** تطبيق رابطة تغطية — البعد يجب أن يكون مدخلًا ومتبقيًا يكفي المبلغ،
 * وإلا رفض صادق قبل أي كتابة (SDF-025: لا باقٍ سالب صامت). الروابط تُلحق
 * بالإجمالي المدخل نفسه — الإجماليات لا تتغير بالتغطية أبدًا (SDF-023). */
export function applyCoverageLink(summary: PeriodSummary, link: CoverageLink): CoverageApplication {
  const value = summary.dimensions[link.dimension];
  if (value === undefined || value.state === "not_applicable")
    return {
      ok: false,
      code: value === undefined ? "dimension_not_entered" : "dimension_not_applicable",
      message: `البعد ${link.dimension} غير مدخل في هذا الملخص — صحّح التفصيل أو أضف البعد للأصل صراحة.`,
    };
  if (value.state !== "entered")
    return {
      ok: false,
      code: "dimension_not_entered",
      message: `البعد ${link.dimension} معرفته ${value.state} — لا مبلغ معلوم يغطيه؛ لا يُستنتج رقم بالتناسب.`,
    };
  if (!Number.isSafeInteger(link.amountMinor) || link.amountMinor <= 0)
    throw new Error("مبلغ رابطة التغطية يجب عددًا صحيحًا آمنًا موجبًا.");
  const remaining = remainingOf(summary, link.dimension);
  if (
    remaining.state === "not_entered" ||
    remaining.state === "fully_covered" ||
    remaining.state === "over_covered"
  )
    return {
      ok: false,
      code: "over_coverage",
      message: `تغطية ${link.dimension} تتجاوز المتبقي من الملخص — عدّل مجموع الأصل أو صحّح التفصيل؛ لا باقٍ سالب صامت.`,
    };
  if (link.amountMinor > remaining.amountMinor)
    return {
      ok: false,
      code: "over_coverage",
      message: `تغطية ${link.dimension} بمبلغ ${link.amountMinor} تتجاوز المتبقي ${remaining.amountMinor} — عدّل مجموع الأصل أو صحّح التفصيل؛ لا باقٍ سالب صامت.`,
    };
  return {
    ok: true,
    value: { ...summary, coverageLinks: [...summary.coverageLinks, link] },
  };
}
